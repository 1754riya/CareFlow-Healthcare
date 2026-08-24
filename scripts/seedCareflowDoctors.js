/**
 * One-time/idempotent seed for CareFlow's 5-doctor clinic setup, from the
 * single source of truth at src/config/careflowDoctors.js. Upserts each
 * doctor into CareFlow's own Firestore `doctors` collection (project
 * careflow-7c8d3) by fixed id — safe to re-run.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT_KEY=<base64 service account json> \
 *     node scripts/seedCareflowDoctors.js
 */
import { getAdminDb } from '../api/_lib/firebaseAdmin.js';
import { CAREFLOW_DOCTORS } from '../src/config/careflowDoctors.js';

async function main() {
  const db = getAdminDb();
  const batch = db.batch();

  for (const { id, ...doctor } of CAREFLOW_DOCTORS) {
    batch.set(db.collection('doctors').doc(id), doctor, { merge: true });
  }

  await batch.commit();
  console.log(`✔ Seeded ${CAREFLOW_DOCTORS.length} doctors into CareFlow's 'doctors' collection.`);
  for (const d of CAREFLOW_DOCTORS) {
    console.log(`  - ${d.id}: Dr. ${d.firstName} ${d.lastName} (${d.specialty})`);
  }
}

main().catch(err => {
  console.error('Failed to seed CareFlow doctors:', err);
  process.exit(1);
});
