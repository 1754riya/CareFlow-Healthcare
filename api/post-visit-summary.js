import { requireAuthenticatedUser } from './lib/firebaseAdmin.js';
import { loadAuthorizedAppointment } from './lib/appointmentAccess.js';
import { generatePostVisitSummary } from './lib/gemini.js';

const SUMMARY_TIMEOUT_MS = 8000;

/**
 * Best-effort: converts a just-completed visit's clinical notes/prescription/
 * follow-up into a patient-friendly post-visit summary via Gemini, and saves
 * it onto the existing appointment doc. Called by the doctor's client right
 * after it has already marked the appointment completed (PatientSidebar.jsx)
 * — this endpoint never affects that completion; on any failure here the
 * appointment simply keeps no `postVisitSummary` field, and the patient sees
 * "Post-visit summary unavailable".
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

    if (decoded.uid !== appointment.doctorId) {
      res.status(403).json({ error: 'Only the treating doctor can generate the post-visit summary.' });
      return;
    }

    let postVisitSummary = null;
    try {
      postVisitSummary = await Promise.race([
        generatePostVisitSummary({
          visitNotes: appointment.visitNotes,
          prescription: appointment.prescription,
          followUpInstructions: appointment.followUpInstructions,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Post-visit summary timed out')), SUMMARY_TIMEOUT_MS)),
      ]);
      await ref.set({ postVisitSummary }, { merge: true });
    } catch (err) {
      console.error('Post-visit summary generation failed (appointment remains completed):', err.message);
    }

    res.status(200).json({ success: true, postVisitSummary });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Failed to generate post-visit summary.' });
  }
}
