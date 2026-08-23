import { useState } from 'react';
import { Pill, Plus, Trash2, Save, CheckCircle2 } from 'lucide-react';
import { emptyMedicine, buildConsultationPayload } from '../utils/prescription';

const MEDICINE_FIELDS = [
  { key: 'medicine',     label: 'Medicine',     placeholder: 'e.g. Paracetamol 500mg' },
  { key: 'dosage',       label: 'Dosage',       placeholder: 'e.g. 1 tablet' },
  { key: 'frequency',    label: 'Frequency',    placeholder: 'e.g. Twice a day' },
  { key: 'duration',     label: 'Duration',     placeholder: 'e.g. 3 days' },
  { key: 'instructions', label: 'Instructions', placeholder: 'e.g. Take after meals' },
];

/**
 * Doctor-facing clinical notes + prescription + follow-up editor for one
 * appointment. Purely a controlled form — persistence and the "mark
 * completed" side effects (notification, vaccination sync) stay in
 * PatientSidebar.jsx, which already owns that logic.
 */
export function ConsultationForm({ initialNotes, initialPrescription, initialFollowUp, status, onSave, onComplete }) {
  const [notes, setNotes] = useState(initialNotes || '');
  const [medicines, setMedicines] = useState(
    initialPrescription?.length ? initialPrescription.map(m => ({ ...emptyMedicine(), ...m })) : [emptyMedicine()]
  );
  const [followUp, setFollowUp] = useState(initialFollowUp || '');
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const isCompleted = status === 'completed';

  const updateMedicine = (index, field, value) => {
    setMedicines(prev => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };
  const addMedicine = () => setMedicines(prev => [...prev, emptyMedicine()]);
  const removeMedicine = (index) => setMedicines(prev => prev.filter((_, i) => i !== index));

  const buildPayload = () => buildConsultationPayload({ notes, medicines, followUp });

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      await onSave(buildPayload());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    setError('');
    setCompleting(true);
    try {
      await onComplete(buildPayload());
    } catch (err) {
      setError('Failed to complete appointment. Please try again.');
    } finally {
      setCompleting(false);
    }
  };

  const busy = saving || completing;

  return (
    <div className="space-y-4">
      {/* Clinical / visit notes */}
      <div>
        <label className="text-gray-600 text-sm block mb-1.5">Clinical / Visit Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Examination findings, diagnosis, observations..."
          className="w-full p-3 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Prescription */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-gray-600 text-sm flex items-center gap-1.5">
            <Pill className="w-4 h-4" /> Prescription
          </label>
          <button
            type="button"
            onClick={addMedicine}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Medicine
          </button>
        </div>

        <div className="space-y-3">
          {medicines.map((med, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3 relative bg-gray-50">
              {medicines.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeMedicine(i)}
                  className="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition-colors"
                  aria-label="Remove medicine"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <div className="grid grid-cols-2 gap-2 pr-6">
                {MEDICINE_FIELDS.map(f => (
                  <input
                    key={f.key}
                    value={med[f.key]}
                    onChange={e => updateMedicine(i, f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="text-sm border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 col-span-1"
                    title={f.label}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Follow-up instructions */}
      <div>
        <label className="text-gray-600 text-sm block mb-1.5">Follow-up Instructions</label>
        <textarea
          value={followUp}
          onChange={e => setFollowUp(e.target.value)}
          rows={2}
          placeholder="e.g. Return in 1 week if symptoms persist"
          className="w-full p-3 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : saved ? 'Saved!' : isCompleted ? 'Save Changes' : 'Save Notes'}
        </button>
        {!isCompleted && (
          <button
            type="button"
            onClick={handleComplete}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" /> {completing ? 'Completing...' : 'Mark as Completed'}
          </button>
        )}
      </div>
    </div>
  );
}
