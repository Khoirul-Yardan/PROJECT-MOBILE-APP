# Panduan Memakai Claude Code dan Codex Bergantian (satu terminal)

Aturan di `AGENTS.md` §3; rencana di `docs/RENCANA-PRODUKSI-DAN-PENUGASAN.md`.

## Prinsip
Satu folder, satu terminal, satu agen aktif pada satu waktu. Claude Code memimpin; Codex dipanggil dari terminal yang sama bila Claude buntu. Tidak perlu worktree.

## Setup sekali
1. Pastikan `codex --version` berjalan di terminal Anda (sudah terpasang: codex-cli 0.162.1).
2. Jalankan Claude Code dari `D:\DOKUMEN\PROJECT MOBILE APP`.
3. Gabungkan branch dokumen ke master bila sudah puas: `git checkout master; git merge setup/dua-cli`.

## Alur
1. Beri tugas ke Claude (mis. "kerjakan Fase 1 audit Bot BPJS").
2. Claude mencoba. Bila buntu, Claude menjalankan:
   `powershell -File tool\codex-bantu.ps1 -Tiket "gejala; sudah dicoba; file; repro"`
   dan menulis tiket + jawaban di `docs/HANDOFF.md`.
3. Bila Codex juga belum bisa: Claude menulis ke `docs/DISKUSI.md`, memanggil Codex dengan isi DISKUSI.md, menjalankan percobaan yang disepakati. Maksimal 3 giliran, lalu ringkasan 5 baris untuk Anda.
4. Anda bisa memanggil Codex sendiri kapan saja dengan perintah yang sama, atau membuka `codex` interaktif untuk tugas area `web/`.

## Yang hanya bisa Anda uji
VPN asli (OpenVPN di laptop ini + Termius) tidak bisa dijalankan dari terminal agen. Jalankan:
`powershell -ExecutionPolicy Bypass -File ".\TEST VPN\diagnosa-laptop.ps1" -SshHost <IP server SSH>`
(sebelum dan sesudah OpenVPN tersambung), lalu tempel hasilnya ke Claude. Jangan menempel isi file `.ovpn`.

## Kebiasaan
Commit kecil per tugas; jangan push/deploy tanpa persetujuan Anda; rahasia tidak masuk git atau dokumen.
