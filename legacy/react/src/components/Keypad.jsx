import React from 'react';
import { Delete } from 'lucide-react';

/**
 * Keypad angka custom (0-9, 000, Hapus) dengan tombol besar untuk pedagang pasar
 */
export default function Keypad({ value = '', onChange, maxAmount = 100000000 }) {
  const handleDigit = (digits) => {
    const cleanCurrent = String(value || '').replace(/^0+/, '');
    const nextStr = `${cleanCurrent}${digits}`;
    const nextNum = Number(nextStr || '0');
    if (nextNum <= maxAmount) {
      onChange(String(nextNum));
    }
  };

  const handleBackspace = () => {
    const str = String(value || '');
    if (str.length <= 1) {
      onChange('0');
    } else {
      onChange(str.slice(0, -1));
    }
  };

  const handleClear = () => {
    onChange('0');
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0'];

  return (
    <div className="grid grid-cols-3 gap-2 select-none" role="group" aria-label="Papan tombol nominal">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => handleDigit(key)}
          className="min-h-[54px] rounded-btn bg-white dark:bg-surface-darkCard border border-gray-200 dark:border-gray-700 text-xl font-bold text-gray-900 dark:text-gray-100 active:bg-primary-50 dark:active:bg-gray-800 active:scale-[0.98] transition-all shadow-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          {key}
        </button>
      ))}
      <button
        type="button"
        onClick={handleBackspace}
        onDoubleClick={handleClear}
        aria-label="Hapus angka terakhir"
        className="min-h-[54px] rounded-btn bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-200 active:bg-red-50 active:text-status-danger transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <Delete className="w-6 h-6" />
      </button>
    </div>
  );
}

