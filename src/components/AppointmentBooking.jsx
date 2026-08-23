import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { collection, query, where, onSnapshot } from '@firebase/firestore';
import { auth, db } from '../firebase/config';
import { useNavigate } from 'react-router-dom';
import { createNotification } from '../utils/notifications';
import { sendAppointmentConfirmationEmails } from '../utils/emailNotifications';
import { createCalendarEventsForAppointment } from '../utils/calendarSync';
import { authorizedFetch } from '../utils/authorizedFetch';
import { holdSlot, releaseSlotHold } from '../utils/slotHold';
import { getAvailableSlots, getBookedSlotsForDate, getActiveHeldSlotsForDate, toDateKey } from '../utils/slotGeneration';
import { format } from 'date-fns';
import { CheckCircle, CalendarX } from 'lucide-react';

const SEVERITY_OPTIONS = ['Mild', 'Moderate', 'Severe'];

const EMPTY_SYMPTOM_FORM = { symptoms: '', duration: '', severity: '', additionalInfo: '' };

const AppointmentBooking = ({ doctor, docid }) => {
  const [selectedDate, setSelectedDate]   = useState(null);
  const [showSlots, setShowSlots]         = useState(false);
  const [selectedSlot, setSelectedSlot]   = useState(null);
  const [stage, setStage]                 = useState('slots'); // 'slots' | 'symptoms'
  const [symptomForm, setSymptomForm]     = useState(EMPTY_SYMPTOM_FORM);
  const [formErrors, setFormErrors]       = useState({});
  const [isBooking, setIsBooking]         = useState(false);
  const [bookingError, setBookingError]   = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [doctorAppointments, setDoctorAppointments] = useState([]);
  const [doctorHolds, setDoctorHolds] = useState([]);
  const [heldSlotInfo, setHeldSlotInfo] = useState(null); // { dateKey, timeSlot } | null, while we hold a slot
  const [isHolding, setIsHolding] = useState(false);
  const navigate = useNavigate();

  const slotDuration = doctor.slotDuration || 60;

  /* Live appointments for this doctor, so the slot list reacts to bookings
     made in other tabs/by other patients while this widget is open. */
  useEffect(() => {
    if (!docid) return;
    const q = query(collection(db, 'appointments'), where('doctorId', '==', docid));
    const unsub = onSnapshot(q, snap => {
      setDoctorAppointments(snap.docs.map(d => d.data()));
    }, err => console.error('Failed to load doctor appointments:', err));
    return () => unsub();
  }, [docid]);

  /* Live slot holds for this doctor, so a slot another patient just claimed
     disappears from the list in real time (requirement: active holds from
     other patients make the slot unavailable). */
  useEffect(() => {
    if (!docid) return;
    const q = query(collection(db, 'slotHolds'), where('doctorId', '==', docid));
    const unsub = onSnapshot(q, snap => {
      setDoctorHolds(snap.docs.map(d => d.data()));
    }, err => console.error('Failed to load doctor slot holds:', err));
    return () => unsub();
  }, [docid]);

  /* Best-effort release if the patient navigates away/closes this widget
     while holding a slot ("where practical" — a closed tab won't reach
     this, which is fine since the hold expires on its own in 5 minutes). */
  const heldSlotRef = useRef(null);
  useEffect(() => { heldSlotRef.current = heldSlotInfo; }, [heldSlotInfo]);
  useEffect(() => {
    return () => {
      if (heldSlotRef.current) {
        releaseSlotHold(docid, heldSlotRef.current.dateKey, heldSlotRef.current.timeSlot);
      }
    };
  }, [docid]);

  const hasAnyAvailability = useMemo(
    () => Object.values(doctor.availability || {}).some(v => (Array.isArray(v) ? v.length > 0 : v?.slots?.length > 0)),
    [doctor.availability]
  );

  const computeSlotsFor = useCallback((date) => {
    if (!date) return [];
    const dateKey = toDateKey(date);
    const bookedSlots = getBookedSlotsForDate(doctorAppointments, dateKey);
    // Active holds from OTHER patients make a slot unavailable; our own
    // held slot stays selectable (we're already holding it).
    const heldSlots = getActiveHeldSlotsForDate(doctorHolds, dateKey, {
      excludePatientId: auth.currentUser?.uid,
    });
    return getAvailableSlots({
      availability: doctor.availability,
      blockedDates: doctor.blockedDates,
      date,
      bookedSlots,
      heldSlots,
      slotDuration,
    });
  }, [doctor.availability, doctor.blockedDates, doctorAppointments, doctorHolds, slotDuration]);

  const availableSlots = useMemo(() => computeSlotsFor(selectedDate), [selectedDate, computeSlotsFor]);

  /* Grey out calendar days that have no bookable slots at all (day off, on leave, or fully booked). */
  const isTileDisabled = ({ date, view }) => view === 'month' && computeSlotsFor(date).length === 0;

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setShowSlots(true);
    setSelectedSlot(null);
    setStage('slots');
    setSymptomForm(EMPTY_SYMPTOM_FORM);
    setFormErrors({});
    setBookingError('');
  };

  const handleContinueToSymptoms = async () => {
    if (!selectedSlot || !selectedDate) return;
    setIsHolding(true);
    setBookingError('');
    try {
      const dateKey = toDateKey(selectedDate);
      await holdSlot(docid, dateKey, selectedSlot);
      setHeldSlotInfo({ dateKey, timeSlot: selectedSlot });
      setStage('symptoms');
    } catch (err) {
      // Someone else grabbed it between selection and clicking Continue —
      // the live holds listener will already be removing it from the grid.
      setBookingError(err.message || 'That slot was just taken. Please choose another time.');
      setSelectedSlot(null);
    } finally {
      setIsHolding(false);
    }
  };

  /** Releases our hold (if any) and returns to slot selection. */
  const handleBackToSlots = () => {
    if (heldSlotInfo) {
      releaseSlotHold(docid, heldSlotInfo.dateKey, heldSlotInfo.timeSlot);
      setHeldSlotInfo(null);
    }
    setStage('slots');
  };

  const handleSymptomChange = (field) => (e) => {
    setSymptomForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const validateSymptomForm = () => {
    const errors = {};
    if (!symptomForm.symptoms.trim()) errors.symptoms = 'Please describe your symptoms.';
    if (!symptomForm.duration.trim()) errors.duration = 'Please specify how long this has been going on.';
    if (!symptomForm.severity) errors.severity = 'Please select a severity.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBooking = async () => {
    const user = auth.currentUser;
    if (!user) { setBookingError('Please log in to book an appointment.'); return; }
    if (!validateSymptomForm()) return;

    setIsBooking(true);
    setBookingError('');

    try {
      const dateStr = format(selectedDate, 'MMM d, yyyy');
      const doctorName = `${doctor.firstName} ${doctor.lastName}`;
      const patientName = user.displayName || user.email;

      /* Backend re-validates availability (working hours, leave dates, past
         time, and conflicts against other bookings — including ones made
         since this slot list was last computed) inside a transaction before
         creating the appointment, so a stale client-side view can never
         result in a double-booking. */
      const result = await authorizedFetch('/api/book-appointment', {
        method: 'POST',
        body: JSON.stringify({
          doctorId:        docid,
          dateKey:         toDateKey(selectedDate),
          timeSlot:        selectedSlot,
          symptoms:        symptomForm.symptoms.trim(),
          symptomDuration: symptomForm.duration.trim(),
          severity:        symptomForm.severity,
          additionalInfo:  symptomForm.additionalInfo.trim(),
        }),
      });
      const appointmentId = result.id;

      /* Notification → patient */
      await createNotification({
        userId:        user.uid,
        message:       `Your appointment with Dr. ${doctorName} on ${dateStr} at ${selectedSlot} is confirmed.`,
        type:          'appointment_confirmed',
        appointmentId,
      });

      /* Notification → doctor */
      await createNotification({
        userId:        docid,
        message:       `New appointment from ${patientName} on ${dateStr} at ${selectedSlot}.`,
        type:          'new_appointment',
        appointmentId,
      });

      // The server already deleted our hold as part of the booking transaction.
      setHeldSlotInfo(null);
      setShowSlots(false);
      setSelectedDate(null);
      setSelectedSlot(null);
      setStage('slots');
      setSymptomForm(EMPTY_SYMPTOM_FORM);
      setBookingSuccess(true);

      /*
       * Best-effort — never blocks or reverts the appointment that was just created.
       * patientEmail comes straight from the authenticated Firebase user, so it's
       * always present; doctorEmail depends on how that doctor's record was created
       * (bulk-imported doctors have none) and is handled independently server-side —
       * a missing doctor email must never suppress the patient's own confirmation.
       */
      if (user.email) {
        sendAppointmentConfirmationEmails({
          patientName,
          patientEmail:    user.email,
          doctorName,
          doctorEmail:     doctor.email || '',
          doctorSpecialty: doctor.specialty || '',
          date:            dateStr,
          timeSlot:        selectedSlot,
          symptoms:        symptomForm.symptoms.trim(),
          symptomDuration: symptomForm.duration.trim(),
          severity:        symptomForm.severity,
          additionalInfo:  symptomForm.additionalInfo.trim(),
        });
      }

      /* Also best-effort — a Calendar failure never blocks or reverts the appointment */
      createCalendarEventsForAppointment(appointmentId);
    } catch (error) {
      console.error('Error booking appointment:', error);
      if (error.message?.includes('no longer available') || error.message?.includes('held by another patient')) {
        setBookingError(error.message);
        setHeldSlotInfo(null); // the hold this refers to is no longer ours to release
        setStage('slots');
        setSelectedSlot(null);
      } else {
        setBookingError('Failed to book appointment. Please try again.');
      }
    } finally {
      setIsBooking(false);
    }
  };

  /* ── Success screen ── */
  if (bookingSuccess) {
    return (
      <div className="text-center py-8 space-y-4 animate-fade-in">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Booked!</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Your appointment is confirmed.</p>
        </div>
        <button
          onClick={() => navigate('/appointments')}
          className="w-full bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-700 transition-colors font-medium"
        >
          View My Appointments
        </button>
        <button
          onClick={() => setBookingSuccess(false)}
          className="w-full text-gray-500 dark:text-gray-400 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-sm"
        >
          Book Another Slot
        </button>
      </div>
    );
  }

  if (!hasAnyAvailability) {
    return (
      <div className="text-center py-10 space-y-3">
        <CalendarX className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto" />
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          This doctor hasn&apos;t set their availability yet. Please check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl overflow-hidden">
        <Calendar
          onChange={handleDateSelect}
          value={selectedDate}
          minDate={new Date()}
          tileDisabled={isTileDisabled}
          className="w-full"
          tileClassName="hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors rounded"
        />
      </div>

      {/* Time slots modal */}
      {showSlots && stage === 'slots' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-fade-in">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Choose a time</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </p>

            {availableSlots.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 mb-6">
                {availableSlots.map(slot => (
                  <button
                    key={slot}
                    onClick={() => setSelectedSlot(slot)}
                    className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
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
              <div className="text-center py-6 mb-6">
                <CalendarX className="w-9 h-9 text-gray-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No available slots for this date. Please choose another day.</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowSlots(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleContinueToSymptoms}
                disabled={!selectedSlot || isHolding}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {isHolding ? 'Holding…' : 'Continue'}
              </button>
            </div>

            {bookingError && (
              <p className="mt-3 text-red-500 text-sm text-center">{bookingError}</p>
            )}
          </div>
        </div>
      )}

      {/* Symptom form modal */}
      {showSlots && stage === 'symptoms' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-fade-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Tell us what&apos;s going on</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')} · {selectedSlot}
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                  Symptoms / chief complaint <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={symptomForm.symptoms}
                  onChange={handleSymptomChange('symptoms')}
                  rows={2}
                  placeholder="e.g. Persistent headache and mild fever"
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                {formErrors.symptoms && <p className="text-red-500 text-xs mt-1">{formErrors.symptoms}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                  How long have you had these symptoms? <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={symptomForm.duration}
                  onChange={handleSymptomChange('duration')}
                  placeholder="e.g. 3 days"
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {formErrors.duration && <p className="text-red-500 text-xs mt-1">{formErrors.duration}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                  Severity <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {SEVERITY_OPTIONS.map(level => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setSymptomForm(prev => ({ ...prev, severity: level }))}
                      className={`py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                        symptomForm.severity === level
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                          : 'border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-200 hover:border-blue-300'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                {formErrors.severity && <p className="text-red-500 text-xs mt-1">{formErrors.severity}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                  Additional information
                </label>
                <textarea
                  value={symptomForm.additionalInfo}
                  onChange={handleSymptomChange('additionalInfo')}
                  rows={2}
                  placeholder="Anything else the doctor should know (optional)"
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleBackToSlots}
                disabled={isBooking}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-sm disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handleBooking}
                disabled={isBooking}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {isBooking ? 'Booking…' : 'Confirm Appointment'}
              </button>
            </div>

            {bookingError && (
              <p className="mt-3 text-red-500 text-sm text-center">{bookingError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentBooking;
