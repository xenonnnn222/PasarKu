#!/usr/bin/env bash
# Persiapan server otomatis (idempoten) untuk PasarKu Laravel.
# Dipanggil oleh deploy/ci.sh di server Jenkins SETELAH tes lulus dan SEBELUM rsync job,
# sehingga Execute shell job Jenkins tidak perlu diubah. Bisa juga dijalankan manual:
#   sudo bash deploy/server-setup.sh
# Bagian akhir mencetak blok [audit] (permission, backup, Fail2Ban, SSH, PHP-FPM, monitoring)
# ke Console Output Jenkins sebagai bukti audit.
set -euo pipefail

APP=/var/www/html/pasarku
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APACHE_CONF=/etc/apache2/conf-available/pasarku.conf
FPM_POOL=/etc/php/8.3/fpm/pool.d/pasarku.conf
FPM_SOCK=/run/php/php8.3-fpm-pasarku.sock
LIB=/usr/local/lib/pasarku

log() { echo "[server-setup] $*"; }
warn() { echo "[server-setup] PERINGATAN: $*" >&2; }
[[ $EUID -eq 0 ]] || { echo 'server-setup.sh butuh root.' >&2; exit 1; }
[[ -d $APP ]] || { log "$APP belum ada; lewati."; exit 0; }

# Website dianggap sehat bila /pasarku/login membalas 200, lewat domain publik atau lewat
# 127.0.0.1 (VirtualHost bisa terikat ke IP publik, jadi keduanya dicoba).
site_ok() {
    local code
    for opt in '' '--resolve dragonfruitdevops.web.id:443:127.0.0.1'; do
        # shellcheck disable=SC2086
        code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 $opt https://dragonfruitdevops.web.id/pasarku/login || true)
        [[ $code == 200 ]] && return 0
    done
    echo "[server-setup] cek website: HTTP $code" >&2
    return 1
}

# 1. Skrip root disalin ke /usr/local (milik root), bukan dijalankan dari folder website
#    yang dimiliki www-data, agar web server tidak bisa mengubah skrip yang dijalankan root.
install -m 0755 "$HERE/backup-db.sh" /usr/local/sbin/pasarku-backup
install -m 0755 "$HERE/fix-permissions.sh" /usr/local/sbin/pasarku-fix-permissions
install -m 0755 "$HERE/ssh-apply.sh" /usr/local/sbin/pasarku-ssh-apply
install -m 0755 "$HERE/ssh-confirm.sh" /usr/local/sbin/pasarku-ssh-confirm
install -d -m 0755 "$LIB"
install -m 0644 "$HERE/monitor/security-log.php" "$HERE/monitor/pasarku-monitor.php" "$HERE/monitor/pasarku-ai-monitor.php" "$LIB/"

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

# 4. Jadwal backup harian, monitoring log, dan rotasi log.
install -m 0644 "$HERE/cron-pasarku-backup" /etc/cron.d/pasarku-backup
install -m 0644 "$HERE/cron-pasarku-monitor" /etc/cron.d/pasarku-monitor
install -m 0644 "$HERE/logrotate-pasarku" /etc/logrotate.d/pasarku
if [[ ! -f /etc/default/pasarku-monitor ]]; then
    install -m 0600 /dev/null /etc/default/pasarku-monitor
    cat >/etc/default/pasarku-monitor <<'CFG'
# Pengaturan monitoring PasarKu (deploy/monitor). File ini milik root, mode 600.
# G6 (analisis AI): dijalankan dari laptop (deploy/ai-monitor-local.ps1 + 9router), atau isi API key Claude agar server memanggil Claude API langsung.
#ANTHROPIC_API_KEY=
#PASARKU_AI_MODEL=claude-opus-5-5
#AI_WINDOW_HOURS=6
# G5 (aturan): batas peringatan.
#MONITOR_WINDOW_MINUTES=60
#MONITOR_IP_FAILED=10
#MONITOR_TOTAL_FAILED=30
CFG
fi

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

