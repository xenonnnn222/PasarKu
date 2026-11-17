import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  root,
  publicDir: path.join(root, 'public'),
  host: process.env.HOST ?? '127.0.0.1',
  port: Number(process.env.PORT ?? 8000),
  dbPath: process.env.DB_PATH ?? path.join(root, 'data', 'pasarku.sqlite'),
  secureCookies: process.env.SECURE_COOKIES === 'true',
  sessionMinutes: 120,
  maxBodyBytes: 2 * 1024 * 1024,
};
