#!/usr/bin/env bash
# Persiapan server otomatis (idempoten) untuk PasarKu Laravel.
# Dipanggil oleh deploy/ci.sh di server Jenkins SETELAH tes lulus dan SEBELUM rsync job,
# sehingga Execute shell job Jenkins tidak perlu diubah. Bisa juga dijalankan manual:
#   sudo bash deploy/server-setup.sh
set -euo pipefail

APP=/var/www/html/pasarku
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APACHE_CONF=/etc/apache2/conf-available/pasarku.conf

log() { echo "[server-setup] $*"; }
[[ $EUID -eq 0 ]] || { echo 'server-setup.sh butuh root.' >&2; exit 1; }
[[ -d $APP ]] || { log "$APP belum ada; lewati."; exit 0; }

# 1. Skrip root disalin ke /usr/local/sbin (milik root), bukan dijalankan dari folder website
#    yang dimiliki www-data, agar web server tidak bisa mengubah skrip yang dijalankan root.
install -m 0755 "$HERE/backup-db.sh" /usr/local/sbin/pasarku-backup
install -m 0755 "$HERE/fix-permissions.sh" /usr/local/sbin/pasarku-fix-permissions

# 2. Nilai .env produksi yang wajib (file .env tidak ikut rsync).
if [[ -f $APP/.env ]]; then
    set_env() {
        if grep -q "^$1=" "$APP/.env"; then
            sed -i "s|^$1=.*|$1=$2|" "$APP/.env"
        else
            printf '%s=%s\n' "$1" "$2" >>"$APP/.env"
        fi
    }
    set_env APP_ENV production
    set_env APP_DEBUG false
    set_env SESSION_LIFETIME 30
    set_env SESSION_SECURE_COOKIE true
    log '.env: APP_ENV=production, APP_DEBUG=false, SESSION_LIFETIME=30.'
fi

# 3. Backup + uji pemulihan sebelum job menjalankan migrasi.
if [[ -f $APP/database/database.sqlite ]]; then
    /usr/local/sbin/pasarku-backup
    rm -f "$APP/database/database.sqlite.bak"   # salinan lama di dalam folder website
fi

# 4. Jadwal backup harian dan rotasi log.
install -m 0644 "$HERE/cron-pasarku-backup" /etc/cron.d/pasarku-backup
install -m 0644 "$HERE/logrotate-pasarku" /etc/logrotate.d/pasarku

# 5. Hak akses minimum dipasang ulang otomatis setiap kali job selesai deploy
#    (job diakhiri chown -R www-data + chmod -R 775 yang tidak boleh diubah).
units_changed=0
for unit in pasarku-permissions.path pasarku-permissions.service; do
    if ! cmp -s "$HERE/systemd/$unit" "/etc/systemd/system/$unit"; then
        install -m 0644 "$HERE/systemd/$unit" "/etc/systemd/system/$unit"
        units_changed=1
    fi
done
if [[ $units_changed -eq 1 ]]; then
    systemctl daemon-reload
    systemctl enable --now pasarku-permissions.path >/dev/null
    systemctl restart pasarku-permissions.path
    log 'Unit pasarku-permissions dipasang.'
fi

# 6. Apache: dipasang hanya bila berubah; dikembalikan bila configtest gagal.
if ! cmp -s "$HERE/apache-pasarku.conf" "$APACHE_CONF"; then
    backup="$APACHE_CONF.bak-$(date +%Y%m%d%H%M%S)"
    [[ -f $APACHE_CONF ]] && cp -p "$APACHE_CONF" "$backup"
    install -m 0644 "$HERE/apache-pasarku.conf" "$APACHE_CONF"
    a2enmod -q rewrite
    a2enconf -q pasarku
    if apache2ctl configtest; then
        systemctl reload apache2
        log "Apache diperbarui (cadangan: $backup)."
    else
        [[ -f $backup ]] && cp -p "$backup" "$APACHE_CONF"
        echo 'Konfigurasi Apache baru tidak valid; dikembalikan, Apache tidak di-reload.' >&2
        exit 1
    fi
fi

# 6b. Sembunyikan versi Apache. conf-enabled/security.conf bawaan Ubuntu (ServerTokens OS,
#     ServerSignature On) dimuat setelah pasarku.conf dan menimpa pengaturannya.
SECURITY_CONF=/etc/apache2/conf-available/security.conf
if [[ -f $SECURITY_CONF ]] && grep -Eq '^\s*(ServerTokens (OS|Full|Minor|Major|Min)|ServerSignature On)' "$SECURITY_CONF"; then
    cp -p "$SECURITY_CONF" "$SECURITY_CONF.bak-$(date +%Y%m%d%H%M%S)"
    sed -i -E 's/^\s*ServerTokens\s+\S+/ServerTokens Prod/; s/^\s*ServerSignature\s+On/ServerSignature Off/' "$SECURITY_CONF"
    if apache2ctl configtest; then
        systemctl reload apache2
        log 'Versi Apache disembunyikan (ServerTokens Prod, ServerSignature Off).'
    else
        echo 'configtest gagal setelah mengubah security.conf.' >&2
        exit 1
    fi
fi

# 7. Sisa salinan job lama yang tidak dipakai aplikasi.
rm -rf "$APP/node_modules" "$APP/dist" "$APP/tests" "$APP/.phpunit.result.cache"

log 'Server siap.'
