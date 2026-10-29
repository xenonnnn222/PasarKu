import { DEFAULT_SETTINGS } from '../utils/constants';

/**
 * Membuat ISO string relatif terhadap hari ini (daysAgo = 0 adalah hari ini)
 */
function daysAgoIso(daysAgo, hour = 9, minute = 30) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/**
 * Menghasilkan seluruh data awal untuk pedagang pasar "Bu Sari" - "Lapak Sayur Bu Sari"
 */
export function generateSeedData() {
  const settings = {
    ...DEFAULT_SETTINGS,
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

  // 12 Produk realistis pedagang sayur & sembako (3 di antaranya stok menipis)
  const products = [
    {
      id: 'prod-1',
      name: 'Bawang Merah Brebes',
      unit: 'kg',
      stock: 18,
      minStock: 5,
      buyPrice: 28000,
      sellPrice: 35000
    },
    {
      id: 'prod-2',
      name: 'Bawang Putih Kating',
      unit: 'kg',
      stock: 14,
      minStock: 5,
      buyPrice: 32000,
      sellPrice: 40000
    },
    {
      id: 'prod-3',
      name: 'Cabai Rawit Merah',
      unit: 'kg',
      stock: 2, // Menipis (<= 4)
      minStock: 4,
      buyPrice: 45000,
      sellPrice: 58000
    },
    {
      id: 'prod-4',
      name: 'Cabai Merah Keriting',
      unit: 'kg',
      stock: 9,
      minStock: 3,
      buyPrice: 36000,
      sellPrice: 46000
    },
    {
      id: 'prod-5',
      name: 'Tomat Sayur Segar',
      unit: 'kg',
      stock: 15,
      minStock: 5,
      buyPrice: 10000,
      sellPrice: 14000
    },
    {
      id: 'prod-6',
      name: 'Kentang Dieng Super',
      unit: 'kg',
      stock: 22,
      minStock: 6,
      buyPrice: 14000,
      sellPrice: 18000
    },
    {
      id: 'prod-7',
      name: 'Wortel Brastagi',
      unit: 'kg',
      stock: 12,
      minStock: 4,
      buyPrice: 11000,
      sellPrice: 15000
    },
    {
      id: 'prod-8',
      name: 'Bayam Hijau Segar',
      unit: 'ikat',
      stock: 3, // Menipis (<= 5)
      minStock: 5,
      buyPrice: 2000,
      sellPrice: 3500
    },
    {
      id: 'prod-9',
      name: 'Kangkung Akar',
      unit: 'ikat',
      stock: 16,
      minStock: 5,
      buyPrice: 2000,
      sellPrice: 3500
    },
    {
      id: 'prod-10',
      name: 'Telur Ayam Negeri',
      unit: 'butir',
      stock: 18, // Menipis (<= 30)
      minStock: 30,
      buyPrice: 1700,
      sellPrice: 2200
    },
    {
      id: 'prod-11',
      name: 'Beras Medium Pulen',
      unit: 'kg',
      stock: 45,
      minStock: 15,
      buyPrice: 12500,
      sellPrice: 14500
    },
    {
      id: 'prod-12',
      name: 'Minyak Goreng Kemasan',
      unit: 'liter',
      stock: 12,
      minStock: 4,
      buyPrice: 15000,
      sellPrice: 17500
    }
  ];

  // 5 Piutang pelanggan & 3 Utang ke supplier
  const debts = [
    {
      id: 'debt-1',
      type: 'piutang',
      party: 'Warung Makan Bu Tejo',
      phone: '081322445566',
      total: 185000,
      paid: 85000,
      dueDate: daysAgoIso(-2, 12, 0),
      note: 'Ambil cabai, bawang, dan tomat untuk katering',
      createdAt: daysAgoIso(5, 8, 15),
      history: [
        {
          id: 'hist-1',
          amount: 85000,
          date: daysAgoIso(2, 10, 0),
          note: 'Cicilan pertama tunai',
          txId: 'tx-seed-kasbon-1'
        }
      ]
    },
    {
      id: 'debt-2',
      type: 'piutang',
      party: 'Pak RT Slamet',
      phone: '081298765432',
      total: 95000,
      paid: 0,
      dueDate: daysAgoIso(3, 12, 0),
      note: 'Beras 5kg dan minyak 2 liter',
      createdAt: daysAgoIso(9, 9, 20),
      history: []
    },
    {
      id: 'debt-3',
      type: 'piutang',
      party: 'Mbak Yuni Bakso',
      phone: '085711223344',
      total: 140000,
      paid: 50000,
      dueDate: daysAgoIso(1, 12, 0),
      note: 'Bawang merah 2kg, cabai rawit 1kg, kol',
      createdAt: daysAgoIso(6, 7, 45),
      history: [
        {
          id: 'hist-2',
          amount: 50000,
          date: daysAgoIso(3, 11, 0),
          note: 'Titip uang lewat anak',
          txId: 'tx-seed-kasbon-2'
        }
      ]
    },
    {
      id: 'debt-4',
      type: 'piutang',
      party: 'Bu Haji Ningsih',
      phone: '081122334455',
      total: 120000,
      paid: 120000,
      dueDate: daysAgoIso(4, 12, 0),
      note: 'Belanja sayur pengajian',
      createdAt: daysAgoIso(10, 8, 0),
      history: [
        {
          id: 'hist-3',
          amount: 120000,
          date: daysAgoIso(5, 9, 30),
          note: 'Lunas langsung di lapak',
          txId: 'tx-seed-kasbon-3'
        }
      ]
    },
    {
      id: 'debt-5',
      type: 'piutang',
      party: 'Kang Dedi Gorengan',
      phone: '087855667788',
      total: 70000,
      paid: 0,
      dueDate: daysAgoIso(-4, 12, 0),
      note: 'Minyak goreng 4 liter',
      createdAt: daysAgoIso(1, 10, 15),
      history: []
    },
    {
      id: 'debt-6',
      type: 'utang',
      party: 'Juragan Sayur Pak H. Karno',
      phone: '081233344455',
      total: 650000,
      paid: 300000,
      dueDate: daysAgoIso(-3, 12, 0),
      note: 'Kulakan kentang, wortel, dan bawang',
      createdAt: daysAgoIso(7, 5, 30),
      history: [
        {
          id: 'hist-4',
          amount: 300000,
          date: daysAgoIso(3, 13, 0),
          note: 'Setor sebagian sore hari',
          txId: 'tx-seed-utang-1'
        }
      ]
    },
    {
      id: 'debt-7',
      type: 'utang',
      party: 'Agen Sembako Sumber Makmur',
      phone: '081566778899',
      total: 500000,
      paid: 0,
      dueDate: daysAgoIso(2, 12, 0),
      note: 'Beras 1 karung & minyak goreng 1 dus',
      createdAt: daysAgoIso(8, 6, 0),
      history: []
    },
    {
      id: 'debt-8',
      type: 'utang',
      party: 'Peternak Telur Mas Wahyu',
      phone: '085244332211',
      total: 250000,
      paid: 250000,
      dueDate: daysAgoIso(5, 12, 0),
      note: 'Telur ayam 1 peti',
      createdAt: daysAgoIso(12, 6, 30),
      history: [
        {
          id: 'hist-5',
          amount: 250000,
          date: daysAgoIso(6, 12, 0),
          note: 'Dibayar lunas saat kiriman baru',
          txId: 'tx-seed-utang-2'
        }
      ]
    }
  ];

  // 36 Transaksi tersebar dalam 30 hari terakhir (termasuk hari ini dan kemarin)
  const transactions = [
    {
      id: 'tx-1',
      type: 'in',
      amount: 165000,
      category: 'Penjualan',
      note: 'Penjualan sayur pagi (bawang, cabai, bayam, tomat)',
      date: daysAgoIso(0, 7, 15)
    },
    {
      id: 'tx-2',
      type: 'in',
      amount: 145000,
      category: 'Penjualan',
      note: 'Langganan warung beli beras 5kg & telur 2kg',
      date: daysAgoIso(0, 9, 40)
    },
    {
      id: 'tx-3',
      type: 'out',
      amount: 95000,
      category: 'Belanja modal',
      note: 'Tambah bayam, kangkung, dan tomat pagi',
      date: daysAgoIso(0, 5, 45)
    },
    {
      id: 'tx-4',
      type: 'out',
      amount: 5000,
      category: 'Retribusi pasar',
      note: 'Karcis kebersihan & keamanan pasar',
      date: daysAgoIso(0, 8, 30)
    },
    {
      id: 'tx-5',
      type: 'in',
      amount: 340000,
      category: 'Penjualan',
      note: 'Penjualan harian sayur & sembako ramai',
      date: daysAgoIso(1, 11, 20)
    },
    {
      id: 'tx-6',
      type: 'out',
      amount: 140000,
      category: 'Belanja modal',
      note: 'Kulakan cabai merah & kentang',
      date: daysAgoIso(1, 6, 0)
    },
    {
      id: 'tx-7',
      type: 'out',
      amount: 15000,
      category: 'Ongkos/transport',
      note: 'Ongkos becak angkut barang',
      date: daysAgoIso(1, 6, 30)
    },
    {
      id: 'tx-8',
      type: 'out',
      amount: 25000,
      category: 'Pribadi (prive)',
      note: 'Ambil uang kas untuk beli makan & pulsa',
      date: daysAgoIso(1, 13, 10)
    },
    {
      id: 'tx-9',
      type: 'in',
      amount: 275000,
      category: 'Penjualan',
      note: 'Penjualan sayur pagi sampai siang',
      date: daysAgoIso(2, 11, 45)
    },
    {
      id: 'tx-seed-kasbon-1',
      type: 'in',
      amount: 85000,
      category: 'Bayar kasbon',
      note: 'Cicilan kasbon: Warung Makan Bu Tejo',
      date: daysAgoIso(2, 10, 0),
      refId: 'debt-1'
    },
    {
      id: 'tx-10',
      type: 'out',
      amount: 160000,
      category: 'Belanja modal',
      note: 'Belanja bawang merah & putih',
      date: daysAgoIso(2, 5, 50)
    },
    {
      id: 'tx-11',
      type: 'in',
      amount: 290000,
      category: 'Penjualan',
      note: 'Penjualan harian lapak',
      date: daysAgoIso(3, 12, 0)
    },
    {
      id: 'tx-seed-kasbon-2',
      type: 'in',
      amount: 50000,
      category: 'Bayar kasbon',
      note: 'Cicilan kasbon: Mbak Yuni Bakso',
      date: daysAgoIso(3, 11, 0),
      refId: 'debt-3'
    },
    {
      id: 'tx-seed-utang-1',
      type: 'out',
      amount: 300000,
      category: 'Bayar utang',
      note: 'Bayar utang: Juragan Sayur Pak H. Karno',
      date: daysAgoIso(3, 13, 0),
      refId: 'debt-6'
    },
    {
      id: 'tx-12',
      type: 'in',
      amount: 310000,
      category: 'Penjualan',
      note: 'Penjualan sayur & minyak goreng',
      date: daysAgoIso(4, 11, 30)
    },
    {
      id: 'tx-13',
      type: 'out',
      amount: 135000,
      category: 'Belanja modal',
      note: 'Stok ulang sayur daun & tomat',
      date: daysAgoIso(4, 6, 10)
    },
    {
      id: 'tx-14',
      type: 'out',
      amount: 15000,
      category: 'Listrik/es',
      note: 'Iuran lampu lapak & plastik es',
      date: daysAgoIso(4, 9, 0)
    },
    {
      id: 'tx-15',
      type: 'in',
      amount: 260000,
      category: 'Penjualan',
      note: 'Penjualan harian cerah',
      date: daysAgoIso(5, 11, 0)
    },
    {
      id: 'tx-seed-kasbon-3',
      type: 'in',
      amount: 120000,
      category: 'Bayar kasbon',
      note: 'Pelunasan kasbon: Bu Haji Ningsih',
      date: daysAgoIso(5, 9, 30),
      refId: 'debt-4'
    },
    {
      id: 'tx-16',
      type: 'out',
      amount: 180000,
      category: 'Belanja modal',
      note: 'Kulakan beras & telur',
      date: daysAgoIso(5, 6, 15)
    },
    {
      id: 'tx-17',
      type: 'in',
      amount: 385000,
      category: 'Penjualan',
      note: 'Pasar ramai akhir pekan',
      date: daysAgoIso(6, 12, 10)
    },
    {
      id: 'tx-seed-utang-2',
      type: 'out',
      amount: 250000,
      category: 'Bayar utang',
      note: 'Bayar utang: Peternak Telur Mas Wahyu',
      date: daysAgoIso(6, 12, 0),
      refId: 'debt-8'
    },
    {
      id: 'tx-18',
      type: 'in',
      amount: 320000,
      category: 'Penjualan',
      note: 'Penjualan sayur dan bumbu dapur',
      date: daysAgoIso(8, 11, 0)
    },
    {
      id: 'tx-19',
      type: 'out',
      amount: 175000,
      category: 'Belanja modal',
      note: 'Kulakan sayur mayur segar',
      date: daysAgoIso(8, 5, 45)
    },
    {
      id: 'tx-20',
      type: 'in',
      amount: 295000,
      category: 'Penjualan',
      note: 'Penjualan harian reguler',
      date: daysAgoIso(10, 11, 30)
    },
    {
      id: 'tx-21',
      type: 'out',
      amount: 150000,
      category: 'Belanja modal',
      note: 'Belanja bawang & cabai',
      date: daysAgoIso(10, 6, 0)
    },
    {
      id: 'tx-22',
      type: 'out',
      amount: 50000,
      category: 'Gaji karyawan',
      note: 'Upah bantu angkat & kupas bawang (Kang Ujang)',
      date: daysAgoIso(11, 13, 0)
    },
    {
      id: 'tx-23',
      type: 'in',
      amount: 360000,
      category: 'Penjualan',
      note: 'Penjualan ramai pelanggan katering',
      date: daysAgoIso(13, 12, 0)
    },
    {
      id: 'tx-24',
      type: 'out',
      amount: 210000,
      category: 'Belanja modal',
      note: 'Belanja sembako & minyak goreng',
      date: daysAgoIso(13, 6, 20)
    },
    {
      id: 'tx-25',
      type: 'in',
      amount: 280000,
      category: 'Penjualan',
      note: 'Penjualan harian sayur',
      date: daysAgoIso(16, 11, 45)
    },
    {
      id: 'tx-26',
      type: 'out',
      amount: 140000,
      category: 'Belanja modal',
      note: 'Kulakan wortel, kentang, tomat',
      date: daysAgoIso(16, 6, 0)
    },
    {
      id: 'tx-27',
      type: 'in',
      amount: 335000,
      category: 'Penjualan',
      note: 'Penjualan sembako & telur',
      date: daysAgoIso(19, 11, 15)
    },
    {
      id: 'tx-28',
      type: 'out',
      amount: 190000,
      category: 'Belanja modal',
      note: 'Belanja stok mingguan',
      date: daysAgoIso(19, 5, 50)
    },
    {
      id: 'tx-29',
      type: 'out',
      amount: 40000,
      category: 'Pribadi (prive)',
      note: 'Keperluan sekolah anak',
      date: daysAgoIso(21, 14, 0)
    },
    {
      id: 'tx-30',
      type: 'in',
      amount: 315000,
      category: 'Penjualan',
      note: 'Penjualan sayur mayur',
      date: daysAgoIso(23, 11, 30)
    },
    {
      id: 'tx-31',
      type: 'out',
      amount: 165000,
      category: 'Belanja modal',
      note: 'Belanja modal pasar induk',
      date: daysAgoIso(23, 5, 30)
    },
    {
      id: 'tx-32',
      type: 'in',
      amount: 350000,
      category: 'Penjualan',
      note: 'Penjualan awal bulan ramai',
      date: daysAgoIso(26, 12, 0)
    },
    {
      id: 'tx-33',
      type: 'out',
      amount: 195000,
      category: 'Belanja modal',
      note: 'Kulakan beras, cabai, dan bawang',
      date: daysAgoIso(26, 6, 0)
    }
  ];

  // Catatan barang susut/busuk
  const wasteLogs = [
    {
      id: 'waste-1',
      productId: 'prod-5',
      qty: 1,
      date: daysAgoIso(1, 14, 0),
      reason: 'Busuk / Layu'
    },
    {
      id: 'waste-2',
      productId: 'prod-8',
      qty: 2,
      date: daysAgoIso(3, 13, 30),
      reason: 'Busuk / Layu'
    },
    {
      id: 'waste-3',
      productId: 'prod-10',
      qty: 4,
      date: daysAgoIso(5, 11, 15),
      reason: 'Rusak / Pecah'
    }
  ];

  return {
    settings,
    products,
    debts,
    transactions,
    wasteLogs
  };
}

