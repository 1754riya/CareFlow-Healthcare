export const emptyMedicine = () => ({ medicine: '', dosage: '', frequency: '', duration: '', instructions: '' });

/**
 * Shapes a doctor's consultation form state into the payload persisted onto
 * the appointment doc: trims every field, and drops any medicine row whose
 * name is blank (so an unused trailing "Add Medicine" row never gets saved).
 * Pure function — shared between ConsultationForm.jsx (the real save/complete
 * calls) and its test, so the test exercises the exact logic that runs.
 */
export function buildConsultationPayload({ notes, medicines, followUp }) {
  return {
    visitNotes: (notes || '').trim(),
    prescription: (medicines || [])
      .map(m => ({
        medicine: (m.medicine || '').trim(),
        dosage: (m.dosage || '').trim(),
        frequency: (m.frequency || '').trim(),
        duration: (m.duration || '').trim(),
        instructions: (m.instructions || '').trim(),
      }))
      .filter(m => m.medicine),
    followUpInstructions: (followUp || '').trim(),
  };
}
