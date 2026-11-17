import { inTransaction } from '../db.js';
import { fail } from '../errors.js';
import {
  DEBT_TYPES,
  MAX_MONEY,
  TRANSACTION_TYPES,
  UNITS,
  addDays,
  decimal,
  isDate,
  money,
  oneOf,
  optionalText,
  text,
  today,
} from '../domain.js';

/**
 * Format cadangan JSON (schemaVersion 2) sama dengan versi Laravel sebelumnya,
 * sehingga file cadangan lama tetap bisa diimpor.
 */
export function exportBackup(db, userId) {
  const user = db.prepare('SELECT starting_cash, theme, font_size FROM users WHERE id = ?').get(userId);

  const transactions = db
    .prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY id')
    .all(userId)
    .map((t) => ({
      id: `tx-${t.id}`,
      source: t.source,
      type: t.type,
      amount: t.amount,
      category: t.category,
      note: t.note,
      date: t.occurred_on,
    }));

  const products = db
    .prepare('SELECT * FROM products WHERE user_id = ? ORDER BY id')
    .all(userId)
    .map((p) => ({
      id: `prod-${p.id}`,
      name: p.name,
      unit: p.unit,
      stock: p.stock,
      minStock: p.min_stock,
      buyPrice: p.buy_price,
      sellPrice: p.sell_price,
    }));

  const debtRows = db.prepare('SELECT * FROM debts WHERE user_id = ? ORDER BY id').all(userId);
  const paymentStmt = db.prepare('SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY id');
  const debts = debtRows.map((d) => ({
    id: `debt-${d.id}`,
    type: d.type,
    party: d.party,
    phone: d.phone,
    total: d.total,
    paid: d.paid,
    dueDate: d.due_date,
    note: d.note,
    history: paymentStmt.all(d.id).map((p) => ({
      amount: p.amount,
      date: p.paid_at,
      note: p.note,
      txId: p.transaction_id ? `tx-${p.transaction_id}` : null,
    })),
  }));

  const wasteLogs = db
    .prepare('SELECT * FROM waste_logs WHERE user_id = ? ORDER BY id')
    .all(userId)
    .map((w) => ({
      productId: w.product_id ? `prod-${w.product_id}` : null,
      qty: w.qty,
      reason: w.reason,
      date: w.occurred_on,
      cost: w.cost,
    }));

  return {
    schemaVersion: 2,
    settings: { startingCash: user.starting_cash, theme: user.theme, fontSize: user.font_size },
    transactions,
    products,
    debts,
    wasteLogs,
  };
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function list(value, max, field) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > max) fail(`Bagian ${field} tidak valid.`, 'import');
  return value;
}

function looseDate(value, field) {
  const s = String(value ?? '');
  const prefix = s.slice(0, 10);
  if (!isDate(prefix)) fail(`Tanggal pada ${field} tidak valid.`, 'import');
  return prefix;
}

