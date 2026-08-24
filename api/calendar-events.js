import { requireAuthenticatedUser } from './lib/firebaseAdmin.js';
import { loadAuthorizedAppointment, toCalendarAppointmentData } from './lib/appointmentAccess.js';
import { createEventForUser, updateEventForUser, deleteEventForUser } from './lib/googleCalendar.js';

/**
 * Consolidated Google Calendar event-sync endpoint — combines the former
 * api/create-calendar-events.js, api/update-calendar-events.js, and
 * api/delete-calendar-events.js into one Serverless Function, to stay under
 * the Vercel Hobby plan's 12-function limit. vercel.json rewrites each of
 * the three original routes to this file with a distinct ?action= query
 * param; the client-visible URLs and request/response bodies are unchanged.
 * Each branch below is the original handler's logic, unmodified.
 */
export default async function handler(req, res) {
  const { action } = req.query;

  if (action === 'create') return handleCreate(req, res);
  if (action === 'update') return handleUpdate(req, res);
  if (action === 'delete') return handleDelete(req, res);

  res.status(404).json({ error: 'Unknown action' });
}

async function handleCreate(req, res) {
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
    const { ref, appointment } = await loadAuthorizedAppointment(appointmentId, decoded.uid);

    // Idempotent: an event already recorded for a role is never re-created.
    const existing = appointment.calendarEventIds || {};
    const appointmentData = toCalendarAppointmentData(appointment);

    const updates = {};
    if (!existing.patient) {
      const id = await createEventForUser(appointment.patientId, appointmentData);
      if (id) updates.patient = id;
    }
    if (!existing.doctor) {
      const id = await createEventForUser(appointment.doctorId, appointmentData);
      if (id) updates.doctor = id;
    }

    if (Object.keys(updates).length > 0) {
      await ref.set({ calendarEventIds: { ...existing, ...updates } }, { merge: true });
    }

    res.status(200).json({ success: true, calendarEventIds: { ...existing, ...updates } });
  } catch (err) {
    console.error('Failed to create calendar events:', err);
    res.status(err.status || 502).json({ error: err.status ? err.message : 'Failed to create calendar events' });
  }
}

async function handleUpdate(req, res) {
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
    const { ref, appointment } = await loadAuthorizedAppointment(appointmentId, decoded.uid);

    const existing = appointment.calendarEventIds || {};
    const appointmentData = toCalendarAppointmentData(appointment);

    const updates = {};
    for (const [role, uid] of [['patient', appointment.patientId], ['doctor', appointment.doctorId]]) {
      const eventId = existing[role]
        ? await updateEventForUser(uid, existing[role], appointmentData)
        : await createEventForUser(uid, appointmentData);
      if (eventId) updates[role] = eventId;
    }

    if (Object.keys(updates).length > 0) {
      await ref.set({ calendarEventIds: { ...existing, ...updates } }, { merge: true });
    }

    res.status(200).json({ success: true, calendarEventIds: { ...existing, ...updates } });
  } catch (err) {
    console.error('Failed to update calendar events:', err);
    res.status(err.status || 502).json({ error: err.status ? err.message : 'Failed to update calendar events' });
  }
}

async function handleDelete(req, res) {
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
    const { ref, appointment } = await loadAuthorizedAppointment(appointmentId, decoded.uid);
    const existing = appointment.calendarEventIds || {};

    if (existing.patient) await deleteEventForUser(appointment.patientId, existing.patient);
    if (existing.doctor) await deleteEventForUser(appointment.doctorId, existing.doctor);

    if (existing.patient || existing.doctor) {
      await ref.set({ calendarEventIds: {} }, { merge: true });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Failed to delete calendar events:', err);
    res.status(err.status || 502).json({ error: err.status ? err.message : 'Failed to delete calendar events' });
  }
}
