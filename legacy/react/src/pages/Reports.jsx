import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  Award,
  AlertOctagon,
  BookOpen,
  ArrowDownLeft
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useApp } from '../context/AppContext';
import { useToast } from '../hooks/useToast';
import { formatRupiah, formatCompactRupiah } from '../utils/formatRupiah';
import { calculateReportMetrics } from '../utils/calculations';
import { exportTransactionsToCsv } from '../utils/exportCsv';
import PageContainer from '../components/PageContainer';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
import SectionHeader from '../components/SectionHeader';
import SegmentedControl from '../components/SegmentedControl';
import ProgressBar from '../components/ProgressBar';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';

const DONUT_COLORS = [
  '#DC2626',
  '#D97706',
  '#2563EB',
  '#16A34A',
  '#7C3AED',
  '#0891B2',
  '#4B5563'
];

export default function Reports() {
  const { transactions, wasteLogs, products, debts, settings } = useApp();
  const { showToast } = useToast();

  const [period, setPeriod] = useState('week');
  const [offset, setOffset] = useState(0);

  const report = useMemo(
    () =>
      calculateReportMetrics({
        transactions,
        wasteLogs,
        products,
        debts,
        period,
        offset,
        refDate: new Date()
      }),
    [transactions, wasteLogs, products, debts, period, offset]
  );

  const handleExportCsv = () => {
    if (report.periodTransactions.length === 0) {
      showToast('Belum ada transaksi pada periode ini untuk diekspor', 'info');
      return;
    }
    exportTransactionsToCsv(report.periodTransactions, report.periodLabel);
    showToast('File CSV berhasil diunduh (siap dibuka di Excel)');
  };

  return (
    <PageContainer
      title="Laporan Keuangan"
      subtitle="Analisis untung bersih, arus kas masuk-keluar, dan rincian pengeluaran"
      className="print-container"
      rightAction={
        <div className="hidden sm:flex items-center gap-2 no-print">
          <Button size="sm" variant="secondary" onClick={handleExportCsv}>
            <Download className="w-4 h-4 text-primary-600" />
            <span>Ekspor CSV</span>
          </Button>
          <Button size="sm" variant="secondary" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            <span>Cetak</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Header khusus saat dicetak */}
        <div className="hidden print:block mb-4 border-b pb-3">
          <h1 className="text-2xl font-bold">{settings?.businessName}</h1>
          <p className="text-sm text-gray-600">
            Pemilik: {settings?.ownerName} • Periode: {report.periodLabel}
          </p>
        </div>

        {/* Bar Kontrol Periode */}
        <Card className="p-4 no-print">
          <div className="grid grid-cols-12 gap-4 items-center">
            <div className="col-span-12 md:col-span-5">
              <SegmentedControl
                value={period}
                onChange={(val) => {
                  setPeriod(val);
                  setOffset(0);
                }}
                options={[
                  { value: 'day', label: 'Harian' },
                  { value: 'week', label: 'Mingguan' },
                  { value: 'month', label: 'Bulanan' }
                ]}
              />
            </div>

            <div className="col-span-12 md:col-span-7 flex items-center justify-between bg-gray-50 dark:bg-surface-dark rounded-btn px-3 py-1.5 border border-gray-200 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setOffset((o) => o - 1)}
                aria-label="Periode sebelumnya"
                className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-200/70 dark:hover:bg-gray-800"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="text-center">
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100 block">
                  Periode: {report.periodLabel}
                </span>
                {offset !== 0 && (
                  <button
                    type="button"
                    onClick={() => setOffset(0)}
                    className="text-xs text-primary-700 dark:text-primary-400 font-semibold underline"
                  >
                    Kembali ke periode saat ini
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOffset((o) => Math.min(0, o + 1))}
                disabled={offset >= 0}
                aria-label="Periode berikutnya"
                className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-200/70 dark:hover:bg-gray-800 disabled:opacity-30"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </Card>

        {/* BARIS ATAS: GRID 4 KOLOM RINGKASAN */}
        <div className="grid grid-cols-12 gap-4 lg:gap-6">
          <div className="col-span-12 sm:col-span-6 xl:col-span-3 print-card rounded-card p-5 bg-gradient-to-br from-primary-700 to-primary-600 text-white shadow-md flex flex-col justify-between">
            <span className="text-sm font-medium text-primary-100">
              Untung Bersih Usaha
            </span>
            <div className="text-[28px] font-bold tabular-nums my-2">
              {formatRupiah(report.netProfit)}
            </div>
            <p className="text-xs text-primary-50 leading-relaxed">
              Dari <strong>{formatRupiah(report.totalIn)}</strong> masuk dikurangi{' '}
              <strong>{formatRupiah(report.businessOut)}</strong> belanja usaha.
            </p>
          </div>

          <StatCard
            className="col-span-12 sm:col-span-6 xl:col-span-3 print-card"
            label="Total Uang Masuk"
            value={formatRupiah(report.totalIn)}
            subtext={`Pengeluaran usaha: ${formatRupiah(report.businessOut)}`}
            icon={ArrowDownLeft}
            variant="income"
          />

          <StatCard
            className="col-span-12 sm:col-span-6 xl:col-span-3 print-card"
            label="Kerugian Barang Susut"
            value={formatRupiah(report.totalWasteLoss)}
            subtext={`${report.totalWasteItems} catatan susut • Prive: ${formatRupiah(
              report.priveOut
            )}`}
            icon={AlertOctagon}
            variant="expense"
          />

          <StatCard
            className="col-span-12 sm:col-span-6 xl:col-span-3 print-card"
            label="Kasbon Belum Tertagih"
            value={formatRupiah(report.uncollectedPiutang)}
            subtext={
              report.bestDay
                ? `Hari terbaik: ${report.bestDay.fullDate}`
                : `Terbanyak: ${report.mostFrequentCategory}`
            }
            icon={ report.bestDay ? Award : BookOpen }
            variant="info"
          />
        </div>

        {/* BARIS GRAFIK & RINCIAN KATEGORI BERDAMPINGAN (Grid 12 Kolom) */}
        <div className="grid grid-cols-12 gap-6 items-start">
          {/* Grafik Batang Lebar (7 Kolom) */}
          <Card className="col-span-12 lg:col-span-7 print-card p-5">
            <SectionHeader
              title="Grafik Uang Masuk vs Uang Keluar"
              subtitle={`Perbandingan pemasukan (hijau) dan belanja usaha (merah) • ${report.periodLabel}`}
            />
            <div className="h-80 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={report.chartData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#6B7280' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={formatCompactRupiah}
                    tick={{ fontSize: 11, fill: '#6B7280' }}
                  />
                  <Tooltip
                    formatter={(val, name) => [
                      formatRupiah(val),
                      name === 'masuk' ? 'Uang Masuk' : 'Uang Keluar'
                    ]}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.fullDate || ''
                    }
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #E5E7EB',
                      fontSize: '13px'
                    }}
                  />
                  <Legend
                    formatter={(value) =>
                      value === 'masuk' ? 'Uang Masuk' : 'Uang Keluar'
                    }
                  />
                  <Bar
                    dataKey="masuk"
                    fill="#16A34A"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                  <Bar
                    dataKey="keluar"
                    fill="#DC2626"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Rincian Pengeluaran per Kategori: Donut Chart + Daftar (5 Kolom) */}
          <Card className="col-span-12 lg:col-span-5 print-card p-5 space-y-4">
            <SectionHeader
              title="Rincian Pengeluaran per Kategori"
              subtitle={`Total belanja usaha: ${formatRupiah(report.businessOut)}`}
            />

            {report.expenseBreakdown.length === 0 ? (
              <EmptyState
                title="Belum ada pengeluaran"
                description="Tidak ada catatan belanja usaha pada periode ini."
              />
            ) : (
              <>
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={report.expenseBreakdown}
                        dataKey="amount"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {report.expenseBreakdown.map((_, index) => (
                          <Cell
                            key={`donut-${index}`}
                            fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => formatRupiah(value)}
                        contentStyle={{
                          borderRadius: '12px',
                          border: '1px solid #E5E7EB',
                          fontSize: '13px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3 pt-2">
                  {report.expenseBreakdown.map((item, idx) => (
                    <div key={item.category} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{
                              backgroundColor:
                                DONUT_COLORS[idx % DONUT_COLORS.length]
                            }}
                          />
                          <span className="font-semibold text-gray-800 dark:text-gray-200">
                            {item.category}
                          </span>
                        </div>
                        <span className="tabular-nums font-bold text-gray-900 dark:text-gray-100">
                          {formatRupiah(item.amount)}{' '}
                          <span className="text-xs font-normal text-gray-500">
                            ({item.percentage}%)
                          </span>
                        </span>
                      </div>
                      <ProgressBar
                        value={item.percentage}
                        max={100}
                        colorClass="bg-status-danger"
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Tombol Ekspor & Cetak untuk layar kecil */}
        <div className="grid grid-cols-2 gap-3 sm:hidden no-print">
          <Button variant="secondary" onClick={handleExportCsv}>
            <Download className="w-5 h-5 text-primary-600" />
            <span>Ekspor CSV</span>
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="w-5 h-5" />
            <span>Cetak Laporan</span>
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
