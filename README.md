# AI Hub

Aplikasi Android hybrid untuk chat multi-provider, agent AI, VPN, dan dokumentasi percakapan perawat–pasien. Flutter (`app/`) memuat SPA vanilla JavaScript (`web/public/`). Supabase menangani akun, riwayat, kredensial terenkripsi, dan RLS pemilik data.

Bot BPJS tetap inti akademik: transkrip asli, draf dokumentasi, penyuntingan perawat, lalu ekspor untuk ditinjau dokter **di luar aplikasi**. AI tidak menetapkan diagnosis. Mastra adalah tambahan eksperimen chat umum; tidak mengganti pipeline Bot BPJS.

## Mulai dengan Docker

Prasyarat: Docker Desktop dengan Linux containers dan internet untuk mengunduh image/dependensi serta menghubungi Supabase/provider. Dari direktori proyek:

```powershell
docker compose -f web/docker-compose.yml --profile mastra up -d --build web relay mastra
docker compose -f web/docker-compose.yml --profile mastra ps
```

| Layanan | Alamat laptop | Kegunaan |
|---|---|---|
| AI Hub | http://localhost:8090 | Login, pengaturan provider, Chat, fitur aplikasi |
| Mastra Studio | http://localhost:4111 | Membangun, menguji, mengelola agent, workflow, tools |
| Health Mastra | http://localhost:8090/mastra/ai-hub/health | Cek server tanpa key/kuota AI |
| Admin opsional | http://localhost:8095 | Konfigurasi terpisah; [panduan admin](docs/PANEL-ADMIN.md) |

Perintah tersebut hanya menjalankan web, relay, dan Mastra. Tanpa Mastra: `docker compose -f web/docker-compose.yml up -d --build web relay`. Admin memerlukan konfigurasi `web/.env`; jangan menyalin service key ke aplikasi.

```powershell
# Setelah mengubah kode
docker compose -f web/docker-compose.yml --profile mastra up -d --build web mastra
# Log server; jangan mencatat key/isi percakapan
docker compose -f web/docker-compose.yml --profile mastra logs --tail 40 mastra
# Hentikan Mastra saja
docker compose -f web/docker-compose.yml --profile mastra stop mastra
```

## Hubungkan agent Mastra dengan satu kode

1. Minta kode koneksi `aihub-mastra-v1.` dari pemilik agent yang sudah memasang adapter AI Hub.
2. Login, pilih **Hubungkan Agent**, lalu tempel kode. Tidak perlu memasukkan URL atau key provider secara terpisah.
3. Tekan **Periksa koneksi Mastra**, periksa nama agent/provider/model dari server, lalu **Simpan & Hubungkan Agent**.
4. Pilih agent di Chat dan kirim pesan. `/skills` membaca kemampuan agent; provider dan model ditentukan pemilik server.

Kode koneksi adalah format AI Hub yang mengemas endpoint, agent ID, dan token akses. Bukan API key universal Mastra; server pihak ketiga harus menyediakan adapter. Key provider tetap di server pemilik. Koneksi BYOK lama tetap didukung, tetapi tidak dipakai untuk setup baru.

Cara memasang adapter pada agent yang sudah ada, membuat kode, mencoba server lokal, kontrak API, keamanan, dan migrasi: **[Panduan koneksi Mastra](docs/MASTRA-KONEKSI.md)**. `mastra-test` memakai Gemini sebagai contoh; koneksi agent lain tidak dibatasi ke Gemini.

## Gunakan pada HP Android

### USB: cara utama untuk pengujian lokal

Pasang Android Platform Tools (`adb`), aktifkan USB debugging, sambungkan kabel, lalu terima izin laptop di HP:

```powershell
adb devices
adb reverse tcp:8090 tcp:8090
```

Buka Chrome HP ke `http://localhost:8090`, login, lalu gunakan Chat. URL Mastra tetap `http://localhost:8090/mastra`; satu reverse cukup karena nginx meneruskan permintaan ke container.

Untuk fitur native (mikrofon/STT, TTS, VPN), gunakan Flutter dan Android SDK:

```powershell
cd app
flutter pub get
flutter run --dart-define=WEB_HUB_URL=http://localhost:8090
```

