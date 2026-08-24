// Fixed allow-list of doctors CareFlow displays and allows booking with, hand-picked
// from the `doctors` Firestore collection shared with JeevanChakkar. CareFlow's
// search, doctor profile, admin listing, and booking API must all filter through
// this list so the rest of the shared collection is never read/written by CareFlow.
export const CAREFLOW_DOCTOR_IDS = [
  '0007672a976e9316eb10', // Yatin Kukreja — General Physician, Delhi
  '00882fef0c8782caa64d', // Sharmila Nayak — Dermatologist, Mumbai
  '00ae1dbe3df34bd7f910', // Richa Malik — Pediatrician, Delhi
  '00c1c6ce51896f5c0395', // Ekta Gupta — Dentist, Gurgaon
  '010d16d35cd895041ae9', // Sengottu Velu — Cardiologist, Chennai
];
