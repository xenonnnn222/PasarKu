import { useEffect } from 'react';

/**
 * Mengatur class dark mode dan ukuran huruf pada elemen <html>
 */
export function useTheme(theme = 'light', fontSize = 'normal') {
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const isDark =
        theme === 'dark' || (theme === 'system' && mediaQuery.matches);
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme();
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (fontSize === 'besar') {
      root.classList.add('font-besar');
    } else {
      root.classList.remove('font-besar');
    }
  }, [fontSize]);
}

