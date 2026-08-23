import { FieldValue } from 'firebase-admin/firestore';
import { requireAuthenticatedUser, getAdminDb } from './lib/firebaseAdmin.js';
import { loadAuthorizedAppointment } from './lib/appointmentAccess.js';
import { buildReminderSchedule } from '../src/utils/medicationReminders.js';
import { toDateKey } from '../src/utils/slotGeneration.js';

/**
 * Best-effort: turns a just-completed appointment's prescription into
 * medicationReminders schedule docs (one per medicine whose frequency and
 * duration can be parsed — see buildReminderSchedule). Called by the doctor's
 * client right after it has already marked the appointment completed
 * (PatientSidebar.jsx) — this endpoint never affects that completion.
 * Idempotent: re-invoking for the same appointment is a no-op.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let decoded;
  try {
    decoded = await requireAuthenticatedUser(req);
  } catch {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const { appointmentId } = req.body || {};
  if (!appointmentId) {
    res.status(400).json({ error: 'Missing appointmentId' });
    return;
  }

  try {
    const { appointment } = await loadAuthorizedAppointment(appointmentId, decoded.uid);

    if (decoded.uid !== appointment.doctorId) {
      res.status(403).json({ error: 'Only the treating doctor can create medication reminders.' });
      return;
    }
    // Reminders only ever make sense for a completed visit — this also
    // structurally guarantees none are created for a cancelled appointment.
    if (appointment.status !== 'completed') {
      res.status(400).json({ error: 'Reminders can only be created for a completed appointment.' });
      return;
    }

    const db = getAdminDb();
    const remindersRef = db.collection('medicationReminders');

    const existing = await remindersRef.where('appointmentId', '==', appointmentId).get();
    if (!existing.empty) {
      res.status(200).json({ success: true, remindersCreated: 0, alreadyExists: true });
      return;
    }

    const prescription = Array.isArray(appointment.prescription) ? appointment.prescription : [];
    const startDateKey = toDateKey(new Date());

    const skipped = [];
    const writes = [];
    for (const item of prescription) {
      const schedule = buildReminderSchedule({
        appointmentId,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        medicine: item.medicine,
        dosage: item.dosage,
        instructions: item.instructions,
        frequency: item.frequency,
        duration: item.duration,
        startDateKey,
      });
      if (!schedule) {
        skipped.push(item.medicine || '(unnamed medicine)');
        continue;
      }
      writes.push(remindersRef.doc().set({ ...schedule, createdAt: FieldValue.serverTimestamp() }));
    }

    await Promise.all(writes);

    res.status(200).json({ success: true, remindersCreated: writes.length, skipped });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Failed to create medication reminders.' });
  }
}
