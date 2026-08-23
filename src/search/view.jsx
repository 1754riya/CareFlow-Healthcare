import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { doc, getDoc } from '@firebase/firestore';
import { db } from '../firebase/config';
import { MapPin, Star, Award, Stethoscope, GraduationCap, Clock } from 'lucide-react';
import AppointmentBooking from '../components/AppointmentBooking';
import ReviewSystem from '../reviews/ReviewSystem';
import VerifiedBadge from '../components/VerifiedBadge';

const Skeleton = ({ className = '' }) => <div className={`skeleton rounded-2xl ${className}`} />;

export default function View() {
  const location = useLocation();
  const docid = new URLSearchParams(location.search).get('docid');

  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!docid) { setError('No doctor ID provided.'); setLoading(false); return; }
    getDoc(doc(db, 'doctors', docid))
      .then(snap => snap.exists() ? setDoctor({ id: docid, ...snap.data() }) : setError('Doctor not found.'))
      .catch(() => setError('Error fetching doctor details.'))
      .finally(() => setLoading(false));
  }, [docid]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pt-20">
      <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-36" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-96" />
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center pt-20">
      <div className="text-center">
        <Stethoscope className="w-16 h-16 text-gray-200 dark:text-slate-700 mx-auto mb-4" />
        <p className="text-red-500 font-medium">{error}</p>
      </div>
    </div>
  );

  const stars = doctor.avgRating ? Math.round(doctor.avgRating) : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pt-16 pb-36 md:pb-8">
      {/* ── Mobile sticky CTA ── */}
      <div className="fixed bottom-16 left-0 right-0 z-30 md:hidden bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-t border-gray-100 dark:border-slate-700 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
        <button
          onClick={() => document.getElementById('booking-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3.5 rounded-2xl text-sm shadow-lg shadow-blue-300/40 flex items-center justify-center gap-2"
        >
          Book Appointment
          {doctor?.fee > 0 && <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">₹{doctor.fee.toLocaleString()}</span>}
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* ── Left: Doctor info ── */}
          <div className="md:col-span-2 space-y-5 animate-fade-in">

            {/* Profile card */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
              {/* Cover gradient */}
              <div className="h-28 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500" />
              <div className="px-6 pb-6">
                <div className="flex items-end gap-4 -mt-12 mb-4">
                  <div className="w-24 h-24 rounded-2xl border-4 border-white dark:border-slate-800 overflow-hidden bg-blue-100 shadow-md shrink-0">
                    <img
                      src={doctor.image || `https://placehold.co/200x200/e0f2fe/0369a1?text=Dr.+${doctor.firstName?.[0] ?? '?'}`}
                      alt={`Dr. ${doctor.firstName}`}
                      className="w-full h-full object-cover"
                      onError={e => { e.target.src = `https://placehold.co/200x200/e0f2fe/0369a1?text=Dr.+${doctor.firstName?.[0] ?? '?'}`; }}
                    />
                  </div>
                  <div className="pb-1 flex flex-wrap items-center gap-2">
                    {doctor.verified && <VerifiedBadge />}
                    {doctor.successRate && (
                      <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full font-medium">
                        {doctor.successRate}% Success Rate
                      </span>
                    )}
                  </div>
                </div>

                <h1 className="text-2xl font-black text-gray-900 dark:text-white">
                  Dr. {doctor.firstName} {doctor.lastName}
                </h1>
                <div className="flex items-center gap-1.5 mt-1">
                  <Stethoscope className="w-4 h-4 text-blue-500" />
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">{doctor.specialty}</span>
                  {doctor.qualifications && (
                    <span className="text-gray-400 dark:text-gray-500 text-sm"> · {doctor.qualifications}</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-4 mt-4">
                  {doctor.experience && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                      <Award className="w-4 h-4 text-amber-500" />
                      <span>{doctor.experience} yrs experience</span>
                    </div>
                  )}
                  {(doctor.clinicName || doctor.location) && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                      <MapPin className="w-4 h-4 text-red-500" />
                      <span>{doctor.clinicName || doctor.location}</span>
                    </div>
                  )}
                  {doctor.avgRating > 0 && (
                    <div className="flex items-center gap-1">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={`w-3.5 h-3.5 ${s <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 dark:text-slate-600'}`} />
                      ))}
                      <span className="text-sm text-gray-500 ml-1">{parseFloat(doctor.avgRating).toFixed(1)} ({doctor.totalRatings})</span>
                    </div>
                  )}
                </div>

                {/* Verification info */}
                {doctor.licenseNumber && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-700 rounded-lg px-3 py-2 w-fit">
                    <GraduationCap className="w-3.5 h-3.5" />
                    License: {doctor.licenseNumber}
                  </div>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
              {['overview', 'reviews'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 capitalize py-2 text-sm font-semibold rounded-lg transition-all ${
                    activeTab === tab
                      ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Overview tab */}
            {activeTab === 'overview' && (
              <div className="space-y-4 animate-fade-in">
                {/* About */}
                {doctor.about && (
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-3">About</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{doctor.about}</p>
                  </div>
                )}

                {/* Specializations */}
                {doctor.specializations?.length > 0 && (
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-3">Specializations</h3>
                    <div className="flex flex-wrap gap-2">
                      {doctor.specializations.map(s => (
                        <span key={s} className="text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-3 py-1 rounded-full">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Experience', value: doctor.experience ? `${doctor.experience} yrs` : 'N/A', icon: <Clock className="w-5 h-5 text-blue-500" /> },
                    { label: 'Rating', value: doctor.avgRating ? `${parseFloat(doctor.avgRating).toFixed(1)}/5` : 'New', icon: <Star className="w-5 h-5 text-yellow-500" /> },
                    { label: 'Reviews', value: doctor.totalRatings ?? 0, icon: <Award className="w-5 h-5 text-green-500" /> },
                  ].map(s => (
                    <div key={s.label} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 text-center">
                      <div className="flex justify-center mb-2">{s.icon}</div>
                      <p className="font-bold text-gray-900 dark:text-white text-lg">{s.value}</p>
                      <p className="text-xs text-gray-400">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews tab */}
            {activeTab === 'reviews' && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 animate-fade-in">
                <h3 className="font-bold text-gray-900 dark:text-white mb-5 text-lg">Patient Reviews</h3>
                <ReviewSystem doctorId={docid} />
              </div>
            )}
          </div>

          {/* ── Right: Booking ── */}
          <div id="booking-section" className="md:sticky md:top-20 h-fit scroll-mt-20">
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-700">
                <h2 className="font-bold text-gray-900 dark:text-white text-lg">Book Appointment</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Select your preferred date and time</p>
              </div>
              <div className="p-6">
                <AppointmentBooking doctor={doctor} docid={docid} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
