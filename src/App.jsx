import { useContext, useEffect, useRef, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import {
  motion, useInView, useMotionValue, useSpring,
} from 'framer-motion';
import { SearchBar }     from './components/SearchBar';
import { TopSpecialties } from './components/TopSpecialties';
import { AuthContext }   from './AuthContext';
import PatientDashboard  from './patient-dashboard/PatientDashboard';
import {
  Shield, Clock, Star, HeartPulse, Stethoscope,
  ArrowRight, CheckCircle, Users, CalendarDays, Award, Sparkles,
  Quote, MapPin, Activity, Heart,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────
   Utilities & sub-components
───────────────────────────────────────────────────────────────────── */

/** Counts from 0 → target when scrolled into view. Non-numeric targets
 *  (e.g. "Real-time", "AI-Assisted") render as static text instead. */
function AnimatedCounter({ target, suffix = '' }) {
  const ref      = useRef(null);
  const inView   = useInView(ref, { once: true });
  const motionVal= useMotionValue(0);
  const spring   = useSpring(motionVal, { duration: 2000, bounce: 0 });
  const [display, setDisplay] = useState('0');
  const numericTarget = parseFloat(target.replace(/[^0-9.]/g, ''));
  const isNumeric = !Number.isNaN(numericTarget);

  useEffect(() => {
    if (inView && isNumeric) motionVal.set(numericTarget);
  }, [inView, motionVal, numericTarget, isNumeric]);

  useEffect(() => {
    if (!isNumeric) return;
    spring.on('change', v => {
      setDisplay(numericTarget % 1 !== 0 ? v.toFixed(1) : Math.floor(v).toLocaleString());
    });
  }, [spring, numericTarget, isNumeric]);

  if (!isNumeric) return <span ref={ref}>{target}{suffix}</span>;

  const prefix = target.match(/^[^0-9]*/)?.[0] ?? '';
  return <span ref={ref}>{prefix}{display}{suffix}</span>;
}

/** Single animated stat pill */
function StatPill({ icon: Icon, value, suffix, label, gradient, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="flex-1 min-w-[140px] flex flex-col items-center justify-center gap-2 bg-white dark:bg-slate-800/80 backdrop-blur-sm border border-gray-100/80 dark:border-slate-700/60 rounded-3xl py-7 px-5 shadow-lg shadow-gray-100/60 dark:shadow-slate-950/40 group overflow-hidden relative"
    >
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-[0.04] bg-gradient-to-br ${gradient} transition-opacity duration-300`} />
      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-none">
        <AnimatedCounter target={value} suffix={suffix} />
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium text-center leading-snug">{label}</p>
    </motion.div>
  );
}

/** Premium feature card */
function FeatureCard({ icon: Icon, title, desc, color, gradient, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay, duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -8 }}
      className="relative group bg-white dark:bg-slate-800/90 rounded-3xl p-7 border border-gray-100/80 dark:border-slate-700/70 shadow-sm hover:shadow-2xl hover:shadow-gray-200/60 dark:hover:shadow-slate-950/60 transition-all duration-300 overflow-hidden"
    >
      {/* Hover gradient wash */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-[0.05] transition-opacity duration-300`} />
      {/* Top accent line */}
      <div className={`absolute top-0 left-6 right-6 h-0.5 bg-gradient-to-r ${gradient} rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

      <div className={`w-12 h-12 ${color} rounded-2xl flex items-center justify-center mb-5 shadow-lg`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="font-bold text-gray-900 dark:text-white mb-2.5 text-base leading-snug">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
    </motion.div>
  );
}

/** Step card in How It Works */
function StepCard({ num, title, desc, delay, color }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center text-center group"
    >
      <motion.div
        whileHover={{ scale: 1.12, rotate: 6 }}
        transition={{ type: 'spring', stiffness: 320, damping: 18 }}
        className={`w-16 h-16 ${color} rounded-2xl flex items-center justify-center text-white font-black text-2xl mx-auto mb-5 shadow-xl shadow-blue-200/40 dark:shadow-slate-950/40`}
      >
        {num}
      </motion.div>
      <h3 className="font-bold text-gray-900 dark:text-white mb-2.5 text-base">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs mx-auto">{desc}</p>
    </motion.div>
  );
}

/** Patient testimonial card */
function TestimonialCard({ name, city, review, rating, specialty, avatar, gradient, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay, duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6 }}
      className="bg-white dark:bg-slate-800/90 rounded-3xl p-7 border border-gray-100/80 dark:border-slate-700/70 shadow-sm hover:shadow-2xl hover:shadow-gray-200/50 dark:hover:shadow-slate-950/50 transition-all duration-300 flex flex-col gap-4"
    >
      <div className="flex items-start justify-between">
        <Quote className="w-8 h-8 text-blue-200 dark:text-slate-700 fill-blue-100 dark:fill-slate-800 shrink-0" />
        <div className="flex gap-0.5">
          {Array.from({ length: rating }).map((_, i) => (
            <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
          ))}
        </div>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed flex-1 italic">
        "{review}"
      </p>

      <div className="flex items-center gap-3 pt-2 border-t border-gray-100 dark:border-slate-700/60">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black text-sm shrink-0`}>
          {avatar}
        </div>
        <div>
          <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight">{name}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{specialty} · {city}</p>
        </div>
      </div>
    </motion.div>
  );
}

/** Trust badge pill */
function TrustBadge({ text }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm px-3.5 py-1.5 rounded-full border border-gray-200/60 dark:border-slate-700/60 shadow-sm"
    >
      <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
      <span className="font-medium text-xs">{text}</span>
    </motion.div>
  );
}

