#!/usr/bin/env bash
# Backup database SQLite PasarKu, lalu uji pemulihannya.
# Dijalankan otomatis tiap hari oleh /etc/cron.d/pasarku-backup (dipasang deploy/jenkins.sh)
# dan sebelum setiap migrasi. Manual: sudo bash /var/www/html/pasarku/deploy/backup-db.sh
#
# Pengaturan opsional di /etc/default/pasarku-backup:
#   BACKUP_DIR=/var/backups/pasarku          lokasi salinan (di luar folder website)
#   BACKUP_KEEP_DAYS=14                      lama penyimpanan
#   BACKUP_REMOTE=user@server-lain:/backup/  salinan ke server lain lewat rsync+SSH key
set -euo pipefail

[[ -f /etc/default/pasarku-backup ]] && . /etc/default/pasarku-backup
DB=${DB:-/var/www/html/pasarku/database/database.sqlite}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/pasarku}
BACKUP_KEEP_DAYS=${BACKUP_KEEP_DAYS:-14}
BACKUP_REMOTE=${BACKUP_REMOTE:-}

log() { echo "[pasarku-backup] $*"; logger -t pasarku-backup -- "$*" 2>/dev/null || true; }

[[ -f $DB ]] || { log "Database $DB tidak ditemukan."; exit 1; }
install -d -m 0700 "$BACKUP_DIR"

stamp=$(date +%Y%m%d-%H%M%S)
tmp="$BACKUP_DIR/.pasarku-$stamp.sqlite"
out="$BACKUP_DIR/pasarku-$stamp.sqlite.gz"

# 1. Salinan konsisten walau aplikasi sedang menulis (VACUUM INTO, SQLite >= 3.27).
php -r '
    $db = new PDO("sqlite:".$argv[1], null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $db->exec("PRAGMA busy_timeout = 10000");
    $db->exec("VACUUM INTO ".$db->quote($argv[2]));
' "$DB" "$tmp"

# 2. Uji pemulihan: buka salinan sebagai database baru, cek integritas, dan hitung isi tabel utama.
check=$(php -r '
    $db = new PDO("sqlite:".$argv[1], null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $ok = $db->query("PRAGMA integrity_check")->fetchColumn();
    if ($ok !== "ok") { fwrite(STDERR, "integrity_check: $ok\n"); exit(1); }
    $parts = [];
    foreach (["users", "transactions", "debts", "products"] as $t) {
        $parts[] = $t."=".$db->query("SELECT COUNT(*) FROM $t")->fetchColumn();
    }
    echo implode(" ", $parts);
' "$tmp") || { rm -f "$tmp"; log "GAGAL: salinan $stamp tidak lolos uji pemulihan."; exit 1; }

gzip -9 -c "$tmp" >"$out"
rm -f "$tmp"
chmod 0600 "$out"
log "Backup OK $out ($(du -h "$out" | cut -f1)), uji pemulihan lulus: $check"

# 3. Rotasi.
find "$BACKUP_DIR" -maxdepth 1 -name 'pasarku-*.sqlite.gz' -mtime +"$BACKUP_KEEP_DAYS" -delete

# 4. Salinan di luar server (opsional, butuh SSH key root ke server tujuan).
if [[ -n $BACKUP_REMOTE ]]; then
    if rsync -a -e 'ssh -o BatchMode=yes' "$out" "$BACKUP_REMOTE"; then
        log "Disalin ke $BACKUP_REMOTE"
    else
        log "PERINGATAN: gagal menyalin ke $BACKUP_REMOTE"
        exit 1
    fi
fi
