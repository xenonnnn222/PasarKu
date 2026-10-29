import React from 'react';
import { ArrowDownLeft, ArrowUpRight, User } from 'lucide-react';
import { formatRupiah } from '../utils/formatRupiah';
import { formatShortDate } from '../utils/formatDate';
import { isPriveCategory } from '../utils/calculations';

/**
 * Baris item transaksi untuk Beranda dan Riwayat Transaksi
 */
export default function TransactionItem({ transaction, onClick, showDate = true }) {
  const isIncome = transaction.type === 'in';
  const isPrive = isPriveCategory(transaction.category);

  const Icon = isIncome ? ArrowDownLeft : isPrive ? User : ArrowUpRight;
  const iconStyle = isIncome
    ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
    : isPrive
    ? 'bg-blue-50 text-status-info dark:bg-blue-950/50 dark:text-blue-300'
    : 'bg-red-50 text-status-danger dark:bg-red-950/50 dark:text-red-400';

  const amountColor = isIncome
    ? 'text-primary-700 dark:text-primary-400'
    : 'text-status-danger dark:text-red-400';

  return (
    <button
      type="button"
      onClick={() => onClick && onClick(transaction)}
      className="w-full flex items-center justify-between gap-3 py-3 px-2 rounded-btn hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconStyle}`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
              {transaction.category}
            </span>
            {isPrive && (
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 font-medium">
                Pribadi
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {transaction.note || (isIncome ? 'Uang masuk' : 'Uang keluar')}
            {showDate ? ` • ${formatShortDate(transaction.date)}` : ''}
          </p>
        </div>
      </div>
      <div className={`text-base font-bold tabular-nums shrink-0 ${amountColor}`}>
        {isIncome ? '+' : '-'}
        {formatRupiah(transaction.amount)}
      </div>
    </button>
  );
}

