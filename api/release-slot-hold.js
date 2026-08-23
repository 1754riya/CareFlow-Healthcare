import { requireAuthenticatedUser, getAdminDb } from './lib/firebaseAdmin.js';

/**
 * Best-effort release of a hold the caller created — called when the
 * patient goes back or leaves the booking flow before confirming ("where
 * practical"; a closed tab or crashed browser won't reach this, which is
 * fine, since the hold's own expiresAt already handles that case with no
 * cleanup job needed). Only ever deletes a hold that belongs to the caller.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let decoded;
  try {
    decoded = await requireAuthenticatedUser(req);
  } catch {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const { doctorId, dateKey, timeSlot } = req.body || {};
  if (!doctorId || !dateKey || !timeSlot) {
    res.status(400).json({ error: 'Missing doctorId, dateKey or timeSlot' });
    return;
  }

  try {
    const holdRef = getAdminDb().collection('slotHolds').doc(`${doctorId}_${dateKey}_${timeSlot}`);
    const snap = await holdRef.get();
    if (snap.exists && snap.data().patientId === decoded.uid) {
      await holdRef.delete();
    }
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Failed to release slot hold:', err);
    res.status(500).json({ error: 'Failed to release slot hold.' });
  }
}
