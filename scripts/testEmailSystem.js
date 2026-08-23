/**
 * Exercises the REAL, unmodified email-related handlers —
 * api/send-cancellation-email.js, api/cron/send-appointment-reminders.js,
 * api/cron/retry-failed-emails.js, and api/lib/emailQueue.js — against the
 * in-memory Firestore fake and an in-memory mailer fake (see
 * scripts/test-support/), so none of this ever touches a live Firebase
 * project or a real SMTP server. api/send-appointment-confirmation.js
 * (the existing booking confirmation email) is intentionally NOT touched
 * or tested here — it was not modified.
 *
 * Run with:  node scripts/testEmailSystem.js
 */
import { register } from 'node:module';
import assert from 'node:assert/strict';
import { toDateKey } from '../src/utils/slotGeneration.js';

register('./test-support/firebaseAdminLoader.mjs', import.meta.url);

const { __fakeDb, __reset: resetDb } = await import('./test-support/fakeFirebaseAdmin.mjs');
const mailer = await import('./test-support/fakeMailer.mjs');
const { default: bookHandler } = await import('../api/book-appointment.js');
const { default: cancelEmailHandler } = await import('../api/send-cancellation-email.js');
const { default: reminderCronHandler } = await import('../api/cron/send-appointment-reminders.js');
const { default: retryCronHandler } = await import('../api/cron/retry-failed-emails.js');

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

