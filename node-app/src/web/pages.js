import { EXPENSE, INCOME, UNITS, WASTE_REASONS, addDays, today } from '../domain.js';
import { productStatus } from '../services/stock.js';
import { chart, esc, flashBox, form, formatDate, layout, options, pager, rupiah, transactionList } from './views.js';

const brand = '<a class="brand" href="/mulai"><span class="brand-icon">P</span><span>PasarKu<small>BUKU USAHA ANDA</small></span></a>';

export function onboardingPage(ctx) {
  return layout(ctx, {
    title: 'Mulai pembukuan',
    body: `<div class="welcome">${brand}<p class="eyebrow">CATATAN KECIL, DAMPAK BESAR</p>
<h1>Kenali uang Anda.<br>Kembangkan usaha Anda.</h1><p class="subtitle">Pembukuan yang mudah untuk keseharian pedagang pasar.</p>
<div class="grid three">
<article class="card"><h2>Catat setiap transaksi</h2><p>Pisahkan pemasukan, pengeluaran usaha, dan uang pribadi.</p></article>
<article class="card"><h2>Kasbon tetap terpantau</h2><p>Lihat jatuh tempo dan catat setiap cicilan pelanggan.</p></article>
<article class="card"><h2>Pahami hasil usaha</h2><p>Pantau stok, lihat laporan, lalu unduh catatan ke CSV.</p></article></div>
<div class="actions"><a href="/daftar" class="btn primary">Daftar usaha →</a><a href="/login" class="btn secondary">Sudah punya akun</a></div></div>`,
  });
}

export function authPage(ctx, { register }) {
  const fields = register
    ? `<label>Nama pemilik<input name="name" autocomplete="name" maxlength="100" required placeholder="Contoh: Bu Sari"></label>
       <label>Nama usaha / lapak<input name="business_name" maxlength="150" required placeholder="Contoh: Lapak Sayur Berkah"></label>`
    : '';
  const extra = register
    ? `<label>Modal kas awal (Rp)<input name="starting_cash" type="number" value="500000" min="0" max="1000000000000" step="1" required></label>`
    : '';
  const confirm = register
    ? '<label>Ulangi PIN<input name="pin_confirmation" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="new-password" required placeholder="••••"></label>'
    : '';

  const body = `<div class="auth-layout"><section class="auth-story">${brand}<div><span class="story-label">UNTUK PEDAGANG PASAR INDONESIA</span>
<h1>Usaha berjalan.<br>Catatan tetap rapi.</h1><p>Uang masuk, kasbon, dan stok dagangan, semua tercatat di satu tempat.</p>
<div class="story-points"><p>✓ Pisahkan uang usaha dan uang pribadi</p><p>✓ Pantau kasbon dan persediaan barang</p><p>✓ Lihat laporan kapan saja</p></div></div>
<small>Pembukuan sederhana, keputusan usaha lebih jelas.</small></section>
<section class="auth-form"><div class="auth-card"><p class="eyebrow">SELAMAT DATANG DI PASARKU</p>
<h2>${register ? 'Mulai usaha yang lebih tertata' : 'Masuk ke ruang usaha'}</h2>
<p class="subtitle">${register ? 'Daftarkan profil lapak dan buat PIN Anda.' : 'Gunakan nomor HP dan PIN 4 angka Anda.'}</p>
${flashBox(ctx.flash)}
${form(ctx, {
  action: register ? '/daftar' : '/login',
  body: `${fields}<label>Nomor HP<input name="phone" type="tel" autocomplete="tel" required maxlength="20" placeholder="081234567890"></label>${extra}
<label>${register ? 'Buat PIN 4 angka' : 'PIN 4 angka'}<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" autocomplete="${register ? 'new-password' : 'current-password'}" required placeholder="••••"></label>${confirm}
<button class="btn primary full" type="submit">${register ? 'Daftar &amp; buka dashboard' : 'Masuk ke dashboard'} →</button>`,
})}
${register ? '' : `<div class="separator">ATAU LIHAT CONTOH TERLEBIH DAHULU</div>${form(ctx, { action: '/demo', cls: '', body: '<button type="submit" class="btn secondary full">Coba demo Lapak Bu Sari</button>' })}`}
<p class="auth-switch">${register ? 'Sudah punya akun? <a href="/login">Masuk di sini</a>' : 'Belum punya akun usaha? <a href="/daftar">Daftar sekarang</a>'}</p></div></section></div>`;

  return layout(ctx, { title: register ? 'Daftar usaha' : 'Masuk', body });
}

