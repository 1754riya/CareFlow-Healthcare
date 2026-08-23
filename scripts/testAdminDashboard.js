/**
 * Exercises the REAL, unmodified api/admin/create-doctor.js and
 * api/admin/update-doctor.js handlers (plus the requireAdmin auth gate they
 * share) against the in-memory Firestore fake — so none of this ever
 * touches a live Firebase project.
 *
 * Run with:  node scripts/testAdminDashboard.js
 */
import { register } from 'node:module';
import assert from 'node:assert/strict';

register('./test-support/firebaseAdminLoader.mjs', import.meta.url);

const { __fakeDb, __reset: resetDb } = await import('./test-support/fakeFirebaseAdmin.mjs');
const { default: createDoctorHandler } = await import('../api/admin/create-doctor.js');
const { default: updateDoctorHandler } = await import('../api/admin/update-doctor.js');

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
  return { method: 'POST', headers: uid ? { authorization: `Bearer ${makeToken({ uid })}` } : {}, body };
}
function makeRes() {
  return { statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(o) { this.body = o; return this; } };
}

async function seedAdmin(uid) {
  await __fakeDb.collection('admins').doc(uid).set({ uid, role: 'admin' });
}
async function seedPatient(uid) {
  await __fakeDb.collection('patients').doc(uid).set({ uid, firstName: 'Pat', role: 'patient' });
}
async function seedDoctorUser(uid) {
  await __fakeDb.collection('doctors').doc(uid).set({ uid, firstName: 'Doc', role: 'doctor', active: true });
}

async function resetAll() {
  resetDb();
  await seedAdmin('admin-1');
}

/* ── Create doctor profile ── */
await test('admin can create a new doctor profile', async () => {
  await resetAll();
  const res = makeRes();
  await createDoctorHandler(makeReq({
    uid: 'admin-1',
    body: {
      email: 'newdoc@example.com', password: 'secret123',
      firstName: 'Jane', lastName: 'Smith', specialty: 'Dermatology',
      location: 'Pune', experience: '8', fee: '700',
    },
  }), res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.ok(res.body.uid);

  const stored = __fakeDb.read('doctors', res.body.uid);
  assert.equal(stored.specialty, 'Dermatology');
  assert.equal(stored.active, true);
  assert.equal(stored.verified, true);
  assert.deepEqual(stored.availability, {});
  assert.deepEqual(stored.blockedDates, []);
  assert.equal(stored.slotDuration, 60);
});

await test('creating a doctor requires the core fields', async () => {
  await resetAll();
  const res = makeRes();
  await createDoctorHandler(makeReq({ uid: 'admin-1', body: { email: 'x@example.com' } }), res);
  assert.equal(res.statusCode, 400, JSON.stringify(res.body));
});

/* ── Manage doctor profile / set specialization ── */
await test('admin can edit a doctor profile and change specialization', async () => {
  await resetAll();
  await __fakeDb.collection('doctors').doc('doc-1').set({
    firstName: 'Old', lastName: 'Name', name: 'Old Name', specialty: 'General', active: true,
  });

  const res = makeRes();
  await updateDoctorHandler(makeReq({
    uid: 'admin-1',
    body: { doctorId: 'doc-1', updates: { specialty: 'Cardiology', fee: 900 } },
  }), res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));

  const stored = __fakeDb.read('doctors', 'doc-1');
  assert.equal(stored.specialty, 'Cardiology');
  assert.equal(stored.fee, 900);
  assert.ok(stored.searchKeywords.includes('cardiology'), 'searchKeywords should stay in sync with specialty');
});

/* ── Set working hours ── */
await test('admin can set a doctor\'s working hours (availability)', async () => {
  await resetAll();
  await __fakeDb.collection('doctors').doc('doc-1').set({ firstName: 'A', lastName: 'B', active: true });

  const res = makeRes();
  await updateDoctorHandler(makeReq({
    uid: 'admin-1',
    body: {
      doctorId: 'doc-1',
      updates: { availability: { Monday: ['9:00 AM', '10:00 AM'], Tuesday: ['2:00 PM'] } },
    },
  }), res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));

  const stored = __fakeDb.read('doctors', 'doc-1');
  assert.deepEqual(stored.availability.Monday, ['9:00 AM', '10:00 AM']);
  assert.deepEqual(stored.availability.Tuesday, ['2:00 PM']);
});

