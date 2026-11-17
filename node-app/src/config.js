import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** '' atau '/nama' tanpa garis miring di akhir, misalnya '/pasarku-node'. */
export function normalizeBasePath(value) {
  const trimmed = String(value ?? '').trim().replace(/\/+$/, '');
  if (trimmed === '') return '';
  if (!/^(\/[A-Za-z0-9._-]+)+$/.test(trimmed)) {
    throw new Error(`BASE_PATH tidak valid: "${value}". Contoh yang benar: /pasarku-node`);
  }
  return trimmed;
}

export const config = {
  root,
  publicDir: path.join(root, 'public'),
  host: process.env.HOST ?? '127.0.0.1',
  port: Number(process.env.PORT ?? 8000),
  dbPath: process.env.DB_PATH ?? path.join(root, 'data', 'pasarku.sqlite'),
  secureCookies: process.env.SECURE_COOKIES === 'true',
  // Alamat aplikasi di bawah sub-path reverse proxy, misalnya https://domain/pasarku-node/
  basePath: normalizeBasePath(process.env.BASE_PATH),
  // true bila berada di belakang Apache/Nginx: IP pengguna diambil dari X-Forwarded-For.
  trustProxy: process.env.TRUST_PROXY === 'true',
  sessionMinutes: 120,
  maxBodyBytes: 2 * 1024 * 1024,
};
