import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  collection, query as firestoreQuery,
  where, getDocs, limit, startAfter, documentId,
} from '@firebase/firestore';
import { db } from '../firebase/config';
import { CAREFLOW_DOCTOR_IDS } from '../config/careflowDoctors';
import { SearchBar } from '../components/SearchBar';
import Search from '../components/Search';
import PageTransition from '../components/PageTransition';
import { motion, AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, X, ChevronDown, Stethoscope, Sparkles } from 'lucide-react';

/* ── Constants (unchanged) ─────────────────────────────────────────── */
const PAGE_SIZE = 24;

const SPECIALTIES = [
  'All',
  'General Physician', 'Cardiologist',      'Dermatologist',  'Dentist',
  'Gynologist',        'Psychiatrist',       'Ophthalmologist','Orthopedist',
  'Neurologist',       'Pediatrician',       'Nephrologist',   'Urologist',
  'Endocrinologist',   'Gastroenterologist', 'Pulmonologist',  'Oncologist',
  'Rheumatologist',    'ENT Specialist',     'Plastic Surgeon','General Surgeon',
];

const EXPERIENCE_OPTIONS = [
  { label: 'Any Experience', value: '' },
  { label: '0–5 years',      value: '0-5' },
  { label: '5–10 years',     value: '5-10' },
  { label: '10+ years',      value: '10+' },
];

const RATING_OPTIONS = [
  { label: 'Any Rating', value: '' },
  { label: '4+ Stars',   value: '4' },
  { label: '3+ Stars',   value: '3' },
];

/* ── Filter badge chip ─────────────────────────────────────────────── */
function FilterBadge({ label, onRemove }) {
  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ duration: 0.14 }}
      className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold rounded-full shadow-md shadow-blue-300/30"
    >
      {label}
      <button
        onClick={onRemove}
        className="hover:text-blue-200 transition-colors ml-0.5"
        aria-label={`Remove ${label} filter`}
      >
        <X className="w-3 h-3" />
      </button>
    </motion.span>
  );
}

