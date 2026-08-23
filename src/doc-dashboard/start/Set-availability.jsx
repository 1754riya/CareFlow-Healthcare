import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../../firebase/config';
import { doc, setDoc, getDoc } from '@firebase/firestore';
import {
  Calendar, Clock, Save, ChevronLeft, CheckCircle, AlertCircle, X, Plus,
} from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DEFAULT_SLOTS = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'];

const TIME_OPTIONS = [
  '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM',
  '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM',
  '5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM', '8:00 PM',
];

const PRESETS = [
  { label: 'Morning (9–1)', slots: ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM'] },
  { label: 'Afternoon (2–6)', slots: ['2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'] },
  { label: 'Full Day', slots: ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'] },
  { label: 'Evening (5–8)', slots: ['5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM'] },
];

export function SetAvailabilityPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDay, setSelectedDay] = useState('Monday');

  const [availability, setAvailability] = useState(
    Object.fromEntries(DAYS.map(d => [d, { enabled: false, slots: [] }]))
  );

  const [blockedDates, setBlockedDates] = useState([]);
  const [newBlockDate, setNewBlockDate] = useState('');

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, 'doctors', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          if (data.availability) {
            const normalized = { ...Object.fromEntries(DAYS.map(d => [d, { enabled: false, slots: [] }])) };
            for (const [day, val] of Object.entries(data.availability)) {
              if (DAYS.includes(day)) {
                if (Array.isArray(val)) {
                  normalized[day] = { enabled: val.length > 0, slots: val };
                } else if (val && typeof val === 'object') {
                  normalized[day] = { enabled: val.enabled ?? false, slots: val.slots ?? [] };
                }
              }
            }
            setAvailability(normalized);
          }
          if (data.blockedDates) setBlockedDates(data.blockedDates);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const toggleDay = (day) => {
    setAvailability(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day].enabled,
        slots: !prev[day].enabled && prev[day].slots.length === 0 ? [...DEFAULT_SLOTS] : prev[day].slots,
      },
    }));
  };

  const toggleSlot = (day, slot) => {
    setAvailability(prev => {
      const slots = prev[day].slots.includes(slot)
        ? prev[day].slots.filter(s => s !== slot)
        : [...prev[day].slots, slot].sort((a, b) => TIME_OPTIONS.indexOf(a) - TIME_OPTIONS.indexOf(b));
      return { ...prev, [day]: { ...prev[day], slots } };
    });
  };

  const applyPreset = (preset) => {
    setAvailability(prev => ({
      ...prev,
      [selectedDay]: { enabled: true, slots: preset.slots },
    }));
  };

  const copyToAll = () => {
    const current = availability[selectedDay];
    const updated = {};
    DAYS.forEach(d => { updated[d] = { ...current }; });
    setAvailability(updated);
  };

  const addBlockedDate = () => {
    if (newBlockDate && !blockedDates.includes(newBlockDate)) {
      setBlockedDates(prev => [...prev, newBlockDate].sort());
      setNewBlockDate('');
    }
  };

  const removeBlockedDate = (d) => setBlockedDates(prev => prev.filter(x => x !== d));

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const firestoreAvailability = {};
      for (const [day, val] of Object.entries(availability)) {
        firestoreAvailability[day] = val.enabled ? val.slots : [];
      }
      await setDoc(doc(db, 'doctors', user.uid), { availability: firestoreAvailability, blockedDates }, { merge: true });
      setSaved(true);
      setTimeout(() => { setSaved(false); navigate('/dashboard'); }, 1200);
    } catch (e) {
      setError('Failed to save. Please try again.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  const dayData = availability[selectedDay];
  const enabledCount = Object.values(availability).filter(v => v.enabled).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-10">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            <div>
              <h1 className="font-bold text-gray-900 dark:text-white">Availability Calendar</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">{enabledCount} of 7 days enabled</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Weekly grid */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-6 pt-5 pb-3 border-b border-gray-100 dark:border-slate-700">
            <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" /> Weekly Availability
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Click a day to enable it, then click again to edit its slots</p>
          </div>

          <div className="grid grid-cols-7 gap-px bg-gray-100 dark:bg-slate-700 border-b border-gray-100 dark:border-slate-700">
            {DAYS.map((day, i) => {
              const { enabled, slots } = availability[day];
              const isSelected = selectedDay === day;
              return (
                <button
                  key={day}
                  onClick={() => { setSelectedDay(day); if (!enabled) toggleDay(day); }}
                  className={`p-3 flex flex-col items-center gap-1.5 transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : enabled
                      ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white'
                      : 'bg-gray-50 dark:bg-slate-800/60 text-gray-400 dark:text-slate-500'
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase">{SHORT[i]}</span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    isSelected ? 'bg-white/20' : enabled ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-slate-700'
                  }`}>
                    {slots.length}
                  </div>
                  <span className="text-[9px] truncate w-full text-center">
                    {enabled ? `${slots.length} slots` : 'Off'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected day slot editor */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-gray-900 dark:text-white">{selectedDay}</h3>
                <button
                  onClick={() => toggleDay(selectedDay)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${dayData.enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${dayData.enabled ? 'left-5' : 'left-0.5'}`} />
                </button>
                <span className="text-xs text-gray-500 dark:text-gray-400">{dayData.enabled ? 'Available' : 'Unavailable'}</span>
              </div>
              {dayData.enabled && (
                <button onClick={copyToAll} className="text-xs text-blue-500 hover:underline font-medium">Copy to all days</button>
              )}
            </div>

            {dayData.enabled && (
              <>
                {/* Presets */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {PRESETS.map(p => (
                    <button key={p.label} onClick={() => applyPreset(p)}
                      className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Slot grid */}
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {TIME_OPTIONS.map(slot => {
                    const on = dayData.slots.includes(slot);
                    return (
                      <button key={slot} onClick={() => toggleSlot(selectedDay, slot)}
                        className={`text-xs py-2 px-1 rounded-xl font-medium border-2 transition-all ${
                          on
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600'
                        }`}>
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {!dayData.enabled && (
              <div className="text-center py-6 text-gray-400 dark:text-slate-500">
                <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Toggle on to set availability for {selectedDay}</p>
              </div>
            )}
          </div>
        </div>

        {/* Blocked dates */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-orange-500" /> Block Specific Dates
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Block specific dates for holidays, leave, or other commitments.</p>

          <div className="flex gap-2 mb-4">
            <input type="date" value={newBlockDate} onChange={e => setNewBlockDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="flex-1 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={addBlockedDate}
              className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
              <Plus className="w-4 h-4" /> Block
            </button>
          </div>

          {blockedDates.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {blockedDates.map(d => (
                <span key={d} className="inline-flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 text-xs px-3 py-1.5 rounded-full">
                  {new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  <button onClick={() => removeBlockedDate(d)} className="hover:text-red-500 ml-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 dark:text-slate-500">No dates blocked</p>
          )}
        </div>

        {/* Status messages */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        {saved && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3">
            <CheckCircle className="w-4 h-4 shrink-0" /> Availability saved! Redirecting...
          </div>
        )}
      </div>
    </div>
  );
}
