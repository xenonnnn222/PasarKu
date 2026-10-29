#!/usr/bin/env bash
# Persiapan server sekali jalan untuk Laravel PasarKu (Ubuntu + Apache).
# Jalankan: sudo bash deploy/siapkan-server.sh
# Tidak mengubah Alias /pasarku yang aktif; website lama tetap tampil sampai Alias diganti.
set -euo pipefail

[[ $(id -u) -eq 0 ]] || { echo 'Jalankan dengan sudo bash.' >&2; exit 1; }
cd "$(dirname "${BASH_SOURCE[0]}")/.."
. /etc/os-release
echo "Server: $PRETTY_NAME"

# 1. PHP 8.3. Ubuntu 22.04 belum punya paketnya, jadi pakai PPA ondrej/php.
apt-get update
if ! apt-cache show php8.3-cli >/dev/null 2>&1; then
    apt-get install -y software-properties-common
    add-apt-repository -y ppa:ondrej/php
    apt-get update
fi
apt-get install -y php8.3-cli php8.3-fpm php8.3-sqlite3 php8.3-mbstring php8.3-xml php8.3-curl php8.3-zip php8.3-intl unzip rsync

# Jenkins memanggil "php"; arahkan ke 8.3. PHP lama tetap terpasang.
update-alternatives --set php /usr/bin/php8.3
php -r 'if (PHP_VERSION_ID < 80300) { fwrite(STDERR, "php CLI masih di bawah 8.3\n"); exit(1); }'

# 2. Composer global, dengan verifikasi checksum installer resmi.
if ! command -v composer >/dev/null; then
    tmp=$(mktemp -d)
    expected=$(curl -fsSL https://composer.github.io/installer.sig)
    curl -fsSL https://getcomposer.org/installer -o "$tmp/installer.php"
    actual=$(php -r 'echo hash_file("sha384", $argv[1]);' "$tmp/installer.php")
    [[ "$expected" == "$actual" ]] || { echo 'Checksum installer Composer tidak cocok.' >&2; exit 1; }
    php "$tmp/installer.php" --install-dir=/usr/local/bin --filename=composer
    rm -rf "$tmp"
fi

# 3. Apache: modul untuk PHP-FPM yang hanya dipakai folder PasarKu (lihat deploy/apache-pasarku.conf).
a2enmod rewrite proxy_fcgi setenvif
systemctl enable --now php8.3-fpm

# 4. Folder rilis bersama. .env hanya dibuat sekali agar APP_KEY dan data tidak hilang.
install -d -g www-data -m 2770 /var/www/pasarku/shared
if [[ ! -f /var/www/pasarku/shared/.env ]]; then
    install -g www-data -m 640 deploy/.env.production.example /var/www/pasarku/shared/.env
fi

apache2ctl configtest
systemctl reload apache2

echo
echo "== Ringkasan =="
php -v | head -1
composer --version
systemctl is-active php8.3-fpm
echo "Pengguna yang menjalankan Jenkins: $(ps -o user= -C java | sort -u | tr '\n' ' ')"
echo 'Selesai. Langkah berikutnya: aktifkan tahap Laravel di Jenkins (lihat deploy/README.md).'
