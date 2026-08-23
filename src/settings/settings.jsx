import React, { useEffect, useState, useContext } from 'react';
import { doc, getDoc, updateDoc } from '@firebase/firestore';
import { auth, db } from '../firebase/config';
import { AuthContext } from '../AuthContext';
import { useToast } from '../components/Toast';
import { motion } from 'framer-motion';
import PageTransition from '../components/PageTransition';
import ConnectGoogleCalendar from '../components/ConnectGoogleCalendar';
import {
  User, Phone, Heart, Loader2, CheckCircle, Camera,
  Shield, Activity, ChevronRight, CalendarCheck,
} from 'lucide-react';

/* ── Field wrapper ──────────────────────────────────────────────── */
function FormField({ label, error, as: Tag = 'input', required, className = '', children, ...props }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <Tag
        className={`w-full rounded-xl border ${
          error
            ? 'border-red-300 dark:border-red-700 focus:ring-red-400'
            : 'border-gray-200 dark:border-slate-600 focus:ring-blue-500'
        } bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:border-transparent transition-colors ${
          Tag === 'textarea' ? 'resize-none' : ''
        } ${className}`}
        {...props}
      >
        {children}
      </Tag>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

/* ── Section card ───────────────────────────────────────────────── */
function SectionCard({ title, subtitle, icon: Icon, iconColor, children }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden shadow-sm">
      <div className="px-6 py-5 border-b border-gray-50 dark:border-slate-700 flex items-center gap-3">
        <div className={`w-9 h-9 ${iconColor} rounded-xl flex items-center justify-center shrink-0`}>
          <Icon className="w-4.5 h-4.5 text-white" size={18} />
        </div>
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

/* ── Progress tracker ───────────────────────────────────────────── */
function ProfileProgress({ formData }) {
  const fields = [
    formData.firstName, formData.lastName, formData.age, formData.gender,
    formData.bloodGroup, formData.phone, formData.address,
  ];
  const filled  = fields.filter(Boolean).length;
  const total   = fields.length;
  const pct     = Math.round((filled / total) * 100);

  const color = pct === 100 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : 'bg-amber-500';

  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-bold">Profile Completeness</p>
          <p className="text-blue-100 text-xs mt-0.5">{filled} of {total} fields filled</p>
        </div>
        <div className="text-3xl font-black">{pct}%</div>
      </div>
      <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-white rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      {pct < 100 && (
        <p className="text-blue-100 text-xs mt-2">
          Complete your profile for a better experience and faster appointments.
        </p>
      )}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const Settings = () => {
  const { currentUser } = useContext(AuthContext);
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  const [formData, setFormData] = useState({
    firstName: '', lastName: '', age: '', gender: '',
    bloodGroup: '', phone: '', address: '',
    allergies: '', chronicConditions: '',
  });

  useEffect(() => {
    if (!currentUser) return;
    getDoc(doc(db, 'patients', currentUser.uid)).then(snap => {
      if (snap.exists()) {
        const d = snap.data();
        setFormData({
          firstName:         d.firstName         || '',
          lastName:          d.lastName          || '',
          age:               d.age               || '',
          gender:            d.gender            || '',
          bloodGroup:        d.bloodGroup        || '',
          phone:             d.phone             || '',
          address:           d.address           || '',
          allergies:         (d.allergies || []).join(', '),
          chronicConditions: (d.chronicConditions || []).join(', '),
        });
      }
    }).catch(() => toast.error('Load failed', 'Could not load profile data.'))
      .finally(() => setLoading(false));
  }, [currentUser]);

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await updateDoc(doc(db, 'patients', currentUser.uid), {
        ...formData,
        allergies:         formData.allergies.split(',').map(s => s.trim()).filter(Boolean),
        chronicConditions: formData.chronicConditions.split(',').map(s => s.trim()).filter(Boolean),
        updatedAt: new Date(),
      });
      setSaved(true);
      toast.success('Profile saved', 'Your changes have been saved successfully.');
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast.error('Save failed', 'Could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Loading your profile...</p>
      </div>
    </div>
  );

  return (
    <PageTransition>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pt-16 pb-24 md:pb-8">
        <div className="max-w-2xl mx-auto px-4 py-8">

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Account Settings</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Manage your profile, health info, and preferences
            </p>
          </div>

          {/* Profile avatar + quick info */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-5 mb-6 flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-md">
                {currentUser?.photoURL ? (
                  <img src={currentUser.photoURL} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                ) : (
                  (formData.firstName?.[0] || currentUser?.email?.[0] || '?').toUpperCase()
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 dark:text-white truncate">
                {formData.firstName || formData.lastName
                  ? `${formData.firstName} ${formData.lastName}`.trim()
                  : 'Your Name'}
              </p>
              <p className="text-sm text-gray-400 truncate">{currentUser?.email}</p>
              {formData.bloodGroup && (
                <span className="inline-block mt-1 text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">
                  {formData.bloodGroup}
                </span>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 dark:text-slate-600 shrink-0" />
          </div>

          {/* Progress */}
          <ProfileProgress formData={formData} />

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Personal Info */}
            <SectionCard title="Personal Information" subtitle="Your basic profile details" icon={User} iconColor="bg-blue-500">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="First Name" name="firstName" value={formData.firstName} onChange={handleChange} required placeholder="Rahul" />
                <FormField label="Last Name"  name="lastName"  value={formData.lastName}  onChange={handleChange} required placeholder="Sharma" />
                <FormField label="Age" name="age" type="number" value={formData.age} onChange={handleChange} placeholder="28" min={1} max={120} />
                <FormField label="Gender" name="gender" as="select" value={formData.gender} onChange={handleChange}>
                  <option value="">Select gender</option>
                  {['Male', 'Female', 'Non-binary', 'Prefer not to say'].map(g => (
                    <option key={g} value={g.toLowerCase()}>{g}</option>
                  ))}
                </FormField>
                <FormField label="Blood Group" name="bloodGroup" as="select" value={formData.bloodGroup} onChange={handleChange}>
                  <option value="">Select blood group</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </FormField>
              </div>
            </SectionCard>

            {/* Contact */}
            <SectionCard title="Contact Details" subtitle="How we and doctors can reach you" icon={Phone} iconColor="bg-emerald-500">
              <div className="space-y-4">
                <FormField label="Phone Number" name="phone" type="tel" value={formData.phone} onChange={handleChange} placeholder="+91 98765 43210" />
                <FormField label="Address" name="address" as="textarea" rows={3} value={formData.address} onChange={handleChange} placeholder="Your full address" />
              </div>
            </SectionCard>

            {/* Medical */}
            <SectionCard title="Medical Information" subtitle="Important health details for your care" icon={Activity} iconColor="bg-rose-500">
              <div className="space-y-4">
                <FormField
                  label="Known Allergies"
                  name="allergies"
                  value={formData.allergies}
                  onChange={handleChange}
                  placeholder="Peanuts, Penicillin (comma separated)"
                />
                <FormField
                  label="Chronic Conditions"
                  name="chronicConditions"
                  value={formData.chronicConditions}
                  onChange={handleChange}
                  placeholder="Asthma, Diabetes (comma separated)"
                />
                <p className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 shrink-0" />
                  Medical data is private and only visible to you.
                </p>
              </div>
            </SectionCard>

            {/* Integrations */}
            <SectionCard title="Integrations" subtitle="Connect other services to CareFlow" icon={CalendarCheck} iconColor="bg-indigo-500">
              <ConnectGoogleCalendar />
            </SectionCard>

            {/* Submit */}
            <div className="flex items-center justify-between pt-2">
              {saved && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium"
                >
                  <CheckCircle className="w-4 h-4" /> Saved!
                </motion.div>
              )}
              <div className="ml-auto">
                <motion.button
                  type="submit"
                  disabled={saving}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-md shadow-blue-200 dark:shadow-none text-sm"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </motion.button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </PageTransition>
  );
};

export default Settings;
