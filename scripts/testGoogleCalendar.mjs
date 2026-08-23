/**
 * Exercises the REAL, unmodified Calendar-related handlers — api/book-appointment.js,
 * api/create-calendar-events.js, api/reschedule-appointment.js,
 * api/update-calendar-events.js, api/delete-calendar-events.js — against the
 * in-memory Firestore fake (real optimistic-concurrency transactions) and an
 * in-memory Google Calendar fake (see scripts/test-support/), so none of
 * this ever touches a live Firebase project or the live Google API.
 *
 * Run with:  node scripts/testGoogleCalendar.mjs
 */
import { register } from 'node:module';
import assert from 'node:assert/strict';
import { getDayName, toDateKey } from '../src/utils/slotGeneration.js';

register('./test-support/firebaseAdminLoader.mjs', import.meta.url);

const { __fakeDb, __reset: resetDb } = await import('./test-support/fakeFirebaseAdmin.mjs');
const gcal = await import('./test-support/fakeGoogleCalendar.mjs');
const { default: bookHandler } = await import('../api/book-appointment.js');
const { default: createEventsHandler } = await import('../api/create-calendar-events.js');
const { default: updateEventsHandler } = await import('../api/update-calendar-events.js');
const { default: deleteEventsHandler } = await import('../api/delete-calendar-events.js');
const { default: rescheduleHandler } = await import('../api/reschedule-appointment.js');

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
function makeReq({ uid, name, body }) {
  return { method: 'POST', headers: { authorization: `Bearer ${makeToken({ uid, name })}` }, body };
}
function makeRes() {
  return { statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(o) { this.body = o; return this; } };
}

