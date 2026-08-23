import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, Calendar, Activity, Bell, Star,
  Database, Code, Globe, Smartphone, Zap, Heart,
  Users, FileText,
  ChevronRight,
} from 'lucide-react';

const TECH_STACK = [
  { name: 'React 18', desc: 'Frontend UI with hooks, context, and real-time state', color: '#61dafb', icon: '⚛️' },
  { name: 'Firebase Auth', desc: 'Email/Password + Google OAuth authentication', color: '#ffa000', icon: '🔐' },
  { name: 'Cloud Firestore', desc: 'Real-time NoSQL database with onSnapshot listeners', color: '#ff6f00', icon: '🔥' },
  { name: 'React Router v7', desc: 'Client-side routing with protected routes', color: '#ca4245', icon: '🧭' },
  { name: 'Tailwind CSS', desc: 'Utility-first styling with dark mode support', color: '#06b6d4', icon: '🎨' },
  { name: 'Vite 6', desc: 'Lightning-fast build tool and dev server', color: '#646cff', icon: '⚡' },
  { name: 'date-fns', desc: 'Date formatting and calculation library', color: '#e91e63', icon: '📅' },
  { name: 'lucide-react', desc: 'Modern SVG icon library', color: '#8b5cf6', icon: '✨' },
];

const FEATURES = [
  {
    icon: Calendar, title: 'Smart Appointment Booking', color: 'green',
    desc: 'React Calendar integration with real-time slot availability, doctor scheduling, and instant confirmation.',
    tag: 'Core',
  },
  {
    icon: Activity, title: 'Health Analytics Dashboard', color: 'purple',
    desc: 'SVG-based charts showing appointment trends, consultation stats, and health profile completeness.',
    tag: 'Analytics',
  },
  {
    icon: Bell, title: 'Real-Time Notifications', color: 'orange',
    desc: 'Firestore onSnapshot listeners for instant appointment confirmations, completions, and reviews.',
    tag: 'Real-time',
  },
  {
    icon: Star, title: 'Review & Rating System', color: 'yellow',
    desc: 'Patients can rate and review doctors after completed appointments. Ratings update doctor profiles in real-time.',
    tag: 'Social',
  },
  {
    icon: FileText, title: 'Patient Medical Records', color: 'red',
    desc: 'Comprehensive health records: allergies, medications, conditions, family history, and emergency contacts.',
    tag: 'Records',
  },
  {
    icon: ShieldCheck, title: 'Doctor Verification', color: 'blue',
    desc: 'License number verification system with verified badge display on doctor profiles.',
    tag: 'Trust',
  },
  {
    icon: Smartphone, title: 'Mobile-First Design', color: 'green',
    desc: 'Bottom navigation, responsive layouts, and touch-friendly interactions for mobile users.',
    tag: 'Mobile',
  },
];

const ARCHITECTURE = [
  { layer: 'Frontend', stack: 'React 18 + Vite + React Router v7', color: 'blue' },
  { layer: 'Styling', stack: 'Tailwind CSS (dark mode, animations, responsive)', color: 'cyan' },
  { layer: 'Auth', stack: 'Firebase Authentication (Email + Google OAuth)', color: 'orange' },
  { layer: 'Database', stack: 'Cloud Firestore (real-time, NoSQL)', color: 'yellow' },
  { layer: 'State', stack: 'React Context API + onSnapshot real-time listeners', color: 'purple' },
  { layer: 'Charts', stack: 'Pure SVG (no external chart library)', color: 'red' },
  { layer: 'Icons', stack: 'lucide-react + react-icons', color: 'gray' },
];

const FIRESTORE_COLLECTIONS = [
  { name: 'patients', fields: 'uid, firstName, lastName, email, age, bloodGroup, allergies, conditions, medications, height, weight, emergencyContact...' },
  { name: 'doctors', fields: 'uid, firstName, lastName, specialty, experience, licenseNumber, verified, avgRating, totalRatings, availability...' },
  { name: 'appointments', fields: 'patientId, doctorId, date, timeSlot, status, rating, patientName, doctorName, createdAt...' },
  { name: 'notifications', fields: 'userId, message, type, appointmentId, read, createdAt' },
  { name: 'reviews', fields: 'doctorId, patientId, rating, comment, patientName, createdAt' },
];

const COLOR_MAP = {
  blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
  red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  cyan: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
  gray: 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400',
};

