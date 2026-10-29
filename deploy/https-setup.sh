#!/usr/bin/env bash
# Jalankan di server 103.139.193.51: sudo bash deploy/https-setup.sh
# Memasang HTTPS (Let's Encrypt) untuk dragonfruitdevops.web.id + header keamanan.
set -euo pipefail

DOMAIN=dragonfruitdevops.web.id
[[ $(id -u) -eq 0 ]] || { echo 'Jalankan dengan sudo bash.' >&2; exit 1; }

apt-get update -q
apt-get install -y -q certbot python3-certbot-apache
a2enmod ssl headers rewrite >/dev/null

# VirtualHost khusus domain; Alias /pasarku dari conf pasarku.conf tetap berlaku.
cat > /etc/apache2/sites-available/pasarku-domain.conf <<APACHE
<VirtualHost *:80>
    ServerName $DOMAIN
    ServerAlias www.$DOMAIN
    DocumentRoot /var/www/html
    RedirectMatch 302 ^/$ /pasarku/
</VirtualHost>
APACHE

# Header keamanan dan sembunyikan versi Apache.
cat > /etc/apache2/conf-available/pasarku-security.conf <<'APACHE'
ServerTokens Prod
ServerSignature Off
TraceEnable Off
Header always set X-Content-Type-Options "nosniff"
Header always set X-Frame-Options "SAMEORIGIN"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"
Header always set Strict-Transport-Security "max-age=31536000" "expr=%{HTTPS} == 'on'"
APACHE

a2ensite pasarku-domain >/dev/null
a2enconf pasarku-security >/dev/null
apache2ctl configtest
systemctl reload apache2

# Sertifikat + redirect HTTP -> HTTPS otomatis; perpanjangan otomatis lewat timer certbot.
certbot --apache --non-interactive --agree-tos --register-unsafely-without-email \
    --redirect -d "$DOMAIN" -d "www.$DOMAIN"

systemctl reload apache2
echo "Selesai. Buka https://$DOMAIN/pasarku/#/"
