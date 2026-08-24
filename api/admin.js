import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin } from './lib/requireAdmin.js';
import { getAdminAuth, getAdminDb } from './lib/firebaseAdmin.js';
import { cancelAppointmentsForDoctorLeave } from './lib/doctorLeave.js';

const generateSearchKeywords = (name, specialty) => {
  const words = [...name.toLowerCase().split(' '), ...specialty.toLowerCase().split(' ')];
  return [...new Set([name.toLowerCase(), specialty.toLowerCase(), ...words])];
};

// Fields an admin is allowed to change on a doctor document. Anything else
// in the request body is silently dropped rather than merged into Firestore.
const ALLOWED_FIELDS = [
  'firstName', 'lastName', 'name', 'specialty', 'location', 'experience',
  'licenseNumber', 'clinicName', 'about', 'fee', 'image',
  'active', 'verified',
  'availability', 'blockedDates', 'slotDuration',
];

/**
 * Consolidated admin endpoint — combines the former
 * api/admin/create-doctor.js and api/admin/update-doctor.js into one
 * Serverless Function, to stay under the Vercel Hobby plan's 12-function
 * limit. vercel.json rewrites both original routes to this file with a
 * distinct ?action= query param; the client-visible URLs and
 * request/response bodies are unchanged. Each branch below is the original
 * handler's logic, unmodified.
 */
export default async function handler(req, res) {
  const { action } = req.query;

  if (action === 'create-doctor') return handleCreateDoctor(req, res);
  if (action === 'update-doctor') return handleUpdateDoctor(req, res);

  res.status(404).json({ error: 'Unknown action' });
}

/**
 * Admin-only: provisions a brand new doctor — a Firebase Auth account plus
 * its `doctors/{uid}` Firestore document, using the same fields the doctor
 * self-signup flow writes (src/signup/signup.jsx). Done server-side with the
 * Admin SDK because creating a user with the client SDK would sign the
 * *admin* out and sign them in as the new doctor.
 */
async function handleCreateDoctor(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    await requireAdmin(req);
  } catch (err) {
    res.status(err.status || 401).json({ error: err.message });
    return;
  }

  const {
    email, password, firstName, lastName, specialty,
    location, experience, licenseNumber, clinicName, about, fee,
  } = req.body || {};

  if (!email || !password || !firstName || !lastName || !specialty) {
    res.status(400).json({ error: 'email, password, firstName, lastName and specialty are required.' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }

  const name = `${firstName} ${lastName}`.trim();

  try {
    const userRecord = await getAdminAuth().createUser({ email, password, displayName: name });

    const doctorData = {
      uid: userRecord.uid,
      firstName,
      lastName,
      name,
      email,
      role: 'doctor',
      specialty,
      location: location || '',
      experience: experience ? Number(experience) : null,
      licenseNumber: licenseNumber || null,
      clinicName: clinicName || '',
      about: about || '',
      fee: fee ? Number(fee) : 500,
      image: '',
      verified: true,
      active: true,
      avgRating: 0,
      totalRatings: 0,
      availability: {},
      blockedDates: [],
      slotDuration: 60,
      searchKeywords: generateSearchKeywords(name, specialty),
      createdAt: FieldValue.serverTimestamp(),
      createdByAdmin: true,
    };

    await getAdminDb().collection('doctors').doc(userRecord.uid).set(doctorData);

    res.status(200).json({ success: true, uid: userRecord.uid });
  } catch (err) {
    console.error('Failed to create doctor:', err);
    if (err.code === 'auth/email-already-exists') {
      res.status(409).json({ error: 'A user with this email already exists.' });
      return;
    }
    res.status(500).json({ error: err.message || 'Failed to create doctor.' });
  }
}

/**
 * Admin-only: single generic endpoint for every doctor mutation the Admin
 * Dashboard performs — editing profile fields, activate/deactivate,
 * specialization, working days/hours (availability), slot duration, and
 * leave dates (blockedDates). Body: { doctorId, updates: { ...partial } }.
 */
async function handleUpdateDoctor(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    await requireAdmin(req);
  } catch (err) {
    res.status(err.status || 401).json({ error: err.message });
    return;
  }

  const { doctorId, updates } = req.body || {};
  if (!doctorId || !updates || typeof updates !== 'object') {
    res.status(400).json({ error: 'Missing doctorId or updates' });
    return;
  }

  const safeUpdates = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in updates) safeUpdates[key] = updates[key];
  }
  if (Object.keys(safeUpdates).length === 0) {
    res.status(400).json({ error: 'No valid fields to update' });
    return;
  }

  const doctorRef = getAdminDb().collection('doctors').doc(doctorId);

  try {
    const snap = await doctorRef.get();
    if (!snap.exists) {
      res.status(404).json({ error: 'Doctor not found' });
      return;
    }
    const existing = snap.data() || {};

    // Keep searchKeywords (used by the patient-facing doctor search) in sync
    // whenever the name or specialty changes.
    if (safeUpdates.name || safeUpdates.firstName || safeUpdates.lastName || safeUpdates.specialty) {
      const name = safeUpdates.name
        ?? `${safeUpdates.firstName ?? existing.firstName ?? ''} ${safeUpdates.lastName ?? existing.lastName ?? ''}`.trim();
      const specialty = safeUpdates.specialty ?? existing.specialty ?? '';
      const words = [...name.toLowerCase().split(' '), ...specialty.toLowerCase().split(' ')];
      safeUpdates.searchKeywords = [...new Set([name.toLowerCase(), specialty.toLowerCase(), ...words])];
    }

    // Newly-added leave dates only — a date already present in the existing
    // blockedDates array was already processed the first time it was added,
    // so re-saving the same array (or a superset) never reprocesses it.
    // This, combined with cancelAppointmentsForDoctorLeave only ever acting
    // on still-'confirmed' appointments, is what makes repeating the leave
    // action a safe no-op (no duplicate cancellations/notifications/emails).
    let newlyBlockedDates = [];
    if (Array.isArray(safeUpdates.blockedDates)) {
      const previouslyBlocked = new Set(existing.blockedDates || []);
      newlyBlockedDates = safeUpdates.blockedDates.filter(d => !previouslyBlocked.has(d));
    }

    await doctorRef.set(safeUpdates, { merge: true });

    const leaveCancellations = {};
    for (const dateKey of newlyBlockedDates) {
      try {
        const result = await cancelAppointmentsForDoctorLeave(doctorId, dateKey);
        leaveCancellations[dateKey] = result.cancelled;
      } catch (err) {
        console.error(`Failed to process doctor leave conflicts for ${doctorId} on ${dateKey}:`, err);
        leaveCancellations[dateKey] = 'error';
      }
    }

    res.status(200).json({ success: true, ...(newlyBlockedDates.length > 0 ? { leaveCancellations } : {}) });
  } catch (err) {
    console.error('Failed to update doctor:', err);
    res.status(500).json({ error: 'Failed to update doctor' });
  }
}