export default function About() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pt-16 pb-24 md:pb-8">
      <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in">

        {/* Hero */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-3xl p-6 sm:p-10 mb-10 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full translate-x-24 -translate-y-24" />
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-white/5 rounded-full -translate-x-16 translate-y-20" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-2xl flex items-center justify-center shadow-lg shrink-0">
                <Heart className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black">CareFlow</h1>
                <p className="text-blue-200 text-sm sm:text-base">Healthcare Appointment & Follow-up Manager</p>
              </div>
            </div>
            <p className="text-sm sm:text-lg text-blue-100 max-w-2xl leading-relaxed mb-6">
              A full-stack, portfolio-grade healthcare platform connecting patients with doctors.
              Features real-time appointment management, advanced analytics,
              and a complete patient health records system.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/search"
                className="flex items-center gap-2 bg-white text-blue-700 font-bold px-5 py-2.5 rounded-xl hover:bg-blue-50 transition-colors">
                <Users className="w-4 h-4" /> Find Doctors
              </Link>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Features Built', value: '11', icon: '⚡' },
            { label: 'Firestore Collections', value: '5', icon: '🔥' },
            { label: 'React Components', value: '40+', icon: '⚛️' },
            { label: 'Lines of Code', value: '5,000+', icon: '💻' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-5 text-center shadow-sm">
              <p className="text-2xl mb-1">{s.icon}</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white">{s.value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Features */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-500" /> Key Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FEATURES.map(f => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${COLOR_MAP[f.color]}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900 dark:text-white text-sm">{f.title}</h3>
                        <span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">{f.tag}</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Tech Stack */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Code className="w-6 h-6 text-blue-500" /> Tech Stack
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TECH_STACK.map(t => (
              <div key={t.name} className="flex items-center gap-4 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-4 hover:shadow-sm transition-shadow">
                <span className="text-2xl shrink-0">{t.icon}</span>
                <div>
                  <p className="font-bold text-gray-900 dark:text-white text-sm">{t.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Architecture */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Globe className="w-6 h-6 text-green-500" /> Architecture
          </h2>
          <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden">
            {ARCHITECTURE.map((a, i) => (
              <div key={a.layer} className={`flex items-center gap-4 px-6 py-4 ${i < ARCHITECTURE.length - 1 ? 'border-b border-gray-100 dark:border-slate-700' : ''}`}>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-lg w-28 text-center shrink-0 ${COLOR_MAP[a.color]}`}>{a.layer}</span>
                <ChevronRight className="w-3 h-3 text-gray-300 shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{a.stack}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Firestore */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Database className="w-6 h-6 text-orange-500" /> Firestore Collections
          </h2>
          <div className="space-y-3">
            {FIRESTORE_COLLECTIONS.map(c => (
              <div key={c.name} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl px-5 py-4">
                <div className="flex items-start gap-3">
                  <code className="text-sm font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-3 py-1 rounded-lg shrink-0">{c.name}</code>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{c.fields}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Route Map */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Globe className="w-6 h-6 text-purple-500" /> Route Map
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { route: '/', desc: 'Landing page / Patient Dashboard (auth-aware)' },
              { route: '/login', desc: 'Login with email or Google OAuth' },
              { route: '/signup', desc: 'Registration for patients and doctors' },
              { route: '/search', desc: 'Doctor search with advanced filters' },
              { route: '/view', desc: 'Doctor profile, reviews, and booking' },
              { route: '/appointments', desc: 'My appointments with timeline view' },
              { route: '/settings', desc: 'Profile settings and preferences' },
              { route: '/medical-records', desc: 'Comprehensive health records' },
              { route: '/dashboard', desc: 'Doctor dashboard with schedule and analytics' },
              { route: '/dashboard/start', desc: 'Doctor availability management' },
              { route: '/faq', desc: 'Searchable FAQ / help center' },
              { route: '/about', desc: 'Project portfolio page (this page)' },
            ].map(r => (
              <div key={r.route} className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3">
                <code className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded shrink-0">{r.route}</code>
                <span className="text-xs text-gray-600 dark:text-gray-300">{r.desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Developer */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800 border border-blue-100 dark:border-slate-700 rounded-3xl p-8 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Code className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">CareFlow</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm max-w-lg mx-auto leading-relaxed mb-6">
            A full-stack healthcare platform built as a portfolio project.
            Features real-time Firebase integration, analytics dashboards,
            and a complete patient-doctor ecosystem.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Link to="/search" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors">
              <Users className="w-4 h-4" /> Browse Doctors
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
