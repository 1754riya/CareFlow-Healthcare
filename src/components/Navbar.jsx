import { useState, useContext, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { FiMenu, FiX } from 'react-icons/fi';
import { Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../AuthContext';
import { signOut } from '@firebase/auth';
import { auth } from '../firebase/config';
import NotificationCenter from './NotificationCenter';

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);
  return [dark, () => setDark(v => !v)];
}

export function Navbar() {
  const { currentUser, userType } = useContext(AuthContext);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [avatarOpen, setAvatarOpen]   = useState(false);
  const [scrolled, setScrolled]       = useState(false);
  const [dark, toggleDark]            = useDarkMode();
  const initial = currentUser?.email?.charAt(0).toUpperCase() ?? '?';

  /* shadow on scroll */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setAvatarOpen(false);
    setMobileOpen(false);
  };

  /* close dropdowns on outside click */
  useEffect(() => {
    const h = () => setAvatarOpen(false);
    if (avatarOpen) document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [avatarOpen]);

  const navLinkClass = ({ isActive }) =>
    `relative text-sm font-semibold transition-all duration-200 pb-0.5 group ${
      isActive
        ? 'text-blue-600 dark:text-blue-400'
        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
    }`;

  const dropdownVariants = {
    hidden:  { opacity: 0, y: -6, scale: 0.97 },
    visible: { opacity: 1, y: 0,  scale: 1, transition: { duration: 0.18, ease: 'easeOut' } },
    exit:    { opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.12 } },
  };

  return (
    <nav className={`fixed w-full top-0 left-0 z-50 transition-all duration-300 ${
      scrolled
        ? 'bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-lg shadow-gray-200/60 dark:shadow-slate-950/60 border-b border-gray-200/60 dark:border-slate-700/60'
        : 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200/40 dark:border-slate-700/40'
    }`}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-[68px]">

          {/* ── Logo + Brand ── */}
          <Link to="/" className="flex items-center gap-3 shrink-0 group">
            <motion.div
              whileHover={{ scale: 1.08, rotate: 3 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              className="relative"
            >
              <img
                src="/logo.png"
                alt="CareFlow"
                className="w-11 h-11 object-contain drop-shadow-sm group-hover:drop-shadow-[0_0_8px_rgba(34,197,94,0.5)] transition-all duration-300"
              />
            </motion.div>
            <div className="flex flex-col leading-none">
              <span className="text-[19px] font-black tracking-tight bg-gradient-to-r from-green-600 via-blue-600 to-orange-500 bg-clip-text text-transparent drop-shadow-sm">
                CareFlow
              </span>
              <span className="text-[9px] font-semibold tracking-[0.18em] text-gray-400 dark:text-slate-500 uppercase">
                Appointment & Follow-up Manager
              </span>
            </div>
          </Link>

          {/* ── Desktop nav ── */}
          <div className="hidden md:flex items-center gap-1 ml-6">
            {[
              { to: '/', label: 'Home', end: true },
              { to: '/search', label: 'Find Doctors' },
              ...(currentUser && userType === 'patient' ? [{ to: '/appointments', label: 'Appointments' }] : []),
            ].map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) =>
                `relative px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/80 dark:hover:bg-slate-800/80'
                }`
              }>
                {label}
              </NavLink>
            ))}
          </div>

          {/* ── Right side ── */}
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={toggleDark}
              className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all duration-200 hover:scale-105"
              aria-label="Toggle dark mode"
            >
              <AnimatePresence mode="wait">
                {dark
                  ? <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                      <Sun className="w-5 h-5 text-yellow-400" />
                    </motion.div>
                  : <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                      <Moon className="w-5 h-5" />
                    </motion.div>
                }
              </AnimatePresence>
            </button>

            {currentUser ? (
              <>
                <NotificationCenter />

                <div className="relative" onClick={e => e.stopPropagation()}>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setAvatarOpen(v => !v)}
                    className="flex items-center justify-center w-9 h-9 rounded-full overflow-hidden ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 focus:outline-none shadow-lg shadow-blue-200/50 dark:shadow-none"
                  >
                    {currentUser.photoURL
                      ? <img src={currentUser.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">{initial}</div>
                    }
                  </motion.button>

                  <AnimatePresence>
                    {avatarOpen && (
                      <motion.div
                        variants={dropdownVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="absolute right-0 mt-2 w-56 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-gray-200/60 dark:border-slate-700/60 rounded-2xl shadow-2xl z-50 overflow-hidden"
                      >
                        <div className="px-4 py-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700 border-b border-gray-100 dark:border-slate-700">
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                            {currentUser.displayName || currentUser.email}
                          </p>
                          <p className="text-xs text-blue-500 capitalize font-semibold mt-0.5">{userType ?? 'User'}</p>
                        </div>

                        <div className="p-1.5">
                          {userType === 'admin' && (
                            <Link to="/admin" onClick={() => setAvatarOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors font-medium">
                              🛡️ Admin Dashboard
                            </Link>
                          )}
                          {userType === 'doctor' && (
                            <Link to="/dashboard" onClick={() => setAvatarOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors font-medium">
                              📊 My Dashboard
                            </Link>
                          )}
                          {userType === 'patient' && (
                            <>
                              <Link to="/appointments" onClick={() => setAvatarOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors font-medium">
                                📅 Appointments
                              </Link>
                              <Link to="/medical-records" onClick={() => setAvatarOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors font-medium">
                                🩺 Medical Records
                              </Link>
                            </>
                          )}
                          <Link to="/settings" onClick={() => setAvatarOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors font-medium">
                            ⚙️ Settings
                          </Link>
                          <div className="mt-1 pt-1 border-t border-gray-100 dark:border-slate-700">
                            <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors font-medium">
                              🚪 Sign Out
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800">
                  Log in
                </Link>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Link to="/signup" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-200/50 dark:shadow-none">
                    Get Started
                  </Link>
                </motion.div>
              </>
            )}
          </div>

          {/* ── Mobile hamburger ── */}
          <div className="md:hidden flex items-center gap-1.5">
            <button onClick={toggleDark} className="p-2 text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800">
              {dark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5" />}
            </button>
            {currentUser && <NotificationCenter />}
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="p-2 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <AnimatePresence mode="wait">
                {mobileOpen
                  ? <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}><FiX className="w-6 h-6" /></motion.div>
                  : <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}><FiMenu className="w-6 h-6" /></motion.div>
                }
              </AnimatePresence>
            </button>
          </div>
        </div>

        {/* ── Mobile menu ── */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="md:hidden overflow-hidden border-t border-gray-100 dark:border-slate-700"
            >
              <div className="py-3 space-y-0.5">
                {[
                  { to: '/', label: '🏠 Home', end: true },
                  { to: '/search', label: '🔍 Find Doctors' },
                  { to: '/about', label: 'ℹ️ About' },
                  ...(currentUser && userType === 'patient' ? [
                    { to: '/appointments',    label: '📅 Appointments'    },
                    { to: '/medical-records', label: '🩺 Medical Records' },
                  ] : []),
                  ...(currentUser && userType === 'doctor' ? [{ to: '/dashboard', label: '📊 Dashboard' }] : []),
                  ...(currentUser && userType === 'admin' ? [{ to: '/admin', label: '🛡️ Admin Dashboard' }] : []),
                  ...(currentUser ? [{ to: '/settings', label: '⚙️ Settings' }] : []),
                ].map(({ to, label, end }, i) => (
                  <motion.div
                    key={to}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <NavLink
                      to={to}
                      end={end}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        `block px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                          isActive
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                        }`
                      }
                    >{label}</NavLink>
                  </motion.div>
                ))}

                {currentUser ? (
                  <button onClick={handleLogout} className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    🚪 Sign Out
                  </button>
                ) : (
                  <div className="flex gap-2 pt-2 px-1 pb-1">
                    <Link to="/login" onClick={() => setMobileOpen(false)} className="flex-1 text-center py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                      Log in
                    </Link>
                    <Link to="/signup" onClick={() => setMobileOpen(false)} className="flex-1 text-center py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-200/50">
                      Get Started
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