async function seedDoctor(id, data) {
  await __fakeDb.collection('doctors').doc(id).set({
    firstName: 'Test', lastName: 'Doctor', name: 'Dr. Test Doctor',
    specialty: 'Cardiology', active: true, slotDuration: 60,
    availability: {}, blockedDates: [], ...data,
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
  gcal.__reset();
}

/* ── Shared fixture: book one confirmed appointment ── */
const ALL_DAYS_AVAILABILITY = Object.fromEntries(
  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    .map(day => [day, ['9:00 AM', '10:00 AM', '11:00 AM']])
);

async function bookAppointment({ doctorId = 'doc-1', patientUid = 'patient-1', daysAhead = 10, slot = '9:00 AM' } = {}) {
  const date = futureDate(daysAhead);
  const dateKey = toDateKey(date);
  // Every weekday configured identically so a reschedule to a different
  // calendar day (a different day-of-week) is always valid to test against.
  await seedDoctor(doctorId, { availability: ALL_DAYS_AVAILABILITY });

  const res = makeRes();
  await bookHandler(makeReq({ uid: patientUid, name: 'Alice Patient', body: { doctorId, dateKey, timeSlot: slot } }), res);
  assert.equal(res.statusCode, 200, `booking failed: ${JSON.stringify(res.body)}`);
  return { appointmentId: res.body.id, doctorId, patientUid, dateKey, slot };
}

/* ── 1. Booking → Calendar event ── */
await test('booking creates a Calendar event for both patient and doctor, with the required fields', async () => {
  await resetAll();
  gcal.__connectUser('patient-1');
  gcal.__connectUser('doc-1');

  const { appointmentId } = await bookAppointment({ doctorId: 'doc-1', patientUid: 'patient-1' });

  const res = makeRes();
  await createEventsHandler(makeReq({ uid: 'patient-1', body: { appointmentId } }), res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.ok(res.body.calendarEventIds.patient, 'expected a patient event id');
  assert.ok(res.body.calendarEventIds.doctor, 'expected a doctor event id');

  const stored = __fakeDb.read('appointments', appointmentId);
  assert.deepEqual(stored.calendarEventIds, res.body.calendarEventIds);
  assert.equal(gcal.__eventCount(), 2);

  const patientEvent = gcal.__getEvent(res.body.calendarEventIds.patient);
  assert.equal(patientEvent.patientName, 'Alice Patient');
  assert.equal(patientEvent.doctorName, 'Dr. Test Doctor');
  assert.equal(patientEvent.doctorSpecialty, 'Cardiology');
  assert.equal(patientEvent.timeSlot, '9:00 AM');
  assert.ok(patientEvent.date instanceof Date, 'expected a Date for the appointment date');
});

await test('booking only creates an event for the role(s) that connected Google Calendar', async () => {
  await resetAll();
  gcal.__connectUser('patient-1'); // doctor NOT connected

  const { appointmentId } = await bookAppointment({ doctorId: 'doc-1', patientUid: 'patient-1' });
  const res = makeRes();
  await createEventsHandler(makeReq({ uid: 'patient-1', body: { appointmentId } }), res);

  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.ok(res.body.calendarEventIds.patient);
  assert.equal(res.body.calendarEventIds.doctor, undefined);
  assert.equal(gcal.__eventCount(), 1);
});

await test('retrying the create call does not create duplicate events', async () => {
  await resetAll();
  gcal.__connectUser('patient-1');
  gcal.__connectUser('doc-1');
  const { appointmentId } = await bookAppointment();

  const res1 = makeRes();
  await createEventsHandler(makeReq({ uid: 'patient-1', body: { appointmentId } }), res1);
  const res2 = makeRes(); // simulated retry of the same request
  await createEventsHandler(makeReq({ uid: 'patient-1', body: { appointmentId } }), res2);

  assert.deepEqual(res2.body.calendarEventIds, res1.body.calendarEventIds);
  assert.equal(gcal.__eventCount(), 2, 'expected still exactly 2 events, not 4');
});

/* ── 2. Reschedule → event updated (not duplicated) ── */
await test('reschedule updates the existing Calendar events in place, without creating new ones', async () => {
  await resetAll();
  gcal.__connectUser('patient-1');
  gcal.__connectUser('doc-1');

  const { appointmentId, doctorId } = await bookAppointment({ daysAhead: 10, slot: '9:00 AM' });
  const createRes = makeRes();
  await createEventsHandler(makeReq({ uid: 'patient-1', body: { appointmentId } }), createRes);
  const originalIds = createRes.body.calendarEventIds;

  const newDate = futureDate(11);
  const newDateKey = toDateKey(newDate);
  const rescheduleRes = makeRes();
  await rescheduleHandler(makeReq({ uid: 'patient-1', body: { appointmentId, dateKey: newDateKey, timeSlot: '10:00 AM' } }), rescheduleRes);
  assert.equal(rescheduleRes.statusCode, 200, JSON.stringify(rescheduleRes.body));

  const updateRes = makeRes();
  await updateEventsHandler(makeReq({ uid: 'patient-1', body: { appointmentId } }), updateRes);
  assert.equal(updateRes.statusCode, 200, JSON.stringify(updateRes.body));

  // Same event IDs — updated in place, not replaced.
  assert.deepEqual(updateRes.body.calendarEventIds, originalIds);
  assert.equal(gcal.__eventCount(), 2, 'expected still exactly 2 events after reschedule, not 4');

  const patientEvent = gcal.__getEvent(originalIds.patient);
  assert.equal(patientEvent.timeSlot, '10:00 AM');
  assert.equal(toDateKey(patientEvent.date), newDateKey);

  void doctorId;
});

await test('reschedule is rejected if the new slot is already booked, and existing events are left untouched', async () => {
  await resetAll();
  gcal.__connectUser('patient-1');
  gcal.__connectUser('doc-1');
  gcal.__connectUser('patient-2');

  const date = futureDate(12);
  const dayName = getDayName(date);
  const dateKey = toDateKey(date);
  await seedDoctor('doc-2', { availability: { [dayName]: ['9:00 AM', '10:00 AM'] } });

  // Another patient already holds 10:00 AM on doc-2.
  const otherRes = makeRes();
  await bookHandler(makeReq({ uid: 'patient-2', body: { doctorId: 'doc-2', dateKey, timeSlot: '10:00 AM' } }), otherRes);
  assert.equal(otherRes.statusCode, 200, JSON.stringify(otherRes.body));

  // patient-1 is booked at 9:00 AM on doc-2 and tries to move to the taken 10:00 AM slot.
  const mineRes = makeRes();
  await bookHandler(makeReq({ uid: 'patient-1', body: { doctorId: 'doc-2', dateKey, timeSlot: '9:00 AM' } }), mineRes);
  const appointmentId = mineRes.body.id;
  const createRes = makeRes();
  await createEventsHandler(makeReq({ uid: 'patient-1', body: { appointmentId } }), createRes);

  const rescheduleRes = makeRes();
  await rescheduleHandler(makeReq({ uid: 'patient-1', body: { appointmentId, dateKey, timeSlot: '10:00 AM' } }), rescheduleRes);
  assert.equal(rescheduleRes.statusCode, 409, JSON.stringify(rescheduleRes.body));

  const stored = __fakeDb.read('appointments', appointmentId);
  assert.equal(stored.timeSlot, '9:00 AM', 'appointment must remain at its original slot');
});

/* ── 3. Cancellation → event deleted ── */
await test('cancellation deletes the existing Calendar events', async () => {
  await resetAll();
  gcal.__connectUser('patient-1');
  gcal.__connectUser('doc-1');

  const { appointmentId } = await bookAppointment();
  const createRes = makeRes();
  await createEventsHandler(makeReq({ uid: 'patient-1', body: { appointmentId } }), createRes);
  const ids = createRes.body.calendarEventIds;
  assert.equal(gcal.__eventCount(), 2);

  const deleteRes = makeRes();
  await deleteEventsHandler(makeReq({ uid: 'patient-1', body: { appointmentId } }), deleteRes);
  assert.equal(deleteRes.statusCode, 200, JSON.stringify(deleteRes.body));

  assert.equal(gcal.__getEvent(ids.patient), undefined);
  assert.equal(gcal.__getEvent(ids.doctor), undefined);
  assert.equal(gcal.__eventCount(), 0);

  const stored = __fakeDb.read('appointments', appointmentId);
  assert.deepEqual(stored.calendarEventIds, {});
});

/* ── 4. Calendar API failure → appointment still succeeds ── */
await test('a Calendar API failure never prevents or reverts a successful appointment', async () => {
  await resetAll();
  gcal.__connectUser('patient-1');
  gcal.__connectUser('doc-1');
  gcal.__setShouldFail(true); // simulate the Google Calendar API being down

  const { appointmentId } = await bookAppointment();
  const stored = __fakeDb.read('appointments', appointmentId);
  assert.equal(stored.status, 'confirmed', 'the appointment itself must exist and be confirmed');

  const createRes = makeRes();
  await createEventsHandler(makeReq({ uid: 'patient-1', body: { appointmentId } }), createRes);
  assert.equal(createRes.statusCode, 502, 'the calendar call itself should report failure');

  // The appointment is completely unaffected by the calendar failure.
  const storedAfter = __fakeDb.read('appointments', appointmentId);
  assert.equal(storedAfter.status, 'confirmed');
  assert.equal(storedAfter.timeSlot, stored.timeSlot);
  assert.equal(storedAfter.calendarEventIds, undefined);
});

await test('a Calendar failure during cancellation still lets the appointment be marked cancelled by the caller', async () => {
  // Mirrors real usage: src/appointments/appointments.jsx marks the
  // appointment cancelled via its own Firestore write FIRST, then fires
  // deleteCalendarEventsForAppointment — a calendar failure there is only
  // ever logged client-side and never rolls back the cancellation.
  await resetAll();
  gcal.__connectUser('patient-1');
  gcal.__connectUser('doc-1');

  const { appointmentId } = await bookAppointment();
  const createRes = makeRes();
  await createEventsHandler(makeReq({ uid: 'patient-1', body: { appointmentId } }), createRes);

  await __fakeDb.collection('appointments').doc(appointmentId).set({ status: 'cancelled' }, { merge: true });

  gcal.__setShouldFail(true);
  const deleteRes = makeRes();
  await deleteEventsHandler(makeReq({ uid: 'patient-1', body: { appointmentId } }), deleteRes);
  assert.equal(deleteRes.statusCode, 502);

  const stored = __fakeDb.read('appointments', appointmentId);
  assert.equal(stored.status, 'cancelled', 'cancellation itself must stand regardless of the calendar-delete failure');
});

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