/* ── Set slot duration ── */
await test('admin can set a doctor\'s slot duration', async () => {
  await resetAll();
  await __fakeDb.collection('doctors').doc('doc-1').set({ firstName: 'A', lastName: 'B', active: true, slotDuration: 60 });

  const res = makeRes();
  await updateDoctorHandler(makeReq({ uid: 'admin-1', body: { doctorId: 'doc-1', updates: { slotDuration: 30 } } }), res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(__fakeDb.read('doctors', 'doc-1').slotDuration, 30);
});

/* ── Add/remove doctor leave days ── */
await test('admin can add and later remove a doctor\'s leave day', async () => {
  await resetAll();
  await __fakeDb.collection('doctors').doc('doc-1').set({ firstName: 'A', lastName: 'B', active: true, blockedDates: [] });

  const addRes = makeRes();
  await updateDoctorHandler(makeReq({
    uid: 'admin-1', body: { doctorId: 'doc-1', updates: { blockedDates: ['2027-01-15'] } },
  }), addRes);
  assert.equal(addRes.statusCode, 200, JSON.stringify(addRes.body));
  assert.deepEqual(__fakeDb.read('doctors', 'doc-1').blockedDates, ['2027-01-15']);

  const removeRes = makeRes();
  await updateDoctorHandler(makeReq({
    uid: 'admin-1', body: { doctorId: 'doc-1', updates: { blockedDates: [] } },
  }), removeRes);
  assert.equal(removeRes.statusCode, 200, JSON.stringify(removeRes.body));
  assert.deepEqual(__fakeDb.read('doctors', 'doc-1').blockedDates, []);
});

/* ── Activate/deactivate ── */
await test('admin can deactivate and reactivate a doctor', async () => {
  await resetAll();
  await __fakeDb.collection('doctors').doc('doc-1').set({ firstName: 'A', lastName: 'B', active: true });

  const deactivateRes = makeRes();
  await updateDoctorHandler(makeReq({ uid: 'admin-1', body: { doctorId: 'doc-1', updates: { active: false } } }), deactivateRes);
  assert.equal(deactivateRes.statusCode, 200);
  assert.equal(__fakeDb.read('doctors', 'doc-1').active, false);

  const reactivateRes = makeRes();
  await updateDoctorHandler(makeReq({ uid: 'admin-1', body: { doctorId: 'doc-1', updates: { active: true } } }), reactivateRes);
  assert.equal(reactivateRes.statusCode, 200);
  assert.equal(__fakeDb.read('doctors', 'doc-1').active, true);
});

/* ── Role-based access control ── */
await test('a patient cannot create a doctor (403)', async () => {
  await resetAll();
  await seedPatient('patient-1');
  const res = makeRes();
  await createDoctorHandler(makeReq({
    uid: 'patient-1',
    body: { email: 'x@example.com', password: 'secret123', firstName: 'A', lastName: 'B', specialty: 'General' },
  }), res);
  assert.equal(res.statusCode, 403, JSON.stringify(res.body));
});

await test('a patient cannot update a doctor (403)', async () => {
  await resetAll();
  await seedPatient('patient-1');
  await __fakeDb.collection('doctors').doc('doc-1').set({ firstName: 'A', lastName: 'B', active: true });
  const res = makeRes();
  await updateDoctorHandler(makeReq({ uid: 'patient-1', body: { doctorId: 'doc-1', updates: { active: false } } }), res);
  assert.equal(res.statusCode, 403, JSON.stringify(res.body));
  assert.equal(__fakeDb.read('doctors', 'doc-1').active, true, 'doctor must remain unaffected');
});

await test('a doctor (not admin) cannot update another doctor or themselves via the admin endpoint (403)', async () => {
  await resetAll();
  await seedDoctorUser('doc-2');
  await __fakeDb.collection('doctors').doc('doc-1').set({ firstName: 'A', lastName: 'B', active: true });
  const res = makeRes();
  await updateDoctorHandler(makeReq({ uid: 'doc-2', body: { doctorId: 'doc-1', updates: { active: false } } }), res);
  assert.equal(res.statusCode, 403, JSON.stringify(res.body));
});

await test('an unauthenticated request is rejected (401), not silently allowed', async () => {
  await resetAll();
  const res = makeRes();
  await updateDoctorHandler(makeReq({ uid: null, body: { doctorId: 'doc-1', updates: { active: false } } }), res);
  assert.equal(res.statusCode, 401, JSON.stringify(res.body));
});

await test('a non-existent/forged admin uid (no admins doc) is rejected (403)', async () => {
  await resetAll();
  const res = makeRes();
  await updateDoctorHandler(makeReq({ uid: 'not-actually-an-admin', body: { doctorId: 'doc-1', updates: { active: false } } }), res);
  assert.equal(res.statusCode, 403, JSON.stringify(res.body));
});

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
