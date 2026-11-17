import crypto from 'node:crypto';

const KEY_LENGTH = 64;

/** PIN di-hash dengan scrypt dan salt acak. Format: scrypt$salt$hash (base64). */
export function hashPin(pin) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pin, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export function verifyPin(pin, stored) {
  const [algorithm, saltB64, keyB64] = String(stored ?? '').split('$');
  if (algorithm !== 'scrypt' || !saltB64 || !keyB64) return false;

  const expected = Buffer.from(keyB64, 'base64');
  const actual = crypto.scryptSync(String(pin), Buffer.from(saltB64, 'base64'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/** Pembatas sederhana per kunci (IP + aksi) untuk login dan pendaftaran. */
export class RateLimiter {
  constructor(max, windowMs) {
    this.max = max;
    this.windowMs = windowMs;
    this.hits = new Map();
  }

  /** Mengembalikan false jika batas sudah terlampaui. */
  allow(key) {
    const now = Date.now();
    const entry = this.hits.get(key);

    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    entry.count += 1;
    return entry.count <= this.max;
  }
}
