# PasarKu - Dashboard Keuangan Pedagang Pasar

Website dashboard keuangan *desktop-first* yang bersih, teratur, dan responsif untuk membantu pedagang pasar tradisional mencatat transaksi harian, mengelola kasbon (piutang pelanggan & utang supplier), memantau stok dagangan, serta melihat laporan keuntungan usaha.

## Cara Menjalankan
1. Pastikan Node.js (v18+) sudah terpasang.
2. Instal dependensi dan jalankan server pengembangan:
   ```bash
   npm install
   npm run dev
   ```
3. Buka URL lokal yang tampil di terminal (umumnya `http://localhost:5173`).

## Cara Build Produksi
```bash
npm run build
npm run preview
```

## Akun Demo & Penyimpanan
- **Penyimpanan**: Aplikasi ini murni *Front-End* tanpa backend. Seluruh data disimpan secara aman di `localStorage` browser dengan prefiks `pasarku:`.
- **Akun Demo Cepat**: Klik tombol **"Masuk sebagai Demo (Lapak Sayur Bu Sari)"** di halaman Login, atau masukkan Nomor HP `081234567890` dan PIN `1234`.

## Arsitektur & Fitur Utama
- **Layout Desktop-First (Grid 12 Kolom)**: Sidebar navigasi kiri tetap (`256px`), Topbar dengan pencarian cepat dan tanggal hari ini, serta container konten maksimal `1280px`. Di layar `< 768px`, sidebar otomatis menjadi menu *hamburger* dan tabel berubah menjadi kartu.
- **Beranda**: 4 kartu ringkasan sejajar (*Saldo Kas*, *Untung Hari Ini*, *Uang Masuk*, *Uang Keluar*), grafik batang untung 7 hari terakhir, tabel transaksi terakhir yang dapat diurutkan (*sortable*), aksi cepat (*Jual* & *Belanja*), dan peringatan *Perlu Perhatian*.
- **Catat Transaksi**: Layout 2 kolom dengan input nominal teks terformat Rupiah secara otomatis (`Rp 150.000`), tombol tambah nominal cepat, kategori ikon, toggle *Belum dibayar (kasbon)*, dan ringkasan transaksi hari ini di sisi kanan.
- **Kasbon & Riwayat Tabular**: Ditampilkan dalam komponen `DataTable` yang mendukung pengurutan kolom (*sorting*), pencarian, dan filter status/tanggal, serta modal di tengah layar untuk tambah/ubah/cicilan.
- **Stok & Kalkulator Harga Jual**: Tabel stok dengan kontrol `+/-` langsung di baris tabel, pencatatan *Stok Masuk* & *Barang Susut*, berdampingan dengan *Kalkulator Harga Jual* (*Margin* vs *Markup*).
- **Laporan Keuangan**: Ringkasan 4 kolom, grafik batang pemasukan vs pengeluaran berdampingan dengan grafik donat (*Donut Chart*) rincian pengeluaran per kategori, ekspor CSV ber-BOM UTF-8, dan mode cetak (`@media print`).
