import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '../lib/firebaseAdmin.js';
import { sendMail } from '../lib/mailer.js';
import { MAX_EMAIL_ATTEMPTS } from '../lib/emailQueue.js';

/**
 * Vercel Cron (see vercel.json — runs once daily; Vercel's Hobby plan does
 * not allow finer-grained schedules). Retries every `emailQueue` doc with
 * status 'pending' (queued there by sendTrackedEmail after a send failure).
 * On success: status -> 'sent'. On repeated failure: attempts is
 * incremented, and once MAX_EMAIL_ATTEMPTS is reached the job is marked
 * 'failed' and stops being retried, so a permanently-bad address can't
 * retry forever.
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
