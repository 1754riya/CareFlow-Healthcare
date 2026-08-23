import React, { useEffect, useState, useRef, useContext } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch } from '@firebase/firestore';
import { db } from '../firebase/config';
import { AuthContext } from '../AuthContext';
import { Bell, Check, Calendar, X, Pill } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const TYPE_ICON = {
  new_appointment:        { icon: Calendar, color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30' },
  appointment_confirmed:  { icon: Check,    color: 'text-green-500 bg-green-50 dark:bg-green-900/30' },
  appointment_cancelled:  { icon: X,        color: 'text-red-500 bg-red-50 dark:bg-red-900/30' },
  appointment_completed:  { icon: Check,    color: 'text-violet-500 bg-violet-50 dark:bg-violet-900/30' },
  medication_reminder:    { icon: Pill,     color: 'text-orange-500 bg-orange-50 dark:bg-orange-900/30' },
};

function NotifItem({ notif, onRead }) {
  const meta = TYPE_ICON[notif.type] ?? TYPE_ICON.new_appointment;
  const Icon = meta.icon;
  const ts = notif.createdAt?.toDate?.() ?? new Date(notif.createdAt);

  return (
    <div
      onClick={() => !notif.read && onRead(notif.id)}
      className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${
        !notif.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
      }`}
    >
      <div className={`${meta.color} p-2 rounded-lg shrink-0 mt-0.5`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${notif.read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white font-medium'}`}>
          {notif.message}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {formatDistanceToNow(ts, { addSuffix: true })}
        </p>
      </div>
      {!notif.read && (
        <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1.5" />
      )}
    </div>
  );
}

export default function NotificationCenter() {
  const { currentUser } = useContext(AuthContext);
  const [notifs, setNotifs] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  /* real-time listener */
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid)
    );
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = a.createdAt?.toDate?.() ?? new Date(a.createdAt);
          const tb = b.createdAt?.toDate?.() ?? new Date(b.createdAt);
          return tb - ta;
        });
      setNotifs(data);
    });
    return () => unsub();
  }, [currentUser]);

  /* close on outside click */
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unread = notifs.filter(n => !n.read).length;

  const markRead = async (id) => {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  };

  const markAllRead = async () => {
    const batch = writeBatch(db);
    notifs.filter(n => !n.read).forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Notifications</h3>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-500 hover:underline">
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="w-10 h-10 text-gray-200 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No notifications yet</p>
              </div>
            ) : (
              notifs.slice(0, 20).map(n => (
                <NotifItem key={n.id} notif={n} onRead={markRead} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
