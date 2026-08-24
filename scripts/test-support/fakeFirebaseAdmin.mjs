/**
 * In-memory stand-in for api/_lib/firebaseAdmin.js, used only by
 * scripts/testBookingConcurrency.js (via a module-resolution loader hook —
 * see firebaseAdminLoader.mjs) so the REAL, unmodified api/book-appointment.js
 * handler can be exercised without a live Firestore project.
 *
 * Firestore transactions use optimistic concurrency control (OCC): a
 * transaction records the "version" of everything it reads; at commit time,
 * if anything it read has changed, the whole transaction is silently retried
 * from scratch (application errors thrown from the callback are NOT
 * retried — they propagate immediately, same as real Firestore). This fake
 * reimplements that exact protocol so concurrent handler invocations race
 * for real, rather than being serialized by test-harness sequencing.
 */

class FakeDocRef {
  constructor(store, collectionName, id) {
    this.store = store;
    this.collectionName = collectionName;
    this.id = id;
  }
  async get() {
    const data = this.store.read(this.collectionName, this.id);
    return { exists: data !== undefined, id: this.id, data: () => data };
  }
  async set(data, options = {}) {
    if (options.merge) {
      const existing = this.store.read(this.collectionName, this.id) || {};
      this.store.write(this.collectionName, this.id, { ...existing, ...data });
    } else {
      this.store.write(this.collectionName, this.id, data);
    }
  }
  async delete() {
    this.store.delete(this.collectionName, this.id);
  }
}

class FakeQuery {
  constructor(store, collectionName, filters) {
    this.store = store;
    this.collectionName = collectionName;
    this.filters = filters;
  }
  where(field, op, value) {
    return new FakeQuery(this.store, this.collectionName, [...this.filters, { field, op, value }]);
  }
  async get() {
    const docs = this.store.query(this.collectionName, this.filters);
    return {
      docs: docs.map(({ id, data }) => ({
        id, data: () => data, ref: new FakeDocRef(this.store, this.collectionName, id),
      })),
      empty: docs.length === 0,
    };
  }
}

class FakeCollectionRef {
  constructor(store, name) { this.store = store; this.name = name; }
  doc(id) { return new FakeDocRef(this.store, this.name, id || this.store.newId()); }
  where(field, op, value) { return new FakeQuery(this.store, this.name, [{ field, op, value }]); }
  async add(data) {
    const ref = new FakeDocRef(this.store, this.name, this.store.newId());
    await ref.set(data);
    return ref;
  }
}

function matchesFilter(data, filter) {
  if (filter.op !== '==') throw new Error(`Fake Firestore: unsupported operator ${filter.op}`);
  return data[filter.field] === filter.value;
}

class FakeFirestore {
  constructor() { this.reset(); }

  reset() {
    this.collections = new Map();  // name -> Map(id -> { data, version })
    this.colVersions = new Map();  // name -> version, bumped on every write to that collection
    this._idCounter = 0;
  }

  newId() { return `fake-${++this._idCounter}`; }

  _col(name) {
    if (!this.collections.has(name)) this.collections.set(name, new Map());
    return this.collections.get(name);
  }

  read(collectionName, id) {
    return this._col(collectionName).get(id)?.data;
  }

  readVersion(collectionName, id) {
    return this._col(collectionName).get(id)?.version ?? 0;
  }

  collectionVersion(name) {
    return this.colVersions.get(name) ?? 0;
  }

  write(collectionName, id, data) {
    const col = this._col(collectionName);
    col.set(id, { data, version: (col.get(id)?.version ?? 0) + 1 });
    this.colVersions.set(collectionName, this.collectionVersion(collectionName) + 1);
  }

  delete(collectionName, id) {
    this._col(collectionName).delete(id);
    this.colVersions.set(collectionName, this.collectionVersion(collectionName) + 1);
  }

  query(collectionName, filters) {
    const results = [];
    for (const [id, entry] of this._col(collectionName).entries()) {
      if (filters.every(f => matchesFilter(entry.data, f))) results.push({ id, data: entry.data });
    }
    return results;
  }

  collection(name) { return new FakeCollectionRef(this, name); }

