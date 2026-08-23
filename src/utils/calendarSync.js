import { authorizedFetch } from './authorizedFetch';

/**
 * Fire-and-forget Calendar sync calls. Must only be called AFTER the
 * appointment write they relate to has already succeeded in Firestore —
 * a failure here never blocks or reverts that write.
 */

export async function createCalendarEventsForAppointment(appointmentId) {
  try {
    await authorizedFetch('/api/create-calendar-events', {
      method: 'POST',
      body: JSON.stringify({ appointmentId }),
    });
  } catch (err) {
    console.error('Calendar event creation failed:', err);
  }
}

export async function deleteCalendarEventsForAppointment(appointmentId) {
  try {
    await authorizedFetch('/api/delete-calendar-events', {
      method: 'POST',
      body: JSON.stringify({ appointmentId }),
    });
  } catch (err) {
    console.error('Calendar event deletion failed:', err);
  }
}

/** Syncs existing Calendar events to the appointment's current date/time/details
 *  (e.g. after a reschedule) instead of creating duplicates. */
export async function updateCalendarEventsForAppointment(appointmentId) {
  try {
    await authorizedFetch('/api/update-calendar-events', {
      method: 'POST',
      body: JSON.stringify({ appointmentId }),
    });
  } catch (err) {
    console.error('Calendar event update failed:', err);
  }
}
