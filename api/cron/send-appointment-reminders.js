import { getAdminDb } from '../lib/firebaseAdmin.js';
import { toEmailAppointmentData } from '../lib/appointmentAccess.js';
import { patientReminderEmail, doctorReminderEmail } from '../lib/appointmentEmailTemplate.js';
import { sendTrackedEmail } from '../lib/emailQueue.js';
import { toDateKey } from '../../src/utils/slotGeneration.js';

/**
 * Vercel Cron (see vercel.json — runs once daily; Vercel's Hobby plan does
 * not allow finer-grained schedules). Sends a reminder email to the patient
 * and doctor for every confirmed appointment happening tomorrow. Guarded by
 * a `reminderSent` flag on the appointment doc so a given appointment is
 * only ever reminded once, even if this cron somehow fires more than once
 * on the same day. Failed sends are queued for retry (sendTrackedEmail) —
 * this never throws, so one bad address can't stop the rest of the sweep.
 */
export default async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const header = req.headers.authorization || '';
    if (header !== `Bearer ${process.env.CRON_SECRET}`) {
      res.status(401).json({ error: 'Not authorized' });
      return;
    }
  }

  const db = getAdminDb();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = toDateKey(tomorrow);

  try {
    const snap = await db.collection('appointments').where('status', '==', 'confirmed').get();

    let reminded = 0;
    const writes = [];

    for (const docSnap of snap.docs) {
      const appointment = docSnap.data();
      if (appointment.reminderSent) continue;

      const apptDate = appointment.date?.toDate ? appointment.date.toDate() : new Date(appointment.date);
      if (toDateKey(apptDate) !== tomorrowKey) continue;

      const [patientSnap, doctorSnap] = await Promise.all([
        db.collection('patients').doc(appointment.patientId).get(),
        db.collection('doctors').doc(appointment.doctorId).get(),
      ]);
      const patientEmail = patientSnap.exists ? patientSnap.data().email : null;
      const doctorEmail = doctorSnap.exists ? doctorSnap.data().email : null;

      const data = toEmailAppointmentData(appointment);
      const sends = [];
      if (patientEmail) {
        const { subject, html } = patientReminderEmail(data);
        sends.push(sendTrackedEmail({ type: 'reminder', to: patientEmail, subject, html, appointmentId: docSnap.id, recipientRole: 'patient' }));
      }
      if (doctorEmail) {
        const { subject, html } = doctorReminderEmail(data);
        sends.push(sendTrackedEmail({ type: 'reminder', to: doctorEmail, subject, html, appointmentId: docSnap.id, recipientRole: 'doctor' }));
      }
      await Promise.all(sends);

      writes.push(docSnap.ref.set({ reminderSent: true }, { merge: true }));
      reminded++;
    }

    await Promise.all(writes);
    res.status(200).json({ success: true, reminded });
  } catch (err) {
    console.error('Failed to send appointment reminders:', err);
    res.status(500).json({ error: 'Failed to send appointment reminders.' });
  }
}
