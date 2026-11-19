#!/usr/bin/env bash
set -euo pipefail

cd "${WORKSPACE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
mkdir -p build
rm -f build/tested-commit build/junit.xml
command -v php >/dev/null || { echo 'PHP 8.3+ diperlukan pada agent Jenkins.' >&2; exit 1; }
command -v composer >/dev/null || { echo 'Composer diperlukan pada agent Jenkins.' >&2; exit 1; }
php -r 'exit(version_compare(PHP_VERSION, "8.3.0", ">=") ? 0 : 1);' || { echo 'Versi PHP minimal 8.3.' >&2; exit 1; }

composer validate --strict --no-check-publish
composer install --prefer-dist --no-interaction --no-progress
composer check-platform-reqs
./vendor/bin/pint --test
php artisan config:clear
php artisan test --compact --log-junit build/junit.xml
php artisan view:cache
git rev-parse HEAD > build/tested-commit
echo 'CI selesai: kode rapi (Pint), tes lulus, dan kompilasi Blade berhasil.'

# Di server Jenkins (root), job berikutnya menjalankan rsync workspace → website tanpa
# pengecualian tambahan. Bersihkan workspace dari file yang tidak boleh ikut ke server
# (log tes, view hasil kompilasi, sisa build frontend lama), lalu siapkan server.
if [[ -n ${JENKINS_HOME:-} && $EUID -eq 0 && -d /var/www/html/pasarku ]]; then
    rm -rf node_modules dist .phpunit.result.cache
    find storage/logs -maxdepth 1 -type f -name '*.log' -delete
    find storage/framework/views storage/framework/sessions storage/framework/cache/data \
        -type f ! -name '.gitignore' -delete 2>/dev/null || true
    bash deploy/server-setup.sh
fi