  async runTransaction(updateFunction, { maxAttempts = 25 } = {}) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Yield a real microtask so concurrently-invoked runTransaction calls
      // genuinely interleave instead of one running start-to-finish first.
      await Promise.resolve();

      const readVersions = new Map(); // "collection:id" or "__collection__:name" -> version at read time
      const pendingOps = [];

      const transaction = {
        get: async (refOrQuery) => {
          await Promise.resolve();
          if (refOrQuery instanceof FakeQuery) {
            const results = this.query(refOrQuery.collectionName, refOrQuery.filters);
            for (const { id } of results) {
              readVersions.set(`${refOrQuery.collectionName}:${id}`, this.readVersion(refOrQuery.collectionName, id));
            }
            // Track the collection as a whole too, so a doc created after
            // this read (and therefore absent from `results`) still
            // correctly invalidates this transaction on commit.
            readVersions.set(`__collection__:${refOrQuery.collectionName}`, this.collectionVersion(refOrQuery.collectionName));
            return { docs: results.map(({ id, data }) => ({ id, data: () => data })), empty: results.length === 0 };
          }
          readVersions.set(`${refOrQuery.collectionName}:${refOrQuery.id}`, this.readVersion(refOrQuery.collectionName, refOrQuery.id));
          const data = this.read(refOrQuery.collectionName, refOrQuery.id);
          return { exists: data !== undefined, id: refOrQuery.id, data: () => data };
        },
        set: (ref, data, options = {}) => { pendingOps.push({ type: 'set', ref, data, options }); },
        delete: (ref) => { pendingOps.push({ type: 'delete', ref }); },
      };

      // Application errors (e.g. the handler's 409 "slot no longer
      // available") must propagate immediately — only OCC conflicts retry.
      const result = await updateFunction(transaction);

      let conflict = false;
      for (const [key, version] of readVersions) {
        if (key.startsWith('__collection__:')) {
          if (this.collectionVersion(key.slice('__collection__:'.length)) !== version) { conflict = true; break; }
        } else {
          const sep = key.indexOf(':');
          if (this.readVersion(key.slice(0, sep), key.slice(sep + 1)) !== version) { conflict = true; break; }
        }
      }

      if (!conflict) {
        for (const op of pendingOps) {
          if (op.type === 'delete') {
            this.delete(op.ref.collectionName, op.ref.id);
          } else if (op.options?.merge) {
            const existing = this.read(op.ref.collectionName, op.ref.id) || {};
            this.write(op.ref.collectionName, op.ref.id, { ...existing, ...op.data });
          } else {
            this.write(op.ref.collectionName, op.ref.id, op.data);
          }
        }
        return result;
      }
      // else: retry — another transaction committed a change we depended on.
    }
    throw new Error('Fake Firestore: transaction did not converge after max attempts');
  }
}

export const __fakeDb = new FakeFirestore();
export function __reset() { __fakeDb.reset(); __resetAuth(); }

export function getAdminDb() { return __fakeDb; }

// Separate from __fakeDb (Firestore) — mirrors Firebase Auth being its own
// system in real Firebase. Only tracks what api/admin.js's create-doctor
// action needs.
const __fakeAuthUsersByEmail = new Map();
let __fakeAuthUidCounter = 0;

export function __resetAuth() {
  __fakeAuthUsersByEmail.clear();
  __fakeAuthUidCounter = 0;
}

export function getAdminAuth() {
  return {
    async verifyIdToken(token) {
      try {
        return JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
      } catch {
        const err = new Error('Invalid fake token');
        err.code = 'auth/argument-error';
        throw err;
      }
    },
    async createUser({ email, password, displayName }) {
      if (__fakeAuthUsersByEmail.has(email)) {
        const err = new Error('The email address is already in use by another account.');
        err.code = 'auth/email-already-exists';
        throw err;
      }
      const uid = `fake-auth-${++__fakeAuthUidCounter}`;
      const record = { uid, email, displayName, password };
      __fakeAuthUsersByEmail.set(email, record);
      return record;
    },
  };
}

export async function requireAuthenticatedUser(req) {
  const header = req.headers?.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new Error('Missing Authorization bearer token.');
  return getAdminAuth().verifyIdToken(token);
}
