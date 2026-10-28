import { useState, useCallback } from 'react';

/**
 * Custom hook penyimpanan ke localStorage dengan try/catch aman dan fallback ke nilai awal
 */
export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null || raw === undefined) {
        const valueToStore =
          typeof initialValue === 'function' ? initialValue() : initialValue;
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        return valueToStore;
      }
      const parsed = JSON.parse(raw);
      if (parsed === null || parsed === undefined) {
        throw new Error('Data kosong');
      }
      return parsed;
    } catch (error) {
      // Fallback aman apabila JSON rusak/korup
      const fallback =
        typeof initialValue === 'function' ? initialValue() : initialValue;
      try {
        window.localStorage.setItem(key, JSON.stringify(fallback));
      } catch (_) {
        // Abaikan jika storage penuh
      }
      return fallback;
    }
  });

  const setValue = useCallback(
    (value) => {
      try {
        setStoredValue((prev) => {
          const nextValue = typeof value === 'function' ? value(prev) : value;
          window.localStorage.setItem(key, JSON.stringify(nextValue));
          return nextValue;
        });
      } catch (_) {
        // Abaikan error kuota penyimpanan
      }
    },
    [key]
  );

  return [storedValue, setValue];
}

