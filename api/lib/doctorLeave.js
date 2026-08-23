import { format } from 'date-fns';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebaseAdmin.js';
import { toEmailAppointmentData } from './appointmentAccess.js';
import { patientCancellationEmail } from './appointmentEmailTemplate.js';
import { sendTrackedEmail } from './emailQueue.js';
import { deleteEventForUser } from './googleCalendar.js';
import { toDateKey, dateFromKey } from '../../src/utils/slotGeneration.js';

/**
 * Cancels every still-confirmed appointment for a doctor on one leave date,
 * notifying each affected patient (existing cancellation email + existing
 * in-app notification pattern) and removing their Google Calendar events
 * via the existing deleteEventForUser. Called once per newly-added leave
 * date from api/admin/update-doctor.js.
 *
 * Idempotent by construction, including under true concurrency: the actual
 * status transition for each appointment happens inside a transaction that
 * re-checks status === 'confirmed' immediately before writing, mirroring
 * the same optimistic-concurrency pattern api/book-appointment.js and
 * api/reschedule-appointment.js already use. So if this function is ever
 * invoked twice for the same date at the same time (e.g. a duplicated
 * admin request), only one invocation "wins" the transition per
 * appointment — the other sees it already cancelled and skips the
 * email/notification/calendar cleanup entirely, rather than repeating it.
 * A sequential repeat (the date already being in blockedDates, or a later
 * retried request) is likewise a safe no-op, since there's nothing left in
 * 'confirmed' status to act on.
 *
 * A failure emailing/notifying/removing-calendar-events for one patient is
 * logged and never stops the others, and never un-cancels the appointment
 * (matches the "email/calendar failure must never affect the appointment"
 * rule already established for booking/cancellation elsewhere).
 */
export async function cancelAppointmentsForDoctorLeave(doctorId, dateKey) {
  const db = getAdminDb();
  const snap = await db.collection('appointments').where('doctorId', '==', doctorId).get();

  const candidates = snap.docs.filter(docSnap => {
    const appointment = docSnap.data();
    if (appointment.status !== 'confirmed') return false;
    const apptDate = appointment.date?.toDate ? appointment.date.toDate() : new Date(appointment.date);
    return toDateKey(apptDate) === dateKey;
  });

  const friendlyDate = format(dateFromKey(dateKey), 'MMM d, yyyy');
  let cancelled = 0;

  for (const docSnap of candidates) {
    const appointment = await db.runTransaction(async (transaction) => {
      const freshSnap = await transaction.get(docSnap.ref);
      const data = freshSnap.exists ? freshSnap.data() : null;
      if (!data || data.status !== 'confirmed') return null; // already handled by another call
      transaction.set(docSnap.ref, {
        status: 'cancelled',
        cancelledReason: 'doctor_leave',
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return data;
    });

    if (!appointment) continue;
    cancelled++;

    try {
      const patientSnap = await db.collection('patients').doc(appointment.patientId).get();
      const patientEmail = patientSnap.exists ? patientSnap.data().email : null;
      if (patientEmail) {
        const data = toEmailAppointmentData(appointment);
        const { subject, html } = patientCancellationEmail(data);
        await sendTrackedEmail({
          type: 'cancellation', to: patientEmail, subject, html,
          appointmentId: docSnap.id, recipientRole: 'patient',
        });
      }
    } catch (err) {
      console.error(`Failed to email patient for leave-cancelled appointment ${docSnap.id}:`, err);
    }

    try {
      await db.collection('notifications').add({
        userId: appointment.patientId,
        message: `Your appointment on ${friendlyDate} has been cancelled because Dr. ${appointment.doctorName} is on leave.`,
        type: 'appointment_cancelled',
        appointmentId: docSnap.id,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error(`Failed to notify patient for leave-cancelled appointment ${docSnap.id}:`, err);
    }

    try {
      const existing = appointment.calendarEventIds || {};
      if (existing.patient) await deleteEventForUser(appointment.patientId, existing.patient);
      if (existing.doctor) await deleteEventForUser(appointment.doctorId, existing.doctor);
      if (existing.patient || existing.doctor) {
        await docSnap.ref.set({ calendarEventIds: {} }, { merge: true });
      }
    } catch (err) {
      console.error(`Failed to remove calendar events for leave-cancelled appointment ${docSnap.id}:`, err);
    }
  }

  return { cancelled, scanned: candidates.length };
}
