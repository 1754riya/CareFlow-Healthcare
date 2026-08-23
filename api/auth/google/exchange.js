import { requireAuthenticatedUser } from '../../lib/firebaseAdmin.js';
import { exchangeCodeForTokens, saveUserCalendarTokens } from '../../lib/googleCalendar.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let decodedToken;
  try {
    decodedToken = await requireAuthenticatedUser(req);
  } catch (err) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const { code } = req.body || {};
  if (!code) {
    res.status(400).json({ error: 'Missing authorization code' });
    return;
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await saveUserCalendarTokens(decodedToken.uid, tokens);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Google Calendar token exchange failed:', err);
    res.status(502).json({ error: 'Failed to connect Google Calendar' });
  }
}