/* ── Styled select ─────────────────────────────────────────────────── */
function FilterSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.15em] mb-1.5">
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/80 text-gray-800 dark:text-white text-sm px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-transparent transition-all appearance-none cursor-pointer hover:border-blue-300 dark:hover:border-blue-600"
      >
        {options.map(o => (
          <option key={o.value ?? o} value={o.value ?? o}>
            {o.label ?? o}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════ */
const SearchPage = () => {
  const location = useLocation();
  const params        = new URLSearchParams(location.search);
  const queryParam    = params.get('query')    ?? '';
  const locationParam = params.get('location') ?? '';

  /* ── All state (unchanged) ── */
  const [doctors,     setDoctors]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc,     setLastDoc]     = useState(null);
  const [hasMore,     setHasMore]     = useState(false);

  const [showFilters, setShowFilters] = useState(() => {
    const sp = new URLSearchParams(window.location.search).get('specialty') ?? '';
    return !!(sp && sp !== 'All');
  });

  const specialtyParam = params.get('specialty') ?? '';
  const [specialty,  setSpecialty]  = useState(
    specialtyParam && SPECIALTIES.includes(specialtyParam) ? specialtyParam : 'All'
  );
  const [experience, setExperience] = useState('');
  const [minRating,  setMinRating]  = useState('');

  /* Sync specialty from URL (unchanged) */
  useEffect(() => {
    const sp = new URLSearchParams(location.search).get('specialty') ?? '';
    if (sp && SPECIALTIES.includes(sp)) {
      setSpecialty(sp);
      setShowFilters(true);
    }
  }, [location.search]);

  /* ── Client-side filters ──
   * Keyword and specialty matching happen here (not as Firestore `where`
   * clauses) because the query below is scoped to CAREFLOW_DOCTOR_IDS via a
   * documentId() 'in' filter, and Firestore can't combine that with an
   * array-contains/equality filter on another field without extra composite
   * indexes. The candidate set is always <= CAREFLOW_DOCTOR_IDS.length, so
   * filtering in JS is cheap. */
  function applyClientFilters(list) {
    list = list.filter(d => d.active !== false);
    if (locationParam) {
      list = list.filter(d =>
        d.location?.toLowerCase().includes(locationParam.toLowerCase())
      );
    }
    if (queryParam) {
      const q = queryParam.toLowerCase();
      list = list.filter(d =>
        d.searchKeywords?.some(k => k.includes(q)) ||
        `${d.firstName ?? ''} ${d.lastName ?? ''}`.toLowerCase().includes(q) ||
        d.specialty?.toLowerCase().includes(q)
      );
    }
    if (specialty !== 'All') {
      list = list.filter(d => d.specialty === specialty);
    }
    if (experience) {
      list = list.filter(d => {
        const exp = parseInt(d.experience ?? 0, 10);
        if (experience === '0-5')  return exp >= 0  && exp < 5;
        if (experience === '5-10') return exp >= 5  && exp < 10;
        if (experience === '10+')  return exp >= 10;
        return true;
      });
    }
    if (minRating) {
      list = list.filter(d => (d.avgRating ?? 0) >= parseInt(minRating, 10));
    }
    return list;
  }

  /* ── Firestore query builder ──
   * CareFlow-only: always scoped to the fixed CAREFLOW_DOCTOR_IDS allow-list
   * so the rest of the shared `doctors` collection is never read here. */
  function buildQuery(afterDoc = null) {
    const ref         = collection(db, 'doctors');
    const constraints = [where(documentId(), 'in', CAREFLOW_DOCTOR_IDS)];

    if (afterDoc) constraints.push(startAfter(afterDoc));
    constraints.push(limit(PAGE_SIZE));

    return firestoreQuery(ref, ...constraints);
  }

  /* ── Initial fetch (unchanged) ── */
  useEffect(() => {
    let cancelled = false;

    const fetchDoctors = async () => {
      setLoading(true);
      setLastDoc(null);
      setHasMore(false);

      try {
        const snap = await getDocs(buildQuery(null));
        if (cancelled) return;

        const list = applyClientFilters(
          snap.docs.map(d => ({ id: d.id, ...d.data() }))
        );

        setDoctors(list);
        setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
        setHasMore(snap.docs.length === PAGE_SIZE);
      } catch (err) {
        console.error('Error fetching doctors:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchDoctors();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParam, locationParam, specialty, experience, minRating]);

  /* ── Load More (unchanged) ── */
  const handleLoadMore = async () => {
    if (!lastDoc || loadingMore || !hasMore) return;
    setLoadingMore(true);

    try {
      const snap = await getDocs(buildQuery(lastDoc));
      const list = applyClientFilters(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
      );

      setDoctors(prev => [...prev, ...list]);
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error('Error loading more doctors:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const activeFilters = [
    specialty !== 'All' && { label: specialty,  clear: () => setSpecialty('All') },
    experience          && { label: EXPERIENCE_OPTIONS.find(o => o.value === experience)?.label, clear: () => setExperience('') },
    minRating           && { label: RATING_OPTIONS.find(o => o.value === minRating)?.label,      clear: () => setMinRating('') },
  ].filter(Boolean);

  /* ════════════════════════════════ JSX ════════════════════════════ */
  return (
    <PageTransition>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950">

        {/* ══════════════════════ HERO BAND ═════════════════════════ */}
        <div className="relative overflow-hidden">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-indigo-600 to-violet-700 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900" />

          {/* Dot grid */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
            aria-hidden
          />

          {/* Glow orbs */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 -left-20 w-64 h-64 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/3 w-48 h-48 bg-violet-400/15 rounded-full blur-3xl pointer-events-none" />

          {/* Content */}
          <div className="relative pt-28 pb-14 px-4">
            <div className="max-w-3xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="text-center mb-8"
              >
                <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white/90 text-[11px] font-bold px-4 py-1.5 rounded-full border border-white/20 mb-5 shadow-sm">
                  <Sparkles className="w-3.5 h-3.5" />
                  5 Verified Doctors Across India
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-2.5 leading-tight">
                  Find Your Perfect Doctor
                </h1>
                <p className="text-blue-100/75 text-sm">
                  Search by name, specialty, or city — book in seconds
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              >
                <SearchBar initialQuery={queryParam} initialLocation={locationParam} />
              </motion.div>

              {/* Quick specialty chips */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="flex flex-wrap gap-2 justify-center mt-5"
              >
                {['Cardiologist', 'Dermatologist', 'Dentist', 'Pediatrician', 'General Physician'].map(s => (
                  <button
                    key={s}
                    onClick={() => { setSpecialty(s); setShowFilters(true); }}
                    className={`text-xs font-semibold px-3 py-1 rounded-full border transition-all duration-150 ${
                      specialty === s
                        ? 'bg-white text-blue-700 border-white shadow-md'
                        : 'bg-white/10 text-white/80 border-white/20 hover:bg-white/20 hover:text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </motion.div>
            </div>
          </div>

          {/* Wave divider */}
          <div className="relative h-8 -mb-px">
            <svg
              viewBox="0 0 1440 32"
              className="absolute bottom-0 w-full"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path
                d="M0,16 C360,32 1080,0 1440,16 L1440,32 L0,32 Z"
                className="fill-gray-50 dark:fill-slate-950"
              />
            </svg>
          </div>
        </div>

        {/* ════════════════════ CONTENT AREA ════════════════════════ */}
        <div className="max-w-7xl mx-auto px-4 py-8">

          {/* ── Filter toolbar ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            className="flex flex-wrap items-center gap-2.5 mb-5"
          >
            {/* Toggle */}
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all duration-200 ${
                showFilters || activeFilters.length
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-lg shadow-blue-300/40 dark:shadow-blue-900/40'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {activeFilters.length > 0 && (
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-white/25 dark:bg-white/10 min-w-[18px] text-center">
                  {activeFilters.length}
                </span>
              )}
            </button>

            {/* Active badges */}
            <AnimatePresence>
              {activeFilters.map((f, i) => (
                <FilterBadge key={i} label={f.label} onRemove={f.clear} />
              ))}
            </AnimatePresence>
          </motion.div>

          {/* ── Filter panel ── */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-gray-200/60 dark:border-slate-700/70 rounded-2xl p-5 mb-6 shadow-md shadow-gray-100/60 dark:shadow-slate-950/40">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FilterSelect
                      label="Specialty"
                      value={specialty}
                      onChange={setSpecialty}
                      options={SPECIALTIES.map(s => ({ label: s, value: s }))}
                    />
                    <FilterSelect
                      label="Experience"
                      value={experience}
                      onChange={setExperience}
                      options={EXPERIENCE_OPTIONS}
                    />
                    <FilterSelect
                      label="Minimum Rating"
                      value={minRating}
                      onChange={setMinRating}
                      options={RATING_OPTIONS}
                    />
                  </div>

                  {activeFilters.length > 0 && (
                    <button
                      onClick={() => { setSpecialty('All'); setExperience(''); setMinRating(''); }}
                      className="mt-4 text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400 font-bold hover:underline underline-offset-2 transition-colors"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Doctor grid ── */}
          <Search
            queryParam={queryParam}
            locationParam={locationParam}
            doctors={doctors}
            loading={loading}
            specialty={specialty}
          />

          {/* ── Load More ── */}
          {hasMore && !loading && (
            <div className="mt-14 flex flex-col items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 font-bold px-9 py-3.5 rounded-2xl hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 hover:shadow-xl hover:shadow-blue-100/50 dark:hover:shadow-slate-950/60 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-sm"
              >
                {loadingMore ? (
                  <>
                    <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    Loading more…
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    Load More Doctors
                  </>
                )}
              </motion.button>
              <p className="text-xs text-gray-400 dark:text-slate-500 font-medium">
                Showing {doctors.length} of many results
              </p>
            </div>
          )}

          {/* ── End of results ── */}
          {!hasMore && !loading && doctors.length > PAGE_SIZE && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-10 text-center text-xs text-gray-400 dark:text-slate-500 font-medium"
            >
              All {doctors.length} results loaded
            </motion.p>
          )}

        </div>
      </div>
    </PageTransition>
  );
};

export default SearchPage;