export function homePage(ctx, data) {
  const s = data.today;
  return layout(ctx, {
    title: 'Beranda',
    subtitle: 'Ringkasan usaha Anda hari ini. Semua lebih mudah saat tercatat.',
    body: `<div class="stats">
<article class="stat featured"><span>Saldo kas di tangan</span><strong>${rupiah(data.cash)}</strong><small>Modal awal + uang masuk − uang keluar</small></article>
<article class="stat"><span>Untung hari ini</span><strong class="${s.profit < 0 ? 'negative' : 'positive'}">${rupiah(s.profit)}</strong><small>Pengeluaran pribadi tidak mengurangi untung</small></article>
<article class="stat"><span>Uang masuk</span><strong>${rupiah(s.income)}</strong><small>Total penerimaan hari ini</small></article>
<article class="stat"><span>Uang keluar</span><strong>${rupiah(s.expense)}</strong><small>Termasuk kebutuhan pribadi</small></article></div>
<div class="grid wide"><section class="card"><div class="section-heading"><div><h2>Arus kas 7 hari terakhir</h2><p>Kenali ritme pemasukan dan pengeluaran usaha.</p></div><span class="pill green">7 HARI</span></div>${chart(data.chart)}</section>
<section class="card attention"><p class="eyebrow">PERLU PERHATIAN</p><h2>Jangan sampai terlewat</h2>
<a href="/kasbon?status=overdue" class="attention-row"><span><strong>${data.overdue} kasbon lewat jatuh tempo</strong><small>Ingatkan pelanggan dengan sopan</small></span>→</a>
<a href="/stok?low=1" class="attention-row"><span><strong>${data.lowStock} barang perlu diisi ulang</strong><small>Periksa stok sebelum belanja</small></span>→</a>
<div class="balance-note"><span>Sisa piutang pelanggan</span><strong>${rupiah(data.receivable)}</strong></div>
<div class="actions"><a href="/catat?type=in" class="btn primary">+ Penjualan</a><a href="/catat?type=out" class="btn secondary">− Belanja</a></div></section></div>
<section class="card no-pad"><div class="section-heading padded"><div><h2>Transaksi terakhir</h2><p>Jejak keuangan lapak Anda.</p></div><a href="/riwayat" class="text-link">Lihat semua →</a></div>${transactionList(ctx, data.recent)}</section>`,
  });
}

function categorySelect(selected) {
  const group = (kind, label, list) =>
    `<optgroup label="${label}" data-kind="${kind}">${list.map((c) => `<option value="${esc(c)}"${c === selected ? ' selected' : ''}>${esc(c)}</option>`).join('')}</optgroup>`;
  return `<select name="category" data-category-select required>${group('in', 'Pemasukan', INCOME)}${group('out', 'Pengeluaran', EXPENSE)}</select>`;
}

