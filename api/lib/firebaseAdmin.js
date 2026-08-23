import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Firebase Admin SDK singleton, trusted server-side access used by every
 * /api route that needs to read/write Firestore for an arbitrary user
 * (bypassing client security rules) or verify a Firebase ID token.
 *
 * FIREBASE_SERVICE_ACCOUNT_KEY must be the service account JSON, base64-encoded.
 */
function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error('Server is not configured: missing FIREBASE_SERVICE_ACCOUNT_KEY.');
  }
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    // allow a raw (non-base64) JSON string too, for convenience in local dev
    return JSON.parse(raw);
  }
}

function getAdminApp() {
  const existing = getApps();
  if (existing.length > 0) return existing[0];
  return initializeApp({ credential: cert(getServiceAccount()) });
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

/**
 * Verifies the Firebase ID token from a request's Authorization header
 * ("Bearer <token>") and returns the decoded token (contains .uid).
 * Throws if missing/invalid.
 */
export async function requireAuthenticatedUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new Error('Missing Authorization bearer token.');
  return getAdminAuth().verifyIdToken(token);
}
