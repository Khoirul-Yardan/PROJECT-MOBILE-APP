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
| Gemini langsung | `/search`, `/code`, `/url` |
| OpenAI langsung | `/search`; `/code` untuk model dalam daftar dukungan aplikasi |
| OpenRouter | `/search` plugin web |
| Claude | `/search` pada keluarga model yang mendukung; default baru Haiku 4.5 |
| Mastra Test | Discovery tools server: `/calculate`, `/current_time` |
| Hermes A2A | Discovery skills dari agent card dengan token pengguna |
| Hermes API Server/OpenClaw | Permintaan teks ke agent; tools mengikuti server, discovery belum tersedia dalam adapter |
| Groq/Nous/custom OpenAI-compatible | Chat/perintah umum; kompatibilitas format bukan dukungan hosted tools OpenAI |

Skills dari aplikasi vendor atau coding assistant tidak otomatis tersedia lewat API. File search, MCP, computer use, unggah file, dan tools yang memerlukan konfigurasi tambahan belum dihubungkan oleh perubahan ini. Tools dapat memakai kuota/biaya tambahan. Model lama yang tersimpan tidak diubah otomatis; gunakan **Pilih model** bila diperlukan.

## Mastra Studio dan pengembangan

Studio dapat dibuka untuk melihat agent/tools tanpa key. Untuk generasi langsung di Studio, salin `mastra-test/.env.example` menjadi `.env` dan isi `GOOGLE_API_KEY` sendiri, lalu:

```powershell
docker compose -f web/docker-compose.yml --profile mastra up -d --force-recreate mastra
```

Chat AI Hub memakai key masing-masing pengguna dan tidak membutuhkan key server tersebut. Memory/traces Mastra dimatikan; riwayat Chat tetap di akun AI Hub.

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
