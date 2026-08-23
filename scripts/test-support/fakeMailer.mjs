/**
 * In-memory stand-in for api/lib/mailer.js, used by test scripts (via the
 * module-resolution loader hook in firebaseAdminLoader.mjs) so REAL,
 * unmodified handlers that send email (api/send-cancellation-email.js,
 * api/cron/send-appointment-reminders.js, api/cron/retry-failed-emails.js,
 * api/lib/emailQueue.js) can be exercised without ever hitting real SMTP.
 */

const sentEmails = [];
let shouldFail = false;
let failureMessage = 'Simulated SMTP failure';

export function __reset() {
  sentEmails.length = 0;
  shouldFail = false;
  failureMessage = 'Simulated SMTP failure';
}
export function __setShouldFail(value, message) {
  shouldFail = value;
  if (message) failureMessage = message;
}
export function __getSentEmails() { return sentEmails; }
export function __sentTo(to) { return sentEmails.filter(e => e.to === to); }

export async function sendMail({ to, subject, html }) {
  if (shouldFail) throw new Error(failureMessage);
  sentEmails.push({ to, subject, html });
  return { messageId: `fake-${sentEmails.length}` };
}
