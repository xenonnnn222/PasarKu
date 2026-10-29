import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  ShoppingBag,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Package,
  Wallet
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from 'recharts';
import { useApp } from '../context/AppContext';
import { formatRupiah, formatCompactRupiah } from '../utils/formatRupiah';
import { formatShortDate } from '../utils/formatDate';
import {
  calculateCashBalance,
  calculateDailySummary,
  calculateProfitComparison,
  getLowStockProducts,
  getDebtStatus,
  getDebtRemaining,
  getLast7DaysProfitData,
  isPriveCategory
} from '../utils/calculations';
import PageContainer from '../components/PageContainer';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
import SectionHeader from '../components/SectionHeader';
import Button from '../components/Button';
import Badge from '../components/Badge';
import DataTable from '../components/DataTable';
import TransactionItem from '../components/TransactionItem';
import EmptyState from '../components/EmptyState';

export default function Home() {
  const navigate = useNavigate();
  const { settings, transactions, products, debts } = useApp();

  const today = useMemo(() => new Date(), []);

  // Perhitungan ringkasan kas & untung hari ini
  const cashBalance = useMemo(
    () => calculateCashBalance(transactions, settings?.startingCash),
    [transactions, settings?.startingCash]
  );

  const todaySummary = useMemo(
    () => calculateDailySummary(transactions, today),
    [transactions, today]
  );

  const profitComparison = useMemo(
    () => calculateProfitComparison(transactions, today),
    [transactions, today]
  );

  // Perlu perhatian: stok menipis & kasbon jatuh tempo/terlambat
  const lowStockItems = useMemo(
    () => getLowStockProducts(products),
    [products]
  );

  const urgentDebts = useMemo(() => {
    return debts.filter((d) => {
      const status = getDebtStatus(d, today);
      if (status === 'Lunas') return false;
      if (status === 'Terlambat') return true;
      const diffMs = new Date(d.dueDate).getTime() - today.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return diffDays <= 2;
    });
  }, [debts, today]);

  // Grafik 7 hari terakhir
  const chart7Days = useMemo(
    () => getLast7DaysProfitData(transactions, today),
    [transactions, today]
  );

  // 6 Transaksi terakhir
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6);
  }, [transactions]);

  const recentColumns = [
    {
      key: 'date',
      header: 'Tanggal',
      sortable: true,
      sortValue: (row) => new Date(row.date).getTime(),
      render: (row) => (
        <span className="text-gray-600 dark:text-gray-300 whitespace-nowrap">
          {formatShortDate(row.date)}
        </span>
      )
    },
    {
      key: 'note',
      header: 'Keterangan',
      sortable: true,
      render: (row) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {row.note || (row.type === 'in' ? 'Uang masuk' : 'Uang keluar')}
        </span>
      )
    },
    {
      key: 'category',
      header: 'Kategori',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Badge variant={row.type === 'in' ? 'success' : isPriveCategory(row.category) ? 'info' : 'neutral'}>
            {row.category}
          </Badge>
        </div>
      )
    },
    {
      key: 'amount',
      header: 'Nominal',
      align: 'right',
      sortable: true,
      sortValue: (row) => (row.type === 'in' ? row.amount : -row.amount),
      render: (row) => (
        <span
          className={`font-bold tabular-nums whitespace-nowrap ${
            row.type === 'in'
              ? 'text-primary-700 dark:text-primary-400'
              : 'text-status-danger dark:text-red-400'
          }`}
        >
          {row.type === 'in' ? '+' : '-'}
          {formatRupiah(row.amount)}
        </span>
      )
    }
  ];

  return (
    <PageContainer
      title={`Halo, ${settings?.ownerName || 'Bu Sari'} 👋`}
      subtitle={`Ringkasan Keuangan ${settings?.businessName || 'Lapak Sayur Bu Sari'}`}
    >
      <div className="space-y-6">
        {/* BARIS ATAS: GRID 12 KOLOM (4 Kartu Ringkasan Sejajar) */}
        <div className="grid grid-cols-12 gap-4 lg:gap-6">
          {/* 1. Kartu Saldo Kas (Gradasi Hijau) */}
          <div className="col-span-12 sm:col-span-6 xl:col-span-3 rounded-card p-5 bg-gradient-to-br from-primary-700 to-primary-600 text-white shadow-md flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-primary-100">
                Saldo Kas di Hand
              </span>
              <span className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
              </span>
            </div>
            <div className="text-[28px] lg:text-[30px] font-bold tabular-nums leading-tight my-2">
              {formatRupiah(cashBalance)}
            </div>
            <p className="text-xs text-primary-100">
              Modal awal {formatRupiah(settings?.startingCash || 0)} + seluruh kas
            </p>
          </div>

          {/* 2. Kartu Untung Hari Ini */}
          <Card className="col-span-12 sm:col-span-6 xl:col-span-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Untung Hari Ini
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  profitComparison.isUp
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                    : 'bg-red-50 text-status-danger dark:bg-red-950/50 dark:text-red-400'
                }`}
              >
                {profitComparison.isUp ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                <span>
                  {profitComparison.isUp ? '+' : ''}
                  {profitComparison.percentage}%
                </span>
              </span>
            </div>
            <div
              className={`text-2xl lg:text-[28px] font-bold tabular-nums my-2 ${
                todaySummary.profit >= 0
                  ? 'text-primary-700 dark:text-primary-400'
                  : 'text-status-danger dark:text-red-400'
              }`}
            >
              {formatRupiah(todaySummary.profit)}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Dibanding kemarin ({formatRupiah(profitComparison.yesterdayProfit)})
            </p>
          </Card>

          {/* 3. Kartu Uang Masuk Hari Ini */}
          <StatCard
            className="col-span-12 sm:col-span-6 xl:col-span-3"
            label="Uang Masuk Hari Ini"
            value={formatRupiah(todaySummary.totalIn)}
            subtext="Penjualan tunai & cicilan kasbon"
            icon={ArrowDownLeft}
            variant="income"
          />

          {/* 4. Kartu Uang Keluar Hari Ini */}
          <StatCard
            className="col-span-12 sm:col-span-6 xl:col-span-3"
            label="Uang Keluar Hari Ini"
            value={formatRupiah(todaySummary.totalOut)}
            subtext={
              todaySummary.priveOut > 0
                ? `Termasuk pribadi ${formatRupiah(todaySummary.priveOut)}`
                : 'Belanja modal & operasional'
            }
            icon={ArrowUpRight}
            variant="expense"
          />
        </div>

        {/* BARIS BAWAH: GRID 12 KOLOM (Kiri: Grafik + Transaksi Terakhir, Kanan: Tombol Cepat + Perlu Perhatian) */}
        <div className="grid grid-cols-12 gap-6 items-start">
          {/* Kolom Kiri (8 Kolom di Desktop) */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            {/* Grafik Untung 7 Hari Terakhir */}
            <Card>
              <SectionHeader
                title="Grafik Untung 7 Hari Terakhir"
                subtitle="Perkembangan untung bersih harian usaha Anda"
                actionLabel="Buka Laporan Lengkap"
                onAction={() => navigate('/laporan')}
              />
              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chart7Days}
                    margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: '#6B7280' }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={formatCompactRupiah}
                      tick={{ fontSize: 12, fill: '#6B7280' }}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(22, 163, 74, 0.08)' }}
                      formatter={(value) => [formatRupiah(value), 'Untung Bersih']}
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.fullDate || ''
                      }
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #E5E7EB',
                        fontSize: '13px'
                      }}
                    />
                    <Bar dataKey="untung" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      {chart7Days.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.untung >= 0 ? '#16A34A' : '#DC2626'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Tabel Transaksi Terakhir */}
            <Card>
              <SectionHeader
                title="Transaksi Terakhir"
                subtitle="Klik kolom untuk mengurutkan atau lihat seluruh riwayat"
                actionLabel="Lihat Semua Riwayat"
                onAction={() => navigate('/riwayat')}
              />
              <DataTable
                columns={recentColumns}
                data={recentTransactions}
                defaultSortKey="date"
                defaultSortDir="desc"
                renderMobileCard={(tx) => (
                  <div className="border-b border-gray-100 dark:border-gray-800 last:border-none">
                    <TransactionItem
                      transaction={tx}
                      onClick={() => navigate('/riwayat')}
                    />
                  </div>
                )}
                emptyContent={
                  <EmptyState
                    title="Belum ada catatan transaksi"
                    description="Gunakan tombol Catat Jual atau Belanja untuk mulai mencatat hari ini."
                    actionLabel="Catat Sekarang"
                    onAction={() => navigate('/catat')}
                  />
                }
              />
            </Card>
          </div>

          {/* Kolom Kanan (4 Kolom di Desktop) */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* Kartu Aksi Cepat */}
            <Card className="space-y-3">
              <SectionHeader
                title="Aksi Cepat"
                subtitle="Catat transaksi baru dengan sekali klik"
              />
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/catat?type=in')}
                >
                  <Plus className="w-5 h-5" />
                  <span>Jual</span>
                </Button>
                <Button
                  variant="outlineDanger"
                  size="lg"
                  onClick={() => navigate('/catat?type=out')}
                >
                  <ShoppingBag className="w-5 h-5" />
                  <span>Belanja</span>
                </Button>
              </div>
            </Card>

            {/* Kartu Perlu Perhatian */}
            <Card>
              <SectionHeader
                title="Perlu Perhatian"
                subtitle="Stok menipis & kasbon jatuh tempo"
              />
              {lowStockItems.length === 0 && urgentDebts.length === 0 ? (
                <div className="flex items-center gap-3 p-4 rounded-btn bg-primary-50 dark:bg-primary-900/20 text-primary-800 dark:text-primary-200">
                  <CheckCircle2 className="w-5 h-5 text-primary-600 shrink-0" />
                  <span className="text-sm font-medium">
                    Semua aman! Stok barang cukup dan tidak ada kasbon terlambat.
                  </span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {lowStockItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate('/stok')}
                      className="w-full flex items-center justify-between gap-3 p-3 rounded-btn bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50 text-left hover:bg-amber-100/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Package className="w-5 h-5 text-status-warning shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                            Stok {item.name} menipis
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Sisa {item.stock} {item.unit} (min. {item.minStock}{' '}
                            {item.unit})
                          </p>
                        </div>
                      </div>
                      <Badge variant={item.stock <= 0 ? 'danger' : 'warning'}>
                        {item.stock <= 0 ? 'Habis' : 'Menipis'}
                      </Badge>
                    </button>
                  ))}

                  {urgentDebts.map((debt) => {
                    const status = getDebtStatus(debt, today);
                    const remaining = getDebtRemaining(debt);
                    return (
                      <button
                        key={debt.id}
                        type="button"
                        onClick={() => navigate('/kasbon')}
                        className="w-full flex items-center justify-between gap-3 p-3 rounded-btn bg-red-50/70 dark:bg-red-950/30 border border-red-200/70 dark:border-red-800/50 text-left hover:bg-red-100/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {status === 'Terlambat' ? (
                            <AlertTriangle className="w-5 h-5 text-status-danger shrink-0" />
                          ) : (
                            <Clock className="w-5 h-5 text-status-warning shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {debt.type === 'piutang' ? 'Kasbon' : 'Utang'}:{' '}
                              {debt.party}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 tabular-nums">
                              Sisa {formatRupiah(remaining)} • Tempo{' '}
                              {formatShortDate(debt.dueDate)}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={status === 'Terlambat' ? 'danger' : 'warning'}
                        >
                          {status}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
