import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebaseAdmin.js';
import { sendMail } from './mailer.js';

export const MAX_EMAIL_ATTEMPTS = 5;

/**
 * Sends an email via the existing mailer.sendMail() (unchanged) and, if it
 * fails, records it in the `emailQueue` Firestore collection so the daily
 * retry cron (api/cron.js's retry-failed-emails job) can pick it up later.
 *
 * Never throws — a failure here is recorded, not propagated, so nothing
 * that triggers an email (appointment cancellation, a reminder sweep) can
 * ever be blocked or reverted by an email problem.
 */
export async function sendTrackedEmail({ type, to, subject, html, appointmentId, recipientRole }) {
  try {
    await sendMail({ to, subject, html });
    return { ok: true };
  } catch (err) {
    try {
      await getAdminDb().collection('emailQueue').add({
        type, to, subject, html, appointmentId, recipientRole,
        status: 'pending',
        attempts: 1,
        lastError: err.message,
        createdAt: FieldValue.serverTimestamp(),
        sentAt: null,
      });
    } catch (queueErr) {
      console.error('Failed to queue failed email for retry:', queueErr);
    }
    return { ok: false, error: err.message };
  }
}
