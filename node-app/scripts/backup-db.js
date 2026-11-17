// Membuat salinan database yang konsisten (VACUUM INTO) sebelum aplikasi dijalankan ulang.
// Dipanggil otomatis oleh systemd (ExecStartPre) setiap kali service di-restart saat deploy.
// Menyimpan 14 salinan terakhir di folder backups/ di samping file database.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/config.js';

const KEEP = Number(process.env.BACKUP_KEEP ?? 14);
const dir = process.env.BACKUP_DIR ?? path.join(path.dirname(config.dbPath), 'backups');

if (!fs.existsSync(config.dbPath)) {
  console.log(`Belum ada database di ${config.dbPath}, backup dilewati.`);
  process.exit(0);
}

fs.mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = path.join(dir, `pasarku-${stamp}.sqlite`);

const db = new DatabaseSync(config.dbPath);
try {
  db.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
} finally {
  db.close();
}
console.log(`Backup database: ${target}`);

const old = fs
  .readdirSync(dir)
  .filter((name) => /^pasarku-.*\.sqlite$/.test(name))
  .sort()
  .reverse()
  .slice(KEEP);
for (const name of old) fs.unlinkSync(path.join(dir, name));
