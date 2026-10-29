import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Store,
  Home,
  PlusCircle,
  BookOpen,
  Package,
  BarChart3,
  History,
  Settings,
  LogOut,
  X
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../hooks/useToast';

const MENU_ITEMS = [
  { to: '/', label: 'Beranda', icon: Home, end: true },
  { to: '/catat', label: 'Catat Transaksi', icon: PlusCircle },
  { to: '/kasbon', label: 'Kasbon', icon: BookOpen },
  { to: '/stok', label: 'Stok Barang', icon: Package },
  { to: '/laporan', label: 'Laporan', icon: BarChart3 },
  { to: '/riwayat', label: 'Riwayat', icon: History },
  { to: '/pengaturan', label: 'Pengaturan', icon: Settings }
];

/**
 * Sidebar Kiri Tetap (256px / w-64):
 * - Desktop & Tablet (>= 768px): selalu tampil tetap di sisi kiri (256px)
 * - Layar kecil (< 768px): dibuka melalui tombol menu Hamburger di Topbar
 */
export default function Sidebar({ isOpen = false, onClose }) {
  const navigate = useNavigate();
  const { settings, logoutUser } = useApp();
  const { showToast } = useToast();

  const handleLogout = () => {
    if (onClose) onClose();
    logoutUser();
    showToast('Anda telah keluar dari sesi');
    navigate('/login', { replace: true });
  };

  const sidebarContent = (
    <div className="flex flex-col h-full w-64 bg-white dark:bg-surface-darkCard border-r border-gray-200 dark:border-gray-800 select-none">
      {/* Header Logo PasarKu */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100 tracking-tight block leading-none">
              PasarKu
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1">
              Dashboard Pedagang
            </span>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup menu navigasi"
            className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Menu Navigasi Utama */}
      <nav className="flex-1 py-5 px-3 space-y-1 overflow-y-auto" aria-label="Menu Utama">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => onClose && onClose()}
              className={({ isActive }) =>
                `relative flex items-center gap-3 min-h-[46px] px-4 py-2.5 rounded-btn text-[15px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-semibold'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/70 hover:text-gray-900 dark:hover:text-gray-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary-600 dark:bg-primary-400" />
                  )}
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Profil Usaha & Tombol Keluar di Bawah */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-3 bg-gray-50/50 dark:bg-gray-900/20">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/60 text-primary-800 dark:text-primary-200 font-bold text-sm flex items-center justify-center shrink-0">
            {(settings?.ownerName || 'B').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
              {settings?.businessName || 'Lapak Sayur Bu Sari'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {settings?.ownerName || 'Bu Sari'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full min-h-[42px] flex items-center justify-center gap-2 px-4 py-2 rounded-btn border border-red-200 dark:border-red-900/60 bg-white dark:bg-surface-darkCard text-sm font-semibold text-status-danger dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Keluar</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Sidebar Tetap untuk Desktop & Tablet (>= 768px) */}
      <aside className="hidden md:block fixed top-0 left-0 bottom-0 w-64 z-40 no-print">
        {sidebarContent}
      </aside>

      {/* Drawer Hamburger untuk Layar < 768px */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex bg-black/50 backdrop-blur-[1px] no-print"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Menu Navigasi"
        >
          <div
            className="relative h-full"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
