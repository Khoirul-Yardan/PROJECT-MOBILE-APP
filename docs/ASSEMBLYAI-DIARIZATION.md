# Diarization Bot BPJS tanpa minta kunci API ke setiap user

Dulu, sesi pertama Bot BPJS di setiap perangkat selalu berhenti sebentar
untuk minta kunci API AssemblyAI (dipakai untuk memisahkan suara perawat
dan pasien — lihat `app/lib/services/assemblyai_service.dart` untuk alasan
kenapa ini tidak bisa dilakukan on-device). Sekarang ada jalur kedua: **satu
kunci bersama**, diset sekali oleh pengelola server, dan setiap perangkat
langsung bisa pakai Bot BPJS tanpa setup apa pun.

## Cara kerjanya

```
App (Flutter)  --POST audio-->  web/relay  --pakai ASSEMBLYAI_API_KEY-->  AssemblyAI
```

`web/relay/server.js` sekarang punya tiga route tambahan
(`/assemblyai/upload`, `/assemblyai/transcript`,
`/assemblyai/transcript/:id`) yang meneruskan permintaan ke AssemblyAI
sambil menempelkan kunci dari environment variable `ASSEMBLYAI_API_KEY` —
kunci ini **tidak pernah** dikirim ke aplikasi/perangkat, hanya hidup di
server relay.

Di sisi Flutter, `AssemblyAiService.transcribeWithDiarization` sekarang
mencoba jalur relay ini dulu (lewat `WebHubConfig.baseUrl`, URL yang sama
dipakai WebView untuk memuat UI). Kalau relay belum diset kuncinya (server
balas 503), baru aplikasi jatuh ke perilaku lama: minta kunci pribadi dari
nurse dan menyimpannya di Keystore/Keychain perangkat itu saja. Jadi
**tidak ada yang rusak** kalau kamu belum sempat setel kunci bersama — cuma
belum mendapat manfaat "langsung pakai" saja.

## Setup (sekali, oleh pengelola server)

1. Daftar/pakai akun AssemblyAI (ada tier gratis, lihat assemblyai.com) dan
   ambil API key dari dashboard.
2. Di folder `web/`, buat file `.env` (sejajar dengan `docker-compose.yml`,
   kalau belum ada):
   ```
   ASSEMBLYAI_API_KEY=isi-dengan-key-asli-di-sini
   ```
   Docker Compose otomatis membaca `.env` di folder yang sama.
3. Build ulang & jalankan:
   ```sh
   cd web
   docker compose up -d --build
   ```
4. Cek log container relay untuk konfirmasi:
   ```sh
   docker compose logs relay
   ```
   Harus muncul baris `[relay] listening on :8091 (AssemblyAI shared key configured)`.
   Kalau yang muncul `(no ASSEMBLYAI_API_KEY — ...)`, berarti `.env` belum
   terbaca — cek lokasi filenya dan ulangi `docker compose up -d --build`.

Setelah ini, **tidak ada langkah di sisi perangkat/aplikasi** — nurse buka
Bot BPJS seperti biasa, rekam, dan diarization langsung berjalan tanpa
dialog "Kunci API AssemblyAI" muncul sama sekali.

## Kalau tidak ingin pakai kunci bersama

Biarkan `ASSEMBLYAI_API_KEY` kosong/tidak diset. Setiap perangkat akan tetap
jalan seperti sebelumnya: diminta sekali untuk kunci AssemblyAI pribadi
nurse itu, tersimpan lokal di perangkatnya.

## Biaya & kuota

Kunci bersama dipakai bersama oleh **semua** perangkat yang tersambung ke
deployment ini — satu kuota/biaya AssemblyAI untuk seluruh instansi, bukan
per-nurse. Pantau pemakaian dari dashboard AssemblyAI kalau volume rekaman
mulai banyak, dan pertimbangkan upgrade paket di sana kalau perlu — ini
murni pengaturan akun AssemblyAI, tidak ada yang perlu diubah di kode kalau
cuma ganti kunci/paket.

## Troubleshooting

| Gejala | Kemungkinan sebab |
|---|---|
| Dialog "Kunci API AssemblyAI" masih muncul di semua perangkat | `.env` belum terbaca container relay — cek `docker compose logs relay`, pastikan baris log menyebut "shared key configured" |
| "Diarization gagal" langsung setelah upload | Kunci di `.env` salah/sudah dicabut dari dashboard AssemblyAI — AssemblyAI akan balas 401/403, bukan 503, jadi relay meneruskannya sebagai error biasa |
| Berhasil di WiFi kantor tapi gagal di jaringan lain | `WEB_HUB_URL` (lihat `app/lib/services/web_hub_config.dart`) masih menunjuk ke alamat lokal (`localhost`/LAN) — untuk build yang dipakai di luar jaringan itu, build ulang dengan `--dart-define=WEB_HUB_URL=https://domain-publik-kamu` |

## Perbaikan "semua jadi Perawat" (2026-10-13)

Penyebab umum: audio satu mikrofon membuat AssemblyAI menganggap hanya ada 1
pembicara, lalu semua teks berlabel pembicara pertama (= perawat). Perbaikan:

1. Permintaan transkrip kini mengirim `speakers_expected: 2` (relay dan jalur
   langsung), plus `punctuate`/`format_text`.
2. Jika AssemblyAI tetap melapor 1 suara, teks dipecah per kalimat dan LLM
   yang tersambung menentukan peran tiap kalimat (bertanya = perawat,
   menjawab = pasien). Ditandai `relabel_llm` pada metrik perbandingan.
3. Tombol **Tukar peran perawat ↔ pasien** di layar hasil untuk kasus
   pembicara pertama ternyata pasien.

Lihat [BOT-BPJS-PERBANDINGAN.md](BOT-BPJS-PERBANDINGAN.md).