/** Memvalidasi seluruh isi cadangan sebelum ada data yang ditulis. */
function validatePayload(payload) {
  const settings = isObject(payload.settings) ? payload.settings : {};
  const transactions = list(payload.transactions, 10000, 'transaksi');
  const products = list(payload.products, 10000, 'barang');
  const debts = list(payload.debts, 10000, 'kasbon');
  const wasteLogs = list(payload.wasteLogs, 10000, 'barang susut');

  const fields = {
    settings: {
      startingCash: settings.startingCash === undefined ? undefined : money(settings.startingCash, { field: 'import', label: 'Modal awal' }),
      theme: settings.theme === undefined ? undefined : oneOf(settings.theme, ['light', 'dark'], { field: 'import', label: 'Tema' }),
      fontSize: settings.fontSize === undefined ? undefined : oneOf(settings.fontSize, ['normal', 'large'], { field: 'import', label: 'Ukuran huruf' }),
    },
    transactions: transactions.map((t) => {
      if (!isObject(t)) fail('Transaksi pada cadangan tidak valid.', 'import');
      return {
        id: text(t.id, { field: 'import', label: 'ID transaksi', max: 100 }),
        source: t.source === 'restock' ? 'restock' : 'manual',
        type: oneOf(t.type, TRANSACTION_TYPES, { field: 'import', label: 'Jenis transaksi' }),
        amount: money(t.amount, { field: 'import', label: 'Nominal transaksi' }),
        category: text(t.category, { field: 'import', label: 'Kategori', max: 100 }),
        note: optionalText(t.note, { field: 'import', label: 'Catatan', max: 1000 }),
        date: looseDate(t.date, 'transaksi'),
      };
    }),
    products: products.map((p) => {
      if (!isObject(p)) fail('Barang pada cadangan tidak valid.', 'import');
      return {
        id: text(p.id, { field: 'import', label: 'ID barang', max: 100 }),
        name: text(p.name, { field: 'import', label: 'Nama barang', max: 150 }),
        unit: oneOf(p.unit, UNITS, { field: 'import', label: 'Satuan' }),
        stock: decimal(p.stock, { field: 'import', label: 'Stok' }),
        minStock: decimal(p.minStock, { field: 'import', label: 'Stok minimum' }),
        buyPrice: money(p.buyPrice, { field: 'import', label: 'Harga beli' }),
        sellPrice: money(p.sellPrice, { field: 'import', label: 'Harga jual' }),
      };
    }),
    debts: debts.map((d) => {
      if (!isObject(d)) fail('Kasbon pada cadangan tidak valid.', 'import');
      const history = list(d.history, 1000, 'riwayat kasbon');
      return {
        id: text(d.id, { field: 'import', label: 'ID kasbon', max: 100 }),
        type: oneOf(d.type, DEBT_TYPES, { field: 'import', label: 'Jenis kasbon' }),
        party: text(d.party, { field: 'import', label: 'Nama pihak', max: 150 }),
        phone: optionalText(d.phone, { field: 'import', label: 'Nomor HP', max: 25 }),
        total: money(d.total, { field: 'import', label: 'Total kasbon' }),
        paid: money(d.paid, { field: 'import', label: 'Sudah dibayar' }),
        dueDate: looseDate(d.dueDate, 'kasbon'),
        note: optionalText(d.note, { field: 'import', label: 'Catatan', max: 1000 }),
        history: history.map((h) => {
          if (!isObject(h)) fail('Riwayat pembayaran tidak valid.', 'import');
          return {
            amount: money(h.amount, { field: 'import', label: 'Jumlah pembayaran', min: 1 }),
            date: looseDate(h.date, 'riwayat'),
            note: optionalText(h.note, { field: 'import', label: 'Catatan', max: 1000 }),
            txId: h.txId ? text(h.txId, { field: 'import', label: 'ID transaksi', max: 100, required: false }) : null,
          };
        }),
      };
    }),
    wasteLogs: wasteLogs.map((w) => {
      if (!isObject(w)) fail('Data barang susut tidak valid.', 'import');
      return {
        productId: w.productId ? text(w.productId, { field: 'import', label: 'ID barang', max: 100 }) : null,
        qty: decimal(w.qty, { field: 'import', label: 'Jumlah susut', positive: true }),
        reason: text(w.reason ?? 'Lainnya', { field: 'import', label: 'Alasan', max: 100 }),
        date: looseDate(w.date, 'barang susut'),
        cost: w.cost === undefined ? undefined : money(w.cost, { field: 'import', label: 'Nilai susut' }),
      };
    }),
  };

  return fields;
}

function assertUnique(items, label) {
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item.id)) fail(`ID ${label} duplikat pada cadangan.`, 'import');
    seen.add(item.id);
  }
}

/**
 * Mengimpor cadangan ke akun yang masih kosong. Semua langkah berada dalam satu transaksi.
 */
