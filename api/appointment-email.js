import { requireAuthenticatedUser, getAdminDb } from './lib/firebaseAdmin.js';
import { loadAuthorizedAppointment, toEmailAppointmentData } from './lib/appointmentAccess.js';
import { sendMail } from './lib/mailer.js';
import {
  patientConfirmationEmail, doctorNotificationEmail,
  patientCancellationEmail, doctorCancellationEmail,
} from './lib/appointmentEmailTemplate.js';
import { sendTrackedEmail } from './lib/emailQueue.js';

// doctorEmail is intentionally NOT required for the confirmation email —
// many doctor records (bulk-imported from doctor.json) have no email on
// file, and that must never block the patient's own confirmation, which
// always has a real address (their login email).
const CONFIRMATION_REQUIRED_FIELDS = ['patientName', 'patientEmail', 'doctorName', 'date', 'timeSlot'];

/**
 * Consolidated appointment-email endpoint — combines the former
 * api/send-appointment-confirmation.js and api/send-cancellation-email.js
 * into one Serverless Function, to stay under the Vercel Hobby plan's
 * 12-function limit. vercel.json rewrites both original routes to this
 * file with a distinct ?action= query param; the client-visible URLs and
 * request/response bodies are unchanged. Each branch below is the original
 * handler's logic, unmodified — including that confirmation stays
 * unauthenticated while cancellation still requires the caller to be the
 * patient or doctor on the appointment.
 */
export default async function handler(req, res) {
  const { action } = req.query;

  if (action === 'confirmation') return handleConfirmation(req, res);
  if (action === 'cancellation') return handleCancellation(req, res);

  res.status(404).json({ error: 'Unknown action' });
}

async function handleConfirmation(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const data = req.body || {};
  const missing = CONFIRMATION_REQUIRED_FIELDS.filter(field => !data[field]);
  if (missing.length > 0) {
    res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    return;
  }

  const jobs = [];

  const patient = patientConfirmationEmail(data);
  jobs.push(
    sendMail({ to: data.patientEmail, subject: patient.subject, html: patient.html })
      .then(() => ({ recipient: 'patient', to: data.patientEmail, ok: true }))
      .catch(err => ({ recipient: 'patient', to: data.patientEmail, ok: false, error: err.message }))
  );

  if (data.doctorEmail) {
    const doctor = doctorNotificationEmail(data);
    jobs.push(
      sendMail({ to: data.doctorEmail, subject: doctor.subject, html: doctor.html })
        .then(() => ({ recipient: 'doctor', to: data.doctorEmail, ok: true }))
        .catch(err => ({ recipient: 'doctor', to: data.doctorEmail, ok: false, error: err.message }))
    );
  } else {
    jobs.push(Promise.resolve({ recipient: 'doctor', to: null, ok: false, skipped: 'no doctor email on file' }));
  }

  const results = await Promise.all(jobs);
  const patientResult = results.find(r => r.recipient === 'patient');

  console.log('Appointment confirmation email results:', JSON.stringify(results));

  // Fail the request only if the patient's own email — which should always be
  // sendable — actually failed. A missing/failed doctor email is logged, not fatal.
  res.status(patientResult.ok ? 200 : 502).json({ success: patientResult.ok, results });
}

async function handleCancellation(req, res) {
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
