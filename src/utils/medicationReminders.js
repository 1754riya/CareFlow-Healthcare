import { toDateKey, dateFromKey } from './slotGeneration.js';

function addDays(dateKey, days) {
  const d = dateFromKey(dateKey);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/**
 * Parses a free-text prescription frequency (e.g. "Twice a day") into a
 * times-per-day integer. Supports the four common phrasings plus a numeric
 * "N times (a day)" fallback. Returns null if it can't be confidently
 * parsed — callers must skip reminder creation for that medicine rather
 * than guessing, per the "handle invalid/missing frequency gracefully"
 * requirement.
 */
export function parseFrequency(frequency) {
  if (!frequency || typeof frequency !== 'string') return null;
  const text = frequency.trim().toLowerCase();
  if (!text) return null;

  if (/\bonce\b/.test(text)) return 1;
  if (/\btwice\b/.test(text)) return 2;
  if (/\bthree times\b|\bthrice\b/.test(text)) return 3;
  if (/\bfour times\b/.test(text)) return 4;

  const numeric = text.match(/(\d+)\s*times?/);
  if (numeric) {
    const n = parseInt(numeric[1], 10);
    if (n >= 1 && n <= 6) return n;
  }

  return null;
}

/**
 * Parses a free-text prescription duration (e.g. "3 days", "1 week") into a
 * whole number of days. Returns null if it can't be confidently parsed.
 */
export function parseDurationDays(duration) {
  if (!duration || typeof duration !== 'string') return null;
  const text = duration.trim().toLowerCase();
  if (!text) return null;

  const days = text.match(/(\d+)\s*day/);
  if (days) return parseInt(days[1], 10) || null;

  const weeks = text.match(/(\d+)\s*week/);
  if (weeks) return (parseInt(weeks[1], 10) || 0) * 7 || null;

  return null;
}

/**
 * Builds the medicationReminders doc for one prescribed medicine, starting
 * on startDateKey (yyyy-MM-dd). Returns null if the medicine name, frequency,
 * or duration can't be used/parsed — callers must skip creating a reminder
 * for that item rather than guessing.
 */
export function buildReminderSchedule({
  appointmentId, patientId, doctorId, medicine, dosage, instructions, frequency, duration, startDateKey,
}) {
  const timesPerDay = parseFrequency(frequency);
  const durationDays = parseDurationDays(duration);
  if (!medicine || !String(medicine).trim() || !timesPerDay || !durationDays) return null;

  return {
    appointmentId,
    patientId,
    doctorId,
    medicine: String(medicine).trim(),
    dosage: dosage || '',
    instructions: instructions || '',
    frequency,
    timesPerDay,
    duration,
    durationDays,
    startDate: startDateKey,
    endDate: addDays(startDateKey, durationDays - 1), // inclusive last day
    status: 'active',
    lastSentDate: null,
  };
}

/** True if a schedule's duration has fully elapsed as of today — reminders must stop. */
export function isReminderExpired(schedule, todayKey) {
  return todayKey > schedule.endDate;
}

/** True if a schedule has a dose due today that hasn't been sent yet. */
export function isReminderDueToday(schedule, todayKey) {
  if (schedule.status !== 'active') return false;
  if (todayKey < schedule.startDate) return false;
  if (isReminderExpired(schedule, todayKey)) return false;
  return schedule.lastSentDate !== todayKey;
}

/** Patient-facing reminder text for one day's dose of a medicine. */
export function buildReminderMessage(schedule, todayKey) {
  const dayNumber = Math.round((dateFromKey(todayKey) - dateFromKey(schedule.startDate)) / 86400000) + 1;
  const head = [`💊 Reminder: Take ${schedule.medicine}`, schedule.dosage && `(${schedule.dosage})`]
    .filter(Boolean).join(' ');
  const instructions = schedule.instructions ? ` ${schedule.instructions}.` : '';
  return `${head} — ${schedule.frequency}.${instructions} Day ${dayNumber} of ${schedule.durationDays}.`;
}
