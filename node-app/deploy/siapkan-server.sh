#!/usr/bin/env bash
# Persiapan server SEKALI SAJA untuk PasarKu versi Node.js.
# Jalankan di VPS dari folder repo:  sudo bash node-app/deploy/siapkan-server.sh
#
# Yang dilakukan:
#  1. Memasang Node.js 24 dari repositori resmi NodeSource (bila belum ada Node >= 22.13)
#  2. Membuat user sistem "pasarku" untuk menjalankan aplikasi
#  3. Membuat folder aplikasi /opt/pasarku-node/app dan folder data /var/lib/pasarku-node
#  4. Memasang service systemd pasarku-node
#  5. Mengizinkan user Jenkins me-restart service tersebut (hanya perintah itu)
#  6. Memasang reverse proxy Apache di /pasarku-node/
#
# PasarKu Laravel di /pasarku/ dan databasenya tidak disentuh.
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
    echo "Jalankan dengan sudo: sudo bash $0" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
JENKINS_USER="${JENKINS_USER:-jenkins}"
APP_ROOT=/opt/pasarku-node
APP_DIR=$APP_ROOT/app
DATA_DIR=/var/lib/pasarku-node
SERVICE=pasarku-node

if ! id "$JENKINS_USER" >/dev/null 2>&1; then
    echo "User Jenkins \"$JENKINS_USER\" tidak ditemukan. Jalankan ulang dengan JENKINS_USER=<nama-user> sudo -E bash $0" >&2
    exit 1
fi

node_ok() {
    command -v node >/dev/null 2>&1 &&
        node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=13)?0:1)'
}

echo "==> 1. Node.js"
if node_ok; then
    echo "Node.js $(node --version) sudah terpasang."
else
    apt-get update
    apt-get install -y ca-certificates curl gnupg
    install -d -m 0755 /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key |
        gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" \
        >/etc/apt/sources.list.d/nodesource.list
    apt-get update
    apt-get install -y nodejs
    node_ok || { echo "Pemasangan Node.js gagal." >&2; exit 1; }
    echo "Node.js $(node --version) terpasang."
fi
apt-get install -y rsync curl >/dev/null

echo "==> 2. User sistem pasarku"
if ! id pasarku >/dev/null 2>&1; then
    useradd --system --home-dir "$DATA_DIR" --no-create-home --shell /usr/sbin/nologin pasarku
fi

echo "==> 3. Folder aplikasi dan data"
install -d -m 0755 "$APP_ROOT"
# Kode ditulis oleh Jenkins (rsync), dibaca oleh user pasarku.
install -d -o "$JENKINS_USER" -g pasarku -m 0755 "$APP_DIR"
# Database hanya dapat ditulis oleh aplikasi.
install -d -o pasarku -g pasarku -m 0750 "$DATA_DIR"

echo "==> 4. Service systemd"
install -m 0644 "$SCRIPT_DIR/pasarku-node.service" /etc/systemd/system/$SERVICE.service
systemctl daemon-reload
systemctl enable $SERVICE
if [[ -f "$APP_DIR/src/server.js" ]]; then
    systemctl restart $SERVICE
else
    echo "Kode belum ada di $APP_DIR; service akan berjalan setelah build Jenkins pertama."
fi

echo "==> 5. Izin restart untuk Jenkins"
SUDOERS=/etc/sudoers.d/pasarku-node
echo "$JENKINS_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart $SERVICE" >"$SUDOERS.tmp"
chmod 0440 "$SUDOERS.tmp"
visudo -cf "$SUDOERS.tmp"
mv "$SUDOERS.tmp" "$SUDOERS"

echo "==> 6. Reverse proxy Apache"
a2enmod proxy proxy_http headers >/dev/null
install -m 0644 "$SCRIPT_DIR/apache-pasarku-node.conf" /etc/apache2/conf-available/pasarku-node.conf
a2enconf pasarku-node >/dev/null
apache2ctl configtest
systemctl reload apache2

echo
echo "Selesai. Langkah berikutnya: buat job Jenkins \"pasarku-node\" (lihat node-app/deploy/README.md)."
