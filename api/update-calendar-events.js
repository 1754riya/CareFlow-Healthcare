import { requireAuthenticatedUser } from './lib/firebaseAdmin.js';
import { loadAuthorizedAppointment, toCalendarAppointmentData } from './lib/appointmentAccess.js';
import { createEventForUser, updateEventForUser } from './lib/googleCalendar.js';

/**
 * Syncs Calendar events to whatever date/time/details currently sit on the
 * appointment doc — updates existing events, or creates them if a user
 * connected Calendar after the appointment was first booked.
 *
 * Not wired to any UI yet (no reschedule feature exists). This exists as a
 * ready-to-call endpoint for when one is built: after writing the new
 * date/time to the appointment doc, call this with { appointmentId }.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let decoded;
  try {
    decoded = await requireAuthenticatedUser(req);
  } catch {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const { appointmentId } = req.body || {};
  if (!appointmentId) {
    res.status(400).json({ error: 'Missing appointmentId' });
    return;
  }

  try {
    const { ref, appointment } = await loadAuthorizedAppointment(appointmentId, decoded.uid);

    const existing = appointment.calendarEventIds || {};
    const appointmentData = toCalendarAppointmentData(appointment);

    const updates = {};
    for (const [role, uid] of [['patient', appointment.patientId], ['doctor', appointment.doctorId]]) {
      const eventId = existing[role]
        ? await updateEventForUser(uid, existing[role], appointmentData)
        : await createEventForUser(uid, appointmentData);
      if (eventId) updates[role] = eventId;
    }

    if (Object.keys(updates).length > 0) {
      await ref.set({ calendarEventIds: { ...existing, ...updates } }, { merge: true });
    }

    res.status(200).json({ success: true, calendarEventIds: { ...existing, ...updates } });
  } catch (err) {
    console.error('Failed to update calendar events:', err);
    res.status(err.status || 502).json({ error: err.status ? err.message : 'Failed to update calendar events' });
  }
}
