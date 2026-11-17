import { escapeHtml as esc } from '../security.js';
import { formatDate, rupiah } from '../domain.js';

export { esc, rupiah, formatDate };

const NAV = [
  ['/', 'Beranda'],
  ['/catat', 'Catat transaksi'],
  ['/riwayat', 'Riwayat'],
  ['/kasbon', 'Kasbon'],
  ['/stok', 'Stok barang'],
  ['/laporan', 'Laporan'],
  ['/pengaturan', 'Pengaturan'],
];

function isActive(href, pathname) {
  if (href === '/') return pathname === '/';
  if (href === '/riwayat' && pathname.startsWith('/transaksi/')) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function flashBox(flash) {
  if (!flash) return '';
  const cls = flash.type === 'error' ? 'notice error' : 'notice success';
  return `<div class="${cls}" role="${flash.type === 'error' ? 'alert' : 'status'}">${esc(flash.message)}</div>`;
}

/** Formulir dengan token CSRF. PUT/DELETE dikirim lewat field _method. */
export function form(ctx, { action, method = 'POST', cls = 'stack', confirm, dataAttr, body }) {
  const verb = method.toUpperCase();
  const override = verb === 'POST' ? '' : `<input type="hidden" name="_method" value="${esc(verb)}">`;
  const confirmAttr = confirm ? ` data-confirm="${esc(confirm)}"` : '';
  const extra = dataAttr && /^data-[a-z-]+$/.test(dataAttr) ? ` ${dataAttr}` : '';
  return `<form method="post" action="${esc(action)}" class="${esc(cls)}"${confirmAttr}${extra}>${override}<input type="hidden" name="_token" value="${esc(ctx.csrf)}">${body}</form>`;
}

export function options(list, selected, labels = {}) {
  return list
    .map((value) => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(labels[value] ?? value)}</option>`)
    .join('');
}

export function pager(basePath, filters, { page, pages }) {
  if (pages <= 1) return '';
  const link = (n) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== '' && value !== false && value !== undefined && value !== null) params.set(key, value === true ? '1' : value);
    }
    params.set('page', String(n));
    return `${basePath}?${params}`;
  };
  const prev = page > 1 ? `<a class="btn small secondary" href="${esc(link(page - 1))}">← Sebelumnya</a>` : '';
  const next = page < pages ? `<a class="btn small secondary" href="${esc(link(page + 1))}">Berikutnya →</a>` : '';
  return `<nav class="pagination" aria-label="Halaman">${prev}<span>Halaman ${page} dari ${pages}</span>${next}</nav>`;
}

export function chart(days) {
  const max = Math.max(1, ...days.map((d) => Math.max(d.income, d.expense)));
  const bars = days
    .map((d) => {
      const income = Math.round((d.income / max) * 100);
      const expense = Math.round((d.expense / max) * 100);
      const label = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric' }).format(new Date(`${d.date}T00:00:00`));
      return `<div class="chart-day" title="${esc(`${formatDate(d.date)}: masuk ${rupiah(d.income)}, keluar ${rupiah(d.expense)}`)}">
        <div class="chart-bars"><span class="bar in" style="height:${income}%"></span><span class="bar out" style="height:${expense}%"></span></div>
        <small>${esc(label)}</small></div>`;
    })
    .join('');
  const rows = days
    .map((d) => `<tr><td>${esc(formatDate(d.date))}</td><td>${rupiah(d.income)}</td><td>${rupiah(d.expense)}</td><td class="${d.profit < 0 ? 'negative' : 'positive'}">${rupiah(d.profit)}</td></tr>`)
    .join('');
  return `<div class="chart" aria-hidden="true">${bars}</div>
    <details class="chart-table"><summary>Lihat angka</summary><table><thead><tr><th>Tanggal</th><th>Masuk</th><th>Keluar</th><th>Untung</th></tr></thead><tbody>${rows}</tbody></table></details>`;
}

export function transactionList(ctx, rows, { actions = false } = {}) {
  if (!rows.length) return '<p class="empty">Belum ada transaksi.</p>';

  const items = rows
    .map((t) => {
      const sign = t.type === 'in' ? '+' : '−';
      const auto = t.source !== 'manual';
      const tools =
        actions && !auto
          ? `<div class="row-actions"><a class="btn small secondary" href="/transaksi/${t.id}/ubah">Ubah</a>${form(ctx, {
              action: `/transaksi/${t.id}`,
              method: 'DELETE',
              cls: 'inline',
              confirm: 'Hapus transaksi ini?',
              body: '<button class="btn small danger" type="submit">Hapus</button>',
            })}</div>`
          : actions && auto
            ? '<small class="muted">Otomatis</small>'
            : '';
      return `<tr><td>${esc(formatDate(t.occurred_on))}</td><td>${esc(t.category)}</td><td>${esc(t.note ?? '')}</td>
        <td class="amount ${t.type === 'in' ? 'positive' : 'negative'}">${sign} ${rupiah(t.amount)}</td>${actions ? `<td>${tools}</td>` : ''}</tr>`;
    })
    .join('');

  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Tanggal</th><th>Kategori</th><th>Catatan</th><th>Nominal</th>${actions ? '<th></th>' : ''}</tr></thead><tbody>${items}</tbody></table></div>`;
}

export function layout(ctx, { title, subtitle = 'Catatan rapi, usaha lebih pasti.', action = '', body }) {
  const user = ctx.user;
  const theme = user?.theme ?? 'light';
  const font = user?.font_size ?? 'normal';
  const head = `<!doctype html><html lang="id" data-theme="${esc(theme)}" data-font="${esc(font)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="Pembukuan sederhana untuk pedagang pasar."><title>${esc(title)} · PasarKu</title><link rel="icon" href="/icons/icon.svg" type="image/svg+xml"><link rel="stylesheet" href="/css/app.css"><script defer src="/js/app.js"></script></head>`;

  if (!user) {
    return `${head}<body class="guest-shell"><a class="skip-link" href="#main">Lewati ke konten</a><main id="main">${body}</main></body></html>`;
  }

  const nav = NAV.map(([href, label]) => {
    const active = isActive(href, ctx.url.pathname);
    return `<a href="${href}" class="nav-link${active ? ' active' : ''}"${active ? ' aria-current="page"' : ''}><span>${esc(label)}</span></a>`;
  }).join('');

  const todayLabel = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  return `${head}<body class="app-shell"><a class="skip-link" href="#main">Lewati ke konten</a>
<aside id="sidebar" class="sidebar" aria-label="Navigasi utama">
  <a class="brand" href="/"><span class="brand-icon">P</span><span>PasarKu<small>BUKU USAHA ANDA</small></span></a>
  <p class="nav-heading">RUANG USAHA</p><nav>${nav}</nav>
  <div class="sidebar-bottom"><div class="account"><span class="avatar">${esc(user.name.slice(0, 1))}</span><span><strong>${esc(user.name)}</strong><small>${esc(user.business_name)}</small></span></div>
  ${form(ctx, { action: '/logout', cls: '', body: '<button class="nav-link" type="submit">Keluar akun</button>' })}</div>
</aside>
<div class="workspace"><header class="topbar"><button type="button" class="btn icon-button mobile-menu" data-menu-toggle aria-controls="sidebar" aria-expanded="false" aria-label="Buka navigasi">☰</button>
<div class="breadcrumb">Ruang usaha <span>/</span> <strong>${esc(title)}</strong></div><span class="today">${esc(todayLabel)}</span>
<a href="/catat" class="btn primary topbar-action">+ Catat transaksi</a></header>
<main id="main" class="main-content">
${user.is_demo ? '<div class="notice demo-notice"><strong>Mode demo</strong><span>Data contoh terpisah untuk sesi Anda. Daftar akun untuk pembukuan usaha sendiri.</span></div>' : ''}
<div class="page-heading"><div><p class="eyebrow">${esc(user.business_name)}</p><h1>${esc(title)}</h1><p class="subtitle">${esc(subtitle)}</p></div>${action}</div>
${flashBox(ctx.flash)}
${body}
<footer class="page-footer"><span>PasarKu · Pembukuan pedagang pasar</span><span>Data tersimpan di akun Anda</span></footer>
</main></div></body></html>`;
}
