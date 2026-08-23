import { requireAuthenticatedUser } from '../../lib/firebaseAdmin.js';
import { removeUserCalendarTokens } from '../../lib/googleCalendar.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let decodedToken;
  try {
    decodedToken = await requireAuthenticatedUser(req);
  } catch {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    await removeUserCalendarTokens(decodedToken.uid);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Failed to disconnect Google Calendar:', err);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
}
