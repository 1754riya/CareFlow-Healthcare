import { auth } from '../firebase/config';

/** fetch() that attaches the current Firebase user's ID token as a Bearer token. */
export async function authorizedFetch(path, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('You must be logged in.');
  const idToken = await user.getIdToken();

  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}
