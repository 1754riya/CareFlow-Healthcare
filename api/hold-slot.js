import { FieldValue } from 'firebase-admin/firestore';
import { requireAuthenticatedUser, getAdminDb } from './lib/firebaseAdmin.js';
import { getAvailableSlots, dateFromKey } from '../src/utils/slotGeneration.js';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const HOLD_DURATION_MS = 5 * 60 * 1000;

/**
 * Creates a 5-minute hold on a slot when the patient clicks "Continue"
 * after selecting it, so the slot is reserved for them while they fill out
 * the symptoms form. Uses a deterministic doc id (doctorId_dateKey_timeSlot)
 * in the slotHolds collection — at most one hold doc can ever exist for a
 * given slot, so combined with the transaction below, two patients can
 * never both hold the same slot: the second transaction to commit always
 * sees the first's write and is retried/rejected.
 *
 * This does NOT replace the final booking transaction's own double-booking
 * check (api/book-appointment.js) — that check is unchanged. This only
 * adds an earlier, softer reservation on top of it.
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

  const { doctorId, dateKey, timeSlot } = req.body || {};
  if (!doctorId || !dateKey || !timeSlot) {
    res.status(400).json({ error: 'Missing doctorId, dateKey or timeSlot' });
    return;
  }
  if (!DATE_KEY_RE.test(dateKey)) {
    res.status(400).json({ error: 'Invalid dateKey format, expected yyyy-MM-dd' });
    return;
  }

  const db = getAdminDb();
  const doctorRef = db.collection('doctors').doc(doctorId);
  const holdRef = db.collection('slotHolds').doc(`${doctorId}_${dateKey}_${timeSlot}`);

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
    const appointmentsRef = db.collection('appointments');
    const doctorAppointmentsQuery = appointmentsRef.where('doctorId', '==', doctorId);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + HOLD_DURATION_MS);

    await db.runTransaction(async (transaction) => {
      const [apptSnap, existingHoldSnap] = await Promise.all([
        transaction.get(doctorAppointmentsQuery),
        transaction.get(holdRef),
      ]);

      // An active hold belonging to someone else blocks the hold outright.
      // An expired hold, or the caller's own hold (e.g. a page refresh),
      // is simply overwritten below.
      if (existingHoldSnap.exists) {
        const existingHold = existingHoldSnap.data();
        const existingExpiresAt = existingHold.expiresAt?.toDate
          ? existingHold.expiresAt.toDate() : new Date(existingHold.expiresAt);
        if (existingExpiresAt > now && existingHold.patientId !== decoded.uid) {
          const err = new Error('This slot is currently being held by another patient. Please choose another time.');
          err.status = 409;
          throw err;
        }
      }

      const bookedSlots = apptSnap.docs
        .map(d => d.data())
        .filter(a => a.status !== 'cancelled')
        .filter(a => {
          const apptDate = a.date?.toDate ? a.date.toDate() : new Date(a.date);
          return apptDate.getFullYear() === date.getFullYear()
              && apptDate.getMonth() === date.getMonth()
              && apptDate.getDate() === date.getDate();
        })
        .map(a => a.timeSlot);

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

      transaction.set(holdRef, {
        doctorId, dateKey, timeSlot,
        patientId: decoded.uid,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt,
      });
    });

    res.status(200).json({ success: true, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    if (err.status === 409) {
      res.status(409).json({ error: err.message });
      return;
    }
    console.error('Failed to hold slot:', err);
    res.status(500).json({ error: 'Failed to hold slot. Please try again.' });
  }
}
