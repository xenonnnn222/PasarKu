import React, { createContext, useState, useCallback, useMemo } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const ToastContext = createContext(null);

/**
 * Provider Toast untuk menampilkan pesan singkat di bagian atas layar
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message, type = 'success', duration = 3000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      setToasts((prev) => [...prev, { id, message, type }]);
      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }
    },
    [removeToast]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="fixed top-3 left-1/2 -translate-x-1/2 z-[70] w-full max-w-[440px] px-4 space-y-2 pointer-events-none no-print"
      >
        {toasts.map((t) => {
          const styles = {
            success: 'bg-primary-800 text-white border-primary-700',
            error: 'bg-status-danger text-white border-red-700',
            info: 'bg-gray-900 text-white border-gray-700'
          };
          const Icon =
            t.type === 'error'
              ? AlertCircle
              : t.type === 'info'
              ? Info
              : CheckCircle2;

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-btn border shadow-lg animate-page ${
                styles[t.type] || styles.success
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium">{t.message}</span>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                aria-label="Tutup pesan"
                className="p-1 rounded hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

