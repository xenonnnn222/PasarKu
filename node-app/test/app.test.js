import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db.js';
import { RateLimiter } from '../src/security.js';
import { addDays, summarize, today } from '../src/domain.js';

let server;
let base;
let db;

before(async () => {
  db = openDb(':memory:');
  server = http.createServer(createApp({ db, limiter: new RateLimiter(1000, 60_000) }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  db.close();
});

/** Klien kecil yang menyimpan cookie, seperti browser. */
function client() {
  const jar = new Map();

  async function request(method, path, form) {
    const headers = { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') };
    let body;
    if (form) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(form).toString();
    }
    const res = await fetch(base + path, { method, headers, body, redirect: 'manual' });
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const index = pair.indexOf('=');
      const name = pair.slice(0, index);
      const value = pair.slice(index + 1);
      if (/Max-Age=0/.test(line)) jar.delete(name);
      else jar.set(name, value);
    }
    return res;
  }

  return {
    jar,
    get: (path) => request('GET', path),
    async post(path, form = {}, method) {
      if (!jar.has('csrf')) await request('GET', '/login');
      const data = { _token: decodeURIComponent(jar.get('csrf')), ...form };
      if (method) data._method = method;
      return request('POST', path, data);
    },
    async flash() {
      const raw = jar.get('flash');
      return raw ? JSON.parse(Buffer.from(decodeURIComponent(raw), 'base64url').toString()) : null;
    },
  };
}

let phoneCounter = 0;
async function registeredClient(startingCash = 100000) {
  const c = client();
  phoneCounter += 1;
  const res = await c.post('/daftar', {
    name: 'Bu Tes',
    business_name: 'Lapak Tes',
    phone: `0812000000${String(phoneCounter).padStart(2, '0')}`,
    starting_cash: String(startingCash),
    pin: '1234',
    pin_confirmation: '1234',
  });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/');
  const user = db.prepare('SELECT * FROM users ORDER BY id DESC LIMIT 1').get();
  return { c, user };
}

describe('autentikasi', () => {
  test('daftar, keluar, lalu masuk lagi dengan PIN', async () => {
    const { c, user } = await registeredClient();
    assert.notEqual(user.pin_hash, '1234');
    assert.match(user.pin_hash, /^scrypt\$/);

    const home = await c.get('/');
    assert.equal(home.status, 200);
    assert.match(await home.text(), /Lapak Tes/);

    await c.post('/logout');
    assert.equal((await c.get('/')).status, 303);

    const wrong = await c.post('/login', { phone: user.phone, pin: '9999' });
    assert.equal(wrong.headers.get('location'), '/login');
    assert.equal((await c.flash()).message, 'Nomor HP atau PIN tidak sesuai.');

    const okLogin = await c.post('/login', { phone: `+62${user.phone.slice(1)}`, pin: '1234' });
    assert.equal(okLogin.headers.get('location'), '/');
  });

  test('halaman yang butuh login mengarahkan tamu', async () => {
    const res = await client().get('/riwayat');
    assert.equal(res.status, 303);
    assert.equal(res.headers.get('location'), '/login');
  });

  test('formulir tanpa token CSRF ditolak', async () => {
    const { c, user } = await registeredClient();
    const res = await fetch(`${base}/transaksi`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `sid=${c.jar.get('sid')}; csrf=${c.jar.get('csrf')}`,
      },
      body: 'type=in&amount=5000&category=Penjualan&occurred_on=2026-01-01',
      redirect: 'manual',
    });
    assert.equal(res.status, 303);
    const count = db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE user_id = ?').get(user.id).n;
    assert.equal(count, 0);
  });

  test('akun demo berisi data contoh', async () => {
    const c = client();
    const res = await c.post('/demo');
    assert.equal(res.headers.get('location'), '/');
    const user = db.prepare('SELECT * FROM users WHERE is_demo = 1 ORDER BY id DESC LIMIT 1').get();
    assert.ok(db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE user_id = ?').get(user.id).n > 40);
    assert.equal(user.starting_cash, 500000);
    assert.equal((await c.get('/')).status, 200);
  });
});

