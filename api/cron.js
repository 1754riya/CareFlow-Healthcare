import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './_lib/firebaseAdmin.js';
import { sendMail } from './_lib/mailer.js';
import { MAX_EMAIL_ATTEMPTS, sendTrackedEmail } from './_lib/emailQueue.js';
import { toEmailAppointmentData } from './_lib/appointmentAccess.js';
import { patientReminderEmail, doctorReminderEmail } from './_lib/appointmentEmailTemplate.js';
import { isReminderDueToday, isReminderExpired, buildReminderMessage } from '../src/utils/medicationReminders.js';
import { toDateKey } from '../src/utils/slotGeneration.js';

/**
 * Consolidated Vercel Cron endpoint — combines the former
 * api/cron/send-medication-reminders.js, api/cron/send-appointment-reminders.js,
 * and api/cron/retry-failed-emails.js into one Serverless Function, to stay
 * under the Vercel Hobby plan's 12-function limit. vercel.json rewrites each
 * of the three original cron paths (still the paths configured in
 * vercel.json's own "crons" schedule) to this file with a distinct ?job=
 * query param. Each branch below is the original handler's logic, unmodified.
 */
export default async function handler(req, res) {
  const { job } = req.query;

  if (job === 'send-medication-reminders') return handleMedicationReminders(req, res);
  if (job === 'send-appointment-reminders') return handleAppointmentReminders(req, res);
  if (job === 'retry-failed-emails') return handleRetryFailedEmails(req, res);

  res.status(404).json({ error: 'Unknown job' });
}

/** Shared by all three jobs — byte-identical to each original handler's own check. */
function isAuthorizedCronRequest(req, res) {
  if (process.env.CRON_SECRET) {
    const header = req.headers.authorization || '';
    if (header !== `Bearer ${process.env.CRON_SECRET}`) {
      res.status(401).json({ error: 'Not authorized' });
      return false;
    }
  }
  return true;
}

async function handleMedicationReminders(req, res) {
  if (!isAuthorizedCronRequest(req, res)) return;

  const db = getAdminDb();
  const todayKey = toDateKey(new Date());

  try {
    const snap = await db.collection('medicationReminders').where('status', '==', 'active').get();

    let sent = 0;
    let stopped = 0;
    const writes = [];

    snap.docs.forEach(docSnap => {
      const schedule = { id: docSnap.id, ...docSnap.data() };

      if (isReminderExpired(schedule, todayKey)) {
        writes.push(docSnap.ref.set({ status: 'completed' }, { merge: true }));
        stopped++;
        return;
      }

      if (isReminderDueToday(schedule, todayKey)) {
        const message = buildReminderMessage(schedule, todayKey);
        writes.push(
          db.collection('notifications').doc().set({
            userId: schedule.patientId,
            message,
            type: 'medication_reminder',
            appointmentId: schedule.appointmentId,
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          })
        );
        writes.push(docSnap.ref.set({ lastSentDate: todayKey }, { merge: true }));
        sent++;
      }
    });

    await Promise.all(writes);

    res.status(200).json({ success: true, sent, stopped });
  } catch (err) {
    console.error('Failed to send medication reminders:', err);
    res.status(500).json({ error: 'Failed to send medication reminders.' });
  }
}

async function handleAppointmentReminders(req, res) {
  if (!isAuthorizedCronRequest(req, res)) return;

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

async function handleRetryFailedEmails(req, res) {
  if (!isAuthorizedCronRequest(req, res)) return;

  const db = getAdminDb();

  try {
    const snap = await db.collection('emailQueue').where('status', '==', 'pending').get();

    let sent = 0;
    let stillPending = 0;
    let gaveUp = 0;
    const writes = [];

    for (const docSnap of snap.docs) {
      const job = docSnap.data();
      try {
        await sendMail({ to: job.to, subject: job.subject, html: job.html });
        writes.push(docSnap.ref.set({ status: 'sent', sentAt: FieldValue.serverTimestamp() }, { merge: true }));
        sent++;
      } catch (err) {
        const attempts = (job.attempts || 1) + 1;
        if (attempts >= MAX_EMAIL_ATTEMPTS) {
          writes.push(docSnap.ref.set({ status: 'failed', attempts, lastError: err.message }, { merge: true }));
          gaveUp++;
        } else {
          writes.push(docSnap.ref.set({ attempts, lastError: err.message }, { merge: true }));
          stillPending++;
        }
      }
    }

    await Promise.all(writes);
    res.status(200).json({ success: true, sent, stillPending, gaveUp });
  } catch (err) {
    console.error('Failed to retry queued emails:', err);
    res.status(500).json({ error: 'Failed to retry queued emails.' });
  }
}