export function recordPage(ctx, { transaction, type }) {
  const t = transaction;
  const kind = t?.type ?? type;
  const category = t?.category ?? (kind === 'in' ? 'Penjualan' : 'Belanja modal');
  const quick = [10000, 25000, 50000, 100000]
    .map((n) => `<button class="btn small secondary" type="button" data-add-amount="${n}">+${n.toLocaleString('id-ID')}</button>`)
    .join('');
  const unpaid = t
    ? ''
    : `<label class="check-row"><input type="checkbox" name="unpaid" value="1" data-unpaid-toggle> Penjualan ini belum dibayar (kasbon)</label>
<fieldset class="unpaid-fields" data-unpaid-fields><legend>Data pelanggan kasbon</legend><div class="fields two">
<label>Nama pelanggan<input name="party" maxlength="150"></label><label>Nomor WhatsApp<input name="phone" type="tel" maxlength="25"></label></div>
<label>Jatuh tempo<input name="due_date" type="date" value="${addDays(today(), 7)}"></label><p class="hint">Kasbon tidak menambah saldo kas sampai pembayaran diterima.</p></fieldset>`;

  const body = `<div class="grid wide"><section class="card">${form(ctx, {
    action: t ? `/transaksi/${t.id}` : '/transaksi',
    method: t ? 'PUT' : 'POST',
    dataAttr: 'data-record-form',
    body: `<div class="fields two"><label>Jenis transaksi<select name="type" data-transaction-type>${options(['in', 'out'], kind, { in: 'Uang masuk', out: 'Uang keluar' })}</select></label>
<label>Tanggal<input name="occurred_on" type="date" value="${esc(t?.occurred_on ?? today())}" required></label></div>
<label>Nominal (Rp)<input class="amount-input" name="amount" type="number" min="1" max="1000000000000" step="1" value="${esc(t?.amount ?? '')}" required inputmode="numeric" placeholder="0" data-amount></label>
<div class="quick-amounts">${quick}</div>
<label>Kategori${categorySelect(category)}</label>
<label>Catatan <span class="optional">opsional</span><textarea name="note" rows="3" maxlength="1000" placeholder="Contoh: penjualan sayur pagi">${esc(t?.note ?? '')}</textarea></label>
${unpaid}
<div class="actions"><button type="submit" class="btn primary">${t ? 'Simpan perubahan' : 'Simpan transaksi'} ✓</button><a class="btn secondary" href="/riwayat">Lihat riwayat</a></div>`,
  })}</section>
<aside class="stack"><section class="card tip-card"><h2>Catatan yang jelas membantu usaha</h2><p>Pilih <strong>Pribadi (prive)</strong> untuk uang yang diambil bagi kebutuhan rumah tangga. Saldo kas berkurang, tetapi tidak dihitung sebagai biaya usaha.</p><p>Untuk menerima cicilan kasbon, buka halaman Kasbon agar sisa tagihan ikut diperbarui.</p></section>
<section class="card"><h2>Butuh catat kasbon?</h2><p>Kelola piutang pelanggan dan utang supplier secara terpisah.</p><a href="/kasbon" class="text-link">Buka kasbon →</a></section></aside></div>`;

  return layout(ctx, {
    title: t ? 'Ubah transaksi' : 'Catat transaksi',
    subtitle: 'Catat sekarang agar tidak lupa. Nominal menggunakan Rupiah tanpa titik pemisah.',
    body,
  });
}

export function historyPage(ctx, { rows, total, pager: p, filters: f }) {
  const filter = `<form method="get" action="/riwayat" class="card filter-row">
<label>Cari<input name="q" value="${esc(f.q)}" maxlength="100" placeholder="Catatan atau kategori"></label>
<label>Jenis<select name="type"><option value="">Semua</option>${options(['in', 'out'], f.type, { in: 'Uang masuk', out: 'Uang keluar' })}</select></label>
<label>Dari<input type="date" name="from" value="${esc(f.from)}"></label><label>Sampai<input type="date" name="to" value="${esc(f.to)}"></label>
<label>Urutkan<select name="sort">${options(['newest', 'oldest', 'largest', 'smallest'], f.sort, { newest: 'Terbaru', oldest: 'Terlama', largest: 'Nominal terbesar', smallest: 'Nominal terkecil' })}</select></label>
<button class="btn secondary" type="submit">Terapkan</button></form>`;

  return layout(ctx, {
    title: 'Riwayat',
    subtitle: `${total} transaksi tercatat.`,
    body: `${filter}<section class="card no-pad">${transactionList(ctx, rows, { actions: true })}</section>${pager('/riwayat', f, p)}`,
  });
}

function debtFields(d = {}) {
  return `<div class="fields two"><label>Jenis<select name="type">${options(['piutang', 'utang'], d.type ?? 'piutang', { piutang: 'Piutang pelanggan', utang: 'Utang supplier' })}</select></label>
<label>Nama<input name="party" value="${esc(d.party ?? '')}" maxlength="150" required></label></div>
<div class="fields two"><label>Nomor HP<input name="phone" type="tel" value="${esc(d.phone ?? '')}" maxlength="25"></label>
<label>Total (Rp)<input name="total" type="number" min="1" max="1000000000000" step="1" value="${esc(d.total ?? '')}" required></label></div>
<label>Jatuh tempo<input name="due_date" type="date" value="${esc(d.due_date ?? addDays(today(), 7))}" required></label>
<label>Catatan <span class="optional">opsional</span><textarea name="note" rows="2" maxlength="1000">${esc(d.note ?? '')}</textarea></label>`;
}

