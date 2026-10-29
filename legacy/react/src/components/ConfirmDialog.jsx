import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from './Button';

/**
 * Dialog konfirmasi untuk aksi penting seperti hapus transaksi, hapus barang, atau reset data
 */
export default function ConfirmDialog({
  isOpen,
  title = 'Konfirmasi',
  message,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  variant = 'danger',
  onConfirm,
  onCancel
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60"
      onClick={onCancel}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="w-full max-w-[380px] bg-white dark:bg-surface-darkCard rounded-card p-5 shadow-xl space-y-4 animate-page"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              variant === 'danger'
                ? 'bg-red-100 text-status-danger dark:bg-red-950/60 dark:text-red-400'
                : 'bg-amber-100 text-status-warning dark:bg-amber-950/60 dark:text-amber-400'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3
              id="confirm-dialog-title"
              className="text-lg font-bold text-gray-900 dark:text-gray-100"
            >
              {title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              {message}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

