#!/usr/bin/env bash
# Persiapan server sekali jalan untuk Laravel PasarKu (Ubuntu 22.04 + Apache).
# Jalankan: sudo bash deploy/siapkan-server.sh
# Tidak mengubah Alias /pasarku yang aktif; website lama tetap tampil sampai Alias diganti.
set -euo pipefail

APP=/var/www/html/pasarku
PPA_KEY=14AA40EC0831756756D7F66C4F4EA0AAE5267A6C

[[ $(id -u) -eq 0 ]] || { echo 'Jalankan dengan sudo bash.' >&2; exit 1; }
cd "$(dirname "${BASH_SOURCE[0]}")/.."
. /etc/os-release
echo "Server: $PRETTY_NAME"

# 1. PHP 8.3 dari PPA ondrej/php. Ditambahkan manual karena add-apt-repository
#    memanggil API Launchpad yang sering timeout dari server ini.
apt-get update
if ! apt-cache show php8.3-cli >/dev/null 2>&1; then
    install -d -m 0755 /etc/apt/keyrings
    curl -fsSL "https://keyserver.ubuntu.com/pks/lookup?op=get&search=0x$PPA_KEY" | gpg --dearmor --yes -o /etc/apt/keyrings/ondrej-php.gpg
    gpg --show-keys --with-colons /etc/apt/keyrings/ondrej-php.gpg | grep -q "^fpr:::::::::$PPA_KEY:" || { echo 'Sidik jari kunci PPA tidak cocok.' >&2; exit 1; }
    echo "deb [signed-by=/etc/apt/keyrings/ondrej-php.gpg] https://ppa.launchpadcontent.net/ondrej/php/ubuntu $VERSION_CODENAME main" > /etc/apt/sources.list.d/ondrej-php.list
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

# 4. .env dan database dibuat sekali; rsync Jenkins tidak menimpa keduanya.
install -d -o www-data -g www-data -m 775 "$APP" "$APP/database"
if [[ ! -f "$APP/.env" ]]; then
    install -o www-data -g www-data -m 640 deploy/.env.production.example "$APP/.env"
    key="base64:$(php -r 'echo base64_encode(random_bytes(32));')"
    sed -i "s|^APP_KEY=.*|APP_KEY=$key|" "$APP/.env"
fi
[[ -f "$APP/database/database.sqlite" ]] || install -o www-data -g www-data -m 664 /dev/null "$APP/database/database.sqlite"

apache2ctl configtest
systemctl reload apache2

echo
echo "== Ringkasan =="
php -v | head -1
composer --version
systemctl is-active php8.3-fpm
echo "Pengguna yang menjalankan Jenkins: $(ps -o user= -C java | sort -u | tr '\n' ' ')"
echo 'Selesai. Langkah berikutnya: Build Now di Jenkins.'
