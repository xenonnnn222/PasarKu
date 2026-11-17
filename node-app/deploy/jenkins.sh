#!/usr/bin/env bash
# Langkah job Jenkins "pasarku-node": tes, salin kode ke server, restart service, cek kesehatan.
# Dipanggil dari node-app/Jenkinsfile. Lihat node-app/deploy/README.md.
set -euo pipefail

APP_DIR=/opt/pasarku-node/app
SERVICE=pasarku-node
HEALTH_URL=http://127.0.0.1:3100/healthz

cd "$(dirname "$0")/.."   # folder node-app

echo "==> Versi Node.js"
node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<22||(a===22&&b<13)){console.error("Butuh Node.js >= 22.13, terpasang "+process.versions.node); process.exit(1)} console.log(process.versions.node)'

echo "==> Tes (bila gagal, server tidak disentuh)"
mkdir -p build
node --test \
    --test-reporter=spec --test-reporter-destination=stdout \
    --test-reporter=junit --test-reporter-destination=build/junit.xml

echo "==> Salin kode ke $APP_DIR"
# Database ada di /var/lib/pasarku-node, jadi --delete tidak menyentuh data.
rsync -a --delete \
    --exclude '.git' --exclude 'data/' --exclude 'build/' --exclude 'test/' \
    ./ "$APP_DIR/"

echo "==> Restart service (database dicadangkan otomatis sebelum start)"
sudo /usr/bin/systemctl restart "$SERVICE"

echo "==> Cek kesehatan"
for _ in $(seq 1 20); do
    if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
        echo "Deploy berhasil: aplikasi merespons di $HEALTH_URL"
        exit 0
    fi
    sleep 1
done

echo "Aplikasi tidak merespons setelah restart." >&2
systemctl status "$SERVICE" --no-pager --lines=30 || true
exit 1
