import { authorizedFetch } from './authorizedFetch';

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

function waitForGoogleIdentityServices(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(window.google); return; }
    const start = Date.now();
    const interval = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(interval);
        resolve(window.google);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error('Google Sign-In script failed to load. Check your connection and try again.'));
      }
    }, 100);
  });
}

/**
 * Opens the Google consent popup, requesting Calendar access, and sends the
 * resulting one-time authorization code to the backend to be exchanged for
 * a refresh token (stored server-side, tied to the current Firebase user).
 */
export async function connectGoogleCalendar() {
  const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error('Google Calendar is not configured (missing VITE_GOOGLE_OAUTH_CLIENT_ID).');

  const google = await waitForGoogleIdentityServices();

  const code = await new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initCodeClient({
      client_id: clientId,
      scope: CALENDAR_SCOPE,
      ux_mode: 'popup',
      callback: (response) => {
        if (response.error) reject(new Error(response.error));
        else resolve(response.code);
      },
    });
    client.requestCode();
  });

  await authorizedFetch('/api/auth/google/exchange', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function disconnectGoogleCalendar() {
  await authorizedFetch('/api/auth/google/disconnect', { method: 'POST' });
}

export async function getGoogleCalendarStatus() {
  const { connected } = await authorizedFetch('/api/auth/google/status', { method: 'GET' });
  return connected;
}
