import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Plus, BookOpen, Package, BarChart3 } from 'lucide-react';

/**
 * Navigasi Bawah Tetap khusus layar HP (< 768px, md:hidden)
 */
export default function BottomNav() {
  const navItems = [
    { to: '/', label: 'Beranda', icon: Home, end: true },
    { to: '/kasbon', label: 'Kasbon', icon: BookOpen },
    { to: '/catat', label: 'Catat', icon: Plus, isCenter: true },
    { to: '/stok', label: 'Stok', icon: Package },
    { to: '/laporan', label: 'Laporan', icon: BarChart3 }
  ];

  return (
    <nav
      aria-label="Navigasi Bawah HP"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 w-full bg-white dark:bg-surface-darkCard border-t border-gray-200 dark:border-gray-800 shadow-nav px-2 pb-1 pt-1 no-print"
    >
      <ul className="grid grid-cols-5 items-end">
        {navItems.map((item) => {
          const Icon = item.icon;

          if (item.isCenter) {
            return (
              <li key={item.to} className="flex justify-center">
                <NavLink
                  to={item.to}
                  aria-label="Catat Transaksi Baru"
                  className="flex flex-col items-center justify-center -mt-5 group focus:outline-none"
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-transform group-active:scale-95 ${
                          isActive
                            ? 'bg-primary-700 ring-4 ring-primary-100 dark:ring-primary-900/60'
                            : 'bg-primary-600 hover:bg-primary-700'
                        }`}
                      >
                        <Icon className="w-7 h-7 stroke-[2.5]" />
                      </span>
                      <span
                        className={`text-xs mt-1 font-semibold ${
                          isActive
                            ? 'text-primary-700 dark:text-primary-400'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {item.label}
                      </span>
                    </>
                  )}
                </NavLink>
              </li>
            );
          }

          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `relative flex flex-col items-center justify-center min-h-[54px] py-1.5 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                    isActive
                      ? 'text-primary-700 dark:text-primary-400 font-semibold'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute top-0 w-8 h-1 rounded-b-full bg-primary-600 dark:bg-primary-400" />
                    )}
                    <Icon className="w-5 h-5" />
                    <span className="text-xs mt-1">{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
