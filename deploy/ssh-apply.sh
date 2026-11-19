#!/usr/bin/env bash
# Menulis konfigurasi SSH PasarKu sesuai tahap saat ini. Dipasang ke /usr/local/sbin/pasarku-ssh-apply,
# dipanggil oleh server-setup.sh (setiap deploy) dan pasarku-ssh-confirm.
#   Sebelum konfirmasi : Port 22 + port baru, login password tetap boleh (tidak ada yang terkunci).
#   Setelah konfirmasi : hanya port baru, hanya SSH key, root hanya dengan key.
# Nama file 00-* agar menang atas 50-cloud-init.conf (sshd memakai nilai PERTAMA yang ditemukan).
set -euo pipefail

MARKER=/etc/pasarku/ssh-hardened
DROPIN=/etc/ssh/sshd_config.d/00-pasarku-hardening.conf
[[ -f /etc/default/pasarku-ssh ]] && . /etc/default/pasarku-ssh
SSH_PORT=${SSH_PORT:-2222}
log() { echo "[ssh-apply] $*"; }

[[ $SSH_PORT =~ ^[0-9]+$ && $SSH_PORT -ge 1024 && $SSH_PORT -le 65535 ]] || { log "SSH_PORT tidak valid: $SSH_PORT"; exit 1; }
grep -qE '^\s*Include\s+/etc/ssh/sshd_config\.d/' /etc/ssh/sshd_config || { log 'sshd_config tidak memuat sshd_config.d; dilewati.'; exit 0; }

hardened=0
[[ -f $MARKER ]] && hardened=1

new=$(mktemp)
{
    echo '# Dipasang oleh PasarKu (deploy/ssh-apply.sh). Jangan diedit manual.'
    # Port 22 ditulis di sini kecuali sshd_config utama sudah menyebutnya (hindari bind ganda).
    if [[ $hardened -eq 0 ]] && ! grep -qE '^\s*Port\s+22\s*$' /etc/ssh/sshd_config; then echo 'Port 22'; fi
    echo "Port $SSH_PORT"
    echo 'PubkeyAuthentication yes'
    if [[ $hardened -eq 1 ]]; then
        echo 'MaxAuthTries 4'
        echo 'LoginGraceTime 30'
        echo 'PasswordAuthentication no'
        echo 'KbdInteractiveAuthentication no'
        echo 'PermitRootLogin prohibit-password'
    fi
} >"$new"

# Port 22 eksplisit di sshd_config utama akan tetap membuka port 22; jadikan komentar setelah konfirmasi.
if [[ $hardened -eq 1 ]] && grep -qE '^\s*Port\s+22\s*$' /etc/ssh/sshd_config; then
    cp -p /etc/ssh/sshd_config "/etc/ssh/sshd_config.bak-$(date +%Y%m%d%H%M%S)"
    sed -i -E 's/^\s*Port\s+22\s*$/#Port 22  # dinonaktifkan PasarKu/' /etc/ssh/sshd_config
fi

if cmp -s "$new" "$DROPIN"; then
    rm -f "$new"
else
    old=$(mktemp)
    [[ -f $DROPIN ]] && cp -p "$DROPIN" "$old"
    install -m 0644 "$new" "$DROPIN"
    rm -f "$new"
    if sshd -t; then
        systemctl reload ssh
        log "sshd diperbarui: port $([[ $hardened -eq 1 ]] && echo "$SSH_PORT saja, hanya SSH key" || echo "22 + $SSH_PORT")."
    else
        if [[ -s $old ]]; then cp -p "$old" "$DROPIN"; else rm -f "$DROPIN"; fi
        log 'sshd -t gagal; konfigurasi dikembalikan.'
        rm -f "$old"
        exit 1
    fi
    rm -f "$old"
fi

# Firewall: hanya disentuh bila UFW sudah aktif (tidak mengaktifkan UFW agar port lain, mis. Jenkins, tidak tertutup).
if command -v ufw >/dev/null && ufw status | grep -q 'Status: active'; then
    ufw allow "$SSH_PORT/tcp" comment 'SSH PasarKu' >/dev/null
    if [[ $hardened -eq 1 ]]; then
        ufw delete allow 22/tcp >/dev/null 2>&1 || true
        ufw delete allow OpenSSH >/dev/null 2>&1 || true
        ufw delete allow 22 >/dev/null 2>&1 || true
    fi
fi

# Fail2Ban mengikuti port SSH yang aktif.
if [[ -f /etc/fail2ban/jail.d/pasarku.conf ]]; then
    ports=$([[ $hardened -eq 1 ]] && echo "$SSH_PORT" || echo "22,$SSH_PORT")
    if ! grep -q "^port    = $ports\$" /etc/fail2ban/jail.d/pasarku.conf; then
        sed -i -E "/^\[sshd\]/,/^\[/ s/^port\s*=.*/port    = $ports/" /etc/fail2ban/jail.d/pasarku.conf
        fail2ban-client reload >/dev/null 2>&1 || true
    fi
fi
