import { fail } from '../errors.js';
import { today } from '../domain.js';
import {
  authenticate,
  changePin,
  createDemoUser,
  createSession,
  destroySession,
  register,
  updateProfile,
} from '../services/accounts.js';
import { clearUserData, demoPayload, exportBackup, importBackup } from '../services/backup.js';
import { createDebt, deleteDebt, listDebts, payDebt, updateDebt, validateDebt } from '../services/debts.js';
import { buildReport, dashboard, reportCsv } from '../services/reports.js';
import {
  adjustStock,
  createProduct,
  deleteProduct,
  listProducts,
  recordWaste,
  restock,
  updateProduct,
} from '../services/stock.js';
import {
  cashBalance,
  createTransaction,
  deleteTransaction,
  getOwnTransaction,
  listTransactions,
  updateTransaction,
  validateTransaction,
} from '../services/transactions.js';
import { cookie } from './http.js';
import {
  authPage,
  debtsPage,
  historyPage,
  homePage,
  onboardingPage,
  recordPage,
  reportsPage,
  settingsPage,
  stockPage,
} from './pages.js';
import { config } from '../config.js';
import { inTransaction } from '../db.js';

const ok = (message) => ['success', message];

function startSession(ctx, userId) {
  destroySession(ctx.db, ctx.cookies.sid);
  const sid = createSession(ctx.db, userId);
  ctx.setCookies.push(cookie('sid', sid, { maxAge: config.sessionMinutes * 60, path: ctx.cookiePath }));
}

function throttle(ctx, action) {
  if (!ctx.limiter.allow(`${action}:${ctx.ip}`)) {
    fail('Terlalu banyak percobaan. Coba lagi beberapa menit lagi.', 'form');
  }
}

function confirmDestructive(body) {
  if (body.confirmation !== 'HAPUS') fail('Ketik HAPUS untuk mengonfirmasi.', 'confirmation');
}

