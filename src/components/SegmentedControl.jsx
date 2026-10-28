import React from 'react';

/**
 * Segmented Control untuk berpindah tab (contoh: Uang Masuk | Uang Keluar)
 */
export default function SegmentedControl({ options = [], value, onChange, ariaLabel = 'Pilih tampilan' }) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="grid bg-gray-200/80 dark:bg-gray-800 p-1 rounded-btn gap-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const isActive = value === opt.value;
        const activeColor =
          opt.activeClass ||
          'bg-white dark:bg-surface-darkCard text-primary-700 dark:text-primary-400 shadow-sm';
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(opt.value)}
            className={`min-h-[44px] px-3 py-2 rounded-[10px] text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
              isActive
                ? activeColor
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

