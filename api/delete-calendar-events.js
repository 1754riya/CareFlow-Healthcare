import { requireAuthenticatedUser } from './lib/firebaseAdmin.js';
import { loadAuthorizedAppointment } from './lib/appointmentAccess.js';
import { deleteEventForUser } from './lib/googleCalendar.js';

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

    if (existing.patient) await deleteEventForUser(appointment.patientId, existing.patient);
    if (existing.doctor) await deleteEventForUser(appointment.doctorId, existing.doctor);

    if (existing.patient || existing.doctor) {
      await ref.set({ calendarEventIds: {} }, { merge: true });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Failed to delete calendar events:', err);
    res.status(err.status || 502).json({ error: err.status ? err.message : 'Failed to delete calendar events' });
  }
}
