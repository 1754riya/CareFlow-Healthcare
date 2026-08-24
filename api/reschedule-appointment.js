import { FieldValue } from 'firebase-admin/firestore';
import { requireAuthenticatedUser, getAdminDb } from './_lib/firebaseAdmin.js';
import { getAvailableSlots, dateFromKey } from '../src/utils/slotGeneration.js';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reschedules an existing appointment to a new date/time. Re-validates the
 * new slot inside a transaction using the exact same doctorId-only-query +
 * overlap-check logic as api/book-appointment.js (reused via
 * getAvailableSlots, not duplicated), so a reschedule can never silently
 * double-book — the appointment being rescheduled is excluded from its own
 * conflict check since it's vacating its current slot.
 *
 * Only updates the existing appointment doc's date/timeSlot — never creates
 * a new appointment or a new Calendar event. The client calls
 * /api/update-calendar-events afterward (fire-and-forget, via
 * calendarSync.js) to sync the already-existing Calendar events to the new
 * time instead of creating duplicates.
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

  const { appointmentId, dateKey, timeSlot } = req.body || {};

  if (!appointmentId || !dateKey || !timeSlot) {
    res.status(400).json({ error: 'Missing appointmentId, dateKey or timeSlot' });
    return;
  }
  if (!DATE_KEY_RE.test(dateKey)) {
    res.status(400).json({ error: 'Invalid dateKey format, expected yyyy-MM-dd' });
    return;
  }

  const db = getAdminDb();
  const appointmentRef = db.collection('appointments').doc(appointmentId);

  try {
    const appointmentSnap = await appointmentRef.get();
    if (!appointmentSnap.exists) {
      res.status(404).json({ error: 'Appointment not found' });
      return;
    }
    const appointment = appointmentSnap.data();

    if (decoded.uid !== appointment.patientId && decoded.uid !== appointment.doctorId) {
      res.status(403).json({ error: 'Not authorized for this appointment' });
      return;
    }
    if (appointment.status === 'cancelled') {
      res.status(400).json({ error: 'A cancelled appointment cannot be rescheduled.' });
      return;
    }
    if (appointment.status === 'completed') {
      res.status(400).json({ error: 'A completed appointment cannot be rescheduled.' });
      return;
    }

    const doctorRef = db.collection('doctors').doc(appointment.doctorId);
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
    const doctorAppointmentsQuery = appointmentsRef.where('doctorId', '==', appointment.doctorId);

    await db.runTransaction(async (transaction) => {
      const conflictSnap = await transaction.get(doctorAppointmentsQuery);
      const bookedSlots = conflictSnap.docs
        .filter(d => d.id !== appointmentId) // excludes itself — it's vacating this slot, not double-booking it
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

      transaction.set(appointmentRef, {
        date,
        timeSlot,
        status: 'confirmed',
        rescheduledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    res.status(200).json({ success: true });
  } catch (err) {
    if (err.status === 409) {
      res.status(409).json({ error: err.message });
      return;
    }
    console.error('Failed to reschedule appointment:', err);
    res.status(500).json({ error: 'Failed to reschedule appointment. Please try again.' });
  }
}
