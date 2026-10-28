import React from 'react';
import Card from './Card';

/**
 * Kartu ringkasan angka (Uang Masuk, Uang Keluar, Piutang, Utang, dll.)
 */
export default function StatCard({
  label,
  value,
  subtext,
  icon: Icon,
  variant = 'default',
  className = ''
}) {
  const iconColors = {
    default: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    income: 'bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200',
    expense: 'bg-red-50 text-status-danger dark:bg-red-950/50 dark:text-red-400',
    warning: 'bg-amber-50 text-status-warning dark:bg-amber-950/50 dark:text-amber-400',
    info: 'bg-blue-50 text-status-info dark:bg-blue-950/50 dark:text-blue-400'
  };

  const valueColors = {
    default: 'text-gray-900 dark:text-gray-100',
    income: 'text-primary-700 dark:text-primary-400',
    expense: 'text-status-danger dark:text-red-400',
    warning: 'text-status-warning dark:text-amber-400',
    info: 'text-status-info dark:text-blue-400'
  };

  return (
    <Card className={`flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
          {label}
        </span>
        {Icon && (
          <span
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              iconColors[variant] || iconColors.default
            }`}
          >
            <Icon className="w-4 h-4" />
          </span>
        )}
      </div>
      <div
        className={`text-lg font-bold tabular-nums tracking-tight ${
          valueColors[variant] || valueColors.default
        }`}
      >
        {value}
      </div>
      {subtext && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtext}</p>
      )}
    </Card>
  );
}

