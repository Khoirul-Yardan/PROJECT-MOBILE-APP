# Rencana Sampai Produksi dan Penugasan Claude Code / Codex

> **Status dokumentasi — 19 Oktober 2026:** Ini backlog, bukan klaim semua fase selesai. OpenVPN asli dan SSH sampai prompt berhasil pada 18 Oktober; admin/web Fly dan navigasi HP juga telah diuji sesuai HANDOFF. Evaluasi speech, Anamnesis lengkap, papan lintas perangkat, dan kesiapan produksi tetap perlu bukti masing-masing.

Tujuan: AI Hub stabil (bebas bug yang diketahui), teruji, dan bisa dipakai banyak orang (rilis Android + web layer di Fly). Sasaran akademik tetap: sidang PA dengan Bot BPJS sebagai inti.

Pemilik: **C** = Claude Code, **X** = Codex, **C+X** = keduanya (satu menulis, satu mereview). Aturan area dan eskalasi: `AGENTS.md` §3.

Kondisi awal yang ditemukan di kode (17 Okt 2026):
- Release APK masih ditandatangani **debug key** (`app/android/app/build.gradle.kts`, TODO signing), versi `1.0.0+1`.
- Tidak ada CI (`.github/` tidak ada); tes hanya manual: `flutter test`, `web/tests/*.py`.
- Fly `min_machines_running = 0` (cold start), relay berjalan dalam container yang sama.
- API key dipanggil dari klien (BYOK); data pasien lewat Supabase + RLS.
- Koreksi status jaringan: OpenVPN memiliki tunnel native dan berhasil diuji pada 18 Oktober; Terminal SSH berhasil sampai prompt melalui VPN. Konfigurasi SSH bukan tunnel VPN penuh. Detail/batas ada di `hasil percobaan vpn dan terminal asli.md`.
- `PRD-INTI.md` tertinggal dari kode.

---

## Fase 0 — Baseline (1 hari)

| Tugas | Pemilik | Selesai bila |
|---|---|---|
| Commit perubahan TTS yang menggantung; tag `baseline-0` | C | working tree bersih |
| Jalankan semua validasi sekarang, catat hasil awal di `docs/HANDOFF.md`: `flutter analyze`, `flutter test`, `node --check` semua JS, `ui_smoke.py`, `gemini.test.mjs` | C (app) + X (web) | daftar gagal/lulus tercatat |
| Buat `docs/DAFTAR-BUG.md` (ID, gejala, repro, area, status) dari hasil di atas + `Progres.md` + `diagram-alur.md` (status 🟡/🔴) | C+X | semua temuan punya ID |

## Fase 1 — Debugging sistematis (1–2 minggu)

Urutan prioritas bug: keamanan/privasi data > kehilangan data pasien > crash > fungsi inti Bot BPJS > fitur lain > kosmetik.

| Tugas | Pemilik | Selesai bila |
|---|---|---|
| Audit alur Bot BPJS ujung ke ujung: rekam → AssemblyAI → relabel → LLM → edit → ekspor PDF/DOCX → status sesi. Uji jaringan putus, izin mic ditolak, sesi panjang, app di-background | C | tiap kegagalan menampilkan pesan jelas dan transkrip mentah tidak hilang |
| Audit Anamnesis Terpandu + TTS/STT native (Android 10–14, beberapa merek) | C | tidak ada crash; fallback jika TTS bisu |
| Audit Papan Komunikasi: mode ruang (`komunikasi_rooms`), realtime, offline/`localStorage`, TTS native vs browser | X | event tidak hilang saat offline; realtime stabil |
| Audit SPA: router guard, sesi kedaluwarsa, riwayat chat, multi-slot key + auto-rotation, fallback Gemini | X | skenario `e2e_*.py` lulus |
| Audit bridge WebView ↔ native (semua jenis pesan, error, timeout) | C+X | kontrak payload terdokumentasi di `AGENTS.md`/HANDOFF |
| Audit RLS: uji dengan dua akun, pastikan akun B tidak bisa baca sesi/transkrip/dokumen akun A | C | uji lulus, skrip uji disimpan di `app/supabase/` |
| VPN: pastikan status jujur (FR-VPN-03); tunnel OpenVPN dari commit `424b28d` diuji di device, atau ditandai eksperimental di UI | C | tidak ada klaim "terhubung" palsu |
| Perbaiki bug dari `DAFTAR-BUG.md`, satu commit per bug, tutup ID | pemilik area | semua bug P0/P1 tertutup |

## Fase 2 — Pengujian otomatis (paralel dengan Fase 1)

| Tugas | Pemilik | Selesai bila |
|---|---|---|
| Unit test logika murni Dart: parsing draf LLM, relabel, ekspor, status sesi, kata kunci darurat | C | `flutter test` mencakup logika BPJS inti |
| Tes web: `node --test` untuk logika murni (providers/regex deteksi key, ai.js fallback, crypto roundtrip); perluas `ui_smoke.py` ke semua halaman | X | tes berjalan lokal tanpa Supabase asli |
| E2E dengan fixture (tanpa data pasien nyata, tanpa key asli): login, chat, papan komunikasi, riwayat | X | `python web/tests/*.py` hijau |
| **CI GitHub Actions**: job `flutter analyze + test`, job `node --check + tes web + ui_smoke`, jalan di tiap push/PR | X (workflow) + C (job Flutter) | badge hijau di master |
| Data uji skenario percakapan perawat-pasien (fiktif) + prosedur ukur WER/kelengkapan/factual consistency | C | siap dipakai Bab 4 PA (`PENGUJIAN-SPEECH-REALISTIS.md`) |

