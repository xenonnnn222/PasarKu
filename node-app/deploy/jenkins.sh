#!/usr/bin/env bash
# Langkah job Jenkins "pasarku-node". Dipanggil per tahap dari node-app/Jenkinsfile:
#   bash node-app/deploy/jenkins.sh provision   siapkan server (Node.js, service, Apache)
#   bash node-app/deploy/jenkins.sh test        jalankan tes
#   bash node-app/deploy/jenkins.sh deploy      salin kode dan restart service
#   bash node-app/deploy/jenkins.sh health      pastikan aplikasi merespons
#   bash node-app/deploy/jenkins.sh             semua tahap berurutan
set -euo pipefail

APP_DIR=/opt/pasarku-node/app
SERVICE=pasarku-node
HEALTH_URL=http://127.0.0.1:3100/healthz

cd "$(dirname "$0")/.."   # folder node-app

provision() {
    echo "==> Siapkan server (sebagai $(id -un))"
    if [[ $EUID -eq 0 ]]; then
        bash deploy/siapkan-server.sh
    elif sudo -n true 2>/dev/null; then
        sudo -n bash deploy/siapkan-server.sh
    elif bash deploy/siapkan-server.sh --check; then
        echo "Server sudah siap; tidak ada yang perlu diubah."
    else
        cat >&2 <<EOF

Server belum siap dan user Jenkins "$(id -un)" tidak punya akses root (sudo).
Persiapan server butuh root SEKALI saja. Pilih salah satu:

  a) Jalankan sekali di VPS sebagai root:
       sudo DEPLOY_USER=$(id -un) bash $PWD/deploy/siapkan-server.sh
     Setelah itu semua build berikutnya berjalan otomatis.

  b) Atau beri Jenkins izin sudo, lalu jalankan build ulang.

Lihat node-app/deploy/README.md.
EOF
        exit 1
    fi
}

run_tests() {
    echo "==> Tes (bila gagal, server tidak disentuh)"
    node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<22||(a===22&&b<13)){console.error("Butuh Node.js >= 22.13, terpasang "+process.versions.node); process.exit(1)} console.log("Node.js "+process.versions.node)'
    mkdir -p build
    node --test \
        --test-reporter=spec --test-reporter-destination=stdout \
        --test-reporter=junit --test-reporter-destination=build/junit.xml
}

restart_service() {
    if [[ $EUID -eq 0 ]]; then
        systemctl restart "$SERVICE"
    else
        sudo -n /usr/bin/systemctl restart "$SERVICE"
    fi
}

deploy() {
    echo "==> Salin kode ke $APP_DIR"
    # Database ada di /var/lib/pasarku-node, jadi --delete tidak menyentuh data.
    rsync -a --delete \
        --exclude '.git' --exclude 'data/' --exclude 'build/' --exclude 'test/' \
        ./ "$APP_DIR/"

    echo "==> Restart service (database dicadangkan otomatis sebelum start)"
    restart_service
}

health() {
    echo "==> Cek kesehatan $HEALTH_URL"
    for _ in $(seq 1 20); do
        if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
            echo "Aplikasi merespons. Deploy berhasil."
            return 0
        fi
        sleep 1
    done

    echo "Aplikasi tidak merespons dalam 20 detik setelah restart." >&2
    systemctl status "$SERVICE" --no-pager --lines=30 || true
    journalctl -u "$SERVICE" -n 50 --no-pager 2>/dev/null || true
    return 1
}

case "${1:-all}" in
    provision) provision ;;
    test) run_tests ;;
    deploy) deploy ;;
    health) health ;;
    all) provision; run_tests; deploy; health ;;
    *) echo "Tahap tidak dikenal: $1 (provision|test|deploy|health)" >&2; exit 2 ;;
esac
