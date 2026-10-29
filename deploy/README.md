# Deployment PasarKu Laravel

Laravel memerlukan PHP **8.3 atau lebih baru** serta Composer pada agent Jenkins dan server web. Versi React sebelumnya hanya membutuhkan static hosting; konfigurasi web server sekarang harus menjalankan PHP dan mengarah ke **public/**. Node.js dan npm tidak digunakan.

## 1. Siapkan lingkungan server sekali

Pastikan ekstensi PHP `ctype`, `curl`, `dom`, `fileinfo`, `filter`, `hash`, `mbstring`, `openssl`, `pcre`, `PDO`, `pdo_sqlite`, `session`, `tokenizer`, `xml`, `sqlite3`, dan `zip` tersedia. Periksa dengan `php -v`, `php -m`, dan `composer --version` dalam lingkungan agent Jenkins yang menjalankan job. Untuk Jenkins dalam container, instal dependensi pada image container tersebut dan pastikan folder deployment dapat dijangkau server web.

Skrip contoh menempatkan aplikasi di `/var/www/pasarku`, terpisah dari document root Apache. Struktur setelah deployment:

```text
/var/www/pasarku/
  releases/<waktu>-<commit>/   kode setiap rilis
  current -> releases/...    rilis yang sedang dilayani
  shared/.env                konfigurasi dan APP_KEY tetap
  shared/database.sqlite     database tetap
  shared/storage/            session, cache, dan log tetap
  shared/backups/            cadangan SQLite sebelum migrasi
```

Administrator menyiapkan folder untuk pengguna OS yang benar-benar menjalankan agent Jenkins. Nama berikut adalah contoh; periksa menggunakan `id` pada agent (label `Running as SYSTEM` di Jenkins bukan nama akun Linux):

```bash
sudo install -d -o jenkins -g www-data -m 2770 /var/www/pasarku
sudo install -d -o jenkins -g www-data -m 2770 /var/www/pasarku/shared
sudo install -o jenkins -g www-data -m 640 deploy/.env.production.example /var/www/pasarku/shared/.env
```

Tambahkan pengguna agent ke grup web jika diperlukan, lalu mulai ulang service/agent agar keanggotaan grup diperbarui. Jika agent berjalan sebagai root, sesuaikan pemilik folder dan rencana penggunaan akun service sebelum penggunaan produksi. Jangan menyalin `.env.example` pada setiap build: `APP_KEY` dan database harus bertahan antar-rilis. Skrip hanya membuat APP_KEY saat nilainya masih kosong.

## 2. Konfigurasi Apache

Gunakan `apache-pasarku.conf` sebagai konfigurasi Alias, bukan menyalin seluruh Laravel ke document root. Alias mempertahankan URL `/registration-mis/` dan menunjuk ke `/var/www/pasarku/current/public`.

```bash
sudo cp deploy/apache-pasarku.conf /etc/apache2/conf-available/pasarku.conf
sudo a2enmod rewrite
# Aktifkan Alias setelah rilis Laravel pertama berhasil dibuat oleh Jenkins:
sudo a2enconf pasarku
sudo apachectl configtest
sudo systemctl reload apache2
```

Siapkan berkas konfigurasi terlebih dahulu, tetapi tunggu sampai deployment pertama menghasilkan `current/public` sebelum mengaktifkan Alias dan me-reload Apache. Dengan begitu alamat lama tetap dilayani selama persiapan. PHP 8.3+ harus sudah dikonfigurasi pada Apache (mod_php atau PHP-FPM). Jika web server menggunakan Nginx, gunakan document root `current/public` dan konfigurasi PHP-FPM yang sesuai; berkas Apache di atas tidak berlaku. Dokumentasi resmi: https://laravel.com/framework/docs/deployment .

## 3. Ganti job Jenkins

Untuk job Freestyle yang sekarang dipakai, ganti seluruh **Execute shell** dengan:

```bash
#!/usr/bin/env bash
set -euo pipefail
bash deploy/ci.sh
bash deploy/deploy.sh
```

Tambahkan **Publish JUnit test result report** dengan pola `build/junit.xml` bila plugin JUnit tersedia. Tetap gunakan repository dan branch `main`, serta **GitHub hook trigger for GITScm polling**. Profil NodeJS lama boleh dinonaktifkan karena tidak digunakan. Hindari concurrent builds untuk job ini; skrip deployment juga memakai `flock` untuk mencegah dua proses deployment berjalan bersamaan.

Alternatif: gunakan **Pipeline script from SCM** dengan `Jenkinsfile` yang tersedia. Stage deployment hanya berjalan untuk `main`; branch migrasi menjalankan tes saja.

CI menjalankan Composer validation, dependency installation, platform checks,  tes HTTP/fitur, dan kompilasi Blade. Deployment memeriksa penanda bahwa commit yang sama sudah lulus CI dan checkout bersih. Rilis baru baru dipublikasikan setelah dependency, migrasi, dan cache berhasil. Jika tes gagal, tidak ada penyalinan rilis ke server.

## 4. Verifikasi dan data lama

Setelah build SUCCESS, buka `http://103.139.193.51/registration-mis/up`, lalu `/registration-mis/login`. Daftar akun Laravel baru. Buka **Pengaturan → Impor pembukuan** pada browser dan origin yang sama dengan versi React untuk memindahkan data localStorage. Gunakan file cadangan JSON bila berpindah perangkat/origin. Data React tidak otomatis terkirim ke server; PIN lama tidak diimpor. Pembukuan akun harus kosong sebelum impor untuk mencegah penimpaan data.

Uji transaksi baru, pembayaran kasbon, stok masuk/susut, ekspor CSV, dan login ulang. Hasil JUnit menjadi bukti pengujian CI/CD. URL aset dibuat oleh Laravel melalui `asset()` dan `route()`, termasuk prefix subfolder ketika Alias Apache benar.

## Pemulihan rilis

Rilis lama tetap berada di `releases/`; administrator dapat mengarahkan `current` ke rilis sebelumnya. Perubahan database tidak dibatalkan oleh pergantian symlink. Gunakan cadangan SQLite jika perlu memulihkan data dan hentikan penulisan selama pemulihan. Jangan menjalankan `migrate:fresh`, `db:wipe`, atau mengganti APP_KEY pada database produksi yang berisi data.

Skrip ini disiapkan dan diuji sintaksnya secara lokal. Instalasi PHP/Composer, konfigurasi Apache, izin filesystem Linux, dan deployment pada server harus diverifikasi di lingkungan server sebelum merge ke `main`.
