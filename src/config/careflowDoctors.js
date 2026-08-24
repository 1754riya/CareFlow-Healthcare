// Central list of the 5 doctors in CareFlow's own clinic setup — the single
// source of truth for search, doctor profiles, and booking. Seeded into
// CareFlow's own Firestore `doctors` collection (project careflow-7c8d3) by
// scripts/seedCareflowDoctors.js; CAREFLOW_DOCTOR_IDS below is what the
// search/profile/booking code filters against.

const DEFAULT_AVAILABILITY = {
  Monday:    ['9:00 AM', '10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM', '4:00 PM'],
  Wednesday: ['9:00 AM', '10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM', '4:00 PM'],
  Friday:    ['9:00 AM', '10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM', '4:00 PM'],
};

function buildKeywords(firstName, lastName, specialty, location) {
  const tokens = [firstName, lastName, specialty, location]
    .filter(Boolean)
    .flatMap(text => text.toLowerCase().split(/\s+/));
  const fullName = `${firstName} ${lastName}`.trim().toLowerCase();
  return [...new Set([fullName, specialty.toLowerCase(), ...tokens])];
}

function buildDoctor({ id, firstName, lastName, qualifications, specialty, about, location, clinicName, fee, experience }) {
  return {
    id,
    firstName,
    lastName,
    specialty,
    qualifications,
    about,
    location,
    clinicName,
    fee,
    experience,
    avgRating: 0,
    totalRatings: 0,
    verified: true,
    active: true,
    image: '',
    availability: DEFAULT_AVAILABILITY,
    blockedDates: [],
    slotDuration: 60,
    searchKeywords: buildKeywords(firstName, lastName, specialty, location),
  };
}

export const CAREFLOW_DOCTORS = [
  buildDoctor({
    id: 'dr-vinay-sakhuja',
    firstName: 'Vinay',
    lastName: 'Sakhuja',
    qualifications: 'MBBS, MD - Medicine, DM - Nephrology',
    specialty: 'Nephrologist',
    about: 'Nephrologist/Renal Specialist with 44 years of experience.',
    location: 'Mohali',
    clinicName: 'Phase-VI, Mohali',
    fee: 1200,
    experience: 44,
  }),
  buildDoctor({
    id: 'dr-gaurav-saini',
    firstName: 'Gaurav',
    lastName: 'Saini',
    qualifications: 'MBBS, MS - Orthopaedics',
    specialty: 'Orthopedist',
    about: 'Orthopedic Surgeon with 18 years of experience.',
    location: 'Mohali',
    clinicName: 'Phase-VI, Mohali',
    fee: 1100,
    experience: 18,
  }),
  buildDoctor({
    id: 'dr-munish-chauhan',
    firstName: 'Munish',
    lastName: 'Chauhan',
    qualifications: 'MBBS, MD - General Medicine, DM - Nephrology',
    specialty: 'Nephrologist',
    about: 'Nephrologist/Renal Specialist with 21 years of experience.',
    location: 'Mohali',
    clinicName: 'Phase-VI, Mohali',
    fee: 1200,
    experience: 21,
  }),
  buildDoctor({
    id: 'dr-jasmeet-singh',
    firstName: 'Jasmeet',
    lastName: 'Singh',
    qualifications: 'MBBS, DNB - General Medicine',
    specialty: 'General Physician',
    about: 'Internal Medicine, General Physician, Consultant Physician with 22 years of experience. Doctor Popularity Score: 100%, based on 30 patient visits.',
    location: 'Mohali',
    clinicName: 'Sector-68, Mohali',
    fee: 500,
    experience: 22,
  }),
  buildDoctor({
    id: 'dr-shikha-verma',
    firstName: 'Shikha',
    lastName: 'Verma',
    qualifications: 'DNB - Dermatology & Venereology, MD - Dermatology, Venereology & Leprosy, MBBS',
    specialty: 'Dermatologist',
    about: 'Dermatologist, Venereologist, Aesthetic Dermatologist with 28 years of experience. Doctor Popularity Score: 99%, based on 515 patient visits.',
    location: 'Mohali',
    clinicName: 'Sector-69, Mohali',
    fee: 600,
    experience: 28,
  }),
];

export const CAREFLOW_DOCTOR_IDS = CAREFLOW_DOCTORS.map(d => d.id);
