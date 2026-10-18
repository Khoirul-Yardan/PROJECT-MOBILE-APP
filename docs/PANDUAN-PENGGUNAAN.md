# Panduan Pemakaian AI Hub — dari nol sampai jalan

> **Status dokumentasi — 19 Oktober 2026:** Panduan diperbarui untuk tiga modul Bot Hub dan admin sederhana. Keberadaan langkah penggunaan tidak berarti semua skenario telah diuji pada perangkat; batas pembuktian ada di [Progres.md](Progres.md).

Untuk siapa pun di tim yang baru pertama kali memakai sistem ini. Urutannya:
**(1) jalankan server → (2) ambil API key yang dibutuhkan → (3) sambungkan di
aplikasi → (4) pakai fitur (Chat, Bot BPJS, Papan Komunikasi, Anamnesis, VPN/Terminal).**

Dokumen rinci per topik:
[HERMES-API-SETUP.md](HERMES-API-SETUP.md) ·
[ASSEMBLYAI-DIARIZATION.md](ASSEMBLYAI-DIARIZATION.md) ·
[VPN-TEST-DOCKER.md](VPN-TEST-DOCKER.md) ·
[BOT-BPJS-PERBANDINGAN.md](BOT-BPJS-PERBANDINGAN.md)

---

## 1. Jalankan server (sekali, oleh pengelola)

```sh
cd web
copy .env.example .env      # lalu isi ASSEMBLYAI_API_KEY (lihat bagian 2.2)
docker compose up -d --build
```

Web layer tampil di **http://localhost:8090**. Relay (jembatan ke Hermes dan
AssemblyAI) ikut jalan otomatis. Cek: `docker compose logs relay` harus
memuat `listening on :8091`.

Database (Supabase): jalankan isi `app/supabase/schema.sql` di
**Supabase → SQL Editor** (aman diulang). Wajib setiap ada versi baru, karena
berisi kolom `perbandingan` dan izin hapus transkrip yang dipakai Bot BPJS.

## 2. Mengambil API key

Semua key **dimasukkan lewat aplikasi** (Pengaturan → API & Agent → Tambah) dan
tersimpan terenkripsi di akun masing-masing. Jangan kirim key lewat chat/git.

| Layanan | Dipakai untuk | Ambil di | Bentuk key |
|---|---|---|---|
| **Hermes Agent (API Server)** | Chat + ringkasan Bot BPJS dengan akses penuh | komputer sendiri (bagian 2.1) | token buatan sendiri |
| Hermes (Nous Portal) | Model Hermes hosted | portal.nousresearch.com → API keys | `sk-nous-...` |
| ChatGPT | Chat / ringkasan | platform.openai.com/api-keys | `sk-...` |
| Claude | Chat / ringkasan | console.anthropic.com → API keys | `sk-ant-...` |
| Gemini | Chat / ringkasan | aistudio.google.com/apikey | `AIza...` |
| OpenRouter | Banyak model, satu key | openrouter.ai/keys | `sk-or-v1-...` |
| **AssemblyAI** | Memisahkan suara perawat/pasien (Bot BPJS) | assemblyai.com → Dashboard → API key | 32 karakter hex |

Aplikasi mengenali jenis key otomatis dari bentuknya — cukup tempel.

### 2.1 Hermes API Server (langkah ringkas)

Rincian dan troubleshooting ada di [HERMES-API-SETUP.md](HERMES-API-SETUP.md).

1. Buat token acak (PowerShell):
   `-join ((48..57)+(97..102) | Get-Random -Count 48 | % {[char]$_})`
   atau di Linux/Mac: `openssl rand -hex 32`.
2. Di `~/.hermes/.env` (Windows: `%USERPROFILE%\.hermes\.env`) tambahkan:
   ```
   API_SERVER_ENABLED=true
   API_SERVER_KEY=<token tadi>
   ```
3. `hermes gateway restart`
4. Tes: `curl -H "Authorization: Bearer <token>" http://localhost:8642/v1/models`
   → harus keluar daftar model.
5. Di aplikasi: Pengaturan → API & Agent → **Hermes Agent (API Server)** →
   URL `http://<IP-komputer-Hermes>:8642/v1/chat/completions`, Token = token tadi.

Pilih **API Server**, bukan *A2A*: A2A sengaja disandbox oleh Hermes dan
menolak aksi sensitif. Bot BPJS juga hanya memakai provider bergaya OpenAI —
**A2A dan OpenClaw dilewati** saat memilih AI untuk ringkasan.

### 2.2 Satu key AssemblyAI untuk semua perangkat

Taruh di `web/.env` (`ASSEMBLYAI_API_KEY=...`) lalu `docker compose up -d --build`.
Perawat tidak perlu mengisi apa pun. Jika kosong, app meminta key pribadi
sekali per perangkat.

