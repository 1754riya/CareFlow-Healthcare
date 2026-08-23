/**
 * Exercises the REAL, unmodified api/admin/update-doctor.js (extended this
 * task) and api/book-appointment.js against the in-memory Firestore,
 * mailer, and Google Calendar fakes (see scripts/test-support/), so none of
 * this ever touches a live Firebase project, SMTP server, or the Google
 * Calendar API.
 *
 * Run with:  node scripts/testDoctorLeave.js
 */
import { register } from 'node:module';
import assert from 'node:assert/strict';
import { toDateKey } from '../src/utils/slotGeneration.js';

register('./test-support/firebaseAdminLoader.mjs', import.meta.url);

const { __fakeDb, __reset: resetDb } = await import('./test-support/fakeFirebaseAdmin.mjs');
const mailer = await import('./test-support/fakeMailer.mjs');
const gcal = await import('./test-support/fakeGoogleCalendar.mjs');
const { default: bookHandler } = await import('../api/book-appointment.js');
const { default: updateDoctorHandler } = await import('../api/admin/update-doctor.js');
const { default: createEventsHandler } = await import('../api/create-calendar-events.js');

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
async function seedPatient(uid, data = {}) {
  await __fakeDb.collection('patients').doc(uid).set({
    firstName: 'Alice', lastName: 'Patient', email: `${uid}@example.com`, ...data,
  });
}
async function seedAdmin(uid) {
  await __fakeDb.collection('admins').doc(uid).set({ uid, role: 'admin' });
}

function futureDate(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function resetAll() {
  resetDb();
  mailer.__reset();
  gcal.__reset();
  await seedAdmin('admin-1');
}

async function bookAppointment({ doctorId = 'doc-1', patientUid, daysAhead, slot = '9:00 AM' }) {
  await seedPatient(patientUid);
  const dateKey = toDateKey(futureDate(daysAhead));
  const res = makeRes();
  await bookHandler(makeReq({ uid: patientUid, body: { doctorId, dateKey, timeSlot: slot } }), res);
  assert.equal(res.statusCode, 200, `booking failed: ${JSON.stringify(res.body)}`);
  return { appointmentId: res.body.id, dateKey };
}

async function addLeaveDate(doctorId, dateKey, existingBlocked = []) {
  const res = makeRes();
  await updateDoctorHandler(makeReq({
    uid: 'admin-1',
    body: { doctorId, updates: { blockedDates: [...existingBlocked, dateKey] } },
  }), res);
  return res;
}

/* ── 1. Leave date with existing bookings ── */
await test('adding a leave date cancels affected confirmed appointments, notifies patients, and removes calendar events', async () => {
  await resetAll();
  await seedDoctor('doc-1');
  gcal.__connectUser('doc-1');
  gcal.__connectUser('patient-1');
  gcal.__connectUser('patient-2');

  const a1 = await bookAppointment({ patientUid: 'patient-1', daysAhead: 10, slot: '9:00 AM' });
  const a2 = await bookAppointment({ patientUid: 'patient-2', daysAhead: 10, slot: '10:00 AM' });
  assert.equal(a1.dateKey, a2.dateKey);

  // Give both appointments Calendar events first, same as the real flow would.
  await createEventsHandler(makeReq({ uid: 'patient-1', body: { appointmentId: a1.appointmentId } }), makeRes());
  await createEventsHandler(makeReq({ uid: 'patient-2', body: { appointmentId: a2.appointmentId } }), makeRes());
  assert.equal(gcal.__eventCount(), 4);

  const res = await addLeaveDate('doc-1', a1.dateKey);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.leaveCancellations[a1.dateKey], 2);

  const stored1 = __fakeDb.read('appointments', a1.appointmentId);
  const stored2 = __fakeDb.read('appointments', a2.appointmentId);
  assert.equal(stored1.status, 'cancelled');
  assert.equal(stored1.cancelledReason, 'doctor_leave');
  assert.equal(stored2.status, 'cancelled');
  assert.deepEqual(stored1.calendarEventIds, {});
  assert.deepEqual(stored2.calendarEventIds, {});

  // Calendar events actually removed, not just the reference cleared.
  assert.equal(gcal.__eventCount(), 0);

  // Each patient got a cancellation email.
  const sent = mailer.__getSentEmails();
  assert.ok(sent.some(e => e.to === 'patient-1@example.com' && e.subject.includes('Cancelled')));
  assert.ok(sent.some(e => e.to === 'patient-2@example.com' && e.subject.includes('Cancelled')));

  // Each patient got an in-app notification too.
  const notifs1 = __fakeDb.query('notifications', [{ field: 'userId', op: '==', value: 'patient-1' }]);
  const notifs2 = __fakeDb.query('notifications', [{ field: 'userId', op: '==', value: 'patient-2' }]);
  assert.equal(notifs1.length, 1);
  assert.equal(notifs2.length, 1);
  assert.equal(notifs1[0].data.type, 'appointment_cancelled');
});

