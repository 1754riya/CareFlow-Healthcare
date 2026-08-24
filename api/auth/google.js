import { requireAuthenticatedUser } from '../lib/firebaseAdmin.js';
import {
  exchangeCodeForTokens, saveUserCalendarTokens,
  getUserCalendarConnection, removeUserCalendarTokens,
} from '../lib/googleCalendar.js';

/**
 * Consolidated Google Calendar OAuth endpoint — combines the former
 * api/auth/google/exchange.js, api/auth/google/status.js, and
 * api/auth/google/disconnect.js into one Serverless Function, to stay under
 * the Vercel Hobby plan's 12-function limit. vercel.json rewrites all three
 * original routes to this file with a distinct ?action= query param; the
 * client-visible URLs and request/response bodies are unchanged. Each
 * branch below is the original handler's logic, unmodified.
 */
export default async function handler(req, res) {
  const { action } = req.query;

  if (action === 'exchange') return handleExchange(req, res);
  if (action === 'status') return handleStatus(req, res);
  if (action === 'disconnect') return handleDisconnect(req, res);

  res.status(404).json({ error: 'Unknown action' });
}

async function handleExchange(req, res) {
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

async function handleStatus(req, res) {
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

async function handleDisconnect(req, res) {
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
