@AGENTS.md

# Khusus Claude Code

- Peran di proyek ini (lihat tabel §3 AGENTS.md): pemilik `app/` (Dart native), pipeline STT/LLM Bot BPJS, `schema.sql`, `PRD/`, `docs/`, plus **review pagar akademik** (§2) atas pekerjaan Codex.
- Jangan mengedit `web/public/**` atau `web/tests/**` kecuali pengguna meminta eksplisit; tulis kebutuhan di `docs/HANDOFF.md`.
- Sebelum mengubah prompt/pipeline Bot BPJS, baca `docs/PENGUJIAN-SPEECH-REALISTIS.md` dan pastikan metrik evaluasi PA tetap bisa dibandingkan.
- Awal sesi: baca `docs/HANDOFF.md` untuk catatan terbaru dari Codex.
