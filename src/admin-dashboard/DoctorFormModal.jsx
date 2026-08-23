import { useState } from 'react';
import { X, UserPlus, Save, Eye, EyeOff } from 'lucide-react';
import { authorizedFetch } from '../utils/authorizedFetch';

const emptyForm = {
  firstName: '', lastName: '', email: '', password: '',
  specialty: '', location: '', experience: '', licenseNumber: '',
  clinicName: '', about: '', fee: '',
};

/** Add or edit a doctor's profile. Add creates a Firebase Auth account +
 *  doctors/{uid} doc server-side (api/admin/create-doctor.js). Edit merges
 *  changes into the existing doctors/{uid} doc (api/admin/update-doctor.js). */
export default function DoctorFormModal({ mode, doctor, onClose, onSaved }) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState(() => isEdit ? {
    firstName: doctor.firstName || '',
    lastName: doctor.lastName || '',
    email: doctor.email || '',
    password: '',
    specialty: doctor.specialty || '',
    location: doctor.location || '',
    experience: doctor.experience ?? '',
    licenseNumber: doctor.licenseNumber || '',
    clinicName: doctor.clinicName || '',
    about: doctor.about || '',
    fee: doctor.fee ?? '',
  } : emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (isEdit) {
        await authorizedFetch('/api/admin/update-doctor', {
          method: 'POST',
          body: JSON.stringify({
            doctorId: doctor.id,
            updates: {
              firstName: form.firstName,
              lastName: form.lastName,
              name: `${form.firstName} ${form.lastName}`.trim(),
              specialty: form.specialty,
              location: form.location,
              experience: form.experience === '' ? null : Number(form.experience),
              licenseNumber: form.licenseNumber || null,
              clinicName: form.clinicName,
              about: form.about,
              fee: form.fee === '' ? null : Number(form.fee),
            },
          }),
        });
      } else {
        await authorizedFetch('/api/admin/create-doctor', {
          method: 'POST',
          body: JSON.stringify(form),
        });
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 rounded-t-2xl">
          <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-500" />
            {isEdit ? 'Edit Doctor' : 'Add Doctor'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name" name="firstName" value={form.firstName} onChange={handleChange} required disabled={saving} />
            <Field label="Last Name" name="lastName" value={form.lastName} onChange={handleChange} required disabled={saving} />
          </div>

          <Field
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            required
            disabled={saving || isEdit}
            hint={isEdit ? 'Email is tied to the login account and cannot be changed here.' : undefined}
          />

          {!isEdit && (
            <div className="relative">
              <Field
                label="Temporary Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
                disabled={saving}
                hint="Share this with the doctor — they can change it after logging in."
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-[38px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Specialty" name="specialty" placeholder="Cardiologist" value={form.specialty} onChange={handleChange} required disabled={saving} />
            <Field label="Location" name="location" placeholder="Mumbai" value={form.location} onChange={handleChange} disabled={saving} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Experience (years)" name="experience" type="number" min="0" value={form.experience} onChange={handleChange} disabled={saving} />
            <Field label="Consultation Fee (₹)" name="fee" type="number" min="0" value={form.fee} onChange={handleChange} disabled={saving} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="License Number" name="licenseNumber" value={form.licenseNumber} onChange={handleChange} disabled={saving} />
            <Field label="Clinic Name" name="clinicName" value={form.clinicName} onChange={handleChange} disabled={saving} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">About</label>
            <textarea
              name="about"
              value={form.about}
              onChange={handleChange}
              disabled={saving}
              rows={3}
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={saving}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Doctor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, hint, ...props }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <input
        {...props}
        className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
      />
      {hint && <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}
