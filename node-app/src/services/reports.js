import { fail } from '../errors.js';
import { addDays, isDate, monthRange, summarize, today, weekStart } from '../domain.js';
import { transactionsBetween } from './transactions.js';

const MAX_RANGE_DAYS = 366;

/** Menentukan rentang tanggal laporan dari periode, pergeseran, atau rentang manual. */
export function resolveRange(query) {
  const period = ['day', 'week', 'month'].includes(query.period) ? query.period : 'week';
  const offset = Math.max(-120, Math.min(120, Number.parseInt(query.offset, 10) || 0));
  const anchor = today();

  let from;
  let to;
  if (period === 'day') {
    from = addDays(anchor, offset);
    to = from;
  } else if (period === 'month') {
    const [y, m] = anchor.split('-').map(Number);
    [from, to] = monthRange(y, m - 1 + offset);
  } else {
    from = addDays(weekStart(anchor), offset * 7);
    to = addDays(from, 6);
  }

  if (isDate(query.from)) from = query.from;
  if (isDate(query.to)) to = query.to;

  const days = (new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000;
  if (from > to || days > MAX_RANGE_DAYS) {
    fail(`Rentang tanggal harus berurutan, maksimal ${MAX_RANGE_DAYS} hari.`, 'from');
  }

  return { period, offset, from, to };
}

export function buildReport(db, userId, query) {
  const range = resolveRange(query);
  const transactions = transactionsBetween(db, userId, range.from, range.to);

  const dayList = [];
  for (let date = range.from; date <= range.to; date = addDays(date, 1)) {
    dayList.push({
      date,
      ...summarize(transactions.filter((t) => t.occurred_on === date)),
    });
  }

  const categories = new Map();
  for (const t of transactions) {
    if (t.type !== 'out') continue;
    categories.set(t.category, (categories.get(t.category) ?? 0) + t.amount);
  }

  const { waste } = db
    .prepare(
      'SELECT COALESCE(SUM(cost), 0) AS waste FROM waste_logs WHERE user_id = ? AND occurred_on >= ? AND occurred_on <= ?',
    )
    .get(userId, range.from, range.to);

  return {
    ...range,
    transactions,
    days: dayList,
    categories: [...categories.entries()].sort((a, b) => b[1] - a[1]),
    wasteCost: waste,
    summary: summarize(transactions),
  };
}

/** Baris CSV. Nilai yang diawali =, +, -, @ diberi apostrof agar tidak dianggap rumus. */
export function reportCsv(report) {
  const escape = (value) => {
    let s = value === null || value === undefined ? '' : String(value);
    if (/^\s*[=+@-]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [['Tanggal', 'Jenis', 'Kategori', 'Catatan', 'Uang masuk', 'Uang keluar'].map(escape).join(',')];
  for (const t of report.transactions) {
    const isIn = t.type === 'in';
    lines.push(
      [
        t.occurred_on,
        isIn ? 'Masuk' : 'Keluar',
        t.category,
        t.note,
        isIn ? t.amount : 0,
        isIn ? 0 : t.amount,
      ]
        .map(escape)
        .join(','),
    );
  }

  return `﻿${lines.join('\r\n')}\r\n`;
}

/** Ringkasan beranda: transaksi hari ini, 7 hari terakhir, dan peringatan. */
export function dashboard(db, userId, cashBalanceFn) {
  const now = today();
  const weekAgo = addDays(now, -6);
  const week = transactionsBetween(db, userId, weekAgo, now);

  const chart = [];
  for (let ago = 6; ago >= 0; ago--) {
    const date = addDays(now, -ago);
    chart.push({ date, ...summarize(week.filter((t) => t.occurred_on === date)) });
  }

  const todayRows = week.filter((t) => t.occurred_on === now);
  const recent = db
    .prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY occurred_on DESC, id DESC LIMIT 8')
    .all(userId);

  const lowStock = db
    .prepare('SELECT COUNT(*) AS n FROM products WHERE user_id = ? AND stock <= min_stock')
    .get(userId).n;
  const overdue = db
    .prepare('SELECT COUNT(*) AS n FROM debts WHERE user_id = ? AND paid < total AND due_date < ?')
    .get(userId, now).n;
  const { receivable } = db
    .prepare("SELECT COALESCE(SUM(total - paid), 0) AS receivable FROM debts WHERE user_id = ? AND type = 'piutang'")
    .get(userId);

  return {
    cash: cashBalanceFn(db, userId),
    today: summarize(todayRows),
    chart,
    recent,
    lowStock,
    overdue,
    receivable,
  };
}
