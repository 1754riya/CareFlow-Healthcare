import { requireAuthenticatedUser } from './lib/firebaseAdmin.js';
import { loadAuthorizedAppointment, toCalendarAppointmentData } from './lib/appointmentAccess.js';
import { createEventForUser } from './lib/googleCalendar.js';

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

    // Idempotent: an event already recorded for a role is never re-created.
    const existing = appointment.calendarEventIds || {};
    const appointmentData = toCalendarAppointmentData(appointment);

    const updates = {};
    if (!existing.patient) {
      const id = await createEventForUser(appointment.patientId, appointmentData);
      if (id) updates.patient = id;
    }
    if (!existing.doctor) {
      const id = await createEventForUser(appointment.doctorId, appointmentData);
      if (id) updates.doctor = id;
    }

    if (Object.keys(updates).length > 0) {
      await ref.set({ calendarEventIds: { ...existing, ...updates } }, { merge: true });
    }

    res.status(200).json({ success: true, calendarEventIds: { ...existing, ...updates } });
  } catch (err) {
    console.error('Failed to create calendar events:', err);
    res.status(err.status || 502).json({ error: err.status ? err.message : 'Failed to create calendar events' });
  }
}
