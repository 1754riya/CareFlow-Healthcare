import { createContext, useContext, useState, useCallback, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
  success: <CheckCircle className="w-5 h-5 text-green-500" />,
  error:   <XCircle    className="w-5 h-5 text-red-500"   />,
  warning: <AlertCircle className="w-5 h-5 text-amber-500" />,
  info:    <Info        className="w-5 h-5 text-blue-500"  />,
};

const BG = {
  success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  error:   'bg-red-50   dark:bg-red-900/20   border-red-200   dark:border-red-800',
  warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  info:    'bg-blue-50  dark:bg-blue-900/20  border-blue-200  dark:border-blue-800',
};

function ToastItem({ toast, onClose }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.9 }}
      animate={{ opacity: 1, x: 0,  scale: 1   }}
      exit={{    opacity: 0, x: 80, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`flex items-start gap-3 px-4 py-3 rounded-2xl border shadow-lg max-w-sm w-full ${BG[toast.type]}`}
    >
      <span className="mt-0.5 shrink-0">{ICONS[toast.type]}</span>
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{toast.title}</p>
        )}
        {toast.message && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="shrink-0 p-0.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((type, titleOrOpts, message) => {
    const id = `${Date.now()}-${Math.random()}`;
    const opts = typeof titleOrOpts === 'string'
      ? { title: titleOrOpts, message }
      : titleOrOpts;

    setToasts(prev => [...prev.slice(-4), { id, type, ...opts }]);

    const duration = opts.duration ?? (type === 'error' ? 6000 : 4000);
    setTimeout(() => remove(id), duration);
  }, [remove]);

  const api = {
    success: (t, m) => toast('success', t, m),
    error:   (t, m) => toast('error',   t, m),
    warning: (t, m) => toast('warning', t, m),
    info:    (t, m) => toast('info',    t, m),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-24 md:bottom-6 right-4 z-[100] flex flex-col gap-2 items-end">
        <AnimatePresence mode="popLayout">
          {toasts.map(t => (
            <ToastItem key={t.id} toast={t} onClose={remove} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
