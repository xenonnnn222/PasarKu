import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  MessageCircle,
  HandCoins,
  Calendar,
  Trash2,
  Edit3,
  BookOpen,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../hooks/useToast';
import { formatRupiah } from '../utils/formatRupiah';
import { formatShortDate, toLocalDateInputValue } from '../utils/formatDate';
import { getDebtStatus, getDebtRemaining } from '../utils/calculations';
import PageContainer from '../components/PageContainer';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
import SegmentedControl from '../components/SegmentedControl';
import Chip from '../components/Chip';
import Badge from '../components/Badge';
import ProgressBar from '../components/ProgressBar';
import Button from '../components/Button';
import Input from '../components/Input';
import DataTable from '../components/DataTable';
import BottomSheet from '../components/BottomSheet';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';

export default function Debts() {
  const {
    debts,
    settings,
    addDebt,
    updateDebt,
    deleteDebt,
    recordDebtPayment
  } = useApp();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('piutang');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua');

  // Modal Tambah / Edit Kasbon
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState(null);
  const [party, setParty] = useState('');
  const [phone, setPhone] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return toLocalDateInputValue(d);
  });
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');

  // Modal Detail & Bayar Cicilan
  const [selectedDebtId, setSelectedDebtId] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [confirmDeleteDebt, setConfirmDeleteDebt] = useState(null);

  const selectedDebt = useMemo(
    () => debts.find((d) => d.id === selectedDebtId) || null,
    [debts, selectedDebtId]
  );

  // Ringkasan 4 kartu atas
  const summaryStats = useMemo(() => {
    let piutang = 0;
    let utang = 0;
    let overdueCount = 0;
    let paidOffCount = 0;

    for (const d of debts) {
      const rem = getDebtRemaining(d);
      const st = getDebtStatus(d);
      if (d.type === 'piutang') piutang += rem;
      else utang += rem;
      if (st === 'Terlambat') overdueCount += 1;
      if (st === 'Lunas') paidOffCount += 1;
    }
    return { piutang, utang, overdueCount, paidOffCount };
  }, [debts]);

  const filteredDebts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return debts.filter((d) => {
      if (d.type !== activeTab) return false;
      const status = getDebtStatus(d);
      if (statusFilter !== 'Semua' && status !== statusFilter) return false;
      if (q) {
        return (
          d.party.toLowerCase().includes(q) ||
          (d.note || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [debts, activeTab, statusFilter, search]);

  const openAddModal = () => {
    setEditingDebt(null);
    setParty('');
    setPhone('');
    setTotalAmount('');
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setDueDate(toLocalDateInputValue(nextWeek));
    setNote('');
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditModal = (debt) => {
    setEditingDebt(debt);
    setParty(debt.party);
    setPhone(debt.phone || '');
    setTotalAmount(String(debt.total));
    setDueDate(toLocalDateInputValue(debt.dueDate));
    setNote(debt.note || '');
    setFormError('');
    setIsFormOpen(true);
  };

  const openPaymentModal = (debt) => {
    setSelectedDebtId(debt.id);
    setPaymentAmount('');
    setPaymentNote('');
    setPaymentError('');
  };

  const handleSaveDebt = (e) => {
    e.preventDefault();
    setFormError('');
    if (!party.trim()) {
      setFormError('Nama wajib diisi');
      return;
    }
    const amt = Math.round(Number(totalAmount) || 0);
    if (amt <= 0) {
      setFormError('Nominal harus lebih dari Rp 0');
      return;
    }
    const dueIso = dueDate
      ? new Date(`${dueDate}T12:00:00`).toISOString()
      : new Date().toISOString();

    if (editingDebt) {
      updateDebt(editingDebt.id, {
        party: party.trim(),
        phone: phone.trim(),
        total: amt,
        dueDate: dueIso,
        note: note.trim()
      });
      showToast('Data kasbon berhasil diperbarui');
    } else {
      addDebt({
        type: activeTab,
        party: party.trim(),
        phone: phone.trim(),
        total: amt,
        paid: 0,
        dueDate: dueIso,
        note: note.trim()
      });
      showToast(
        `${
          activeTab === 'piutang' ? 'Piutang pelanggan' : 'Utang supplier'
        } berhasil ditambahkan`
      );
    }
    setIsFormOpen(false);
  };

  const handlePayInstallment = (e) => {
    e.preventDefault();
    if (!selectedDebt) return;
    setPaymentError('');
    const remaining = getDebtRemaining(selectedDebt);
    const amt = Math.round(Number(paymentAmount) || 0);

    if (amt <= 0) {
      setPaymentError('Masukkan nominal pembayaran lebih dari Rp 0');
      return;
    }
    if (amt > remaining) {
      setPaymentError(
        `Nominal tidak boleh melebihi sisa tagihan (${formatRupiah(remaining)})`
      );
      return;
    }

    recordDebtPayment(selectedDebt.id, amt, paymentNote);
    showToast(
      `Pembayaran ${formatRupiah(amt)} tercatat & otomatis masuk ke ${
        selectedDebt.type === 'piutang' ? 'Uang Masuk' : 'Uang Keluar'
      }!`
    );
    setPaymentAmount('');
    setPaymentNote('');
  };

  const handleWhatsAppReminder = (debt) => {
    if (!debt.phone) return;
    const cleanPhone = debt.phone.replace(/\D/g, '').replace(/^0/, '62');
    const remaining = getDebtRemaining(debt);
    const message = `Assalamualaikum / Permisi Bapak/Ibu ${
      debt.party
    }, mengingatkan dengan sopan catatan kasbon di *${
      settings?.businessName || 'Lapak Sayur Bu Sari'
    }* sebesar *${formatRupiah(remaining)}* (jatuh tempo ${formatShortDate(
      debt.dueDate
    )}). Terima kasih banyak sebelumnya 🙏`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
      message
    )}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getBadgeVariant = (status) => {
    if (status === 'Lunas') return 'success';
    if (status === 'Terlambat') return 'danger';
    return 'info';
  };

  const columns = [
    {
      key: 'party',
      header: activeTab === 'piutang' ? 'Nama Pelanggan' : 'Nama Supplier',
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-bold text-gray-900 dark:text-gray-100">
            {row.party}
          </p>
          {row.phone && (
            <p className="text-xs text-gray-500 tabular-nums">{row.phone}</p>
          )}
        </div>
      )
    },
    {
      key: 'note',
      header: 'Keterangan',
      sortable: true,
      render: (row) => (
        <span className="text-gray-600 dark:text-gray-300">
          {row.note || '-'}
        </span>
      )
    },
    {
      key: 'dueDate',
      header: 'Jatuh Tempo',
      sortable: true,
      sortValue: (row) => new Date(row.dueDate).getTime(),
      render: (row) => (
        <span className="text-gray-700 dark:text-gray-300 whitespace-nowrap">
          {formatShortDate(row.dueDate)}
        </span>
      )
    },
    {
      key: 'total',
      header: 'Total Awal',
      align: 'right',
      sortable: true,
      render: (row) => (
        <span className="text-gray-600 dark:text-gray-300 tabular-nums whitespace-nowrap">
          {formatRupiah(row.total)}
        </span>
      )
    },
    {
      key: 'remaining',
      header: 'Sisa Tagihan',
      align: 'right',
      sortable: true,
      sortValue: (row) => getDebtRemaining(row),
      render: (row) => {
        const rem = getDebtRemaining(row);
        return (
          <div className="min-w-[130px] text-right space-y-1">
            <span className="font-bold text-gray-900 dark:text-gray-100 tabular-nums block">
              {formatRupiah(rem)}
            </span>
            <ProgressBar
              value={row.paid}
              max={row.total}
              colorClass={
                rem <= 0
                  ? 'bg-primary-600'
                  : getDebtStatus(row) === 'Terlambat'
                  ? 'bg-status-danger'
                  : 'bg-status-info'
              }
            />
          </div>
        );
      }
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      sortable: true,
      sortValue: (row) => getDebtStatus(row),
      render: (row) => {
        const st = getDebtStatus(row);
        return <Badge variant={getBadgeVariant(st)}>{st}</Badge>;
      }
    },
    {
      key: 'actions',
      header: 'Aksi',
      align: 'right',
      render: (row) => {
        const rem = getDebtRemaining(row);
        return (
          <div className="inline-flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => openPaymentModal(row)}
              className="px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold inline-flex items-center gap-1 transition-colors"
            >
              <HandCoins className="w-3.5 h-3.5" />
              <span>{rem > 0 ? 'Bayar / Detail' : 'Detail'}</span>
            </button>
            {row.type === 'piutang' && row.phone && rem > 0 && (
              <button
                type="button"
                onClick={() => handleWhatsAppReminder(row)}
                title="Ingatkan via WhatsApp"
                aria-label={`Ingatkan ${row.party} via WhatsApp`}
                className="p-1.5 rounded-lg border border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300 hover:bg-primary-50"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => openEditModal(row)}
              aria-label={`Ubah ${row.party}`}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteDebt(row)}
              aria-label={`Hapus ${row.party}`}
              className="p-1.5 rounded-lg border border-red-200 dark:border-red-900/50 text-status-danger dark:text-red-400 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      }
    }
  ];

  return (
    <PageContainer
      title="Catatan Kasbon"
      subtitle="Kelola piutang pelanggan dan utang belanja ke supplier"
      rightAction={
        <Button size="sm" onClick={openAddModal}>
          <Plus className="w-4 h-4" />
          <span>Tambah Kasbon</span>
        </Button>
      }
    >
      <div className="space-y-6">
        {/* BARIS ATAS: GRID 12 KOLOM (4 Kartu Ringkasan) */}
        <div className="grid grid-cols-12 gap-4 lg:gap-6">
          <StatCard
            className="col-span-12 sm:col-span-6 xl:col-span-3"
            label="Belum Dibayar ke Anda"
            value={formatRupiah(summaryStats.piutang)}
            subtext="Total sisa piutang pelanggan"
            icon={HandCoins}
            variant="income"
          />
          <StatCard
            className="col-span-12 sm:col-span-6 xl:col-span-3"
            label="Utang Anda ke Supplier"
            value={formatRupiah(summaryStats.utang)}
            subtext="Total sisa utang kulakan"
            icon={BookOpen}
            variant="expense"
          />
          <StatCard
            className="col-span-12 sm:col-span-6 xl:col-span-3"
            label="Melewati Jatuh Tempo"
            value={`${summaryStats.overdueCount} Catatan`}
            subtext="Perlu segera ditagih / dilunasi"
            icon={AlertTriangle}
            variant="warning"
          />
          <StatCard
            className="col-span-12 sm:col-span-6 xl:col-span-3"
            label="Kasbon Sudah Lunas"
            value={`${summaryStats.paidOffCount} Catatan`}
            subtext="Riwayat pelunasan selesai"
            icon={CheckCircle2}
            variant="info"
          />
        </div>

        {/* Panel Kontrol: Tab, Pencarian, dan Filter Status */}
        <Card className="p-5 space-y-4">
          <div className="grid grid-cols-12 gap-4 items-center">
            <div className="col-span-12 lg:col-span-5">
              <SegmentedControl
                value={activeTab}
                onChange={(val) => {
                  setActiveTab(val);
                  setStatusFilter('Semua');
                }}
                options={[
                  { value: 'piutang', label: 'Piutang (Pelanggan)' },
                  { value: 'utang', label: 'Utang (Supplier)' }
                ]}
              />
            </div>

            <div className="col-span-12 sm:col-span-7 lg:col-span-4">
              <div className="relative">
                <Search className="w-5 h-5 text-gray-400 absolute left-3.5 top-3.5" />
                <input
                  type="search"
                  placeholder="Cari nama pelanggan / supplier..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full min-h-[46px] pl-11 pr-4 py-2 rounded-btn border border-gray-300 dark:border-gray-700 bg-white dark:bg-surface-dark text-base focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="col-span-12 sm:col-span-5 lg:col-span-3 flex justify-end">
              <Button fullWidth onClick={openAddModal}>
                <Plus className="w-5 h-5" />
                <span>
                  {activeTab === 'piutang' ? 'Tambah Piutang' : 'Tambah Utang'}
                </span>
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
            <span className="text-xs font-semibold text-gray-500 mr-1">
              Status:
            </span>
            {['Semua', 'Belum lunas', 'Terlambat', 'Lunas'].map((st) => (
              <Chip
                key={st}
                label={st}
                selected={statusFilter === st}
                onClick={() => setStatusFilter(st)}
              />
            ))}
          </div>
        </Card>

        {/* Tabel Data Kasbon (Desktop) & Kartu (< 768px) */}
        <DataTable
          columns={columns}
          data={filteredDebts}
          defaultSortKey="dueDate"
          defaultSortDir="asc"
          renderMobileCard={(debt) => {
            const status = getDebtStatus(debt);
            const remaining = getDebtRemaining(debt);
            return (
              <Card
                onClick={() => openPaymentModal(debt)}
                className="space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                      {debt.party}
                    </h3>
                    {debt.note && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {debt.note}
                      </p>
                    )}
                  </div>
                  <Badge variant={getBadgeVariant(status)}>{status}</Badge>
                </div>

                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-gray-500 block">
                      Sisa Tagihan
                    </span>
                    <span className="text-xl font-bold tabular-nums">
                      {formatRupiah(remaining)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-500 block">
                      Total {formatRupiah(debt.total)}
                    </span>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300 flex items-center justify-end gap-1 mt-0.5">
                      <Calendar className="w-3.5 h-3.5" />
                      Tempo: {formatShortDate(debt.dueDate)}
                    </span>
                  </div>
                </div>

                <ProgressBar
                  value={debt.paid}
                  max={debt.total}
                  colorClass={
                    status === 'Lunas'
                      ? 'bg-primary-600'
                      : status === 'Terlambat'
                      ? 'bg-status-danger'
                      : 'bg-status-info'
                  }
                />
              </Card>
            );
          }}
          emptyContent={
            <Card>
              <EmptyState
                icon={BookOpen}
                title="Belum ada catatan kasbon"
                description="Klik tombol Tambah untuk mencatat piutang pelanggan atau utang ke supplier."
                actionLabel="Tambah Kasbon"
                onAction={openAddModal}
              />
            </Card>
          }
        />
      </div>

      {/* Modal Detail Kasbon & Catat Pembayaran Cicilan */}
      <BottomSheet
        isOpen={Boolean(selectedDebt)}
        onClose={() => setSelectedDebtId(null)}
        title={
          selectedDebt ? `Detail Kasbon: ${selectedDebt.party}` : 'Detail Kasbon'
        }
      >
        {selectedDebt && (
          <div className="space-y-4">
            <div className="p-4 rounded-btn bg-gray-50 dark:bg-surface-dark border border-gray-200 dark:border-gray-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Status</span>
                <Badge variant={getBadgeVariant(getDebtStatus(selectedDebt))}>
                  {getDebtStatus(selectedDebt)}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Total Awal</span>
                <span className="text-sm font-semibold tabular-nums">
                  {formatRupiah(selectedDebt.total)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Sudah Dibayar</span>
                <span className="text-sm font-semibold text-primary-700 dark:text-primary-400 tabular-nums">
                  {formatRupiah(selectedDebt.paid)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-base font-bold">Sisa Belum Dibayar</span>
                <span className="text-lg font-bold text-status-danger dark:text-red-400 tabular-nums">
                  {formatRupiah(getDebtRemaining(selectedDebt))}
                </span>
              </div>
            </div>

            {getDebtRemaining(selectedDebt) > 0 && (
              <form
                onSubmit={handlePayInstallment}
                className="p-4 rounded-btn border border-primary-200 dark:border-primary-800 bg-primary-50/40 dark:bg-primary-950/20 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    Catat Pembayaran / Cicilan
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setPaymentAmount(String(getDebtRemaining(selectedDebt)))
                    }
                    className="text-xs font-bold text-primary-700 dark:text-primary-400 underline"
                  >
                    Lunasi Semua ({formatRupiah(getDebtRemaining(selectedDebt))})
                  </button>
                </div>

                <Input
                  label="Nominal Bayar (Rp)"
                  type="text"
                  inputMode="numeric"
                  prefix="Rp"
                  formatCurrency
                  placeholder="Ketik jumlah pembayaran"
                  value={paymentAmount}
                  onChange={(e) => {
                    setPaymentError('');
                    setPaymentAmount(e.target.value);
                  }}
                  error={paymentError}
                />

                <Input
                  label="Catatan Cicilan (Opsional)"
                  placeholder="Contoh: Bayar tunai di lapak"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                />

                <Button type="submit" fullWidth>
                  <HandCoins className="w-5 h-5" />
                  <span>Simpan Pembayaran</span>
                </Button>
              </form>
            )}

            {selectedDebt.type === 'piutang' &&
              selectedDebt.phone &&
              getDebtRemaining(selectedDebt) > 0 && (
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => handleWhatsAppReminder(selectedDebt)}
                >
                  <MessageCircle className="w-5 h-5 text-primary-600" />
                  <span>Ingatkan Sopan via WhatsApp</span>
                </Button>
              )}

            <div>
              <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">
                Riwayat Pembayaran ({selectedDebt.history?.length || 0})
              </h4>
              {!selectedDebt.history || selectedDebt.history.length === 0 ? (
                <p className="text-xs text-gray-500 italic">
                  Belum ada riwayat cicilan.
                </p>
              ) : (
                <div className="space-y-2 max-h-44 overflow-y-auto">
                  {selectedDebt.history.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between text-sm p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/60"
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {h.note || 'Cicilan'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatShortDate(h.date)}
                        </p>
                      </div>
                      <span className="font-bold text-primary-700 dark:text-primary-400 tabular-nums">
                        {formatRupiah(h.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200 dark:border-gray-800">
              <Button
                variant="secondary"
                onClick={() => {
                  const d = selectedDebt;
                  setSelectedDebtId(null);
                  openEditModal(d);
                }}
              >
                <Edit3 className="w-4 h-4" />
                <span>Ubah Data</span>
              </Button>
              <Button
                variant="outlineDanger"
                onClick={() => setConfirmDeleteDebt(selectedDebt)}
              >
                <Trash2 className="w-4 h-4" />
                <span>Hapus</span>
              </Button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Modal Tambah / Edit Kasbon */}
      <BottomSheet
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={
          editingDebt
            ? 'Ubah Data Kasbon'
            : activeTab === 'piutang'
            ? 'Tambah Piutang Pelanggan'
            : 'Tambah Utang Supplier'
        }
      >
        <form onSubmit={handleSaveDebt} className="space-y-4">
          <Input
            label={
              activeTab === 'piutang' ? 'Nama Pelanggan' : 'Nama Agen / Supplier'
            }
            placeholder="Contoh: Warung Bu Tejo"
            value={party}
            onChange={(e) => setParty(e.target.value)}
          />
          <Input
            label="Nomor HP / WhatsApp (Opsional)"
            type="tel"
            inputMode="tel"
            placeholder="Contoh: 081234567890"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            label="Total Nominal Kasbon (Rp)"
            type="text"
            inputMode="numeric"
            prefix="Rp"
            formatCurrency
            placeholder="Contoh: 150.000"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
          />
          <Input
            label="Tanggal Jatuh Tempo"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <Input
            label="Catatan Barang / Keterangan"
            placeholder="Contoh: Beras 5kg & cabai 1kg"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {formError && (
            <p role="alert" className="text-sm font-medium text-status-danger">
              {formError}
            </p>
          )}
          <Button type="submit" fullWidth size="lg">
            Simpan Kasbon
          </Button>
        </form>
      </BottomSheet>

      <ConfirmDialog
        isOpen={Boolean(confirmDeleteDebt)}
        title="Hapus Data Kasbon?"
        message={`Catatan kasbon "${confirmDeleteDebt?.party}" beserta riwayat cicilannya akan dihapus.`}
        confirmLabel="Ya, Hapus"
        onConfirm={() => {
          if (confirmDeleteDebt) {
            deleteDebt(confirmDeleteDebt.id);
            showToast('Data kasbon dihapus');
          }
          setConfirmDeleteDebt(null);
          setSelectedDebtId(null);
        }}
        onCancel={() => setConfirmDeleteDebt(null)}
      />
    </PageContainer>
  );
}