/** Decorative appointment card shown in the hero */
function AppointmentMockup() {
  const SLOTS = ['9:00 AM', '10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM', '4:00 PM'];
  const [active, setActive] = useState(1);

  return (
    <div className="relative w-full max-w-[340px] mx-auto select-none">
      {/* Main booking card */}
      <motion.div
        initial={{ opacity: 0, x: 32, y: 12 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.75, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl shadow-blue-200/40 dark:shadow-slate-950/60 border border-gray-100/80 dark:border-slate-700/80 p-6"
        >
          {/* Doctor row */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl shrink-0 shadow-lg">
              A
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-gray-900 dark:text-white text-sm truncate">Dr. Ananya Rao</p>
              <p className="text-xs text-blue-500 font-medium mt-0.5">Cardiologist · Mumbai</p>
            </div>
            <span className="text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-2 py-1 rounded-full shrink-0">
              Available
            </span>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-1.5 mb-5">
            {[1,2,3,4,5].map(s => (
              <Star key={s} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            ))}
            <span className="text-xs text-gray-400 ml-1">4.9 · 231 reviews</span>
          </div>

          {/* Time slots */}
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">
            Today's slots
          </p>
          <div className="grid grid-cols-3 gap-1.5 mb-5">
            {SLOTS.map((slot, i) => (
              <motion.button
                key={slot}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setActive(i)}
                className={`text-[11px] text-center py-1.5 rounded-xl font-semibold transition-all ${
                  active === i
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-200/50'
                    : 'bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-slate-600'
                }`}
              >
                {slot}
              </motion.button>
            ))}
          </div>

          {/* Book button */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold py-3 rounded-2xl text-center cursor-pointer shadow-lg shadow-blue-300/40"
          >
            Confirm Booking →
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Floating confirmation badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.9, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
          className="absolute -bottom-5 -left-5 bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-gray-200/60 dark:shadow-slate-950/60 p-3 flex items-center gap-2.5 border border-gray-100/80 dark:border-slate-700"
        >
          <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-md shrink-0">
            <CheckCircle className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-xs font-black text-gray-900 dark:text-white">Booking Confirmed!</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Today · 10:00 AM</p>
          </div>
        </motion.div>
      </motion.div>

      {/* Floating doctor count badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
          className="absolute -top-5 -right-3 bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-gray-200/60 dark:shadow-slate-950/60 px-3.5 py-2.5 flex items-center gap-2 border border-gray-100/80 dark:border-slate-700"
        >
          <div className="w-7 h-7 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center shrink-0">
            <Stethoscope className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-xs font-black text-gray-900 dark:text-white leading-none">5</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Verified Doctors</p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Static data
───────────────────────────────────────────────────────────────────── */
const STATS = [
  { icon: Stethoscope,  value: '5',           suffix: '', label: 'Verified doctors', gradient: 'from-indigo-500 to-indigo-600', delay: 0    },
  { icon: Award,        value: '20+',         suffix: '', label: 'Specialities covered', gradient: 'from-emerald-500 to-teal-600', delay: 0.08 },
  { icon: CalendarDays, value: 'Real-time',   suffix: '', label: 'Booking',          gradient: 'from-blue-500 to-cyan-500',     delay: 0.16 },
  { icon: Sparkles,     value: 'AI-Assisted', suffix: '', label: 'Care',             gradient: 'from-violet-500 to-purple-600', delay: 0.24 },
];

const FEATURES = [
  { icon: CalendarDays, title: 'Instant Booking',     gradient: 'from-blue-500 to-cyan-500',     color: 'bg-gradient-to-br from-blue-500 to-cyan-500',    desc: 'Book appointments in seconds. No phone calls, no waiting. See real-time availability and confirm instantly.',   delay: 0    },
  { icon: Shield,       title: 'Verified Doctors',    gradient: 'from-indigo-500 to-purple-600',  color: 'bg-gradient-to-br from-indigo-500 to-purple-600', desc: 'Every verified doctor has been credential-checked. Look for the blue shield badge for added confidence.',         delay: 0.06 },
  { icon: Clock,        title: 'Follow-up Reminders', gradient: 'from-violet-500 to-purple-600',  color: 'bg-gradient-to-br from-violet-500 to-purple-600', desc: 'Stay on track with upcoming appointments and follow-up visits so nothing slips through the cracks.',   delay: 0.12 },
  { icon: HeartPulse,   title: 'Medical Records',     gradient: 'from-rose-500 to-pink-600',      color: 'bg-gradient-to-br from-rose-500 to-pink-600',     desc: 'Store allergies, medications, vitals, and health history securely. Access them anywhere, anytime.',              delay: 0.18 },
  { icon: Star,         title: 'Honest Reviews',      gradient: 'from-amber-400 to-orange-500',   color: 'bg-gradient-to-br from-amber-400 to-orange-500',  desc: 'Only patients with completed appointments can leave reviews — ensuring authentic, trustworthy feedback.',         delay: 0.24 },
];

const STEPS = [
  { num: '1', title: 'Create Account',   desc: 'Sign up free as a patient. Takes under a minute with Google or email.',                  color: 'bg-gradient-to-br from-blue-500 to-blue-600',    delay: 0    },
  { num: '2', title: 'Find Your Doctor', desc: 'Search by name, specialty, or location. Read reviews and check real-time availability.', color: 'bg-gradient-to-br from-indigo-500 to-violet-600', delay: 0.12 },
  { num: '3', title: 'Book & Attend',    desc: 'Pick a time slot and confirm. Get instant updates on your appointment status.',          color: 'bg-gradient-to-br from-emerald-500 to-teal-600',  delay: 0.24 },
];

const TESTIMONIALS = [
  {
    name: 'Priya Sharma', city: 'Mumbai', avatar: 'P',
    gradient: 'from-blue-500 to-indigo-600',
    rating: 5, specialty: 'Cardiologist visit',
    review: 'Found the perfect cardiologist in minutes. The booking was seamless and the doctor was exactly as described in the reviews. Highly recommend CareFlow!',
    delay: 0,
  },
  {
    name: 'Rahul Verma', city: 'Delhi', avatar: 'R',
    gradient: 'from-violet-500 to-purple-600',
    rating: 5, specialty: 'Follow-up care',
    review: 'The follow-up reminders meant I never missed a check-up. Booking and tracking my appointments has never been this easy.',
    delay: 0.1,
  },
  {
    name: 'Anita Nair', city: 'Bengaluru', avatar: 'A',
    gradient: 'from-emerald-500 to-teal-600',
    rating: 5, specialty: 'Dermatologist visit',
    review: 'Booking was instant, reminders were on time, and the reviews are 100% genuine. This is exactly how healthcare should work in India.',
    delay: 0.2,
  },
];

/* ─────────────────────────────────────────────────────────────────────
   Section heading helper
───────────────────────────────────────────────────────────────────── */
function SectionHeading({ eyebrow, title, subtitle, eyebrowColor = 'text-blue-600 dark:text-blue-400' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="text-center mb-14"
    >
      <span className={`inline-block text-[11px] font-black tracking-[0.2em] uppercase mb-3 ${eyebrowColor}`}>
        {eyebrow}
      </span>
      <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white mb-3 tracking-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="text-gray-500 dark:text-gray-400 text-sm max-w-lg mx-auto leading-relaxed">
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Main component — routing logic is 100% unchanged
═══════════════════════════════════════════════════════════════════ */
export default function App() {
  const { currentUser, userType } = useContext(AuthContext);

  if (currentUser && userType === 'admin')   return <Navigate to="/admin" replace />;
  if (currentUser && userType === 'doctor')  return <Navigate to="/dashboard" replace />;
  if (currentUser && userType === 'patient') return <PatientDashboard />;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 overflow-x-hidden">
      <div className="pt-[68px]">

        {/* ══════════════════════════════ HERO ══════════════════════════════ */}
        <section className="relative overflow-hidden min-h-[92vh] flex items-center">

          {/* ── Background layers ── */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/80 via-indigo-50/40 to-white dark:from-slate-900 dark:via-slate-800/60 dark:to-slate-900" />

          {/* Animated gradient orbs */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
            <motion.div
              animate={{ scale: [1, 1.18, 1], opacity: [0.14, 0.22, 0.14] }}
              transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-40 -right-40 w-[700px] h-[700px] bg-blue-400/20 dark:bg-blue-500/10 rounded-full blur-3xl"
            />
            <motion.div
              animate={{ scale: [1, 1.22, 1], opacity: [0.09, 0.16, 0.09] }}
              transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
              className="absolute top-1/3 -left-40 w-[550px] h-[550px] bg-indigo-400/15 dark:bg-indigo-500/8 rounded-full blur-3xl"
            />
            <motion.div
              animate={{ scale: [1, 1.12, 1], opacity: [0.1, 0.18, 0.1] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
              className="absolute -bottom-20 right-1/3 w-[480px] h-[480px] bg-violet-400/12 dark:bg-violet-500/8 rounded-full blur-3xl"
            />
            {/* Dot grid */}
            <div
              className="absolute inset-0 opacity-[0.022] dark:opacity-[0.04]"
              style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '36px 36px' }}
            />
            {/* Floating decorative icons */}
            {[
              { Icon: Heart,       top: '12%', left: '6%',  delay: 0,   size: 'w-8 h-8',  opacity: 'opacity-[0.06]' },
              { Icon: Activity,    top: '72%', left: '4%',  delay: 1.5, size: 'w-6 h-6',  opacity: 'opacity-[0.07]' },
              { Icon: Stethoscope, top: '20%', right: '5%', delay: 0.8, size: 'w-7 h-7',  opacity: 'opacity-[0.05]' },
              { Icon: HeartPulse,  top: '80%', right: '8%', delay: 2,   size: 'w-9 h-9',  opacity: 'opacity-[0.06]' },
              { Icon: Shield,      top: '45%', left: '2%',  delay: 1,   size: 'w-5 h-5',  opacity: 'opacity-[0.08]' },
            ].map(({ Icon, top, left, right, delay, size, opacity }, i) => (
              <motion.div
                key={i}
                style={{ position: 'absolute', top, left, right }}
                animate={{ y: [0, -12, 0], rotate: [0, 5, 0] }}
                transition={{ duration: 6 + i, repeat: Infinity, ease: 'easeInOut', delay }}
                className={`${size} ${opacity} text-blue-600 dark:text-blue-400`}
              >
                <Icon className="w-full h-full" />
              </motion.div>
            ))}
          </div>

          {/* ── Hero content ── */}
          <div className="relative w-full max-w-7xl mx-auto px-4 py-20 lg:py-24">
            <div className="flex flex-col lg:flex-row items-center gap-14 lg:gap-20">

              {/* Left — copy */}
              <div className="flex-1 text-center lg:text-left">
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold px-4 py-2 rounded-full mb-7 border border-blue-200/60 dark:border-blue-800/60 shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  India's Smart Healthcare Platform
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.65, delay: 0.07, ease: [0.22, 1, 0.36, 1] }}
                  className="text-[2.6rem] md:text-5xl lg:text-[3.4rem] font-black text-gray-900 dark:text-white leading-[1.1] mb-6 tracking-tight"
                >
                  Find & book the{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600">
                    best doctors
                  </span>
                  <br className="hidden lg:block" /> near you
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.13 }}
                  className="text-base md:text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-lg mx-auto lg:mx-0 leading-relaxed"
                >
                  Connect with verified healthcare professionals. Book instantly, manage records, and stay on top of every follow-up — all in one place.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="mb-7 max-w-xl mx-auto lg:mx-0"
                >
                  <SearchBar />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className="flex flex-wrap gap-2.5 justify-center lg:justify-start mb-8"
                >
                  <TrustBadge text="Free to book" />
                  <TrustBadge text="Verified doctors" />
                  <TrustBadge text="Instant confirmation" />
                  <TrustBadge text="5 verified doctors" />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.36, duration: 0.4 }}
                  className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start"
                >
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Link
                      to="/signup"
                      className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold px-7 py-3.5 rounded-2xl shadow-xl shadow-blue-300/40 dark:shadow-blue-900/40 transition-all text-sm"
                    >
                      Get Started Free <ArrowRight className="w-4 h-4" />
                    </Link>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Link
                      to="/search"
                      className="inline-flex items-center justify-center gap-2 bg-white dark:bg-slate-800 text-gray-800 dark:text-white font-bold px-7 py-3.5 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all text-sm"
                    >
                      Browse Doctors
                    </Link>
                  </motion.div>
                </motion.div>
              </div>

              {/* Right — appointment mockup (hidden on small phones to avoid overflow) */}
              <div className="hidden sm:block w-full max-w-[340px] lg:max-w-[340px] xl:max-w-[360px] shrink-0 mx-auto lg:mx-0 overflow-visible">
                <AppointmentMockup />
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════ STATS BAND ═════════════════════════════ */}
        <section className="relative py-12 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-700 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900" />
          <div
            className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }}
            aria-hidden
          />
          <div className="relative max-w-5xl mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {STATS.map(s => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: s.delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col items-center text-center gap-1.5 py-4"
                >
                  <p className="text-3xl font-black text-white leading-none">
                    <AnimatedCounter target={s.value} suffix={s.suffix} />
                  </p>
                  <p className="text-blue-200/80 text-xs font-medium">{s.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════ SPECIALTIES ═════════════════════════════ */}
        <section className="max-w-7xl mx-auto px-4 py-20">
          <SectionHeading
            eyebrow="Specialties"
            title="Browse by Specialty"
            subtitle="Find the right specialist for your health needs across 20+ medical categories."
          />
          <TopSpecialties />
        </section>

        {/* ══════════════════════ HOW IT WORKS ══════════════════════════ */}
        <section className="relative py-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-slate-800/50 dark:via-slate-800/30 dark:to-slate-900" />
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-200/60 dark:via-slate-700 to-transparent" />
          <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-200/60 dark:via-slate-700 to-transparent" />
          <div className="absolute pointer-events-none inset-0" aria-hidden>
            <div className="absolute top-12 right-12 w-72 h-72 bg-blue-400/6 rounded-full blur-3xl" />
            <div className="absolute bottom-12 left-12 w-56 h-56 bg-indigo-400/6 rounded-full blur-3xl" />
          </div>

          <div className="relative max-w-5xl mx-auto px-4">
            <SectionHeading
              eyebrow="How It Works"
              title="Three steps to better healthcare"
              subtitle="Simple, fast, and reliable — from search to confirmed appointment."
              eyebrowColor="text-indigo-600 dark:text-indigo-400"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
              {/* Connector line */}
              <div
                className="hidden md:block absolute top-8 left-[calc(16.67%+2.5rem)] right-[calc(16.67%+2.5rem)] h-px"
                aria-hidden
              >
                <div className="w-full h-full bg-gradient-to-r from-blue-300 via-indigo-300 to-emerald-300 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 opacity-60" />
              </div>
              {STEPS.map(s => <StepCard key={s.num} {...s} />)}
            </div>
          </div>
        </section>

        {/* ═════════════════════════ FEATURES ═══════════════════════════ */}
        <section className="max-w-7xl mx-auto px-4 py-24">
          <SectionHeading
            eyebrow="Features"
            title="Everything you need for better healthcare"
            subtitle="CareFlow brings together doctor booking, records, and follow-up tracking into one seamless platform."
            eyebrowColor="text-violet-600 dark:text-violet-400"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => <FeatureCard key={f.title} {...f} />)}
          </div>
        </section>

        {/* ═══════════════════════ TESTIMONIALS ════════════════════════ */}
        <section className="relative py-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-800/50 dark:to-slate-900" />
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-200/60 dark:via-slate-700 to-transparent" />
          <div className="absolute pointer-events-none inset-0" aria-hidden>
            <div className="absolute -top-20 right-1/4 w-80 h-80 bg-blue-300/8 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/4 w-60 h-60 bg-indigo-300/8 rounded-full blur-3xl" />
          </div>

          <div className="relative max-w-6xl mx-auto px-4">
            <SectionHeading
              eyebrow="Patient Stories"
              title="Trusted by thousands of patients"
              subtitle="Real experiences from real patients across India."
              eyebrowColor="text-emerald-600 dark:text-emerald-400"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {TESTIMONIALS.map(t => <TestimonialCard key={t.name} {...t} />)}
            </div>

            {/* Social proof bar */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="mt-14 flex flex-wrap items-center justify-center gap-8 py-7 border-t border-gray-100 dark:border-slate-800"
            >
              {[
                { icon: Users,       text: '10,000+ Happy Patients' },
                { icon: Star,        text: '4.8 / 5 Average Rating' },
                { icon: MapPin,      text: 'Available Across India' },
                { icon: CheckCircle, text: '100% Verified Doctors'  },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2.5 text-sm text-gray-500 dark:text-gray-400 font-medium">
                  <Icon className="w-4 h-4 text-blue-500 shrink-0" />
                  {text}
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ════════════════════════ DOCTOR CTA ══════════════════════════ */}
        <section className="py-20 px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-5xl mx-auto relative overflow-hidden rounded-[2rem] shadow-2xl shadow-blue-300/30 dark:shadow-slate-950/70"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700" />
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '32px 32px' }}
            />
            <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-white/5  rounded-full blur-3xl" />

            <div className="relative px-8 py-16 md:px-16 md:py-20 flex flex-col md:flex-row items-center gap-10">
              {/* Left */}
              <div className="flex-1 text-center md:text-left">
                <motion.div
                  animate={{ rotate: [0, 10, -8, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="inline-block mb-5"
                >
                  <div className="w-16 h-16 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20 shadow-xl">
                    <Stethoscope className="w-8 h-8 text-white" />
                  </div>
                </motion.div>
                <h2 className="text-2xl md:text-3xl font-black text-white mb-4 tracking-tight leading-tight">
                  Are you a healthcare<br />professional?
                </h2>
                <p className="text-blue-100/80 text-sm leading-relaxed max-w-lg">
                  Join CareFlow to manage appointments, showcase your expertise, and connect with thousands of patients searching for your specialty.
                </p>
              </div>

              {/* Right — CTAs + quick stats */}
              <div className="flex flex-col gap-4 shrink-0 w-full md:w-auto items-center md:items-end">
                <div className="flex flex-col sm:flex-row md:flex-col gap-3 w-full md:w-auto">
                  <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                    <Link
                      to="/signup"
                      className="flex items-center justify-center gap-2 bg-white text-blue-600 font-black px-8 py-3.5 rounded-2xl hover:bg-blue-50 transition-colors shadow-xl text-sm w-full"
                    >
                      Register as a Doctor <ArrowRight className="w-4 h-4" />
                    </Link>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                    <Link
                      to="/faq"
                      className="flex items-center justify-center gap-2 bg-white/15 backdrop-blur-sm text-white font-bold px-8 py-3.5 rounded-2xl hover:bg-white/25 transition-all border border-white/25 text-sm w-full"
                    >
                      Learn More
                    </Link>
                  </motion.div>
                </div>
                <div className="flex gap-6 text-center">
                  {[['5', 'Doctors'], ['10K+', 'Patients'], ['20+', 'Specialties']].map(([n, l]) => (
                    <div key={l}>
                      <p className="text-white font-black text-lg leading-none">{n}</p>
                      <p className="text-blue-200/70 text-[10px] font-medium mt-1">{l}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ═══════════════════════════ FOOTER ═══════════════════════════ */}
        <footer className="border-t border-gray-100 dark:border-slate-800/80 bg-white dark:bg-slate-900">
          <div className="max-w-7xl mx-auto px-4 py-12">
            <div className="flex flex-col md:flex-row justify-between gap-10">

              {/* Brand */}
              <div className="max-w-xs">
                <div className="flex items-center gap-3 mb-4">
                  <motion.img
                    src="/logo.png"
                    alt="CareFlow"
                    className="w-9 h-9 object-contain"
                    whileHover={{ scale: 1.1, rotate: 6 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  />
                  <span className="font-black text-base bg-gradient-to-r from-green-600 via-blue-600 to-orange-500 bg-clip-text text-transparent">
                    CareFlow
                  </span>
                </div>
                <p className="text-sm text-gray-400 dark:text-slate-500 leading-relaxed">
                  India's trusted healthcare appointment & follow-up manager. Find verified doctors, book appointments instantly, and stay on top of your care.
                </p>
              </div>

              {/* Links */}
              <div className="flex flex-wrap gap-10">
                {[
                  {
                    heading: 'Platform',
                    links: [
                      { to: '/search',    label: 'Find Doctors' },
                      { to: '/signup',    label: 'Sign Up'      },
                      { to: '/login',     label: 'Log In'       },
                    ],
                  },
                  {
                    heading: 'Company',
                    links: [
                      { to: '/about',     label: 'About'   },
                      { to: '/faq',       label: 'FAQ'     },
                    ],
                  },
                ].map(col => (
                  <div key={col.heading}>
                    <p className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                      {col.heading}
                    </p>
                    <ul className="space-y-2">
                      {col.links.map(({ to, label }) => (
                        <li key={to}>
                          <Link
                            to={to}
                            className="text-sm text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
                          >
                            {label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-gray-400 dark:text-slate-500">
                © 2025 CareFlow. All rights reserved.
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500">
                Made with <Heart className="w-3 h-3 inline text-rose-400 fill-rose-400" /> for better healthcare in India
              </p>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