## Fase 3 — Keamanan, privasi, kepatuhan (sebelum pengguna luar)

| Tugas | Pemilik | Selesai bila |
|---|---|---|
| Tinjau penyimpanan key: AES-GCM + sinkron Supabase, pastikan kunci tidak muncul di log/URL/crash report | C | tidak ada kebocoran di grep dan jaringan |
| Relay Fly (`web/relay`): `RELAY_BLOCK_PRIVATE`, batas laju, tanpa log isi request | X | uji SSRF dasar lulus |
| Header keamanan nginx (CSP, HSTS, X-Content-Type-Options), batasi domain WebView ke domain sendiri | X | skor header memadai, WebView tidak memuat domain lain |
| Kebijakan privasi + persetujuan perekaman (consent) sebelum mic Bot BPJS pertama kali; teks bahwa hasil AI wajib diverifikasi tenaga kesehatan | C (teks + dialog) + X (halaman web) | muncul sekali, tersimpan, bisa dicabut |
| Data pasien: kebijakan retensi/hapus akun (hapus sesi, transkrip, dokumen); audio mentah tidak disimpan lebih lama dari perlu | C | tombol hapus data berfungsi dan teruji |
| Rotasi/lindungi kunci layanan (Supabase anon vs service, kunci AssemblyAI): pastikan tidak ada secret di APK/web yang seharusnya server-side | C+X | audit selesai, temuan ditutup |

## Fase 4 — Penyempurnaan fitur selaras PA (fleksibel)

Catat tiap penambahan di `docs/KEPUTUSAN.md`.

| Tugas | Pemilik |
|---|---|
| Perbaiki prompt `relabelSpeakers()` untuk pola perawat mengulang/konfirmasi (S2, S5) + ukur sebelum/sesudah | C |
| Deteksi kata kunci darurat tanpa menunggu LLM; penanda di Riwayat | C (logika) + X (UI) |
| Kartu Ya / Tidak / Tidak tahu di Papan Komunikasi | X |
| Aksesibilitas Papan (ukuran teks, kontras, bahasa sederhana) | X |
| Teach-back (paham / perlu diulang) | X (UI), C (kolom DB bila perlu) |
| Perbarui `PRD-INTI.md` agar memuat Papan Komunikasi, Anamnesis, AssemblyAI | C |

## Fase 5 — Kesiapan produksi

| Tugas | Pemilik | Selesai bila |
|---|---|---|
| Keystore rilis sendiri, `key.properties` (di luar git), `signingConfig` release, versi naik (`1.0.0+N`), ikon & nama final, R8/proguard diuji | C (pengguna menyimpan keystore, **jangan hilang**) | `flutter build apk --release` / `appbundle` bertanda tangan benar, dipasang & jalan di device bersih |
| Web layer produksi: `min_machines_running = 1`, volume/memori sesuai beban, health check, domain + TLS | X | tidak ada cold start; `/healthz` hijau |
| Supabase produksi: backup, batas, email auth (SMTP sendiri), kebijakan rate limit, pisahkan proyek dev/prod | C (skema) + pengguna (akun) | skema idempoten teruji di proyek bersih |
| Pemantauan: log error klien tanpa PII (mis. Sentry atau endpoint sederhana), log Fly, peringatan kuota | X | error nyata terlihat tanpa data pasien |
| Strategi versi shell vs web (shell lama jangan rusak oleh web baru): `minShellVersion` di bridge, layar "perbarui aplikasi" | C+X | web baru tetap jalan di shell lama atau memberi tahu |
| Dokumen untuk reviewer store (Play Console): jelaskan peran WebView, domain terbatas, fungsi native, kebijakan privasi, deklarasi data | C | siap diunggah |
| Uji beta tertutup: 5–20 pengguna (Play internal testing / APK langsung), formulir umpan balik, daftar perangkat | pengguna + C+X (perbaikan) | tidak ada bug P0/P1 baru selama 1 minggu |
| Rilis bertahap: internal → closed → production (Play) atau distribusi APK; rencana rollback | pengguna + C | rilis 1.0 tayang |

## Fase 6 — Pasca rilis

Triase bug mingguan lewat `DAFTAR-BUG.md`; pembaruan web lewat Fly (tanpa rilis ulang APK); pembaruan shell hanya bila bridge berubah.

---

## Definisi selesai (Definition of Done) setiap tugas

1. Kode lolos validasi area (`flutter analyze/test` atau `node --check` + tes web).
2. Ada tes baru atau langkah uji manual tertulis untuk perubahan perilaku.
3. Commit kecil dengan prefix; HANDOFF/KEPUTUSAN/DAFTAR-BUG diperbarui.
4. Perubahan lintas-area direview agen lain lewat `git diff` (read-only) sebelum merge ke `master`.

## Kriteria "siap produksi"

- Tidak ada bug P0/P1 terbuka; CI hijau; uji RLS dua-akun lulus.
- Release bertanda tangan sendiri terpasang di minimal 3 perangkat Android berbeda.
- Consent + kebijakan privasi tampil; hapus data berfungsi.
- Web layer Fly stabil 7 hari beruntun pada beta tertutup.
- Bot BPJS: alur rekam → dokumentasi → ekspor berhasil pada skenario uji fiktif; evaluasi baseline vs proposed tercatat.
- Batasan jujur terdokumentasi: OpenVPN/SSH (bila belum penuh), diarization berbasis konteks sesi, hasil AI wajib diverifikasi.