/** Tabel rute. auth: 'user' wajib masuk, 'guest' hanya tamu, 'any' keduanya. */
export const routes = [
  { method: 'GET', path: '/mulai', auth: 'any', handler: (ctx) => ({ html: onboardingPage(ctx) }) },

  { method: 'GET', path: '/login', auth: 'guest', handler: (ctx) => ({ html: authPage(ctx, { register: false }) }) },
  {
    method: 'POST', path: '/login', auth: 'guest', fallback: '/login',
    handler: (ctx) => {
      throttle(ctx, 'login');
      const user = authenticate(ctx.db, ctx.body.phone, ctx.body.pin);
      startSession(ctx, user.id);
      return { redirect: '/' };
    },
  },
  { method: 'GET', path: '/daftar', auth: 'guest', handler: (ctx) => ({ html: authPage(ctx, { register: true }) }) },
  {
    method: 'POST', path: '/daftar', auth: 'guest', fallback: '/daftar',
    handler: (ctx) => {
      throttle(ctx, 'register');
      const userId = register(ctx.db, ctx.body);
      startSession(ctx, userId);
      return { redirect: '/', flash: ok('Usaha Anda siap dicatat. Selamat datang!') };
    },
  },
  {
    method: 'POST', path: '/demo', auth: 'guest', fallback: '/login',
    handler: (ctx) => {
      throttle(ctx, 'register');
      startSession(ctx, createDemoUser(ctx.db));
      return { redirect: '/', flash: ok('Mode demo aktif. Data contoh ini terpisah dari pengguna lain.') };
    },
  },
  {
    method: 'POST', path: '/logout', auth: 'user',
    handler: (ctx) => {
      destroySession(ctx.db, ctx.cookies.sid);
      ctx.setCookies.push(cookie('sid', '', { maxAge: 0, path: ctx.cookiePath }));
      return { redirect: '/login' };
    },
  },

  {
    method: 'GET', path: '/', auth: 'user',
    handler: (ctx) => ({ html: homePage(ctx, dashboard(ctx.db, ctx.user.id, cashBalance)) }),
  },

  {
    method: 'GET', path: '/catat', auth: 'user',
    handler: (ctx) => ({ html: recordPage(ctx, { transaction: null, type: ctx.query.type === 'out' ? 'out' : 'in' }) }),
  },
  {
    method: 'POST', path: '/transaksi', auth: 'user', fallback: '/catat',
    handler: (ctx) => {
      const data = validateTransaction(ctx.body);
      if (ctx.body.unpaid === '1') {
        if (data.type !== 'in') fail('Kasbon hanya dapat dicatat sebagai piutang.', 'type');
        const debt = validateDebt({
          type: 'piutang',
          party: ctx.body.party,
          phone: ctx.body.phone,
          total: data.amount,
          due_date: ctx.body.due_date,
          note: data.note || 'Kasbon penjualan',
        });
        createDebt(ctx.db, ctx.user.id, debt);
        return { redirect: '/kasbon', flash: ok('Kasbon dicatat. Saldo bertambah setelah pelanggan membayar.') };
      }
      createTransaction(ctx.db, ctx.user.id, data);
      return { redirect: '/riwayat', flash: ok('Transaksi berhasil dicatat.') };
    },
  },
  {
    method: 'GET', path: '/transaksi/:id/ubah', auth: 'user',
    handler: (ctx) => {
      const transaction = getOwnTransaction(ctx.db, ctx.user.id, ctx.params.id);
      return { html: recordPage(ctx, { transaction, type: transaction.type }) };
    },
  },
  {
    method: 'PUT', path: '/transaksi/:id', auth: 'user', fallback: '/riwayat',
    handler: (ctx) => {
      updateTransaction(ctx.db, ctx.user.id, ctx.params.id, ctx.body);
      return { redirect: '/riwayat', flash: ok('Transaksi diperbarui.') };
    },
  },
  {
    method: 'DELETE', path: '/transaksi/:id', auth: 'user', fallback: '/riwayat',
    handler: (ctx) => {
      deleteTransaction(ctx.db, ctx.user.id, ctx.params.id);
      return { back: true, flash: ok('Transaksi dihapus.') };
    },
  },
  {
    method: 'GET', path: '/riwayat', auth: 'user',
    handler: (ctx) => ({ html: historyPage(ctx, listTransactions(ctx.db, ctx.user.id, ctx.query)) }),
  },

  { method: 'GET', path: '/kasbon', auth: 'user', handler: (ctx) => ({ html: debtsPage(ctx, listDebts(ctx.db, ctx.user.id, ctx.query)) }) },
  {
    method: 'POST', path: '/kasbon', auth: 'user', fallback: '/kasbon',
    handler: (ctx) => {
      createDebt(ctx.db, ctx.user.id, ctx.body);
      return { back: true, flash: ok('Kasbon berhasil ditambahkan.') };
    },
  },
  {
    method: 'PUT', path: '/kasbon/:id', auth: 'user', fallback: '/kasbon',
    handler: (ctx) => {
      updateDebt(ctx.db, ctx.user.id, ctx.params.id, ctx.body);
      return { back: true, flash: ok('Kasbon diperbarui.') };
    },
  },
  {
    method: 'POST', path: '/kasbon/:id/bayar', auth: 'user', fallback: '/kasbon',
    handler: (ctx) => {
      payDebt(ctx.db, ctx.user.id, ctx.params.id, ctx.body);
      return { back: true, flash: ok('Pembayaran tersimpan dan saldo kas diperbarui.') };
    },
  },
  {
    method: 'DELETE', path: '/kasbon/:id', auth: 'user', fallback: '/kasbon',
    handler: (ctx) => {
      deleteDebt(ctx.db, ctx.user.id, ctx.params.id);
      return { back: true, flash: ok('Kasbon dihapus.') };
    },
  },

  { method: 'GET', path: '/stok', auth: 'user', handler: (ctx) => ({ html: stockPage(ctx, listProducts(ctx.db, ctx.user.id, ctx.query)) }) },
  {
    method: 'POST', path: '/stok', auth: 'user', fallback: '/stok',
    handler: (ctx) => {
      createProduct(ctx.db, ctx.user.id, ctx.body);
      return { back: true, flash: ok('Barang berhasil ditambahkan.') };
    },
  },
  {
    method: 'PUT', path: '/stok/:id', auth: 'user', fallback: '/stok',
    handler: (ctx) => {
      updateProduct(ctx.db, ctx.user.id, ctx.params.id, ctx.body);
      return { back: true, flash: ok('Data barang diperbarui. Gunakan stok masuk atau susut untuk mengubah jumlah.') };
    },
  },
  {
    method: 'POST', path: '/stok/:id/sesuaikan', auth: 'user', fallback: '/stok',
    handler: (ctx) => {
      adjustStock(ctx.db, ctx.user.id, ctx.params.id, ctx.body.delta);
      return { back: true, flash: ok('Jumlah stok diperbarui.') };
    },
  },
  {
    method: 'POST', path: '/stok/:id/masuk', auth: 'user', fallback: '/stok',
    handler: (ctx) => {
      restock(ctx.db, ctx.user.id, ctx.params.id, ctx.body, ctx.body.record_expense === '1');
      return { back: true, flash: ok('Stok masuk berhasil dicatat.') };
    },
  },
  {
    method: 'POST', path: '/stok/:id/susut', auth: 'user', fallback: '/stok',
    handler: (ctx) => {
      recordWaste(ctx.db, ctx.user.id, ctx.params.id, ctx.body);
      return { back: true, flash: ok('Barang susut dicatat dan stok dikurangi.') };
    },
  },
  {
    method: 'DELETE', path: '/stok/:id', auth: 'user', fallback: '/stok',
    handler: (ctx) => {
      deleteProduct(ctx.db, ctx.user.id, ctx.params.id);
      return { back: true, flash: ok('Barang dihapus.') };
    },
  },

  { method: 'GET', path: '/laporan', auth: 'user', fallback: '/laporan', handler: (ctx) => ({ html: reportsPage(ctx, buildReport(ctx.db, ctx.user.id, ctx.query)) }) },
  {
    method: 'GET', path: '/laporan/csv', auth: 'user', fallback: '/laporan',
    handler: (ctx) => {
      const report = buildReport(ctx.db, ctx.user.id, ctx.query);
      return { file: { name: `laporan-${report.from}-${report.to}.csv`, type: 'text/csv; charset=utf-8', body: reportCsv(report) } };
    },
  },

  { method: 'GET', path: '/pengaturan', auth: 'user', handler: (ctx) => ({ html: settingsPage(ctx) }) },
  {
    method: 'PUT', path: '/pengaturan', auth: 'user', fallback: '/pengaturan',
    handler: (ctx) => {
      updateProfile(ctx.db, ctx.user.id, ctx.body);
      return { back: true, flash: ok('Pengaturan usaha tersimpan.') };
    },
  },
  {
    method: 'PUT', path: '/pengaturan/pin', auth: 'user', fallback: '/pengaturan',
    handler: (ctx) => {
      throttle(ctx, 'login');
      changePin(ctx.db, ctx.user, ctx.body);
      startSession(ctx, ctx.user.id);
      return { back: true, flash: ok('PIN diperbarui.') };
    },
  },
  {
    method: 'GET', path: '/pengaturan/cadangan', auth: 'user',
    handler: (ctx) => ({
      file: {
        name: `pasarku-backup-${today()}.json`,
        type: 'application/json; charset=utf-8',
        body: JSON.stringify(exportBackup(ctx.db, ctx.user.id), null, 2),
      },
    }),
  },
  {
    method: 'POST', path: '/pengaturan/impor', auth: 'user', fallback: '/pengaturan',
    handler: (ctx) => {
      throttle(ctx, 'destructive');
      let payload;
      try {
        payload = JSON.parse(String(ctx.body.payload ?? ''));
      } catch {
        fail('File cadangan tidak berisi JSON yang valid.', 'import');
      }
      if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        fail('Format cadangan tidak valid.', 'import');
      }
      importBackup(ctx.db, ctx.user.id, payload);
      return { back: true, flash: ok('Data berhasil diimpor. Profil dan PIN akun tetap milik Anda.') };
    },
  },
  {
    method: 'POST', path: '/pengaturan/reset', auth: 'user', fallback: '/pengaturan',
    handler: (ctx) => {
      throttle(ctx, 'destructive');
      confirmDestructive(ctx.body);
      inTransaction(ctx.db, () => {
        clearUserData(ctx.db, ctx.user.id);
        importBackup(ctx.db, ctx.user.id, demoPayload());
      });
      return { back: true, flash: ok('Data contoh berhasil dimuat ke akun ini.') };
    },
  },
  {
    method: 'DELETE', path: '/pengaturan/data', auth: 'user', fallback: '/pengaturan',
    handler: (ctx) => {
      throttle(ctx, 'destructive');
      confirmDestructive(ctx.body);
      inTransaction(ctx.db, () => {
        clearUserData(ctx.db, ctx.user.id);
        ctx.db.prepare('UPDATE users SET starting_cash = 0 WHERE id = ?').run(ctx.user.id);
      });
      return { back: true, flash: ok('Pembukuan akun ini sudah dikosongkan.') };
    },
  },
];

const compiled = routes.map((route) => ({
  ...route,
  regex: new RegExp(`^${route.path.replace(/:(\w+)/g, '(?<$1>\\d+)')}$`),
}));

export function matchRoute(method, pathname) {
  let pathMatched = false;
  for (const route of compiled) {
    const match = route.regex.exec(pathname);
    if (!match) continue;
    pathMatched = true;
    if (route.method === method) return { route, params: { ...match.groups } };
  }
  return pathMatched ? { methodNotAllowed: true } : null;
}
