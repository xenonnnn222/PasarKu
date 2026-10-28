import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ShoppingBag,
  HandCoins,
  PlusCircle,
  PackagePlus,
  Truck,
  Store,
  Zap,
  Users,
  User,
  Receipt,
  MoreHorizontal,
  CheckCircle2,
  Save
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../hooks/useToast';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../utils/constants';
import { formatRupiah } from '../utils/formatRupiah';
import { toLocalDateInputValue, isSameLocalDay } from '../utils/formatDate';
import { calculateDailySummary } from '../utils/calculations';
import PageContainer from '../components/PageContainer';
import Card from '../components/Card';
import SectionHeader from '../components/SectionHeader';
import SegmentedControl from '../components/SegmentedControl';
import Chip from '../components/Chip';
import Input from '../components/Input';
import Button from '../components/Button';
import TransactionItem from '../components/TransactionItem';
import EmptyState from '../components/EmptyState';

const ICON_MAP = {
  ShoppingBag,
  HandCoins,
  PlusCircle,
  PackagePlus,
  Truck,
  Store,
  Zap,
  Users,
  User,
  Receipt,
  MoreHorizontal
};

const QUICK_NOMINALS = [10000, 25000, 50000, 100000, 250000];

export default function Record() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { transactions, addTransaction, addDebt, debts } = useApp();
  const { showToast } = useToast();

  const initialType = searchParams.get('type') === 'out' ? 'out' : 'in';

  const [type, setType] = useState(initialType);
  const [amountStr, setAmountStr] = useState('');
  const [category, setCategory] = useState(
    initialType === 'out' ? 'Belanja modal' : 'Penjualan'
  );
  const [note, setNote] = useState('');
  const [dateValue, setDateValue] = useState(() =>
    toLocalDateInputValue(new Date())
  );

  // Toggle Kasbon (Belum dibayar) khusus Uang Masuk
  const [isUnpaidKasbon, setIsUnpaidKasbon] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [dueDateValue, setDueDateValue] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return toLocalDateInputValue(d);
  });

  const [error, setError] = useState('');

  useEffect(() => {
    if (type === 'in') {
      setCategory('Penjualan');
    } else {
      setCategory('Belanja modal');
      setIsUnpaidKasbon(false);
    }
    setError('');
  }, [type]);

  // Saran nama pelanggan dari data kasbon
  const existingCustomerNames = useMemo(() => {
    const names = debts
      .filter((d) => d.type === 'piutang')
      .map((d) => d.party);
    return Array.from(new Set(names)).slice(0, 5);
  }, [debts]);

  // Ringkasan & daftar transaksi hari ini untuk kolom kanan
  const todayTransactions = useMemo(() => {
    const now = new Date();
    return transactions
      .filter((tx) => isSameLocalDay(tx.date, now))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions]);

  const todaySummary = useMemo(
    () => calculateDailySummary(transactions, new Date()),
    [transactions]
  );

  const numericAmount = Math.round(Number(amountStr) || 0);
  const categories = type === 'in' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleAddQuickNominal = (addVal) => {
    setError('');
    const next = Math.min(100000000, numericAmount + addVal);
    setAmountStr(String(next));
  };

  const handleSave = (e) => {
    e.preventDefault();
    setError('');

    if (numericAmount <= 0) {
      setError('Masukkan nominal lebih dari Rp 0');
      return;
    }
    if (numericAmount > 100000000) {
      setError('Nominal maksimal Rp 100.000.000 per transaksi');
      return;
    }

    const selectedDateIso = dateValue
      ? new Date(
          `${dateValue}T${new Date().toTimeString().slice(0, 8)}`
        ).toISOString()
      : new Date().toISOString();

    if (type === 'in' && isUnpaidKasbon) {
      if (!customerName.trim()) {
        setError('Masukkan nama pelanggan yang kasbon');
        return;
      }
      const dueIso = dueDateValue
        ? new Date(`${dueDateValue}T12:00:00`).toISOString()
        : new Date().toISOString();

      addDebt({
        type: 'piutang',
        party: customerName.trim(),
        phone: customerPhone.trim(),
        total: numericAmount,
        paid: 0,
        dueDate: dueIso,
        note: note.trim() || `Kasbon ${category}`,
        createdAt: selectedDateIso
      });
      showToast(
        `Kasbon ${customerName.trim()} sebesar ${formatRupiah(
          numericAmount
        )} berhasil dicatat!`
      );
    } else {
      addTransaction({
        type,
        amount: numericAmount,
        category,
        note: note.trim(),
        date: selectedDateIso
      });
      showToast(
        `${type === 'in' ? 'Uang masuk' : 'Uang keluar'} ${formatRupiah(
          numericAmount
        )} berhasil disimpan!`
      );
    }

    setAmountStr('');
    setNote('');
    setCustomerName('');
    setCustomerPhone('');
    setIsUnpaidKasbon(false);
  };

  return (
    <PageContainer
      title="Catat Transaksi"
      subtitle="Rekap cepat pemasukan penjualan, belanja modal, dan kasbon"
    >
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* KOLOM KIRI (7 Kolom): Formulir Pencatatan */}
        <Card className="col-span-12 lg:col-span-7 p-6 space-y-6">
          <SegmentedControl
            value={type}
            onChange={setType}
            options={[
              {
                value: 'in',
                label: 'Uang Masuk (Penjualan)',
                activeClass: 'bg-primary-600 text-white shadow-sm'
              },
              {
                value: 'out',
                label: 'Uang Keluar (Belanja/Biaya)',
                activeClass: 'bg-status-danger text-white shadow-sm'
              }
            ]}
          />

          <form onSubmit={handleSave} className="space-y-5">
            {/* Input Teks Terformat Rupiah */}
            <div className="space-y-2.5">
              <Input
                label={
                  type === 'in'
                    ? isUnpaidKasbon
                      ? 'Nominal Piutang / Kasbon Pelanggan (Rp)'
                      : 'Nominal Uang Masuk (Rp)'
                    : 'Nominal Uang Keluar (Rp)'
                }
                type="text"
                inputMode="numeric"
                prefix="Rp"
                formatCurrency
                placeholder="Ketik nominal, contoh: 150.000"
                value={amountStr}
                onChange={(e) => {
                  setError('');
                  setAmountStr(e.target.value);
                }}
              />

              {/* Tombol Tambah Nominal Cepat */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500">Tambah cepat:</span>
                {QUICK_NOMINALS.map((nom) => (
                  <button
                    key={nom}
                    type="button"
                    onClick={() => handleAddQuickNominal(nom)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:border-primary-300 text-xs font-semibold text-gray-700 dark:text-gray-200 tabular-nums transition-colors"
                  >
                    +{formatRupiah(nom, false)}
                  </button>
                ))}
                {numericAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmountStr('')}
                    className="px-2.5 py-1.5 text-xs font-semibold text-status-danger hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Pilihan Kategori */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Kategori Transaksi
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const IconComp = ICON_MAP[cat.icon];
                  return (
                    <Chip
                      key={cat.id}
                      label={cat.label}
                      icon={IconComp}
                      selected={category === cat.id}
                      variant={type === 'out' ? 'danger' : 'primary'}
                      onClick={() => setCategory(cat.id)}
                    />
                  );
                })}
              </div>
              {category === 'Pribadi (prive)' && (
                <p className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 p-3 rounded-lg">
                  Info: Pengeluaran <strong>Pribadi (prive)</strong> mengurangi Saldo Kas, tetapi tidak mengurangi perhitungan Untung Usaha Anda.
                </p>
              )}
            </div>

            {/* Toggle Kasbon (Belum dibayar) untuk Uang Masuk */}
            {type === 'in' && (
              <div className="p-4 rounded-btn border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      Tandai Belum Dibayar (Kasbon Pelanggan)
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Otomatis masuk ke daftar piutang pelanggan dan belum menambah kas tunai
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isUnpaidKasbon}
                    onClick={() => setIsUnpaidKasbon((v) => !v)}
                    className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                      isUnpaidKasbon
                        ? 'bg-primary-600 justify-end'
                        : 'bg-gray-300 dark:bg-gray-700 justify-start'
                    }`}
                  >
                    <span className="w-6 h-6 rounded-full bg-white shadow-md" />
                  </button>
                </div>

                {isUnpaidKasbon && (
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2 space-y-2">
                      <Input
                        label="Nama Pelanggan"
                        placeholder="Contoh: Warung Makan Bu Tejo"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                      />
                      {existingCustomerNames.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-gray-500">
                            Pilih cepat:
                          </span>
                          {existingCustomerNames.map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => setCustomerName(name)}
                              className="text-xs px-2.5 py-1 rounded-full bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-medium hover:bg-primary-100"
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Input
                      label="Nomor WhatsApp (Opsional)"
                      type="tel"
                      inputMode="tel"
                      placeholder="Contoh: 08123456789"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                    <Input
                      label="Tanggal Jatuh Tempo"
                      type="date"
                      value={dueDateValue}
                      onChange={(e) => setDueDateValue(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Catatan & Tanggal */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <Input
                  label="Catatan / Keterangan (Opsional)"
                  placeholder={
                    type === 'in'
                      ? 'Contoh: Jual bawang merah 3kg & cabai'
                      : 'Contoh: Kulakan sayur daun & tomat'
                  }
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              <div>
                <Input
                  label="Tanggal Transaksi"
                  type="date"
                  value={dateValue}
                  onChange={(e) => setDateValue(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="text-sm font-semibold text-status-danger"
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant={type === 'out' ? 'danger' : 'primary'}
              size="lg"
              fullWidth
              disabled={numericAmount <= 0}
            >
              <Save className="w-5 h-5" />
              <span>
                {isUnpaidKasbon
                  ? `Simpan Kasbon ${
                      numericAmount > 0 ? formatRupiah(numericAmount) : ''
                    }`
                  : `Simpan ${
                      type === 'in' ? 'Uang Masuk' : 'Uang Keluar'
                    } ${numericAmount > 0 ? formatRupiah(numericAmount) : ''}`}
              </span>
            </Button>
          </form>
        </Card>

        {/* KOLOM KANAN (5 Kolom): Ringkasan & Transaksi Hari Ini */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          <Card className="space-y-4">
            <SectionHeader
              title="Ringkasan Hari Ini"
              subtitle="Perhitungan langsung transaksi hari ini"
            />
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-btn bg-primary-50/70 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/40">
                <span className="text-xs text-gray-500 dark:text-gray-400 block">
                  Masuk
                </span>
                <span className="text-sm font-bold text-primary-700 dark:text-primary-400 tabular-nums">
                  {formatRupiah(todaySummary.totalIn)}
                </span>
              </div>
              <div className="p-3 rounded-btn bg-red-50/70 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40">
                <span className="text-xs text-gray-500 dark:text-gray-400 block">
                  Keluar
                </span>
                <span className="text-sm font-bold text-status-danger dark:text-red-400 tabular-nums">
                  {formatRupiah(todaySummary.totalOut)}
                </span>
              </div>
              <div className="p-3 rounded-btn bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-500 dark:text-gray-400 block">
                  Untung
                </span>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                  {formatRupiah(todaySummary.profit)}
                </span>
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeader
              title={`Catatan Hari Ini (${todayTransactions.length})`}
              subtitle="Transaksi yang baru saja Anda masukkan hari ini"
              actionLabel="Semua Riwayat"
              onAction={() => navigate('/riwayat')}
            />
            {todayTransactions.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Belum ada transaksi hari ini"
                description="Transaksi yang Anda simpan di sebelah kiri akan langsung tampil di sini."
              />
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {todayTransactions.slice(0, 8).map((tx) => (
                  <TransactionItem
                    key={tx.id}
                    transaction={tx}
                    showDate={false}
                    onClick={() => navigate('/riwayat')}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
