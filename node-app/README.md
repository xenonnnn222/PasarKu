# PasarKu (Node.js)

Pembukuan untuk pedagang pasar: transaksi, kasbon (piutang & utang) dengan cicilan, stok, laporan, CSV, dan cadangan JSON.

Versi ini ditulis ulang dari versi Laravel dengan **JavaScript saja**:

- Server: Node.js bawaan (`node:http`), tanpa Express.
- Database: SQLite bawaan Node (`node:sqlite`), satu file di `data/pasarku.sqlite`.
- Tampilan: HTML dirender di server + sedikit JavaScript biasa di `public/js/app.js`.
- **Tidak ada dependensi npm.** Tidak perlu `npm install`, PHP, Composer, atau MySQL.

## Menjalankan

Butuh Node.js **22.13 atau lebih baru** (disarankan Node 24).

```bash
cd node-app
npm start
```

Buka http://127.0.0.1:8000. Daftar dengan nomor HP dan PIN 4 angka, atau klik **Coba demo Lapak Bu Sari**.

Pengaturan lewat environment variable (opsional):

| Variabel | Bawaan | Keterangan |
| --- | --- | --- |
| `PORT` | `8000` | Port server |
| `HOST` | `127.0.0.1` | Pakai `0.0.0.0` agar bisa diakses dari perangkat lain |
| `DB_PATH` | `data/pasarku.sqlite` | Lokasi file database |
| `SECURE_COOKIES` | `false` | Isi `true` bila dilayani lewat HTTPS |

## Tes

```bash
npm test
```

Tes memakai database di memori dan menjalankan server sungguhan: daftar/masuk, CSRF, pemisahan akun, saldo dan prive, kasbon, stok, laporan CSV, cadangan/pemulihan, escaping HTML, dan semua halaman.

## Struktur kode

```
src/
  server.js          titik masuk: membuka database dan menjalankan server
  app.js             alur request: cookie, CSRF, sesi, rute, respons, error
  config.js          pengaturan dari environment
  db.js              skema SQLite dan transaksi database
  domain.js          aturan usaha: kategori, satuan, uang, tanggal, validasi
  security.js        hash PIN (scrypt), token, escape HTML, pembatas percobaan
  errors.js          ValidationError dan HttpError
  services/          logika usaha per fitur (tanpa HTML)
    accounts.js      daftar, masuk, sesi, demo, profil, PIN
    transactions.js  transaksi dan saldo kas
    debts.js         kasbon dan cicilan
    stock.js         barang, stok masuk, susut
    reports.js       laporan, CSV, ringkasan beranda
    backup.js        ekspor/impor JSON, kosongkan data, data demo
  web/               lapisan web
    routes.js        tabel URL → handler
    pages.js         halaman HTML
    views.js         layout dan komponen HTML
    http.js          baca form, cookie, file statis, header keamanan
public/              CSS, JavaScript, ikon
test/                tes otomatis (node:test)
```

## Aturan pembukuan

- Uang disimpan sebagai bilangan bulat Rupiah.
- Saldo kas = modal awal + uang masuk − semua uang keluar.
- Untung usaha = uang masuk − biaya usaha. Pengeluaran **Pribadi (prive)** mengurangi kas, tetapi tidak mengurangi untung.
- Penjualan yang belum dibayar menjadi piutang, bukan kas.
- Pembayaran kasbon membuat transaksi kas otomatis. Transaksi otomatis tidak bisa diubah atau dihapus terpisah.
- Kasbon yang sudah dicicil tidak bisa dihapus.

## Memindahkan data

- **Dari versi Laravel:** unduh cadangan di Pengaturan versi Laravel, lalu impor file JSON-nya di Pengaturan versi ini. Formatnya sama (`schemaVersion: 2`).
- **Dari versi React lama (localStorage):** buka aplikasi ini di browser dan alamat yang sama, lalu klik **Impor data lama dari browser ini** di Pengaturan.

Impor hanya bisa dilakukan saat pembukuan akun masih kosong.
