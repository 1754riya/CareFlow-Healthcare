import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, MapPin, Clock, CheckCircle, Stethoscope, ArrowRight, IndianRupee } from 'lucide-react';

/* ── Per-specialty themes ──────────────────────────────────────────── */
const SPECIALTY_THEME = {
  'Cardiologist':       { grad: 'from-rose-500 to-red-600',      pill: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',      dot: 'bg-rose-400' },
  'Dermatologist':      { grad: 'from-pink-500 to-fuchsia-600',   pill: 'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',       dot: 'bg-pink-400' },
  'Dentist':            { grad: 'from-sky-500 to-blue-600',       pill: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',           dot: 'bg-sky-400' },
  'Gynologist':         { grad: 'from-purple-500 to-violet-600',  pill: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', dot: 'bg-purple-400' },
  'Psychiatrist':       { grad: 'from-indigo-500 to-blue-600',    pill: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300', dot: 'bg-indigo-400' },
  'Ophthalmologist':    { grad: 'from-teal-500 to-cyan-600',      pill: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',        dot: 'bg-teal-400' },
  'Orthopedist':        { grad: 'from-amber-500 to-orange-500',   pill: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',    dot: 'bg-amber-400' },
  'Neurologist':        { grad: 'from-violet-500 to-purple-600',  pill: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300', dot: 'bg-violet-400' },
  'Pediatrician':       { grad: 'from-green-500 to-emerald-600',  pill: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',    dot: 'bg-green-400' },
  'General Physician':  { grad: 'from-blue-500 to-indigo-600',    pill: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',        dot: 'bg-blue-400' },
  'Nephrologist':       { grad: 'from-cyan-500 to-teal-600',      pill: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',        dot: 'bg-cyan-400' },
  'Urologist':          { grad: 'from-blue-600 to-sky-600',       pill: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',        dot: 'bg-blue-400' },
  'Endocrinologist':    { grad: 'from-orange-500 to-amber-500',   pill: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', dot: 'bg-orange-400' },
  'Gastroenterologist': { grad: 'from-lime-500 to-green-600',     pill: 'bg-lime-50 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300',        dot: 'bg-lime-400' },
  'Pulmonologist':      { grad: 'from-sky-400 to-blue-500',       pill: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',            dot: 'bg-sky-400' },
  'Oncologist':         { grad: 'from-red-600 to-rose-700',       pill: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',            dot: 'bg-red-400' },
  'Rheumatologist':     { grad: 'from-purple-600 to-indigo-700',  pill: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', dot: 'bg-purple-400' },
  'ENT Specialist':     { grad: 'from-teal-600 to-green-600',     pill: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',        dot: 'bg-teal-400' },
  'Plastic Surgeon':    { grad: 'from-fuchsia-500 to-pink-600',   pill: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300', dot: 'bg-fuchsia-400' },
  'General Surgeon':    { grad: 'from-slate-500 to-gray-600',     pill: 'bg-slate-50 text-slate-700 dark:bg-slate-700/60 dark:text-slate-300',    dot: 'bg-slate-400' },
};

const DEFAULT_THEME = {
  grad: 'from-blue-500 to-indigo-600',
  pill: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  dot: 'bg-blue-400',
};

const getTheme = (s) => SPECIALTY_THEME[s] || DEFAULT_THEME;

/* ── Skeleton card ─────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl overflow-hidden border border-gray-100 dark:border-slate-700/80 shadow-sm animate-pulse">
      {/* Banner */}
      <div className="h-24 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-slate-700 dark:to-slate-600" />
      {/* Body */}
      <div className="px-5 pt-3 pb-5 -mt-8">
        {/* Avatar placeholder */}
        <div className="w-16 h-16 rounded-2xl bg-gray-200 dark:bg-slate-700 ring-4 ring-white dark:ring-slate-800 mb-4 shadow-md" />
        <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded-full w-3/4 mb-2" />
        <div className="h-3 bg-gray-100 dark:bg-slate-700/60 rounded-full w-1/3 mb-5" />
        <div className="space-y-2.5 mb-5">
          <div className="h-3 bg-gray-100 dark:bg-slate-700/60 rounded-full w-2/3" />
          <div className="h-3 bg-gray-100 dark:bg-slate-700/60 rounded-full w-1/2" />
          <div className="h-3 bg-gray-100 dark:bg-slate-700/60 rounded-full w-3/5" />
        </div>
        <div className="h-10 bg-gray-200 dark:bg-slate-700 rounded-2xl" />
      </div>
    </div>
  );
}

/* ── Doctor card ───────────────────────────────────────────────────── */
const DoctorCard = ({ doctor, index = 0 }) => {
  const navigate = useNavigate();
  const theme    = getTheme(doctor.specialty);
  const stars    = doctor.avgRating ? Math.round(doctor.avgRating) : 0;

  /* ── Avatar initial — first letter of firstName ── */
  const initial = (doctor.firstName?.[0] ?? '?').toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-28px' }}
      transition={{
        duration: 0.44,
        delay: (index % 6) * 0.055,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ y: -7, transition: { duration: 0.2, ease: 'easeOut' } }}
      /*
       * IMPORTANT: no overflow-hidden here — it clips the avatar that
       * overlaps the banner with a negative margin.
       * The banner gets its own overflow-hidden + rounded-t-3xl.
       */
      className="group flex flex-col bg-white dark:bg-slate-800/95 rounded-3xl border border-gray-100/90 dark:border-slate-700/70 shadow-sm hover:shadow-2xl hover:shadow-gray-300/40 dark:hover:shadow-slate-950/70 transition-[box-shadow,transform] duration-300"
    >
      {/* ══ Gradient banner ══ */}
      <div
        className={`relative h-24 bg-gradient-to-br ${theme.grad} rounded-t-3xl overflow-hidden shrink-0`}
      >
        {/* Dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
          aria-hidden
        />
        {/* Glow orb */}
        <div className="absolute -top-6 -right-6 w-28 h-28 bg-white/20 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-20 h-20 bg-black/10 rounded-full blur-2xl" />

        {/* Verified pill — top right */}
        {doctor.verified && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/25 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/30 shadow-sm">
            <CheckCircle className="w-2.5 h-2.5" />
            Verified
          </div>
        )}

        {/* Fee pill — bottom right */}
        {doctor.fee > 0 && (
          <div className="absolute bottom-2.5 right-3 flex items-center gap-0.5 bg-black/20 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            <IndianRupee className="w-2.5 h-2.5" />
            {doctor.fee.toLocaleString()}
          </div>
        )}
      </div>

      {/* ══ Card body ══ */}
      <div className="px-5 pb-5 pt-0 flex flex-col flex-1 -mt-8 relative">

        {/* ── Avatar — CRITICAL: no overflow-hidden on this div ── */}
        <div
          className={`
            w-16 h-16 rounded-2xl bg-gradient-to-br ${theme.grad}
            ring-4 ring-white dark:ring-slate-800
            shadow-lg shadow-black/15
            flex items-center justify-center
            mb-4 shrink-0 relative z-10
          `}
        >
          {doctor.image ? (
            /* image: wrap in overflow-hidden so it clips to rounded shape */
            <div className="w-full h-full rounded-2xl overflow-hidden">
              <img
                src={doctor.image}
                alt={doctor.firstName}
                className="w-full h-full object-cover"
                onError={e => { e.currentTarget.parentElement.style.display = 'none'; }}
              />
            </div>
          ) : (
            /* initial: plain span — never clipped */
            <span
              className="text-white font-black text-xl leading-none select-none"
              aria-hidden
            >
              {initial}
            </span>
          )}
        </div>

        {/* Name */}
        <h3 className="font-black text-gray-900 dark:text-white text-[15px] leading-tight mb-1.5 truncate pr-1">
          Dr.&nbsp;{doctor.firstName}&nbsp;{doctor.lastName}
        </h3>

        {/* Specialty pill */}
        <span
          className={`self-start inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full mb-4 ${theme.pill}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${theme.dot} opacity-70`} />
          {doctor.specialty}
        </span>

        {/* Info rows */}
        <div className="space-y-2 mb-4 flex-1">
          {doctor.location && (
            <InfoRow icon={<MapPin className="w-3.5 h-3.5" />}>
              {doctor.location}
            </InfoRow>
          )}
          {doctor.experience > 0 && (
            <InfoRow icon={<Clock className="w-3.5 h-3.5" />}>
              {doctor.experience} yrs experience
            </InfoRow>
          )}
        </div>

        {/* Star rating (only if doctor has been rated) */}
        {stars > 0 && (
          <div className="flex items-center gap-1.5 mb-4">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map(s => (
                <Star
                  key={s}
                  className={`w-3.5 h-3.5 ${s <= stars
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-gray-200 dark:text-slate-700 fill-gray-100 dark:fill-slate-700'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              {parseFloat(doctor.avgRating).toFixed(1)}
            </span>
            {doctor.totalRatings > 0 && (
              <span className="text-xs text-gray-400 dark:text-slate-500">
                ({doctor.totalRatings})
              </span>
            )}
          </div>
        )}

        {/* CTA button */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => navigate(`/view?docid=${doctor.id}`)}
          className={`
            w-full flex items-center justify-center gap-2
            bg-gradient-to-r ${theme.grad}
            text-white text-[13px] font-bold py-2.5 rounded-2xl
            shadow-md hover:shadow-lg
            transition-shadow duration-200
          `}
        >
          View &amp; Book
          <ArrowRight className="w-3.5 h-3.5" />
        </motion.button>
      </div>
    </motion.div>
  );
};

/* Tiny helper for icon + text info rows */
function InfoRow({ icon, children }) {
  return (
    <div className="flex items-start gap-2 text-sm text-gray-500 dark:text-gray-400 min-w-0">
      <span className="shrink-0 mt-0.5 text-gray-300 dark:text-slate-600">{icon}</span>
      <span className="truncate">{children}</span>
    </div>
  );
}

/* ── Grid wrapper + empty state ────────────────────────────────────── */
const Search = ({ queryParam, locationParam, doctors, loading, specialty }) => {

  if (loading) {
    return (
      <div className="mt-2 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  const activeSpecialty = specialty && specialty !== 'All' ? specialty : null;

  const heading = queryParam
    ? <>"<span className="text-blue-600 dark:text-blue-400">{queryParam}</span>"</>
    : activeSpecialty
      ? <><span className="text-blue-600 dark:text-blue-400">{activeSpecialty}</span> Doctors</>
      : 'All Doctors';

  if (doctors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center">
        <motion.div
          initial={{ scale: 0.75, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center mb-6 shadow-inner"
        >
          <Stethoscope className="w-11 h-11 text-blue-300 dark:text-slate-500" />
        </motion.div>
        <motion.h3
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          className="font-black text-gray-800 dark:text-gray-200 text-xl mb-2"
        >
          {activeSpecialty ? `No ${activeSpecialty} doctors yet` : 'No doctors found'}
        </motion.h3>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.35 }}
          className="text-gray-400 dark:text-slate-500 text-sm max-w-xs leading-relaxed"
        >
          {activeSpecialty
            ? `We don't have any ${activeSpecialty} registered yet. Try browsing all doctors.`
            : 'Try a different search term or remove some filters.'}
        </motion.p>
        {activeSpecialty && (
          <motion.a
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.22 }}
            href="/search"
            className="mt-6 inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 font-semibold hover:underline underline-offset-4"
          >
            Browse all doctors <ArrowRight className="w-3.5 h-3.5" />
          </motion.a>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2">
      {/* Results header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-black text-gray-900 dark:text-white">{heading}</h2>
          {locationParam && (
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-0.5">in {locationParam}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-slate-400 bg-gray-100/80 dark:bg-slate-800 px-3.5 py-1.5 rounded-full border border-gray-200/60 dark:border-slate-700/60">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
          {doctors.length} result{doctors.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Card grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {doctors.map((d, i) => (
          <DoctorCard key={d.id} doctor={d} index={i} />
        ))}
      </div>
    </div>
  );
};

export default Search;
