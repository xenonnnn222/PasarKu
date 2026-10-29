import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, BookCheck, TrendingUp, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import Button from '../components/Button';

const SLIDES = [
  {
    icon: Wallet,
    title: 'Catat Uang Masuk & Keluar dengan Cepat',
    description:
      'Tidak perlu buku tulis yang mudah basah atau hilang. Cukup tekan tombol besar, langsung tercatat rapi.'
  },
  {
    icon: BookCheck,
    title: 'Kasbon Pelanggan Tidak Lagi Lupa',
    description:
      'Pantau siapa yang belum bayar, catat cicilan dengan mudah, dan ingatkan sopan lewat WhatsApp.'
  },
  {
    icon: TrendingUp,
    title: 'Lihat Untung Bersih Kapan Saja',
    description:
      'Tahu pasti berapa untung lapak Anda hari ini, minggu ini, hingga bulan ini tanpa pusing hitung manual.'
  }
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const { completeOnboarding } = useApp();

  const handleFinish = () => {
    completeOnboarding();
    navigate('/login', { replace: true });
  };

  const handleNext = () => {
    if (step < SLIDES.length - 1) {
      setStep((s) => s + 1);
    } else {
      handleFinish();
    }
  };

  const current = SLIDES[step];
  const Icon = current.icon;

  return (
    <div className="min-h-screen flex flex-col justify-between p-6 bg-surface-light dark:bg-surface-dark animate-page">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-primary-700 dark:text-primary-400">
          PasarKu
        </span>
        <button
          type="button"
          onClick={handleFinish}
          className="text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 px-3 py-2 rounded-lg"
        >
          Lewati
        </button>
      </div>

      <div className="my-auto flex flex-col items-center text-center px-2 py-8">
        <div className="w-24 h-24 rounded-3xl bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 flex items-center justify-center mb-6 shadow-sm">
          <Icon className="w-12 h-12" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3 leading-snug">
          {current.title}
        </h1>
        <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed">
          {current.description}
        </p>

        {/* Indikator titik */}
        <div className="flex items-center gap-2 mt-8" role="tablist" aria-label="Slide pengenalan">
          {SLIDES.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Slide ${idx + 1}`}
              onClick={() => setStep(idx)}
              className={`h-2.5 rounded-full transition-all ${
                idx === step
                  ? 'w-8 bg-primary-600'
                  : 'w-2.5 bg-gray-300 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Button fullWidth size="lg" onClick={handleNext}>
          <span>{step === SLIDES.length - 1 ? 'Mulai Pakai PasarKu' : 'Lanjut'}</span>
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}

