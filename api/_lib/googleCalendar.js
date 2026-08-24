import { google } from 'googleapis';
import { getAdminDb } from './firebaseAdmin.js';

const TOKENS_COLLECTION = 'googleCalendarTokens';
const CALENDAR_TIMEZONE = 'Asia/Kolkata';
const APPOINTMENT_DURATION_MS = 60 * 60 * 1000; // 1 hour, matches the rest of the app's assumption

function getOAuthClient() {
  const { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET } = process.env;
  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new Error('Server is not configured: missing GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET.');
  }
  // redirect_uri is irrelevant for the popup ("postmessage") code exchange and
  // for refresh-token based calls, but the client requires a value.
  return new google.auth.OAuth2(GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, 'postmessage');
}

/** Exchanges a one-time auth code (from the Google Identity Services popup flow) for tokens. */
export async function exchangeCodeForTokens(code) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens; // { access_token, refresh_token, expiry_date, scope, ... }
}

export async function saveUserCalendarTokens(uid, tokens) {
  if (!tokens.refresh_token) {
    throw new Error('Google did not return a refresh token — reconnect with consent prompt.');
  }
  await getAdminDb().collection(TOKENS_COLLECTION).doc(uid).set({
    refreshToken: tokens.refresh_token,
    scope: tokens.scope || null,
    connectedAt: new Date(),
    updatedAt: new Date(),
  }, { merge: true });
}

export async function removeUserCalendarTokens(uid) {
  await getAdminDb().collection(TOKENS_COLLECTION).doc(uid).delete();
}

export async function getUserCalendarConnection(uid) {
  const snap = await getAdminDb().collection(TOKENS_COLLECTION).doc(uid).get();
  return snap.exists ? snap.data() : null;
}

/** Returns an authorized Calendar API client for this user, or null if they haven't connected. */
async function getCalendarClientForUser(uid) {
  const tokenDoc = await getUserCalendarConnection(uid);
  if (!tokenDoc?.refreshToken) return null;

  const client = getOAuthClient();
  client.setCredentials({ refresh_token: tokenDoc.refreshToken });
  return google.calendar({ version: 'v3', auth: client });
}

function parseTimeSlot(baseDate, timeSlot) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((timeSlot || '').trim());
  const start = new Date(baseDate);
  if (match) {
    let hours = parseInt(match[1], 10) % 12;
    if (/pm/i.test(match[3])) hours += 12;
    start.setHours(hours, parseInt(match[2], 10), 0, 0);
  }
  return start;
}

function buildAppointmentEvent({ doctorName, patientName, doctorSpecialty, date, timeSlot, symptoms, symptomDuration, severity, additionalInfo }) {
  const start = parseTimeSlot(date, timeSlot);
  const end = new Date(start.getTime() + APPOINTMENT_DURATION_MS);

  const detailLines = [
    `Patient: ${patientName}`,
    `Doctor: Dr. ${doctorName}${doctorSpecialty ? ` (${doctorSpecialty})` : ''}`,
    symptoms && `Symptoms: ${symptoms}`,
    symptomDuration && `Duration: ${symptomDuration}`,
    severity && `Severity: ${severity}`,
    additionalInfo && `Additional info: ${additionalInfo}`,
  ].filter(Boolean);

  return {
    summary: `Appointment: ${patientName} with Dr. ${doctorName}`,
    description: detailLines.join('\n'),
    start: { dateTime: start.toISOString(), timeZone: CALENDAR_TIMEZONE },
    end: { dateTime: end.toISOString(), timeZone: CALENDAR_TIMEZONE },
  };
}

/**
 * Creates a Calendar event for a user (patient or doctor) if they've connected
 * their Google account. Returns the new event ID, or null if they're not connected.
 */
export async function createEventForUser(uid, appointmentData) {
  const calendar = await getCalendarClientForUser(uid);
  if (!calendar) return null;

  const event = buildAppointmentEvent(appointmentData);
  const { data } = await calendar.events.insert({ calendarId: 'primary', requestBody: event });
  return data.id;
}

/**
 * Updates an existing Calendar event for a user with the appointment's current
 * date/time/details. Returns the event ID (unchanged), or null if not connected.
 */
export async function updateEventForUser(uid, eventId, appointmentData) {
  const calendar = await getCalendarClientForUser(uid);
  if (!calendar) return null;

  const event = buildAppointmentEvent(appointmentData);
  await calendar.events.update({ calendarId: 'primary', eventId, requestBody: event });
  return eventId;
}

/** Deletes a Calendar event for a user. Treats "already gone" as success. */
export async function deleteEventForUser(uid, eventId) {
  const calendar = await getCalendarClientForUser(uid);
  if (!calendar) return;

  try {
    await calendar.events.delete({ calendarId: 'primary', eventId });
  } catch (err) {
    const status = err?.code || err?.response?.status;
    if (status !== 404 && status !== 410) throw err;
  }
}
