import { inTransaction } from '../db.js';
import { randomUUID } from 'node:crypto';
import { fail } from '../errors.js';
import { PHONE_RE, PIN_RE, money, normalizePhone, oneOf, text } from '../domain.js';
import { hashPin, randomToken, verifyPin } from '../security.js';
import { config } from '../config.js';
import { demoPayload, importBackup } from './backup.js';

const nowSeconds = () => Math.floor(Date.now() / 1000);

export function findUser(db, id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) ?? null;
}

function validatePin(pin, confirmation) {
  const value = String(pin ?? '');
  if (!PIN_RE.test(value)) fail('PIN harus terdiri dari 4 angka.', 'pin');
  if (confirmation !== undefined && String(confirmation) !== value) fail('Ulangi PIN tidak sama.', 'pin');
  return value;
}

function validatePhone(value, db, exceptUserId = null) {
  const phone = normalizePhone(value);
  if (!PHONE_RE.test(phone)) fail('Nomor HP tidak valid. Gunakan format 08xxxxxxxxxx.', 'phone');

  const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
  if (existing && existing.id !== exceptUserId) fail('Nomor HP sudah terdaftar.', 'phone');

  return phone;
}

/** Membuat akun baru dan mengembalikan id-nya. */
export function register(db, input) {
  const name = text(input.name, { field: 'name', label: 'Nama pemilik', max: 100 });
  const businessName = text(input.business_name, { field: 'business_name', label: 'Nama usaha', max: 150 });
  const phone = validatePhone(input.phone, db);
  const pin = validatePin(input.pin, input.pin_confirmation);
  const startingCash = money(input.starting_cash, { field: 'starting_cash', label: 'Modal kas awal' });

  const info = db
    .prepare(
      `INSERT INTO users (name, business_name, phone, pin_hash, starting_cash, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(name, businessName, phone, hashPin(pin), startingCash, nowSeconds());

  return Number(info.lastInsertRowid);
}

export function authenticate(db, phoneInput, pinInput) {
  const phone = normalizePhone(phoneInput);
  const row = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  const pin = String(pinInput ?? '');

  if (!row || !PIN_RE.test(pin) || !verifyPin(pin, row.pin_hash)) {
    fail('Nomor HP atau PIN tidak sesuai.', 'phone');
  }

  return row;
}

/** Membuat akun demo sekali pakai yang berisi data contoh. */
export function createDemoUser(db) {
  return inTransaction(db, () => {
    const info = db
      .prepare(
        `INSERT INTO users (name, business_name, phone, pin_hash, starting_cash, is_demo, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
      )
      .run('Bu Sari', 'Lapak Sayur Bu Sari', `demo:${randomUUID()}`, hashPin(randomToken()), 500000, nowSeconds());

    const userId = Number(info.lastInsertRowid);
    importBackup(db, userId, demoPayload());
    return userId;
  });
}

/** Menghapus akun demo yang sudah lebih dari 24 jam. */
export function pruneDemoUsers(db) {
  db.prepare('DELETE FROM users WHERE is_demo = 1 AND created_at <= ?').run(nowSeconds() - 86400);
}

export function updateProfile(db, userId, input) {
  const name = text(input.name, { field: 'name', label: 'Nama pemilik', max: 100 });
  const businessName = text(input.business_name, { field: 'business_name', label: 'Nama usaha', max: 150 });
  const phone = validatePhone(input.phone, db, userId);
  const startingCash = money(input.starting_cash, { field: 'starting_cash', label: 'Modal kas awal' });
  const theme = oneOf(input.theme, ['light', 'dark'], { field: 'theme', label: 'Tema' });
  const fontSize = oneOf(input.font_size, ['normal', 'large'], { field: 'font_size', label: 'Ukuran huruf' });

  db.prepare(
    `UPDATE users SET name = ?, business_name = ?, phone = ?, starting_cash = ?, theme = ?, font_size = ?
     WHERE id = ?`,
  ).run(name, businessName, phone, startingCash, theme, fontSize, userId);
}

export function changePin(db, user, input) {
  if (!verifyPin(String(input.current_pin ?? ''), user.pin_hash)) {
    fail('PIN saat ini tidak sesuai.', 'current_pin');
  }
  const pin = validatePin(input.pin, input.pin_confirmation);
  db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hashPin(pin), user.id);
}

export function createSession(db, userId) {
  const id = randomToken();
  const expiresAt = nowSeconds() + config.sessionMinutes * 60;
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(id, userId, expiresAt);
  return id;
}

/** Mengembalikan pengguna dari sesi aktif dan memperpanjang masa berlakunya. */
export function sessionUser(db, sessionId) {
  if (!sessionId) return null;

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  if (!session) return null;

  if (session.expires_at <= nowSeconds()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    return null;
  }

  db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(
    nowSeconds() + config.sessionMinutes * 60,
    sessionId,
  );
  return findUser(db, session.user_id);
}

export function destroySession(db, sessionId) {
  if (sessionId) db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}
