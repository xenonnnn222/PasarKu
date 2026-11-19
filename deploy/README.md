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

### Otomatis lewat Jenkins (deploy/ci.sh → deploy/server-setup.sh)

- **Header keamanan** (`app/Http/Middleware/SecurityHeaders.php`): Content-Security-Policy tanpa `unsafe-inline`, Strict-Transport-Security (HTTPS), Permissions-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Cross-Origin-Opener-Policy. Tidak ada atribut `style` inline: lebar grafik memakai kelas `.w-N`/`.h-N` di `public/css/app.css`, halaman error memakai `resources/views/errors/`.
- **Hanya HTTPS domain**: `apache-pasarku.conf` mengalihkan akses lewat IP atau HTTP biasa ke `https://dragonfruitdevops.web.id/pasarku/...`; versi Apache disembunyikan.
- **Sesi 30 menit** tanpa aktivitas.
- **Peran pengguna**: `pemilik` (default) dan `admin`. Admin membuka `/pasarku/admin` untuk melihat daftar akun (tanpa data keuangan) dan menonaktifkan/mengaktifkan akun pemilik. Peran admin hanya diberikan dari server:
  ```bash
  cd /var/www/html/pasarku && sudo -u www-data php artisan pasarku:role 08xxxxxxxxxx admin
  ```
- **Log keamanan** `storage/logs/security.log`: login, logout, login gagal (nomor HP disamarkan), dan setiap aktivitas admin (juga di tabel `audit_logs`).
- **PHP-FPM khusus PasarKu** (`php-fpm-pool-pasarku.conf`): `exec`, `system`, `shell_exec`, `proc_open` dkk. dimatikan hanya untuk website ini; situs PHP lain dan CLI tidak terpengaruh.
- **Fail2Ban**: jail `sshd` dan `pasarku-login` (10 login gagal dalam 10 menit → IP diblokir 1 jam).
- **Monitoring log** (`deploy/monitor/`):
  - `pasarku-monitor.php` tiap 15 menit, berbasis aturan: brute force per IP, lonjakan login gagal, perubahan akun oleh admin → `/var/log/pasarku-monitor.log` dan syslog.
  - Analisis AI tiap 6 jam (G6), pilih salah satu:
    - **Dari laptop lewat 9router lokal** (`deploy/ai-monitor-local.ps1`): laptop mengambil ringkasan log lewat SSH (`--export`), menganalisisnya dengan model di 9router (`http://localhost:20128/v1`), lalu mengirim hasilnya kembali (`--record`) ke `/var/log/pasarku-ai-monitor.log`. Server tidak menyimpan kredensial AI.
      ```powershell
      # API key dari dashboard 9router, satu baris:
      notepad $env:USERPROFILE\.pasarku\9router.key
      powershell -ExecutionPolicy Bypass -File deployi-monitor-local.ps1            # sekali jalan
      powershell -ExecutionPolicy Bypass -File deployi-monitor-local.ps1 -Install   # jadwal tiap 6 jam
      ```
    - **Langsung dari server ke Claude API**: isi `ANTHROPIC_API_KEY=sk-ant-...` di `/etc/default/pasarku-monitor` (`--dry-run` untuk melihat data yang akan dikirim).

    Data yang dianalisis: jumlah login, IP dengan login gagal, user agent, aktivitas admin; nomor HP sudah disamarkan.
- **Backup harian** + uji pemulihan otomatis (`PRAGMA integrity_check` dan hitung isi tabel) di `/var/backups/pasarku`, disimpan 14 hari, dengan file `.sha256`. Log: `/var/log/pasarku-backup.log`.
- **Hak akses minimum** dipasang ulang unit systemd `pasarku-permissions` setiap job selesai.
- **Bukti audit**: setiap build mencetak blok `[audit]` di Console Output (permission, backup, Fail2Ban, SSH, PHP-FPM, monitoring).

### SSH: port baru dan hanya SSH key (I2, I8)

Deploy otomatis hanya **menambah** port 2222 (port 22 tetap terbuka, password tetap boleh), jadi tidak ada yang terkunci. Langkah akhir dilakukan sekali oleh Anda:

1. Bila provider VPS punya firewall di panel, buka port **2222**.
2. Buat SSH key di laptop (Windows PowerShell) dan pasang ke server:
   ```powershell
   ssh-keygen -t ed25519
   type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh -p 2222 root@103.139.193.51 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
   ```
3. Masuk lagi **lewat port 2222 dengan key** (tidak diminta password), lalu konfirmasi:
   ```bash
   ssh -p 2222 root@103.139.193.51
   sudo pasarku-ssh-confirm
   ```
   Perintah ini menolak berjalan bila sesi tidak masuk lewat port 2222 atau tidak login dengan key. Bila lolos, port 22 ditutup dan login password dimatikan. Membatalkan (dari konsol VPS): `sudo pasarku-ssh-confirm --undo`.

Port lain bisa diatur di `/etc/default/pasarku-ssh` (`SSH_PORT=2222`) sebelum deploy.

### Backup di mesin lain (J3)

Setelah SSH key terpasang, tarik backup ke laptop dan pasang jadwal hariannya:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\pull-backup.ps1
powershell -ExecutionPolicy Bypass -File deploy\pull-backup.ps1 -Install
```

Salinan tersimpan di `%USERPROFILE%\PasarKu-backup`, dicek SHA-256 dan format gzip, dan server mencatat waktu penarikan terakhir (`/var/backups/pasarku/.last-offsite-pull`, tampil di blok `[audit]`). Untuk mesin Linux lain: `deploy/pull-backup.sh`. Alternatif push ke server lain: `BACKUP_REMOTE=user@host:/path/` di `/etc/default/pasarku-backup`.

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

### Cek manual

```bash
sudo fail2ban-client status pasarku-login
sudo tail /var/log/pasarku-monitor.log /var/log/pasarku-ai-monitor.log
sudo sshd -T | grep -E '^(port|passwordauthentication) '
stat -c '%U:%G %a %n' /var/www/html/pasarku/.env /var/www/html/pasarku/app
```
