/**
 * Exercises the REAL, unmodified api/book-appointment.js handler against an
 * in-memory Firestore fake with genuine optimistic-concurrency-control
 * transaction semantics (scripts/test-support/fakeFirebaseAdmin.mjs),
 * redirected in via a module loader hook (firebaseAdminLoader.mjs) so no
 * live Firebase project is required.
 *
 * Run with:  node scripts/testBookingConcurrency.js
 */
import { register } from 'node:module';
import assert from 'node:assert/strict';
import { format } from 'date-fns';
import { getDayName, toDateKey } from '../src/utils/slotGeneration.js';

register('./test-support/firebaseAdminLoader.mjs', import.meta.url);

const { __fakeDb, __reset } = await import('./test-support/fakeFirebaseAdmin.mjs');
const { default: handler } = await import('../api/book-appointment.js');

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

function makeToken(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function makeReq({ uid, name, body }) {
  return {
    method: 'POST',
    headers: { authorization: `Bearer ${makeToken({ uid, name })}` },
    body,
  };
}

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
  };
}

async function seedDoctor(id, data) {
  await __fakeDb.collection('doctors').doc(id).set({
    firstName: 'Test', lastName: 'Doctor', name: 'Test Doctor',
    specialty: 'General', active: true, slotDuration: 60,
    availability: {}, blockedDates: [], ...data,
  });
}

function futureDate(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(0, 0, 0, 0);
  return d;
}

/* ── 1. Two patients booking the same doctor/date/time simultaneously ── */
await test('concurrency: two simultaneous bookings for the same slot — exactly one succeeds, the other gets 409', async () => {
  __reset();
  const date = futureDate(10);
  const dayName = getDayName(date);
  const dateKey = toDateKey(date);
  await seedDoctor('doc-concurrency', { availability: { [dayName]: ['9:00 AM', '10:00 AM'] } });

  const reqA = makeReq({ uid: 'patientA', name: 'Alice', body: { doctorId: 'doc-concurrency', dateKey, timeSlot: '9:00 AM' } });
  const reqB = makeReq({ uid: 'patientB', name: 'Bob', body: { doctorId: 'doc-concurrency', dateKey, timeSlot: '9:00 AM' } });
  const resA = makeRes();
  const resB = makeRes();

  await Promise.all([handler(reqA, resA), handler(reqB, resB)]);

  const statuses = [resA.statusCode, resB.statusCode].sort();
  assert.deepEqual(statuses, [200, 409], `expected exactly one 200 and one 409, got ${JSON.stringify(statuses)}`);

  const winner = resA.statusCode === 200 ? resA : resB;
  const loser  = resA.statusCode === 200 ? resB : resA;
  assert.equal(winner.body.success, true);
  assert.ok(loser.body.error?.includes('no longer available'), `loser message: ${loser.body.error}`);

  const appts = __fakeDb.query('appointments', [
    { field: 'doctorId', op: '==', value: 'doc-concurrency' },
    { field: 'timeSlot', op: '==', value: '9:00 AM' },
  ]);
  assert.equal(appts.length, 1, `expected exactly 1 committed appointment, found ${appts.length}`);
});

/* ── 2. One patient booking an already-booked slot (sequential) ── */
await test('sequential: booking an already-booked slot is rejected with 409', async () => {
  __reset();
  const date = futureDate(11);
  const dayName = getDayName(date);
  const dateKey = toDateKey(date);
  await seedDoctor('doc-seq', { availability: { [dayName]: ['9:00 AM'] } });

  const resFirst = makeRes();
  await handler(makeReq({ uid: 'patientA', body: { doctorId: 'doc-seq', dateKey, timeSlot: '9:00 AM' } }), resFirst);
  assert.equal(resFirst.statusCode, 200, JSON.stringify(resFirst.body));

  const resSecond = makeRes();
  await handler(makeReq({ uid: 'patientB', body: { doctorId: 'doc-seq', dateKey, timeSlot: '9:00 AM' } }), resSecond);
  assert.equal(resSecond.statusCode, 409, JSON.stringify(resSecond.body));
});

/* ── 3. Booking a slot during doctor leave ── */
await test('leave dates: booking a slot on a blocked date is rejected with 409', async () => {
  __reset();
  const date = futureDate(12);
  const dayName = getDayName(date);
  const dateKey = toDateKey(date);
  await seedDoctor('doc-leave', { availability: { [dayName]: ['9:00 AM'] }, blockedDates: [dateKey] });

  const res = makeRes();
  await handler(makeReq({ uid: 'patientA', body: { doctorId: 'doc-leave', dateKey, timeSlot: '9:00 AM' } }), res);
  assert.equal(res.statusCode, 409, JSON.stringify(res.body));
});

/* ── 4. Booking a past slot ── */
await test('past slots: booking a slot earlier today (already passed) is rejected with 409', async () => {
  __reset();
  const now = new Date();
  const todayDayName = getDayName(now);
  const todayKey = toDateKey(now);

  // Keep the "future" probe within today even if the suite runs late at
  // night, so it can't accidentally roll into tomorrow's calendar date.
  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 0, 0);
  const past = new Date(now.getTime() - 5 * 60000);
  const future = new Date(Math.min(now.getTime() + 60 * 60000, endOfToday.getTime()));

  const pastLabel = format(past, 'h:mm a');
  const futureLabel = format(future, 'h:mm a');
  await seedDoctor('doc-past', { availability: { [todayDayName]: [pastLabel, futureLabel] } });

  const pastRes = makeRes();
  await handler(makeReq({ uid: 'patientA', body: { doctorId: 'doc-past', dateKey: todayKey, timeSlot: pastLabel } }), pastRes);
  assert.equal(pastRes.statusCode, 409, `past slot should be rejected, got ${pastRes.statusCode}: ${JSON.stringify(pastRes.body)}`);

  const futureRes = makeRes();
  await handler(makeReq({ uid: 'patientB', body: { doctorId: 'doc-past', dateKey: todayKey, timeSlot: futureLabel } }), futureRes);
  assert.equal(futureRes.statusCode, 200, `future slot today should still be bookable, got ${futureRes.statusCode}: ${JSON.stringify(futureRes.body)}`);
});

/* ── 5. Booking adjacent slots when slot duration causes overlap ── */
await test('overlap: a longer slotDuration blocks an adjacent slot even with a different label', async () => {
  __reset();
  const date = futureDate(13);
  const dayName = getDayName(date);
  const dateKey = toDateKey(date);
  await seedDoctor('doc-overlap', { slotDuration: 90, availability: { [dayName]: ['9:00 AM', '10:00 AM'] } });

  const resFirst = makeRes();
  await handler(makeReq({ uid: 'patientA', body: { doctorId: 'doc-overlap', dateKey, timeSlot: '9:00 AM' } }), resFirst);
  assert.equal(resFirst.statusCode, 200, JSON.stringify(resFirst.body));

  // 9:00 AM + 90 min runs until 10:30 AM, overlapping the 10:00 AM slot.
  const resSecond = makeRes();
  await handler(makeReq({ uid: 'patientB', body: { doctorId: 'doc-overlap', dateKey, timeSlot: '10:00 AM' } }), resSecond);
  assert.equal(resSecond.statusCode, 409, `overlapping slot should be rejected, got ${resSecond.statusCode}: ${JSON.stringify(resSecond.body)}`);
});

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
