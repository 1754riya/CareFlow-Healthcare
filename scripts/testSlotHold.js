/**
 * Exercises the REAL, unmodified api/hold-slot.js, api/release-slot-hold.js,
 * and api/book-appointment.js handlers against the in-memory Firestore fake
 * (real optimistic-concurrency transactions — see scripts/test-support/), so
 * none of this ever touches a live Firebase project.
 *
 * Run with:  node scripts/testSlotHold.js
 */
import { register } from 'node:module';
import assert from 'node:assert/strict';
import { toDateKey } from '../src/utils/slotGeneration.js';

register('./test-support/firebaseAdminLoader.mjs', import.meta.url);

const { __fakeDb, __reset: resetDb } = await import('./test-support/fakeFirebaseAdmin.mjs');
const { default: holdHandler } = await import('../api/hold-slot.js');
const { default: releaseHandler } = await import('../api/release-slot-hold.js');
const { default: bookHandler } = await import('../api/book-appointment.js');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✔ ${name}`);
    passed++;
  } catch (err) {
    console.error(`✘ ${name}`);
    console.error(err);
    failed++;
  }
}

function makeToken(payload) { return Buffer.from(JSON.stringify(payload)).toString('base64'); }
function makeReq({ uid, body }) {
  return { method: 'POST', headers: { authorization: `Bearer ${makeToken({ uid })}` }, body };
}
function makeRes() {
  return { statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(o) { this.body = o; return this; } };
}

const ALL_DAYS_AVAILABILITY = Object.fromEntries(
  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    .map(day => [day, ['9:00 AM', '10:00 AM', '11:00 AM']])
);

async function seedDoctor(id, data = {}) {
  await __fakeDb.collection('doctors').doc(id).set({
    firstName: 'Test', lastName: 'Doctor', name: 'Dr. Test Doctor',
    specialty: 'Cardiology', active: true, slotDuration: 60,
    availability: ALL_DAYS_AVAILABILITY, blockedDates: [],
    email: 'doctor@example.com',
    ...data,
  });
}

function futureDate(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function resetAll() {
  resetDb();
  await seedDoctor('doc-1');
}

function holdId(doctorId, dateKey, timeSlot) { return `${doctorId}_${dateKey}_${timeSlot}`; }

/* ── 1. Patient A holds slot → Patient B cannot hold it ── */
await test('Patient A holds a slot; Patient B cannot hold the same slot', async () => {
  await resetAll();
  const dateKey = toDateKey(futureDate(10));

  const resA = makeRes();
  await holdHandler(makeReq({ uid: 'patientA', body: { doctorId: 'doc-1', dateKey, timeSlot: '9:00 AM' } }), resA);
  assert.equal(resA.statusCode, 200, JSON.stringify(resA.body));

  const resB = makeRes();
  await holdHandler(makeReq({ uid: 'patientB', body: { doctorId: 'doc-1', dateKey, timeSlot: '9:00 AM' } }), resB);
  assert.equal(resB.statusCode, 409, JSON.stringify(resB.body));
  assert.ok(resB.body.error.includes('held by another patient'));

  const stored = __fakeDb.read('slotHolds', holdId('doc-1', dateKey, '9:00 AM'));
  assert.equal(stored.patientId, 'patientA', "Patient A's hold must remain intact");
});

await test("Patient A can re-hold (refresh) their own slot without a conflict", async () => {
  await resetAll();
  const dateKey = toDateKey(futureDate(10));

  await holdHandler(makeReq({ uid: 'patientA', body: { doctorId: 'doc-1', dateKey, timeSlot: '9:00 AM' } }), makeRes());
  const res2 = makeRes();
  await holdHandler(makeReq({ uid: 'patientA', body: { doctorId: 'doc-1', dateKey, timeSlot: '9:00 AM' } }), res2);
  assert.equal(res2.statusCode, 200, JSON.stringify(res2.body));
});

/* ── 2. Hold expires → slot becomes available ── */
await test('an expired hold no longer blocks another patient from holding the slot', async () => {
  await resetAll();
  const dateKey = toDateKey(futureDate(10));
  const id = holdId('doc-1', dateKey, '9:00 AM');

  // Simulate a hold created 10 minutes ago that already expired 5 minutes ago.
  await __fakeDb.collection('slotHolds').doc(id).set({
    doctorId: 'doc-1', dateKey, timeSlot: '9:00 AM', patientId: 'patientA',
    createdAt: new Date(Date.now() - 10 * 60000),
    expiresAt: new Date(Date.now() - 5 * 60000),
  });

  const res = makeRes();
  await holdHandler(makeReq({ uid: 'patientB', body: { doctorId: 'doc-1', dateKey, timeSlot: '9:00 AM' } }), res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));

  const stored = __fakeDb.read('slotHolds', id);
  assert.equal(stored.patientId, 'patientB', 'the expired hold should have been overwritten by the new one');
});

await test('a booking attempt ignores an expired hold from another patient', async () => {
  await resetAll();
  await __fakeDb.collection('patients').doc('patientB').set({ email: 'b@example.com' });
  const dateKey = toDateKey(futureDate(10));
  const id = holdId('doc-1', dateKey, '9:00 AM');

  await __fakeDb.collection('slotHolds').doc(id).set({
    doctorId: 'doc-1', dateKey, timeSlot: '9:00 AM', patientId: 'patientA',
    createdAt: new Date(Date.now() - 10 * 60000),
    expiresAt: new Date(Date.now() - 5 * 60000), // expired
  });

  const res = makeRes();
  await bookHandler(makeReq({ uid: 'patientB', body: { doctorId: 'doc-1', dateKey, timeSlot: '9:00 AM' } }), res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
});

/* ── 3. Patient books → hold is removed ── */
await test('successfully booking a slot deletes the patient\'s own hold on it', async () => {
  await resetAll();
  const dateKey = toDateKey(futureDate(10));
  const id = holdId('doc-1', dateKey, '9:00 AM');

  const holdRes = makeRes();
  await holdHandler(makeReq({ uid: 'patientA', body: { doctorId: 'doc-1', dateKey, timeSlot: '9:00 AM' } }), holdRes);
  assert.equal(holdRes.statusCode, 200, JSON.stringify(holdRes.body));
  assert.ok(__fakeDb.read('slotHolds', id), 'hold should exist before booking');

  const bookRes = makeRes();
  await bookHandler(makeReq({ uid: 'patientA', body: { doctorId: 'doc-1', dateKey, timeSlot: '9:00 AM' } }), bookRes);
  assert.equal(bookRes.statusCode, 200, JSON.stringify(bookRes.body));

  assert.equal(__fakeDb.read('slotHolds', id), undefined, 'hold must be deleted once the appointment is booked');
});

/* ── 4. Patient abandons flow → hold eventually expires ── */
await test('an explicit release removes the hold (patient goes back/leaves the flow)', async () => {
  await resetAll();
  const dateKey = toDateKey(futureDate(10));
  const id = holdId('doc-1', dateKey, '9:00 AM');

  await holdHandler(makeReq({ uid: 'patientA', body: { doctorId: 'doc-1', dateKey, timeSlot: '9:00 AM' } }), makeRes());
  assert.ok(__fakeDb.read('slotHolds', id));

  const res = makeRes();
  await releaseHandler(makeReq({ uid: 'patientA', body: { doctorId: 'doc-1', dateKey, timeSlot: '9:00 AM' } }), res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(__fakeDb.read('slotHolds', id), undefined);
});

await test('release only removes a hold belonging to the caller, never someone else\'s', async () => {
  await resetAll();
  const dateKey = toDateKey(futureDate(10));
  const id = holdId('doc-1', dateKey, '9:00 AM');

  await holdHandler(makeReq({ uid: 'patientA', body: { doctorId: 'doc-1', dateKey, timeSlot: '9:00 AM' } }), makeRes());

  const res = makeRes();
  await releaseHandler(makeReq({ uid: 'patientB', body: { doctorId: 'doc-1', dateKey, timeSlot: '9:00 AM' } }), res);
  assert.equal(res.statusCode, 200); // no error, just a no-op
  assert.ok(__fakeDb.read('slotHolds', id), "Patient A's hold must survive Patient B's release attempt");
});

await test('an abandoned hold (no explicit release) is simply ignored once expired — no cleanup job needed', async () => {
  await resetAll();
  await __fakeDb.collection('patients').doc('patientB').set({ email: 'b@example.com' });
  const dateKey = toDateKey(futureDate(10));
  const id = holdId('doc-1', dateKey, '9:00 AM');

  // Patient A held it and never came back (tab closed) — simulate by
  // seeding an old, expired hold with no corresponding release call.
  await __fakeDb.collection('slotHolds').doc(id).set({
    doctorId: 'doc-1', dateKey, timeSlot: '9:00 AM', patientId: 'patientA',
    createdAt: new Date(Date.now() - 10 * 60000),
    expiresAt: new Date(Date.now() - 1000),
  });

  const res = makeRes();
  await bookHandler(makeReq({ uid: 'patientB', body: { doctorId: 'doc-1', dateKey, timeSlot: '9:00 AM' } }), res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
});

/* ── 5. Simultaneous hold attempts → only one succeeds ── */
await test('two simultaneous hold attempts for the same slot — exactly one succeeds', async () => {
  await resetAll();
  const dateKey = toDateKey(futureDate(11));
  const resA = makeRes();
  const resB = makeRes();

  await Promise.all([
    holdHandler(makeReq({ uid: 'patientA', body: { doctorId: 'doc-1', dateKey, timeSlot: '9:00 AM' } }), resA),
    holdHandler(makeReq({ uid: 'patientB', body: { doctorId: 'doc-1', dateKey, timeSlot: '9:00 AM' } }), resB),
  ]);

  const statuses = [resA.statusCode, resB.statusCode].sort();
  assert.deepEqual(statuses, [200, 409], `expected exactly one 200 and one 409, got ${JSON.stringify(statuses)}`);

  const id = holdId('doc-1', dateKey, '9:00 AM');
  const stored = __fakeDb.read('slotHolds', id);
  const winnerUid = resA.statusCode === 200 ? 'patientA' : 'patientB';
  assert.equal(stored.patientId, winnerUid);
});

/* ── 6. Existing double-booking protection still works ── */
await test('booking still rejects a slot that is already confirmed-booked, with no hold involved at all', async () => {
  await resetAll();
  const dateKey = toDateKey(futureDate(10));

  const first = makeRes();
  await bookHandler(makeReq({ uid: 'patientA', body: { doctorId: 'doc-1', dateKey, timeSlot: '9:00 AM' } }), first);
  assert.equal(first.statusCode, 200, JSON.stringify(first.body));

  const second = makeRes();
  await bookHandler(makeReq({ uid: 'patientB', body: { doctorId: 'doc-1', dateKey, timeSlot: '9:00 AM' } }), second);
  assert.equal(second.statusCode, 409, JSON.stringify(second.body));
  assert.ok(second.body.error.includes('no longer available'), 'must be the ORIGINAL confirmed-booking rejection message, unchanged');
});

await test('two simultaneous bookings for the same never-held slot — exactly one succeeds (original protection intact)', async () => {
  await resetAll();
  const dateKey = toDateKey(futureDate(12));
  const resA = makeRes();
  const resB = makeRes();

  await Promise.all([
    bookHandler(makeReq({ uid: 'patientA', body: { doctorId: 'doc-1', dateKey, timeSlot: '9:00 AM' } }), resA),
    bookHandler(makeReq({ uid: 'patientB', body: { doctorId: 'doc-1', dateKey, timeSlot: '9:00 AM' } }), resB),
  ]);

  const statuses = [resA.statusCode, resB.statusCode].sort();
  assert.deepEqual(statuses, [200, 409], `expected exactly one 200 and one 409, got ${JSON.stringify(statuses)}`);
});

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
