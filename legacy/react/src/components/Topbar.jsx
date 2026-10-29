import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Settings, ArrowLeft, Menu, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatFullDate } from '../utils/formatDate';

/**
 * Topbar Desktop-First:
 * Berisi tombol hamburger (< 768px), judul halaman, pencarian cepat, tanggal hari ini, dan menu profil
 */
export default function Topbar({
  title,
  subtitle,
  showBack = false,
  rightAction,
  onOpenMobileMenu
}) {
  const navigate = useNavigate();
  const { settings } = useApp();
  const [quickSearch, setQuickSearch] = useState('');
  const todayLabel = formatFullDate(new Date());

  const handleQuickSearch = (e) => {
    e.preventDefault();
    const q = quickSearch.trim();
    if (q) {
      navigate(`/riwayat?q=${encodeURIComponent(q)}`);
    } else {
      navigate('/riwayat');
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-surface-darkCard/95 backdrop-blur border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 no-print">
      {/* Kiri: Hamburger (<768px) / Back + Judul Halaman */}
      <div className="flex items-center gap-3 min-w-0">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Buka menu navigasi"
            className="md:hidden w-10 h-10 rounded-btn border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {showBack && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Kembali"
            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
            {title || settings?.businessName || 'PasarKu'}
          </h1>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate hidden sm:block">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Kanan: Pencarian Cepat, Tanggal, Aksi Tambahan, Menu Profil */}
      <div className="flex items-center gap-3 shrink-0">
        <form onSubmit={handleQuickSearch} className="hidden lg:block relative w-60">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            placeholder="Cari transaksi..."
            aria-label="Cari transaksi cepat"
            className="w-full h-10 pl-9 pr-3 rounded-btn border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-dark text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white"
          />
        </form>

        <div className="hidden xl:flex items-center gap-2 px-3.5 py-2 rounded-btn bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-300">
          <Calendar className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          <span>{todayLabel}</span>
        </div>

        {rightAction}

        <button
          type="button"
          onClick={() => navigate('/pengaturan')}
          aria-label="Pengaturan Profil Usaha"
          className="flex items-center gap-2.5 pl-2 pr-2.5 sm:pr-3.5 py-1.5 rounded-btn border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <span className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/60 text-primary-800 dark:text-primary-200 font-bold text-sm flex items-center justify-center">
            {(settings?.ownerName || 'B').charAt(0).toUpperCase()}
          </span>
          <span className="hidden sm:inline text-sm font-semibold text-gray-800 dark:text-gray-200 max-w-[130px] truncate">
            {settings?.ownerName || 'Bu Sari'}
          </span>
          <Settings className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </button>
      </div>
    </header>
  );
}