export function debtsPage(ctx, { rows, pager: p, balances, filters: f }) {
  const cards = rows
    .map((d) => {
      const statusCls = d.status === 'Lunas' ? 'green' : d.status === 'Terlambat' ? 'red' : 'amber';
      const reminder = d.whatsapp
        ? `<a class="btn small secondary" target="_blank" rel="noopener" href="https://wa.me/${esc(d.whatsapp)}?text=${encodeURIComponent(`Halo ${d.party}, mengingatkan sisa kasbon ${rupiah(d.remaining)} di ${ctx.user.business_name}. Terima kasih.`)}">Ingatkan via WhatsApp</a>`
        : '';
      const history = d.payments.length
        ? `<details class="payment-history"><summary>Riwayat pembayaran (${d.payments.length})</summary><ul>${d.payments
            .map((pay) => `<li>${esc(formatDate(pay.paid_at))}: ${rupiah(pay.amount)}${pay.note ? ` · ${esc(pay.note)}` : ''}</li>`)
            .join('')}</ul></details>`
        : '';
      const pay =
        d.remaining > 0
          ? `<details class="inline-details"><summary class="btn secondary small">Catat pembayaran</summary>${form(ctx, {
              action: `/kasbon/${d.id}/bayar`,
              body: `<div class="fields two"><label>Jumlah (Rp)<input name="amount" type="number" min="1" max="${d.remaining}" step="1" value="${d.remaining}" required></label>
<label>Tanggal<input name="paid_at" type="date" value="${today()}" required></label></div><label>Catatan<input name="note" maxlength="1000"></label>
<button class="btn primary small" type="submit">Simpan pembayaran</button>`,
            })}</details>`
          : '';
      const remove =
        d.paid === 0
          ? form(ctx, { action: `/kasbon/${d.id}`, method: 'DELETE', cls: 'inline', confirm: 'Hapus kasbon ini?', body: '<button class="btn small danger" type="submit">Hapus</button>' })
          : '';

      return `<article class="card debt-card"><div class="section-heading"><div><h2>${esc(d.party)}</h2><p>${d.type === 'piutang' ? 'Piutang pelanggan' : 'Utang supplier'} · jatuh tempo ${esc(formatDate(d.due_date))}</p></div><span class="pill ${statusCls}">${esc(d.status)}</span></div>
<div class="stats three"><div><small>Total</small><strong>${rupiah(d.total)}</strong></div><div><small>Dibayar</small><strong>${rupiah(d.paid)}</strong></div><div><small>Sisa</small><strong>${rupiah(d.remaining)}</strong></div></div>
${d.note ? `<p class="muted">${esc(d.note)}</p>` : ''}
<div class="actions">${pay}${reminder}<details class="inline-details"><summary class="btn secondary small">Ubah catatan</summary>${form(ctx, {
        action: `/kasbon/${d.id}`,
        method: 'PUT',
        body: `${debtFields(d)}<button class="btn primary small" type="submit">Simpan perubahan</button>`,
      })}</details>${remove}</div>${history}</article>`;
    })
    .join('');

  const filter = `<form method="get" action="/kasbon" class="card filter-row">
<label>Cari nama<input name="q" value="${esc(f.q)}" maxlength="100"></label>
<label>Jenis<select name="type"><option value="">Semua</option>${options(['piutang', 'utang'], f.type, { piutang: 'Piutang', utang: 'Utang' })}</select></label>
<label>Status<select name="status"><option value="">Semua</option>${options(['open', 'overdue', 'paid'], f.status, { open: 'Belum lunas', overdue: 'Terlambat', paid: 'Lunas' })}</select></label>
<button class="btn secondary" type="submit">Terapkan</button></form>`;

  return layout(ctx, {
    title: 'Kasbon & utang',
    subtitle: 'Tagihan pelanggan dan utang supplier, terpantau sampai lunas.',
    body: `<div class="stats two"><article class="stat"><span>Sisa piutang pelanggan</span><strong>${rupiah(balances.piutang)}</strong></article><article class="stat"><span>Sisa utang supplier</span><strong>${rupiah(balances.utang)}</strong></article></div>
<details class="card add-panel"><summary><strong>+ Tambah kasbon</strong></summary>${form(ctx, { action: '/kasbon', body: `${debtFields()}<button class="btn primary" type="submit">Simpan kasbon</button>` })}</details>
${filter}<div class="stack">${cards || '<p class="empty card">Belum ada kasbon yang cocok.</p>'}</div>${pager('/kasbon', f, p)}`,
  });
}

