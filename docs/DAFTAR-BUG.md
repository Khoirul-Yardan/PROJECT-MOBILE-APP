# Daftar Bug dan Temuan

> **Status dokumentasi — 19 Oktober 2026:** Daftar audit bertanggal tetap dipertahankan; jangan menganggap seluruh temuan sudah selesai. Hasil VPN asli 18 Oktober dan validasi admin/Fly ada di [Progres.md](Progres.md) serta [HANDOFF.md](HANDOFF.md). Penulisan laporan tidak mengubah status bug tanpa bukti uji.

Prioritas: P0 data pasien bocor/hilang tanpa jejak, P1 fungsi inti rusak/data hilang, P2 degradasi nyata, P3 kosmetik. Semua temuan di bawah berasal dari **pembacaan kode** (17 Okt 2026); belum ada yang direproduksi di perangkat fisik kecuali dinyatakan.

## App / Backend

| ID | Pri | Area | Gejala / risiko | Status |
|---|---|---|---|---|
| A-001 | P1 | Bot BPJS | Rekaman audio dihapus walau STT gagal (jaringan putus) sehingga seluruh wawancara hilang | **Diperbaiki** (audio disimpan sementara sampai STT sukses, tombol "Proses ulang rekaman", dibersihkan saat reset/sesi baru/>24 jam). Belum diuji di perangkat |
| A-002 | P2 | AssemblyAI | Respons 401/403/404 saat polling diulang sampai 5 menit; pengguna menunggu tanpa pesan | **Diperbaiki** (`isFatalPollStatus`, ada tes) |
| A-003 | P1 | Bot BPJS | `createSession` dipanggil setelah STT; bila gagal (Supabase/jaringan), hasil STT yang sudah ada dibuang dan pengguna harus merekam ulang | Terbuka. Usul: lanjutkan ke review dengan sesi lokal, simpan ke DB belakangan |
| A-004 | P2 | Bot BPJS | Hasil `replaceTranscript`/`saveDocumentation`/`markStatus` diabaikan; status `siap_dikirim`/`terkirim` bisa tercatat salah, data tidak tersimpan tanpa peringatan | Terbuka. Usul: tampilkan peringatan "belum tersimpan" |
| A-005 | P1 | Privasi | Audio pasien dikirim ke AssemblyAI lewat relay Fly (kunci bersama); belum ada persetujuan (consent) sebelum merekam | Terbuka (Fase 3) |
| A-006 | P2 | Bot BPJS | Nilai non-teks dari LLM (list/objek) tampil sebagai teks Dart mentah di field draf | Terbuka |
| A-007 | P2 | Bot BPJS | Ekspor PDF memakai font bawaan paket `pdf`; karakter non-Latin/tanda baca khusus mungkin tidak tampil | Belum diuji |
| A-008 | P2 | VPN | Tes asli hanya berhasil di laptop (OpenVPN + Termius); penyebab di perangkat belum diketahui | Alat diagnosa siap (`TEST VPN/diagnosa-laptop.ps1`, preflight TCP di app); menunggu hasil pengguna |
| A-009 | P3 | Dokumentasi | Komentar `BpjsSessionRepo` masih menyebut "friend" | **Diperbaiki** |
| A-010 | P1 | Keamanan rilis | APK rilis ditandatangani debug key, versi 1.0.0+1 | Terbuka (Fase 5) |

## Web

Audit kode web belum dilakukan (dihentikan sebelum selesai); yang ada hanya hasil pengujian Docker minggu ini (`docs/pengujian-minggu-ini/`).

| ID | Pri | Area | Temuan | Status |
|---|---|---|---|---|
| W-001 | P2 | Tes | Fixture dan asersi tes web tertinggal dari kode (gemini, ui_smoke, model_smoke, e2e_vpn_bpjs); 4 dari 7 tes gagal tanpa ada bug aplikasi | **Diperbaiki** (semua lulus). Akar masalah: tidak ada CI; lihat Fase 2 |
| W-002 | P3 | Tes | Belum ada uji ketuk/TTS/realtime untuk Papan Komunikasi; `e2e_docker.py` butuh kunci OpenAI asli | Terbuka |
| W-003 | P2 | Privasi data | Kebijakan RLS `profiles` mengizinkan semua pengguna login membaca profil semua orang (sisa Friend System) | Terbuka; perlu persetujuan sebelum diubah |
| W-004 | P3 | Operasional | `web/.env` berisi kunci AssemblyAI; request apa pun ke `/relay/assemblyai/*` di Docker lokal memakai kunci itu | Dicatat |
