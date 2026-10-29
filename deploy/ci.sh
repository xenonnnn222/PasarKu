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
php artisan config:clear
php artisan test --compact --log-junit build/junit.xml
php artisan view:cache
git rev-parse HEAD > build/tested-commit
echo 'CI selesai: tes dan kompilasi Blade berhasil.'
