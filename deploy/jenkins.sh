#!/usr/bin/env bash
# Langkah job Jenkins: tes, sinkronisasi workspace ke folder website, lalu siapkan Laravel.
# Isinya sama dengan "Execute shell" di job; lihat deploy/README.md.
set -euo pipefail

APP=/var/www/html/pasarku

# Tes dulu; kalau gagal, website tidak disentuh.
bash deploy/ci.sh

# Sinkronisasi workspace Jenkins ke folder website. .env dan database di server tidak ditimpa.
rsync -avz --exclude '.git' --exclude '.env' --exclude 'vendor' --exclude 'build' --exclude 'database/*.sqlite' ./ "$APP/"

cd "$APP"
composer install --optimize-autoloader --no-dev --no-interaction
php artisan migrate --force
php artisan optimize

chown -R www-data:www-data "$APP"
chmod -R 775 "$APP/storage"
chmod -R 775 "$APP/bootstrap/cache"
