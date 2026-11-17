// Mode produksi di VPS: di belakang Apache pada sub-path /pasarku-node.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../src/app.js';
import { normalizeBasePath } from '../src/config.js';
import { openDb } from '../src/db.js';
import { RateLimiter } from '../src/security.js';
import { prefixHtml } from '../src/web/http.js';

const BASE = '/pasarku-node';
let server;
let origin;
let db;

before(async () => {
  db = openDb(':memory:');
  server = http.createServer(createApp({ db, basePath: BASE, trustProxy: true, limiter: new RateLimiter(2, 60_000) }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  db.close();
});

/** Meniru Apache: path di server tanpa prefix, cookie dan tautan dengan prefix. */
function session() {
  const jar = new Map();
  return {
    jar,
    async send(method, path, { form, headers = {} } = {}) {
      const all = { ...headers, cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') };
      let body;
      if (form) {
        all['content-type'] = 'application/x-www-form-urlencoded';
        body = new URLSearchParams({ _token: decodeURIComponent(jar.get('csrf') ?? ''), ...form }).toString();
      }
      const res = await fetch(origin + path, { method, headers: all, body, redirect: 'manual' });
      for (const line of res.headers.getSetCookie()) {
        const [pair] = line.split(';');
        const i = pair.indexOf('=');
        if (/Max-Age=0/.test(line)) jar.delete(pair.slice(0, i));
        else jar.set(pair.slice(0, i), pair.slice(i + 1));
      }
      return res;
    },
  };
}

test('semua tautan, aset, dan form memakai prefix sub-path', async () => {
  const s = session();
  const res = await s.send('GET', '/login');
  const html = await res.text();

  assert.match(html, /href="\/pasarku-node\/css\/app\.css\?v=[0-9a-z]+"/);
  assert.match(html, /src="\/pasarku-node\/js\/app\.js\?v=[0-9a-z]+"/);
  assert.match(html, /action="\/pasarku-node\/login"/);
  assert.match(html, /action="\/pasarku-node\/demo"/);
  assert.doesNotMatch(html, /(href|action|src)="\/(?!pasarku-node\/)/);

  const csrfCookie = res.headers.getSetCookie().find((c) => c.startsWith('csrf='));
  assert.match(csrfCookie, /Path=\/pasarku-node;/);
});

test('redirect dan cookie sesi memakai prefix, tautan luar tidak diubah', async () => {
  const s = session();
  await s.send('GET', '/login');
  const res = await s.send('POST', '/demo', { form: {}, headers: { 'x-forwarded-for': '203.0.113.9' } });
  assert.equal(res.headers.get('location'), `${BASE}/`);
  assert.ok(res.headers.getSetCookie().some((c) => c.startsWith('sid=') && c.includes(`Path=${BASE};`)));

  const debts = await (await s.send('GET', '/kasbon')).text();
  assert.match(debts, /href="https:\/\/wa\.me\//, 'tautan WhatsApp tetap absolut');
  assert.match(debts, /href="\/pasarku-node\/riwayat"/);
});

test('kembali ke halaman asal mengikuti Referer di bawah sub-path', async () => {
  const s = session();
  await s.send('GET', '/login');
  await s.send('POST', '/demo', { form: {}, headers: { 'x-forwarded-for': '203.0.113.10' } });

  const res = await s.send('POST', '/kasbon', {
    form: { type: 'piutang', party: 'Pak Ali', total: '5000', due_date: '2030-01-01' },
    headers: { host: new URL(origin).host, referer: `${origin}${BASE}/kasbon?status=open` },
  });
  assert.equal(res.headers.get('location'), `${BASE}/kasbon?status=open`);

  const outside = await s.send('POST', '/kasbon', {
    form: { type: 'piutang', party: 'Pak Ali', total: '5000', due_date: '2030-01-01' },
    headers: { referer: `${origin}/pasarku/kasbon` },
  });
  assert.equal(outside.headers.get('location'), `${BASE}/kasbon`, 'Referer dari aplikasi lain diabaikan');
});

test('pembatas login memakai IP asli dari X-Forwarded-For', async () => {
  const attempt = async (ip) => {
    const s = session();
    await s.send('GET', '/login');
    await s.send('POST', '/login', { form: { phone: '081200000000', pin: '0000' }, headers: { 'x-forwarded-for': `10.0.0.1, ${ip}` } });
    const flash = s.jar.get('flash');
    return JSON.parse(Buffer.from(decodeURIComponent(flash), 'base64url').toString()).message;
  };

  assert.equal(await attempt('198.51.100.1'), 'Nomor HP atau PIN tidak sesuai.');
  assert.equal(await attempt('198.51.100.1'), 'Nomor HP atau PIN tidak sesuai.');
  assert.match(await attempt('198.51.100.1'), /Terlalu banyak percobaan/);
  assert.equal(await attempt('198.51.100.2'), 'Nomor HP atau PIN tidak sesuai.', 'IP lain tidak ikut terblokir');
});

test('/healthz menjawab ok untuk pengecekan deploy', async () => {
  const res = await fetch(`${origin}/healthz`);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'ok');
});

test('BASE_PATH divalidasi dan prefix tidak mengubah konten pengguna', () => {
  assert.equal(normalizeBasePath(''), '');
  assert.equal(normalizeBasePath('/pasarku-node/'), '/pasarku-node');
  assert.throws(() => normalizeBasePath('pasarku'), /BASE_PATH tidak valid/);
  assert.throws(() => normalizeBasePath('/a b'), /BASE_PATH tidak valid/);

  const escapedNote = '<td>&lt;a href=&quot;/x&quot;&gt;</td>';
  assert.equal(prefixHtml(escapedNote, BASE), escapedNote);
  assert.equal(prefixHtml('<a href="/stok">', BASE), '<a href="/pasarku-node/stok">');
  assert.equal(prefixHtml('<a href="//cdn.example">', BASE), '<a href="//cdn.example">');
});