## 3. Pakai fitur

### Chat
Buka Chat → pilih provider dari tab → kirim pesan. Ikon layers di atas =
pilih model dari daftar live provider itu.

### Bot BPJS (rekam → dua hasil)
1. Bot Hub → **Bot BPJS** → tekan mic → isi nama pasien & dokter tujuan.
2. Rekam percakapan perawat–pasien (satu HP, taruh di antara keduanya),
   tekan **Hentikan Sesi**.
3. Tunggu proses (AssemblyAI → pemisahan suara → AI menyusun ringkasan).
4. Layar hasil punya tiga tab:
   - **Hasil STT** — transkrip mentah per pembicara. Jika perannya terbalik,
     tekan *Tukar peran perawat ↔ pasien*.
   - **Ringkasan AI** — draf terstruktur dari LLM, bisa diedit.
   - **Banding** — jumlah kata, waktu proses, rasio ringkas, jumlah
     pembicara terdeteksi (bahan tugas akhir).
5. Salin teks atau ekspor PDF/DOCX — kedua hasil + tabel perbandingan ikut.
6. Dokumentasi & Riwayat (dari Bot Hub) menampilkan kedua hasil tersebut kembali.

Syarat agar ringkasan AI muncul: minimal satu provider **OpenAI-style**
(Hermes API Server, ChatGPT, Claude, Gemini, OpenRouter, Hermes Portal)
sudah tersambung. Tanpa itu, hasil ke-2 berisi transkrip mentah + catatan.

### Papan Komunikasi
Bot Hub → Papan Komunikasi. Gunakan kode/label tempat tidur, pilih ikon, lalu periksa tab Catatan. Nyeri memiliki pilihan lokasi dan skala 0–10 sebagai laporan pasien. Tab Ruangan dapat membuat tautan untuk pasien/keluarga; nonaktifkan bila tidak dipakai. Tautan tidak memberikan akses bebas ke isi riwayat. TTS perlu diperiksa pada perangkat yang digunakan; pilihan “Minta obat” bukan resep dan tombol panggil bukan pengganti sistem panggil perawat resmi.

### Anamnesis Terpandu
Buka dari aplikasi Android. Sistem membacakan tujuh pertanyaan, pasien menjawab, lalu perawat memeriksa/koreksi teks sebelum membuat draf. Simpan dan periksa kemunculannya di Dokumentasi & Riwayat. Pertanyaan adalah TTS sistem, bukan suara perawat yang direkam. Implementasi tersedia, tetapi gambar Progres 2 belum membuktikan sesi lengkap berhasil.

### Dokumentasi & Riwayat
Gunakan pencarian dan filter Semua/Bot BPJS/Anamnesis/Papan. Tinjau transkrip sumber bersama draf sebelum ekspor atau berbagi. Verifikasi dokter dilakukan di luar aplikasi. Gunakan contoh fiktif untuk latihan.

### VPN
Pengaturan VPN → pilih OpenVPN → tekan **Pilih file .ovpn…** (atau tempel isinya). Aplikasi membaca file dan memberi tahu server tujuan, apakah butuh login, dan apakah private key terenkripsi. Lalu isi username/password
(dan "Password private key" bila key di file terenkripsi) → Sambungkan.
Untuk latihan tanpa server asli: [VPN-TEST-DOCKER.md](VPN-TEST-DOCKER.md).

### Terminal dan admin
Untuk server SSH di balik VPN, sambungkan VPN terlebih dahulu lalu buka Terminal. Uji asli 18 Oktober baru membuktikan login sampai prompt; `force-stop` aplikasi memutus VPN. Pesan “Server menolak login” pada percobaan lama ternyata berkaitan dengan negosiasi cipher, sehingga bukan bukti pasti password salah.

Panel admin terpisah; lihat [PANEL-ADMIN.md](PANEL-ADMIN.md). Cakupan saat ini akun umum, metadata, maintenance/pengumuman, audit/status; tidak ada katalog bot/provider atau pilihan peran.

## 4. Masalah umum

| Gejala | Penyebab / solusi |
|---|---|
| Ringkasan AI berisi "AI tidak merespons" | Provider terpilih tak terjangkau/timeout 90 dtk. Tes `curl .../v1/models` ke Hermes; pastikan ponsel satu jaringan dengan komputer Hermes |
| Semua kalimat berlabel Perawat | Dulu terjadi bila AssemblyAI menganggap 1 suara. Sekarang `speakers_expected=2` + koreksi AI otomatis; sisanya pakai tombol *Tukar peran* |
| Dialog "Kunci API AssemblyAI" muncul | `ASSEMBLYAI_API_KEY` di `web/.env` belum terbaca relay |
| Riwayat tidak menampilkan perbandingan | Jalankan ulang `schema.sql` (kolom `perbandingan`) |
