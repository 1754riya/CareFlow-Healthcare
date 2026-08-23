import { format } from 'date-fns';
import { getAdminDb } from './firebaseAdmin.js';

/**
 * Loads an appointment doc and verifies the authenticated caller is either
 * the patient or the doctor on it. Throws an Error with a `.status` for the
 * caller to translate into an HTTP response.
 */
export async function loadAuthorizedAppointment(appointmentId, callerUid) {
  const ref = getAdminDb().collection('appointments').doc(appointmentId);
  const snap = await ref.get();

  if (!snap.exists) {
    const err = new Error('Appointment not found');
    err.status = 404;
    throw err;
  }

  const appointment = snap.data();
  if (callerUid !== appointment.patientId && callerUid !== appointment.doctorId) {
    const err = new Error('Not authorized for this appointment');
    err.status = 403;
    throw err;
  }

  return { ref, appointment };
}

/** Maps a stored appointment doc into the shape googleCalendar.js's event builder expects. */
export function toCalendarAppointmentData(appointment) {
  return {
    doctorName:      appointment.doctorName,
    patientName:     appointment.patientName,
    doctorSpecialty: appointment.doctorSpecialty || '',
    date:            appointment.date?.toDate ? appointment.date.toDate() : new Date(appointment.date),
    timeSlot:        appointment.timeSlot,
    symptoms:        appointment.symptoms || '',
    symptomDuration: appointment.symptomDuration || '',
    severity:        appointment.severity || '',
    additionalInfo:  appointment.additionalInfo || '',
  };
}

/** Maps a stored appointment doc into the shape appointmentEmailTemplate.js's
 *  builders expect (same field names as the existing confirmation email
 *  payload, with `date` pre-formatted as a string). */
export function toEmailAppointmentData(appointment) {
  const date = appointment.date?.toDate ? appointment.date.toDate() : new Date(appointment.date);
  return {
    doctorName:      appointment.doctorName,
    patientName:     appointment.patientName,
    doctorSpecialty: appointment.doctorSpecialty || '',
    date:            format(date, 'MMM d, yyyy'),
    timeSlot:        appointment.timeSlot,
    symptoms:        appointment.symptoms || '',
    symptomDuration: appointment.symptomDuration || '',
    severity:        appointment.severity || '',
    additionalInfo:  appointment.additionalInfo || '',
  };
}
