# PasarKu — Laravel & Blade

Pembukuan untuk pedagang pasar: transaksi pemasukan/pengeluaran, piutang dan utang dengan pembayaran cicilan, stok, laporan, CSV, serta cadangan JSON.

Aplikasi utama sekarang menggunakan **Laravel 13 + Blade**, menggantikan React/Vite. Halaman dirender di server. CSS dan JavaScript kecil dilayani langsung dari public/. Tidak memerlukan Node.js, npm, CDN, atau build aset frontend. Database awal memakai SQLite dan data dipisahkan per akun.

## Persyaratan

- PHP **8.3+** dengan ekstensi Laravel, pdo_sqlite, sqlite3, dan fileinfo.
- Composer 2.
- Untuk produksi, server web yang menjalankan PHP dan document root/Alias ke direktori **public/**.

PHP XAMPP 8.2 yang ditemukan pada komputer pengembangan belum memenuhi versi minimum. Gunakan PHP 8.3/8.4; jangan mengabaikan pemeriksaan platform Composer. Lock file diselesaikan dengan target PHP 8.3 agar tidak memilih dependency yang hanya mendukung PHP 8.4.

## Menjalankan lokal

Jalankan composer install. Pada instalasi pertama, salin .env.example menjadi .env, buat database/database.sqlite, lalu jalankan:

    php artisan key:generate
    php artisan migrate
    php artisan serve

PowerShell untuk membuat berkas awal:

    Copy-Item .env.example .env
    New-Item -ItemType File database/database.sqlite

Linux/macOS:

    cp .env.example .env
    touch database/database.sqlite

Buka http://127.0.0.1:8000. Daftar akun dengan nomor HP dan PIN 4 angka, atau gunakan tombol **Coba demo Lapak Bu Sari**. Setiap login demo mendapat dataset terpisah. Tidak ada PIN demo bersama yang membuka pembukuan pengunjung lain.

## Fitur

- Beranda: saldo kas, untung harian, arus kas, kasbon terlambat, dan stok menipis.
- Transaksi: tambah/ubah/hapus, pencarian, pengurutan, dan filter tanggal. Penjualan belum dibayar menjadi piutang, bukan uang kas.
- Kasbon: piutang pelanggan, utang supplier, status jatuh tempo, riwayat cicilan, dan tautan WhatsApp.
- Pembayaran kasbon dan perubahan saldo dilakukan dalam satu database transaction. Pembayaran berlebih ditolak. Transaksi otomatis tidak dapat diedit/dihapus terpisah dari tagihannya.
- Stok: jumlah pecahan dua desimal, stok masuk dengan pengeluaran opsional, barang susut, dan kalkulator margin/markup.
- Laporan harian/mingguan/bulanan/rentang tanggal, tabel angka grafik, CSV UTF-8 untuk Excel, dan tampilan cetak.
- Profil usaha, modal awal, perubahan PIN, tema terang/gelap, serta tulisan besar.
- Cadangan JSON dan pemulihan ke akun kosong; impor pembukuan localStorage versi React.

Uang disimpan sebagai integer Rupiah. Saldo kas = modal awal + pemasukan − seluruh pengeluaran. Untung usaha = pemasukan − biaya usaha. Pribadi (prive) mengurangi kas tetapi tidak mengurangi untung usaha. Ringkasan ini berbasis arus kas, bukan akuntansi HPP per barang terjual. Nilai barang susut dilaporkan terpisah.

## Memindahkan data React

Data lama tetap berada pada browser/origin semula. Setelah daftar akun Laravel baru pada origin yang sama, buka **Pengaturan → Impor pembukuan → Impor data lama dari browser ini**. Aplikasi mengenali kunci pasarku:transactions, pasarku:debts, pasarku:products, pasarku:wasteLogs, modal awal, serta pengaturan tampilan. PIN dan status login lama tidak diimpor.

Impor hanya diizinkan ketika pembukuan akun kosong. Data diperiksa dan disimpan secara atomik; input tidak valid tidak menghasilkan impor sebagian. Simpan cadangan dan verifikasi hasil sebelum menghapus data browser lama. Jika perangkat/origin berbeda (termasuk port dan protokol), gunakan cadangan JSON.

## Pengujian

    php artisan test
    php artisan view:cache
    composer validate --strict --no-check-publish

Tes memakai SQLite :memory: dengan konfigurasi testing yang dipaksakan dalam phpunit.xml. Cakupan: autentikasi/hash PIN, pembatasan login, CSRF, pemisahan akun, saldo/prive, kasbon, stok/susut, laporan/CSV, HTML escaping, impor atomik, serta backup/restore. Tidak memakai database produksi.

Pengujian dilakukan melalui HTTP/tes framework, tanpa computer use. Responsivitas visual serta interaksi JavaScript perlu diperiksa manual pada browser pengguna.

## Jenkins dan server

Lihat [panduan deployment](deploy/README.md). Tersedia Jenkinsfile, deploy/jenkins.sh, deploy/ci.sh, deploy/siapkan-server.sh, contoh .env produksi, dan Alias Apache untuk /pasarku/.

Seluruh proyek Laravel tidak boleh dilayani sebagai document root: hanya direktori public/ yang tersedia melalui web. Jenkins menjalankan tes lebih dulu; bila lulus, kode disalin dengan rsync ke /var/www/html/pasarku tanpa menimpa .env dan database, lalu Composer, migrasi, dan cache dijalankan.

Kode React lama sudah dihapus dari branch main; riwayatnya tetap tersedia di Git dan branch development.
