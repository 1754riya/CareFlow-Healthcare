import React, { useEffect, useState, useContext } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from '@firebase/firestore';
import { db } from '../firebase/config';
import { AuthContext } from '../AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, CheckCircle, XCircle, Search,
  ChevronRight, User, Activity, FileText,
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { TopSpecialties } from '../components/TopSpecialties';
import { SearchBar } from '../components/SearchBar';
import { DonutChart, BarChart } from '../components/AnalyticsCharts';

/* ─── Small stat card ─── */
function StatCard({ label, value, icon: Icon, colorClass, bgClass }) {
  return (
    <div className={`${bgClass} rounded-2xl p-5 flex items-center gap-4 animate-fade-in`}>
      <div className={`${colorClass} p-3 rounded-xl bg-white/40 dark:bg-black/20`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm font-medium opacity-75">{label}</p>
        <p className="text-3xl font-bold leading-none mt-0.5">{value}</p>
      </div>
    </div>
  );
}

/* ─── Profile completion ring ─── */
function ProfileCompletion({ patient }) {
  const fields = ['firstName', 'lastName', 'age', 'gender', 'bloodGroup', 'phone', 'address'];
  const filled = fields.filter(f => patient?.[f]).length;
  const pct = Math.round((filled / fields.length) * 100);
  const r = 15.9;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <User className="w-4 h-4 text-blue-500" /> Profile Health
        </h3>
        <Link to="/settings" className="text-blue-500 text-sm hover:underline flex items-center gap-1">
          Complete <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="flex items-center gap-5">
        <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90 shrink-0">
          <circle cx="18" cy="18" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3.5" className="dark:stroke-slate-600" />
          <circle
            cx="18" cy="18" r={r} fill="none" stroke="#3b82f6" strokeWidth="3.5"
            strokeDasharray={`${dash.toFixed(1)} ${(circ - dash).toFixed(1)}`}
            strokeLinecap="round"
          />
        </svg>
        <div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{pct}%</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{filled}/{fields.length} fields complete</p>
          {pct < 100 && (
            <Link to="/settings" className="text-xs text-blue-500 hover:underline mt-1 block">
              Add missing info →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Mini appointment card ─── */
function MiniAppointmentCard({ appt }) {
  const date = appt.startTime instanceof Date ? appt.startTime : new Date(appt.startTime);
  const statusColor = {
    confirmed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
    pending:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
    completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  }[appt.status] ?? 'bg-gray-100 text-gray-700';

  return (
    <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-slate-700/60 rounded-xl hover:shadow-sm transition-shadow">
      <div className="text-center min-w-[52px] bg-white dark:bg-slate-700 rounded-xl p-2 shadow-sm">
        <div className="text-xs text-gray-400 uppercase tracking-wide">{format(date, 'MMM')}</div>
        <div className="text-2xl font-bold text-blue-600 leading-none">{format(date, 'dd')}</div>
        <div className="text-xs text-gray-400">{format(date, 'yyyy')}</div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 dark:text-white truncate">Dr. {appt.doctorName}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{appt.timeSlot}</p>
      </div>
      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor}`}>
        {appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
      </span>
    </div>
  );
}

/* ─── Skeleton ─── */
function Skeleton({ className = '' }) {
  return <div className={`skeleton rounded-xl ${className}`} />;
}

/* ─── Quick action button ─── */
function QuickAction({ icon: Icon, label, to, color, onClick }) {
  const cls = `flex flex-col items-center gap-1.5 p-2 sm:p-4 rounded-2xl ${color} cursor-pointer hover:scale-105 transition-transform min-h-[72px] justify-center`;
  if (to) return (
    <Link to={to} className={cls}>
      <Icon className="w-6 h-6" />
      <span className="text-xs font-semibold text-center leading-tight">{label}</span>
    </Link>
  );
  return (
    <button onClick={onClick} className={cls}>
      <Icon className="w-6 h-6" />
      <span className="text-xs font-semibold text-center leading-tight">{label}</span>
    </button>
  );
}

/* ─── Main dashboard ─── */
export default function PatientDashboard() {
  const { currentUser } = useContext(AuthContext);
  const [appointments, setAppointments] = useState([]);
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  /* real-time appointments */
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'appointments'), where('patientId', '==', currentUser.uid));
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        startTime: d.data().date?.toDate?.() ?? new Date(d.data().date),
      }));
      setAppointments(data);
      setLoading(false);
    }, err => { console.error(err); setLoading(false); });
    return () => unsub();
  }, [currentUser]);

  /* patient profile */
  useEffect(() => {
    if (!currentUser) return;
    getDoc(doc(db, 'patients', currentUser.uid)).then(snap => {
      if (snap.exists()) setPatient(snap.data());
    });
  }, [currentUser]);

  const now = new Date();
  const upcoming  = appointments.filter(a => a.startTime > now && a.status !== 'cancelled').sort((a, b) => a.startTime - b.startTime);
  const completed = appointments.filter(a => a.status === 'completed');
  const cancelled = appointments.filter(a => a.status === 'cancelled');
  const firstName = patient?.firstName || currentUser?.displayName?.split(' ')[0] || 'there';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pt-16 pb-24 md:pb-8">
      <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in">

        {/* ── Welcome header ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              {greeting}, {firstName}! 👋
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
              Here's your health overview for today, {format(now, 'MMMM d, yyyy')}.
            </p>
          </div>
          <button
            onClick={() => navigate('/search')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
          >
            <Search className="w-4 h-4" /> Find a Doctor
          </button>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total" value={loading ? '—' : appointments.length}
            icon={Calendar} colorClass="text-blue-600"
            bgClass="bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100" />
          <StatCard label="Upcoming" value={loading ? '—' : upcoming.length}
            icon={Clock} colorClass="text-emerald-600"
            bgClass="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100" />
          <StatCard label="Completed" value={loading ? '—' : completed.length}
            icon={CheckCircle} colorClass="text-violet-600"
            bgClass="bg-violet-50 dark:bg-violet-900/30 text-violet-900 dark:text-violet-100" />
          <StatCard label="Cancelled" value={loading ? '—' : cancelled.length}
            icon={XCircle} colorClass="text-rose-600"
            bgClass="bg-rose-50 dark:bg-rose-900/30 text-rose-900 dark:text-rose-100" />
        </div>

        {/* ── Quick actions ── */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-8">
          <QuickAction icon={Search}      label="Find Doctors"      onClick={() => navigate('/search')}
            color="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" />
          <QuickAction icon={Calendar}    label="Appointments"      to="/appointments"
            color="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" />
          <QuickAction icon={FileText}    label="Records"           to="/medical-records"
            color="bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300" />
        </div>

        {/* ── Analytics Row ── */}
        {!loading && appointments.length > 0 && (() => {
          const months = Array.from({ length: 6 }, (_, i) => {
            const d = subMonths(now, 5 - i);
            const start = startOfMonth(d);
            const end = endOfMonth(d);
            const count = appointments.filter(a => a.startTime >= start && a.startTime <= end).length;
            return { label: format(d, 'MMM'), value: count };
          });
          const donutData = [
            { label: 'Upcoming',  value: upcoming.length,  color: '#3b82f6' },
            { label: 'Completed', value: completed.length, color: '#10b981' },
            { label: 'Cancelled', value: cancelled.length, color: '#f43f5e' },
          ];
          return (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="sm:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500" /> Appointment Trends
                  </h3>
                  <span className="text-xs text-gray-400">Last 6 months</span>
                </div>
                <BarChart data={months} height={130} color="#8b5cf6" />
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-5 flex flex-col items-center justify-center">
                <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-4 self-start">Status Overview</h3>
                <DonutChart data={donutData} size={120} strokeWidth={14} label={appointments.length} sublabel="total" />
              </div>
            </div>
          );
        })()}

        {/* ── Main two-column grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

          {/* Upcoming appointments */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" /> Upcoming Appointments
              </h2>
              <Link to="/appointments" className="text-blue-500 text-sm hover:underline flex items-center gap-1">
                View all <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : upcoming.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-14 h-14 text-gray-200 dark:text-slate-600 mx-auto mb-3" />
                <p className="font-medium text-gray-500 dark:text-gray-400">No upcoming appointments</p>
                <button
                  onClick={() => navigate('/search')}
                  className="mt-4 text-blue-500 hover:underline text-sm font-medium"
                >
                  Book your first appointment →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.slice(0, 4).map(a => <MiniAppointmentCard key={a.id} appt={a} />)}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-5">
            <ProfileCompletion patient={patient} />

            {/* Medical Records CTA */}
            <Link to="/medical-records" className="block bg-gradient-to-br from-violet-600 to-purple-700 rounded-2xl p-5 text-white hover:shadow-lg transition-shadow">
              <FileText className="w-7 h-7 mb-2 opacity-80" />
              <h3 className="font-bold mb-1">Medical Records</h3>
              <p className="text-xs opacity-80 leading-relaxed">
                Store allergies, medications, and emergency contacts for your doctor.
              </p>
              <span className="inline-block mt-3 bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                View Records →
              </span>
            </Link>
          </div>
        </div>

        {/* ── Quick Search ── */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-500" /> Find a Doctor
          </h2>
          <SearchBar />
        </div>

        {/* ── Top Specialties ── */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-500" /> Browse by Specialty
          </h2>
          <TopSpecialties />
        </div>

      </div>
    </div>
  );
}
