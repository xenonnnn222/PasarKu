import React from 'react';

/**
 * Komponen Lencana Status (Lunas, Belum lunas, Terlambat, Menipis, Habis, Info)
 */
export default function Badge({ children, variant = 'neutral', className = '' }) {
  const variants = {
    success:
      'bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-200',
    warning:
      'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300',
    danger:
      'bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300',
    info:
      'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300',
    neutral:
      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        variants[variant] || variants.neutral
      } ${className}`}
    >
      {children}
    </span>
  );
}

