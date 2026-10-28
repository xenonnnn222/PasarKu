// Kunci penyimpanan localStorage dengan prefix wajib "pasarku:"
export const STORAGE_KEYS = {
  TRANSACTIONS: 'pasarku:transactions',
  DEBTS: 'pasarku:debts',
  PRODUCTS: 'pasarku:products',
  WASTE_LOGS: 'pasarku:wasteLogs',
  SETTINGS: 'pasarku:settings'
};

// Kategori uang masuk
export const INCOME_CATEGORIES = [
  { id: 'Penjualan', label: 'Penjualan', icon: 'ShoppingBag' },
  { id: 'Bayar kasbon', label: 'Bayar kasbon', icon: 'HandCoins' },
  { id: 'Lain-lain', label: 'Lain-lain', icon: 'PlusCircle' }
];

// Kategori uang keluar
export const EXPENSE_CATEGORIES = [
  { id: 'Belanja modal', label: 'Belanja modal', icon: 'PackagePlus' },
  { id: 'Ongkos/transport', label: 'Ongkos/transport', icon: 'Truck' },
  { id: 'Retribusi pasar', label: 'Retribusi pasar', icon: 'Store' },
  { id: 'Listrik/es', label: 'Listrik/es', icon: 'Zap' },
  { id: 'Gaji karyawan', label: 'Gaji karyawan', icon: 'Users' },
  { id: 'Pribadi (prive)', label: 'Pribadi (prive)', icon: 'User' },
  { id: 'Bayar utang', label: 'Bayar utang', icon: 'Receipt' },
  { id: 'Lain-lain', label: 'Lain-lain', icon: 'MoreHorizontal' }
];

// Satuan barang dagangan pasar tradisional
export const PRODUCT_UNITS = [
  'kg',
  'ons',
  'ikat',
  'tumpuk',
  'butir',
  'karung',
  'bungkus',
  'liter',
  'pcs'
];

// Alasan barang susut/rusak
export const WASTE_REASONS = [
  'Busuk / Layu',
  'Rusak / Pecah',
  'Hilang / Tumpah',
  'Lainnya'
];

// Pengaturan awal default
export const DEFAULT_SETTINGS = {
  businessName: 'Lapak Sayur Bu Sari',
  ownerName: 'Bu Sari',
  phone: '081234567890',
  pin: '1234',
  startingCash: 500000,
  theme: 'light',
  fontSize: 'normal',
  onboarded: true,
  loggedIn: false
};
