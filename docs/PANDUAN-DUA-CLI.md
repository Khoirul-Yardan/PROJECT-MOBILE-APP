# Panduan Memakai Claude Code dan Codex Bersamaan

Aturan kerja ada di `AGENTS.md`; rencana tugas di `docs/RENCANA-PRODUKSI-DAN-PENUGASAN.md`. Dokumen ini langkah praktisnya.

## A. Setup sekali (±10 menit)

1. Pasang Codex CLI dan login (`codex`), Claude Code sudah ada. Pastikan keduanya dijalankan dari folder proyek, bukan dari subfolder.
2. Bersihkan working tree: `git status`, lalu commit perubahan yang menggantung (`papan-komunikasi.js`, `web_shell_screen.dart`) dan dokumen baru (`AGENTS.md`, `CLAUDE.md`, `docs/*`).
3. Buat dua worktree supaya agen tidak saling menimpa file:
   ```sh
   cd "D:/DOKUMEN/PROJECT MOBILE APP"
   git worktree add ../mobile-claude -b claude/kerja
   git worktree add ../mobile-codex  -b codex/kerja
   ```
   Claude Code dijalankan di `../mobile-claude`, Codex di `../mobile-codex`. Folder asli `master` hanya untuk Anda menggabungkan.
   Catatan Windows: `.env` dan file yang di-gitignore tidak ikut worktree; salin manual bila perlu (`.env`, `app/android/local.properties`). Jalankan `flutter pub get` di worktree Claude.
4. Cek keduanya membaca aturan: tanya "ringkas aturan proyek ini". Claude membaca `CLAUDE.md` (yang mengimpor `AGENTS.md`), Codex membaca `AGENTS.md`.

## B. Alur harian

1. **Pagi:** `git checkout master && git pull` lalu di tiap worktree `git merge master` agar sama-sama mutakhir. Minta tiap agen: "baca `docs/HANDOFF.md`, `docs/DAFTAR-BUG.md`, lalu kerjakan tugas Fase N yang jadi milik Anda".
2. **Beri tugas sesuai tabel pemilik.** Contoh:
   - Claude: "Kerjakan Fase 1 audit Bot BPJS ujung ke ujung dan perbaiki bug yang ditemukan."
   - Codex: "Kerjakan Fase 2: tes web dan workflow CI GitHub Actions."
3. **Selama bekerja:** masing-masing commit kecil di branch sendiri. Jika agen butuh perubahan di area lain, dia menulis di `docs/HANDOFF.md` (bukan mengedit).
4. **Review silang sebelum merge:** di worktree lain minta "review `git diff master..claude/kerja` terhadap pagar akademik `AGENTS.md` §2 dan Definition of Done; jangan edit". Perbaiki temuan, lalu merge ke `master`:
   ```sh
   git checkout master && git merge --no-ff claude/kerja
   ```
   Konflik hampir tidak terjadi karena direktori berbeda; jika terjadi di `docs/HANDOFF.md` gabungkan kedua entri.
5. **Sore:** minta tiap agen memperbarui `HANDOFF.md` (selesai/menunggu/buntu) dan `DAFTAR-BUG.md`.

## C. Saat salah satu buntu

- Anda tidak perlu menengahi. Agen yang buntu menulis tiket di `HANDOFF.md` (`dilempar ke ...`). Anda cukup memberi agen lain perintah: "ambil tiket di HANDOFF yang dilempar ke Anda".
- Jika dilempar balik atau lintas area: perintahkan keduanya membaca `docs/DISKUSI.md` bergantian, dengan kalimat tetap: "baca bagian terbaru di DISKUSI.md, tambahkan analisis dan percobaan Anda dengan bukti". Maksimal 3 giliran; setelah itu agen menandai `butuh pengguna` dengan ringkasan 5 baris untuk Anda putuskan.

## D. Kebiasaan yang mencegah masalah

- Satu tugas, satu branch, satu agen pada satu waktu untuk file yang sama.
- Jangan menjalankan `flutter build`, `docker compose build`, atau `npm install` bersamaan di dua worktree yang berbagi port 8090; ubah port di worktree kedua bila keduanya menjalankan web.
- Jangan biarkan agen push, deploy Fly, atau mengubah RLS tanpa Anda setujui.
- Rahasia (`.env`, keystore, key API) tidak pernah masuk git dan tidak ditempel ke HANDOFF/DISKUSI.
- Setiap akhir fase: tag git (`fase-1-selesai`) agar mudah kembali.

## E. Kalau lebih suka sederhana (tanpa worktree)

Satu folder, bergantian: Claude selesai → commit → baru Codex. Jangan jalankan keduanya mengedit sekaligus. Cocok untuk perbaikan kecil.
