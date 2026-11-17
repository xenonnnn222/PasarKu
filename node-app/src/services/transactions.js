import { HttpError, fail } from '../errors.js';
import { EXPENSE, INCOME, TRANSACTION_TYPES, date, isDate, money, oneOf, optionalText, paginate } from '../domain.js';

const CATEGORIES = { in: INCOME, out: EXPENSE };
const PER_PAGE = 15;

export function validateTransaction(input) {
  const type = oneOf(input.type, TRANSACTION_TYPES, { field: 'type', label: 'Jenis transaksi' });
  return {
    type,
    amount: money(input.amount, { field: 'amount', label: 'Nominal', min: 1 }),
    category: oneOf(input.category, CATEGORIES[type], { field: 'category', label: 'Kategori' }),
    note: optionalText(input.note, { field: 'note', label: 'Catatan', max: 1000 }),
    occurred_on: date(input.occurred_on, { field: 'occurred_on', label: 'Tanggal' }),
  };
}

export function createTransaction(db, userId, data, { source = 'manual', debtId = null, createdAt } = {}) {
  const info = db
    .prepare(
      `INSERT INTO transactions (user_id, debt_id, source, type, amount, category, note, occurred_on, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      userId,
      debtId,
      source,
      data.type,
      data.amount,
      data.category,
      data.note ?? null,
      data.occurred_on,
      createdAt ?? Math.floor(Date.now() / 1000),
    );
  return Number(info.lastInsertRowid);
}

export function getOwnTransaction(db, userId, id) {
  const row = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(id, userId);
  if (!row) throw new HttpError(404, 'Transaksi tidak ditemukan.');
  return row;
}

/** Transaksi otomatis (kasbon atau kulakan) hanya bisa diubah dari halamannya sendiri. */
function assertManual(row) {
  if (row.source !== 'manual') {
    throw new HttpError(422, 'Transaksi otomatis hanya dapat diubah dari halaman kasbon atau stok.');
  }
}

export function listTransactions(db, userId, query) {
  const q = String(query.q ?? '').trim().slice(0, 100);
  const type = TRANSACTION_TYPES.includes(query.type) ? query.type : '';
  const from = isDate(query.from) ? query.from : '';
  const to = isDate(query.to) ? query.to : '';
  const sort = ['newest', 'oldest', 'largest', 'smallest'].includes(query.sort) ? query.sort : 'newest';

  const where = ['user_id = ?'];
  const params = [userId];

  if (q) {
    where.push('(note LIKE ? OR category LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (type) {
    where.push('type = ?');
    params.push(type);
  }
  if (from) {
    where.push('occurred_on >= ?');
    params.push(from);
  }
  if (to) {
    where.push('occurred_on <= ?');
    params.push(to);
  }

  const order = {
    newest: 'occurred_on DESC, id DESC',
    oldest: 'occurred_on ASC, id ASC',
    largest: 'amount DESC, id DESC',
    smallest: 'amount ASC, id ASC',
  }[sort];

  const whereSql = where.join(' AND ');
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM transactions WHERE ${whereSql}`).get(...params);
  const pager = paginate(total, PER_PAGE, query.page);

  const rows = db
    .prepare(`SELECT * FROM transactions WHERE ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, pager.perPage, pager.offset);

  return { rows, total, pager, filters: { q, type, from, to, sort } };
}

export function updateTransaction(db, userId, id, input) {
  const row = getOwnTransaction(db, userId, id);
  assertManual(row);
  const data = validateTransaction(input);

  db.prepare(
    'UPDATE transactions SET type = ?, amount = ?, category = ?, note = ?, occurred_on = ? WHERE id = ?',
  ).run(data.type, data.amount, data.category, data.note, data.occurred_on, row.id);
}

export function deleteTransaction(db, userId, id) {
  const row = getOwnTransaction(db, userId, id);
  assertManual(row);
  db.prepare('DELETE FROM transactions WHERE id = ?').run(row.id);
}

/** Saldo kas: modal awal + uang masuk - uang keluar. */
export function cashBalance(db, userId) {
  const user = db.prepare('SELECT starting_cash FROM users WHERE id = ?').get(userId);
  const { net } = db
    .prepare(
      "SELECT COALESCE(SUM(CASE WHEN type = 'in' THEN amount ELSE -amount END), 0) AS net FROM transactions WHERE user_id = ?",
    )
    .get(userId);
  return user.starting_cash + net;
}

export function transactionsBetween(db, userId, from, to) {
  return db
    .prepare(
      'SELECT * FROM transactions WHERE user_id = ? AND occurred_on >= ? AND occurred_on <= ? ORDER BY occurred_on, id',
    )
    .all(userId, from, to);
}
