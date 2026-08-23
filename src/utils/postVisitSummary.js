import { authorizedFetch } from './authorizedFetch';

/**
 * Fire-and-forget call to generate the AI post-visit summary. Must only be
 * called AFTER the appointment has already been marked completed — a
 * failure here never blocks or reverts that completion.
 */
export async function generatePostVisitSummaryForAppointment(appointmentId) {
  try {
    await authorizedFetch('/api/post-visit-summary', {
      method: 'POST',
      body: JSON.stringify({ appointmentId }),
    });
  } catch (err) {
    console.error('Post-visit summary generation failed:', err);
  }
}
