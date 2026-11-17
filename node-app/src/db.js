import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  business_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  starting_cash INTEGER NOT NULL DEFAULT 0,
  theme TEXT NOT NULL DEFAULT 'light',
  font_size TEXT NOT NULL DEFAULT 'normal',
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS debts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  party TEXT NOT NULL,
  phone TEXT,
  total INTEGER NOT NULL,
  paid INTEGER NOT NULL DEFAULT 0,
  due_date TEXT NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS debts_user_due ON debts(user_id, due_date);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  debt_id INTEGER REFERENCES debts(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  category TEXT NOT NULL,
  note TEXT,
  occurred_on TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS transactions_user_date ON transactions(user_id, occurred_on);

CREATE TABLE IF NOT EXISTS debt_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debt_id INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  transaction_id INTEGER UNIQUE REFERENCES transactions(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,
  paid_at TEXT NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  stock REAL NOT NULL DEFAULT 0,
  min_stock REAL NOT NULL DEFAULT 0,
  buy_price INTEGER NOT NULL DEFAULT 0,
  sell_price INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS waste_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  qty REAL NOT NULL,
  reason TEXT NOT NULL,
  cost INTEGER NOT NULL DEFAULT 0,
  occurred_on TEXT NOT NULL
);
`;

/**
 * Membuka database SQLite bawaan Node (node:sqlite), tanpa paket tambahan.
 * @param {string} file path file database, atau ':memory:' untuk tes
 */
export function openDb(file) {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }

  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  if (file !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  }
  db.exec(SCHEMA);

  return db;
}

let savepointCounter = 0;

/**
 * Menjalankan fungsi dalam satu transaksi database. Gagal berarti semua perubahan dibatalkan.
 * Bila sudah berada di dalam transaksi, dipakai SAVEPOINT agar bisa bersarang.
 */
export function inTransaction(db, fn) {
  if (db.isTransaction) {
    const name = `sp_${++savepointCounter}`;
    db.exec(`SAVEPOINT ${name}`);
    try {
      const result = fn();
      db.exec(`RELEASE ${name}`);
      return result;
    } catch (error) {
      db.exec(`ROLLBACK TO ${name}; RELEASE ${name}`);
      throw error;
    }
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
