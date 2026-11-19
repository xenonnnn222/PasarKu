# Deployment PasarKu Laravel

Laravel memerlukan PHP **8.3 atau lebih baru** serta Composer di server tempat Jenkins berjalan. Node.js dan npm tidak digunakan.

Alur CI/CD: push ke GitHub → Jenkins mengambil kode ke workspace → tes (`deploy/ci.sh`) → `rsync` ke `/var/www/html/pasarku` → `composer install`, migrasi, cache, dan hak akses → website `https://dragonfruitdevops.web.id/pasarku/`.

## 1. Siapkan server sekali

```bash
sudo bash deploy/siapkan-server.sh
```

Skrip ini memasang PHP 8.3-FPM (PPA ondrej/php, ditambahkan manual dengan pemeriksaan sidik jari kunci), Composer (dengan pemeriksaan checksum), modul Apache, serta membuat `/var/www/html/pasarku/.env` beserta `APP_KEY` dan `database/database.sqlite`. Keduanya hanya dibuat sekali; `rsync` Jenkins tidak menimpanya.

## 2. Job Jenkins

Di job Freestyle, **Execute shell** berisi:

```bash
bash deploy/jenkins.sh
```

`deploy/jenkins.sh` menjalankan langkah berikut:

| Perintah | Fungsi |
|---|---|
| `bash deploy/ci.sh` | Tes Laravel; jika gagal, langkah berikutnya tidak dijalankan |
| `rsync -avz --exclude '.git' --exclude '.env' ... ./ /var/www/html/pasarku/` | Menyalin workspace Jenkins ke folder website; `.git`, `.env`, `vendor`, `build`, dan database tidak ikut |
| `composer install --optimize-autoloader --no-dev` | Memasang library PHP produksi |
| `set_env ...` | Memastikan `.env` server: `APP_ENV=production`, `APP_DEBUG=false`, `SESSION_LIFETIME=30`, `SESSION_SECURE_COOKIE=true` |
| `bash deploy/backup-db.sh` | Backup database + uji pemulihan ke `/var/backups/pasarku` sebelum migrasi |
| `php artisan migrate --force` | Memperbarui skema database |
| `php artisan optimize` | Cache konfigurasi, route, dan view |
| `chown` / `chmod` | Kode 755/644 milik user Jenkins (grup `www-data`, hanya baca); `storage`, `bootstrap/cache`, `database` 775/664 milik `www-data`; `.env` 640 |
| `/etc/cron.d/pasarku-backup`, `/etc/logrotate.d/pasarku` | Backup harian 02:15 dan rotasi log |
| `apache-pasarku.conf` → `/etc/apache2/conf-available/pasarku.conf` | Dipasang bila berubah; dibatalkan otomatis bila `apache2ctl configtest` gagal |

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