describe('transaksi dan kas', () => {
  test('prive mengurangi kas tetapi tidak mengurangi untung', async () => {
    const { c, user } = await registeredClient(100000);
    const date = today();
    await c.post('/transaksi', { type: 'in', amount: '200000', category: 'Penjualan', occurred_on: date });
    await c.post('/transaksi', { type: 'out', amount: '50000', category: 'Pribadi (prive)', occurred_on: date });
    await c.post('/transaksi', { type: 'out', amount: '30000', category: 'Retribusi pasar', occurred_on: date });

    const rows = db.prepare('SELECT * FROM transactions WHERE user_id = ?').all(user.id);
    const s = summarize(rows);
    assert.equal(s.profit, 170000);
    assert.equal(s.business_expense, 30000);

    const html = await (await c.get('/')).text();
    assert.match(html, /Rp 220\.000/);
  });

  test('kategori yang tidak cocok dengan jenis ditolak', async () => {
    const { c, user } = await registeredClient();
    await c.post('/transaksi', { type: 'in', amount: '1000', category: 'Belanja modal', occurred_on: today() });
    assert.equal((await c.flash()).message, 'Kategori tidak valid.');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE user_id = ?').get(user.id).n, 0);
  });

  test('penjualan belum dibayar menjadi piutang, bukan kas', async () => {
    const { c, user } = await registeredClient();
    const res = await c.post('/transaksi', {
      type: 'in', amount: '75000', category: 'Penjualan', occurred_on: today(),
      unpaid: '1', party: 'Pak Budi', due_date: addDays(today(), 7),
    });
    assert.equal(res.headers.get('location'), '/kasbon');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE user_id = ?').get(user.id).n, 0);
    const debt = db.prepare('SELECT * FROM debts WHERE user_id = ?').get(user.id);
    assert.equal(debt.total, 75000);
    assert.equal(debt.note, 'Kasbon penjualan');
  });

  test('transaksi milik akun lain tidak bisa diakses', async () => {
    const a = await registeredClient();
    const b = await registeredClient();
    await a.c.post('/transaksi', { type: 'in', amount: '1000', category: 'Penjualan', occurred_on: today() });
    const tx = db.prepare('SELECT id FROM transactions WHERE user_id = ?').get(a.user.id);

    assert.equal((await b.c.get(`/transaksi/${tx.id}/ubah`)).status, 404);
    assert.equal((await b.c.post(`/transaksi/${tx.id}`, {}, 'DELETE')).status, 404);
    assert.ok(db.prepare('SELECT 1 FROM transactions WHERE id = ?').get(tx.id));
  });
});

describe('kasbon', () => {
  test('cicilan membuat transaksi, kelebihan bayar ditolak, dan kasbon terbayar tidak bisa dihapus', async () => {
    const { c, user } = await registeredClient();
    await c.post('/kasbon', { type: 'piutang', party: 'Bu Tejo', phone: '081322445566', total: '100000', due_date: today() });
    const debt = db.prepare('SELECT * FROM debts WHERE user_id = ?').get(user.id);

    await c.post(`/kasbon/${debt.id}/bayar`, { amount: '150000', paid_at: today() });
    assert.equal((await c.flash()).message, 'Pembayaran melebihi sisa kasbon.');

    await c.post(`/kasbon/${debt.id}/bayar`, { amount: '40000', paid_at: today() });
    const after = db.prepare('SELECT * FROM debts WHERE id = ?').get(debt.id);
    assert.equal(after.paid, 40000);

    const tx = db.prepare('SELECT * FROM transactions WHERE debt_id = ?').get(debt.id);
    assert.equal(tx.source, 'debt_payment');
    assert.equal(tx.category, 'Bayar kasbon');
    assert.equal(tx.note, 'Pembayaran: Bu Tejo');

    const edit = await c.post(`/transaksi/${tx.id}`, { type: 'in', amount: '1', category: 'Penjualan', occurred_on: today() }, 'PUT');
    assert.equal(edit.status, 422);

    await c.post(`/kasbon/${debt.id}`, {}, 'DELETE');
    assert.match((await c.flash()).message, /tidak dapat dihapus/);

    await c.post(`/kasbon/${debt.id}`, { type: 'utang', party: 'Bu Tejo', total: '100000', due_date: today() }, 'PUT');
    assert.equal((await c.flash()).message, 'Jenis kasbon yang sudah dibayar tidak dapat diganti.');

    const page = await (await c.get('/kasbon')).text();
    assert.match(page, /wa\.me\/6281322445566/);
  });
});

describe('stok', () => {
  test('stok masuk mencatat belanja, susut dibatasi stok', async () => {
    const { c, user } = await registeredClient();
    await c.post('/stok', { name: 'Tomat', unit: 'kg', stock: '2', min_stock: '5', buy_price: '10000', sell_price: '14000' });
    const product = db.prepare('SELECT * FROM products WHERE user_id = ?').get(user.id);

    await c.post(`/stok/${product.id}/masuk`, { qty: '3.5', buy_price: '9000', record_expense: '1' });
    const restocked = db.prepare('SELECT * FROM products WHERE id = ?').get(product.id);
    assert.equal(restocked.stock, 5.5);
    assert.equal(restocked.buy_price, 9000);
    const expense = db.prepare("SELECT * FROM transactions WHERE user_id = ? AND source = 'restock'").get(user.id);
    assert.equal(expense.amount, 31500);

    await c.post(`/stok/${product.id}/susut`, { qty: '10', reason: 'Busuk / Layu' });
    assert.equal((await c.flash()).message, 'Barang susut melebihi stok tersedia.');

    await c.post(`/stok/${product.id}/susut`, { qty: '1.5', reason: 'Busuk / Layu' });
    const log = db.prepare('SELECT * FROM waste_logs WHERE user_id = ?').get(user.id);
    assert.equal(log.cost, 13500);
    assert.equal(db.prepare('SELECT stock FROM products WHERE id = ?').get(product.id).stock, 4);

    await c.post(`/stok/${product.id}`, { name: 'Tomat Merah', unit: 'kg', stock: '999', min_stock: '1', buy_price: '9000', sell_price: '15000' }, 'PUT');
    const edited = db.prepare('SELECT * FROM products WHERE id = ?').get(product.id);
    assert.equal(edited.name, 'Tomat Merah');
    assert.equal(edited.stock, 4, 'stok tidak berubah lewat form edit');
  });
});

