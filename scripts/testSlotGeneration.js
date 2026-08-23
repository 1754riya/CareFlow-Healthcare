/**
 * Standalone tests for src/utils/slotGeneration.js — the pure function that
 * both the booking UI and api/book-appointment.js use to decide which slots
 * are actually bookable. No test framework dependency; run with:
 *
 *   node scripts/testSlotGeneration.js
 */
import assert from 'node:assert/strict';
import { getAvailableSlots, getBookedSlotsForDate, toDateKey, getDayName, dateFromKey } from '../src/utils/slotGeneration.js';

let passed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✔ ${name}`);
    passed++;
  } catch (err) {
    console.error(`✘ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// A fixed date ~30 days out, so "past slot" tests have room on either side
// and the suite never flakes depending on what day it's actually run.
const targetDate = new Date();
targetDate.setDate(targetDate.getDate() + 30);
targetDate.setHours(0, 0, 0, 0);
const targetDayName = getDayName(targetDate);

const availability = { [targetDayName]: ['9:00 AM', '10:00 AM', '2:00 PM'] };

test("working hours: only the doctor's configured slots for that day are returned", () => {
  const slots = getAvailableSlots({ availability, date: targetDate });
  assert.deepEqual(slots, ['9:00 AM', '10:00 AM', '2:00 PM']);
});

test('working hours: a day with no configured slots returns none', () => {
  const otherDay = new Date(targetDate);
  otherDay.setDate(otherDay.getDate() + 1); // different weekday, absent from `availability`
  const slots = getAvailableSlots({ availability, date: otherDay });
  assert.deepEqual(slots, []);
});

test('booked slots: an exact-match booking removes that slot', () => {
  const slots = getAvailableSlots({ availability, date: targetDate, bookedSlots: ['10:00 AM'] });
  assert.deepEqual(slots, ['9:00 AM', '2:00 PM']);
});

test('booked slots: a longer appointment blocks overlapping slots, not just the exact label', () => {
  // A 90-minute appointment starting 9:00 AM runs 9:00-10:30, overlapping the 10:00 AM slot too.
  const slots = getAvailableSlots({ availability, date: targetDate, bookedSlots: ['9:00 AM'], slotDuration: 90 });
  assert.deepEqual(slots, ['2:00 PM']);
});

test('leave dates: a blocked date has zero slots even on an otherwise working day', () => {
  const dateKey = toDateKey(targetDate);
  const slots = getAvailableSlots({ availability, blockedDates: [dateKey], date: targetDate });
  assert.deepEqual(slots, []);
});

test('past slots: slots before "now" are excluded when the date is today', () => {
  const now = new Date(targetDate);
  now.setHours(11, 0, 0, 0); // 11:00 AM on the target day
  const slots = getAvailableSlots({ availability, date: targetDate, now });
  assert.deepEqual(slots, ['2:00 PM']);
});

test('past slots: a date entirely before "today" returns none, regardless of time', () => {
  const past = new Date(targetDate);
  past.setDate(past.getDate() - 60);
  const slots = getAvailableSlots({ availability, date: past, now: targetDate });
  assert.deepEqual(slots, []);
});

test('dateFromKey round-trips through toDateKey', () => {
  const key = toDateKey(targetDate);
  assert.equal(toDateKey(dateFromKey(key)), key);
});

test('getBookedSlotsForDate ignores cancelled appointments and other dates', () => {
  const dateKey = toDateKey(targetDate);
  const otherDate = new Date(targetDate);
  otherDate.setDate(otherDate.getDate() + 5);
  const appointments = [
    { date: targetDate, timeSlot: '9:00 AM', status: 'confirmed' },
    { date: targetDate, timeSlot: '10:00 AM', status: 'cancelled' },
    { date: otherDate, timeSlot: '2:00 PM', status: 'confirmed' },
  ];
  assert.deepEqual(getBookedSlotsForDate(appointments, dateKey), ['9:00 AM']);
});

console.log(`\n${passed} test(s) passed.`);
if (process.exitCode) {
  console.error('\nSome tests failed.');
  process.exit(1);
}
