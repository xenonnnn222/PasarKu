import { HttpError, ValidationError } from './errors.js';
import { sessionUser } from './services/accounts.js';
import { RateLimiter, randomToken, safeEqual } from './security.js';
import { backPath, cookie, decodeFlash, encodeFlash, parseCookies, readForm, send, serveStatic } from './web/http.js';
import { errorPage } from './web/pages.js';
import { matchRoute } from './web/routes.js';

const STATIC_PREFIXES = ['/css/', '/js/', '/icons/'];
const HTML = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' };

/** Membuat handler HTTP untuk satu database. Dipakai oleh server dan tes. */
export function createApp({ db, limiter = new RateLimiter(10, 15 * 60 * 1000) }) {
  return async function handle(req, res) {
    const setCookies = [];
    const ctx = { db, req, limiter, setCookies, user: null, flash: null, csrf: '' };

    const headers = (extra = {}) => (setCookies.length ? { ...extra, 'Set-Cookie': setCookies } : extra);
    const redirect = (location, flash) => {
      if (flash) setCookies.push(cookie('flash', encodeFlash(...flash), { maxAge: 60 }));
      send(res, 303, '', headers({ Location: location }));
    };

    try {
      const url = new URL(req.url, 'http://localhost');
      ctx.url = url;

      if ((req.method === 'GET' || req.method === 'HEAD') && STATIC_PREFIXES.some((p) => url.pathname.startsWith(p))) {
        serveStatic(res, url.pathname);
        return;
      }

      const cookies = parseCookies(req.headers.cookie);
      ctx.cookies = cookies;

      // Token CSRF pola double-submit: cookie dan field formulir harus sama.
      ctx.csrf = /^[\w-]{30,}$/.test(cookies.csrf ?? '') ? cookies.csrf : randomToken();
      if (ctx.csrf !== cookies.csrf) {
        setCookies.push(cookie('csrf', ctx.csrf, { httpOnly: false, maxAge: 60 * 60 * 24 * 7 }));
      }

      ctx.flash = decodeFlash(cookies.flash);
      if (cookies.flash) setCookies.push(cookie('flash', '', { maxAge: 0 }));

      ctx.body = await readForm(req);
      ctx.query = Object.fromEntries(url.searchParams);

      let method = req.method === 'HEAD' ? 'GET' : req.method;
      if (method === 'POST' && ['PUT', 'DELETE'].includes(String(ctx.body._method ?? '').toUpperCase())) {
        method = ctx.body._method.toUpperCase();
      }

      ctx.user = sessionUser(db, cookies.sid);
      const match = matchRoute(method, url.pathname);

      if (!match) throw new HttpError(404, 'Halaman yang Anda cari tidak ada.');
      if (match.methodNotAllowed) throw new HttpError(405, 'Metode tidak diizinkan untuk alamat ini.');

      const { route, params } = match;
      ctx.params = params;
      ctx.route = route;

      if (method !== 'GET') {
        const token = String(ctx.body._token ?? '');
        if (!cookies.csrf || !token || !safeEqual(token, cookies.csrf)) {
          redirect(backPath(req, route.fallback ?? '/'), ['error', 'Sesi formulir kedaluwarsa. Silakan coba lagi.']);
          return;
        }
      }

      if (route.auth === 'user' && !ctx.user) {
        redirect(url.pathname === '/' ? '/mulai' : '/login');
        return;
      }
      if (route.auth === 'guest' && ctx.user) {
        redirect('/');
        return;
      }

      const result = await route.handler(ctx);

      if (result.file) {
        send(res, 200, result.file.body, headers({
          'Content-Type': result.file.type,
          'Content-Disposition': `attachment; filename="${result.file.name}"`,
          'Cache-Control': 'no-store',
        }));
      } else if (result.redirect || result.back) {
        redirect(result.redirect ?? backPath(req, route.fallback ?? '/'), result.flash);
      } else {
        send(res, result.status ?? 200, result.html, headers(HTML));
      }
    } catch (error) {
      if (res.headersSent) return;

      if (error instanceof ValidationError) {
        const target = ctx.route && ctx.route.method === 'GET'
          ? ctx.route.fallback ?? '/'
          : backPath(req, ctx.route?.fallback ?? '/');
        redirect(target, ['error', error.message]);
        return;
      }

      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) console.error(error);
      const message = status === 500 ? 'Terjadi kesalahan pada server. Silakan coba lagi.' : error.message;
      send(res, status, errorPage({ ...ctx, url: ctx.url ?? new URL('http://localhost/'), flash: null }, status, message), headers(HTML));
    }
  };
}
