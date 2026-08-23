import { parse, isAfter } from 'date-fns';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function getDayName(date) {
  return DAY_NAMES[date.getDay()];
}

/** yyyy-MM-dd built from the Date's own Y/M/D components — never shifts the
 *  calendar day due to UTC conversion, matching how blockedDates are stored. */
export function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Reconstructs a Date at local midnight for a given yyyy-MM-dd key. */
export function dateFromKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Parses a slot label like "9:00 AM" / "09:00 AM" onto the given calendar day. */
export function parseSlotTime(dateForDay, slotLabel) {
  return parse(slotLabel, 'h:mm a', dateForDay);
}

/**
 * doctor.availability[day] is normally a plain array of slot labels, but
 * Set-availability.jsx's in-memory editor state briefly shapes it as
 * `{ enabled, slots }` — accept both so callers never special-case it.
 */
function normalizeDaySlots(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object' && Array.isArray(value.slots)) {
    return value.enabled === false ? [] : value.slots;
  }
  return [];
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Computes the bookable slot labels for a doctor on a given date, enforcing
 * every rule the booking flow must respect:
 *   - only slots within that day's working hours (doctor.availability)
 *   - none on a leave/blocked date (doctor.blockedDates)
 *   - none overlapping an already-booked appointment, given the doctor's
 *     slot duration (bookedSlots — active appointments' timeSlot labels)
 *   - none in the past, if `date` is today (relative to `now`)
 *
 * Pure function, no Firebase/DOM dependency — shared verbatim between the
 * client (instant UI display) and the server (authoritative re-check at
 * booking time) so the two can never disagree about what "available" means.
 */
export function getAvailableSlots({
  availability, blockedDates = [], date, bookedSlots = [], heldSlots = [], slotDuration = 60, now = new Date(),
}) {
  if (!date) return [];

  const dateKey = toDateKey(date);
  const todayKey = toDateKey(now);
  if (dateKey < todayKey) return []; // fully past date

  if (blockedDates.includes(dateKey)) return [];

  const dayName = getDayName(date);
  const daySlots = normalizeDaySlots(availability && availability[dayName]);
  if (daySlots.length === 0) return [];

  const durationMs = Math.max(1, Number(slotDuration) || 60) * 60000;
  // Actively-held slots (by another patient, not yet expired) occupy the
  // same time interval as a real booking for availability purposes — a
  // hold is functionally "a soon-to-be booking" until it expires or is
  // released. Callers are responsible for pre-filtering heldSlots to
  // active, non-self holds (see getActiveHeldSlotsForDate).
  const bookedIntervals = [...bookedSlots, ...heldSlots].map(label => {
    const start = parseSlotTime(date, label);
    return { start, end: new Date(start.getTime() + durationMs) };
  });

  const isToday = dateKey === todayKey;

  const available = daySlots.filter(slotLabel => {
    const start = parseSlotTime(date, slotLabel);
    const end = new Date(start.getTime() + durationMs);

    if (bookedIntervals.some(b => overlaps(start, end, b.start, b.end))) return false;
    if (isToday && !isAfter(start, now)) return false;
    return true;
  });

  return available.slice().sort((a, b) => parseSlotTime(date, a) - parseSlotTime(date, b));
}

/** End time of a slot given the doctor's configured appointment length (minutes, default 60). */
export function getSlotEndTime(date, slotLabel, slotDurationMinutes = 60) {
  const start = parseSlotTime(date, slotLabel);
  return new Date(start.getTime() + (Number(slotDurationMinutes) || 60) * 60000);
}

/**
 * Extracts the still-active (non-cancelled) timeSlot labels booked for a
 * doctor on a given date, from a list of raw appointment docs (each with
 * `.date` — a Firestore Timestamp or Date — `.timeSlot`, and `.status`).
 */
export function getBookedSlotsForDate(appointments, dateKey) {
  return appointments
    .filter(a => a.status !== 'cancelled')
    .filter(a => {
      const apptDate = a.date?.toDate ? a.date.toDate() : new Date(a.date);
      return toDateKey(apptDate) === dateKey;
    })
    .map(a => a.timeSlot);
}

/**
 * Extracts the timeSlot labels currently held (not expired) by OTHER
 * patients on a given date, from a list of raw slotHolds docs (each with
 * `.dateKey`, `.timeSlot`, `.patientId`, and `.expiresAt` — a Firestore
 * Timestamp or Date). Excludes the caller's own hold(s) so a patient still
 * sees their own held slot as selectable, and excludes expired holds —
 * an expired hold is simply treated as if it didn't exist, with no cron or
 * cleanup step required.
 */
export function getActiveHeldSlotsForDate(holds, dateKey, { now = new Date(), excludePatientId = null } = {}) {
  return holds
    .filter(h => h.dateKey === dateKey)
    .filter(h => !excludePatientId || h.patientId !== excludePatientId)
    .filter(h => {
      const expiresAt = h.expiresAt?.toDate ? h.expiresAt.toDate() : new Date(h.expiresAt);
      return expiresAt > now;
    })
    .map(h => h.timeSlot);
}
