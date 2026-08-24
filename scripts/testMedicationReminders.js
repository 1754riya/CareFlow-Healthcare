/**
 * Tests medication reminders end to end:
 *  - pure parsing/scheduling logic (src/utils/medicationReminders.js)
 *  - the REAL, unmodified api/create-medication-reminders.js and
 *    api/cron/send-medication-reminders.js handlers, against the same
 *    in-memory Firestore fake used by the other api test scripts.
 *
 * Run with:  node scripts/testMedicationReminders.js
 */
import { register } from 'node:module';
import assert from 'node:assert/strict';
import {
  parseFrequency, parseDurationDays, buildReminderSchedule,
  isReminderDueToday, isReminderExpired, buildReminderMessage,
} from '../src/utils/medicationReminders.js';
import { toDateKey } from '../src/utils/slotGeneration.js';

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

/* ── Pure logic: frequency parsing ── */
await test('parseFrequency recognizes the four common phrasings', () => {
  assert.equal(parseFrequency('Once a day'), 1);
  assert.equal(parseFrequency('Twice a day'), 2);
  assert.equal(parseFrequency('Three times a day'), 3);
  assert.equal(parseFrequency('Four times a day'), 4);
});
await test('parseFrequency handles a numeric "N times" fallback', () => {
  assert.equal(parseFrequency('3 times a day'), 3);
});
await test('parseFrequency returns null for missing/invalid input', () => {
  assert.equal(parseFrequency(''), null);
  assert.equal(parseFrequency(null), null);
  assert.equal(parseFrequency('As needed'), null);
  assert.equal(parseFrequency('Every other week'), null);
});

/* ── Pure logic: duration parsing ── */
await test('parseDurationDays parses days and weeks', () => {
  assert.equal(parseDurationDays('3 days'), 3);
  assert.equal(parseDurationDays('5 days'), 5);
  assert.equal(parseDurationDays('1 week'), 7);
  assert.equal(parseDurationDays('2 weeks'), 14);
});
await test('parseDurationDays returns null for missing/invalid input', () => {
  assert.equal(parseDurationDays(''), null);
  assert.equal(parseDurationDays(null), null);
  assert.equal(parseDurationDays('Until symptoms resolve'), null);
});

/* ── Pure logic: schedule building ── */
await test('buildReminderSchedule computes the correct inclusive end date', () => {
  const schedule = buildReminderSchedule({
    appointmentId: 'a1', patientId: 'p1', doctorId: 'd1',
    medicine: 'Paracetamol 500mg', dosage: '1 tablet', instructions: 'Take after meals',
    frequency: 'Twice a day', duration: '3 days', startDateKey: '2026-01-01',
  });
  assert.ok(schedule);
  assert.equal(schedule.timesPerDay, 2);
  assert.equal(schedule.durationDays, 3);
  assert.equal(schedule.startDate, '2026-01-01');
  assert.equal(schedule.endDate, '2026-01-03'); // day 1,2,3 — inclusive
  assert.equal(schedule.status, 'active');
  assert.equal(schedule.lastSentDate, null);
});
await test('buildReminderSchedule returns null when frequency is unparseable', () => {
  const schedule = buildReminderSchedule({
    medicine: 'Vitamin D', frequency: 'As needed', duration: '3 days', startDateKey: '2026-01-01',
  });
  assert.equal(schedule, null);
});
await test('buildReminderSchedule returns null when duration is unparseable', () => {
  const schedule = buildReminderSchedule({
    medicine: 'Vitamin D', frequency: 'Once a day', duration: 'Until better', startDateKey: '2026-01-01',
  });
  assert.equal(schedule, null);
});
await test('buildReminderSchedule returns null when the medicine name is blank', () => {
  const schedule = buildReminderSchedule({
    medicine: '  ', frequency: 'Once a day', duration: '3 days', startDateKey: '2026-01-01',
  });
  assert.equal(schedule, null);
});

