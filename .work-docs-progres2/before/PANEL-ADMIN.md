# Panel Admin AI Hub

Panel web penuh untuk mengelola sistem tanpa membuka dashboard Supabase: bot, provider AI, pengumuman, mode maintenance, akun pengguna, dan penelusuran data (metadata). Dibuat atas permintaan pengguna 18 Okt 2026; keputusan desain di `docs/KEPUTUSAN.md` (K-004).

## 1. Cepat mulai

```sh
# 1. Isi rahasia di web/.env (sudah di-gitignore). Contoh variabel: admin/.env.example
#    ADMIN_USER, ADMIN_PASSWORD (min. 12 karakter), SESSION_SECRET, SUPABASE_SERVICE_KEY
# 2. Jalankan bersama web & relay
cd web && docker compose up -d --build
# 3. Buka panel
#    http://localhost:8095   (aplikasi tetap di http://localhost:8090)
# 4. Menu "Status & Setup" -> salin SQL -> tempel di Supabase SQL Editor -> Run (sekali saja)
```

`SUPABASE_SERVICE_KEY` ada di Supabase → Project Settings → API Keys (kunci *secret* `sb_secret_…`, atau `service_role`). Kunci ini **melewati RLS**; hanya container `admin` yang memegangnya. Jangan masukkan ke `web/public`, APK, atau repo.

## 2. Arsitektur

```
browser admin ──cookie sesi──▶ admin :8095 (Node, tanpa npm) ──service key──▶ Supabase
                                  │  ├─ http://web   (cek kesehatan SPA)
                                  │  └─ http://relay (cek kesehatan relay)
                    jaringan compose yang sama dengan web :8090 dan relay
aplikasi/WebView ──anon/user key + RLS (hanya SELECT)──▶ tabel konfigurasi
```

- `admin/server.js` + `admin/lib/*` — API dan satu-satunya klien Supabase ber-service-key.
- `admin/public/` — UI vanilla JS (tanpa bundler), token desain sama dengan `web/public/style.css`.
- `app/supabase/schema-admin.sql` — tabel baru; dipasang read-only ke container admin sehingga halaman Setup menampilkan SQL yang persis sama.
- `web/public/remote-config.js` — sisi aplikasi: membaca maintenance, pengumuman, bot, provider (realtime).

## 3. Fitur

| Menu | Fungsi | Dampak di aplikasi |
|---|---|---|
| Dashboard | Jumlah pengguna/sesi/segmen/event, grafik sesi 14 hari, aktivitas admin | — |
| Maintenance | Jadwal mulai/selesai, pesan, blokir penuh atau banner saja, kirim notifikasi | Banner pengingat sebelum mulai; layar penuh "sedang pemeliharaan" saat berlangsung; otomatis selesai |
| Pengumuman | CRUD pengumuman (info/sukses/peringatan/maintenance), jendela tayang | Banner dalam aplikasi, bisa ditutup pengguna, muncul realtime |
| Bot | CRUD kartu di Bot Hub (rute internal atau URL) | Kartu baru di tab Bot tanpa rilis ulang |
| Provider AI | CRUD katalog provider (openai/anthropic/gemini-compatible), pola deteksi key | Muncul di katalog dan deteksi API key |
| Pengaturan | Key/value `app_settings` (JSON) | Dibaca aplikasi bila perlu |
| Akun pengguna | Buat, ubah nama/peran, reset password, blokir, hapus (ketik email) | — |
| Profil & peran | CRUD `profiles` | — |
| Data (metadata) | Telusuri sesi, segmen, dokumentasi, event, pesan, API key, VPN, log | Hanya baca |
| Audit log | Semua perubahan admin | — |
| Status & Setup | Kesehatan Supabase/web/relay, cek tabel, SQL migrasi | — |

Catatan perilaku:
- Maintenance **tidak memblokir tautan pasien/keluarga** (`#/p`, Papan Komunikasi) agar panggilan bantuan tetap bisa dikirim. Bot BPJS dan Anamnesis adalah layar native di luar WebView, jadi tidak terkena overlay; banner/overlay hanya untuk lapisan web. Bila perlu memblokir native juga, itu perubahan terpisah di `app/`.
- Bot buatan admin terbatas pada **rute internal** atau **URL http(s)**. Bot yang merekam suara butuh jembatan native dan tetap harus dibuat lewat kode.
- Bot dan provider tambahan tidak boleh melanggar pagar akademik (`AGENTS.md` §2): tidak ada alur rekam ucapan dokter, tidak ada fitur diagnosis oleh AI.

