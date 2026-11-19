#!/usr/bin/env bash
# Menarik backup database PasarKu dari VPS ke mesin Linux lain (checklist OWASP J3), mis. server Jenkins lain.
#   SERVER=103.139.193.51 PORT=2222 DEST=~/pasarku-backup bash deploy/pull-backup.sh
# Jadwal harian (crontab -e):  30 3 * * * SERVER=103.139.193.51 bash /path/pull-backup.sh >>~/pasarku-pull.log 2>&1
set -euo pipefail

SERVER=${SERVER:-103.139.193.51}
PORT=${PORT:-2222}
USER_NAME=${SSH_USER:-root}
DEST=${DEST:-$HOME/pasarku-backup}
KEEP_DAYS=${KEEP_DAYS:-30}
REMOTE=/var/backups/pasarku
SSH=(ssh -p "$PORT" -o BatchMode=yes -o ConnectTimeout=20 "$USER_NAME@$SERVER")

mkdir -p "$DEST"
cd "$DEST"
new=0
for name in $("${SSH[@]}" "for f in $REMOTE/pasarku-*.sqlite.gz; do [ -f \"\$f.sha256\" ] && basename \"\$f\"; done; true"); do
    [[ $name =~ ^pasarku-[0-9]{8}-[0-9]{6}\.sqlite\.gz$ && ! -f $name ]] || continue
    scp -P "$PORT" -o BatchMode=yes -q "$USER_NAME@$SERVER:$REMOTE/$name" "$USER_NAME@$SERVER:$REMOTE/$name.sha256" .
    if sha256sum -c --quiet "$name.sha256" && gzip -t "$name"; then
        echo "OK $name"
        new=$((new + 1))
    else
        rm -f "$name" "$name.sha256"
        echo "GAGAL verifikasi $name" >&2
        exit 1
    fi
done
find "$DEST" -maxdepth 1 -name 'pasarku-*.sqlite.gz*' -mtime +"$KEEP_DAYS" -delete
"${SSH[@]}" "date -Is > $REMOTE/.last-offsite-pull && echo '$(hostname)' >> $REMOTE/.last-offsite-pull"
echo "Selesai: $new file baru di $DEST"
