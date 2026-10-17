# AGENTS.md — AI Hub (Proyek Akhir D3 PENS Lamongan)

Dibaca oleh **Codex CLI** dan **Claude Code** (`CLAUDE.md` mengimpor file ini). Satu sumber aturan untuk keduanya.

## 1. Proyek dalam 5 baris

- **AI Hub**: aplikasi Android hybrid. Shell Flutter tipis (`app/`) memuat satu WebView persisten yang menyajikan SPA vanilla JS (`web/public/`, nginx di Docker/Fly).
- Native hanya untuk yang butuh OS: mikrofon/STT (Bot BPJS, Anamnesis Terpandu), TTS native, VPN, secure storage.
- Backend tunggal: Supabase (Auth, Postgres + RLS, Realtime). Tidak ada server AI perantara; API key milik pengguna (BYOK, AES-GCM).
- Inti akademik: **otomatisasi dokumentasi percakapan perawat-pasien** (STT + diarization + LLM) sebagai **pendukung verifikasi diagnosis oleh dokter**.
- Acuan fitur yang berlaku: `PRD/PRD-INTI.md` (sebagian sudah tertinggal; kode adalah kebenaran akhir). Konteks akademik: `PRD/PRD-Dokumentasi-Percakapan-Perawat-Pasien.md`.

## 2. PAGAR AKADEMIK (berlaku untuk kedua agen)

**Fleksibel by design:** proyek berkembang mengikuti dokumentasi dan kejelasan kebutuhan, jadi fungsi baru **boleh** ditambah selama punya dasar (dokumen/PRD/sumber ilmiah/temuan uji) dan tidak melanggar *garis keras* di bawah. Setiap fungsi baru atau fungsi yang diubah arahnya dicatat satu entri di `docs/KEPUTUSAN.md` (apa, kenapa, dasar, dampak ke PA). Tidak perlu izin sebelumnya untuk hal di luar garis keras; kerjakan lalu catat.

**Garis keras** (butir 1, 2, 3, 5) hanya boleh digeser dengan persetujuan pengguna, dan butir 1 perlu persetujuan pembimbing. Butir lain adalah default yang boleh diubah lewat `KEPUTUSAN.md`.

Judul PA resmi (disetujui pembimbing 17 September 2026): *Pengembangan Aplikasi Mobile untuk Otomatisasi Dokumentasi **Percakapan Perawat-Pasien** sebagai Pendukung Verifikasi Diagnosis Pasien Menggunakan Speech-to-Text dan Large Language Model.*

1. **Objek yang direkam hanya percakapan perawat-pasien.** Jangan membuat alur yang merekam/mentranskripsi ucapan dokter (dikte dokter, balasan suara dokter, dll.). Dokter = penerima dan peninjau dokumentasi. Mau eksplorasi sisi dokter? Tulis usulan di `docs/HANDOFF.md` untuk dibawa ke pembimbing; jangan dikerjakan.
2. **LLM tidak menetapkan diagnosis.** Hanya ekstraksi, ringkasan, struktur, cek kelengkapan. Jangan menambah kolom "diagnosis"/"saran obat" yang diisi AI. Angka nyeri dsb. adalah laporan pasien, bukan keputusan klinis.
3. **Transkrip asli harus tetap terlihat/tersimpan** berdampingan dengan hasil LLM (auditabilitas, NFR-06). Perawat harus bisa mengedit sebelum dibagikan.
4. **Peran pembicara ditentukan dari konteks sesi**, bukan voice-print/biometrik.
5. **Privasi:** data pasien hanya terbaca pemilik sesi (RLS per `user_id`/`perawat_id`). Jangan melonggarkan RLS, jangan log isi transkrip ke console/analytics, jangan commit data pasien nyata. Semua contoh/skenario fiktif.
6. **Evaluasi PA** = eksperimen komparatif baseline (STT saja) vs proposed (STT + LLM): WER, kelengkapan, kesesuaian isi, factual consistency, waktu proses. Perubahan pada pipeline Bot BPJS (prompt, model STT, relabel) harus tetap bisa diukur dengan metrik ini; catat perubahan di `docs/PENGUJIAN-SPEECH-REALISTIS.md`.
7. **Fitur dihapus sengaja, jangan dihidupkan lagi tanpa diminta:** Friend System, wake word "Halo Jarvis", balasan suara di Bot BPJS, review-dokter-berbasis-akun.
8. Catatan jujur di laporan: "perawat" di Anamnesis Terpandu adalah pertanyaan terstandar via TTS, bukan rekaman perawat (lihat `docs/SPEECH-PERAWAT-DOKTER-DAN-KESELARASAN-JUDUL.md` §4).

Pemetaan jenis komunikasi (dokumen speech di Drive) ke sistem: `docs/PEMETAAN-SPEECH-KE-SISTEM.md`.

## 3. Pembagian tugas Claude Code vs Codex

Prinsip: **satu direktori = satu pemilik**. Beda pemilik tidak mengedit file yang sama. Perlu perubahan di area pemilik lain → tulis di `docs/HANDOFF.md`, jangan edit langsung.

