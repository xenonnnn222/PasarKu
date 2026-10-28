import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Store, UserCheck, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../hooks/useToast';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';

export default function Register() {
  const navigate = useNavigate();
  const { updateSettings, loginUser } = useApp();
  const { showToast } = useToast();

  const [ownerName, setOwnerName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [startingCash, setStartingCash] = useState('500000');
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErr = {};
    if (!ownerName.trim()) newErr.ownerName = 'Nama panggilan wajib diisi';
    if (!businessName.trim()) newErr.businessName = 'Nama lapak/usaha wajib diisi';
    const cleanPhone = phone.replace(/[\s-]/g, '');
    if (!/^(\+62|62|0)8[1-9][0-9]{7,10}$/.test(cleanPhone)) {
      newErr.phone = 'Nomor HP tidak valid (gunakan awalan 08xx / +62)';
    }
    if (!/^\d{4}$/.test(pin)) {
      newErr.pin = 'PIN harus terdiri dari 4 angka';
    }
    setErrors(newErr);
    return Object.keys(newErr).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    updateSettings({
      ownerName: ownerName.trim(),
      businessName: businessName.trim(),
      phone: phone.trim(),
      pin,
      startingCash: Math.max(0, Math.round(Number(startingCash) || 0)),
      onboarded: true,
      loggedIn: true
    });
    loginUser({
      ownerName: ownerName.trim(),
      businessName: businessName.trim(),
      phone: phone.trim()
    });
    showToast(`Selamat bergabung, ${ownerName.trim()}!`);
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-surface-light dark:bg-surface-dark animate-page">
      {/* Kolom Kiri: Slogan Hijau */}
      <div className="lg:col-span-6 xl:col-span-7 bg-gradient-to-br from-primary-800 via-primary-700 to-primary-600 text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
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

        <div className="my-10 lg:my-auto max-w-xl space-y-6">
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
            Mulai Pembukuan Digital Usaha Pasar Anda dalam 1 Menit
          </h1>
          <p className="text-primary-100 text-base leading-relaxed">
            Cukup isi nama usaha dan modal kas awal yang Anda pegang hari ini. Seluruh fitur pencatatan transaksi, kasbon, stok, dan laporan langsung siap digunakan.
          </p>
          <ul className="space-y-3 pt-2">
            {[
              'Gratis & berjalan cepat langsung di browser komputer/HP',
              'Otomatis memisahkan uang pribadi (prive) dari untung usaha',
              'Dilengkapi kalkulator harga jual (Margin & Markup) serta ekspor Excel'
            ].map((item, idx) => (
              <li key={idx} className="flex items-center gap-3 text-sm sm:text-base text-primary-50">
                <CheckCircle2 className="w-5 h-5 text-primary-200 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-primary-200">
          Mode demo: data tersimpan di browser perangkat ini.
        </p>
      </div>

      {/* Kolom Kanan: Form Pendaftaran */}
      <div className="lg:col-span-6 xl:col-span-5 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Daftar Usaha Baru
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Lengkapi profil singkat lapak/toko Anda di bawah ini.
            </p>
          </div>

          <Card className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Nama Panggilan Pemilik"
                placeholder="Contoh: Bu Sari / Pak Budi"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                error={errors.ownerName}
              />
              <Input
                label="Nama Usaha / Lapak"
                placeholder="Contoh: Lapak Sayur Berkah"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                error={errors.businessName}
              />
              <Input
                label="Nomor HP (WhatsApp)"
                type="tel"
                inputMode="tel"
                placeholder="Contoh: 081234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                error={errors.phone}
              />
              <Input
                label="Modal Kas Awal di Tangan"
                type="text"
                inputMode="numeric"
                prefix="Rp"
                formatCurrency
                value={startingCash}
                onChange={(e) => setStartingCash(e.target.value)}
                helperText="Uang tunai modal usaha yang Anda pegang saat ini"
              />
              <Input
                label="Buat PIN 4 Angka"
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="Contoh: 1234"
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                }
                error={errors.pin}
              />

              <Button type="submit" fullWidth size="lg">
                <UserCheck className="w-5 h-5" />
                <span>Simpan & Buka Dashboard</span>
              </Button>
            </form>
          </Card>

          <p className="text-center text-sm text-gray-600 dark:text-gray-300">
            Sudah punya akun?{' '}
            <Link
              to="/login"
              className="font-bold text-primary-700 dark:text-primary-400 hover:underline"
            >
              Masuk di sini
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
