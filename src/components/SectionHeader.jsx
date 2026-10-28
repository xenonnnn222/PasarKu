import React from 'react';

/**
 * Judul bagian (18px semibold) dengan tombol/tautan aksi opsional di sebelah kanan
 */
export default function SectionHeader({ title, subtitle, actionLabel, onAction }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <div>
        <h2 className="text-[18px] font-semibold text-gray-900 dark:text-gray-100 leading-snug">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        )}
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="text-sm font-semibold text-primary-700 dark:text-primary-400 hover:underline py-1 px-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