Jika ada beberapa perangkat: `adb -s <serial> reverse tcp:8090 tcp:8090` dan `flutter run -d <serial> --dart-define=WEB_HUB_URL=http://localhost:8090`. Ulangi reverse setelah kabel terputus/restart.

APK release lama defaultnya membuka Fly, sehingga **tidak otomatis menampilkan perubahan Docker lokal**. Gunakan build debug/perintah di atas atau browser HP lewat USB. Override URL tidak memerlukan perubahan Dart.

Untuk Studio di HP, jalankan `adb reverse tcp:4111 tcp:4111`, lalu buka `http://localhost:4111`. Port Studio hanya di loopback laptop/reverse USB.

### Wi-Fi/VPN

HP harus dapat menjangkau IP laptop, port 8090. Firewall Windows/jaringan tamu dapat memblokirnya. `localhost` pada HP berarti HP sendiri kecuali menggunakan `adb reverse`.

Untuk browser HP lewat LAN, gunakan **HTTPS dengan sertifikat dipercaya HP**. `http://<IP-laptop>:8090` dapat menampilkan halaman tetapi bukan secure context Web Crypto untuk menyimpan key. Gunakan USB/localhost bila belum menyiapkan HTTPS. Untuk shell Flutter lewat LAN, isi URL HTTPS pada `WEB_HUB_URL`. Jangan mengirim key lewat HTTP jaringan terbuka.

## Skills mengikuti provider

| Provider | Tools yang terhubung |
|---|---|
| Semua | `/system`, `/clear`, `/help`, `/skills` |
| Gemini langsung | `/search` (Google Search), `/code` (Python Code Execution), `/url` (URL Context) |
| OpenAI langsung | `/search` (Web Search); `/code` (Code Interpreter untuk model yang mendukung) |
| OpenRouter | `/search` (Plugin Web Search) |
| Claude | `/search` (Web Search 2025 pada model yang mendukung) |
| Mastra Test | Discovery `/calculate`, `/current_time`; `/computer` jika bridge desktop dikonfigurasi |
| Hermes A2A | Discovery agent card; hanya skills yang diumumkan server |
| Hermes API Server / Nous / OpenClaw / Groq | Chat dan perintah umum; tidak mengasumsikan terminal, webhook, atau tools medis |
| Custom OpenAI-compatible | Perintah umum `/system`, `/clear`, `/help`, `/skills` |

Skills dari aplikasi vendor atau coding assistant tidak otomatis tersedia lewat API. File search, MCP dan unggah file belum dihubungkan. Computer use lokal Mastra terbatas pada screenshot dan aksi eksplisit melalui bridge Windows; lihat panduan di bawah. Tools dapat memakai kuota/biaya tambahan. Model lama yang tersimpan tidak diubah otomatis; gunakan **Pilih model** bila diperlukan.

## Screenshot laptop lewat Chat Mastra

Mastra tidak memerlukan API key universal dari situs Mastra: server contoh memakai key Google pemilik dan token agent lokal. Buat kode koneksi dari direktori `mastra-test`:

```powershell
node --env-file=.env scripts/connection-code.mjs http://localhost:8090/mastra ai-hub laptop.connection.txt
```

