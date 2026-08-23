import React from 'react';
import { Check, Clock, Stethoscope, CheckCircle } from 'lucide-react';

const STEPS = [
  { key: 'booked',      label: 'Booked',      icon: Check },
  { key: 'confirmed',   label: 'Confirmed',   icon: Clock },
  { key: 'in_progress', label: 'In Progress', icon: Stethoscope },
  { key: 'completed',   label: 'Completed',   icon: CheckCircle },
];

function getActiveIndex(status) {
  switch (status) {
    case 'pending':     return 0;
    case 'confirmed':   return 1;
    case 'in_progress': return 2;
    case 'completed':   return 3;
    case 'cancelled':   return -1;
    default:            return 0;
  }
}

export default function AppointmentTimeline({ status }) {
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 text-xs text-red-500 font-medium mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
        <span className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500 text-xs">✕</span>
        Appointment cancelled
      </div>
    );
  }

  const activeIdx = getActiveIndex(status);

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
      <div className="flex items-center">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const done    = i < activeIdx;
          const current = i === activeIdx;
          const future  = i > activeIdx;
          const isLast  = i === STEPS.length - 1;

          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-500 ${
                  done
                    ? 'bg-green-500 text-white'
                    : current
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/30'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-gray-500'
                }`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className={`text-[9px] font-medium whitespace-nowrap ${
                  done    ? 'text-green-600 dark:text-green-400' :
                  current ? 'text-blue-600 dark:text-blue-400' :
                  'text-gray-400 dark:text-gray-500'
                }`}>
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div className={`flex-1 h-0.5 mx-1 transition-all duration-700 ${
                  i < activeIdx ? 'bg-green-400' : 'bg-gray-200 dark:bg-slate-600'
                }`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
