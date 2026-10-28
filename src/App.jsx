import React, { Suspense, lazy, useState, useMemo } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { ToastProvider } from './components/Toast';
import Sidebar from './components/Sidebar';
import { LayoutContext } from './components/PageContainer';
import Onboarding from './pages/Onboarding';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Record from './pages/Record';
import History from './pages/History';
import Debts from './pages/Debts';
import Stock from './pages/Stock';
import Settings from './pages/Settings';

// Lazy load halaman Laporan agar bundel awal tetap ringan
const Reports = lazy(() => import('./pages/Reports'));

function ProtectedLayout({ children }) {
  const { settings } = useApp();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const layoutValue = useMemo(
    () => ({
      openMobileMenu: () => setMobileMenuOpen(true),
      closeMobileMenu: () => setMobileMenuOpen(false)
    }),
    []
  );

  if (!settings?.loggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <LayoutContext.Provider value={layoutValue}>
      <div className="min-h-screen bg-surface-light dark:bg-surface-dark text-[#111827] dark:text-[#F3F4F6]">
        <Sidebar
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />
        <div className="md:pl-64 min-h-screen flex flex-col">
          {children}
        </div>
      </div>
    </LayoutContext.Provider>
  );
}

function AppRoutes() {
  const { settings } = useApp();

  return (
    <Routes>
      <Route
        path="/onboarding"
        element={
          settings?.loggedIn ? <Navigate to="/" replace /> : <Onboarding />
        }
      />
      <Route
        path="/login"
        element={settings?.loggedIn ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/daftar"
        element={settings?.loggedIn ? <Navigate to="/" replace /> : <Register />}
      />
      <Route
        path="/"
        element={
          <ProtectedLayout>
            <Home />
          </ProtectedLayout>
        }
      />
      <Route
        path="/catat"
        element={
          <ProtectedLayout>
            <Record />
          </ProtectedLayout>
        }
      />
      <Route
        path="/riwayat"
        element={
          <ProtectedLayout>
            <History />
          </ProtectedLayout>
        }
      />
      <Route
        path="/kasbon"
        element={
          <ProtectedLayout>
            <Debts />
          </ProtectedLayout>
        }
      />
      <Route
        path="/stok"
        element={
          <ProtectedLayout>
            <Stock />
          </ProtectedLayout>
        }
      />
      <Route
        path="/laporan"
        element={
          <ProtectedLayout>
            <Suspense
              fallback={
                <div className="max-w-[1280px] mx-auto p-8 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <div className="h-28 rounded-card bg-gray-200 dark:bg-gray-800 animate-pulse" />
                    <div className="h-28 rounded-card bg-gray-200 dark:bg-gray-800 animate-pulse" />
                    <div className="h-28 rounded-card bg-gray-200 dark:bg-gray-800 animate-pulse" />
                    <div className="h-28 rounded-card bg-gray-200 dark:bg-gray-800 animate-pulse" />
                  </div>
                  <div className="h-80 rounded-card bg-gray-200 dark:bg-gray-800 animate-pulse" />
                </div>
              }
            >
              <Reports />
            </Suspense>
          </ProtectedLayout>
        }
      />
      <Route
        path="/pengaturan"
        element={
          <ProtectedLayout>
            <Settings />
          </ProtectedLayout>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AppProvider>
    </HashRouter>
  );
}