async function seedDoctor(id, data) {
  await __fakeDb.collection('doctors').doc(id).set({
    firstName: 'Test', lastName: 'Doctor', name: 'Dr. Test Doctor',
    specialty: 'Cardiology', active: true, slotDuration: 60,
    availability: ALL_DAYS_AVAILABILITY, blockedDates: [],
    email: 'doctor@example.com',
    ...data,
  });
}
async function seedPatient(uid, data) {
  await __fakeDb.collection('patients').doc(uid).set({
    firstName: 'Alice', lastName: 'Patient', email: 'patient@example.com', ...data,
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
  mailer.__reset();
}

async function bookAppointment({ doctorId = 'doc-1', patientUid = 'patient-1', daysAhead = 10, slot = '9:00 AM' } = {}) {
  await seedDoctor(doctorId, {});
  await seedPatient(patientUid, {});
  const date = futureDate(daysAhead);
  const dateKey = toDateKey(date);
  const res = makeRes();
  await bookHandler(makeReq({ uid: patientUid, body: { doctorId, dateKey, timeSlot: slot } }), res);
  assert.equal(res.statusCode, 200, `booking failed: ${JSON.stringify(res.body)}`);
  return { appointmentId: res.body.id, doctorId, patientUid, dateKey, slot };
}

/* ── 1. Reminder email → patient + doctor ── */
await test('reminder cron sends a reminder email to both patient and doctor for an appointment tomorrow', async () => {
  await resetAll();
  const { appointmentId } = await bookAppointment({ daysAhead: 1 }); // tomorrow

  const res = makeRes();
  await reminderCronHandler({ headers: {} }, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.reminded, 1);

  const sent = mailer.__getSentEmails();
  assert.equal(sent.length, 2);
  assert.ok(sent.some(e => e.to === 'patient@example.com' && e.subject.includes('Reminder')));
  assert.ok(sent.some(e => e.to === 'doctor@example.com' && e.subject.includes('Reminder')));

  const stored = __fakeDb.read('appointments', appointmentId);
  assert.equal(stored.reminderSent, true);
});

await test('reminder cron does not remind an appointment that is not tomorrow', async () => {
  await resetAll();
  await bookAppointment({ daysAhead: 5 }); // not tomorrow

  const res = makeRes();
  await reminderCronHandler({ headers: {} }, res);
  assert.equal(res.body.reminded, 0);
  assert.equal(mailer.__getSentEmails().length, 0);
});

await test('reminder cron does not double-send if it somehow runs twice', async () => {
  await resetAll();
  await bookAppointment({ daysAhead: 1 });

  await reminderCronHandler({ headers: {} }, makeRes());
  await reminderCronHandler({ headers: {} }, makeRes());

  assert.equal(mailer.__getSentEmails().length, 2, 'expected still exactly 2 emails, not 4');
});

await test('reminder cron skips a cancelled appointment', async () => {
  await resetAll();
  const { appointmentId } = await bookAppointment({ daysAhead: 1 });
  await __fakeDb.collection('appointments').doc(appointmentId).set({ status: 'cancelled' }, { merge: true });

  const res = makeRes();
  await reminderCronHandler({ headers: {} }, res);
  assert.equal(res.body.reminded, 0);
  assert.equal(mailer.__getSentEmails().length, 0);
});

/* ── 2. Cancellation email → patient + doctor ── */
await test('cancellation email is sent to both patient and doctor', async () => {
  await resetAll();
  const { appointmentId } = await bookAppointment();
  await __fakeDb.collection('appointments').doc(appointmentId).set({ status: 'cancelled' }, { merge: true });

  const res = makeRes();
  await cancelEmailHandler(makeReq({ uid: 'patient-1', body: { appointmentId } }), res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));

  const sent = mailer.__getSentEmails();
  assert.equal(sent.length, 2);
  assert.ok(sent.some(e => e.to === 'patient@example.com' && e.subject.includes('Cancelled')));
  assert.ok(sent.some(e => e.to === 'doctor@example.com' && e.subject.includes('Cancelled')));
});

await test('cancellation email endpoint refuses a caller who is neither patient nor doctor on the appointment', async () => {
  await resetAll();
  const { appointmentId } = await bookAppointment();
  const res = makeRes();
  await cancelEmailHandler(makeReq({ uid: 'someone-else', body: { appointmentId } }), res);
  assert.equal(res.statusCode, 403, JSON.stringify(res.body));
});

/* ── 3. Failed emails are stored/tracked and retried by the background job ── */
await test('a failed cancellation email is queued, and a later retry sweep delivers it', async () => {
  await resetAll();
  const { appointmentId } = await bookAppointment();
  await __fakeDb.collection('appointments').doc(appointmentId).set({ status: 'cancelled' }, { merge: true });

  mailer.__setShouldFail(true, 'Simulated SMTP outage');
  const cancelRes = makeRes();
  await cancelEmailHandler(makeReq({ uid: 'patient-1', body: { appointmentId } }), cancelRes);
  // The endpoint itself still reports success — an email problem must never
  // surface as a failure of the (already-completed) cancellation action.
  assert.equal(cancelRes.statusCode, 200, JSON.stringify(cancelRes.body));
  assert.equal(mailer.__getSentEmails().length, 0, 'nothing should have actually sent while SMTP is down');

  const queued = __fakeDb.query('emailQueue', [{ field: 'appointmentId', op: '==', value: appointmentId }]);
  assert.equal(queued.length, 2, 'both the patient and doctor emails should be queued');
  assert.ok(queued.every(q => q.data.status === 'pending'));
  assert.ok(queued.every(q => q.data.lastError === 'Simulated SMTP outage'));

  // SMTP recovers; the retry cron picks the queued jobs up.
  mailer.__setShouldFail(false);
  const retryRes = makeRes();
  await retryCronHandler({ headers: {} }, retryRes);
  assert.equal(retryRes.body.sent, 2);

  assert.equal(mailer.__getSentEmails().length, 2, 'both queued emails should now have actually been sent');
  const queuedAfter = __fakeDb.query('emailQueue', [{ field: 'appointmentId', op: '==', value: appointmentId }]);
  assert.ok(queuedAfter.every(q => q.data.status === 'sent'));
});

await test('a retry sweep that still fails increments attempts and stays pending, without giving up early', async () => {
  await resetAll();
  const { appointmentId } = await bookAppointment();
  await __fakeDb.collection('appointments').doc(appointmentId).set({ status: 'cancelled' }, { merge: true });

  mailer.__setShouldFail(true, 'Still down');
  await cancelEmailHandler(makeReq({ uid: 'patient-1', body: { appointmentId } }), makeRes());

  // SMTP is still down on the first retry sweep.
  const retryRes = makeRes();
  await retryCronHandler({ headers: {} }, retryRes);
  assert.equal(retryRes.body.stillPending, 2);
  assert.equal(retryRes.body.gaveUp, 0);

  const queued = __fakeDb.query('emailQueue', [{ field: 'appointmentId', op: '==', value: appointmentId }]);
  assert.ok(queued.every(q => q.data.status === 'pending'));
  assert.ok(queued.every(q => q.data.attempts === 2));
});

await test('after exhausting MAX_EMAIL_ATTEMPTS a job is marked failed and stops being retried', async () => {
  await resetAll();
  const { appointmentId } = await bookAppointment();
  await __fakeDb.collection('appointments').doc(appointmentId).set({ status: 'cancelled' }, { merge: true });

  mailer.__setShouldFail(true, 'Permanently broken address');
  await cancelEmailHandler(makeReq({ uid: 'patient-1', body: { appointmentId } }), makeRes());

  // Run the retry sweep repeatedly until every job has given up.
  let lastRes;
  for (let i = 0; i < 6; i++) {
    lastRes = makeRes();
    await retryCronHandler({ headers: {} }, lastRes);
  }

  const queued = __fakeDb.query('emailQueue', [{ field: 'appointmentId', op: '==', value: appointmentId }]);
  assert.ok(queued.every(q => q.data.status === 'failed'), `expected all jobs failed: ${JSON.stringify(queued.map(q => q.data.status))}`);

  // One more sweep should find nothing left to retry.
  const finalRes = makeRes();
  await retryCronHandler({ headers: {} }, finalRes);
  assert.equal(finalRes.body.sent, 0);
  assert.equal(finalRes.body.stillPending, 0);
  assert.equal(finalRes.body.gaveUp, 0);
  void lastRes;
});

/* ── 4. Email failure must never affect the appointment itself ── */
await test('an SMTP outage during cancellation leaves the appointment cancelled regardless', async () => {
  await resetAll();
  const { appointmentId } = await bookAppointment();
  await __fakeDb.collection('appointments').doc(appointmentId).set({ status: 'cancelled' }, { merge: true });

  mailer.__setShouldFail(true);
  await cancelEmailHandler(makeReq({ uid: 'patient-1', body: { appointmentId } }), makeRes());

  const stored = __fakeDb.read('appointments', appointmentId);
  assert.equal(stored.status, 'cancelled');
});

await test('an SMTP outage during the reminder sweep does not stop reminderSent from being set, and never touches booking data', async () => {
  await resetAll();
  const { appointmentId } = await bookAppointment({ daysAhead: 1 });

  mailer.__setShouldFail(true);
  const res = makeRes();
  await reminderCronHandler({ headers: {} }, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));

  const stored = __fakeDb.read('appointments', appointmentId);
  assert.equal(stored.status, 'confirmed');
  assert.equal(stored.reminderSent, true, 'the sweep should still mark it reminded even though delivery failed (queued for retry)');

  const queued = __fakeDb.query('emailQueue', [{ field: 'appointmentId', op: '==', value: appointmentId }]);
  assert.equal(queued.length, 2);
});

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
