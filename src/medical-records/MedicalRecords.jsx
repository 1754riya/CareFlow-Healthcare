import React, { useState, useEffect, useContext } from 'react';
import { doc, getDoc, setDoc } from '@firebase/firestore';
import { db } from '../firebase/config';
import { AuthContext } from '../AuthContext';
import {
  Heart, Activity, AlertCircle, Pill, User, Phone,
  Save, CheckCircle, XCircle, FileText, Loader2,
} from 'lucide-react';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const COMMON_CONDITIONS = [
  'Diabetes', 'Hypertension', 'Asthma', 'Heart Disease', 'Arthritis',
  'Thyroid Disorder', 'Kidney Disease', 'Epilepsy', 'PCOS', 'None',
];

const COMMON_ALLERGIES = [
  'Penicillin', 'Aspirin', 'Peanuts', 'Shellfish', 'Latex', 'Sulfa drugs', 'None',
];

function Section({ icon: Icon, title, description, color = 'blue', children }) {
  const colorMap = {
    blue:   'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10',
    red:    'border-red-200  dark:border-red-800  bg-red-50/50  dark:bg-red-900/10',
    green:  'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10',
    purple: 'border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10',
    orange: 'border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10',
  };
  const iconColor = {
    blue: 'text-blue-500', red: 'text-red-500', green: 'text-green-500',
    purple: 'text-purple-500', orange: 'text-orange-500',
  };
  return (
    <div className={`border rounded-2xl p-6 ${colorMap[color]}`}>
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-white dark:bg-slate-800 shadow-sm ${iconColor[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white">{title}</h3>
          {description && <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = 'w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500';

function TagInput({ tags, onChange, suggestions }) {
  const [input, setInput] = useState('');

  const add = (tag) => {
    const t = tag.trim();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput('');
  };

  const remove = (tag) => onChange(tags.filter(t => t !== tag));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map(t => (
          <span key={t} className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs px-2.5 py-1 rounded-full">
            {t}
            <button type="button" onClick={() => remove(t)} className="hover:text-red-500">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(input); } }}
          placeholder="Type and press Enter..."
          className={inputCls}
        />
        <button type="button" onClick={() => add(input)}
          className="px-3 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700">
          Add
        </button>
      </div>
      {suggestions && (
        <div className="flex flex-wrap gap-1">
          {suggestions.filter(s => !tags.includes(s)).map(s => (
            <button key={s} type="button" onClick={() => add(s)}
              className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 transition-colors">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MedicalRecords() {
  const { currentUser } = useContext(AuthContext);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState(null);

  const [form, setForm] = useState({
    bloodGroup: '',
    height: '',
    weight: '',
    allergies: [],
    chronicConditions: [],
    currentMedications: [],
    previousSurgeries: '',
    familyHistory: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
    smoker: false,
    alcoholConsumption: 'none',
    exerciseFrequency: 'rarely',
    notes: '',
  });

  useEffect(() => {
    const load = async () => {
      if (!currentUser) return;
      try {
        const snap = await getDoc(doc(db, 'patients', currentUser.uid));
        if (snap.exists()) {
          const d = snap.data();
          setForm(prev => ({
            ...prev,
            bloodGroup: d.bloodGroup || '',
            height: d.height || '',
            weight: d.weight || '',
            allergies: d.allergies || [],
            chronicConditions: d.chronicConditions || [],
            currentMedications: d.currentMedications || [],
            previousSurgeries: d.previousSurgeries || '',
            familyHistory: d.familyHistory || '',
            emergencyContactName: d.emergencyContactName || '',
            emergencyContactPhone: d.emergencyContactPhone || '',
            emergencyContactRelation: d.emergencyContactRelation || '',
            smoker: d.smoker ?? false,
            alcoholConsumption: d.alcoholConsumption || 'none',
            exerciseFrequency: d.exerciseFrequency || 'rarely',
            notes: d.notes || '',
          }));
        }
      } catch (e) {
        setError('Failed to load records');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser]);

  const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await setDoc(doc(db, 'patients', currentUser.uid), { ...form, updatedAt: new Date() }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError('Failed to save records');
    } finally {
      setSaving(false);
    }
  };

  const bmi = form.height && form.weight
    ? (parseFloat(form.weight) / Math.pow(parseFloat(form.height) / 100, 2)).toFixed(1)
    : null;
  const bmiCategory = bmi
    ? bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese'
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pt-20 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pt-16 pb-24 md:pb-8">
      <div className="max-w-3xl mx-auto px-4 py-8 animate-fade-in">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center">
            <FileText className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Medical Records</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Your health information, securely stored and accessible to your doctors</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Vitals */}
          <Section icon={Activity} title="Vitals & Measurements" description="Basic health metrics" color="blue">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label="Blood Group">
                <select value={form.bloodGroup} onChange={e => set('bloodGroup', e.target.value)} className={inputCls}>
                  <option value="">Select</option>
                  {BLOOD_GROUPS.map(g => <option key={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="Height (cm)">
                <input type="number" value={form.height} onChange={e => set('height', e.target.value)}
                  placeholder="170" className={inputCls} />
              </Field>
              <Field label="Weight (kg)">
                <input type="number" value={form.weight} onChange={e => set('weight', e.target.value)}
                  placeholder="70" className={inputCls} />
              </Field>
              <div>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">BMI</p>
                <div className={`rounded-xl px-3 py-2.5 text-sm font-bold ${
                  bmiCategory === 'Normal' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                  bmiCategory === 'Underweight' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                  bmiCategory ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                  'bg-gray-100 text-gray-400 dark:bg-slate-700 dark:text-gray-500'
                }`}>
                  {bmi ? `${bmi} — ${bmiCategory}` : '—'}
                </div>
              </div>
            </div>
          </Section>

          {/* Allergies */}
          <Section icon={AlertCircle} title="Allergies" description="Document known allergies for doctor reference" color="red">
            <TagInput
              tags={form.allergies}
              onChange={tags => set('allergies', tags)}
              suggestions={COMMON_ALLERGIES}
            />
          </Section>

          {/* Conditions */}
          <Section icon={Heart} title="Chronic Conditions" description="Long-term health conditions" color="purple">
            <TagInput
              tags={form.chronicConditions}
              onChange={tags => set('chronicConditions', tags)}
              suggestions={COMMON_CONDITIONS}
            />
          </Section>

          {/* Medications */}
          <Section icon={Pill} title="Current Medications" description="Medications you are currently taking" color="green">
            <TagInput
              tags={form.currentMedications}
              onChange={tags => set('currentMedications', tags)}
            />
          </Section>

          {/* History */}
          <Section icon={FileText} title="Medical History" description="Past surgeries and family history" color="orange">
            <div className="space-y-4">
              <Field label="Previous Surgeries or Procedures">
                <textarea
                  value={form.previousSurgeries}
                  onChange={e => set('previousSurgeries', e.target.value)}
                  placeholder="e.g., Appendectomy (2019), Knee replacement (2021)..."
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
              </Field>
              <Field label="Family Medical History">
                <textarea
                  value={form.familyHistory}
                  onChange={e => set('familyHistory', e.target.value)}
                  placeholder="e.g., Father - Diabetes, Mother - Hypertension..."
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
              </Field>
            </div>
          </Section>

          {/* Lifestyle */}
          <Section icon={Activity} title="Lifestyle" description="Lifestyle factors that affect your health" color="blue">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Smoking">
                <div className="flex items-center gap-3 mt-1">
                  <button type="button" onClick={() => set('smoker', !form.smoker)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${form.smoker ? 'bg-red-500' : 'bg-gray-200 dark:bg-slate-600'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.smoker ? 'left-6' : 'left-0.5'}`} />
                  </button>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{form.smoker ? 'Smoker' : 'Non-smoker'}</span>
                </div>
              </Field>
              <Field label="Alcohol">
                <select value={form.alcoholConsumption} onChange={e => set('alcoholConsumption', e.target.value)} className={inputCls}>
                  <option value="none">None</option>
                  <option value="occasional">Occasional</option>
                  <option value="moderate">Moderate</option>
                  <option value="heavy">Heavy</option>
                </select>
              </Field>
              <Field label="Exercise">
                <select value={form.exerciseFrequency} onChange={e => set('exerciseFrequency', e.target.value)} className={inputCls}>
                  <option value="rarely">Rarely</option>
                  <option value="1-2/week">1–2×/week</option>
                  <option value="3-4/week">3–4×/week</option>
                  <option value="daily">Daily</option>
                </select>
              </Field>
            </div>
          </Section>

          {/* Emergency Contact */}
          <Section icon={Phone} title="Emergency Contact" description="Someone to contact in case of emergency" color="red">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Full Name">
                <input value={form.emergencyContactName} onChange={e => set('emergencyContactName', e.target.value)}
                  placeholder="John Doe" className={inputCls} />
              </Field>
              <Field label="Phone Number">
                <input value={form.emergencyContactPhone} onChange={e => set('emergencyContactPhone', e.target.value)}
                  type="tel" placeholder="+91 9876543210" className={inputCls} />
              </Field>
              <Field label="Relationship">
                <select value={form.emergencyContactRelation} onChange={e => set('emergencyContactRelation', e.target.value)} className={inputCls}>
                  <option value="">Select</option>
                  {['Spouse', 'Parent', 'Sibling', 'Child', 'Friend', 'Other'].map(r => <option key={r}>{r}</option>)}
                </select>
              </Field>
            </div>
          </Section>

          {/* Notes */}
          <Section icon={User} title="Additional Notes" description="Any other information for your doctor" color="blue">
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Any other medical information, preferences, or special notes..."
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </Section>

          {/* Status */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
              <XCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3">
              <CheckCircle className="w-4 h-4 shrink-0" /> Medical records saved successfully!
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-8 py-3 rounded-xl transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Records'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