/* ── 2. Leave date with no bookings ── */
await test('adding a leave date with no existing bookings is a clean no-op', async () => {
  await resetAll();
  await seedDoctor('doc-2');
  const dateKey = toDateKey(futureDate(15));

  const res = await addLeaveDate('doc-2', dateKey);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.leaveCancellations[dateKey], 0);
  assert.equal(mailer.__getSentEmails().length, 0);
});

/* ── 3. Leave date repeated → no duplicates ── */
await test('repeating the same leave date does not re-cancel, re-email, or re-notify', async () => {
  await resetAll();
  await seedDoctor('doc-3');
  const { appointmentId, dateKey } = await bookAppointment({ doctorId: 'doc-3', patientUid: 'patient-1', daysAhead: 10 });

  const res1 = await addLeaveDate('doc-3', dateKey);
  assert.equal(res1.body.leaveCancellations[dateKey], 1);
  assert.equal(mailer.__getSentEmails().length, 1);

  // Admin saves the schedule again with the SAME blockedDates array already containing this date.
  const doctorSnap = __fakeDb.read('doctors', 'doc-3');
  const res2 = makeRes();
  await updateDoctorHandler(makeReq({
    uid: 'admin-1',
    body: { doctorId: 'doc-3', updates: { blockedDates: doctorSnap.blockedDates } },
  }), res2);
  assert.equal(res2.statusCode, 200, JSON.stringify(res2.body));
  assert.equal(res2.body.leaveCancellations, undefined, 'no newly-added dates, so no leave processing should run at all');

  assert.equal(mailer.__getSentEmails().length, 1, 'still exactly 1 email — no duplicate');
  const notifs = __fakeDb.query('notifications', [{ field: 'userId', op: '==', value: 'patient-1' }]);
  assert.equal(notifs.length, 1, 'still exactly 1 notification — no duplicate');

  const stored = __fakeDb.read('appointments', appointmentId);
  assert.equal(stored.status, 'cancelled');
});

await test('retrying the exact same add-leave-date request twice does not double-cancel (status-guarded, not just date-diff-guarded)', async () => {
  await resetAll();
  await seedDoctor('doc-3b');
  const { appointmentId, dateKey } = await bookAppointment({ doctorId: 'doc-3b', patientUid: 'patient-1', daysAhead: 10 });

  // Two concurrent/retried requests, both computing the diff against the same starting state.
  const [res1, res2] = await Promise.all([
    addLeaveDate('doc-3b', dateKey),
    addLeaveDate('doc-3b', dateKey),
  ]);
  assert.equal(res1.statusCode, 200);
  assert.equal(res2.statusCode, 200);

  const stored = __fakeDb.read('appointments', appointmentId);
  assert.equal(stored.status, 'cancelled');
  assert.equal(mailer.__getSentEmails().length, 1, 'exactly 1 email even though the request was effectively duplicated');
});

/* ── 4. Other dates unaffected ── */
await test('appointments on other dates are never touched by a leave date', async () => {
  await resetAll();
  await seedDoctor('doc-4');
  const leaveDay = await bookAppointment({ doctorId: 'doc-4', patientUid: 'patient-1', daysAhead: 10 });
  const otherDay = await bookAppointment({ doctorId: 'doc-4', patientUid: 'patient-2', daysAhead: 20 });
  assert.notEqual(leaveDay.dateKey, otherDay.dateKey);

  await addLeaveDate('doc-4', leaveDay.dateKey);

  const storedLeaveDay = __fakeDb.read('appointments', leaveDay.appointmentId);
  const storedOtherDay = __fakeDb.read('appointments', otherDay.appointmentId);
  assert.equal(storedLeaveDay.status, 'cancelled');
  assert.equal(storedOtherDay.status, 'confirmed', 'the other date\'s appointment must be untouched');

  const sent = mailer.__getSentEmails();
  assert.equal(sent.length, 1, 'only the affected patient should have been emailed');
  assert.ok(!sent.some(e => e.to === 'patient-2@example.com'));
});

/* ── 5. New booking on leave date is prevented ── */
await test('a new booking attempt on the leave date is rejected (existing slot-generation system, unmodified)', async () => {
  await resetAll();
  await seedDoctor('doc-5');
  await seedPatient('patient-3');
  const dateKey = toDateKey(futureDate(10));

  await addLeaveDate('doc-5', dateKey);

  const res = makeRes();
  await bookHandler(makeReq({ uid: 'patient-3', body: { doctorId: 'doc-5', dateKey, timeSlot: '9:00 AM' } }), res);
  assert.equal(res.statusCode, 409, JSON.stringify(res.body));
});

await test('a new booking on a different (non-leave) date for the same doctor still succeeds', async () => {
  await resetAll();
  await seedDoctor('doc-6');
  await seedPatient('patient-4');
  const leaveDateKey = toDateKey(futureDate(10));
  await addLeaveDate('doc-6', leaveDateKey);

  const okDateKey = toDateKey(futureDate(11));
  const res = makeRes();
  await bookHandler(makeReq({ uid: 'patient-4', body: { doctorId: 'doc-6', dateKey: okDateKey, timeSlot: '9:00 AM' } }), res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
});

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