# 5b. Pool PHP-FPM khusus PasarKu tanpa fungsi exec/system (H6). Harus siap SEBELUM Apache
#     diarahkan ke socket-nya di langkah 6; bila gagal, deploy berhenti dan Apache tidak disentuh.
if [[ -d /etc/php/8.3/fpm/pool.d ]] && ! cmp -s "$HERE/php-fpm-pool-pasarku.conf" "$FPM_POOL"; then
    install -m 0644 "$HERE/php-fpm-pool-pasarku.conf" "$FPM_POOL"
    if php-fpm8.3 -t >/dev/null 2>&1; then
        systemctl reload php8.3-fpm
        for _ in $(seq 1 10); do [[ -S $FPM_SOCK ]] && break; sleep 1; done
    fi
    if [[ ! -S $FPM_SOCK ]]; then
        rm -f "$FPM_POOL"
        systemctl reload php8.3-fpm || true
        echo 'Pool PHP-FPM pasarku gagal dibuat; dibatalkan.' >&2
        exit 1
    fi
    log "Pool PHP-FPM pasarku aktif ($FPM_SOCK)."
fi

# 6. Apache: dipasang hanya bila berubah; dikembalikan bila configtest atau cek website gagal.
if ! cmp -s "$HERE/apache-pasarku.conf" "$APACHE_CONF"; then
    backup="$APACHE_CONF.bak-$(date +%Y%m%d%H%M%S)"
    [[ -f $APACHE_CONF ]] && cp -p "$APACHE_CONF" "$backup"
    install -m 0644 "$HERE/apache-pasarku.conf" "$APACHE_CONF"
    a2enmod -q rewrite proxy_fcgi setenvif headers
    a2enconf -q pasarku
    if apache2ctl configtest && systemctl reload apache2 && sleep 2 && site_ok; then
        log "Apache diperbarui (cadangan: $backup)."
    else
        [[ -f $backup ]] && cp -p "$backup" "$APACHE_CONF"
        apache2ctl configtest && systemctl reload apache2
        echo 'Konfigurasi Apache baru gagal (configtest atau website tidak 200); dikembalikan.' >&2
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

# 8. Fail2Ban untuk SSH dan login PasarKu (I6, G5). Kegagalan di sini tidak menghentikan deploy.
if ! command -v fail2ban-client >/dev/null; then
    DEBIAN_FRONTEND=noninteractive timeout 300 apt-get install -y -q fail2ban >/dev/null 2>&1 ||
        warn 'apt-get install fail2ban gagal; dicoba lagi pada deploy berikutnya.'
fi
if command -v fail2ban-client >/dev/null; then
    [[ -f /etc/default/pasarku-ssh ]] && . /etc/default/pasarku-ssh
    ssh_ports="22,${SSH_PORT:-2222}"
    [[ -f /etc/pasarku/ssh-hardened ]] && ssh_ports="${SSH_PORT:-2222}"
    app_tz=$(sed -n 's/^APP_TIMEZONE=//p' "$APP/.env" 2>/dev/null | tr -d "\"' \r")
    log_tz="UTC$(TZ="${app_tz:-Asia/Makassar}" date +%z)"
    install -d -o www-data -g www-data -m 0775 "$APP/storage/logs"
    [[ -f $APP/storage/logs/security.log ]] || install -o www-data -g www-data -m 0664 /dev/null "$APP/storage/logs/security.log"
    install -m 0644 "$HERE/fail2ban/filter-pasarku-login.conf" /etc/fail2ban/filter.d/pasarku-login.conf
    jail_new=$(mktemp)
    sed -e "s/@SSH_PORTS@/$ssh_ports/" -e "s/@LOG_TZ@/$log_tz/" "$HERE/fail2ban/jail-pasarku.conf" >"$jail_new"
    if ! cmp -s "$jail_new" /etc/fail2ban/jail.d/pasarku.conf; then
        install -m 0644 "$jail_new" /etc/fail2ban/jail.d/pasarku.conf
        if fail2ban-client -t >/dev/null 2>&1; then
            systemctl enable fail2ban >/dev/null 2>&1 || true
            systemctl restart fail2ban && log "Fail2Ban aktif (sshd port $ssh_ports, pasarku-login, log $log_tz)."
        else
            rm -f /etc/fail2ban/jail.d/pasarku.conf
            warn 'Konfigurasi Fail2Ban tidak valid; jail PasarKu dilepas.'
        fi
    fi
    rm -f "$jail_new"
fi

# 9. SSH: tahap 1 otomatis (port 22 + port baru, tidak ada yang terkunci). Tahap 2 (tutup port 22,
#    hanya SSH key) hanya lewat `sudo pasarku-ssh-confirm` dari sesi SSH key di port baru.
/usr/local/sbin/pasarku-ssh-apply || warn 'pasarku-ssh-apply gagal; SSH tidak diubah.'

