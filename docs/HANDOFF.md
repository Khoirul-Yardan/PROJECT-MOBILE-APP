# HANDOFF — serah terima Claude Code ↔ Codex

Append-only: tambahkan entri di paling atas. Tulis hanya hal yang perlu dilakukan pemilik area lain atau kontrak yang berubah.

Format:
```
## YYYY-MM-DD — <agen> → <agen tujuan>
- Apa yang berubah / diminta:
- File terkait:
- Status: menunggu | selesai
```

## 2026-10-18 — Claude → Codex
- VPN asli tersambung di HP setelah perbaikan cipher (`data-ciphers` di `vpn_tunnel_service.dart`); Terminal SSH lewat VPN berhasil. Detail: `docs/hasil percobaan vpn dan terminal asli.md`.
- Atas permintaan pengguna saya mengedit `web/public/views/vpn-config.js` (area Codex): tombol Tampilkan/Sembunyikan di kolom password. Tolong tinjau dan tambahkan tes UI bila perlu.
- Menunggu: perbaiki teks galat "Server menolak login" (menyesatkan); putuskan apakah log `OvpnEngine` di `VpnStatus.java` dipertahankan; uji jaringan seluler.
- Status: menunggu

## 2026-10-17 (larut) — Claude
- Audit Bot BPJS (baca kode): A-001 dan A-002 diperbaiki, A-009 komentar; A-003..A-007 terbuka di `docs/DAFTAR-BUG.md`. `flutter test` 9 lulus; `flutter analyze` hanya 5 info lama.
- Perlu uji di perangkat: gagalkan jaringan saat proses, pastikan tombol "Proses ulang rekaman" muncul dan berhasil.
- Status: menunggu

## 2026-10-17 (malam) — Claude
- Mode kerja diganti: satu folder, bergantian (lihat AGENTS.md §3). Worktree dihapus; hasil parsial Codex (bridge.js + tes) hilang bersama folder worktree, perlu dikerjakan ulang.
- Selesai: preflight OpenVPN (K-001), prompt relabel (K-002), skrip diagnosa `TEST VPN/diagnosa-laptop.ps1`, `tool/codex-bantu.ps1` (diuji: Codex menjawab). `flutter test` 8 lulus.
- Menunggu pengguna: jalankan diagnosa VPN di laptop dan tempel hasil; putuskan sisi verifikasi dokter (PEMETAAN §B).
- Status: menunggu

## 2026-10-17 — Claude → Codex
- Setup awal pembagian tugas (lihat `AGENTS.md` §3) dan rencana produksi `docs/RENCANA-PRODUKSI-DAN-PENUGASAN.md`. Mulai dari Fase 0 (baseline). Tugas Codex: audit web (Fase 1), tes web + CI (Fase 2), header/relay (Fase 3), web produksi + monitoring (Fase 5), lalu fitur UI Fase 4 (kartu Ya/Tidak, aksesibilitas Papan).
- Ada perubahan belum di-commit di `papan-komunikasi.js` dan `web_shell_screen.dart` (kecepatan TTS). Commit dulu sebelum mulai.
- Status: menunggu
