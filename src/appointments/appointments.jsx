import React, { useEffect, useState, useContext } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc } from '@firebase/firestore';
import { db } from '../firebase/config';
import { BookingTabs } from '../doc-dashboard/Tabs';
import AppointmentCard from '../components/AppointmentCard';
import { AuthContext } from '../AuthContext';
import { useToast } from '../components/Toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Plus, FileText, Search as SearchIcon, Settings as SettingsIcon } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import { deleteCalendarEventsForAppointment } from '../utils/calendarSync';
import { sendCancellationEmails } from '../utils/emailNotifications';

const QUICK_LINKS = [
  { to: '/search',          icon: SearchIcon,   label: 'Find Doctors', color: 'from-sky-500 to-cyan-600',    desc: 'Book a visit' },
  { to: '/medical-records', icon: FileText,     label: 'Records',      color: 'from-rose-500 to-red-600',    desc: 'My health data' },
  { to: '/settings',        icon: SettingsIcon, label: 'Settings',     color: 'from-blue-500 to-indigo-600', desc: 'Manage account' },
];

const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-slate-700 rounded-2xl ${className}`} />
);

function Appointments() {
  const [activeTab, setActiveTab]       = useState('Upcoming');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const { currentUser }                 = useContext(AuthContext);
  const navigate                        = useNavigate();
  const toast                           = useToast();

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'appointments'),
      where('patientId', '==', currentUser.uid)
    );

    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        startTime: d.data().date?.toDate?.() ?? new Date(d.data().date),
      }));
      setAppointments(data);
      setLoading(false);
    }, err => {
      setError('Failed to load appointments. Please try again.');
      setLoading(false);
    });

    return () => unsub();
  }, [currentUser]);

  const now = new Date();
  const filtered = appointments.filter(a => {
    if (activeTab === 'Upcoming')  return a.startTime > now && a.status !== 'cancelled';
    if (activeTab === 'Past')      return a.startTime <= now || a.status === 'completed';
    if (activeTab === 'Cancelled') return a.status === 'cancelled';
    return true;
  }).sort((a, b) =>
    activeTab === 'Upcoming' ? a.startTime - b.startTime : b.startTime - a.startTime
  );

  const handleCancelAppointment = async (appointmentId) => {
    try {
      await setDoc(doc(db, 'appointments', appointmentId), {
        status: 'cancelled',
        updatedAt: new Date(),
      }, { merge: true });
      toast.success('Appointment cancelled', 'Your appointment has been cancelled.');
      deleteCalendarEventsForAppointment(appointmentId);
      sendCancellationEmails(appointmentId);
    } catch {
      toast.error('Failed to cancel', 'Please try again or contact support.');
    }
  };

  if (error) return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
      <div className="text-center px-4">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-8 h-8 text-red-400" />
        </div>
        <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 text-blue-500 hover:underline text-sm font-medium"
        >
          Retry
        </button>
      </div>
    </div>
  );

  return (
    <PageTransition>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pt-16 pb-24 md:pb-8">
        <div className="max-w-2xl mx-auto px-4 py-8">

          {/* Quick Access */}
          <div className="mb-8">
            <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">Quick Access</p>
            <div className="flex gap-2.5 overflow-x-auto pb-1 sm:grid sm:grid-cols-4 sm:overflow-visible snap-x snap-mandatory">
              {QUICK_LINKS.map(item => (
                <Link key={item.to} to={item.to}
                  className="flex flex-col items-center gap-2 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 py-4 px-3 hover:shadow-md transition-shadow group shrink-0 w-[80px] sm:w-auto snap-start">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center group-hover:scale-105 transition-transform`}>
                    <item.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 text-center leading-tight">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Appointments</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
                {loading ? '...' : `${appointments.length} total appointment${appointments.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/search')}
              className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors shadow-md shadow-blue-200 dark:shadow-none"
            >
              <Plus className="w-4 h-4" /> Book New
            </motion.button>
          </div>

          <BookingTabs activeTab={activeTab} onTabChange={setActiveTab} />

          {loading ? (
            <div className="space-y-4 mt-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-36" />)}
            </div>
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-10 h-10 text-gray-300 dark:text-slate-600" />
              </div>
              <p className="font-semibold text-gray-600 dark:text-gray-300">
                No {activeTab.toLowerCase()} appointments
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                {activeTab === 'Upcoming' && 'Find a doctor and schedule your first visit.'}
                {activeTab === 'Past'     && 'Your past appointments will appear here.'}
                {activeTab === 'Cancelled'&& 'Cancelled appointments will appear here.'}
              </p>
              {activeTab === 'Upcoming' && (
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  onClick={() => navigate('/search')}
                  className="mt-5 inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
                >
                  Find a Doctor <Plus className="w-4 h-4" />
                </motion.button>
              )}
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="space-y-4 mt-4">
                {filtered.map((a, i) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <AppointmentCard
                      appointment={a}
                      handleCancelAppointment={handleCancelAppointment}
                      doctorId={a.doctorId}
                    />
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

export default Appointments;
