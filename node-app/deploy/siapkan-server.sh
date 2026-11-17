#!/usr/bin/env bash
# Persiapan server PasarKu versi Node.js.
# Dijalankan OTOMATIS oleh Jenkins pada setiap build (tahap "Siapkan server").
# Idempoten: hanya mengubah yang belum sesuai, jadi aman dijalankan berulang.
#
#   bash siapkan-server.sh           pasang/perbarui (butuh root)
#   bash siapkan-server.sh --check   hanya memeriksa, tidak mengubah apa pun (tanpa root)
#
# Yang disiapkan:
#  1. Node.js 24 dari repositori resmi NodeSource (bila belum ada Node >= 22.13), rsync, curl
#  2. User sistem "pasarku" yang menjalankan aplikasi
#  3. /opt/pasarku-node/app (kode, ditulis Jenkins) dan /var/lib/pasarku-node (database)
#  4. Service systemd pasarku-node
#  5. Izin restart service untuk user Jenkins (bila Jenkins bukan root)
#  6. Reverse proxy Apache di /pasarku-node/
#
# PasarKu Laravel di /pasarku/ dan databasenya tidak disentuh.
set -euo pipefail

MODE="${1:-apply}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_USER="${DEPLOY_USER:-${SUDO_USER:-$(id -un)}}"

SERVICE=pasarku-node
APP_ROOT=/opt/pasarku-node
APP_DIR=$APP_ROOT/app
DATA_DIR=/var/lib/pasarku-node
UNIT=/etc/systemd/system/$SERVICE.service
APACHE_CONF=/etc/apache2/conf-available/pasarku-node.conf
SUDOERS=/etc/sudoers.d/pasarku-node
APACHE_MODULES=(proxy proxy_http headers)

log() { echo "[siapkan-server] $*"; }

node_ok() {
    command -v node >/dev/null 2>&1 &&
        node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=13)?0:1)'
}

# File service memakai lokasi node yang sebenarnya di server ini.
render_unit() {
    sed "s#/usr/bin/node#$(readlink -f "$(command -v node)")#g" "$SCRIPT_DIR/pasarku-node.service"
}

sudoers_line() {
    echo "$DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart $SERVICE"
}

# ---------------------------------------------------------------- mode --check
check() {
    local ready=0
    node_ok || { log "Node.js >= 22.13 belum terpasang."; ready=1; }
    for cmd in rsync curl; do
        command -v "$cmd" >/dev/null 2>&1 || { log "$cmd belum terpasang."; ready=1; }
    done
    id pasarku >/dev/null 2>&1 || { log "User pasarku belum ada."; ready=1; }
    [[ -d $APP_DIR && -w $APP_DIR ]] || { log "$APP_DIR belum ada atau tidak bisa ditulis oleh $(id -un)."; ready=1; }
    [[ -d $DATA_DIR ]] || { log "$DATA_DIR belum ada."; ready=1; }
    if node_ok; then
        cmp -s <(render_unit) "$UNIT" 2>/dev/null || { log "Service systemd belum ada atau perlu diperbarui."; ready=1; }
    fi
    cmp -s "$SCRIPT_DIR/apache-pasarku-node.conf" "$APACHE_CONF" 2>/dev/null ||
        { log "Konfigurasi Apache belum ada atau perlu diperbarui."; ready=1; }
    [[ -e /etc/apache2/conf-enabled/pasarku-node.conf ]] || { log "Konfigurasi Apache belum aktif."; ready=1; }
    for mod in "${APACHE_MODULES[@]}"; do
        [[ -e /etc/apache2/mods-enabled/$mod.load ]] || { log "Modul Apache $mod belum aktif."; ready=1; }
    done
    if [[ $(id -un) != root ]]; then
        sudo -n -l /usr/bin/systemctl restart "$SERVICE" >/dev/null 2>&1 ||
            { log "User $(id -un) belum boleh me-restart $SERVICE."; ready=1; }
    fi
    return $ready
}

if [[ $MODE == --check ]]; then
    if check; then
        log "Server sudah siap."
        exit 0
    fi
    exit 1
fi

