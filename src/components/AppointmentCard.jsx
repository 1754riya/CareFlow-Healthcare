import React, { useState } from 'react';
import { format } from 'date-fns';
import { Trash2, Pill, ChevronDown, ChevronUp, FileText, Sparkles, AlertCircle, CalendarClock } from 'lucide-react';
import DoctorRating from './DoctorRating';
import AppointmentTimeline from './AppointmentTimeline';
import RescheduleModal from './RescheduleModal';
import { useToast } from './Toast';

const STATUS_STYLE = {
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  pending:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
};

export default function AppointmentCard({ appointment, handleCancelAppointment, doctorId }) {
  const [showVisitSummary, setShowVisitSummary] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const toast = useToast();

  const startTime = appointment.startTime instanceof Date
    ? appointment.startTime
    : new Date(appointment.startTime);

  const isFuture    = startTime > new Date();
  const isCancelled = appointment.status === 'cancelled';
  const isCompleted = appointment.status === 'completed';
  const hasRating   = !!appointment.rating;
  const hasVisitSummary = isCompleted && (
    appointment.visitNotes || appointment.followUpInstructions || appointment.prescription?.length > 0
  );

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-5 hover:shadow-md transition-shadow animate-fade-in">
      <div className="flex items-start gap-4">

        {/* Date block */}
        <div className="text-center min-w-[56px] bg-blue-50 dark:bg-blue-900/30 rounded-xl p-3 shrink-0">
          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">{format(startTime, 'MMM')}</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 leading-none">{format(startTime, 'dd')}</div>
          <div className="text-xs text-gray-400">{format(startTime, 'yyyy')}</div>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">Dr. {appointment.doctorName}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{appointment.timeSlot}</p>
              {appointment.location && (
                <p className="text-xs text-gray-400 mt-0.5">{appointment.location}</p>
              )}
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${STATUS_STYLE[appointment.status] ?? STATUS_STYLE.pending}`}>
              {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
            </span>
          </div>

          {/* Rating for completed appointments */}
          {isCompleted && !hasRating && doctorId && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
              <DoctorRating
                appointmentId={appointment.id}
                doctorId={doctorId || appointment.doctorId}
              />
            </div>
          )}

          {isCompleted && hasRating && (
            <div className="mt-2 flex items-center gap-1 text-sm text-yellow-500">
              {'★'.repeat(appointment.rating)}{'☆'.repeat(5 - appointment.rating)}
              <span className="text-xs text-gray-400 ml-1">You rated this visit</span>
            </div>
          )}

          {/* Visit notes / prescription / follow-up, once the doctor has completed the visit */}
          {hasVisitSummary && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
              <button
                onClick={() => setShowVisitSummary(v => !v)}
                className="flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                <FileText className="w-4 h-4" />
                {showVisitSummary ? 'Hide Visit Summary' : 'View Visit Summary'}
                {showVisitSummary ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showVisitSummary && (
                <div className="mt-3 space-y-3 text-sm animate-fade-in">
                  {/* AI post-visit summary */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 rounded-lg p-3">
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> AI Summary of Your Visit
                    </p>
                    {appointment.postVisitSummary ? (
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">What the doctor noted</p>
                          <p className="text-gray-700 dark:text-gray-300">{appointment.postVisitSummary.whatDoctorNoted}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Medication schedule</p>
                          <p className="text-gray-700 dark:text-gray-300">{appointment.postVisitSummary.medicationSchedule}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Follow-up steps</p>
                          <p className="text-gray-700 dark:text-gray-300">{appointment.postVisitSummary.followUpSteps}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-400 dark:text-slate-500">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        Post-visit summary unavailable
                      </div>
                    )}
                  </div>

                  {appointment.visitNotes && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Visit Notes</p>
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{appointment.visitNotes}</p>
                    </div>
                  )}

                  {appointment.prescription?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                        <Pill className="w-3.5 h-3.5" /> Prescription
                      </p>
                      <div className="space-y-2">
                        {appointment.prescription.map((med, i) => (
                          <div key={i} className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2.5">
                            <p className="font-semibold text-gray-900 dark:text-white">{med.medicine}</p>
                            <p className="text-gray-600 dark:text-gray-400 text-xs mt-0.5">
                              {[med.dosage, med.frequency, med.duration].filter(Boolean).join(' · ')}
                            </p>
                            {med.instructions && (
                              <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 italic">{med.instructions}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {appointment.followUpInstructions && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Follow-up</p>
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{appointment.followUpInstructions}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Appointment Timeline */}
          {!isCancelled && (
            <AppointmentTimeline status={appointment.status} />
          )}

          {/* Reschedule / Cancel buttons */}
          {!isCancelled && !isCompleted && isFuture && (
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setShowReschedule(true)}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-1.5 rounded-lg transition-colors"
              >
                <CalendarClock className="w-4 h-4" /> Reschedule
              </button>
              <button
                onClick={() => handleCancelAppointment(appointment.id)}
                className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {showReschedule && (
        <RescheduleModal
          appointment={appointment}
          onClose={() => setShowReschedule(false)}
          onRescheduled={() => {
            setShowReschedule(false);
            toast.success('Appointment rescheduled', 'Your appointment has been moved to the new time.');
          }}
        />
      )}
    </div>
  );
}
