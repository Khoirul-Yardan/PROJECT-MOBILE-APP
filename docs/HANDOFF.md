# HANDOFF — serah terima Claude Code ↔ Codex

Append-only: tambahkan entri di paling atas. Tulis hanya hal yang perlu dilakukan pemilik area lain atau kontrak yang berubah.

Format:
```
## YYYY-MM-DD — <agen> → <agen tujuan>
- Apa yang berubah / diminta:
- File terkait:
- Status: menunggu | selesai
```

## 2026-10-17 — Claude → Codex
- Setup awal pembagian tugas (lihat `AGENTS.md` §3) dan rencana produksi `docs/RENCANA-PRODUKSI-DAN-PENUGASAN.md`. Mulai dari Fase 0 (baseline). Tugas Codex: audit web (Fase 1), tes web + CI (Fase 2), header/relay (Fase 3), web produksi + monitoring (Fase 5), lalu fitur UI Fase 4 (kartu Ya/Tidak, aksesibilitas Papan).
- Ada perubahan belum di-commit di `papan-komunikasi.js` dan `web_shell_screen.dart` (kecepatan TTS). Commit dulu sebelum mulai.
- Status: menunggu
