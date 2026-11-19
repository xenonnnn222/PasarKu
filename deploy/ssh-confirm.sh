#!/usr/bin/env bash
# Tahap akhir hardening SSH (checklist OWASP I2, I8). Dipasang ke /usr/local/sbin/pasarku-ssh-confirm.
#
# server-setup.sh (otomatis dari Jenkins) membuat sshd mendengar di port 22 DAN port baru (default 2222),
# tanpa mengunci siapa pun. Perintah ini menutup port 22 dan mematikan login password, tetapi HANYA bila
# dijalankan dari sesi SSH yang:
#   1. masuk lewat port baru (bukti port itu tembus firewall provider), dan
#   2. login dengan SSH key (bukti key Anda terpasang dan berfungsi).
# Jalankan dari laptop:
#   ssh -p 2222 root@103.139.193.51      (login dengan key, BUKAN password)
#   sudo pasarku-ssh-confirm
# Membatalkan (kembali ke port 22 + password, dari konsol VPS bila perlu):
#   sudo pasarku-ssh-confirm --undo
set -euo pipefail

STATE_DIR=/etc/pasarku
MARKER=$STATE_DIR/ssh-hardened
DROPIN=/etc/ssh/sshd_config.d/00-pasarku-hardening.conf
[[ -f /etc/default/pasarku-ssh ]] && . /etc/default/pasarku-ssh
SSH_PORT=${SSH_PORT:-2222}

die() { echo "[ssh-confirm] $*" >&2; exit 1; }
log() { echo "[ssh-confirm] $*"; }
[[ $EUID -eq 0 ]] || die 'Jalankan dengan sudo.'

apply_and_reload() {
    if ! sshd -t; then
        die 'Konfigurasi sshd tidak valid; tidak diterapkan.'
    fi
    systemctl reload ssh   # sesi yang sedang terbuka tidak terputus
}

if [[ ${1:-} == --undo ]]; then
    rm -f "$MARKER"
    printf '# Dipasang oleh pasarku-ssh-confirm --undo\nPort 22\nPort %s\n' "$SSH_PORT" >"$DROPIN"
    apply_and_reload
    if ufw status 2>/dev/null | grep -q 'Status: active'; then ufw allow 22/tcp >/dev/null; fi
    log 'Dikembalikan: port 22 dan port baru terbuka, login password diizinkan lagi.'
    exit 0
fi

# Data sesi SSH: dari lingkungan sendiri, atau dari proses induk bila dijalankan lewat sudo.
conn=${SSH_CONNECTION:-}
if [[ -z $conn ]]; then
    pid=$PPID
    for _ in 1 2 3 4 5; do
        [[ $pid -gt 1 ]] || break
        conn=$(tr '\0' '\n' </proc/$pid/environ 2>/dev/null | sed -n 's/^SSH_CONNECTION=//p' | head -1)
        [[ -n $conn ]] && break
        pid=$(awk '{print $4}' /proc/$pid/stat)
    done
fi
[[ -n $conn ]] || die 'Tidak terdeteksi sesi SSH. Jalankan dari sesi: ssh -p '"$SSH_PORT"' user@server'

read -r client_ip client_port _ server_port <<<"$conn"
[[ $server_port == "$SSH_PORT" ]] ||
    die "Sesi ini masuk lewat port $server_port. Masuk lewat port $SSH_PORT dulu: ssh -p $SSH_PORT user@server"

# Cari baris "Accepted publickey ... from <ip> port <port>" untuk sesi ini.
if ! { journalctl -u ssh --since '-12h' --no-pager 2>/dev/null; cat /var/log/auth.log 2>/dev/null; } |
    grep -E "Accepted publickey for \S+ from ${client_ip//./\\.} port ${client_port}( |$)" >/dev/null; then
    die 'Sesi ini tidak login dengan SSH key. Pasang key dulu (lihat deploy/README.md bagian SSH), lalu masuk ulang dengan key.'
fi

log "Terverifikasi: sesi dari $client_ip masuk lewat port $SSH_PORT dengan SSH key."
install -d -m 0755 "$STATE_DIR"
date -Is >"$MARKER"

# Konfigurasi akhir ditulis oleh server-setup.sh agar sumbernya satu; jalankan bagiannya sekarang.
if [[ -x /usr/local/sbin/pasarku-ssh-apply ]]; then
    /usr/local/sbin/pasarku-ssh-apply
else
    die 'pasarku-ssh-apply belum terpasang; jalankan deploy (server-setup.sh) dulu.'
fi
log "Selesai. Port 22 ditutup, login password dimatikan. Login berikutnya: ssh -p $SSH_PORT <user>@server"
