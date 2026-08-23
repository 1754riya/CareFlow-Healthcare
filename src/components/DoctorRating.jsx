import React, { useState } from 'react';
import { doc, updateDoc, getDoc } from '@firebase/firestore';
import { db } from '../firebase/config';
import { Star } from 'lucide-react';

export default function DoctorRating({ appointmentId, doctorId, onDone }) {
  const [rating, setRating]   = useState(0);
  const [hovered, setHovered] = useState(0);
  const [saving, setSaving]   = useState(false);
  const [done, setDone]       = useState(false);

  const handleSubmit = async () => {
    if (!rating) return;
    setSaving(true);
    try {
      /* save rating on appointment */
      await updateDoc(doc(db, 'appointments', appointmentId), { rating });

      /* update doctor's average rating */
      const doctorSnap = await getDoc(doc(db, 'doctors', doctorId));
      if (doctorSnap.exists()) {
        const data = doctorSnap.data();
        const total = (data.totalRatings ?? 0) + 1;
        const avg   = ((data.avgRating ?? 0) * (total - 1) + rating) / total;
        await updateDoc(doc(db, 'doctors', doctorId), {
          avgRating:    parseFloat(avg.toFixed(1)),
          totalRatings: total,
        });
      }

      setDone(true);
      onDone?.();
    } catch (err) {
      console.error('Rating error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
        <Star className="w-4 h-4 fill-green-500 text-green-500" />
        Thanks for your feedback!
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-500 dark:text-gray-400">Rate:</span>
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          onMouseEnter={() => setHovered(s)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => setRating(s)}
          className="focus:outline-none"
          aria-label={`Rate ${s} stars`}
        >
          <Star className={`w-5 h-5 transition-colors ${
            s <= (hovered || rating)
              ? 'text-yellow-400 fill-yellow-400'
              : 'text-gray-300 dark:text-slate-600'
          }`} />
        </button>
      ))}
      {rating > 0 && (
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="ml-1 text-xs bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Submit'}
        </button>
      )}
    </div>
  );
}
