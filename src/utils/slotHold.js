import { authorizedFetch } from './authorizedFetch';

/**
 * Creates a 5-minute hold on a slot. Unlike the fire-and-forget calendar/
 * email helpers, this MUST be awaited — the caller (clicking "Continue")
 * needs to know whether it succeeded before moving on to the symptoms form,
 * and must surface a 409 ("already held by another patient") to the user.
 */
export async function holdSlot(doctorId, dateKey, timeSlot) {
  return authorizedFetch('/api/hold-slot', {
    method: 'POST',
    body: JSON.stringify({ doctorId, dateKey, timeSlot }),
  });
}

/**
 * Best-effort release of a hold — called when the patient goes back or
 * abandons the booking flow before confirming. Never throws: releasing a
 * hold is a courtesy to other patients, not something that should ever
 * interrupt the current one. If this never fires (closed tab, crash), the
 * hold simply expires on its own in a few minutes.
 */
export async function releaseSlotHold(doctorId, dateKey, timeSlot) {
  try {
    await authorizedFetch('/api/release-slot-hold', {
      method: 'POST',
      body: JSON.stringify({ doctorId, dateKey, timeSlot }),
    });
  } catch (err) {
    console.error('Failed to release slot hold:', err);
  }
}
