import { inTransaction } from '../db.js';
import { HttpError, fail } from '../errors.js';
import { MAX_MONEY, UNITS, WASTE_REASONS, decimal, money, oneOf, paginate, round2, text, today } from '../domain.js';
import { createTransaction } from './transactions.js';

const PER_PAGE = 12;
const SORTS = {
  name: 'name ASC, id ASC',
  stock: 'stock ASC, id ASC',
  buy_price: 'buy_price ASC, id ASC',
  sell_price: 'sell_price ASC, id ASC',
};

export function validateProduct(input) {
  return {
    name: text(input.name, { field: 'name', label: 'Nama barang', max: 150 }),
    unit: oneOf(input.unit, UNITS, { field: 'unit', label: 'Satuan' }),
    stock: decimal(input.stock, { field: 'stock', label: 'Stok' }),
    min_stock: decimal(input.min_stock, { field: 'min_stock', label: 'Stok minimum' }),
    buy_price: money(input.buy_price, { field: 'buy_price', label: 'Harga beli' }),
    sell_price: money(input.sell_price, { field: 'sell_price', label: 'Harga jual' }),
  };
}

export function getOwnProduct(db, userId, id) {
  const row = db.prepare('SELECT * FROM products WHERE id = ? AND user_id = ?').get(id, userId);
  if (!row) throw new HttpError(404, 'Barang tidak ditemukan.');
  return row;
}

export function productStatus(product) {
  if (product.stock <= 0) return 'Habis';
  return product.stock <= product.min_stock ? 'Menipis' : 'Cukup';
}

export function listProducts(db, userId, query) {
  const q = String(query.q ?? '').trim().slice(0, 100);
  const low = query.low === '1' || query.low === 'on' || query.low === 'true';
  const sort = Object.hasOwn(SORTS, query.sort) ? query.sort : 'name';

  const where = ['user_id = ?'];
  const params = [userId];
  if (q) {
    where.push('name LIKE ?');
    params.push(`%${q}%`);
  }
  if (low) where.push('stock <= min_stock');
  const whereSql = where.join(' AND ');

  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM products WHERE ${whereSql}`).get(...params);
  const pager = paginate(total, PER_PAGE, query.page);
  const rows = db
    .prepare(`SELECT * FROM products WHERE ${whereSql} ORDER BY ${SORTS[sort]} LIMIT ? OFFSET ?`)
    .all(...params, pager.perPage, pager.offset);

  const stats = db
    .prepare(
      `SELECT COUNT(*) AS types,
              COALESCE(SUM(ROUND(stock * buy_price)), 0) AS value,
              COALESCE(SUM(CASE WHEN stock <= min_stock THEN 1 ELSE 0 END), 0) AS low
       FROM products WHERE user_id = ?`,
    )
    .get(userId);

  const wasteLogs = db
    .prepare(
      `SELECT w.*, p.name AS product_name FROM waste_logs w
       LEFT JOIN products p ON p.id = w.product_id
       WHERE w.user_id = ? ORDER BY w.id DESC LIMIT 8`,
    )
    .all(userId);

  return {
    rows,
    pager,
    filters: { q, low, sort },
    stats: { types: stats.types, value: Math.round(stats.value), low: stats.low },
    wasteLogs,
  };
}

export function createProduct(db, userId, input) {
  const data = validateProduct(input);
  db.prepare(
    `INSERT INTO products (user_id, name, unit, stock, min_stock, buy_price, sell_price)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(userId, data.name, data.unit, data.stock, data.min_stock, data.buy_price, data.sell_price);
}

/** Stok tidak diubah dari form edit. Perubahan stok harus lewat stok masuk, susut, atau sesuaikan. */
export function updateProduct(db, userId, id, input) {
  const row = getOwnProduct(db, userId, id);
  const { stock, ...data } = validateProduct(input);
  void stock;

  db.prepare(
    'UPDATE products SET name = ?, unit = ?, min_stock = ?, buy_price = ?, sell_price = ? WHERE id = ?',
  ).run(data.name, data.unit, data.min_stock, data.buy_price, data.sell_price, row.id);
}

export function adjustStock(db, userId, id, delta) {
  const row = getOwnProduct(db, userId, id);
  const step = Number(delta);
  if (step !== 1 && step !== -1) fail('Perubahan stok tidak valid.', 'stock');

  const next = round2(row.stock + step);
  if (next < 0) fail('Stok tidak boleh negatif.', 'stock');

  db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(next, row.id);
}

export function restock(db, userId, id, input, recordExpense) {
  return inTransaction(db, () => {
    const row = getOwnProduct(db, userId, id);
    const qty = decimal(input.qty, { field: 'qty', label: 'Jumlah', positive: true });
    const buyPrice = money(input.buy_price, { field: 'buy_price', label: 'Harga beli' });

    const stock = round2(row.stock + qty);
    const cost = Math.round(qty * buyPrice);
    if (stock > 10_000_000 || cost > MAX_MONEY) {
      fail('Jumlah stok atau nilai pembelian terlalu besar.', 'qty');
    }

    db.prepare('UPDATE products SET stock = ?, buy_price = ? WHERE id = ?').run(stock, buyPrice, row.id);

    if (recordExpense && cost > 0) {
      createTransaction(
        db,
        userId,
        {
          type: 'out',
          amount: cost,
          category: 'Belanja modal',
          note: `Kulakan ${row.name} (${qty} ${row.unit})`,
          occurred_on: today(),
        },
        { source: 'restock' },
      );
    }
  });
}

export function recordWaste(db, userId, id, input) {
  return inTransaction(db, () => {
    const row = getOwnProduct(db, userId, id);
    const qty = decimal(input.qty, { field: 'qty', label: 'Jumlah', positive: true });
    const reason = oneOf(input.reason, WASTE_REASONS, { field: 'reason', label: 'Alasan' });

    if (qty > row.stock) fail('Barang susut melebihi stok tersedia.', 'qty');

    const cost = Math.round(qty * row.buy_price);
    if (cost > MAX_MONEY) fail('Nilai barang susut terlalu besar.', 'qty');

    db.prepare(
      'INSERT INTO waste_logs (user_id, product_id, qty, reason, cost, occurred_on) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(userId, row.id, qty, reason, cost, today());
    db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(round2(row.stock - qty), row.id);
  });
}

export function deleteProduct(db, userId, id) {
  const row = getOwnProduct(db, userId, id);
  db.prepare('DELETE FROM products WHERE id = ?').run(row.id);
}
