# Deployment PasarKu Laravel

Laravel memerlukan PHP **8.3 atau lebih baru** serta Composer di server tempat Jenkins berjalan. Node.js dan npm tidak digunakan.

Alur CI/CD: push ke GitHub → Jenkins mengambil kode ke workspace → tes (`deploy/ci.sh`) → `rsync` ke `/var/www/html/pasarku` → `composer install`, migrasi, cache, dan hak akses → website `https://dragonfruitdevops.web.id/pasarku/`.

## 1. Siapkan server sekali

```bash
sudo bash deploy/siapkan-server.sh
```

Skrip ini memasang PHP 8.3-FPM (PPA ondrej/php, ditambahkan manual dengan pemeriksaan sidik jari kunci), Composer (dengan pemeriksaan checksum), modul Apache, serta membuat `/var/www/html/pasarku/.env` beserta `APP_KEY` dan `database/database.sqlite`. Keduanya hanya dibuat sekali; `rsync` Jenkins tidak menimpanya.

## 2. Job Jenkins

Execute shell job Freestyle **tidak diubah** dan tetap berisi langkah berikut (Jenkins berjalan sebagai root):

```bash
bash deploy/ci.sh
rsync -avz --exclude .git --exclude .env --exclude vendor --exclude build --exclude 'database/*.sqlite*' ./ /var/www/html/pasarku/
cd /var/www/html/pasarku
composer install --optimize-autoloader --no-dev --no-interaction
php artisan migrate --force
php artisan optimize
chown -R www-data:www-data /var/www/html/pasarku
chmod -R 775 /var/www/html/pasarku/storage
chmod -R 775 /var/www/html/pasarku/bootstrap/cache
```

Semua perbaikan keamanan dijalankan dari dalam `deploy/ci.sh`, sehingga ikut berjalan tanpa mengubah job:

| Urutan | Langkah | Fungsi |
|---|---|---|
| 1 | Tes di `deploy/ci.sh` | Pint, PHPUnit, kompilasi Blade. Bila gagal, langkah berikutnya tidak dijalankan |
| 2 | Bersihkan workspace (akhir `ci.sh`) | Log tes, view hasil kompilasi, `node_modules`, `dist` dihapus agar tidak ikut di-rsync |
| 3 | `deploy/server-setup.sh` (akhir `ci.sh`) | `.env` produksi (`APP_DEBUG=false`, `SESSION_LIFETIME=30`), backup + uji pemulihan, cron backup harian, logrotate, konfigurasi Apache (dibatalkan bila `configtest` gagal), unit systemd hak akses |
| 4 | rsync, composer, migrate, optimize | Langkah job seperti biasa; `optimize` membaca `.env` yang sudah diperbarui |
| 5 | `chown`/`chmod` job | Membuat semua file milik www-data (bawaan job) |
| 6 | `pasarku-permissions.path` | Terpicu saat `optimize` menulis config cache; setelah `chown`/`chmod` job selesai, `pasarku-fix-permissions` memasang hak akses minimum: kode 755/644 milik root, hanya `storage`, `bootstrap/cache`, `database` yang bisa ditulis www-data, `.env` 640 |

Skrip yang dijalankan root (`pasarku-backup`, `pasarku-fix-permissions`) disalin ke `/usr/local/sbin`, bukan dijalankan dari folder website, agar tidak bisa diubah oleh web server.

`deploy/jenkins.sh` berisi langkah yang sama dalam satu skrip, untuk job baru atau deploy manual.

Jenkins harus berjalan sebagai root (skrip berhenti dengan pesan jelas bila tidak).

Aktifkan **GitHub hook trigger for GITScm polling** agar push memicu build otomatis. Tambahkan **Publish JUnit test result report** dengan pola `build/junit.xml` bila plugin JUnit tersedia.

## 3. Konfigurasi Apache

`/var/www/html/pasarku` berada di dalam document root Apache, sehingga `apache-pasarku.conf` **menutup seluruh folder kecuali `public/`**. Tanpa ini, `.env`, database, dan log dapat diunduh dari browser.

Pasang setelah build Jenkins pertama SUCCESS:

```bash
test -f /var/www/html/pasarku/public/index.php
sudo cp /etc/apache2/conf-available/pasarku.conf /etc/apache2/conf-available/pasarku.conf.sebelum-laravel
sudo cp deploy/apache-pasarku.conf /etc/apache2/conf-available/pasarku.conf
sudo apache2ctl configtest && sudo systemctl reload apache2
```

