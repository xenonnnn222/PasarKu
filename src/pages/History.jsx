import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Trash2, Save, Calendar, Edit3 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../hooks/useToast';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../utils/constants';
import { formatRupiah } from '../utils/formatRupiah';
import { formatShortDate, toLocalDateInputValue } from '../utils/formatDate';
import { isPriveCategory } from '../utils/calculations';
import PageContainer from '../components/PageContainer';
import Card from '../components/Card';
import SegmentedControl from '../components/SegmentedControl';
import Input from '../components/Input';
import Button from '../components/Button';
import Badge from '../components/Badge';
import DataTable from '../components/DataTable';
import TransactionItem from '../components/TransactionItem';
import BottomSheet from '../components/BottomSheet';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';

export default function History() {
  const [searchParams] = useSearchParams();
  const { transactions, updateTransaction, deleteTransaction } = useApp();
  const { showToast } = useToast();

  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [filterType, setFilterType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const qParam = searchParams.get('q');
    if (qParam !== null) {
      setSearch(qParam);
    }
  }, [searchParams]);

  // State Modal Detail / Edit
  const [selectedTx, setSelectedTx] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editDate, setEditDate] = useState('');
  const [confirmDeleteTx, setConfirmDeleteTx] = useState(null);

  const openDetail = (tx) => {
    setSelectedTx(tx);
    setEditAmount(String(tx.amount));
    setEditCategory(tx.category);
    setEditNote(tx.note || '');
    setEditDate(toLocalDateInputValue(tx.date));
  };

  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();

    return transactions.filter((tx) => {
      if (filterType !== 'all' && tx.type !== filterType) return false;
      const txDateKey = toLocalDateInputValue(tx.date);
      if (startDate && txDateKey < startDate) return false;
      if (endDate && txDateKey > endDate) return false;
      if (q) {
        const matchCat = tx.category.toLowerCase().includes(q);
        const matchNote = (tx.note || '').toLowerCase().includes(q);
        return matchCat || matchNote;
      }
      return true;
    });
  }, [transactions, search, filterType, startDate, endDate]);

  const summaryFiltered = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    for (const tx of filteredTransactions) {
      if (tx.type === 'in') totalIn += Number(tx.amount) || 0;
      else totalOut += Number(tx.amount) || 0;
    }
    return { totalIn, totalOut, net: totalIn - totalOut };
  }, [filteredTransactions]);

  const handleUpdate = (e) => {
    e.preventDefault();
    if (!selectedTx) return;
    const amt = Math.round(Number(editAmount) || 0);
    if (amt <= 0) {
      showToast('Nominal harus lebih dari Rp 0', 'error');
      return;
    }
    const nextIso = editDate
      ? new Date(`${editDate}T10:00:00`).toISOString()
      : selectedTx.date;

    updateTransaction(selectedTx.id, {
      amount: amt,
      category: editCategory,
      note: editNote.trim(),
      date: nextIso
    });
    showToast('Catatan transaksi diperbarui');
    setSelectedTx(null);
  };

  const handleConfirmDelete = () => {
    if (!confirmDeleteTx) return;
    deleteTransaction(confirmDeleteTx.id);
    showToast('Transaksi dihapus');
    setConfirmDeleteTx(null);
    setSelectedTx(null);
  };

  const availableCategories =
    selectedTx?.type === 'out' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const columns = [
    {
      key: 'date',
      header: 'Tanggal',
      sortable: true,
      sortValue: (row) => new Date(row.date).getTime(),
      render: (row) => (
        <span className="font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
          {formatShortDate(row.date)}
        </span>
      )
    },
    {
      key: 'note',
      header: 'Keterangan',
      sortable: true,
      render: (row) => (
        <span className="font-semibold text-gray-900 dark:text-gray-100">
          {row.note || '-'}
        </span>
      )
    },
    {
      key: 'category',
      header: 'Kategori',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <span className="text-gray-800 dark:text-gray-200">{row.category}</span>
          {isPriveCategory(row.category) && (
            <Badge variant="info">Pribadi</Badge>
          )}
        </div>
      )
    },
    {
      key: 'type',
      header: 'Jenis',
      sortable: true,
      render: (row) => (
        <Badge variant={row.type === 'in' ? 'success' : 'danger'}>
          {row.type === 'in' ? 'Uang Masuk' : 'Uang Keluar'}
        </Badge>
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
    },
    {
      key: 'actions',
      header: 'Aksi',
      align: 'right',
      render: (row) => (
        <div className="inline-flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => openDetail(row)}
            aria-label={`Ubah transaksi ${row.category}`}
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200 inline-flex items-center gap-1"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Ubah</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmDeleteTx(row)}
            aria-label={`Hapus transaksi ${row.category}`}
            className="p-1.5 rounded-lg border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/40 text-status-danger dark:text-red-400"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <PageContainer
      title="Riwayat Transaksi"
      subtitle="Tabel seluruh catatan uang masuk dan pengeluaran usaha"
    >
      <div className="space-y-6">
        {/* Panel Pencarian & Filter */}
        <Card className="p-5 space-y-4">
          <div className="grid grid-cols-12 gap-4 items-end">
            <div className="col-span-12 lg:col-span-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                Cari Transaksi
              </label>
              <div className="relative">
                <Search className="w-5 h-5 text-gray-400 absolute left-3.5 top-3.5" />
                <input
                  type="search"
                  placeholder="Ketik keterangan atau kategori..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full min-h-[48px] pl-11 pr-4 py-2 rounded-btn border border-gray-300 dark:border-gray-700 bg-white dark:bg-surface-dark text-base focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="col-span-12 sm:col-span-6 lg:col-span-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                Jenis Transaksi
              </label>
              <SegmentedControl
                value={filterType}
                onChange={setFilterType}
                options={[
                  { value: 'all', label: 'Semua' },
                  { value: 'in', label: 'Masuk' },
                  { value: 'out', label: 'Keluar' }
                ]}
              />
            </div>

            <div className="col-span-6 sm:col-span-3 lg:col-span-2">
              <Input
                label="Dari Tanggal"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="col-span-6 sm:col-span-3 lg:col-span-2">
              <Input
                label="Sampai Tanggal"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-sm">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-gray-500">
                Menampilkan <strong>{filteredTransactions.length}</strong> transaksi
              </span>
              <span className="text-primary-700 dark:text-primary-400 font-semibold tabular-nums">
                Total Masuk: {formatRupiah(summaryFiltered.totalIn)}
              </span>
              <span className="text-status-danger dark:text-red-400 font-semibold tabular-nums">
                Total Keluar: {formatRupiah(summaryFiltered.totalOut)}
              </span>
            </div>

            {(startDate || endDate || search || filterType !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setFilterType('all');
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-xs font-semibold text-primary-700 dark:text-primary-400 hover:underline"
              >
                Reset Semua Filter
              </button>
            )}
          </div>
        </Card>

        {/* Tabel Riwayat Transaksi (Desktop) / Daftar Kartu (< 768px) */}
        <DataTable
          columns={columns}
          data={filteredTransactions}
          defaultSortKey="date"
          defaultSortDir="desc"
          renderMobileCard={(tx) => (
            <Card className="p-3">
              <TransactionItem transaction={tx} onClick={openDetail} />
            </Card>
          )}
          emptyContent={
            <Card>
              <EmptyState
                icon={Calendar}
                title="Tidak ada transaksi ditemukan"
                description="Coba ubah kata kunci pencarian atau rentang tanggal filter di atas."
              />
            </Card>
          }
        />
      </div>

      {/* Modal Ubah Transaksi */}
      <BottomSheet
        isOpen={Boolean(selectedTx)}
        onClose={() => setSelectedTx(null)}
        title="Ubah Detail Transaksi"
      >
        {selectedTx && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <Input
              label="Nominal (Rp)"
              type="text"
              inputMode="numeric"
              prefix="Rp"
              formatCurrency
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                Kategori
              </label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full min-h-[48px] rounded-btn border border-gray-300 dark:border-gray-700 bg-white dark:bg-surface-dark px-3.5 py-2.5 text-base"
              >
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Catatan / Keterangan"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
            />

            <Input
              label="Tanggal"
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                type="button"
                variant="outlineDanger"
                onClick={() => setConfirmDeleteTx(selectedTx)}
              >
                <Trash2 className="w-4 h-4" />
                <span>Hapus</span>
              </Button>
              <Button type="submit" variant="primary">
                <Save className="w-4 h-4" />
                <span>Simpan Perubahan</span>
              </Button>
            </div>
          </form>
        )}
      </BottomSheet>

      <ConfirmDialog
        isOpen={Boolean(confirmDeleteTx)}
        title="Hapus Transaksi?"
        message="Catatan transaksi ini akan dihapus permanen dan mempengaruhi perhitungan saldo kas Anda."
        confirmLabel="Ya, Hapus"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteTx(null)}
      />
    </PageContainer>
  );
}
