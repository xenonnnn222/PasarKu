#!/usr/bin/env bash
set -euo pipefail
umask 0022

cd "${WORKSPACE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
commit="$(git rev-parse HEAD)"
[[ -f build/tested-commit && "$(cat build/tested-commit)" == "$commit" ]] || { echo 'Jalankan deploy/ci.sh dan luluskan tes untuk commit ini terlebih dahulu.' >&2; exit 1; }
git diff --quiet && git diff --cached --quiet || { echo 'Deployment memerlukan checkout bersih dari commit yang diuji.' >&2; exit 1; }
branch="${GIT_BRANCH:-$(git branch --show-current)}"
case "$branch" in main|origin/main|refs/heads/main) ;; *) echo 'Deployment hanya diperbolehkan dari branch main.' >&2; exit 1 ;; esac
for tool in php composer rsync flock; do command -v "$tool" >/dev/null || { echo "Program $tool belum tersedia." >&2; exit 1; }; done

DEPLOY_ROOT=/var/www/pasarku
WEB_GROUP="${PASARKU_WEB_GROUP:-www-data}"
shared="$DEPLOY_ROOT/shared"
[[ -f "$shared/.env" ]] || { echo "Siapkan $shared/.env mengikuti deploy/README.md." >&2; exit 1; }
grep -Eq '^APP_ENV=production$' "$shared/.env" && grep -Eq '^APP_DEBUG=false$' "$shared/.env" || { echo 'Gunakan APP_ENV=production dan APP_DEBUG=false pada .env server.' >&2; exit 1; }
exec 9>"$DEPLOY_ROOT/.deploy.lock"
flock -n 9 || { echo 'Deployment PasarKu lain sedang berjalan.' >&2; exit 1; }

mkdir -p "$DEPLOY_ROOT/releases" "$shared/storage/app/private" "$shared/storage/app/public" "$shared/storage/framework/cache/data" "$shared/storage/framework/sessions" "$shared/storage/framework/views" "$shared/storage/logs" "$shared/backups"
release="$(mktemp -d "$DEPLOY_ROOT/releases/$(date -u +%Y%m%dT%H%M%SZ)-${commit:0:8}-XXXXXX")"
chmod 755 "$release"
rsync -a --exclude='.git/' --exclude='.env' --exclude='.env.*' --exclude='vendor/' --exclude='legacy/' --exclude='node_modules/' --exclude='dist/' --exclude='storage/' --exclude='build/' --exclude='database/*.sqlite*' --exclude='bootstrap/cache/*.php' --exclude='.phpunit.cache/' ./ "$release/"
ln -s "$shared/.env" "$release/.env"
ln -s "$shared/storage" "$release/storage"
cd "$release"
composer install --no-dev --optimize-autoloader --prefer-dist --no-interaction --no-progress
composer check-platform-reqs --no-dev
if grep -Eq '^APP_KEY=[[:space:]]*$' "$shared/.env"; then php artisan key:generate --force; fi
php -r 'require "vendor/autoload.php"; $app = require "bootstrap/app.php"; $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); $app->make("encrypter");'

# SQLite is kept outside releases; its backup includes pending WAL changes.
if [[ -s "$shared/database.sqlite" ]]; then
    php -r '$source = new SQLite3($argv[1]); $target = new SQLite3($argv[2]); if (!$source->backup($target)) { exit(1); }' "$shared/database.sqlite" "$shared/backups/$(basename "$release").sqlite"
elif [[ ! -e "$shared/database.sqlite" ]]; then
    touch "$shared/database.sqlite"
fi
php artisan migrate --force
php artisan optimize

chgrp "$WEB_GROUP" "$shared" "$shared/.env" "$shared/database.sqlite"
chmod 2770 "$shared"
chmod 640 "$shared/.env"
chmod 660 "$shared/database.sqlite"
chgrp -R "$WEB_GROUP" "$shared/storage" "$release/bootstrap/cache"
find "$shared/storage" "$release/bootstrap/cache" -type d -exec chmod 2770 {} +
find "$shared/storage" "$release/bootstrap/cache" -type f -exec chmod 660 {} +

# Publish only after dependencies, migrations, and caches succeeded.
next_link="$DEPLOY_ROOT/.next-$(basename "$release")"
ln -s "$release" "$next_link"
mv -Tf "$next_link" "$DEPLOY_ROOT/current"
echo "Deployment selesai: ${commit:0:8}. Buka URL aplikasi dan periksa halaman /up."