function productFields(p = {}, { editing = false } = {}) {
  return `<div class="fields two"><label>Nama barang<input name="name" value="${esc(p.name ?? '')}" maxlength="150" required></label>
<label>Satuan<select name="unit">${options(UNITS, p.unit ?? 'kg')}</select></label></div>
<div class="fields two"><label>Stok${editing ? ' (ubah lewat stok masuk/susut)' : ''}<input name="stock" type="number" min="0" max="10000000" step="0.01" value="${esc(p.stock ?? 0)}" ${editing ? 'readonly' : ''} required></label>
<label>Stok minimum<input name="min_stock" type="number" min="0" max="10000000" step="0.01" value="${esc(p.min_stock ?? 0)}" required></label></div>
<div class="fields two"><label>Harga beli (Rp)<input name="buy_price" type="number" min="0" max="1000000000000" step="1" value="${esc(p.buy_price ?? 0)}" required></label>
<label>Harga jual (Rp)<input name="sell_price" type="number" min="0" max="1000000000000" step="1" value="${esc(p.sell_price ?? 0)}" required></label></div>`;
}

export function stockPage(ctx, { rows, pager: p, filters: f, stats, wasteLogs }) {
  const items = rows
    .map((item) => {
      const status = productStatus(item);
      const cls = status === 'Cukup' ? 'green' : status === 'Menipis' ? 'amber' : 'red';
      const adjust = (delta, label) =>
        form(ctx, { action: `/stok/${item.id}/sesuaikan`, cls: 'inline', body: `<input type="hidden" name="delta" value="${delta}"><button class="btn small secondary" type="submit" aria-label="${label}">${delta > 0 ? '+' : '−'}</button>` });

      return `<tr><td><strong>${esc(item.name)}</strong><br><span class="pill ${cls}">${status}</span></td>
<td>${item.stock} ${esc(item.unit)}<br><small>min. ${item.min_stock}</small></td><td>${rupiah(item.buy_price)}</td><td>${rupiah(item.sell_price)}</td>
<td><div class="row-actions">${adjust(-1, 'Kurangi satu')}${adjust(1, 'Tambah satu')}
<details class="inline-details"><summary class="btn small secondary">Stok masuk</summary>${form(ctx, {
        action: `/stok/${item.id}/masuk`,
        body: `<label>Jumlah<input name="qty" type="number" min="0.01" max="10000000" step="0.01" required></label>
<label>Harga beli (Rp)<input name="buy_price" type="number" min="0" step="1" value="${item.buy_price}" required></label>
<label class="check-row"><input type="checkbox" name="record_expense" value="1" checked> Catat sebagai pengeluaran (belanja modal)</label>
<button class="btn primary small" type="submit">Simpan</button>`,
      })}</details>
<details class="inline-details"><summary class="btn small secondary">Susut</summary>${form(ctx, {
        action: `/stok/${item.id}/susut`,
        body: `<label>Jumlah<input name="qty" type="number" min="0.01" max="${item.stock}" step="0.01" required></label>
<label>Alasan<select name="reason">${options(WASTE_REASONS, WASTE_REASONS[0])}</select></label><button class="btn primary small" type="submit">Catat susut</button>`,
      })}</details>
<details class="inline-details"><summary class="btn small secondary">Ubah</summary>${form(ctx, {
        action: `/stok/${item.id}`,
        method: 'PUT',
        body: `${productFields(item, { editing: true })}<button class="btn primary small" type="submit">Simpan</button>`,
      })}</details>
${form(ctx, { action: `/stok/${item.id}`, method: 'DELETE', cls: 'inline', confirm: `Hapus ${item.name}?`, body: '<button class="btn small danger" type="submit">Hapus</button>' })}</div></td></tr>`;
    })
    .join('');

  const waste = wasteLogs.length
    ? `<ul class="plain-list">${wasteLogs
        .map((w) => `<li><strong>${esc(w.product_name ?? 'Barang terhapus')}</strong> · ${w.qty} · ${esc(w.reason)} · ${rupiah(w.cost)} <small>${esc(formatDate(w.occurred_on))}</small></li>`)
        .join('')}</ul>`
    : '<p class="empty">Belum ada barang susut.</p>';

  const filter = `<form method="get" action="/stok" class="card filter-row"><label>Cari barang<input name="q" value="${esc(f.q)}" maxlength="100"></label>
<label>Urutkan<select name="sort">${options(['name', 'stock', 'buy_price', 'sell_price'], f.sort, { name: 'Nama', stock: 'Stok', buy_price: 'Harga beli', sell_price: 'Harga jual' })}</select></label>
<label class="check-row"><input type="checkbox" name="low" value="1"${f.low ? ' checked' : ''}> Hanya stok menipis</label><button class="btn secondary" type="submit">Terapkan</button></form>`;

  return layout(ctx, {
    title: 'Stok barang',
    subtitle: 'Pantau persediaan, stok masuk, dan barang susut.',
    body: `<div class="stats three"><article class="stat"><span>Jenis barang</span><strong>${stats.types}</strong></article>
<article class="stat"><span>Nilai persediaan</span><strong>${rupiah(stats.value)}</strong></article><article class="stat"><span>Stok menipis</span><strong>${stats.low}</strong></article></div>
<details class="card add-panel"><summary><strong>+ Tambah barang</strong></summary>${form(ctx, { action: '/stok', body: `${productFields()}<button class="btn primary" type="submit">Simpan barang</button>` })}</details>
${filter}<section class="card no-pad"><div class="table-wrap"><table class="data-table"><thead><tr><th>Barang</th><th>Stok</th><th>Beli</th><th>Jual</th><th></th></tr></thead><tbody>${items || '<tr><td colspan="5" class="empty">Belum ada barang.</td></tr>'}</tbody></table></div></section>
${pager('/stok', f, p)}
<div class="grid two"><section class="card" data-calculator><h2>Kalkulator harga jual</h2>
<label>Harga beli per satuan (Rp)<input type="number" min="0" step="1" value="10000" data-calc-cost></label>
<div class="fields two"><label>Persentase<input type="number" min="0" max="95" step="1" value="20" data-calc-percent></label>
<label>Mode<select data-calc-mode><option value="markup">Markup (dari harga beli)</option><option value="margin">Margin (dari harga jual)</option></select></label></div>
<p class="balance-note"><strong data-calc-result>-</strong></p></section>
<section class="card"><h2>Barang susut terakhir</h2>${waste}</section></div>`,
  });
}