/* ── Pure logic: due-today / expiry ── */
await test('isReminderDueToday / isReminderExpired respect the date window and lastSentDate', () => {
  const schedule = { status: 'active', startDate: '2026-01-01', endDate: '2026-01-03', lastSentDate: null };
  assert.equal(isReminderDueToday(schedule, '2026-01-01'), true);
  assert.equal(isReminderDueToday({ ...schedule, lastSentDate: '2026-01-01' }, '2026-01-01'), false); // already sent today
  assert.equal(isReminderDueToday(schedule, '2025-12-31'), false); // before start
  assert.equal(isReminderDueToday(schedule, '2026-01-04'), false); // after end
  assert.equal(isReminderExpired(schedule, '2026-01-03'), false); // last valid day
  assert.equal(isReminderExpired(schedule, '2026-01-04'), true); // duration elapsed
  assert.equal(isReminderDueToday({ ...schedule, status: 'completed' }, '2026-01-01'), false); // stopped schedules are never due
});
await test('buildReminderMessage reports the correct day count', () => {
  const schedule = { medicine: 'Cetirizine 10mg', dosage: '1 tablet', instructions: 'Take before sleeping', frequency: 'Once at night', durationDays: 5, startDate: '2026-01-01' };
  const msg = buildReminderMessage(schedule, '2026-01-03');
  assert.ok(msg.includes('Cetirizine 10mg'));
  assert.ok(msg.includes('Day 3 of 5'));
});

/* ── Endpoint tests, against the real handlers + fake Firestore ── */
register('./test-support/firebaseAdminLoader.mjs', import.meta.url);
const { __fakeDb, __reset } = await import('./test-support/fakeFirebaseAdmin.mjs');
const { default: createHandler } = await import('../api/create-medication-reminders.js');
// api/cron/send-medication-reminders.js was consolidated (Vercel Hobby
// plan's 12-function limit) into api/cron.js, routed via a ?job= query
// param that vercel.json's rewrites supply in production. This wrapper
// reproduces that dispatch for the real, unmodified consolidated handler.
const { default: cronDispatchHandler } = await import('../api/cron.js');
const cronHandler = (req, res) => cronDispatchHandler({ ...req, query: { job: 'send-medication-reminders' } }, res);

function makeToken(payload) { return Buffer.from(JSON.stringify(payload)).toString('base64'); }
function makeReq({ uid, body }) {
  return { method: 'POST', headers: { authorization: `Bearer ${makeToken({ uid })}` }, body };
}
function makeRes() {
  return { statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(o) { this.body = o; return this; } };
}
async function seedAppointment(id, data) {
  await __fakeDb.collection('appointments').doc(id).set({
    doctorId: 'doc-1', patientId: 'patient-1', doctorName: 'Test Doctor', patientName: 'Test Patient',
    date: new Date(), timeSlot: '9:00 AM', status: 'completed',
    prescription: [
      { medicine: 'Paracetamol 500mg', dosage: '1 tablet', frequency: 'Twice a day', duration: '3 days', instructions: 'Take after meals' },
      { medicine: 'Cetirizine 10mg', dosage: '1 tablet', frequency: 'Once at night', duration: '5 days', instructions: 'Take before sleeping' },
    ],
    ...data,
  });
}
function activeRemindersFor(appointmentId) {
  return __fakeDb.query('medicationReminders', [{ field: 'appointmentId', op: '==', value: appointmentId }]);
}

await test('create-medication-reminders: creates one reminder per parseable medicine', async () => {
  __reset();
  await seedAppointment('appt-1');
  const res = makeRes();
  await createHandler(makeReq({ uid: 'doc-1', body: { appointmentId: 'appt-1' } }), res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.remindersCreated, 2);
  assert.deepEqual(res.body.skipped, []);

  const reminders = activeRemindersFor('appt-1').map(r => r.data);
  assert.equal(reminders.length, 2);
  const paracetamol = reminders.find(r => r.medicine === 'Paracetamol 500mg');
  assert.equal(paracetamol.timesPerDay, 2);
  assert.equal(paracetamol.durationDays, 3);
  assert.equal(paracetamol.status, 'active');
  assert.equal(paracetamol.patientId, 'patient-1');
});

await test('create-medication-reminders: is idempotent (no duplicates on a second call)', async () => {
  __reset();
  await seedAppointment('appt-2');
  await createHandler(makeReq({ uid: 'doc-1', body: { appointmentId: 'appt-2' } }), makeRes());
  const res2 = makeRes();
  await createHandler(makeReq({ uid: 'doc-1', body: { appointmentId: 'appt-2' } }), res2);
  assert.equal(res2.body.remindersCreated, 0);
  assert.equal(res2.body.alreadyExists, true);
  assert.equal(activeRemindersFor('appt-2').length, 2);
});

await test('create-medication-reminders: gracefully skips a medicine with an invalid frequency/duration', async () => {
  __reset();
  await seedAppointment('appt-3', {
    prescription: [
      { medicine: 'Paracetamol 500mg', dosage: '1 tablet', frequency: 'Twice a day', duration: '3 days', instructions: '' },
      { medicine: 'Vitamin D', dosage: '1 capsule', frequency: 'As needed', duration: 'Until better', instructions: '' },
    ],
  });
  const res = makeRes();
  await createHandler(makeReq({ uid: 'doc-1', body: { appointmentId: 'appt-3' } }), res);
  assert.equal(res.body.remindersCreated, 1);
  assert.deepEqual(res.body.skipped, ['Vitamin D']);
});

