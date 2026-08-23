import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '../lib/firebaseAdmin.js';
import { isReminderDueToday, isReminderExpired, buildReminderMessage } from '../../src/utils/medicationReminders.js';
import { toDateKey } from '../../src/utils/slotGeneration.js';

/**
 * Vercel Cron (see vercel.json — runs once daily; Vercel's Hobby plan does
 * not allow finer-grained schedules). For every active medicationReminders
 * schedule: if its duration has elapsed, stop it (status -> 'completed', no
 * notification); otherwise, if today's dose hasn't been sent yet, deliver it
 * via the existing `notifications` collection (so it shows up in the
 * existing NotificationCenter with zero new patient-facing UI) and record
 * today as sent.
 */
export default async function handler(req, res) {
  // Vercel attaches `Authorization: Bearer $CRON_SECRET` to scheduled
  // invocations when CRON_SECRET is configured. Validated when set; if the
  // env var isn't configured yet, the endpoint stays reachable so this can
  // still be exercised/tested — CRON_SECRET should be added before relying
  // on this in production.
  if (process.env.CRON_SECRET) {
    const header = req.headers.authorization || '';
    if (header !== `Bearer ${process.env.CRON_SECRET}`) {
      res.status(401).json({ error: 'Not authorized' });
      return;
    }
  }

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