export function reportsPage(ctx, r) {
  const qs = new URLSearchParams({ period: r.period, offset: String(r.offset), from: r.from, to: r.to });
  const shift = (delta) => `/laporan?${new URLSearchParams({ period: r.period, offset: String(r.offset + delta) })}`;
  const categories = r.categories.length
    ? `<ul class="plain-list">${r.categories.map(([name, amount]) => `<li><span>${esc(name)}</span><strong>${rupiah(amount)}</strong></li>`).join('')}</ul>`
    : '<p class="empty">Belum ada pengeluaran.</p>';

  return layout(ctx, {
    title: 'Laporan',
    subtitle: `${formatDate(r.from)} – ${formatDate(r.to)}`,
    action: `<div class="actions no-print"><a class="btn secondary" href="/laporan/csv?${esc(qs.toString())}">Unduh CSV</a><button class="btn secondary" type="button" data-print>Cetak</button></div>`,
    body: `<form method="get" action="/laporan" class="card filter-row no-print">
<label>Periode<select name="period">${options(['day', 'week', 'month'], r.period, { day: 'Harian', week: 'Mingguan', month: 'Bulanan' })}</select></label>
<label>Dari<input type="date" name="from" value="${esc(r.from)}"></label><label>Sampai<input type="date" name="to" value="${esc(r.to)}"></label>
<button class="btn secondary" type="submit">Tampilkan</button>
<a class="btn small secondary" href="${esc(shift(-1))}">← Sebelumnya</a><a class="btn small secondary" href="${esc(shift(1))}">Berikutnya →</a></form>
<div class="stats"><article class="stat"><span>Uang masuk</span><strong>${rupiah(r.summary.income)}</strong></article>
<article class="stat"><span>Biaya usaha</span><strong>${rupiah(r.summary.business_expense)}</strong></article>
<article class="stat"><span>Pribadi (prive)</span><strong>${rupiah(r.summary.prive)}</strong></article>
<article class="stat featured"><span>Untung usaha</span><strong>${rupiah(r.summary.profit)}</strong><small>Nilai barang susut ${rupiah(r.wasteCost)} dicatat terpisah</small></article></div>
<div class="grid wide"><section class="card"><h2>Arus kas harian</h2>${chart(r.days)}</section><section class="card"><h2>Pengeluaran per kategori</h2>${categories}</section></div>
<section class="card no-pad"><div class="section-heading padded"><h2>Rincian transaksi</h2></div>${transactionList(ctx, r.transactions)}</section>`,
  });
}

