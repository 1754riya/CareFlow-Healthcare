import { requireAuthenticatedUser, getAdminDb } from './lib/firebaseAdmin.js';
import { loadAuthorizedAppointment, toEmailAppointmentData } from './lib/appointmentAccess.js';
import { patientCancellationEmail, doctorCancellationEmail } from './lib/appointmentEmailTemplate.js';
import { sendTrackedEmail } from './lib/emailQueue.js';

/**
 * Best-effort: sends a cancellation email to the patient and (if on file)
 * the doctor for an already-cancelled appointment. Called by the client
 * right after it has already marked the appointment cancelled
 * (src/appointments/appointments.jsx, src/doc-dashboard/dashboard.jsx) —
 * this endpoint never affects that cancellation. Failed sends are queued
 * for retry via sendTrackedEmail, never thrown back to the caller.
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
    const { appointment } = await loadAuthorizedAppointment(appointmentId, decoded.uid);

    const db = getAdminDb();
    const [patientSnap, doctorSnap] = await Promise.all([
      db.collection('patients').doc(appointment.patientId).get(),
      db.collection('doctors').doc(appointment.doctorId).get(),
    ]);
    const patientEmail = patientSnap.exists ? patientSnap.data().email : null;
    const doctorEmail = doctorSnap.exists ? doctorSnap.data().email : null;

    const data = toEmailAppointmentData(appointment);
    const results = [];

    // patientEmail should always be on file (set at signup) — but treat it
    // the same as doctorEmail (best-effort, never required) for robustness.
    if (patientEmail) {
      const { subject, html } = patientCancellationEmail(data);
      results.push(
        sendTrackedEmail({ type: 'cancellation', to: patientEmail, subject, html, appointmentId, recipientRole: 'patient' })
      );
    }
    if (doctorEmail) {
      const { subject, html } = doctorCancellationEmail(data);
      results.push(
        sendTrackedEmail({ type: 'cancellation', to: doctorEmail, subject, html, appointmentId, recipientRole: 'doctor' })
      );
    }

    await Promise.all(results);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Failed to send cancellation email:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Failed to send cancellation email.' });
  }
}
