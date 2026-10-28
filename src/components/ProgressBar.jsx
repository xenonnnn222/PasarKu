import React from 'react';

/**
 * Progress bar untuk cicilan kasbon atau persentase pengeluaran
 */
export default function ProgressBar({
  value = 0,
  max = 100,
  colorClass = 'bg-primary-600',
  className = ''
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0;

  return (
    <div
      className={`w-full h-2.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden ${className}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

