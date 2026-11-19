#!/usr/bin/env bash
# Versi skrip dari langkah job Jenkins (untuk job baru atau menjalankan deploy manual).
# Job Jenkins yang sudah ada TIDAK perlu diubah: Execute shell-nya memanggil deploy/ci.sh,
# dan ci.sh menjalankan deploy/server-setup.sh setelah tes lulus.
set -euo pipefail

APP=/var/www/html/pasarku
[[ $EUID -eq 0 ]] || { echo "deploy/jenkins.sh butuh root (sekarang: $(id -un))." >&2; exit 1; }

# Tes, lalu persiapan server (lihat akhir deploy/ci.sh). Bila gagal, website tidak disentuh.
bash deploy/ci.sh

rsync -az --exclude '.git' --exclude '.env' --exclude 'vendor' --exclude 'build' --exclude 'database/*.sqlite*' ./ "$APP/"

cd "$APP"
composer install --optimize-autoloader --no-dev --no-interaction
php artisan migrate --force
php artisan optimize
/usr/local/sbin/pasarku-fix-permissions --now
echo 'Deploy selesai.'
