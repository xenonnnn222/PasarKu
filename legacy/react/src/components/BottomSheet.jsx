import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Komponen Modal di Tengah Layar (maks 560px) untuk form tambah/ubah/detail
 */
export default function BottomSheet({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-dialog-title"
    >
      <div
        className="w-full max-w-[560px] max-h-[90vh] flex flex-col bg-white dark:bg-surface-darkCard rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 animate-sheet overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h3
            id="modal-dialog-title"
            className="text-[18px] font-semibold text-gray-900 dark:text-gray-100"
          >
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4">{children}</div>
      </div>
    </div>
  );
}
