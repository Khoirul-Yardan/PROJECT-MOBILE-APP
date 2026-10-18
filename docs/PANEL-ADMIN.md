# Panel Admin AI Hub — status 19 Oktober 2026

Panel operasional untuk akun/profil pengguna, metadata database, maintenance, pengumuman, audit, dan status layanan. Pembaruan ini menyelaraskan implementasi setelah penyederhanaan dan deployment 18 Oktober; dasar: `admin/lib/resources.js`, `admin/public/js/`, dan [HANDOFF.md](HANDOFF.md). Riwayat keputusan awal K-004 dipertahankan; cakupan terbaru dijelaskan K-005.

## 1. Akses dan arsitektur

Lokal: `cd web` lalu `docker compose up -d --build`; admin di `http://localhost:8095`, aplikasi di `http://localhost:8090`. Pengelola menyiapkan `ADMIN_USER`, `ADMIN_PASSWORD`, `SESSION_SECRET`, dan `SUPABASE_SERVICE_KEY` melalui environment; lihat `admin/.env.example`. Jangan menyalin nilai rahasia ke dokumentasi.

Deployment 18 Oktober tercatat pada `https://ai-hub-admin.fly.dev`; web/relay pada `https://ai-hub-web.fly.dev`. Alamat tersebut adalah catatan deployment, tidak diperiksa ulang sewaktu penyusunan laporan. Kode deployment berada di `admin/fly.toml` dan `admin/Dockerfile.fly`.

Browser → cookie sesi → layanan Node admin → Supabase. Service key berada di server; data aplikasi tetap memakai akses pengguna dan RLS. Skema admin ada di `app/supabase/schema-admin.sql`. Menjalankan/mengubah migrasi adalah tindakan terpisah dari membaca dokumen ini.

## 2. Cakupan panel terbaru

| Menu | Fungsi | Batas |
|---|---|---|
| Dashboard | Hitungan data, grafik sesi, aktivitas admin | Ringkasan operasional, bukan hasil evaluasi klinis |
| Akun pengguna | Buat/kelola akun umum, nama, password, status akses | Tidak menawarkan pilihan peran dokter/perawat |
| Profil pengguna | Kelola field profil yang diizinkan | Field `role` tidak dapat diedit melalui panel |
| Metadata database | Sesi BPJS, segmen, dokumentasi LLM, event/ruangan papan, pesan, kredensial/VPN/log | Daftar kolom eksplisit; tanpa isi pasien atau kunci rahasia; read-only |
| Maintenance | Jadwal, pesan, banner atau overlay web | Tidak memblokir tautan pasien `#/p`; layar native BPJS/Anamnesis tidak otomatis tertutup overlay web |
| Pengumuman | Buat/edit/hapus, jenis, jadwal tayang | Gambar formulir bukan bukti pengumuman sudah terkirim ke semua perangkat |
| Audit log | Jejak tindakan admin | Tidak sama dengan log klinis atau bukti persetujuan dokter |
| Status & Setup | Kesehatan layanan, keberadaan tabel, SQL sumber | Status satu saat tidak menjamin uptime jangka panjang |

Katalog **Bot**, **Provider AI**, dan **Pengaturan** generik sudah dikeluarkan dari navigasi/API CRUD panel. Tabel konfigurasi lama/pembacaan remote di aplikasi tidak otomatis dihapus. Maintenance dan Pengumuman tetap dipertahankan.

## 3. Privasi dan akses

- `admin/lib/resources.js` membatasi data pasien pada metadata; contoh segmen hanya ID, sesi, speaker, offset, waktu. Isi transkrip dan draf LLM tidak ditampilkan.
- Tulis ke resource metadata ditolak. Penghitungan/cek tabel menggunakan HEAD sesuai perbaikan 18 Oktober.
- Service key melewati RLS, sehingga pembatasan server tetap wajib; keberadaan RLS saja bukan pagar untuk layanan admin.
- Audit mencatat nama field dan ID, bukan nilai perubahan. Penghapusan akun berdampak ke data terkait dan memerlukan konfirmasi dalam UI.
- Login memakai akun environment; sesi cookie HttpOnly/SameSite, Secure pada HTTPS; pemeriksaan Origin/CSRF dan pembatasan percobaan login tersedia.
- Tidak ada editor SQL bebas, antarmuka dokter, penetapan diagnosis, atau akses isi dokumentasi klinis melalui panel.

## 4. Hasil uji yang tercatat

| Lingkup | Sumber | Hasil / batas |
|---|---|---|
| API dan UI desktop/mobile fixture | `web/tests/admin_smoke.py`, HANDOFF 18 Oktober | Tercatat lulus; katalog lama 404, role ditolak, metadata dibatasi |
| Web fixture | `web/tests/ui_smoke.py` | Tercatat 13 rute × 4 lebar layar; fixture bukan database pasien nyata |
| Admin Fly desktop | `web/tests/admin_live.py` | Tercatat lulus login HTTPS/cookie, status, halaman dan metadata; tidak mengubah data bisnis |
| Admin di HP | `web/tests/admin_phone.mjs` | Chrome pada Infinix X6851, akses Fly, navigasi sentuh; bukan uji seluruh alur dalam WebView APK |
| Gambar Progres 2 | 12 screenshot admin | Dokumentasi tampilan, formulir, metadata, dashboard; bukan uji ulang server |

Penyusunan laporan ini tidak menjalankan ulang tes aplikasi. Rekaman STT/LLM, VPN/SSH nyata ujung ke ujung, dan publikasi maintenance/pengumuman pada pengguna produksi tidak dibuktikan oleh tes admin tersebut.

## 5. Tindak lanjut

Uji perubahan maintenance dan pengumuman secara terkendali; periksa penerimaan pada perangkat, penjadwalan, dan pengecualian tautan papan. Pertahankan pembatasan metadata. Catat tanggal, versi, lingkungan, serta hasil aktual setiap pengujian baru sebelum mengubah status laporan.
