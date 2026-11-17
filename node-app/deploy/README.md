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

Alur CI/CD: push ke `development` → Jenkins `pasarku-node` → tes → `rsync` ke `/opt/pasarku-node/app` → restart service (database dicadangkan otomatis) → cek `/healthz`.

## 1. Siapkan server (sekali saja)

Di VPS, ambil branch `development` di folder mana saja (misalnya home Anda), lalu jalankan:

```bash
git clone -b development https://github.com/xenonnnn222/PasarKu.git ~/pasarku-node-setup
cd ~/pasarku-node-setup
sudo bash node-app/deploy/siapkan-server.sh
```

Bila user Jenkins bukan `jenkins`, beri tahu namanya:

```bash
sudo JENKINS_USER=nama-user bash node-app/deploy/siapkan-server.sh
```

Skrip ini:

1. Memasang **Node.js 24** dari repositori resmi NodeSource (bila belum ada Node 22.13+).
2. Membuat user sistem `pasarku` yang menjalankan aplikasi (tanpa login shell).
3. Membuat `/opt/pasarku-node/app` (ditulis Jenkins) dan `/var/lib/pasarku-node` (database, hanya user `pasarku`).
4. Memasang dan mengaktifkan service `pasarku-node` (`deploy/pasarku-node.service`).
5. Mengizinkan Jenkins menjalankan **hanya** `sudo systemctl restart pasarku-node` (`/etc/sudoers.d/pasarku-node`).
6. Mengaktifkan modul Apache `proxy`, `proxy_http`, `headers` dan memasang `deploy/apache-pasarku-node.conf`, lalu `configtest` dan reload Apache.

Port **3100** dipakai service. Bila sudah terpakai, ubah `PORT` di `pasarku-node.service`, alamat di `apache-pasarku-node.conf`, dan `HEALTH_URL` di `jenkins.sh`.

## 2. Buat job Jenkins baru

Jangan mengubah job Laravel yang sudah ada. Buat job baru:

1. **New Item** → nama `pasarku-node` → pilih **Pipeline**.
2. **Pipeline** → Definition: **Pipeline script from SCM**.
   - SCM: Git, Repository URL: `https://github.com/xenonnnn222/PasarKu.git`
   - Branch Specifier: `*/development`
   - Script Path: `node-app/Jenkinsfile`
3. **Build Triggers** → centang **GitHub hook trigger for GITScm polling**.
4. Simpan, lalu klik **Build Now** untuk build pertama.

`deploy/jenkins.sh` menjalankan:

| Langkah | Fungsi |
|---|---|
| Cek versi Node.js | Gagal jelas bila Node terlalu lama |
| `node --test` | Tes; bila gagal, server tidak disentuh. Hasil JUnit di `node-app/build/junit.xml` |
| `rsync --delete` ke `/opt/pasarku-node/app` | Menyalin kode. Database ada di folder lain, jadi tidak terhapus |
| `sudo systemctl restart pasarku-node` | Menjalankan versi baru. Sebelum start, `scripts/backup-db.js` mencadangkan database |
| `curl /healthz` | Build gagal bila aplikasi tidak merespons dalam 20 detik |

## 3. Verifikasi

```bash
systemctl status pasarku-node --no-pager
curl -s http://127.0.0.1:3100/healthz
```

Buka `https://dragonfruitdevops.web.id/pasarku-node/`, coba demo, lalu daftar akun. Pastikan `https://dragonfruitdevops.web.id/pasarku/` (Laravel) tetap normal.

Log aplikasi:

```bash
sudo journalctl -u pasarku-node -n 100 --no-pager
```

## 4. Memindahkan data dari Laravel

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
