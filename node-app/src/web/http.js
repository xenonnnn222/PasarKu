import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { HttpError } from '../errors.js';

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; form-action 'self'; frame-ancestors 'self'; base-uri 'self'",
};

export async function readForm(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return {};

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > config.maxBodyBytes) throw new HttpError(413, 'Data yang dikirim terlalu besar.');
    chunks.push(chunk);
  }

  const type = String(req.headers['content-type'] ?? '');
  if (!type.startsWith('application/x-www-form-urlencoded')) return {};
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString('utf8')));
}

export function parseCookies(header) {
  const cookies = {};
  for (const part of String(header ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    try {
      cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      // abaikan cookie yang rusak
    }
  }
  return cookies;
}

export function cookie(name, value, { maxAge, httpOnly = true, path = '/' } = {}) {
  let s = `${name}=${encodeURIComponent(value)}; Path=${path}; SameSite=Lax`;
  if (httpOnly) s += '; HttpOnly';
  if (maxAge !== undefined) s += `; Max-Age=${maxAge}`;
  if (config.secureCookies) s += '; Secure';
  return s;
}

export function encodeFlash(type, message) {
  return Buffer.from(JSON.stringify({ type, message })).toString('base64url');
}

export function decodeFlash(value) {
  if (!value) return null;
  try {
    const data = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (['success', 'error'].includes(data.type) && typeof data.message === 'string') return data;
  } catch {
    // abaikan
  }
  return null;
}

export function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}

export function serveStatic(res, pathname) {
  const relative = path.normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/, '');
  const file = path.join(config.publicDir, relative);

  if (!file.startsWith(config.publicDir + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    send(res, 404, 'Tidak ditemukan', { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }

  res.writeHead(200, {
    ...SECURITY_HEADERS,
    'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
    'Cache-Control': 'public, max-age=3600',
  });
  fs.createReadStream(file).pipe(res);
}

/**
 * Path tujuan kembali (tanpa BASE_PATH): Referer dari situs sendiri, atau fallback.
 */
export function backPath(req, fallback, basePath = '') {
  const referer = req.headers.referer;
  if (!referer) return fallback;
  try {
    const url = new URL(referer);
    if (url.host !== req.headers.host) return fallback;

    let pathname = url.pathname;
    if (basePath) {
      if (pathname !== basePath && !pathname.startsWith(`${basePath}/`)) return fallback;
      pathname = pathname.slice(basePath.length) || '/';
    }
    return pathname + url.search;
  } catch {
    return fallback;
  }
}

/** IP pengguna. Di belakang proxy, ambil entri terakhir X-Forwarded-For (ditambahkan proxy kita). */
export function clientIp(req, trustProxy) {
  if (trustProxy) {
    const forwarded = String(req.headers['x-forwarded-for'] ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (forwarded.length) return forwarded[forwarded.length - 1];
  }
  return req.socket.remoteAddress ?? 'unknown';
}

/**
 * Menambahkan BASE_PATH ke semua tautan internal (href, action, src yang diawali "/").
 * Konten pengguna sudah di-escape, sehingga tidak bisa menghasilkan atribut baru.
 */
export function prefixHtml(html, basePath) {
  if (!basePath) return html;
  return html.replace(/(\s(?:href|action|src)=")\/(?!\/)/g, `$1${basePath}/`);
}
