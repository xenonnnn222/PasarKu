import React from 'react';
import { Inbox } from 'lucide-react';
import Button from './Button';

/**
 * Tampilan saat daftar kosong (ilustrasi ikon + teks ramah + tombol aksi opsional)
 */
export default function EmptyState({
  icon: Icon = Inbox,
  title = 'Belum ada data',
  description = 'Data yang Anda catat akan muncul di sini.',
  actionLabel,
  onAction
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 px-4">
      <div className="w-14 h-14 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center mb-3">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
        {title}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[260px] mt-1">
        {description}
      </p>
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