export function importBackup(db, userId, payload) {
  const data = validatePayload(payload);
  assertUnique(data.transactions, 'transaksi');
  assertUnique(data.products, 'barang');
  assertUnique(data.debts, 'kasbon');

  return inTransaction(db, () => {
    const counts = db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM transactions WHERE user_id = ?) +
           (SELECT COUNT(*) FROM debts WHERE user_id = ?) +
           (SELECT COUNT(*) FROM products WHERE user_id = ?) +
           (SELECT COUNT(*) FROM waste_logs WHERE user_id = ?) AS total`,
      )
      .get(userId, userId, userId, userId);
    if (counts.total > 0) {
      fail('Impor hanya tersedia saat pembukuan kosong. Cadangkan dan kosongkan data akun ini terlebih dahulu.', 'import');
    }

    const now = Math.floor(Date.now() / 1000);
    const productIds = new Map();
    const debtIds = new Map();
    const txIds = new Map();

    const insertProduct = db.prepare(
      'INSERT INTO products (user_id, name, unit, stock, min_stock, buy_price, sell_price) VALUES (?,?,?,?,?,?,?)',
    );
    for (const p of data.products) {
      const info = insertProduct.run(userId, p.name, p.unit, p.stock, p.minStock, p.buyPrice, p.sellPrice);
      productIds.set(p.id, Number(info.lastInsertRowid));
    }

    const insertDebt = db.prepare(
      'INSERT INTO debts (user_id, type, party, phone, total, paid, due_date, note, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
    );
    for (const d of data.debts) {
      const paidFromHistory = d.history.reduce((sum, h) => sum + h.amount, 0);
      if (d.paid > d.total || paidFromHistory > d.paid) {
        fail('Jumlah pembayaran pada kasbon tidak konsisten. Data belum diimpor.', 'import');
      }
      const info = insertDebt.run(userId, d.type, d.party, d.phone, d.total, d.paid, d.dueDate, d.note, now);
      debtIds.set(d.id, Number(info.lastInsertRowid));
    }

    const insertTx = db.prepare(
      'INSERT INTO transactions (user_id, source, type, amount, category, note, occurred_on, created_at) VALUES (?,?,?,?,?,?,?,?)',
    );
    for (const t of data.transactions) {
      const info = insertTx.run(userId, t.source, t.type, t.amount, t.category, t.note, t.date, now);
      txIds.set(t.id, { id: Number(info.lastInsertRowid), type: t.type, amount: t.amount });
    }

    const linkTx = db.prepare("UPDATE transactions SET debt_id = ?, source = 'debt_payment' WHERE id = ?");
    const insertPayment = db.prepare(
      'INSERT INTO debt_payments (debt_id, transaction_id, amount, paid_at, note) VALUES (?,?,?,?,?)',
    );
    const usedTx = new Set();

    for (const d of data.debts) {
      const debtId = debtIds.get(d.id);
      const expectedType = d.type === 'piutang' ? 'in' : 'out';

      for (const h of d.history) {
        const tx = h.txId ? txIds.get(h.txId) : null;
        if (tx) {
          if (usedTx.has(tx.id) || tx.amount !== h.amount || tx.type !== expectedType) {
            fail('Referensi transaksi pembayaran tidak konsisten.', 'import');
          }
          usedTx.add(tx.id);
          linkTx.run(debtId, tx.id);
        }
        insertPayment.run(debtId, tx?.id ?? null, h.amount, h.date, h.note);
      }
    }

    const insertWaste = db.prepare(
      'INSERT INTO waste_logs (user_id, product_id, qty, reason, cost, occurred_on) VALUES (?,?,?,?,?,?)',
    );
    for (const w of data.wasteLogs) {
      const productId = w.productId ? productIds.get(w.productId) ?? null : null;
      const product = productId
        ? db.prepare('SELECT buy_price FROM products WHERE id = ?').get(productId)
        : null;
      const cost = w.cost ?? Math.round(w.qty * (product?.buy_price ?? 0));
      if (cost > MAX_MONEY) fail('Nilai barang susut terlalu besar.', 'import');
      insertWaste.run(userId, productId, w.qty, w.reason, Math.trunc(cost), w.date);
    }

    const s = data.settings;
    db.prepare(
      `UPDATE users SET
         starting_cash = COALESCE(?, starting_cash),
         theme = COALESCE(?, theme),
         font_size = COALESCE(?, font_size)
       WHERE id = ?`,
    ).run(s.startingCash ?? null, s.theme ?? null, s.fontSize ?? null, userId);

    return { now };
  });
}

/** Menghapus seluruh pembukuan akun (transaksi, kasbon, stok, susut). Pengaturan profil tetap. */
export function clearUserData(db, userId) {
  inTransaction(db, () => {
    db.prepare('DELETE FROM waste_logs WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM transactions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM debts WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM products WHERE user_id = ?').run(userId);
  });
}

/** Data contoh untuk akun demo. Tanggal dihitung relatif terhadap hari ini. */
export function demoPayload() {
  const catalog = [
    ['Bawang Merah Brebes', 'kg', 18, 5, 28000, 35000],
    ['Bawang Putih Kating', 'kg', 14, 5, 32000, 40000],
    ['Cabai Rawit Merah', 'kg', 2, 4, 45000, 58000],
    ['Cabai Merah Keriting', 'kg', 9, 3, 36000, 46000],
    ['Tomat Sayur Segar', 'kg', 15, 5, 10000, 14000],
    ['Kentang Dieng Super', 'kg', 22, 6, 14000, 18000],
    ['Wortel Brastagi', 'kg', 12, 4, 11000, 15000],
    ['Bayam Hijau Segar', 'ikat', 3, 5, 2000, 3500],
    ['Kangkung Akar', 'ikat', 16, 5, 2000, 3500],
    ['Telur Ayam Negeri', 'butir', 18, 30, 1700, 2200],
    ['Beras Medium Pulen', 'kg', 45, 15, 12500, 14500],
    ['Minyak Goreng Kemasan', 'liter', 12, 4, 15000, 17500],
  ];

  const products = catalog.map(([name, unit, stock, minStock, buyPrice, sellPrice], i) => ({
    id: `prod-${i}`,
    name,
    unit,
    stock,
    minStock,
    buyPrice,
    sellPrice,
  }));

  const transactions = [];
  const base = today();
  for (let day = 13; day >= 0; day--) {
    const date = addDays(base, -day);
    transactions.push(
      { id: `sale-${day}`, type: 'in', amount: 420000 + (day % 5) * 45000, category: 'Penjualan', note: 'Penjualan sayur dan sembako', date },
      { id: `buy-${day}`, type: 'out', amount: 230000 + (day % 4) * 20000, category: 'Belanja modal', note: 'Kulakan dagangan pagi', date },
      { id: `fee-${day}`, type: 'out', amount: 10000, category: 'Retribusi pasar', note: 'Iuran pasar harian', date },
    );
  }
  transactions.push(
    { id: 'prive', type: 'out', amount: 50000, category: 'Pribadi (prive)', note: 'Kebutuhan rumah tangga', date: base },
    { id: 'payment', type: 'in', amount: 85000, category: 'Bayar kasbon', note: 'Cicilan Bu Tejo', date: addDays(base, -2) },
  );

  const debtRows = [
    ['piutang', 'Warung Makan Bu Tejo', '081322445566', 185000, 85000, 2],
    ['piutang', 'Pak RT Slamet', '081298765432', 95000, 0, -3],
    ['piutang', 'Warung Bu Nanik', '081234560001', 120000, 0, 4],
    ['utang', 'Supplier Sayur Pak Joko', '081234560002', 750000, 0, 5],
  ];

  const debts = debtRows.map(([type, party, phone, total, paid, due], i) => ({
    id: `debt-${i}`,
    type,
    party,
    phone,
    total,
    paid,
    dueDate: addDays(base, due),
    note: 'Contoh catatan kasbon',
    history:
      i === 0
        ? [{ amount: 85000, date: addDays(base, -2), note: 'Cicilan pertama', txId: 'payment' }]
        : [],
  }));

  return {
    settings: { startingCash: 500000 },
    products,
    transactions,
    debts,
    wasteLogs: [
      { productId: 'prod-4', qty: 1.5, date: addDays(base, -1), reason: 'Busuk / Layu', cost: 15000 },
    ],
  };
}
