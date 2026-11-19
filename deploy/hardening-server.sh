#!/usr/bin/env bash
# Hardening server PasarKu (temuan audit OWASP I2, I3, I6, I8, H6).
# Dijalankan MANUAL sebagai root, bukan oleh Jenkins, karena perubahan SSH bisa mengunci akses.
#
# Tahap 1 (aman, port 22 tetap terbuka):
#   sudo SSH_PORT=2222 bash deploy/hardening-server.sh
#   -> UFW aktif (SSH lama + baru, 80, 443), Fail2Ban (SSH + login PasarKu), PHP-FPM tanpa fungsi
#      eksekusi perintah, SSH juga mendengar di port baru, login SSH hanya dengan key.
#   Lalu UJI dari terminal LAIN tanpa menutup sesi sekarang:  ssh -p 2222 user@103.139.193.51
#
# Tahap 2 (setelah login lewat port baru berhasil):
#   sudo SSH_PORT=2222 bash deploy/hardening-server.sh --close-22
#   -> port 22 ditutup di sshd dan UFW.
#
# Bila provider VPS punya firewall sendiri (panel cloud), buka juga port baru di sana.
set -euo pipefail

SSH_PORT=${SSH_PORT:-2222}
MODE=${1:-stage1}
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSHD_DROPIN=/etc/ssh/sshd_config.d/99-pasarku-hardening.conf
FPM_INI=/etc/php/8.3/fpm/conf.d/99-pasarku-hardening.ini

log() { echo "[hardening] $*"; }
[[ $EUID -eq 0 ]] || { echo 'Jalankan dengan sudo bash.' >&2; exit 1; }
[[ $SSH_PORT =~ ^[0-9]+$ && $SSH_PORT -ge 1024 && $SSH_PORT -le 65535 && $SSH_PORT -ne 22 ]] ||
    { echo "SSH_PORT harus 1024-65535 dan bukan 22 (sekarang: $SSH_PORT)." >&2; exit 1; }

if [[ $MODE == --close-22 ]]; then
    ports="$SSH_PORT"
else
    ports="22 $SSH_PORT"
fi

# ------------------------------------------------------------------ 1. SSH
# Login password dimatikan hanya bila ada user yang sudah punya SSH key, agar tidak terkunci.
key_user=""
for home in /root /home/*; do
    if [[ -s $home/.ssh/authorized_keys ]]; then key_user=$home; break; fi
done
if [[ -z $key_user ]]; then
    echo 'Belum ada ~/.ssh/authorized_keys di server. Pasang SSH key dulu (ssh-copy-id), lalu ulangi.' >&2
    exit 1
fi
log "SSH key ditemukan di $key_user/.ssh/authorized_keys"

{
    echo '# Dipasang oleh deploy/hardening-server.sh'
    for p in $ports; do echo "Port $p"; done
    echo 'PasswordAuthentication no'
    echo 'KbdInteractiveAuthentication no'
    echo 'PubkeyAuthentication yes'
    echo 'PermitRootLogin prohibit-password'
    echo 'MaxAuthTries 3'
    echo 'LoginGraceTime 30'
} >"$SSHD_DROPIN.new"

# ------------------------------------------------------------------ 2. Firewall UFW
apt-get install -y -q ufw fail2ban >/dev/null
for p in $ports; do ufw allow "$p/tcp" comment 'SSH' >/dev/null; done
ufw allow 80/tcp comment 'HTTP' >/dev/null
ufw allow 443/tcp comment 'HTTPS' >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw --force enable >/dev/null
log "UFW aktif: $(ufw status | grep -c ALLOW) aturan ALLOW"

# sshd diuji dulu; sesi SSH yang sedang terbuka tidak terputus saat restart.
mv "$SSHD_DROPIN.new" "$SSHD_DROPIN"
if ! sshd -t; then
    rm -f "$SSHD_DROPIN"
    echo 'Konfigurasi sshd tidak valid; perubahan SSH dibatalkan.' >&2
    exit 1
fi
systemctl restart ssh
log "sshd mendengar di port: $ports (password dimatikan)"

if [[ $MODE == --close-22 ]]; then
    ufw delete allow 22/tcp >/dev/null 2>&1 || true
    ufw delete allow OpenSSH >/dev/null 2>&1 || true
    log 'Port 22 ditutup.'
fi

# ------------------------------------------------------------------ 3. Fail2Ban
install -m 0644 "$HERE/fail2ban/filter-pasarku-login.conf" /etc/fail2ban/filter.d/pasarku-login.conf
sed "s/@SSH_PORTS@/$(echo "$ports" | tr ' ' ',')/" "$HERE/fail2ban/jail-pasarku.conf" >/etc/fail2ban/jail.d/pasarku.conf
install -d -o www-data -g www-data -m 0775 /var/www/html/pasarku/storage/logs
[[ -f /var/www/html/pasarku/storage/logs/security.log ]] ||
    install -o www-data -g www-data -m 0664 /dev/null /var/www/html/pasarku/storage/logs/security.log
fail2ban-client -t >/dev/null
systemctl enable --now fail2ban >/dev/null
systemctl restart fail2ban
log "Fail2Ban aktif: $(fail2ban-client status | grep 'Jail list' | cut -d: -f2 | xargs)"

# ------------------------------------------------------------------ 4. PHP-FPM
if [[ -d /etc/php/8.3/fpm/conf.d ]]; then
    install -m 0644 "$HERE/php-fpm-hardening.ini" "$FPM_INI"
    if php-fpm8.3 -t >/dev/null 2>&1; then
        systemctl reload php8.3-fpm
        sleep 1
        code=$(curl -s -o /dev/null -w '%{http_code}' --resolve dragonfruitdevops.web.id:443:127.0.0.1 \
            https://dragonfruitdevops.web.id/pasarku/login || true)
        if [[ $code == 200 ]]; then
            log 'PHP-FPM: exec/system/shell_exec dkk. dinonaktifkan, website tetap 200.'
        else
            rm -f "$FPM_INI"; systemctl reload php8.3-fpm
            echo "Website membalas $code setelah disable_functions; pengaturan PHP dibatalkan." >&2
        fi
    else
        rm -f "$FPM_INI"
        echo 'Konfigurasi PHP-FPM tidak valid; dibatalkan.' >&2
    fi
fi

echo
log 'Selesai. Ringkasan:'
ufw status verbose | sed 's/^/  /'
fail2ban-client status | sed 's/^/  /'
echo "  disable_functions FPM: $(php-fpm8.3 -i 2>/dev/null | grep -m1 '^disable_functions' | cut -d'>' -f2 | xargs)"
if [[ $MODE != --close-22 ]]; then
    echo
    echo "LANGKAH BERIKUTNYA: dari terminal lain jalankan  ssh -p $SSH_PORT <user>@103.139.193.51"
    echo "Bila berhasil:  sudo SSH_PORT=$SSH_PORT bash deploy/hardening-server.sh --close-22"
fi
