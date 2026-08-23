import React, { useEffect, useState, useContext } from 'react';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp, getDocs,
} from '@firebase/firestore';
import { db } from '../firebase/config';
import { AuthContext } from '../AuthContext';
import { Star, ThumbsUp, Edit3, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function StarPicker({ value, onChange, disabled }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onChange(s)}
          onMouseEnter={() => !disabled && setHover(s)}
          onMouseLeave={() => setHover(0)}
          className="disabled:cursor-not-allowed transition-transform hover:scale-110"
        >
          <Star
            className={`w-6 h-6 transition-colors ${
              s <= (hover || value)
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-200 dark:text-slate-600'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function ReviewCard({ review }) {
  const initials = review.patientName
    ? review.patientName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const timeAgo = review.createdAt?.toDate
    ? formatDistanceToNow(review.createdAt.toDate(), { addSuffix: true })
    : 'recently';

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-sm">{review.patientName || 'Anonymous'}</p>
              <p className="text-xs text-gray-400 mt-0.5">{timeAgo}</p>
            </div>
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map(s => (
                <Star key={s} className={`w-3.5 h-3.5 ${s <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 dark:text-slate-600'}`} />
              ))}
            </div>
          </div>
          {review.comment && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">{review.comment}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReviewSystem({ doctorId }) {
  const { currentUser, userType } = useContext(AuthContext);
  const [reviews, setReviews]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [canReview, setCanReview] = useState(false);

  /* Write review form */
  const [rating, setRating]       = useState(0);
  const [comment, setComment]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [editingId, setEditingId]   = useState(null);

  /* Fetch reviews */
  useEffect(() => {
    if (!doctorId) return;
    const q = query(collection(db, 'reviews'), where('doctorId', '==', doctorId));
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      setReviews(data);
      setLoading(false);

      /* Check if current patient can review (has a completed appointment, no review yet) */
      if (currentUser && userType === 'patient') {
        const myReview = data.find(r => r.patientId === currentUser.uid);
        if (myReview) {
          setRating(myReview.rating);
          setComment(myReview.comment ?? '');
          setEditingId(myReview.id);
          setSubmitted(true);
        }
      }
    });
    return () => unsub();
  }, [doctorId, currentUser, userType]);

  /* Check eligibility — patient with a completed appointment */
  useEffect(() => {
    if (!currentUser || userType !== 'patient' || !doctorId) return;
    getDocs(query(
      collection(db, 'appointments'),
      where('patientId', '==', currentUser.uid),
      where('doctorId', '==', doctorId),
      where('status', '==', 'completed')
    )).then(snap => setCanReview(!snap.empty));
  }, [currentUser, userType, doctorId]);

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length).toFixed(1)
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating || !currentUser) return;
    setSubmitting(true);
    try {
      const payload = {
        doctorId,
        patientId: currentUser.uid,
        patientName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Patient',
        rating,
        comment: comment.trim(),
        createdAt: serverTimestamp(),
      };
      if (editingId) {
        await updateDoc(doc(db, 'reviews', editingId), { rating, comment: comment.trim() });
      } else {
        await addDoc(collection(db, 'reviews'), payload);
      }
      setSubmitted(true);
    } catch (err) {
      console.error('Review submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center gap-6">
        <div className="text-center">
          <p className="text-5xl font-black text-gray-900 dark:text-white">{avgRating ?? '—'}</p>
          <div className="flex justify-center gap-0.5 mt-1">
            {[1,2,3,4,5].map(s => (
              <Star key={s} className={`w-4 h-4 ${s <= Math.round(avgRating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 dark:text-slate-600'}`} />
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex-1 space-y-1.5">
          {[5, 4, 3, 2, 1].map(s => {
            const count = reviews.filter(r => r.rating === s).length;
            const pct   = reviews.length ? (count / reviews.length) * 100 : 0;
            return (
              <div key={s} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-gray-500">{s}</span>
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 shrink-0" />
                <div className="flex-1 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-5 text-gray-400 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Write review form */}
      {currentUser && userType === 'patient' && canReview && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            {submitted ? <Edit3 className="w-4 h-4 text-blue-600" /> : <ThumbsUp className="w-4 h-4 text-blue-600" />}
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
              {submitted ? 'Edit your review' : 'Leave a review'}
            </h3>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Your rating</p>
              <StarPicker value={rating} onChange={setRating} />
            </div>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Share your experience with this doctor... (optional)"
              rows={3}
              className="w-full text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <button
              type="submit"
              disabled={!rating || submitting}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Submitting...' : submitted ? 'Update Review' : 'Submit Review'}
            </button>
          </form>
        </div>
      )}

      {/* Reviews list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
      ) : reviews.length > 0 ? (
        <div className="space-y-3">
          {reviews.map(r => <ReviewCard key={r.id} review={r} />)}
        </div>
      ) : (
        <div className="text-center py-8">
          <Star className="w-10 h-10 text-gray-200 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No reviews yet. Be the first!</p>
        </div>
      )}
    </div>
  );
}
