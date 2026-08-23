import { requireAuthenticatedUser } from '../../lib/firebaseAdmin.js';
import { getUserCalendarConnection } from '../../lib/googleCalendar.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
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
    const connection = await getUserCalendarConnection(decodedToken.uid);
    res.status(200).json({ connected: !!connection?.refreshToken });
  } catch (err) {
    console.error('Failed to check Google Calendar status:', err);
    res.status(500).json({ error: 'Failed to check status' });
  }
}
