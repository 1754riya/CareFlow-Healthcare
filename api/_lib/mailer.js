import nodemailer from 'nodemailer';

let cachedTransporter = null;

/**
 * Reusable Nodemailer transporter, built from environment variables.
 * Cached across invocations within the same serverless instance.
 *
 * Only EMAIL_USER / EMAIL_PASSWORD are required — HOST/PORT default to
 * Gmail's SMTP submission endpoint so a bare Gmail App Password works
 * out of the box, but both stay overridable for any other SMTP provider.
 */
export function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const {
    EMAIL_HOST = 'smtp.gmail.com',
    EMAIL_PORT = '587',
    EMAIL_USER,
    EMAIL_PASSWORD,
  } = process.env;

  if (!EMAIL_USER || !EMAIL_PASSWORD) {
    throw new Error('Email service is not configured: missing EMAIL_USER/EMAIL_PASSWORD.');
  }

  cachedTransporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: Number(EMAIL_PORT),
    secure: Number(EMAIL_PORT) === 465,
    auth: { user: EMAIL_USER, pass: EMAIL_PASSWORD },
  });

  return cachedTransporter;
}

/**
 * Send a single email. Throws on failure — callers decide how to handle it.
 */
export async function sendMail({ to, subject, html }) {
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  const fromName = process.env.EMAIL_FROM_NAME || 'CareFlow';

  const transporter = getTransporter();
  return transporter.sendMail({ from: `${fromName} <${fromAddress}>`, to, subject, html });
}
