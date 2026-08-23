import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin } from '../lib/requireAdmin.js';
import { getAdminAuth, getAdminDb } from '../lib/firebaseAdmin.js';

const generateSearchKeywords = (name, specialty) => {
  const words = [...name.toLowerCase().split(' '), ...specialty.toLowerCase().split(' ')];
  return [...new Set([name.toLowerCase(), specialty.toLowerCase(), ...words])];
};

/**
 * Admin-only: provisions a brand new doctor — a Firebase Auth account plus
 * its `doctors/{uid}` Firestore document, using the same fields the doctor
 * self-signup flow writes (src/signup/signup.jsx). Done server-side with the
 * Admin SDK because creating a user with the client SDK would sign the
 * *admin* out and sign them in as the new doctor.
 */
export default async function handler(req, res) {
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