## 4. Privasi (pagar §2 butir 5)

Karena service key melewati RLS, pembatasan dilakukan di server (`admin/lib/resources.js`):

- Tabel konfigurasi (bot, provider, pengumuman, pengaturan, profil) → CRUD penuh.
- Tabel berisi data pasien/rahasia (`bpjs_*`, `chat_messages`, `komunikasi_*`, `api_credentials`, `vpn_configs`, `activity_log`) → **hanya baca, hanya metadata**. Kolom isi (teks transkrip, nama pasien/dokter, ringkasan, detail event, kunci terenkripsi, judul log) tidak pernah di-`select`. Perintah tulis ke tabel ini ditolak 403.
- Tidak ada editor SQL bebas atau akses langsung Postgres. Menambah tabel ke daftar = keputusan baru di `KEPUTUSAN.md`.
- Audit log hanya mencatat nama field dan ID, bukan nilai.
- Menghapus akun pengguna ikut menghapus semua datanya (cascade) — butuh mengetik email.

## 5. Keamanan panel

- Login satu akun dari environment; password dibandingkan timing-safe; tanpa `ADMIN_PASSWORD` login tertutup.
- Sesi: cookie HttpOnly + SameSite=Strict, HMAC, 8 jam. Pembatas 8 percobaan gagal / 10 menit / IP. Set `COOKIE_SECURE=true` bila disajikan lewat HTTPS dan `TRUST_PROXY=true` bila di belakang reverse proxy sendiri.
- CSRF: header `X-Requested-With` wajib + cek `Origin`. CSP ketat (`script-src 'self'`), tanpa inline script.
- Port 8095 **jangan dibuka ke internet** tanpa HTTPS di depannya (Fly: pakai `fly proxy` atau layanan privat; lihat bagian 7).

## 6. Pemakaian sehari-hari

**Menjadwalkan maintenance:** Maintenance → centang aktifkan → isi pesan, mulai, selesai → *Simpan & terapkan*. Pengguna melihat banner pengingat lebih dulu, lalu layar penuh pada jamnya, lalu akses normal setelah selesai atau setelah admin mematikannya.

**Menambah provider:** Provider AI → Tambah → slug unik, endpoint lengkap (mis. `https://api.x.ai/v1/chat/completions`), format `openai`, model bawaan, opsional pola key (regex). Pengguna tetap memasukkan API key sendiri (BYOK).

**Menambah bot:** Bot → Tambah → `kind=route` + `/vpn` (halaman dalam), atau `kind=link` + `https://…`.

## 7. Deploy dan batasan

- Panel dirancang untuk jaringan lokal/Docker. Untuk produksi, taruh di belakang HTTPS dan batasi akses jaringan; jangan menyebarkan `SUPABASE_SERVICE_KEY` ke layanan lain.
- Realtime memerlukan tabel `app_settings` dan `announcements` ada di publikasi `supabase_realtime` (sudah diurus SQL). Tanpa itu, aplikasi menyegarkan tiap 5 menit dan saat dibuka kembali.
- Perubahan pada `app/` tidak diperlukan; seluruh sisi aplikasi ada di lapisan web, jadi tayang tanpa rilis APK baru.
- Login admin memakai satu akun environment; belum ada multi-admin/peran. Bila dibutuhkan: tabel `admins` + hash password (usulan lanjutan).

## 8. Pengujian

Diuji dengan Supabase tiruan (PostgREST + GoTrue minimal): login/CSRF/rate-limit, CRUD bot dengan validasi slug, penolakan tulis ke tabel metadata, siklus maintenance dan sinkronisasi pengumuman, daftar/buat pengguna, dashboard, status, audit log. **Belum diuji:** terhadap Supabase asli (butuh service key pengguna), tampilan di browser, dan sisi aplikasi di WebView — jalankan checklist di bawah.

Checklist uji pengguna:
1. `docker compose up -d --build`; buka `:8095`, login.
2. Status & Setup → jalankan SQL → semua tabel "ada".
3. Tambah pengumuman → muncul di aplikasi (`:8090`) tanpa muat ulang.
4. Maintenance dengan mulai = sekarang, blokir aktif → aplikasi menampilkan layar pemeliharaan; matikan → normal. Tautan `#/p` tetap terbuka.
5. Tambah bot `route` `/vpn` → kartu tampil di tab Bot.
6. Buka tabel metadata → tidak ada kolom isi percakapan.
