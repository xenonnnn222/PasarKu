import { inTransaction } from '../db.js';
import { HttpError, fail } from '../errors.js';
import { DEBT_TYPES, date, money, oneOf, optionalText, paginate, text, today, whatsappNumber } from '../domain.js';
import { createTransaction } from './transactions.js';

const PER_PAGE = 12;

export function validateDebt(input) {
  return {
    type: oneOf(input.type, DEBT_TYPES, { field: 'type', label: 'Jenis kasbon' }),
    party: text(input.party, { field: 'party', label: 'Nama pihak', max: 150 }),
    phone: optionalText(input.phone, { field: 'phone', label: 'Nomor HP', max: 25 }),
    total: money(input.total, { field: 'total', label: 'Total kasbon', min: 1 }),
    due_date: date(input.due_date, { field: 'due_date', label: 'Jatuh tempo' }),
    note: optionalText(input.note, { field: 'note', label: 'Catatan', max: 1000 }),
  };
}

function getOwnDebt(db, userId, id) {
  const row = db.prepare('SELECT * FROM debts WHERE id = ? AND user_id = ?').get(id, userId);
  if (!row) throw new HttpError(404, 'Kasbon tidak ditemukan.');
  return row;
}

/** Menambahkan nilai turunan: sisa, status, dan nomor WhatsApp. */
function decorate(row, payments) {
  const remaining = Math.max(0, row.total - row.paid);
  let status = 'Belum lunas';
  if (remaining === 0) status = 'Lunas';
  else if (row.due_date < today()) status = 'Terlambat';

  return {
    ...row,
    remaining,
    status,
    whatsapp: row.type === 'piutang' && remaining > 0 ? whatsappNumber(row.phone) : null,
    payments,
  };
}

export function listDebts(db, userId, query) {
  const q = String(query.q ?? '').trim().slice(0, 100);
  const type = DEBT_TYPES.includes(query.type) ? query.type : '';
  const status = ['open', 'paid', 'overdue'].includes(query.status) ? query.status : '';

  const where = ['user_id = ?'];
  const params = [userId];

  if (q) {
    where.push('party LIKE ?');
    params.push(`%${q}%`);
  }
  if (type) {
    where.push('type = ?');
    params.push(type);
  }
  if (status === 'paid') where.push('paid >= total');
  if (status === 'open' || status === 'overdue') where.push('paid < total');
  if (status === 'overdue') {
    where.push('due_date < ?');
    params.push(today());
  }

  const whereSql = where.join(' AND ');
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM debts WHERE ${whereSql}`).get(...params);
  const pager = paginate(total, PER_PAGE, query.page);

  const paymentStmt = db.prepare('SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY paid_at DESC, id DESC');
  const rows = db
    .prepare(`SELECT * FROM debts WHERE ${whereSql} ORDER BY due_date ASC, id ASC LIMIT ? OFFSET ?`)
    .all(...params, pager.perPage, pager.offset)
    .map((row) => decorate(row, paymentStmt.all(row.id)));

  const balances = { piutang: 0, utang: 0 };
  for (const row of db
    .prepare(
      'SELECT type, COALESCE(SUM(CASE WHEN total > paid THEN total - paid ELSE 0 END), 0) AS remaining FROM debts WHERE user_id = ? GROUP BY type',
    )
    .all(userId)) {
    balances[row.type] = row.remaining;
  }

  return { rows, total, pager, balances, filters: { q, type, status } };
}

export function createDebt(db, userId, input) {
  const data = validateDebt(input);
  db.prepare(
    `INSERT INTO debts (user_id, type, party, phone, total, paid, due_date, note, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
  ).run(userId, data.type, data.party, data.phone, data.total, data.due_date, data.note, Math.floor(Date.now() / 1000));
}

export function updateDebt(db, userId, id, input) {
  const row = getOwnDebt(db, userId, id);
  const data = validateDebt(input);

  if (data.total < row.paid) {
    fail('Total tidak boleh lebih kecil dari pembayaran yang sudah dicatat.', 'total');
  }
  if (row.paid > 0 && row.type !== data.type) {
    fail('Jenis kasbon yang sudah dibayar tidak dapat diganti.', 'type');
  }

  db.prepare(
    'UPDATE debts SET type = ?, party = ?, phone = ?, total = ?, due_date = ?, note = ? WHERE id = ?',
  ).run(data.type, data.party, data.phone, data.total, data.due_date, data.note, row.id);
}

/** Mencatat cicilan: membuat transaksi kas dan riwayat pembayaran dalam satu transaksi database. */
export function payDebt(db, userId, id, input) {
  return inTransaction(db, () => {
    const row = getOwnDebt(db, userId, id);
    const amount = money(input.amount, { field: 'amount', label: 'Jumlah pembayaran', min: 1 });
    const paidAt = date(input.paid_at, { field: 'paid_at', label: 'Tanggal pembayaran' });
    const note = optionalText(input.note, { field: 'note', label: 'Catatan', max: 1000 });

    const remaining = Math.max(0, row.total - row.paid);
    if (amount > remaining) fail('Pembayaran melebihi sisa kasbon.', 'amount');

    const income = row.type === 'piutang';
    const txId = createTransaction(
      db,
      userId,
      {
        type: income ? 'in' : 'out',
        amount,
        category: income ? 'Bayar kasbon' : 'Bayar utang',
        note: note || `Pembayaran: ${row.party}`,
        occurred_on: paidAt,
      },
      { source: 'debt_payment', debtId: row.id },
    );

    db.prepare('INSERT INTO debt_payments (debt_id, transaction_id, amount, paid_at, note) VALUES (?, ?, ?, ?, ?)').run(
      row.id,
      txId,
      amount,
      paidAt,
      note,
    );
    db.prepare('UPDATE debts SET paid = paid + ? WHERE id = ?').run(amount, row.id);
  });
}

export function deleteDebt(db, userId, id) {
  const row = getOwnDebt(db, userId, id);
  if (row.paid > 0) {
    fail('Kasbon dengan pembayaran tidak dapat dihapus agar riwayat kas tetap utuh.', 'debt');
  }
  db.prepare('DELETE FROM debts WHERE id = ?').run(row.id);
}
