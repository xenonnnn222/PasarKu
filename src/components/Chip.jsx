import React from 'react';

/**
 * Chip berbentuk pil (rounded-full) untuk filter atau pilihan kategori
 */
export default function Chip({
  label,
  icon: Icon,
  selected = false,
  onClick,
  variant = 'primary',
  className = ''
}) {
  const selectedStyles =
    variant === 'danger'
      ? 'bg-red-600 text-white border-red-600 shadow-sm'
      : 'bg-primary-600 text-white border-primary-600 shadow-sm';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-full border text-sm font-medium transition-all shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
        selected
          ? selectedStyles
          : 'bg-white dark:bg-surface-darkCard border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
      } ${className}`}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      <span>{label}</span>
    </button>
  );
}