# 10. Jalankan monitoring sekali agar hasil terbaru ikut tercatat.
php "$LIB/pasarku-monitor.php" >/dev/null 2>&1 || warn 'pasarku-monitor gagal dijalankan.'

log 'Server siap.'

# ---------------------------------------------------------------- Bukti audit (Console Output Jenkins)
audit() { echo "[audit] $*"; }
{
    audit '--- H4 hak akses (dipasang ulang unit pasarku-permissions setelah deploy sebelumnya) ---'
    audit "pasarku-permissions.path: $(systemctl is-active pasarku-permissions.path 2>/dev/null || true)"
    for p in "$APP/.env" "$APP/app" "$APP/app/Models/User.php" "$APP/routes/web.php" "$APP/public/index.php" \
             "$APP/storage" "$APP/storage/logs" "$APP/database" "$APP/database/database.sqlite"; do
        [[ -e $p ]] && audit "$(stat -c '%U:%G %a %n' "$p")"
    done
    audit "file kode yang bisa ditulis www-data/grup/lainnya: $(find "$APP/app" "$APP/routes" "$APP/config" "$APP/public" \
        \( -user www-data -o -perm /022 \) 2>/dev/null | wc -l)"

    audit '--- J1/J2/J3 backup ---'
    ls -lt /var/backups/pasarku/pasarku-*.sqlite.gz 2>/dev/null | head -3 | sed 's/^/[audit] /'
    grep -h 'Backup OK' /var/log/pasarku-backup.log 2>/dev/null | tail -1 | sed 's/^/[audit] /' || true
    audit "cron: $(cat /etc/cron.d/pasarku-backup 2>/dev/null | grep -v '^#' | head -1)"
    if [[ -f /var/backups/pasarku/.last-offsite-pull ]]; then
        audit "salinan terpisah terakhir ditarik: $(tr '\n' ' ' </var/backups/pasarku/.last-offsite-pull)"
    else
        audit 'salinan terpisah: belum pernah ditarik (jalankan deploy/pull-backup.ps1 di laptop)'
    fi

    audit '--- H6 PHP-FPM pool pasarku ---'
    audit "$(grep -h 'disable_functions' "$FPM_POOL" 2>/dev/null || echo 'pool belum ada')"
    audit "socket: $([[ -S $FPM_SOCK ]] && echo aktif || echo tidak ada); Apache: $(grep -c 'php8.3-fpm-pasarku.sock' "$APACHE_CONF" 2>/dev/null || echo 0) handler"

    audit '--- I6/G5 Fail2Ban dan monitoring ---'
    fail2ban-client status 2>/dev/null | sed 's/^/[audit] /' || audit 'fail2ban belum terpasang'
    fail2ban-client status pasarku-login 2>/dev/null | grep -E 'Currently|Total' | sed 's/^/[audit] /' || true
    tail -1 /var/log/pasarku-monitor.log 2>/dev/null | sed 's/^/[audit] monitor: /' || true

    audit '--- G6 monitoring AI ---'
    if grep -q '^ANTHROPIC_API_KEY=.\+' /etc/default/pasarku-monitor 2>/dev/null; then
        audit 'mode: server -> Claude API (API key terisi)'
    elif [[ -f /var/lib/pasarku/ai-monitor-last.json ]]; then
        audit "mode: laptop pemilik (9router), hasil terakhir $(date -r /var/lib/pasarku/ai-monitor-last.json '+%Y-%m-%d %H:%M %Z')"
    else
        audit 'mode: belum aktif (jalankan deploy/ai-monitor-local.ps1 di laptop atau isi ANTHROPIC_API_KEY)'
    fi
    tail -1 /var/log/pasarku-ai-monitor.log 2>/dev/null | sed 's/^/[audit] ai: /' || true

    audit '--- I2/I8 SSH ---'
    sshd -T 2>/dev/null | grep -E '^(port|passwordauthentication|kbdinteractiveauthentication|permitrootlogin|pubkeyauthentication) ' | sed 's/^/[audit] /' || true
    audit "tahap: $([[ -f /etc/pasarku/ssh-hardened ]] && echo "dikonfirmasi $(cat /etc/pasarku/ssh-hardened)" || echo 'menunggu sudo pasarku-ssh-confirm')"
    audit "ufw: $(ufw status 2>/dev/null | head -1 || echo 'tidak terpasang')"
} || true
