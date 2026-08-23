//PatientSidebar.jsx
import React, { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from '@firebase/firestore';
import { db, auth } from '../firebase/config';
import { X, Sparkles, AlertCircle, Stethoscope } from 'lucide-react';
import { createNotification } from '../utils/notifications';
import { generatePostVisitSummaryForAppointment } from '../utils/postVisitSummary';
import { createMedicationRemindersForAppointment } from '../utils/medicationRemindersClient';
import { ConsultationForm } from './ConsultationForm';

const URGENCY_STYLES = {
  Low:    'bg-green-100 text-green-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  High:   'bg-red-100 text-red-700',
};

export function PatientSidebar({ isOpen, onClose, patientId, appointmentId }) {
  const [patient, setPatient] = useState(null);
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [vaccinations, setVaccinations] = useState({});

  useEffect(() => {
    const fetchPatientDetails = async () => {
      if (!patientId) return;

      try {
        setLoading(true);
        const currentUser = auth.currentUser;
        if (!currentUser) {
          throw new Error('No authenticated user');
        }

        const patientDoc = await getDoc(doc(db, 'patients', patientId));

        if (patientDoc.exists()) {
          const patientData = patientDoc.data();
          setPatient(patientData);

          // Convert existing vaccinations array to object for easier checking
          const existingVaccinations = {};
          patientData.vaccinations?.forEach(vac => {
            existingVaccinations[vac.name] = true;
          });
          setVaccinations(existingVaccinations);
        } else {
          setError('Patient not found');
        }

        if (appointmentId) {
          const appointmentDoc = await getDoc(doc(db, 'appointments', appointmentId));
          setAppointment(appointmentDoc.exists() ? appointmentDoc.data() : null);
        }
      } catch (err) {
        console.error('Error fetching patient:', err);
        setError(`Failed to load patient details: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchPatientDetails();
  }, [patientId, appointmentId]);

  /** Persists clinical notes / prescription / follow-up without changing appointment status. */
  const handleSaveConsultation = async (consultationPayload) => {
    await updateDoc(doc(db, 'appointments', appointmentId), {
      ...consultationPayload,
      updatedAt: new Date(),
    });
    setAppointment(prev => ({ ...prev, ...consultationPayload }));
  };

  /** Persists the same consultation data and marks the appointment completed. */
  const handleComplete = async (consultationPayload = {}) => {
    try {
      // Update appointment status + consultation data together
      await updateDoc(doc(db, 'appointments', appointmentId), {
        ...consultationPayload,
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date()
      });

      // Best-effort, fire-and-forget: turn the notes/prescription/follow-up
      // just saved into a patient-friendly post-visit summary via Gemini.
      // Never awaited/blocking — the appointment is already completed above
      // regardless of whether this succeeds.
      if (consultationPayload.visitNotes || consultationPayload.prescription?.length > 0 || consultationPayload.followUpInstructions) {
        generatePostVisitSummaryForAppointment(appointmentId);
      }

      // Same best-effort, fire-and-forget pattern: build medication reminder
      // schedules from the prescription just saved. Never blocks completion.
      if (consultationPayload.prescription?.length > 0) {
        createMedicationRemindersForAppointment(appointmentId);
      }

      // Notify patient
      if (patientId) {
        const currentUser = auth.currentUser;
        const doctorName = currentUser?.displayName || currentUser?.email || 'your doctor';
        await createNotification({
          userId: patientId,
          message: `Your appointment with Dr. ${doctorName} has been marked as completed. Please rate your visit!`,
          type: 'appointment_completed',
          appointmentId,
        });
      }

      // Update patient vaccinations if changed
      if (Object.keys(vaccinations).length > 0) {
        const updatedVaccinations = Object.entries(vaccinations)
          .filter(([, value]) => value)
          .map(([name]) => ({
            name,
            date: new Date(),
            completed: true
          }));

        await updateDoc(doc(db, 'patients', patientId), {
          vaccinations: updatedVaccinations
        });
      }

      onClose();
    } catch (err) {
      console.error('Error completing appointment:', err);
      throw err;
    }
  };

  const handleVaccinationToggle = (vaccineName) => {
    setVaccinations(prev => ({
      ...prev,
      [vaccineName]: !prev[vaccineName]
    }));
  };

  const aiSummary = appointment?.aiSummary || null;
  const hasSymptomInfo = appointment && (appointment.symptoms || appointment.severity || appointment.symptomDuration || appointment.additionalInfo);

  return (
    <div
      className={`fixed inset-y-0 right-0 w-96 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } z-50`}
    >
      <div className="h-full overflow-y-auto flex flex-col">
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Patient Details</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : error ? (
            <div className="text-red-500 text-center">{error}</div>
          ) : patient ? (
            <div className="space-y-6">
              {/* Basic Information */}
              <Section title="Personal Information">
                <InfoItem label="Full Name" value={`${patient.firstName} ${patient.lastName}`} />
                <InfoItem label="Age" value={patient.age} />
                <InfoItem label="Gender" value={patient.gender} />
                <InfoItem label="Blood Group" value={patient.bloodGroup} />
              </Section>

              {/* Submitted Symptoms */}
              <Section title="Submitted Symptoms">
                {hasSymptomInfo ? (
                  <>
                    <InfoItem label="Symptoms" value={appointment.symptoms} />
                    <InfoItem label="Duration" value={appointment.symptomDuration} />
                    <InfoItem label="Severity" value={appointment.severity} />
                    <InfoItem label="Additional Info" value={appointment.additionalInfo} />
                  </>
                ) : (
                  <p className="text-sm text-gray-400">No symptoms submitted with this booking.</p>
                )}
              </Section>

              {/* AI Pre-Visit Summary */}
              <Section title="AI Pre-Visit Summary">
                {aiSummary ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${URGENCY_STYLES[aiSummary.urgency] || 'bg-gray-100 text-gray-600'}`}>
                        {aiSummary.urgency} urgency
                      </span>
                    </div>
                    <InfoItem label="Chief Complaint" value={aiSummary.chiefComplaint} />
                    {aiSummary.suggestedQuestions?.length > 0 && (
                      <div>
                        <span className="text-gray-600 text-sm">Suggested questions:</span>
                        <ul className="list-disc list-inside mt-1 space-y-1 text-sm text-gray-800">
                          {aiSummary.suggestedQuestions.map((q, i) => <li key={i}>{q}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    AI summary unavailable
                  </div>
                )}
              </Section>

              {/* Consultation & Prescription */}
              {appointment && appointment.status !== 'cancelled' && (
                <Section title="Consultation & Prescription">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 -mt-1 mb-2">
                    <Stethoscope className="w-3.5 h-3.5" />
                    {appointment.status === 'completed' ? 'Visit completed' : 'Document this visit'}
                  </div>
                  <ConsultationForm
                    initialNotes={appointment.visitNotes}
                    initialPrescription={appointment.prescription}
                    initialFollowUp={appointment.followUpInstructions}
                    status={appointment.status}
                    onSave={handleSaveConsultation}
                    onComplete={handleComplete}
                  />
                </Section>
              )}

              {/* Contact Information */}
              <Section title="Contact Details">
                <InfoItem label="Email" value={patient.email} />
                <InfoItem label="Phone" value={patient.phone} />
                <InfoItem label="Address" value={patient.address} />
              </Section>

              {/* Medical History */}
              <Section title="Medical History">
                <InfoItem label="Allergies" value={patient.allergies?.join(', ') || 'None'} />
                <InfoItem label="Chronic Conditions" value={patient.chronicConditions?.join(', ') || 'None'} />
              </Section>

              {/* Vaccination Details */}

              <Section title="Child Vaccination Details">
                <div className="space-y-6">
                  {/* Birth to 15 months */}
                  <div className="border-l-4 border-blue-200 pl-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Birth to 15 Months</h4>
                    <div className="space-y-2">
                      {[
                        { name: 'BCG', recommended: 'At birth' },
                        { name: 'Hepatitis B', recommended: '0-2 months' },
                        { name: 'DPT', recommended: '6-14 weeks' },
                        { name: 'Polio (OPV)', recommended: '6-14 weeks' },
                        { name: 'Rotavirus', recommended: '6-14 weeks' }
                      ].map((vaccine) => (
                        <div key={vaccine.name} className="flex items-center justify-between">
                          <div className="flex items-center flex-1">
                            <input
                              type="checkbox"
                              id={`vaccine-${vaccine.name}`}
                              checked={vaccinations[vaccine.name] || false}
                              onChange={() => handleVaccinationToggle(vaccine.name)}
                              className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <label htmlFor={`vaccine-${vaccine.name}`} className="ml-2 text-sm text-gray-900">
                              {vaccine.name}
                            </label>
                          </div>
                          <span className="text-xs text-gray-500">{vaccine.recommended}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 15 months to 6 years */}
                  <div className="border-l-4 border-green-200 pl-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">15 Months to 6 Years</h4>
                    <div className="space-y-2">
                      {[
                        { name: 'MMR', recommended: '12-15 months' },
                        { name: 'Chickenpox', recommended: '12-15 months' },
                        { name: 'Hepatitis A', recommended: '12-23 months' },
                        { name: 'DTaP', recommended: '15-18 months' },
                        { name: 'Pneumococcal', recommended: '4-6 years' }
                      ].map((vaccine) => (
                        <div key={vaccine.name} className="flex items-center justify-between">
                          <div className="flex items-center flex-1">
                            <input
                              type="checkbox"
                              id={`vaccine-${vaccine.name}`}
                              checked={vaccinations[vaccine.name] || false}
                              onChange={() => handleVaccinationToggle(vaccine.name)}
                              className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <label htmlFor={`vaccine-${vaccine.name}`} className="ml-2 text-sm text-gray-900">
                              {vaccine.name}
                            </label>
                          </div>
                          <span className="text-xs text-gray-500">{vaccine.recommended}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Section>
            </div>
          ) : (
            <div className="text-center text-gray-500">No patient data available</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper components
const Section = ({ title, children }) => (
  <div className="border-b pb-4">
    <h3 className="font-semibold text-lg mb-3">{title}</h3>
    <div className="space-y-2">{children}</div>
  </div>
);

const InfoItem = ({ label, value }) => (
  <div>
    <span className="text-gray-600 text-sm">{label}:</span>
    <span className="ml-2">{value || 'N/A'}</span>
  </div>
);
