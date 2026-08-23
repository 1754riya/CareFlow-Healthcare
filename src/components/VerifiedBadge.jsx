import React from 'react';
import { ShieldCheck } from 'lucide-react';

export default function VerifiedBadge({ size = 'md', showLabel = true }) {
  const sizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 px-2 py-0.5 rounded-full text-xs font-semibold">
      <ShieldCheck className={`${sizes[size]} shrink-0`} />
      {showLabel && 'Verified'}
    </span>
  );
}
