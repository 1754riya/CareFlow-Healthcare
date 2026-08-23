import { useState, useEffect, useMemo, useCallback } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { doc, getDoc, collection, query, where, onSnapshot } from '@firebase/firestore';
import { format } from 'date-fns';
import { X, CalendarClock } from 'lucide-react';
import { db } from '../firebase/config';
import { authorizedFetch } from '../utils/authorizedFetch';
import { updateCalendarEventsForAppointment } from '../utils/calendarSync';
import { getAvailableSlots, getBookedSlotsForDate, toDateKey } from '../utils/slotGeneration';

/**
 * Lets the patient move an existing appointment to a new date/time. Reuses
 * the same slot-availability logic as booking (src/utils/slotGeneration.js)
 * for the calendar/slot picker, and the authoritative server-side re-check
 * lives in api/reschedule-appointment.js (mirroring api/book-appointment.js).
 * Does not touch symptoms/prescription/consultation data — only date/timeSlot.
 */
export default function RescheduleModal({ appointment, onClose, onRescheduled }) {
  const [doctor, setDoctor] = useState(null);
  const [doctorAppointments, setDoctorAppointments] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getDoc(doc(db, 'doctors', appointment.doctorId)).then(snap => {
      if (snap.exists()) setDoctor({ id: snap.id, ...snap.data() });
    });
  }, [appointment.doctorId]);

  useEffect(() => {
    const q = query(collection(db, 'appointments'), where('doctorId', '==', appointment.doctorId));
    const unsub = onSnapshot(q, snap => {
      // Exclude this appointment itself — it's vacating its current slot, not occupying it twice.
      setDoctorAppointments(snap.docs.filter(d => d.id !== appointment.id).map(d => d.data()));
    });
    return () => unsub();
  }, [appointment.doctorId, appointment.id]);

  const slotDuration = doctor?.slotDuration || 60;

  const computeSlotsFor = useCallback((date) => {
    if (!date || !doctor) return [];
    const bookedSlots = getBookedSlotsForDate(doctorAppointments, toDateKey(date));
    return getAvailableSlots({
      availability: doctor.availability,
      blockedDates: doctor.blockedDates,
      date,
      bookedSlots,
      slotDuration,
    });
  }, [doctor, doctorAppointments, slotDuration]);

  const availableSlots = useMemo(() => computeSlotsFor(selectedDate), [selectedDate, computeSlotsFor]);
  const isTileDisabled = ({ date, view }) => view === 'month' && computeSlotsFor(date).length === 0;

  const handleConfirm = async () => {
    if (!selectedDate || !selectedSlot) return;
    setSaving(true);
    setError('');
    try {
      await authorizedFetch('/api/reschedule-appointment', {
        method: 'POST',
        body: JSON.stringify({
          appointmentId: appointment.id,
          dateKey: toDateKey(selectedDate),
          timeSlot: selectedSlot,
        }),
      });
      // Fire-and-forget: sync the existing Calendar events to the new time
      // instead of creating duplicates. Never blocks/reverts the reschedule.
      updateCalendarEventsForAppointment(appointment.id);
      onRescheduled();
    } catch (err) {
      setError(err.message || 'Failed to reschedule. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const currentStart = appointment.startTime instanceof Date ? appointment.startTime : new Date(appointment.startTime);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-blue-500" /> Reschedule
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Currently {format(currentStart, 'EEEE, MMMM d, yyyy')} at {appointment.timeSlot}
        </p>

        {!doctor ? (
          <div className="py-8 text-center text-sm text-gray-400">Loading availability...</div>
        ) : (
          <>
            <div className="rounded-xl overflow-hidden mb-4">
              <Calendar
                onChange={(d) => { setSelectedDate(d); setSelectedSlot(null); }}
                value={selectedDate}
                minDate={new Date()}
                tileDisabled={isTileDisabled}
                className="w-full"
              />
            </div>

            {selectedDate && (
              availableSlots.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {availableSlots.map(slot => (
                    <button
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      className={`p-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                        selectedSlot === slot
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                          : 'border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-200 hover:border-blue-300'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">No available slots for this date.</p>
              )
            )}

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={saving || !selectedSlot}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
              >
                {saving ? 'Rescheduling...' : 'Confirm'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
