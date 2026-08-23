import { useState } from 'react';
import { X, Calendar, Clock, Save, AlertCircle, Plus, Hourglass } from 'lucide-react';
import { authorizedFetch } from '../utils/authorizedFetch';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DEFAULT_SLOTS = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'];

const TIME_OPTIONS = [
  '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM',
  '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM',
  '5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM', '8:00 PM',
];

const SLOT_DURATIONS = [15, 20, 30, 45, 60];

/** Same availability/blockedDates data shape as src/doc-dashboard/start/Set-availability.jsx
 *  (day -> array of slot strings, blockedDates -> array of ISO date strings) so admin-set
 *  schedules stay compatible with the patient booking flow and the doctor's own dashboard.
 *  Saves via api/admin/update-doctor.js instead of writing the doctor's own doc directly. */
export default function DoctorScheduleModal({ doctor, onClose, onSaved }) {
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [availability, setAvailability] = useState(() => {
    const normalized = Object.fromEntries(DAYS.map(d => [d, { enabled: false, slots: [] }]));
    const raw = doctor.availability || {};
    for (const [day, val] of Object.entries(raw)) {
      if (!DAYS.includes(day)) continue;
      if (Array.isArray(val)) {
        normalized[day] = { enabled: val.length > 0, slots: val };
      } else if (val && typeof val === 'object') {
        normalized[day] = { enabled: val.enabled ?? false, slots: val.slots ?? [] };
      }
    }
    return normalized;
  });

  const [blockedDates, setBlockedDates] = useState(doctor.blockedDates || []);
  const [newBlockDate, setNewBlockDate] = useState('');
  const [slotDuration, setSlotDuration] = useState(doctor.slotDuration || 60);

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
    setSaving(true);
    setError('');
    try {
      const firestoreAvailability = {};
      for (const [day, val] of Object.entries(availability)) {
        firestoreAvailability[day] = val.enabled ? val.slots : [];
      }
      await authorizedFetch('/api/admin/update-doctor', {
        method: 'POST',
        body: JSON.stringify({
          doctorId: doctor.id,
          updates: { availability: firestoreAvailability, blockedDates, slotDuration: Number(slotDuration) },
        }),
      });
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const dayData = availability[selectedDay];
  const enabledCount = Object.values(availability).filter(v => v.enabled).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 rounded-t-2xl z-10">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" /> Schedule — {doctor.name || `${doctor.firstName || ''} ${doctor.lastName || ''}`.trim()}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{enabledCount} of 7 days enabled</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Slot duration */}
          <div className="bg-gray-50 dark:bg-slate-700/50 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold text-sm">
              <Hourglass className="w-4 h-4 text-blue-500" /> Slot Duration
            </div>
            <div className="flex gap-2">
              {SLOT_DURATIONS.map(mins => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setSlotDuration(mins)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border-2 transition-all ${
                    Number(slotDuration) === mins
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:border-blue-400'
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </div>

          {/* Weekly grid */}
          <div className="border border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" /> Weekly Availability
              </h3>
            </div>

            <div className="grid grid-cols-7 gap-px bg-gray-100 dark:bg-slate-700">
              {DAYS.map((day, i) => {
                const { enabled, slots } = availability[day];
                const isSelected = selectedDay === day;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => { setSelectedDay(day); if (!enabled) toggleDay(day); }}
                    className={`p-2.5 flex flex-col items-center gap-1 transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : enabled
                        ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white'
                        : 'bg-gray-50 dark:bg-slate-800/60 text-gray-400 dark:text-slate-500'
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase">{SHORT[i]}</span>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      isSelected ? 'bg-white/20' : enabled ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-slate-700'
                    }`}>
                      {slots.length}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <h4 className="font-bold text-gray-900 dark:text-white text-sm">{selectedDay}</h4>
                  <button
                    type="button"
                    onClick={() => toggleDay(selectedDay)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${dayData.enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${dayData.enabled ? 'left-5' : 'left-0.5'}`} />
                  </button>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{dayData.enabled ? 'Available' : 'Unavailable'}</span>
                </div>
                {dayData.enabled && (
                  <button type="button" onClick={copyToAll} className="text-xs text-blue-500 hover:underline font-medium">Copy to all days</button>
                )}
              </div>

              {dayData.enabled ? (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {TIME_OPTIONS.map(slot => {
                    const on = dayData.slots.includes(slot);
                    return (
                      <button key={slot} type="button" onClick={() => toggleSlot(selectedDay, slot)}
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
              ) : (
                <div className="text-center py-5 text-gray-400 dark:text-slate-500">
                  <Clock className="w-8 h-8 mx-auto mb-1.5 opacity-30" />
                  <p className="text-xs">Toggle on to set hours for {selectedDay}</p>
                </div>
              )}
            </div>
          </div>

          {/* Blocked / leave dates */}
          <div className="border border-gray-100 dark:border-slate-700 rounded-2xl p-4">
            <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-orange-500" /> Leave Dates
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Dates this doctor is unavailable (holidays, leave, etc).</p>

            <div className="flex gap-2 mb-3">
              <input type="date" value={newBlockDate} onChange={e => setNewBlockDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="flex-1 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={addBlockedDate}
                className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>

            {blockedDates.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {blockedDates.map(d => (
                  <span key={d} className="inline-flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 text-xs px-3 py-1.5 rounded-full">
                    {new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    <button type="button" onClick={() => removeBlockedDate(d)} className="hover:text-red-500 ml-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-slate-500">No leave dates set</p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} disabled={saving}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Schedule'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
