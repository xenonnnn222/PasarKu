# Deploy PasarKu (Node.js) ke VPS

Versi Node.js dipasang **berdampingan** dengan PasarKu Laravel yang sudah live:

| | Laravel (sudah live) | Node.js (baru) |
|---|---|---|
| Alamat | `https://dragonfruitdevops.web.id/pasarku/` | `https://dragonfruitdevops.web.id/pasarku-node/` |
| Branch | `main` | `development` |
| Job Jenkins | job yang sudah ada | job baru `pasarku-node` |
| Kode di server | `/var/www/html/pasarku` | `/opt/pasarku-node/app` |
| Database | `/var/www/html/pasarku/database/database.sqlite` | `/var/lib/pasarku-node/pasarku.sqlite` |
| Proses | Apache + PHP-FPM | service systemd `pasarku-node` (port 3100, hanya lokal) |

Tidak ada file, database, atau konfigurasi Laravel yang diubah.

Semua berjalan **otomatis lewat Jenkins**. Setiap push ke `development` menjalankan 4 tahap:

| Tahap | Perintah | Fungsi |
|---|---|---|
| Siapkan server | `jenkins.sh provision` | Memasang/memperbarui Node.js, user `pasarku`, folder, service systemd, dan proxy Apache. Hanya mengubah yang belum sesuai |
| Tes | `jenkins.sh test` | 22 tes otomatis. Bila gagal, kode dan service di server tidak disentuh. Hasil JUnit di `node-app/build/junit.xml` |
| Deploy | `jenkins.sh deploy` | `rsync` kode ke `/opt/pasarku-node/app`, lalu restart service. Sebelum start, database dicadangkan otomatis |
| Cek kesehatan | `jenkins.sh health` | Build gagal bila `/healthz` tidak merespons dalam 20 detik |

## 1. Buat job Jenkins (satu-satunya langkah manual)

Jangan mengubah job Laravel yang sudah ada. Buat job baru:

1. **New Item** → nama `pasarku-node` → pilih **Pipeline**.
2. **Build Triggers** → centang **GitHub hook trigger for GITScm polling** (webhook GitHub yang sama dengan job Laravel).
3. **Pipeline** → Definition: **Pipeline script from SCM**.
   - SCM: Git, Repository URL: `https://github.com/xenonnnn222/PasarKu.git`
   - Branch Specifier: `*/development`
   - Script Path: `node-app/Jenkinsfile`
4. Simpan, lalu klik **Build Now**.

Build pertama memasang semuanya (Node.js 24 dari repositori resmi NodeSource, service, proxy Apache), lalu men-deploy aplikasi. Build berikutnya hanya tes dan deploy, karena tahap "Siapkan server" tidak menemukan perubahan.

### Hak akses Jenkins

Tahap "Siapkan server" butuh root untuk memasang paket, service, dan konfigurasi Apache:

- **Jenkins berjalan sebagai root, atau punya sudo tanpa password:** tidak perlu apa-apa. Skrip Laravel yang sudah ada (`chown www-data`) menunjukkan Jenkins Anda kemungkinan besar sudah punya akses ini.
- **Jenkins tanpa akses root:** build pertama gagal di tahap "Siapkan server" dengan pesan berisi perintah yang harus dijalankan **sekali** sebagai root di VPS:

  ```bash
  sudo DEPLOY_USER=jenkins bash /var/lib/jenkins/workspace/pasarku-node/node-app/deploy/siapkan-server.sh
  ```

  Skrip tersebut juga memberi Jenkins izin terbatas: hanya `systemctl restart pasarku-node`. Setelah itu semua build berjalan otomatis; tahap "Siapkan server" cukup memeriksa (`--check`) tanpa root.

### Yang disiapkan otomatis (`deploy/siapkan-server.sh`)

1. **Node.js 24** dari repositori resmi NodeSource (bila belum ada Node 22.13+), serta `rsync` dan `curl`.
2. User sistem `pasarku` yang menjalankan aplikasi (tanpa login shell).
3. `/opt/pasarku-node/app` (ditulis Jenkins) dan `/var/lib/pasarku-node` (database, hanya user `pasarku`).
4. Service systemd `pasarku-node` (`deploy/pasarku-node.service`).
5. Izin `systemctl restart pasarku-node` untuk user Jenkins bila bukan root (`/etc/sudoers.d/pasarku-node`).
6. Modul Apache `proxy`, `proxy_http`, `headers` dan `deploy/apache-pasarku-node.conf`. Apache hanya di-reload bila ada perubahan, dan **hanya setelah `configtest` lulus**. Bila konfigurasi tidak valid, proxy baru dinonaktifkan dan Apache tidak di-reload, jadi Laravel tetap berjalan.

Port **3100** dipakai service. Bila sudah terpakai, ubah `PORT` di `pasarku-node.service`, alamat di `apache-pasarku-node.conf`, dan `HEALTH_URL` di `jenkins.sh`, lalu push. Build berikutnya menerapkan perubahan itu.

## 2. Verifikasi

```bash
systemctl status pasarku-node --no-pager
curl -s http://127.0.0.1:3100/healthz
```

Buka `https://dragonfruitdevops.web.id/pasarku-node/`, coba demo, lalu daftar akun. Pastikan `https://dragonfruitdevops.web.id/pasarku/` (Laravel) tetap normal.

Log aplikasi:

```bash
sudo journalctl -u pasarku-node -n 100 --no-pager
```

## 3. Memindahkan data dari Laravel

1. Di versi Laravel: **Pengaturan → Unduh cadangan** (file JSON).
2. Di versi Node.js: daftar akun, lalu **Pengaturan → Impor pembukuan** dengan file tersebut.

Format cadangan sama (`schemaVersion: 2`). Pembukuan akun tujuan harus kosong. PIN tidak ikut dipindahkan: pengguna mendaftar dan membuat PIN di versi baru.

## Backup dan pemulihan database

Setiap restart (termasuk setiap deploy), salinan database dibuat di `/var/lib/pasarku-node/backups/` (14 terakhir disimpan).

Memulihkan salinan:

```bash
sudo systemctl stop pasarku-node
sudo cp /var/lib/pasarku-node/backups/pasarku-TANGGAL.sqlite /var/lib/pasarku-node/pasarku.sqlite
sudo rm -f /var/lib/pasarku-node/pasarku.sqlite-wal /var/lib/pasarku-node/pasarku.sqlite-shm
sudo chown pasarku:pasarku /var/lib/pasarku-node/pasarku.sqlite
sudo systemctl start pasarku-node
```

## Menghentikan atau menghapus versi Node.js

```bash
sudo a2disconf pasarku-node && sudo systemctl reload apache2
sudo systemctl disable --now pasarku-node
```

Laravel di `/pasarku/` tidak terpengaruh.

## Nanti: memindahkan `/pasarku/` ke versi Node.js

Lakukan setelah versi Node.js terbukti stabil dan data sudah dipindahkan:

1. Ubah `BASE_PATH=/pasarku` di `/etc/systemd/system/pasarku-node.service`, lalu `sudo systemctl daemon-reload`.
2. Cadangkan `/etc/apache2/conf-available/pasarku.conf` (konfigurasi Laravel), lalu ganti isinya dengan proxy ke `127.0.0.1:3100` (seperti `apache-pasarku-node.conf`, dengan `/pasarku/`).
3. `sudo apache2ctl configtest && sudo systemctl reload apache2 && sudo systemctl restart pasarku-node`.
4. Nonaktifkan job Jenkins Laravel agar tidak menimpa apa pun.

Untuk membatalkan, kembalikan `pasarku.conf` dari cadangan dan reload Apache.
