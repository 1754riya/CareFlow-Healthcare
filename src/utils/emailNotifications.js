import { authorizedFetch } from './authorizedFetch';

/**
 * Fire-and-forget appointment confirmation emails (patient + doctor).
 * Must only be called AFTER the appointment has been successfully created —
 * a failure here never rolls back or blocks the booking.
 */
export async function sendAppointmentConfirmationEmails(payload) {
  try {
    const res = await fetch('/api/send-appointment-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('Appointment confirmation email failed:', await res.text().catch(() => res.statusText));
    }
  } catch (err) {
    console.error('Appointment confirmation email failed:', err);
  }
}

/**
 * Fire-and-forget cancellation emails (patient + doctor). Must only be
 * called AFTER the appointment has already been marked cancelled — a
 * failure here never blocks or reverts that cancellation. Any send failure
 * is queued server-side for automatic retry, not just logged here.
 */
export async function sendCancellationEmails(appointmentId) {
  try {
    await authorizedFetch('/api/send-cancellation-email', {
      method: 'POST',
      body: JSON.stringify({ appointmentId }),
    });
  } catch (err) {
    console.error('Cancellation email failed:', err);
  }
}
