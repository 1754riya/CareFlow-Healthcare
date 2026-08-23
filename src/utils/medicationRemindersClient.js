import { authorizedFetch } from './authorizedFetch';

/**
 * Fire-and-forget call to create medication reminder schedules from a
 * just-completed appointment's prescription. Must only be called AFTER the
 * appointment has already been marked completed — a failure here never
 * blocks or reverts that completion.
 */
export async function createMedicationRemindersForAppointment(appointmentId) {
  try {
    await authorizedFetch('/api/create-medication-reminders', {
      method: 'POST',
      body: JSON.stringify({ appointmentId }),
    });
  } catch (err) {
    console.error('Medication reminder creation failed:', err);
  }
}
