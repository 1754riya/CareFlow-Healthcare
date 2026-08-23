import { useState, useContext, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from '@firebase/firestore';
import { db } from '../firebase/config';
import { AuthContext } from '../AuthContext';
import { useToast } from '../components/Toast';
import PageTransition from '../components/PageTransition';
import {
  Activity, Utensils, Pill, History, ChevronRight,
  TrendingUp, TrendingDown, Minus, Clock, Plus, X, Check,
} from 'lucide-react';

/* ── Constants ──────────────────────────────────────────────────── */
const MEAL_PLAN = {
  Breakfast: [
    { meal: 'Oatmeal with fruits', calories: 320 },
    { meal: 'Whole wheat toast + egg', calories: 280 },
    { meal: 'Fruit smoothie + nuts', calories: 350 },
  ],
  Lunch: [
    { meal: 'Dal rice + salad', calories: 480 },
    { meal: 'Vegetable curry + roti', calories: 420 },
    { meal: 'Brown rice + paneer', calories: 510 },
  ],
  Dinner: [
    { meal: 'Grilled chicken + veggies', calories: 390 },
    { meal: 'Dal + 2 rotis', calories: 340 },
    { meal: 'Khichdi + curd', calories: 360 },
  ],
};

const HEALTH_TIPS = [
  '🌱 Start your day with warm lemon water',
  '💧 Drink at least 8 glasses of water daily',
  '🧘 Practice 10 minutes of morning yoga',
  '🥗 Include seasonal vegetables in your meals',
  '⏰ Maintain consistent meal timings',
  '🚶 Walk for 30 minutes every day',
  '😴 Get 7–8 hours of quality sleep',
  '🫁 Practice deep breathing for stress relief',
];

const BMI_BANDS = [
  { max: 18.5, label: 'Underweight', color: 'text-blue-600', bg: 'bg-blue-500', advice: 'Consider increasing calorie intake with nutrient-dense foods.' },
  { max: 25,   label: 'Normal weight', color: 'text-green-600', bg: 'bg-green-500', advice: 'Great! Maintain your balanced diet and active lifestyle.' },
  { max: 30,   label: 'Overweight', color: 'text-amber-600', bg: 'bg-amber-500', advice: 'Focus on portion control and regular physical activity.' },
  { max: Infinity, label: 'Obese', color: 'text-red-600', bg: 'bg-red-500', advice: 'Consult a healthcare provider for a personalised plan.' },
];

function getBMIBand(bmi) {
  return BMI_BANDS.find(b => bmi < b.max);
}

function getBMIPercent(bmi) {
  const clamped = Math.min(Math.max(bmi, 10), 45);
  return ((clamped - 10) / 35) * 100;
}

/* ── Tab Button ─────────────────────────────────────────────────── */
function TabBtn({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
        active
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

/* ── BMI Calculator Tab ─────────────────────────────────────────── */
function BMITab({ currentUser }) {
  const toast = useToast();
  const [unit, setUnit] = useState('metric');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const calculate = () => {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (!h || !w || h <= 0 || w <= 0) {
      toast.warning('Missing values', 'Please enter valid height and weight.');
      return;
    }

    const hm = unit === 'imperial' ? h * 0.0254 : h / 100;
    const wk = unit === 'imperial' ? w * 0.453592 : w;
    const bmi = parseFloat((wk / (hm * hm)).toFixed(1));
    setResult({ bmi, band: getBMIBand(bmi) });
  };

  const save = async () => {
    if (!currentUser) { toast.warning('Sign in required', 'Log in to save BMI history.'); return; }
    if (!result) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'bmiHistory'), {
        userId: currentUser.uid,
        bmi: result.bmi,
        category: result.band.label,
        height: parseFloat(height),
        weight: parseFloat(weight),
        unit,
        recordedAt: serverTimestamp(),
      });
      toast.success('Saved!', 'BMI recorded to your history.');
    } catch {
      toast.error('Save failed', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Inputs */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6">
        <h2 className="font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" /> BMI Calculator
        </h2>

        {/* Unit toggle */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-slate-600 mb-5">
          {['metric', 'imperial'].map(u => (
            <button key={u} onClick={() => setUnit(u)}
              className={`flex-1 py-2 text-sm font-semibold capitalize transition-colors ${
                unit === u ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}>
              {u} {u === 'metric' ? '(cm/kg)' : '(in/lbs)'}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Height ({unit === 'metric' ? 'cm' : 'inches'})
            </label>
            <input
              type="number" value={height} onChange={e => setHeight(e.target.value)}
              placeholder={unit === 'metric' ? 'e.g. 170' : 'e.g. 67'}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Weight ({unit === 'metric' ? 'kg' : 'lbs'})
            </label>
            <input
              type="number" value={weight} onChange={e => setWeight(e.target.value)}
              placeholder={unit === 'metric' ? 'e.g. 65' : 'e.g. 143'}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={calculate}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Calculate BMI
          </motion.button>
        </div>
      </div>

      {/* Result */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6">
        <h2 className="font-bold text-gray-900 dark:text-white mb-5">Your Result</h2>

        <AnimatePresence mode="wait">
          {result ? (
            <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* Big number */}
              <div className="text-center mb-6">
                <p className="text-6xl font-black text-gray-900 dark:text-white mb-1">{result.bmi}</p>
                <p className={`text-lg font-bold ${result.band.color}`}>{result.band.label}</p>
              </div>

              {/* BMI gauge bar */}
              <div className="mb-5">
                <div className="h-3 rounded-full bg-gradient-to-r from-blue-400 via-green-400 via-amber-400 to-red-500 relative mb-1">
                  <motion.div
                    initial={{ left: 0 }}
                    animate={{ left: `${getBMIPercent(result.bmi)}%` }}
                    transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-gray-800 dark:border-white rounded-full shadow-lg"
                    style={{ transform: 'translate(-50%, -50%)' }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>10</span><span>18.5</span><span>25</span><span>30</span><span>45</span>
                </div>
              </div>

              {/* Advice */}
              <div className={`${result.band.bg} bg-opacity-10 dark:bg-opacity-20 rounded-xl p-4 mb-5`}>
                <p className="text-sm text-gray-700 dark:text-gray-300">{result.band.advice}</p>
              </div>

              {/* Health tip */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-5">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-2">Daily Health Tip</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {HEALTH_TIPS[Math.floor(result.bmi * 100) % HEALTH_TIPS.length]}
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={save} disabled={saving}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                {saving
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Check className="w-4 h-4" />
                }
                {saving ? 'Saving...' : 'Save to History'}
              </motion.button>
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
              <Activity className="w-14 h-14 text-gray-200 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-gray-400 dark:text-slate-500 font-medium">Enter your measurements</p>
              <p className="text-sm text-gray-300 dark:text-slate-600 mt-1">to see your BMI result</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Meal Planner Tab ───────────────────────────────────────────── */
function MealTab() {
  const totalCalories = Object.values(MEAL_PLAN)
    .flat()
    .reduce((sum, item) => sum + item.calories, 0) / 3;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Utensils className="w-5 h-5 text-emerald-600" /> Sample Meal Plan
        </h2>
        <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full font-semibold">
          ~{Math.round(totalCalories)} kcal/day
        </span>
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        {Object.entries(MEAL_PLAN).map(([meal, items]) => {
          const icons = { Breakfast: '🌅', Lunch: '☀️', Dinner: '🌙' };
          return (
            <div key={meal} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">
                {icons[meal]} {meal}
              </h3>
              <div className="space-y-3">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-slate-700 last:border-0">
                    <p className="text-sm text-gray-700 dark:text-gray-300">{item.meal}</p>
                    <span className="text-xs font-semibold bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">
                      {item.calories} kcal
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 text-sm text-amber-700 dark:text-amber-300">
        💡 This is a general guide. Consult a registered dietitian for a personalised plan.
      </div>
    </div>
  );
}

/* ── Medication Tracker Tab ─────────────────────────────────────── */
function MedsTab({ currentUser }) {
  const toast = useToast();
  const [meds, setMeds] = useState([]);
  const [name, setName] = useState('');
  const [time, setTime] = useState('');
  const [freq, setFreq] = useState('Daily');

  const add = async () => {
    if (!name || !time) { toast.warning('Missing info', 'Please enter medication name and time.'); return; }
    const newMed = { id: Date.now(), name, time, freq, takenToday: false };
    setMeds(prev => [...prev, newMed]);
    setName(''); setTime('');
    toast.success('Added', `${name} added to your tracker.`);
  };

  const toggleTaken = (id) => {
    setMeds(prev => prev.map(m => m.id === id ? { ...m, takenToday: !m.takenToday } : m));
  };

  const remove = (id) => {
    setMeds(prev => prev.filter(m => m.id !== id));
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Add medication */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6">
        <h2 className="font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
          <Plus className="w-5 h-5 text-purple-600" /> Add Medication
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Medication Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Metformin"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Time</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Frequency</label>
            <select value={freq} onChange={e => setFreq(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              {['Daily', 'Twice daily', 'Three times daily', 'Weekly', 'As needed'].map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={add}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
            <Plus className="w-4 h-4" /> Add Medication
          </motion.button>
        </div>
      </div>

      {/* Medication list */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6">
        <h2 className="font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
          <Pill className="w-5 h-5 text-purple-600" /> Today's Medications
        </h2>
        {meds.length === 0 ? (
          <div className="text-center py-12">
            <Pill className="w-12 h-12 text-gray-200 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No medications added</p>
            <p className="text-sm text-gray-300 dark:text-slate-600 mt-1">Add your first medication →</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {meds.map(med => (
                <motion.div key={med.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
                  className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                    med.takenToday
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-gray-50 dark:bg-slate-700 border-gray-100 dark:border-slate-600'
                  }`}>
                  <button onClick={() => toggleTaken(med.id)}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                      med.takenToday ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 dark:border-slate-500'
                    }`}>
                    {med.takenToday && <Check className="w-3.5 h-3.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${med.takenToday ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                      {med.name}
                    </p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" /> {med.time} · {med.freq}
                    </p>
                  </div>
                  <button onClick={() => remove(med.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-gray-400 hover:text-red-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            {meds.length > 0 && (
              <p className="text-xs text-center text-gray-400 pt-2">
                {meds.filter(m => m.takenToday).length}/{meds.length} taken today
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── BMI History Tab ────────────────────────────────────────────── */
function HistoryTab({ currentUser }) {
  const toast = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    getDocs(query(
      collection(db, 'bmiHistory'),
      where('userId', '==', currentUser.uid)
    ))
      .then(snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.recordedAt?.seconds ?? 0) - (a.recordedAt?.seconds ?? 0));
        setRecords(list);
      })
      .catch(() => toast.error('Could not load history'))
      .finally(() => setLoading(false));
  }, [currentUser]);

  const trend = (i) => {
    if (i >= records.length - 1) return null;
    const diff = records[i].bmi - records[i + 1].bmi;
    if (Math.abs(diff) < 0.1) return <Minus className="w-4 h-4 text-gray-400" />;
    return diff > 0
      ? <TrendingUp className="w-4 h-4 text-red-500" />
      : <TrendingDown className="w-4 h-4 text-green-500" />;
  };

  if (!currentUser) return (
    <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700">
      <History className="w-12 h-12 text-gray-200 dark:text-slate-600 mx-auto mb-3" />
      <p className="font-medium text-gray-500">Sign in to view history</p>
    </div>
  );

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-gray-200 dark:bg-slate-700 animate-pulse" />)}</div>;

  if (records.length === 0) return (
    <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700">
      <History className="w-12 h-12 text-gray-200 dark:text-slate-600 mx-auto mb-3" />
      <p className="font-medium text-gray-500">No history yet</p>
      <p className="text-sm text-gray-400 mt-1">Calculate and save your BMI to track progress</p>
    </div>
  );

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Latest BMI', value: records[0]?.bmi },
          { label: 'Category', value: records[0]?.category },
          { label: 'Records', value: records.length },
        ].map(stat => (
          <div key={stat.label} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 text-center">
            <p className="text-xl font-black text-gray-900 dark:text-white">{stat.value}</p>
            <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {records.map((r, i) => {
          const band = getBMIBand(r.bmi);
          const date = r.recordedAt?.toDate ? r.recordedAt.toDate() : new Date();
          return (
            <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${band.bg} bg-opacity-15 dark:bg-opacity-25`}>
                <span className={`font-black text-sm ${band.color}`}>{r.bmi}</span>
              </div>
              <div className="flex-1">
                <p className={`font-semibold text-sm ${band.color}`}>{r.category}</p>
                <p className="text-xs text-gray-400 mt-0.5">{r.weight}{r.unit === 'metric' ? 'kg' : 'lbs'} · {r.height}{r.unit === 'metric' ? 'cm' : 'in'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">{date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                <div className="flex justify-end mt-1">{trend(i)}</div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function BMITracker() {
  const { currentUser } = useContext(AuthContext);
  const [tab, setTab] = useState('bmi');

  const tabs = [
    { id: 'bmi',     label: 'BMI Calculator', icon: Activity },
    { id: 'meal',    label: 'Meal Planner',   icon: Utensils },
    { id: 'meds',    label: 'Medications',    icon: Pill },
    { id: 'history', label: 'History',        icon: History },
  ];

  return (
    <PageTransition>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pt-16 pb-24 md:pb-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-8 px-4">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="w-6 h-6" /> Health Tracker
            </h1>
            <p className="text-blue-100 text-sm mt-1">BMI · Meal Planning · Medication Reminders · Progress History</p>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-6">
          {/* Tabs */}
          <div className="flex gap-2 mb-6 bg-white dark:bg-slate-800 rounded-2xl p-2 border border-gray-100 dark:border-slate-700 overflow-x-auto">
            {tabs.map(t => (
              <TabBtn key={t.id} icon={t.icon} label={t.label} active={tab === t.id} onClick={() => setTab(t.id)} />
            ))}
          </div>

          {/* Content */}
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              {tab === 'bmi'     && <BMITab     currentUser={currentUser} />}
              {tab === 'meal'    && <MealTab />}
              {tab === 'meds'    && <MedsTab    currentUser={currentUser} />}
              {tab === 'history' && <HistoryTab currentUser={currentUser} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  );
}
