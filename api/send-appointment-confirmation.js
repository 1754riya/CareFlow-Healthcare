import { sendMail } from './lib/mailer.js';
import { patientConfirmationEmail, doctorNotificationEmail } from './lib/appointmentEmailTemplate.js';

// doctorEmail is intentionally NOT required — many doctor records (bulk-imported
// from doctor.json) have no email on file, and that must never block the
// patient's own confirmation, which always has a real address (their login email).
const REQUIRED_FIELDS = ['patientName', 'patientEmail', 'doctorName', 'date', 'timeSlot'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const data = req.body || {};
  const missing = REQUIRED_FIELDS.filter(field => !data[field]);
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
