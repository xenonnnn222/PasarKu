#!/usr/bin/env bash
# Build React (legacy/react) lalu salin ke folder yang dilayani Apache di /pasarku/.
set -euo pipefail

cd "${WORKSPACE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
STATIC_DIR="${PASARKU_STATIC_DIR:-/var/www/pasarku/static}"

command -v npm >/dev/null || { echo 'Node.js/npm diperlukan pada agent Jenkins.' >&2; exit 1; }
[[ -d "$STATIC_DIR" && -w "$STATIC_DIR" ]] || { echo "Folder $STATIC_DIR tidak ada atau tidak bisa ditulis oleh $(id -un)." >&2; exit 1; }

cd legacy/react
npm ci --no-audit --no-fund
npm run build

# Pastikan hasil build memang untuk /pasarku/ sebelum menyentuh website.
grep -q '/pasarku/assets/' dist/index.html || { echo 'dist/index.html tidak memakai base /pasarku/.' >&2; exit 1; }

# Aset dulu, index.html terakhir: pengunjung tidak pernah dapat index yang menunjuk aset belum ada.
# icons/ di server tidak ikut dihapus karena sumbernya tidak ada di repository.
mkdir -p "$STATIC_DIR/assets"
cp -r dist/assets/. "$STATIC_DIR/assets/"
cp dist/index.html "$STATIC_DIR/index.html.new"
mv "$STATIC_DIR/index.html.new" "$STATIC_DIR/index.html"

echo "Deploy React selesai: $(grep -o 'index-[^"]*\.js' "$STATIC_DIR/index.html") dari commit $(git rev-parse --short HEAD)."
