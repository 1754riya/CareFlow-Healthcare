/**
 * One-time CLI to grant the admin role to a user, by creating an
 * `admins/{uid}` Firestore document (the same "role via collection
 * membership" pattern already used for patients/{uid} and doctors/{uid}).
 *
 * There is deliberately no public signup path for admins — this script,
 * run by a developer/operator with the service account key, is the only
 * way to create one.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT_KEY=<base64 service account json> \
 *     node scripts/grantAdmin.js someone@example.com [password]
 *
 * If the email doesn't have a Firebase Auth account yet, pass a password
 * (min 6 chars) as the second argument to create one. If the account
 * already exists (e.g. they signed up as a patient), omit it.
 */
import { getAdminAuth, getAdminDb } from '../api/_lib/firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

async function main() {
  const [, , email, password] = process.argv;
  if (!email) {
    console.error('Usage: node scripts/grantAdmin.js <email> [password]');
    process.exit(1);
  }

  const auth = getAdminAuth();
  let user;
  try {
    user = await auth.getUserByEmail(email);
    console.log(`Found existing account for ${email} (uid: ${user.uid})`);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    if (!password) {
      console.error(`No account exists for ${email}. Pass a password as the 2nd argument to create one.`);
      process.exit(1);
    }
    if (password.length < 6) {
      console.error('Password must be at least 6 characters.');
      process.exit(1);
    }
    user = await auth.createUser({ email, password });
    console.log(`Created new account for ${email} (uid: ${user.uid})`);
  }

  await getAdminDb().collection('admins').doc(user.uid).set({
    uid: user.uid,
    email,
    role: 'admin',
    createdAt: FieldValue.serverTimestamp(),
  });

  console.log(`✔ ${email} is now an admin. They can log in at /login and will land on /admin.`);
}

main().catch(err => {
  console.error('Failed to grant admin role:', err);
  process.exit(1);
});
