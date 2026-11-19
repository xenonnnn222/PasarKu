#!/usr/bin/env bash
# Hak akses minimum PasarKu (temuan audit H4). Dipasang ke /usr/local/sbin/pasarku-fix-permissions.
# Dipicu otomatis oleh pasarku-permissions.path setiap kali deploy menulis ulang
# bootstrap/cache/config.php (php artisan optimize), lalu menunggu chown/chmod job selesai.
#   pasarku-fix-permissions          tunggu job selesai, lalu terapkan
#   pasarku-fix-permissions --now    langsung terapkan
set -euo pipefail

APP=/var/www/html/pasarku
OWNER=root

[[ -d $APP ]] || exit 0

if [[ ${1:-} != --now ]]; then
    # Job Jenkins menjalankan chown -R www-data dan chmod -R 775 sesudah optimize.
    sleep 5
    for _ in $(seq 1 60); do
        pgrep -f "(chown|chmod) -R .*$APP" >/dev/null || break
        sleep 2
    done
fi

# Kode: milik root, grup www-data, hanya bisa dibaca web server.
chown -R "$OWNER":www-data "$APP"
find "$APP" -type d -exec chmod 755 {} +
find "$APP" -type f -exec chmod 644 {} +

# Yang memang harus ditulis Laravel: log, sesi, cache, view, database SQLite.
for dir in storage bootstrap/cache database; do
    [[ -d $APP/$dir ]] || continue
    chown -R www-data:www-data "$APP/$dir"
    find "$APP/$dir" -type d -exec chmod 775 {} +
    find "$APP/$dir" -type f -exec chmod 664 {} +
done

# Rahasia aplikasi: hanya root dan grup www-data yang bisa membaca.
if [[ -f $APP/.env ]]; then
    chown "$OWNER":www-data "$APP/.env"
    chmod 640 "$APP/.env"
fi

logger -t pasarku-permissions 'Hak akses minimum diterapkan.' 2>/dev/null || true
echo 'Hak akses minimum diterapkan.'
