import { useState, useEffect, useContext, useMemo } from 'react';
import { collection, onSnapshot } from '@firebase/firestore';
import { signOut } from '@firebase/auth';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase/config';
import { AuthContext } from '../AuthContext';
import { useToast } from '../components/Toast';
import { authorizedFetch } from '../utils/authorizedFetch';
import DoctorFormModal from './DoctorFormModal';
import DoctorScheduleModal from './DoctorScheduleModal';
import {
  Users, UserCheck, UserX, Stethoscope, Search, Plus, Sun, Moon, LogOut,
  Pencil, CalendarClock, ShieldCheck, MapPin, Mail, Briefcase,
} from 'lucide-react';
import { format } from 'date-fns';

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

const Skeleton = ({ className = '' }) => <div className={`skeleton rounded-xl ${className}`} />;

export default function AdminDashboard() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');

  const [formModal, setFormModal] = useState(null); // null | { mode: 'add' } | { mode: 'edit', doctor }
  const [scheduleDoctor, setScheduleDoctor] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));

  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext);
  const toast = useToast();

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'doctors'),
      snap => {
        setDoctors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      err => { console.error(err); setError('Failed to load doctors'); setLoading(false); }
    );
    return () => unsub();
  }, []);

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const specialties = useMemo(
    () => [...new Set(doctors.map(d => d.specialty).filter(Boolean))].sort(),
    [doctors]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return doctors.filter(d => {
      const isActive = d.active !== false;
      if (statusFilter === 'active' && !isActive) return false;
      if (statusFilter === 'inactive' && isActive) return false;
      if (specialtyFilter !== 'all' && d.specialty !== specialtyFilter) return false;
      if (!q) return true;
      const name = d.name || `${d.firstName || ''} ${d.lastName || ''}`.trim();
      return [name, d.specialty, d.location, d.email].some(f => (f || '').toLowerCase().includes(q));
    });
  }, [doctors, search, statusFilter, specialtyFilter]);

  const activeCount = doctors.filter(d => d.active !== false).length;
  const inactiveCount = doctors.length - activeCount;

  const handleToggleActive = async (doctor) => {
    const nextActive = !(doctor.active !== false);
    setTogglingId(doctor.id);
    try {
      await authorizedFetch('/api/admin/update-doctor', {
        method: 'POST',
        body: JSON.stringify({ doctorId: doctor.id, updates: { active: nextActive } }),
      });
      toast.success(nextActive ? 'Doctor activated' : 'Doctor deactivated');
    } catch (err) {
      toast.error('Failed to update status', err.message);
    } finally {
      setTogglingId(null);
    }
  };

  const handleFormSaved = () => {
    toast.success(formModal.mode === 'add' ? 'Doctor added' : 'Doctor updated');
    setFormModal(null);
  };

  const handleScheduleSaved = () => {
    toast.success('Schedule updated');
    setScheduleDoctor(null);
  };

  const getInitial = (d) => (d.name || d.firstName || d.email || 'D').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
      {/* ── Top Bar ── */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="CareFlow" className="w-8 h-8 object-contain" />
            <span className="font-bold text-gray-900 dark:text-white">CareFlow</span>
            <span className="hidden sm:inline text-gray-400 dark:text-slate-500 text-sm">/ Admin Portal</span>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={toggleDark} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
              {darkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5" />}
            </button>

            <div className="relative">
              <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center justify-center w-9 h-9 rounded-full overflow-hidden focus:outline-none ring-2 ring-blue-500">
                {currentUser?.photoURL ? (
                  <img src={currentUser.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white font-bold">
                    {(currentUser?.email || 'A').charAt(0).toUpperCase()}
                  </div>
                )}
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden animate-fade-in">
                  <div className="p-3 border-b border-gray-100 dark:border-slate-700">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{currentUser?.displayName || currentUser?.email}</p>
                    <p className="text-xs text-blue-500">Admin</p>
                  </div>
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
      <main className="max-w-6xl mx-auto px-4 py-8 animate-fade-in">
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')} — manage doctors on CareFlow</p>
          </div>
          <button
            onClick={() => setFormModal({ mode: 'add' })}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Doctor
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Doctors" value={loading ? '—' : doctors.length}
            icon={Users} color="text-blue-600"
            bg="bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100" />
          <StatCard label="Active" value={loading ? '—' : activeCount}
            icon={UserCheck} color="text-emerald-600"
            bg="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100" />
          <StatCard label="Inactive" value={loading ? '—' : inactiveCount}
            icon={UserX} color="text-orange-600"
            bg="bg-orange-50 dark:bg-orange-900/30 text-orange-900 dark:text-orange-100" />
          <StatCard label="Specializations" value={loading ? '—' : specialties.length}
            icon={Stethoscope} color="text-violet-600"
            bg="bg-violet-50 dark:bg-violet-900/30 text-violet-900 dark:text-violet-100" />
        </div>

        {/* Toolbar */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-4 mb-6 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, specialty, location, email..."
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl pl-9 pr-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select value={specialtyFilter} onChange={e => setSpecialtyFilter(e.target.value)}
            className="bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Specialties</option>
            {specialties.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Doctor list */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 dark:text-white mb-5">
            Doctors {!loading && <span className="text-gray-400 font-normal">({filtered.length})</span>}
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Stethoscope className="w-14 h-14 text-gray-200 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                {doctors.length === 0 ? 'No doctors yet — add the first one.' : 'No doctors match your filters.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(doctor => {
                const isActive = doctor.active !== false;
                const name = doctor.name || `${doctor.firstName || ''} ${doctor.lastName || ''}`.trim() || 'Unnamed Doctor';
                const workingDays = Object.values(doctor.availability || {}).filter(v => Array.isArray(v) ? v.length > 0 : v?.slots?.length > 0).length;
                return (
                  <div key={doctor.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl border border-gray-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                      {doctor.image ? <img src={doctor.image} alt={name} className="w-full h-full object-cover" /> : getInitial(doctor)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">{name}</p>
                        {doctor.verified && <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" aria-label="Verified" />}
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
                        }`}>
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {doctor.specialty || 'No specialty set'}</span>
                        {doctor.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {doctor.location}</span>}
                        <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {doctor.email}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-400 dark:text-slate-500">
                        <span>{workingDays} day{workingDays !== 1 ? 's' : ''}/week</span>
                        <span>{doctor.slotDuration || 60} min slots</span>
                        <span>{(doctor.blockedDates || []).length} leave date{(doctor.blockedDates || []).length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setScheduleDoctor(doctor)}
                        title="Manage schedule"
                        className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        <CalendarClock className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setFormModal({ mode: 'edit', doctor })}
                        title="Edit profile"
                        className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(doctor)}
                        disabled={togglingId === doctor.id}
                        className={`text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-50 ${
                          isActive
                            ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400'
                            : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400'
                        }`}
                      >
                        {togglingId === doctor.id ? '...' : isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {formModal && (
        <DoctorFormModal
          mode={formModal.mode}
          doctor={formModal.doctor}
          onClose={() => setFormModal(null)}
          onSaved={handleFormSaved}
        />
      )}

      {scheduleDoctor && (
        <DoctorScheduleModal
          doctor={scheduleDoctor}
          onClose={() => setScheduleDoctor(null)}
          onSaved={handleScheduleSaved}
        />
      )}
    </div>
  );
}
