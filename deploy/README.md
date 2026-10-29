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
| `php artisan migrate --force` | Memperbarui skema database |
| `php artisan optimize` | Cache konfigurasi, route, dan view |
| `chown -R www-data:www-data` | Folder dimiliki user web server |
| `chmod -R 775 storage` dan `bootstrap/cache` | Laravel dapat menulis log, sesi, dan cache |

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
