import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Minus,
  PackagePlus,
  AlertOctagon,
  Edit3,
  Trash2,
  Package,
  Check,
  AlertTriangle,
  Wallet
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../hooks/useToast';
import { PRODUCT_UNITS, WASTE_REASONS } from '../utils/constants';
import { formatRupiah } from '../utils/formatRupiah';
import {
  getStockStatus,
  calculateStockOverview,
  calculateSellingPrice
} from '../utils/calculations';
import PageContainer from '../components/PageContainer';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
import SectionHeader from '../components/SectionHeader';
import SegmentedControl from '../components/SegmentedControl';
import Chip from '../components/Chip';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Input from '../components/Input';
import DataTable from '../components/DataTable';
import BottomSheet from '../components/BottomSheet';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';

export default function Stock() {
  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    adjustProductStock,
    restockProduct,
    recordWaste
  } = useApp();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState('Semua');

  // State Kalkulator Harga Jual
  const [calcProductId, setCalcProductId] = useState('');
  const [calcBuyPrice, setCalcBuyPrice] = useState('25000');
  const [calcMode, setCalcMode] = useState('margin');
  const [calcPercent, setCalcPercent] = useState('20');

  // State Modal Tambah/Edit Barang
  const [isProductSheetOpen, setIsProductSheetOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [prodName, setProdName] = useState('');
  const [prodUnit, setProdUnit] = useState('kg');
  const [prodStock, setProdStock] = useState('');
  const [prodMinStock, setProdMinStock] = useState('5');
  const [prodBuyPrice, setProdBuyPrice] = useState('');
  const [prodSellPrice, setProdSellPrice] = useState('');
  const [prodError, setProdError] = useState('');
  const [confirmDeleteProd, setConfirmDeleteProd] = useState(null);

  // State Modal Stok Masuk
  const [restockTarget, setRestockTarget] = useState(null);
  const [restockQty, setRestockQty] = useState('');
  const [restockBuyPrice, setRestockBuyPrice] = useState('');
  const [restockRecordExpense, setRestockRecordExpense] = useState(true);

  // State Modal Catat Susut
  const [wasteTarget, setWasteTarget] = useState(null);
  const [wasteQty, setWasteQty] = useState('1');
  const [wasteReason, setWasteReason] = useState(WASTE_REASONS[0]);

  const overview = useMemo(
    () => calculateStockOverview(products),
    [products]
  );

  const potentialSellValue = useMemo(() => {
    return products.reduce(
      (sum, p) =>
        sum + Math.max(0, Number(p.stock) || 0) * (Number(p.sellPrice) || 0),
      0
    );
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const status = getStockStatus(p);
      if (stockFilter === 'Menipis' && status !== 'Menipis') return false;
      if (stockFilter === 'Habis' && status !== 'Habis') return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, search, stockFilter]);

  const calcResult = useMemo(
    () => calculateSellingPrice(calcBuyPrice, calcPercent, calcMode),
    [calcBuyPrice, calcPercent, calcMode]
  );

  const handleSelectCalcProduct = (id) => {
    setCalcProductId(id);
    const found = products.find((p) => p.id === id);
    if (found) {
      setCalcBuyPrice(String(found.buyPrice));
    }
  };

  const handleApplyCalculatedPrice = () => {
    if (!calcProductId) {
      showToast('Pilih barang terlebih dahulu untuk menyimpan harga', 'info');
      return;
    }
    updateProduct(calcProductId, {
      buyPrice: Math.round(Number(calcBuyPrice) || 0),
      sellPrice: calcResult.sellPrice
    });
    const prod = products.find((p) => p.id === calcProductId);
    showToast(
      `Harga jual ${prod?.name || 'barang'} diperbarui jadi ${formatRupiah(
        calcResult.sellPrice
      )}!`
    );
  };

  const openAddProduct = () => {
    setEditingProduct(null);
    setProdName('');
    setProdUnit('kg');
    setProdStock('10');
    setProdMinStock('5');
    setProdBuyPrice('');
    setProdSellPrice('');
    setProdError('');
    setIsProductSheetOpen(true);
  };

  const openEditProduct = (p) => {
    setEditingProduct(p);
    setProdName(p.name);
    setProdUnit(p.unit);
    setProdStock(String(p.stock));
    setProdMinStock(String(p.minStock));
    setProdBuyPrice(String(p.buyPrice));
    setProdSellPrice(String(p.sellPrice));
    setProdError('');
    setIsProductSheetOpen(true);
  };

  const handleSaveProduct = (e) => {
    e.preventDefault();
    setProdError('');
    if (!prodName.trim()) {
      setProdError('Nama barang wajib diisi');
      return;
    }
    if (Number(prodBuyPrice) <= 0 || Number(prodSellPrice) <= 0) {
      setProdError('Harga modal dan harga jual harus lebih dari Rp 0');
      return;
    }

    if (editingProduct) {
      updateProduct(editingProduct.id, {
        name: prodName.trim(),
        unit: prodUnit,
        stock: Number(prodStock) || 0,
        minStock: Number(prodMinStock) || 0,
        buyPrice: Number(prodBuyPrice) || 0,
        sellPrice: Number(prodSellPrice) || 0
      });
      showToast(`Data ${prodName.trim()} diperbarui`);
    } else {
      addProduct({
        name: prodName.trim(),
        unit: prodUnit,
        stock: Number(prodStock) || 0,
        minStock: Number(prodMinStock) || 0,
        buyPrice: Number(prodBuyPrice) || 0,
        sellPrice: Number(prodSellPrice) || 0
      });
      showToast(`Barang ${prodName.trim()} ditambahkan`);
    }
    setIsProductSheetOpen(false);
  };

  const handleSaveRestock = (e) => {
    e.preventDefault();
    if (!restockTarget) return;
    const qtyNum = Number(restockQty) || 0;
    if (qtyNum <= 0) {
      showToast('Jumlah stok masuk harus lebih dari 0', 'error');
      return;
    }
    restockProduct({
      productId: restockTarget.id,
      qty: qtyNum,
      buyPrice: Number(restockBuyPrice) || restockTarget.buyPrice,
      recordExpense: restockRecordExpense
    });
    showToast(
      `Stok ${restockTarget.name} bertambah ${qtyNum} ${restockTarget.unit}${
        restockRecordExpense ? ' & tercatat di Belanja Modal' : ''
      }`
    );
    setRestockTarget(null);
  };

  const handleSaveWaste = (e) => {
    e.preventDefault();
    if (!wasteTarget) return;
    const qtyNum = Number(wasteQty) || 0;
    if (qtyNum <= 0 || qtyNum > wasteTarget.stock) {
      showToast('Jumlah susut tidak valid atau melebihi stok', 'error');
      return;
    }
    recordWaste({
      productId: wasteTarget.id,
      qty: qtyNum,
      reason: wasteReason
    });
    showToast(
      `Susut ${qtyNum} ${wasteTarget.unit} ${wasteTarget.name} berhasil dicatat`
    );
    setWasteTarget(null);
  };

  const columns = [
    {
      key: 'name',
      header: 'Nama Barang',
      sortable: true,
      render: (row) => (
        <span className="font-bold text-gray-900 dark:text-gray-100">
          {row.name}
        </span>
      )
    },
    {
      key: 'unit',
      header: 'Satuan',
      sortable: true,
      render: (row) => (
        <span className="text-gray-600 dark:text-gray-300">{row.unit}</span>
      )
    },
    {
      key: 'stock',
      header: 'Stok',
      align: 'center',
      sortable: true,
      render: (row) => (
        <div className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => adjustProductStock(row.id, -1)}
            aria-label={`Kurangi stok ${row.name}`}
            className="w-7 h-7 rounded bg-white dark:bg-surface-darkCard shadow-sm flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-gray-50 active:scale-95"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="min-w-[36px] text-center font-bold tabular-nums">
            {row.stock}
          </span>
          <button
            type="button"
            onClick={() => adjustProductStock(row.id, 1)}
            aria-label={`Tambah stok ${row.name}`}
            className="w-7 h-7 rounded bg-primary-600 text-white shadow-sm flex items-center justify-center hover:bg-primary-700 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    },
    {
      key: 'minStock',
      header: 'Minimum',
      align: 'center',
      sortable: true,
      render: (row) => (
        <span className="text-gray-500 tabular-nums">
          {row.minStock} {row.unit}
        </span>
      )
    },
    {
      key: 'buyPrice',
      header: 'Harga Modal',
      align: 'right',
      sortable: true,
      render: (row) => (
        <span className="tabular-nums text-gray-700 dark:text-gray-300 whitespace-nowrap">
          {formatRupiah(row.buyPrice)}
        </span>
      )
    },
    {
      key: 'sellPrice',
      header: 'Harga Jual',
      align: 'right',
      sortable: true,
      render: (row) => (
        <span className="font-bold tabular-nums text-primary-700 dark:text-primary-400 whitespace-nowrap">
          {formatRupiah(row.sellPrice)}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      sortable: true,
      sortValue: (row) => getStockStatus(row),
      render: (row) => {
        const st = getStockStatus(row);
        const variant =
          st === 'Cukup' ? 'success' : st === 'Menipis' ? 'warning' : 'danger';
        return <Badge variant={variant}>{st}</Badge>;
      }
    },
    {
      key: 'actions',
      header: 'Aksi',
      align: 'right',
      render: (row) => (
        <div className="inline-flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => {
              setRestockTarget(row);
              setRestockQty('5');
              setRestockBuyPrice(String(row.buyPrice));
              setRestockRecordExpense(true);
            }}
            title="Stok Masuk / Kulakan"
            className="px-2.5 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-semibold inline-flex items-center gap-1 hover:bg-primary-100"
          >
            <PackagePlus className="w-3.5 h-3.5" />
            <span>Masuk</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setWasteTarget(row);
              setWasteQty('1');
              setWasteReason(WASTE_REASONS[0]);
            }}
            title="Catat Barang Susut / Busuk"
            className="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-semibold inline-flex items-center gap-1 hover:bg-amber-100"
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>Susut</span>
          </button>
          <button
            type="button"
            onClick={() => openEditProduct(row)}
            aria-label={`Ubah ${row.name}`}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100"
          >
            <Edit3 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <PageContainer
      title="Stok Barang & Harga Jual"
      subtitle="Kelola ketersediaan barang dagangan, barang susut, dan kalkulator harga jual"
      rightAction={
        <Button size="sm" onClick={openAddProduct}>
          <Plus className="w-4 h-4" />
          <span>Tambah Barang</span>
        </Button>
      }
    >
      <div className="space-y-6">
        {/* BARIS ATAS: GRID 12 KOLOM (4 Kartu Ringkasan) */}
        <div className="grid grid-cols-12 gap-4 lg:gap-6">
          <StatCard
            className="col-span-12 sm:col-span-6 xl:col-span-3"
            label="Total Jenis Barang"
            value={`${overview.totalTypes} Barang`}
            subtext="Terdaftar di etalase lapak"
            icon={Package}
          />
          <StatCard
            className="col-span-12 sm:col-span-6 xl:col-span-3"
            label="Stok Menipis / Habis"
            value={`${overview.lowStockCount} Barang`}
            subtext="Segera lakukan kulakan ulang"
            icon={AlertTriangle}
            variant="warning"
          />
          <StatCard
            className="col-span-12 sm:col-span-6 xl:col-span-3"
            label="Nilai Modal Stok"
            value={formatRupiah(overview.totalStockValue)}
            subtext="Stok saat ini × harga modal"
            icon={Wallet}
            variant="info"
          />
          <StatCard
            className="col-span-12 sm:col-span-6 xl:col-span-3"
            label="Estimasi Nilai Jual"
            value={formatRupiah(potentialSellValue)}
            subtext="Jika seluruh stok terjual habis"
            icon={Check}
            variant="income"
          />
        </div>

        {/* BARIS UTAMA: GRID 12 KOLOM (Kiri 8 Kolom Tabel Stok, Kanan 4 Kolom Kalkulator Harga) */}
        <div className="grid grid-cols-12 gap-6 items-start">
          {/* Kolom Kiri (8 Kolom): Filter & Tabel Stok */}
          <div className="col-span-12 xl:col-span-8 space-y-4">
            <Card className="p-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-5 h-5 text-gray-400 absolute left-3.5 top-3" />
                  <input
                    type="search"
                    placeholder="Cari nama barang..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full min-h-[44px] pl-11 pr-4 py-2 rounded-btn border border-gray-300 dark:border-gray-700 bg-white dark:bg-surface-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                  {['Semua', 'Menipis', 'Habis'].map((f) => (
                    <Chip
                      key={f}
                      label={f}
                      selected={stockFilter === f}
                      onClick={() => setStockFilter(f)}
                    />
                  ))}
                </div>
              </div>
            </Card>

            <DataTable
              columns={columns}
              data={filteredProducts}
              defaultSortKey="name"
              defaultSortDir="asc"
              renderMobileCard={(p) => {
                const status = getStockStatus(p);
                const badgeVar =
                  status === 'Cukup'
                    ? 'success'
                    : status === 'Menipis'
                    ? 'warning'
                    : 'danger';
                return (
                  <Card className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                            {p.name}
                          </h3>
                          <Badge variant={badgeVar}>{status}</Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
                          Modal: {formatRupiah(p.buyPrice)}/{p.unit} • Jual:{' '}
                          <strong>
                            {formatRupiah(p.sellPrice)}/{p.unit}
                          </strong>
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 p-1 rounded-btn">
                        <button
                          type="button"
                          onClick={() => adjustProductStock(p.id, -1)}
                          className="w-8 h-8 rounded bg-white dark:bg-surface-darkCard flex items-center justify-center"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="px-2 font-bold tabular-nums">
                          {p.stock} {p.unit}
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustProductStock(p.id, 1)}
                          className="w-8 h-8 rounded bg-primary-600 text-white flex items-center justify-center"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                      <button
                        type="button"
                        onClick={() => {
                          setRestockTarget(p);
                          setRestockQty('5');
                          setRestockBuyPrice(String(p.buyPrice));
                          setRestockRecordExpense(true);
                        }}
                        className="py-2 rounded-lg bg-primary-50 text-primary-700 text-xs font-semibold"
                      >
                        Stok Masuk
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setWasteTarget(p);
                          setWasteQty('1');
                          setWasteReason(WASTE_REASONS[0]);
                        }}
                        className="py-2 rounded-lg bg-amber-50 text-amber-800 text-xs font-semibold"
                      >
                        Catat Susut
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditProduct(p)}
                        className="py-2 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold"
                      >
                        Ubah
                      </button>
                    </div>
                  </Card>
                );
              }}
              emptyContent={
                <Card>
                  <EmptyState
                    icon={Package}
                    title="Barang tidak ditemukan"
                    description="Belum ada barang yang sesuai filter atau kata kunci."
                    actionLabel="Tambah Barang"
                    onAction={openAddProduct}
                  />
                </Card>
              }
            />
          </div>

          {/* Kolom Kanan (4 Kolom): Kalkulator Harga Jual */}
          <div className="col-span-12 xl:col-span-4">
            <Card className="p-5 space-y-4 border-primary-200 dark:border-primary-800/60 xl:sticky xl:top-24">
              <SectionHeader
                title="Kalkulator Harga Jual"
                subtitle="Hitung harga jual otomatis dari harga modal"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                  Pilih Barang Dagangan (Opsional)
                </label>
                <select
                  value={calcProductId}
                  onChange={(e) => handleSelectCalcProduct(e.target.value)}
                  className="w-full min-h-[48px] rounded-btn border border-gray-300 dark:border-gray-700 bg-white dark:bg-surface-dark px-3.5 py-2.5 text-base"
                >
                  <option value="">-- Hitung bebas / pilih barang --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Modal: {formatRupiah(p.buyPrice)}/{p.unit})
                    </option>
                  ))}
                </select>
              </div>

              <SegmentedControl
                value={calcMode}
                onChange={setCalcMode}
                options={[
                  { value: 'margin', label: 'Margin (%)' },
                  { value: 'markup', label: 'Markup (%)' }
                ]}
              />

              <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60 p-3 rounded-lg leading-relaxed">
                {calcMode === 'margin'
                  ? 'Margin: Persentase untung dihitung dari Harga Jual akhir. Rumus: Modal ÷ (1 - Margin%).'
                  : 'Markup: Persentase untung ditambahkan langsung dari Harga Modal. Rumus: Modal × (1 + Markup%).'}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Harga Modal"
                  type="text"
                  inputMode="numeric"
                  prefix="Rp"
                  formatCurrency
                  value={calcBuyPrice}
                  onChange={(e) => setCalcBuyPrice(e.target.value)}
                />
                <Input
                  label={calcMode === 'margin' ? 'Margin (%)' : 'Markup (%)'}
                  type="number"
                  inputMode="numeric"
                  suffix="%"
                  value={calcPercent}
                  onChange={(e) => setCalcPercent(e.target.value)}
                />
              </div>

              <div className="p-4 rounded-btn bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-primary-800 dark:text-primary-200 block">
                    Saran Harga Jual
                  </span>
                  <span className="text-2xl font-bold text-primary-700 dark:text-primary-300 tabular-nums">
                    {formatRupiah(calcResult.sellPrice)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-600 dark:text-gray-300 block">
                    Untung / satuan
                  </span>
                  <span className="text-base font-bold text-primary-700 dark:text-primary-400 tabular-nums">
                    +{formatRupiah(calcResult.profitPerUnit)}
                  </span>
                </div>
              </div>

              <Button
                variant="primary"
                fullWidth
                disabled={!calcProductId || calcResult.sellPrice <= 0}
                onClick={handleApplyCalculatedPrice}
              >
                <Check className="w-5 h-5" />
                <span>
                  {calcProductId
                    ? 'Pakai Harga Ini ke Barang'
                    : 'Pilih Barang untuk Simpan Harga'}
                </span>
              </Button>
            </Card>
          </div>
        </div>
      </div>

      {/* Modal Tambah / Ubah Barang */}
      <BottomSheet
        isOpen={isProductSheetOpen}
        onClose={() => setIsProductSheetOpen(false)}
        title={
          editingProduct ? `Ubah ${editingProduct.name}` : 'Tambah Barang Baru'
        }
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          <Input
            label="Nama Barang"
            placeholder="Contoh: Cabai Rawit Merah"
            value={prodName}
            onChange={(e) => setProdName(e.target.value)}
          />

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                Satuan
              </label>
              <select
                value={prodUnit}
                onChange={(e) => setProdUnit(e.target.value)}
                className="w-full min-h-[48px] rounded-btn border border-gray-300 dark:border-gray-700 bg-white dark:bg-surface-dark px-3 py-2.5 text-base"
              >
                {PRODUCT_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Stok Saat Ini"
              type="number"
              inputMode="decimal"
              value={prodStock}
              onChange={(e) => setProdStock(e.target.value)}
            />
            <Input
              label="Batas Min."
              type="number"
              inputMode="decimal"
              value={prodMinStock}
              onChange={(e) => setProdMinStock(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Harga Modal (Rp)"
              type="text"
              inputMode="numeric"
              prefix="Rp"
              formatCurrency
              value={prodBuyPrice}
              onChange={(e) => setProdBuyPrice(e.target.value)}
            />
            <Input
              label="Harga Jual (Rp)"
              type="text"
              inputMode="numeric"
              prefix="Rp"
              formatCurrency
              value={prodSellPrice}
              onChange={(e) => setProdSellPrice(e.target.value)}
            />
          </div>

          {prodError && (
            <p role="alert" className="text-sm font-medium text-status-danger">
              {prodError}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            {editingProduct && (
              <Button
                type="button"
                variant="outlineDanger"
                onClick={() => {
                  setIsProductSheetOpen(false);
                  setConfirmDeleteProd(editingProduct);
                }}
              >
                <Trash2 className="w-4 h-4" />
                <span>Hapus</span>
              </Button>
            )}
            <Button type="submit" fullWidth>
              Simpan Barang
            </Button>
          </div>
        </form>
      </BottomSheet>

      {/* Modal Stok Masuk */}
      <BottomSheet
        isOpen={Boolean(restockTarget)}
        onClose={() => setRestockTarget(null)}
        title={
          restockTarget ? `Stok Masuk: ${restockTarget.name}` : 'Stok Masuk'
        }
      >
        {restockTarget && (
          <form onSubmit={handleSaveRestock} className="space-y-4">
            <Input
              label={`Jumlah Masuk (${restockTarget.unit})`}
              type="number"
              inputMode="decimal"
              value={restockQty}
              onChange={(e) => setRestockQty(e.target.value)}
            />
            <Input
              label={`Harga Modal per ${restockTarget.unit} (Rp)`}
              type="text"
              inputMode="numeric"
              prefix="Rp"
              formatCurrency
              value={restockBuyPrice}
              onChange={(e) => setRestockBuyPrice(e.target.value)}
            />

            <label className="flex items-start gap-3 p-3.5 rounded-btn bg-gray-50 dark:bg-gray-800/60 cursor-pointer">
              <input
                type="checkbox"
                checked={restockRecordExpense}
                onChange={(e) => setRestockRecordExpense(e.target.checked)}
                className="mt-1 w-5 h-5 accent-primary-600 rounded"
              />
              <div className="text-sm">
                <span className="font-semibold text-gray-900 dark:text-gray-100 block">
                  Catat juga sebagai pengeluaran "Belanja modal"
                </span>
                <span className="text-xs text-gray-500">
                  Otomatis mengurangi kas sebesar{' '}
                  {formatRupiah(
                    (Number(restockQty) || 0) * (Number(restockBuyPrice) || 0)
                  )}
                </span>
              </div>
            </label>

            <Button type="submit" fullWidth size="lg">
              Tambah Stok Sekarang
            </Button>
          </form>
        )}
      </BottomSheet>

      {/* Modal Catat Susut */}
      <BottomSheet
        isOpen={Boolean(wasteTarget)}
        onClose={() => setWasteTarget(null)}
        title={wasteTarget ? `Catat Susut: ${wasteTarget.name}` : 'Catat Susut'}
      >
        {wasteTarget && (
          <form onSubmit={handleSaveWaste} className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Stok saat ini:{' '}
              <strong>
                {wasteTarget.stock} {wasteTarget.unit}
              </strong>
              . Barang susut akan mengurangi stok dan dicatat sebagai kerugian di Laporan.
            </p>
            <Input
              label={`Jumlah Susut (${wasteTarget.unit})`}
              type="number"
              inputMode="decimal"
              value={wasteQty}
              onChange={(e) => setWasteQty(e.target.value)}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                Alasan Susut
              </label>
              <select
                value={wasteReason}
                onChange={(e) => setWasteReason(e.target.value)}
                className="w-full min-h-[48px] rounded-btn border border-gray-300 dark:border-gray-700 bg-white dark:bg-surface-dark px-3.5 py-2.5 text-base"
              >
                {WASTE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="p-3.5 rounded-btn bg-red-50 dark:bg-red-950/30 text-sm text-status-danger dark:text-red-300">
              Nilai kerugian susut:{' '}
              <strong>
                {formatRupiah((Number(wasteQty) || 0) * wasteTarget.buyPrice)}
              </strong>
            </div>
            <Button type="submit" variant="danger" fullWidth size="lg">
              Simpan Catatan Susut
            </Button>
          </form>
        )}
      </BottomSheet>

      <ConfirmDialog
        isOpen={Boolean(confirmDeleteProd)}
        title="Hapus Barang?"
        message={`Apakah Anda yakin ingin menghapus "${confirmDeleteProd?.name}" dari daftar stok?`}
        confirmLabel="Ya, Hapus"
        onConfirm={() => {
          if (confirmDeleteProd) {
            deleteProduct(confirmDeleteProd.id);
            showToast('Barang dihapus dari daftar stok');
          }
          setConfirmDeleteProd(null);
        }}
        onCancel={() => setConfirmDeleteProd(null)}
      />
    </PageContainer>
  );
}