# ---------------------------------------------------------------- mode apply
if [[ $EUID -ne 0 ]]; then
    echo "Butuh root. Jalankan: sudo bash $0" >&2
    exit 1
fi
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
    echo "User deploy \"$DEPLOY_USER\" tidak ditemukan." >&2
    exit 1
fi

# 1. Node.js dan alat bantu
if node_ok; then
    log "Node.js $(node --version) sudah sesuai."
else
    log "Memasang Node.js 24 dari NodeSource..."
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -q
    apt-get install -y -q ca-certificates curl gnupg
    install -d -m 0755 /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key |
        gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" \
        >/etc/apt/sources.list.d/nodesource.list
    apt-get update -q
    apt-get install -y -q nodejs
    node_ok || { echo "Pemasangan Node.js gagal." >&2; exit 1; }
    log "Node.js $(node --version) terpasang."
fi
for cmd in rsync curl; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        log "Memasang $cmd..."
        DEBIAN_FRONTEND=noninteractive apt-get install -y -q "$cmd"
    fi
done

# 2. User aplikasi
if ! id pasarku >/dev/null 2>&1; then
    useradd --system --home-dir "$DATA_DIR" --no-create-home --shell /usr/sbin/nologin pasarku
    log "User pasarku dibuat."
fi

# 3. Folder: kode ditulis user deploy dan dibaca pasarku; database hanya milik pasarku.
install -d -m 0755 "$APP_ROOT"
install -d -o "$DEPLOY_USER" -g pasarku -m 0755 "$APP_DIR"
install -d -o pasarku -g pasarku -m 0750 "$DATA_DIR"

# 4. Service systemd
tmp_unit="$(mktemp)"
render_unit >"$tmp_unit"
if ! cmp -s "$tmp_unit" "$UNIT" 2>/dev/null; then
    install -m 0644 "$tmp_unit" "$UNIT"
    systemctl daemon-reload
    log "Service $SERVICE dipasang/diperbarui."
fi
rm -f "$tmp_unit"
systemctl is-enabled --quiet "$SERVICE" 2>/dev/null || systemctl enable --quiet "$SERVICE"

# 5. Izin restart untuk user deploy (tidak perlu bila Jenkins berjalan sebagai root)
if [[ $DEPLOY_USER != root ]]; then
    if [[ ! -f $SUDOERS || "$(cat "$SUDOERS")" != "$(sudoers_line)" ]]; then
        sudoers_line >"$SUDOERS.tmp"
        chmod 0440 "$SUDOERS.tmp"
        visudo -cf "$SUDOERS.tmp" >/dev/null
        mv "$SUDOERS.tmp" "$SUDOERS"
        log "Izin restart $SERVICE untuk $DEPLOY_USER dipasang."
    fi
fi

# 6. Apache: reload hanya bila ada perubahan, dan batalkan bila konfigurasi tidak valid.
apache_changed=0
for mod in "${APACHE_MODULES[@]}"; do
    if [[ ! -e /etc/apache2/mods-enabled/$mod.load ]]; then
        a2enmod -q "$mod"
        apache_changed=1
    fi
done
if ! cmp -s "$SCRIPT_DIR/apache-pasarku-node.conf" "$APACHE_CONF" 2>/dev/null; then
    install -m 0644 "$SCRIPT_DIR/apache-pasarku-node.conf" "$APACHE_CONF"
    apache_changed=1
fi
if [[ ! -e /etc/apache2/conf-enabled/pasarku-node.conf ]]; then
    a2enconf -q pasarku-node
    apache_changed=1
fi
if [[ $apache_changed -eq 1 ]]; then
    if apache2ctl configtest; then
        systemctl reload apache2
        log "Apache dimuat ulang dengan proxy /pasarku-node/."
    else
        # Jangan biarkan konfigurasi rusak; Apache yang berjalan (dan Laravel) tetap seperti semula.
        a2disconf -q pasarku-node || true
        echo "Konfigurasi Apache tidak valid. Proxy /pasarku-node/ dinonaktifkan, Apache tidak di-reload." >&2
        exit 1
    fi
fi

log "Server siap."