Untuk membatalkan, salin balik `pasarku.conf.sebelum-laravel` lalu reload. Handler PHP 8.3-FPM hanya berlaku di folder PasarKu, dan aturan rewrite ada di konfigurasi Apache (bukan `.htaccess`) karena Alias memerlukan `RewriteBase /pasarku/`.

## 4. Verifikasi

Buka `https://dragonfruitdevops.web.id/pasarku/up`, lalu `/pasarku/login`, dan daftar akun baru. Pastikan `https://dragonfruitdevops.web.id/pasarku/.env` tidak dapat diunduh. Aplikasi harus dibuka lewat HTTPS karena cookie sesi diset `secure`.

Bila punya data dari versi lama, gunakan **Pengaturan → Impor pembukuan** dengan file cadangan JSON. Pembukuan akun harus kosong sebelum impor.

Jangan menjalankan `migrate:fresh`, `db:wipe`, atau mengganti `APP_KEY` pada database yang berisi data. Salin `database/database.sqlite` sebelum perubahan besar.

## 5. Keamanan (hasil audit OWASP)

### Otomatis lewat Jenkins

- **Header keamanan** (`app/Http/Middleware/SecurityHeaders.php`): Content-Security-Policy, Strict-Transport-Security (HTTPS), Permissions-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Cross-Origin-Opener-Policy.
- **Hanya HTTPS domain**: `apache-pasarku.conf` mengalihkan akses lewat IP atau HTTP biasa (mis. `http://103.139.193.51/pasarku/login`) ke `https://dragonfruitdevops.web.id/pasarku/...`, dan menyembunyikan versi Apache (`ServerTokens Prod`).
- **Sesi 30 menit** tanpa aktivitas.
- **Log keamanan** `storage/logs/security.log`: login, logout, dan login gagal (nomor HP disamarkan, IP dicatat).
- **Backup harian** + uji pemulihan otomatis (`PRAGMA integrity_check` dan hitung isi tabel) di `/var/backups/pasarku`, disimpan 14 hari. Log: `/var/log/pasarku-backup.log`.

Agar backup juga tersimpan di **server lain**, buat `/etc/default/pasarku-backup`:

```bash
BACKUP_REMOTE=user@server-backup:/srv/backup/pasarku/
```

lalu pasang SSH key root ke server tujuan (`sudo ssh-copy-id user@server-backup`).

Memulihkan backup:

```bash
sudo ls -lt /var/backups/pasarku | head
sudo gunzip -c /var/backups/pasarku/pasarku-TANGGAL.sqlite.gz > /tmp/restore.sqlite
sudo systemctl stop php8.3-fpm
sudo cp /var/www/html/pasarku/database/database.sqlite /var/www/html/pasarku/database/database.sqlite.sebelum-restore
sudo install -o www-data -g www-data -m 664 /tmp/restore.sqlite /var/www/html/pasarku/database/database.sqlite
sudo rm -f /var/www/html/pasarku/database/database.sqlite-wal /var/www/html/pasarku/database/database.sqlite-shm
sudo systemctl start php8.3-fpm
```

### Manual sekali: hardening server

SSH, firewall, Fail2Ban, dan PHP-FPM diubah lewat skrip terpisah karena salah konfigurasi SSH bisa mengunci akses. **Pastikan SSH key sudah terpasang** (`ssh-copy-id user@103.139.193.51`) dan login dengan key berhasil.

```bash
sudo SSH_PORT=2222 bash /var/www/html/pasarku/deploy/hardening-server.sh
```

Tahap ini menyalakan UFW (SSH 22 + 2222, 80, 443), Fail2Ban (jail `sshd` dan `pasarku-login`), menonaktifkan `exec`/`system`/`shell_exec`/`proc_open` dkk. di PHP-FPM, serta mematikan login SSH dengan password. Port 22 masih terbuka. Dari **terminal lain** uji `ssh -p 2222 user@103.139.193.51`; bila berhasil, tutup port 22:

```bash
sudo SSH_PORT=2222 bash /var/www/html/pasarku/deploy/hardening-server.sh --close-22
```

Bila provider VPS punya firewall di panel, buka port 2222 di sana juga. Cek hasil: `sudo ufw status verbose`, `sudo fail2ban-client status pasarku-login`, `php-fpm8.3 -i | grep disable_functions`.
