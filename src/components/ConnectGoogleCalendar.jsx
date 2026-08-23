import { useContext, useEffect, useState } from 'react';
import { CalendarCheck, Loader2 } from 'lucide-react';
import { AuthContext } from '../AuthContext';
import { useToast } from './Toast';
import { connectGoogleCalendar, disconnectGoogleCalendar, getGoogleCalendarStatus } from '../utils/googleCalendarAuth';

export default function ConnectGoogleCalendar() {
  const { currentUser } = useContext(AuthContext);
  const toast = useToast();

  const [connected, setConnected] = useState(null); // null = unknown/loading
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    getGoogleCalendarStatus().then(setConnected).catch(() => setConnected(false));
  }, [currentUser]);

  const handleConnect = async () => {
    setBusy(true);
    try {
      await connectGoogleCalendar();
      setConnected(true);
      toast.success('Google Calendar connected', 'Your appointments will now be added to your calendar.');
    } catch (err) {
      toast.error('Connection failed', err.message || 'Could not connect Google Calendar. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await disconnectGoogleCalendar();
      setConnected(false);
      toast.success('Disconnected', 'Google Calendar has been disconnected.');
    } catch (err) {
      toast.error('Failed to disconnect', err.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl px-5 py-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
          <CalendarCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 dark:text-white text-sm">Google Calendar</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
            {connected === null ? 'Checking connection…' : connected
              ? 'Appointments are synced to your calendar.'
              : 'Automatically add appointments to your calendar.'}
          </p>
        </div>
      </div>

      {connected === null ? (
        <Loader2 className="w-4 h-4 text-gray-300 animate-spin shrink-0" />
      ) : connected ? (
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={busy}
          className="shrink-0 text-sm font-medium px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          {busy ? 'Disconnecting…' : 'Disconnect'}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleConnect}
          disabled={busy}
          className="shrink-0 text-sm font-medium px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
        >
          {busy ? 'Connecting…' : 'Connect'}
        </button>
      )}
    </div>
  );
}
