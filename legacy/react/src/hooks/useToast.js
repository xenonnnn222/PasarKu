import { useContext } from 'react';
import { ToastContext } from '../components/Toast';

/**
 * Hook untuk memanggil notifikasi toast dari komponen mana saja
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast harus dipakai di dalam ToastProvider');
  }
  return context;
}

