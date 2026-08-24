import { requireAuthenticatedUser, getAdminDb } from './firebaseAdmin.js';

/**
 * Verifies the request's Firebase ID token AND that the caller has an
 * `admins/{uid}` Firestore document. Throws (with .status) if either check
 * fails. Used by every /api/admin/* route so admin-only writes are enforced
 * server-side rather than relying on client-side UI gating alone.
 */
export async function requireAdmin(req) {
  const decoded = await requireAuthenticatedUser(req);
  const snap = await getAdminDb().collection('admins').doc(decoded.uid).get();
  if (!snap.exists) {
    const err = new Error('Forbidden: admin access required.');
    err.status = 403;
    throw err;
  }
  return decoded;
}
