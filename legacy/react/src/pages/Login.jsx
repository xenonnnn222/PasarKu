import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Store,
  Sparkles,
  Lock,
  Wallet,
  BookCheck,
  TrendingUp
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../hooks/useToast';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';

const FEATURES = [
  {
    icon: Wallet,
    title: 'Catat Uang Masuk & Keluar Cepat',
    desc: 'Rekap penjualan harian dan belanja modal tanpa takut buku catatan hilang atau basah.'
  },
  {
    icon: BookCheck,
    title: 'Kelola Kasbon & Utang Supplier',
    desc: 'Pantau sisa tagihan pelanggan, catat cicilan otomatis, dan kirim pengingat via WhatsApp.'
  },
  {
    icon: TrendingUp,
    title: 'Laporan Untung Bersih Real-Time',
    desc: 'Ketahui laba bersih usaha setiap hari, minggu, dan bulan lengkap dengan grafik dan ekspor Excel.'
  }
];

export default function Login() {
  const navigate = useNavigate();
  const { settings, loginUser } = useApp();
  const { showToast } = useToast();

  const [phone, setPhone] = useState(settings?.phone || '081234567890');
  const [pin, setPin] = useState('1234');
  const [error, setError] = useState('');

  const validateIndonesianPhone = (val) => {
    const cleaned = val.replace(/[\s-]/g, '');
    return /^(\+62|62|0)8[1-9][0-9]{7,10}$/.test(cleaned);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateIndonesianPhone(phone)) {
      setError('Masukkan nomor HP Indonesia yang benar (contoh: 081234567890)');
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setError('PIN keamanan harus terdiri dari 4 angka');
      return;
    }
    loginUser({ phone: phone.trim() });
    showToast(`Selamat datang kembali, ${settings?.ownerName || 'Bu Sari'}!`);
    navigate('/', { replace: true });
  };

  const handleDemoLogin = () => {
    loginUser({
      phone: settings?.phone || '081234567890',
      ownerName: settings?.ownerName || 'Bu Sari',
      businessName: settings?.businessName || 'Lapak Sayur Bu Sari'
    });
    showToast('Masuk sebagai Mode Demo (Lapak Sayur Bu Sari)');
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-surface-light dark:bg-surface-dark animate-page">
      {/* Kolom Kiri: Branding & Nilai Utama (Latar Hijau) */}
      <div className="lg:col-span-6 xl:col-span-7 bg-gradient-to-br from-primary-800 via-primary-700 to-primary-600 text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shadow-sm">
            <Store className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-2xl font-bold tracking-tight block leading-none">
              PasarKu
            </span>
            <span className="text-xs text-primary-100">
              Dashboard Keuangan Pedagang Pasar
            </span>
          </div>
        </div>

        <div className="my-10 lg:my-auto max-w-xl space-y-8">
          <div className="space-y-3">
            <span className="inline-block px-3 py-1 rounded-full bg-white/15 text-xs font-semibold tracking-wide uppercase">
              Solusi Usaha Pasar Tradisional & UMKM
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
              Kelola Uang Masuk, Kasbon, dan Stok Dagangan Lebih Teratur
            </h1>
            <p className="text-primary-100 text-base leading-relaxed">
              Dirancang khusus untuk kemudahan pedagang sayur, sembako, dan grosir pasar dengan tampilan jelas, cepat, dan langsung siap pakai.
            </p>
          </div>

          <div className="space-y-4">
            {FEATURES.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="flex items-start gap-4 p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15"
                >
                  <div className="w-11 h-11 rounded-xl bg-white text-primary-700 flex items-center justify-center shrink-0 font-bold">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      {item.title}
                    </h2>
                    <p className="text-sm text-primary-100 mt-0.5 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-primary-200">
          Mode demo lokal: seluruh data tersimpan aman di perangkat/browser ini.
        </p>
      </div>

      {/* Kolom Kanan: Formulir Login */}
      <div className="lg:col-span-6 xl:col-span-5 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Masuk ke Dashboard
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Masukkan nomor HP dan PIN 4 angka Anda untuk membuka pembukuan usaha.
            </p>
          </div>

          <Card className="p-6 sm:p-8 space-y-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Nomor HP Terdaftar"
                type="tel"
                inputMode="tel"
                placeholder="Contoh: 081234567890"
                value={phone}
                onChange={(e) => {
                  setError('');
                  setPhone(e.target.value);
                }}
              />

              <Input
                label="PIN Keamanan (4 Angka)"
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="Masukkan 4 angka PIN (contoh: 1234)"
                value={pin}
                onChange={(e) => {
                  setError('');
                  setPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                }}
                helperText="Untuk mode demo, gunakan PIN 4 angka apa saja (misal: 1234)"
              />

              {error && (
                <p role="alert" className="text-sm font-medium text-status-danger">
                  {error}
                </p>
              )}

              <Button type="submit" fullWidth size="lg">
                <Lock className="w-5 h-5" />
                <span>Masuk Sekarang</span>
              </Button>
            </form>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-gray-200 dark:border-gray-700" />
              <span className="flex-shrink mx-3 text-xs font-semibold text-gray-400">
                ATAU AKSES CEPAT
              </span>
              <div className="flex-grow border-t border-gray-200 dark:border-gray-700" />
            </div>

            <Button variant="secondary" fullWidth onClick={handleDemoLogin}>
              <Sparkles className="w-5 h-5 text-primary-600" />
              <span>Masuk sebagai Demo (Lapak Sayur Bu Sari)</span>
            </Button>
          </Card>

          <p className="text-center text-sm text-gray-600 dark:text-gray-300">
            Belum memiliki akun usaha?{' '}
            <Link
              to="/daftar"
              className="font-bold text-primary-700 dark:text-primary-400 hover:underline"
            >
              Daftar Usaha Baru
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