describe('laporan dan cadangan', () => {
  test('CSV memakai BOM dan menetralkan rumus', async () => {
    const { c } = await registeredClient();
    await c.post('/transaksi', { type: 'in', amount: '5000', category: 'Penjualan', note: '=HYPERLINK("x")', occurred_on: today() });
    const res = await c.get(`/laporan/csv?from=${today()}&to=${today()}`);
    assert.equal(res.status, 200);
    const bytes = Buffer.from(await res.arrayBuffer());
    assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'diawali BOM UTF-8 agar Excel membaca huruf dengan benar');
    const text = bytes.toString('utf8');
    assert.match(text, /"'=HYPERLINK\(""x""\)"/);
  });

  test('rentang laporan lebih dari 366 hari ditolak', async () => {
    const { c } = await registeredClient();
    const res = await c.get('/laporan?from=2024-01-01&to=2025-12-31');
    assert.equal(res.headers.get('location'), '/laporan');
    assert.match((await c.flash()).message, /maksimal 366 hari/);
  });

  test('cadangan bisa dipulihkan ke akun kosong, dan ditolak bila akun berisi', async () => {
    const demo = client();
    await demo.post('/demo');
    const backup = await (await demo.get('/pengaturan/cadangan')).text();
    const data = JSON.parse(backup);
    assert.equal(data.schemaVersion, 2);

    const { c, user } = await registeredClient();
    await c.post('/pengaturan/impor', { payload: backup });
    assert.equal((await c.flash()).type, 'success');

    const counts = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`).get(user.id).n;
    assert.equal(counts('transactions'), data.transactions.length);
    assert.equal(counts('products'), data.products.length);
    assert.equal(counts('debts'), data.debts.length);
    const linked = db.prepare("SELECT COUNT(*) AS n FROM transactions WHERE user_id = ? AND source = 'debt_payment'").get(user.id).n;
    assert.equal(linked, 1);

    await c.post('/pengaturan/impor', { payload: backup });
    assert.match((await c.flash()).message, /pembukuan kosong/);

    await c.post('/pengaturan/data', { confirmation: 'salah' }, 'DELETE');
    assert.equal(counts('transactions'), data.transactions.length);
    await c.post('/pengaturan/data', { confirmation: 'HAPUS' }, 'DELETE');
    assert.equal(counts('transactions'), 0);
  });

  test('isi pengguna di-escape di HTML', async () => {
    const { c } = await registeredClient();
    await c.post('/transaksi', { type: 'in', amount: '5000', category: 'Penjualan', note: '<script>alert(1)</script>', occurred_on: today() });
    const html = await (await c.get('/riwayat')).text();
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.match(html, /&lt;script&gt;/);
  });

  test('semua halaman tampil tanpa error untuk akun demo', async () => {
    const c = client();
    await c.post('/demo');
    const user = db.prepare('SELECT * FROM users WHERE is_demo = 1 ORDER BY id DESC LIMIT 1').get();
    const tx = db.prepare("SELECT id FROM transactions WHERE user_id = ? AND source = 'manual'").get(user.id);

    const pages = [
      '/', '/catat', '/catat?type=out', '/riwayat', '/riwayat?type=out&sort=largest&page=2',
      '/kasbon', '/kasbon?status=overdue', '/stok', '/stok?low=1&sort=stock', '/laporan',
      '/laporan?period=month&offset=-1', '/laporan?period=day', '/pengaturan', `/transaksi/${tx.id}/ubah`, '/mulai',
    ];
    for (const path of pages) {
      const res = await c.get(path);
      assert.equal(res.status, 200, path);
      const html = await res.text();
      assert.match(html, /<\/html>$/, path);
    }

    for (const path of ['/login', '/daftar', '/mulai']) {
      assert.equal((await client().get(path)).status, 200, path);
    }
    assert.equal((await c.get('/tidak-ada')).status, 404);
  });

  test('header keamanan terpasang dan aset statis tersedia', async () => {
    const res = await client().get('/login');
    assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
    assert.equal((await client().get('/css/app.css')).status, 200);
    assert.equal((await client().get('/css/../../package.json')).status, 404);
  });
});
