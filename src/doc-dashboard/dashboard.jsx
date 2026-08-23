import React, { useEffect, useState, useContext } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc } from '@firebase/firestore';
import { db, auth } from '../firebase/config';
import { BookingTabs } from './Tabs';
import { BookingList } from './EventList';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../AuthContext';
import { signOut } from '@firebase/auth';
import { PatientSidebar } from './PatientSidebar';
import ConnectGoogleCalendar from '../components/ConnectGoogleCalendar';
import { deleteCalendarEventsForAppointment } from '../utils/calendarSync';
import { sendCancellationEmails } from '../utils/emailNotifications';
import { useToast } from '../components/Toast';
import { Calendar, Users, Clock, CheckCircle, Settings, LogOut, Sun, Moon, TrendingUp, IndianRupee } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { createNotification } from '../utils/notifications';
import { DonutChart, BarChart } from '../components/AnalyticsCharts';

/* ─── Stat card ─── */
function StatCard({ label, value, icon: Icon, color, bg }) {
  return (
    <div className={`${bg} rounded-2xl p-5 flex items-center gap-4`}>
      <div className={`${color} p-3 rounded-xl bg-white/40 dark:bg-black/20`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm font-medium opacity-75">{label}</p>
        <p className="text-3xl font-bold leading-none mt-0.5">{value}</p>
      </div>
    </div>
  );
}

/* ─── Skeleton ─── */
const Skeleton = ({ className = '' }) => <div className={`skeleton rounded-xl ${className}`} />;

export default function DoctorDashboard() {
  const [activeTab, setActiveTab] = useState('Upcoming');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId]     = useState(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));

  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext);
  const toast = useToast();

  /* ── Real-time appointments via onSnapshot ── */
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(collection(db, 'appointments'), where('doctorId', '==', user.uid));
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        startTime: d.data().date?.toDate?.() ?? new Date(d.data().date),
        endTime:   new Date((d.data().date?.toDate?.() ?? new Date(d.data().date)).getTime() + 3600000),
        title:    `Appointment with ${d.data().patientName}`,
        location: 'Online Consultation',
      }));
      setAppointments(data);
      setLoading(false);
    }, err => { console.error(err); setError('Failed to load appointments'); setLoading(false); });

    return () => unsub();
  }, []);

  /* ── Dark mode toggle ── */
  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');

  const today   = appointments.filter(a => format(a.startTime, 'yyyy-MM-dd') === todayStr && a.status !== 'cancelled');
  const upcoming = appointments.filter(a => a.startTime > now && a.status !== 'cancelled');
  const completed = appointments.filter(a => a.status === 'completed');

  const filtered = appointments.filter(a => {
    switch (activeTab) {
      case 'Upcoming':  return a.startTime > now && a.status !== 'cancelled';
      case 'Past':      return a.startTime < now || a.status === 'completed';
      case 'Cancelled': return a.status === 'cancelled';
      default: return true;
    }
  });

  const handleEdit = async (booking, action) => {
    if (action === 'view') {
      setSelectedPatientId(booking.patientId);
      setSelectedAppointmentId(booking.id);
      setIsSidebarOpen(true);
    }
    if (action === 'delete') {
      try {
        await setDoc(doc(db, 'appointments', booking.id), { status: 'cancelled', updatedAt: new Date() }, { merge: true });
        await createNotification({
          userId: booking.patientId,
          message: `Your appointment on ${format(booking.startTime, 'MMM d')} has been cancelled by the doctor.`,
          type: 'appointment_cancelled',
          appointmentId: booking.id,
        });
        deleteCalendarEventsForAppointment(booking.id);
        sendCancellationEmails(booking.id);
      } catch (err) {
        toast.error('Failed to cancel', 'Please try again.');
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const getUserInitial = (email) => (email ? email.charAt(0).toUpperCase() : 'D');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">

      {/* ── Top Bar ── */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="CareFlow" className="w-8 h-8 object-contain" />
            <span className="font-bold text-gray-900 dark:text-white">CareFlow</span>
            <span className="hidden sm:inline text-gray-400 dark:text-slate-500 text-sm">/ Doctor Portal</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Dark mode */}
            <button onClick={toggleDark} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
              {darkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Set Availability */}
            <button
              onClick={() => navigate('/dashboard/start')}
              className="hidden sm:flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              <Settings className="w-4 h-4" /> Availability
            </button>

            {/* Avatar + menu */}
            <div className="relative">
              <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center justify-center w-9 h-9 rounded-full overflow-hidden focus:outline-none ring-2 ring-blue-500">
                {currentUser?.photoURL ? (
                  <img src={currentUser.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white font-bold">
                    {getUserInitial(currentUser?.email)}
                  </div>
                )}
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden animate-fade-in">
                  <div className="p-3 border-b border-gray-100 dark:border-slate-700">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{currentUser?.displayName || currentUser?.email}</p>
                    <p className="text-xs text-blue-500">Doctor</p>
                  </div>
                  <button onClick={() => { navigate('/dashboard/start'); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2">
                    <Settings className="w-4 h-4" /> Set Availability
                  </button>
                  <button onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2">
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="max-w-5xl mx-auto px-4 py-8 animate-fade-in">

        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Doctor Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {format(now, 'EEEE, MMMM d, yyyy')} — {today.length} appointment{today.length !== 1 ? 's' : ''} today
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Today" value={loading ? '—' : today.length}
            icon={Calendar} color="text-blue-600"
            bg="bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100" />
          <StatCard label="Upcoming" value={loading ? '—' : upcoming.length}
            icon={Clock} color="text-emerald-600"
            bg="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100" />
          <StatCard label="Total Patients" value={loading ? '—' : appointments.length}
            icon={Users} color="text-violet-600"
            bg="bg-violet-50 dark:bg-violet-900/30 text-violet-900 dark:text-violet-100" />
          <StatCard label="Completed" value={loading ? '—' : completed.length}
            icon={CheckCircle} color="text-orange-600"
            bg="bg-orange-50 dark:bg-orange-900/30 text-orange-900 dark:text-orange-100" />
        </div>

        {/* Integrations */}
        <div className="mb-8">
          <ConnectGoogleCalendar />
        </div>

        {/* Analytics Row */}
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
            { label: 'Cancelled', value: appointments.filter(a => a.status === 'cancelled').length, color: '#f59e0b' },
          ];
          const revenue = completed.length * 500;
          return (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {/* Monthly bar chart */}
              <div className="sm:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-500" /> Monthly Appointments
                  </h3>
                  <span className="text-xs text-gray-400">Last 6 months</span>
                </div>
                <BarChart data={months} height={140} color="#3b82f6" />
              </div>
              {/* Donut + Revenue */}
              <div className="space-y-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-5">
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-3">Status Breakdown</h3>
                  <DonutChart data={donutData} size={120} strokeWidth={14} label={appointments.length} sublabel="total" />
                </div>
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-5 text-white">
                  <div className="flex items-center gap-2 mb-1">
                    <IndianRupee className="w-4 h-4 opacity-80" />
                    <span className="text-xs font-medium opacity-80">Revenue (simulated)</span>
                  </div>
                  <p className="text-2xl font-black">₹{(revenue).toLocaleString('en-IN')}</p>
                  <p className="text-xs opacity-70 mt-1">₹500 × {completed.length} consultations</p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Today's schedule highlight */}
        {!loading && today.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-6 mb-6">
            <h2 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Sun className="w-5 h-5 text-yellow-500" /> Today's Schedule
            </h2>
            <div className="space-y-3">
              {today.map(a => (
                <div key={a.id} className="flex items-center gap-4 p-3 bg-blue-50 dark:bg-slate-700 rounded-xl">
                  <div className="text-center min-w-[52px] bg-white dark:bg-slate-600 rounded-lg p-2">
                    <div className="text-xs text-gray-400">Today</div>
                    <div className="font-bold text-blue-600">{a.timeSlot?.split(' ')[0]}</div>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white">{a.patientName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{a.timeSlot}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    a.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>{a.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All appointments with tabs */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 dark:text-white mb-5">All Appointments</h2>

          <BookingTabs activeTab={activeTab} onTabChange={setActiveTab} />

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-14 h-14 text-gray-200 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No {activeTab.toLowerCase()} appointments</p>
            </div>
          ) : (
            <BookingList bookings={filtered} onEdit={handleEdit} />
          )}
        </div>

        {/* Set availability CTA */}
        {!loading && appointments.length === 0 && (
          <div className="mt-6 bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white text-center">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-80" />
            <h3 className="font-bold text-lg mb-2">Set Your Availability</h3>
            <p className="text-blue-100 text-sm mb-4">Let patients know when you're available to book appointments.</p>
            <button
              onClick={() => navigate('/dashboard/start')}
              className="bg-white text-blue-600 font-semibold px-6 py-2.5 rounded-xl hover:bg-blue-50 transition-colors"
            >
              Set Availability →
            </button>
          </div>
        )}
      </main>

      <PatientSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        patientId={selectedPatientId}
        appointmentId={selectedAppointmentId}
      />
    </div>
  );
}