Tempel isi file privat tersebut di **Hubungkan Agent**, periksa, simpan, lalu pilih Mastra di Chat. Model router Mastra menyediakan akses ke ribuan model melalui [katalog resmi](https://mastra.ai/models); provider/key/model tetap perlu dikonfigurasi oleh pemilik server.

Dari root, jalankan `python mastra-test/scripts/desktop_bridge.py --minutes 60`, lalu di terminal kedua `docker compose -f web/docker-compose.yml --profile mastra up -d --build web mastra`. Ketik `/computer screenshot` di Chat. PNG tersimpan pada laptop dan kini **dikirim sebagai gambar di Chat**, dapat diperbesar/diunduh, serta mengikuti penyimpanan riwayat akun. Batas lampiran 4 MiB. Gambar belum otomatis dianalisis model; data base64 tidak diteruskan sebagai prompt pada pesan berikutnya. Ctrl+C menghentikan bridge. Klik/tombol navigasi memerlukan `--allow-control` dan satu perintah eksplisit per aksi.

Panduan lengkap, batas kontrol, dan hasil tes semua bot: [Mastra desktop dan pengujian](docs/MASTRA-DESKTOP-DAN-UJI.md).

## Mastra Studio dan pengembangan

Studio dapat dibuka untuk melihat agent/tools tanpa key. Untuk generasi langsung di Studio, salin `mastra-test/.env.example` menjadi `.env` dan isi `GOOGLE_API_KEY` sendiri, lalu:

```powershell
docker compose -f web/docker-compose.yml --profile mastra up -d --force-recreate mastra
```

Koneksi Mastra baru memakai token agent dan key provider di server pemilik. Hanya jalur BYOK lama yang memakai key provider per permintaan. Memory/traces Mastra dimatikan; riwayat Chat tetap di akun AI Hub.

Alternatif server host (Node.js sesuai `mastra-test/package.json`):

```powershell
cd mastra-test
npm ci
npx bgproc start -n mastra-test -w -- npm run dev
```

Gunakan satu server pada port 4111. Hentikan container Mastra sebelum menjalankan host. Pada browser laptop dengan web Docker, URL server host dapat diisi `http://host.docker.internal:4111`; hostname ini khusus Docker, bukan alamat HP. Untuk HP gunakan Docker penuh dan reverse USB.

## Pengujian dan masalah umum

```powershell
python web/tests/ui_smoke.py
python web/tests/mastra_skills_smoke.py
cd mastra-test
npm run typecheck
npm test
npm run build
```

Tes browser memakai fixture tanpa Supabase/API berbayar. Uji Gemini nyata perlu key valid dan kuota; fixture bukan bukti keberhasilan layanan Google.

| Masalah | Pemeriksaan |
|---|---|
| Health Mastra 502 | Profil `mastra` harus berjalan; cek `compose ps` |
| 401/403 | Periksa key Google, akses model/API |
| 429 | Periksa kuota Google; slot key dapat digunakan untuk rotasi |
| Skills gagal dimuat | Periksa URL/token; ketik `/skills` |
| HP gagal membuka lokal | Cek `adb devices`, reverse, dan `WEB_HUB_URL` |
| Simpan key gagal di IP Wi-Fi | Gunakan HTTPS atau USB/localhost |
| Tool/model ditolak | Pilih model kompatibel atau matikan tool |

## Struktur dan dokumentasi

Dokumentasi menyeluruh di root proyek: [Dokumentasi Seluruh sistem.md](<Dokumentasi Seluruh sistem.md>) — arsitektur, tech stack, modul, database, keamanan, Docker/Fly, penggunaan HP dan batas bukti pengujian.

Untuk PA: [telaah dokumen speech dan Drive](docs/TELAAH-SPEECH-DAN-PA-2026-10-20.md) dan [paket pengujian realistis](docs/PAKET-UJI-PA/README.md) berisi 12 dialog fiktif, 36 slot rekaman, fakta acuan, pembagian baseline/proposed, lembar hasil kosong, serta cara menghitung WER. Ini bahan persiapan eksperimen, bukan hasil uji yang sudah dilakukan.

| Lokasi | Isi |
|---|---|
| `web/public/` | SPA, provider, adapter AI, skills, pengaturan, Chat |
| `web/tests/` | Smoke/e2e browser |
| `web/docker-compose.yml` | Web, relay, admin, profil Mastra |
| `mastra-test/` | Agent Gemini, tools, kontrak integrasi, Docker |
| `app/` | Flutter, native bridge, STT/TTS, VPN |
| `app/supabase/` | Skema/RLS; tidak diubah integrasi ini |
| `docs/` | [Indeks](docs/README.md), [Mastra](docs/MASTRA.md), [keputusan](docs/KEPUTUSAN.md) |
| `PRD/` | Kebutuhan akademik/produk; kode adalah acuan implementasi |

Gunakan akun Supabase sendiri dan pertahankan RLS. Jangan commit `.env`, key, profil VPN asli, data pasien nyata, atau folder build. README subfolder app/web sebagian usang; gunakan README utama untuk setup lokal. Penambahan Mastra ini belum dipush/deploy ke Fly.
