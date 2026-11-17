import { fail } from './errors.js';

export const MAX_MONEY = 1_000_000_000_000;
export const PRIVE = 'Pribadi (prive)';
export const DEBT_TYPES = ['piutang', 'utang'];
export const TRANSACTION_TYPES = ['in', 'out'];

export const INCOME = ['Penjualan', 'Bayar kasbon', 'Lain-lain'];
export const EXPENSE = [
  'Belanja modal',
  'Ongkos/transport',
  'Retribusi pasar',
  'Listrik/es',
  'Gaji karyawan',
  PRIVE,
  'Bayar utang',
  'Lain-lain',
];
export const UNITS = ['kg', 'ons', 'ikat', 'tumpuk', 'butir', 'karung', 'bungkus', 'liter', 'pcs'];
export const WASTE_REASONS = ['Busuk / Layu', 'Rusak / Pecah', 'Hilang / Tumpah', 'Lainnya'];

export const PHONE_RE = /^08[1-9][0-9]{7,10}$/;
export const PIN_RE = /^\d{4}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Mengubah nomor ke format 08xxxx (membuang karakter selain angka, 62 diubah ke 0). */
export function normalizePhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.startsWith('62') ? `0${digits.slice(2)}` : digits;
}

/** Nomor untuk tautan WhatsApp: 08xxxx menjadi 628xxxx. */
export function whatsappNumber(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (!digits) return null;
  return digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
}

export function isDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Tanggal hari ini menurut zona waktu server, format YYYY-MM-DD. */
export function ymd(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function today() {
  return ymd(new Date());
}

/** Menambah jumlah hari pada tanggal YYYY-MM-DD. */
export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return ymd(new Date(y, m - 1, d + days));
}

/** Senin pada minggu yang memuat tanggal tersebut. */
export function weekStart(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const weekday = new Date(y, m - 1, d).getDay();
  return addDays(dateStr, -(weekday === 0 ? 6 : weekday - 1));
}

export function monthRange(year, month) {
  const from = ymd(new Date(year, month, 1));
  const to = ymd(new Date(year, month + 1, 0));
  return [from, to];
}

export function rupiah(value) {
  const n = Math.round(Number(value) || 0);
  const sign = n < 0 ? '-' : '';
  return `${sign}Rp ${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

export function formatDate(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(y, m - 1, d),
  );
}

/** Ringkasan kas. Pengeluaran pribadi (prive) mengurangi kas, tetapi bukan biaya usaha. */
export function summarize(rows) {
  let income = 0;
  let expense = 0;
  let prive = 0;

  for (const row of rows) {
    if (row.type === 'in') {
      income += row.amount;
    } else {
      expense += row.amount;
      if (row.category === PRIVE) prive += row.amount;
    }
  }

  return {
    income,
    expense,
    prive,
    business_expense: expense - prive,
    profit: income - expense + prive,
  };
}

export function paginate(total, perPage, rawPage) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(pages, Math.max(1, Number.parseInt(rawPage, 10) || 1));
  return { page, pages, perPage, offset: (page - 1) * perPage };
}

export function round2(value) {
  return Math.round(value * 100) / 100;
}

/** Bilangan bulat dalam rentang [min, MAX_MONEY]. */
export function money(value, { field, label, min = 0 }) {
  const text = String(value ?? '').trim();
  const n = /^-?\d+$/.test(text) ? Number(text) : Number.NaN;
  if (Number.isNaN(n) || n < min || n > MAX_MONEY) {
    fail(`${label} harus berupa angka bulat antara ${min} dan ${MAX_MONEY}.`, field);
  }
  return n;
}

/** Angka desimal maksimal dua digit di belakang koma. */
export function decimal(value, { field, label, min = 0, max = 10_000_000, positive = false }) {
  const text = String(value ?? '').trim();
  const n = /^\d+(\.\d{1,2})?$/.test(text) ? Number(text) : Number.NaN;
  if (Number.isNaN(n) || n > max || n < min || (positive && n <= 0)) {
    fail(`${label} harus berupa angka (maks. dua desimal) dan dalam batas yang wajar.`, field);
  }
  return n;
}

export function text(value, { field, label, max, required = true }) {
  const s = String(value ?? '').trim();
  if (required && s === '') fail(`${label} wajib diisi.`, field);
  if (s.length > max) fail(`${label} maksimal ${max} karakter.`, field);
  return s;
}

export function optionalText(value, options) {
  return text(value, { ...options, required: false }) || null;
}

export function oneOf(value, list, { field, label }) {
  if (!list.includes(value)) fail(`${label} tidak valid.`, field);
  return value;
}

export function date(value, { field, label }) {
  const s = String(value ?? '').trim();
  if (!isDate(s)) fail(`${label} tidak valid.`, field);
  return s;
}