await test('create-medication-reminders: refuses a non-completed (e.g. cancelled) appointment', async () => {
  __reset();
  await seedAppointment('appt-4', { status: 'cancelled' });
  const res = makeRes();
  await createHandler(makeReq({ uid: 'doc-1', body: { appointmentId: 'appt-4' } }), res);
  assert.equal(res.statusCode, 400, JSON.stringify(res.body));
  assert.equal(activeRemindersFor('appt-4').length, 0);
});

await test('create-medication-reminders: only the treating doctor can create reminders', async () => {
  __reset();
  await seedAppointment('appt-5');
  const res = makeRes();
  await createHandler(makeReq({ uid: 'patient-1', body: { appointmentId: 'appt-5' } }), res);
  assert.equal(res.statusCode, 403, JSON.stringify(res.body));
});

await test('cron: sends a due reminder today and records lastSentDate, without duplicating on a same-day re-run', async () => {
  __reset();
  const today = toDateKey(new Date());
  await __fakeDb.collection('medicationReminders').doc('rem-due').set({
    appointmentId: 'appt-x', patientId: 'patient-1', doctorId: 'doc-1',
    medicine: 'Paracetamol 500mg', dosage: '1 tablet', instructions: 'Take after meals',
    frequency: 'Twice a day', timesPerDay: 2, duration: '3 days', durationDays: 3,
    startDate: today, endDate: today, status: 'active', lastSentDate: null,
  });

  const res1 = makeRes();
  await cronHandler({ headers: {} }, res1);
  assert.equal(res1.body.sent, 1);
  assert.equal(res1.body.stopped, 0);

  const notifs = __fakeDb.query('notifications', [{ field: 'userId', op: '==', value: 'patient-1' }]);
  assert.equal(notifs.length, 1);
  assert.equal(notifs[0].data.type, 'medication_reminder');
  assert.ok(notifs[0].data.message.includes('Paracetamol 500mg'));

  const reminder = __fakeDb.read('medicationReminders', 'rem-due');
  assert.equal(reminder.lastSentDate, today);
  assert.equal(reminder.status, 'active');

  // Re-run the same day: must not send a second notification.
  const res2 = makeRes();
  await cronHandler({ headers: {} }, res2);
  assert.equal(res2.body.sent, 0);
  const notifsAfter = __fakeDb.query('notifications', [{ field: 'userId', op: '==', value: 'patient-1' }]);
  assert.equal(notifsAfter.length, 1);
});

await test('cron: stops a reminder whose duration has elapsed, sending no notification', async () => {
  __reset();
  const today = toDateKey(new Date());
  const past = '2020-01-01'; // well before today, in the past
  await __fakeDb.collection('medicationReminders').doc('rem-expired').set({
    appointmentId: 'appt-y', patientId: 'patient-1', doctorId: 'doc-1',
    medicine: 'Cetirizine 10mg', dosage: '1 tablet', instructions: '',
    frequency: 'Once at night', timesPerDay: 1, duration: '5 days', durationDays: 5,
    startDate: past, endDate: past, status: 'active', lastSentDate: null,
  });

  const res = makeRes();
  await cronHandler({ headers: {} }, res);
  assert.equal(res.body.sent, 0);
  assert.equal(res.body.stopped, 1);

  const reminder = __fakeDb.read('medicationReminders', 'rem-expired');
  assert.equal(reminder.status, 'completed');

  const notifs = __fakeDb.query('notifications', [{ field: 'userId', op: '==', value: 'patient-1' }]);
  assert.equal(notifs.length, 0);
  void today;
});

await test('cron: does not send a reminder that has not started yet', async () => {
  __reset();
  const future = '2099-01-01';
  await __fakeDb.collection('medicationReminders').doc('rem-future').set({
    appointmentId: 'appt-z', patientId: 'patient-1', doctorId: 'doc-1',
    medicine: 'Ibuprofen 200mg', dosage: '1 tablet', instructions: '',
    frequency: 'Once a day', timesPerDay: 1, duration: '3 days', durationDays: 3,
    startDate: future, endDate: future, status: 'active', lastSentDate: null,
  });
  const res = makeRes();
  await cronHandler({ headers: {} }, res);
  assert.equal(res.body.sent, 0);
  assert.equal(res.body.stopped, 0);
  const reminder = __fakeDb.read('medicationReminders', 'rem-future');
  assert.equal(reminder.status, 'active');
});

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
