import { FieldValue } from 'firebase-admin/firestore';
import { requireAuthenticatedUser, getAdminDb } from './lib/firebaseAdmin.js';
import { getAvailableSlots, dateFromKey } from '../src/utils/slotGeneration.js';
import { generateSymptomSummary } from './lib/gemini.js';
import { CAREFLOW_DOCTOR_IDS } from '../src/config/careflowDoctors.js';

const AI_SUMMARY_TIMEOUT_MS = 8000;

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Authoritative booking endpoint. The client shows slots computed with the
 * same getAvailableSlots() logic for instant UI feedback, but that read can
 * always be stale by the time the patient confirms (someone else booked the
 * same slot, the doctor went on leave, etc). This handler re-derives
 * availability from a fresh doctor read and a transactional appointments
 * query, then only creates the appointment if the slot is still free —
 * closing the race window a client-only check-then-write can't.
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

  const { doctorId, dateKey, timeSlot, symptoms, symptomDuration, severity, additionalInfo } = req.body || {};

  if (!doctorId || !dateKey || !timeSlot) {
    res.status(400).json({ error: 'Missing doctorId, dateKey or timeSlot' });
    return;
  }
  if (!DATE_KEY_RE.test(dateKey)) {
    res.status(400).json({ error: 'Invalid dateKey format, expected yyyy-MM-dd' });
    return;
  }
  if (!CAREFLOW_DOCTOR_IDS.includes(doctorId)) {
    res.status(404).json({ error: 'Doctor not found' });
    return;
  }

  const db = getAdminDb();
  const doctorRef = db.collection('doctors').doc(doctorId);

  try {
    const doctorSnap = await doctorRef.get();
    if (!doctorSnap.exists) {
      res.status(404).json({ error: 'Doctor not found' });
      return;
    }
    const doctor = doctorSnap.data();
    if (doctor.active === false) {
      res.status(403).json({ error: 'This doctor is not currently accepting appointments.' });
      return;
    }

    const date = dateFromKey(dateKey);
    const doctorName = doctor.name || `${doctor.firstName || ''} ${doctor.lastName || ''}`.trim();
    const patientName = decoded.name || decoded.email || 'Patient';

    const appointmentsRef = db.collection('appointments');
    // doctorId-only equality filter never requires a composite index; date
    // matching AND overlap detection (a booking can conflict with a
    // different-labeled slot once slotDuration is factored in) are both
    // done in-memory instead, mirroring the doctor dashboard's existing
    // doctorId-only query. Do NOT also filter by timeSlot here — that would
    // hide same-day bookings under a different label from the overlap
    // check below, defeating it entirely.
    const doctorAppointmentsQuery = appointmentsRef.where('doctorId', '==', doctorId);
    const newApptRef = appointmentsRef.doc();
    // Deterministic id — same one api/hold-slot.js writes to — so this
    // transaction can look up any existing hold on this exact slot directly,
    // no query needed.
    const holdRef = db.collection('slotHolds').doc(`${doctorId}_${dateKey}_${timeSlot}`);

    await db.runTransaction(async (transaction) => {
      const [conflictSnap, holdSnap] = await Promise.all([
        transaction.get(doctorAppointmentsQuery),
        transaction.get(holdRef),
      ]);
      const bookedSlots = conflictSnap.docs
        .map(d => d.data())
        .filter(a => a.status !== 'cancelled')
        .filter(a => {
          const apptDate = a.date?.toDate ? a.date.toDate() : new Date(a.date);
          return apptDate.getFullYear() === date.getFullYear()
              && apptDate.getMonth() === date.getMonth()
              && apptDate.getDate() === date.getDate();
        })
        .map(a => a.timeSlot);

      // Unchanged, pre-existing double-booking protection — the hold check
      // below is purely additive on top of this, never a replacement for it.
      const available = getAvailableSlots({
        availability: doctor.availability,
        blockedDates: doctor.blockedDates,
        date,
        bookedSlots,
        slotDuration: doctor.slotDuration || 60,
      });

      if (!available.includes(timeSlot)) {
        const err = new Error('This slot is no longer available. Please choose another time.');
        err.status = 409;
        throw err;
      }

      // An active hold belonging to a different patient blocks the booking
      // even though the confirmed-appointment check above passed — that's
      // the whole point of a hold. The caller's own hold (the normal case,
      // created when they clicked "Continue") or an expired hold never
      // blocks anything.
      if (holdSnap.exists) {
        const hold = holdSnap.data();
        const holdExpiresAt = hold.expiresAt?.toDate ? hold.expiresAt.toDate() : new Date(hold.expiresAt);
        if (holdExpiresAt > new Date() && hold.patientId !== decoded.uid) {
          const err = new Error('This slot is currently being held by another patient. Please choose another time.');
          err.status = 409;
          throw err;
        }
      }

      transaction.set(newApptRef, {
        doctorId,
        patientId: decoded.uid,
        date,
        timeSlot,
        doctorName,
        doctorSpecialty: doctor.specialty || '',
        patientName,
        status: 'confirmed',
        createdAt: FieldValue.serverTimestamp(),
        symptoms: (symptoms || '').toString().trim(),
        symptomDuration: (symptomDuration || '').toString().trim(),
        severity: (severity || '').toString(),
        additionalInfo: (additionalInfo || '').toString().trim(),
      });

      // The slot is now actually booked, so any hold on it (almost always
      // the caller's own, from clicking "Continue") is no longer needed.
      if (holdSnap.exists) {
        transaction.delete(holdRef);
      }
    });

    // Best-effort pre-visit AI summary — runs only after the appointment is
    // already committed above, and its outcome never affects the response:
    // the appointment must exist even if Gemini is unreachable, misconfigured,
    // or slow. On any failure we simply leave `aiSummary` unset; the Doctor
    // Dashboard shows "AI summary unavailable" in that case.
    try {
      const aiSummary = await Promise.race([
        generateSymptomSummary({ symptoms, symptomDuration, severity, additionalInfo }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('AI summary timed out')), AI_SUMMARY_TIMEOUT_MS)),
      ]);
      await newApptRef.set({ aiSummary }, { merge: true });
    } catch (err) {
      console.error('AI symptom summary failed (appointment still created):', err.message);
    }

    res.status(200).json({ success: true, id: newApptRef.id });
  } catch (err) {
    if (err.status === 409) {
      res.status(409).json({ error: err.message });
      return;
    }
    console.error('Failed to book appointment:', err);
    res.status(500).json({ error: 'Failed to book appointment. Please try again.' });
  }
}
