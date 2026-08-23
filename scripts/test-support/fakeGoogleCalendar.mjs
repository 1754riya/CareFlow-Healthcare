/**
 * In-memory stand-in for api/lib/googleCalendar.js, used by test scripts (via
 * the module-resolution loader hook in firebaseAdminLoader.mjs) so the REAL,
 * unmodified api/create-calendar-events.js, api/update-calendar-events.js,
 * api/delete-calendar-events.js, and api/reschedule-appointment.js handlers
 * can be exercised without ever calling the live Google Calendar API.
 *
 * Simulates: which users have "connected" Google Calendar (mirrors the real
 * googleCalendarTokens/{uid} check — createEventForUser/updateEventForUser
 * return null for an unconnected user, exactly like the real module), the
 * events store itself, and an injectable failure mode for testing that a
 * Calendar API error never blocks appointment creation.
 */

const connectedUsers = new Set();
const events = new Map(); // eventId -> { uid, ...appointmentData }
let idCounter = 0;
let shouldFail = false;

export function __reset() {
  connectedUsers.clear();
  events.clear();
  idCounter = 0;
  shouldFail = false;
}
export function __connectUser(uid) { connectedUsers.add(uid); }
export function __setShouldFail(value) { shouldFail = value; }
export function __getEvent(eventId) { return events.get(eventId); }
export function __eventCount() { return events.size; }

export async function createEventForUser(uid, appointmentData) {
  if (shouldFail) throw new Error('Simulated Google Calendar API failure');
  if (!connectedUsers.has(uid)) return null;
  const id = `evt-${++idCounter}`;
  events.set(id, { uid, ...appointmentData });
  return id;
}

export async function updateEventForUser(uid, eventId, appointmentData) {
  if (shouldFail) throw new Error('Simulated Google Calendar API failure');
  if (!connectedUsers.has(uid)) return null;
  if (!events.has(eventId)) {
    const err = new Error('Simulated 404: event not found');
    err.code = 404;
    throw err;
  }
  events.set(eventId, { uid, ...appointmentData });
  return eventId;
}

export async function deleteEventForUser(uid, eventId) {
  if (shouldFail) throw new Error('Simulated Google Calendar API failure');
  if (!connectedUsers.has(uid)) return;
  events.delete(eventId);
}