export function settingsPage(ctx) {
  const u = ctx.user;
  return layout(ctx, {
    title: 'Pengaturan',
    subtitle: 'Profil usaha, keamanan, dan cadangan data.',
    body: `<div class="grid two">
<section class="card"><h2>Profil usaha</h2>${form(ctx, {
      action: '/pengaturan',
      method: 'PUT',
      body: `<label>Nama pemilik<input name="name" value="${esc(u.name)}" maxlength="100" required></label>
<label>Nama usaha<input name="business_name" value="${esc(u.business_name)}" maxlength="150" required></label>
<label>Nomor HP<input name="phone" type="tel" value="${esc(u.is_demo ? '' : u.phone)}" maxlength="20" required></label>
<label>Modal kas awal (Rp)<input name="starting_cash" type="number" min="0" step="1" value="${u.starting_cash}" required></label>
<div class="fields two"><label>Tema<select name="theme">${options(['light', 'dark'], u.theme, { light: 'Terang', dark: 'Gelap' })}</select></label>
<label>Ukuran huruf<select name="font_size">${options(['normal', 'large'], u.font_size, { normal: 'Normal', large: 'Besar' })}</select></label></div>
<button class="btn primary" type="submit">Simpan pengaturan</button>`,
    })}</section>
<section class="card"><h2>Ganti PIN</h2>${form(ctx, {
      action: '/pengaturan/pin',
      method: 'PUT',
      body: `<label>PIN saat ini<input name="current_pin" type="password" inputmode="numeric" maxlength="4" autocomplete="current-password" required></label>
<label>PIN baru<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="new-password" required></label>
<label>Ulangi PIN baru<input name="pin_confirmation" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="new-password" required></label>
<button class="btn primary" type="submit">Perbarui PIN</button>`,
    })}</section>
<section class="card"><h2>Cadangan data</h2><p>Unduh seluruh pembukuan sebagai file JSON. Simpan di tempat aman.</p><a class="btn secondary" href="/pengaturan/cadangan">Unduh cadangan</a>
<hr><h3>Impor pembukuan</h3><p>Hanya bisa dilakukan saat pembukuan akun ini masih kosong.</p>
${form(ctx, {
      action: '/pengaturan/impor',
      dataAttr: 'data-import-form',
      body: `<input type="hidden" name="payload" data-import-payload>
<label>File cadangan (.json)<input type="file" accept=".json,application/json" data-import-file></label>
<button class="btn secondary" type="submit">Impor dari file</button>
<button class="btn secondary" type="button" data-import-legacy>Impor data lama dari browser ini</button>
<p class="hint" data-import-status></p>`,
    })}</section>
<section class="card danger-zone"><h2>Zona berbahaya</h2><p>Ketik <strong>HAPUS</strong> untuk melanjutkan. Tindakan ini tidak bisa dibatalkan.</p>
${form(ctx, { action: '/pengaturan/data', method: 'DELETE', confirm: 'Kosongkan seluruh pembukuan akun ini?', body: '<label>Konfirmasi<input name="confirmation" required pattern="HAPUS" placeholder="HAPUS"></label><button class="btn danger" type="submit">Kosongkan pembukuan</button>' })}
<hr>${form(ctx, { action: '/pengaturan/reset', confirm: 'Ganti seluruh pembukuan dengan data contoh?', body: '<label>Konfirmasi<input name="confirmation" required pattern="HAPUS" placeholder="HAPUS"></label><button class="btn secondary" type="submit">Muat data contoh</button>' })}</section>
</div>`,
  });
}

export function errorPage(ctx, status, message) {
  const body = `<section class="card"><h2>${status === 404 ? 'Halaman tidak ditemukan' : 'Terjadi kesalahan'}</h2><p>${esc(message)}</p><a class="btn secondary" href="/">Kembali ke beranda</a></section>`;
  return layout(ctx, { title: status === 404 ? 'Tidak ditemukan' : 'Kesalahan', body: ctx.user ? body : `<div class="welcome">${brand}${body}</div>` });
}
