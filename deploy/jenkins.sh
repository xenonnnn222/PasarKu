#!/usr/bin/env bash
# Langkah job Jenkins: tes, sinkronisasi workspace ke folder website, lalu siapkan Laravel.
# Isinya sama dengan "Execute shell" di job; lihat deploy/README.md.
# Butuh root (Jenkins di server ini berjalan sebagai root) untuk hak akses, cron, dan Apache.
set -euo pipefail

APP=/var/www/html/pasarku
OWNER=$(id -un)
APACHE_CONF=/etc/apache2/conf-available/pasarku.conf

[[ $EUID -eq 0 ]] || { echo "deploy/jenkins.sh butuh root (sekarang: $OWNER)." >&2; exit 1; }

# Tes dulu; kalau gagal, website tidak disentuh.
bash deploy/ci.sh

# Sinkronisasi workspace Jenkins ke folder website. .env dan database di server tidak ditimpa.
rsync -avz --exclude '.git' --exclude '.env' --exclude 'vendor' --exclude 'build' --exclude 'database/*.sqlite*' ./ "$APP/"

cd "$APP"
composer install --optimize-autoloader --no-dev --no-interaction

# Nilai .env server yang wajib sesuai standar audit (file .env tidak ikut rsync).
set_env() {
    if grep -q "^$1=" .env; then
        sed -i "s|^$1=.*|$1=$2|" .env
    else
        printf '%s=%s\n' "$1" "$2" >>.env
    fi
}
set_env APP_ENV production
set_env APP_DEBUG false
set_env SESSION_LIFETIME 30
set_env SESSION_SECURE_COOKIE true

# Backup + uji pemulihan sebelum migrasi (salinan di /var/backups/pasarku, di luar folder website).
if [[ -f database/database.sqlite ]]; then
    bash deploy/backup-db.sh
    rm -f database/database.sqlite.bak   # salinan lama yang dulu disimpan di folder website
fi

php artisan migrate --force
php artisan optimize

# Hak akses minimum: kode hanya bisa dibaca web server; www-data hanya menulis
# storage/, bootstrap/cache/, dan database/. .env hanya bisa dibaca root dan www-data.
chown -R "$OWNER":www-data "$APP"
find "$APP" -type d -exec chmod 755 {} +
find "$APP" -type f -exec chmod 644 {} +
for dir in storage bootstrap/cache database; do
    chown -R www-data:www-data "$APP/$dir"
    find "$APP/$dir" -type d -exec chmod 775 {} +
    find "$APP/$dir" -type f -exec chmod 664 {} +
done
chown "$OWNER":www-data .env
chmod 640 .env

# Backup harian 02:15 dan rotasi log keamanan.
install -m 0644 deploy/cron-pasarku-backup /etc/cron.d/pasarku-backup
install -m 0644 deploy/logrotate-pasarku /etc/logrotate.d/pasarku

# Konfigurasi Apache: dipasang hanya bila berubah, dan dibatalkan bila configtest gagal.
if ! cmp -s deploy/apache-pasarku.conf "$APACHE_CONF"; then
    backup="$APACHE_CONF.bak-$(date +%Y%m%d%H%M%S)"
    [[ -f $APACHE_CONF ]] && cp -p "$APACHE_CONF" "$backup"
    install -m 0644 deploy/apache-pasarku.conf "$APACHE_CONF"
    a2enmod -q rewrite
    a2enconf -q pasarku
    if apache2ctl configtest; then
        systemctl reload apache2
        echo "Konfigurasi Apache diperbarui (cadangan: $backup)."
    else
        [[ -f $backup ]] && cp -p "$backup" "$APACHE_CONF"
        echo 'Konfigurasi Apache baru tidak valid; dikembalikan ke versi sebelumnya, Apache tidak di-reload.' >&2
        exit 1
    fi
fi

echo 'Deploy selesai.'