| Area | Pemilik | Alasan |
|---|---|---|
| `app/lib/**`, `app/test/**`, `app/android/**`, `app/pubspec.yaml` (Flutter/Dart native) | **Claude Code** | Native bridge, STT/mic, WireGuard/OpenVPN: debugging lintas-lapisan |
| `app/lib/services/bpjs_service.dart`, `assemblyai_service.dart` (prompt LLM, `relabelSpeakers`, pipeline STT) | **Claude Code** | Menyentuh validitas evaluasi PA; butuh penalaran hati-hati |
| `app/supabase/schema.sql` (skema, RLS) | **Claude Code** | Keamanan data pasien; migrasi idempoten |
| `PRD/**`, `docs/**` (dokumen akademik, keselarasan judul, review pagar §2) | **Claude Code** | Jaga konsistensi dengan PA |
| `web/public/views/**`, `web/public/*.js`, `style.css`, `index.html` (UI SPA) | **Codex** | Pekerjaan UI berulang: halaman, komponen, ikon, teks |
| `web/tests/**` (Playwright/e2e, smoke) | **Codex** | Menulis & menjalankan tes UI |
| `web/Dockerfile`, `docker-compose.yml`, `nginx.conf.template`, `fly.toml`, `web/relay/**` | **Codex** | Deploy web layer |
| `docs/HANDOFF.md` | **keduanya** (append-only) | Serah terima |

Kontrak lintas-area yang harus dijaga bersama (ubah satu sisi = beri tahu pemilik sisi lain lewat HANDOFF):
- **NativeBridge** (`app/lib/screens/web_shell_screen.dart` ↔ `web/public/bridge.js`): nama pesan & bentuk payload.
- **Tabel Supabase** yang dipakai web (`komunikasi_events`, `komunikasi_rooms`, `chat_messages`, `api_credentials`) ↔ `schema.sql`.

### Protokol buntu (eskalasi)

1. **Claude buntu** (tidak paham masalah, 2 percobaan gagal, atau butuh keahlian area web/deploy/tes UI) → tulis tiket di `docs/HANDOFF.md` dengan status `dilempar ke Codex`: gejala, yang sudah dicoba, file terkait, perintah repro. Lalu lanjut tugas lain; jangan menebak-nebak.
2. **Codex buntu** → sama, ke `docs/HANDOFF.md` dengan status `dilempar ke Claude` (area Dart/native/skema/prompt/akademik).
3. **Keduanya buntu** (tiket dilempar balik, atau akar masalah lintas-area) → buka diskusi di `docs/DISKUSI.md`: satu bagian per masalah, format *Masalah → Fakta/bukti → Hipotesis Claude → Hipotesis Codex → Percobaan yang disepakati → Hasil*. Gantian menambah jawaban (append-only), tiap giliran harus menyertakan bukti baru (log, repro, diff), bukan opini. Setelah 3 giliran tanpa kemajuan → status `butuh pengguna`, ringkas pilihan + rekomendasi dalam 5 baris supaya pengguna bisa memutuskan cepat.
4. Setelah selesai, tandai tiket `selesai` dan catat akar masalah (satu baris) supaya tidak terulang.

Pemilik area boleh **ditukar sementara** untuk satu tugas bila lebih efisien; tulis di HANDOFF `pinjam area <path> untuk <tugas>`, kembalikan setelah commit.

### Pola kerja bersamaan
- Jangan jalankan dua agen di working tree yang sama pada saat yang sama kalau area berbeda tidak dijamin terpisah. Aman: worktree terpisah, `git worktree add ../mobile-app-codex -b codex/<topik>`; gabung lewat merge.
- Commit kecil per tugas sebelum ganti agen. Prefix commit: `feat(web):`, `fix(app):`, `docs:` dst. (ikuti `git log`).
- Jangan jalankan `flutter build`/`docker compose build`/`npm install` dari dua agen bersamaan.
- Pola paling aman: satu agen menulis, agen lain **mereview `git diff`** (read-only).

## 4. Perintah penting

```sh
# Web layer (wajib; dimuat WebView)
cd web && docker compose up -d --build        # http://localhost:8090
adb reverse tcp:8090 tcp:8090                  # device fisik via USB

# Validasi sebelum commit
cd app && flutter analyze --no-pub && flutter test --no-pub
cd web/public && node --check <file>.js
python web/tests/ui_smoke.py                   # butuh Playwright + Chrome; fixture, tidak menyentuh Supabase
```

Release APK default ke web layer di Fly (lihat commit `cc97e54`); perubahan `web/` tayang tanpa rilis ulang APK, perubahan `app/` butuh build APK baru.

## 5. Konvensi kode

- Cocokkan gaya file sekitar: komentar menjelaskan *kenapa* (lihat `papan-komunikasi.js`), bukan *apa*. Bahasa UI & dokumen: Indonesia.
- Web: vanilla JS ES modules, tanpa framework/bundler; satu file per halaman di `views/`. Jangan menambah dependensi tanpa alasan kuat.
- Dart: ikuti `analysis_options.yaml`; logika murni diuji di `app/test/bpjs_logic_test.dart`.
- Jangan commit: `.env`, API key, profil VPN asli (`TEST VPN/*.ovpn`), `app/build/`, `docs/.work-speech/lib/` (pustaka lokal).
- `app/README.md` dan `web/README.md` sebagian usang; jangan dijadikan acuan.
- Tindakan keluar/sulit dibalik (push, deploy Fly, drop tabel, ubah RLS) → konfirmasi pengguna dulu.

## 6. Rencana sampai produksi

Jalur lengkap, fase, penugasan per agen, dan kriteria selesai: **`docs/RENCANA-PRODUKSI-DAN-PENUGASAN.md`**. Cara menjalankan kedua CLI bersamaan: **`docs/PANDUAN-DUA-CLI.md`**. Backlog fitur selaras PA (kartu Ya/Tidak, teach-back, kata kunci darurat, perbaikan relabel) ada di Fase 4 rencana tersebut. Jenis komunikasi di luar scope (suara dokter, eye-tracking, dikte satu arah sebelum disetujui pembimbing) tetap tidak dikerjakan.
