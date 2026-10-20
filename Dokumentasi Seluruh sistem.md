# Dokumentasi Seluruh Sistem AI Hub

**Snapshot kode: 20 Oktober 2026.** Dokumen ini berada di root `PROJECT MOBILE APP` sesuai permintaan pengguna. Isinya menjelaskan implementasi pada checkout lokal, bukan klaim bahwa seluruh fitur sudah lolos uji produksi. Versi dependensi berasal dari manifest proyek; tanda `^` adalah rentang yang diminta, bukan bukti versi SDK yang terpasang di setiap komputer.

## 1. Tujuan, pengguna, dan batas sistem

AI Hub adalah aplikasi Android hybrid. Flutter menyediakan shell dan kemampuan perangkat; sebagian besar antarmuka menggunakan SPA vanilla JavaScript yang dimuat dalam satu WebView persisten. SPA juga dapat dibuka langsung dari browser untuk pengembangan dan fitur web.

Fokus Proyek Akhir D3 PENS Lamongan adalah **otomatisasi dokumentasi percakapan perawat–pasien menggunakan Speech-to-Text dan Large Language Model, sebagai pendukung verifikasi diagnosis oleh dokter**. Fitur chat multi-provider, agent, VPN, SSH, dan computer use merupakan kemampuan pendukung/eksperimen aplikasi, bukan hasil utama evaluasi speech PA.

Perawat merekam percakapan dengan pasien, memeriksa transkrip dan draf, memperbaikinya, lalu membagikan hasil untuk ditinjau dokter di luar aplikasi. LLM mengekstrak dan menyusun informasi; LLM tidak menetapkan diagnosis atau saran obat. Peran pembicara ditentukan dari konteks sesi, bukan identitas biometrik.

Pasien dapat menyampaikan kebutuhan melalui Papan Komunikasi, termasuk lewat tautan ruangan. Pada Anamnesis Terpandu, pertanyaan berasal dari TTS sistem. Label pertanyaan dalam data tidak boleh dijadikan klaim bahwa suara perawat manusia direkam.

Tidak ada akun/antarmuka verifikasi dokter, rekaman ucapan dokter, Friend System aktif, wake word “Halo Jarvis”, atau balasan suara Bot BPJS yang perlu dihidupkan kembali. Istilah lama pada komentar atau dokumen arsip tidak mengalahkan perilaku kode sekarang. Aturan akademik dan kepemilikan kerja ada di [AGENTS.md](AGENTS.md).

## 2. Arsitektur dan jalur komunikasi

```text
Android
  Flutter shell + WebView ───────────────┐
  mikrofon / TTS / VPN / SSH / ekspor    │
              ↕ NativeBridge           │
Browser ───────────────→ SPA AI Hub ←───┘
                         │
                         ├─ Supabase Auth / Postgres + RLS / Realtime
                         ├─ API provider langsung: Gemini, OpenAI, Claude, dll.
                         ├─ HTTP native atau relay → agent self-hosted
                         └─ nginx /mastra → Mastra Docker → model Google
                                               │
                                               └─ bridge Windows lokal
                                                  screenshot / klik / navigasi

Bot BPJS native → audio → AssemblyAI langsung atau relay
              → transkrip + label pembicara → LLM → draf
              → perawat menyunting → simpan / ekspor → dokter di luar aplikasi

Panel Admin → server Node → Supabase menggunakan service key server
```

Supabase adalah backend data utama. Tidak ada backend AI tunggal yang memproses semua chat. Panggilan provider umumnya berasal dari client/native; relay menangani transport tertentu, dan Mastra merupakan runtime agent opsional yang sengaja dijalankan di server lokal. Admin adalah layanan tersendiri.

| Komponen | Tanggung jawab | Sumber utama |
|---|---|---|
| Flutter | WebView, API OS, layar speech, VPN, SSH, berbagi berkas | `app/lib/` |
| SPA | Login, navigasi, Chat, provider, Bot Hub, riwayat, papan, pengaturan | `web/public/` |
| nginx | Melayani file statis; proxy `/relay/` dan kontrak `/mastra/` | `web/nginx.conf.template` |
| Relay Node | HTTP agent, proxy AssemblyAI dengan key bersama opsional | `web/relay/server.js` |
| Supabase | Auth, data akun, sesi/transkrip/dokumen, kredensial dan Realtime | `app/supabase/schema.sql`, `web/public/db.js` |
| Mastra | Agent Gemini, tools hitung/waktu, adapter koneksi AI Hub, desktop eksplisit | `mastra-test/src/mastra/` |
| Bridge Windows | Screenshot layar utama, aksi pointer/tombol terbatas | `mastra-test/scripts/desktop_bridge.py` |
| Admin | Manajemen akun, konfigurasi operasional, metadata, status, audit | `admin/server.js`, `admin/lib/` |

## 3. Tech stack

### 3.1 Aplikasi mobile

Manifest: [app/pubspec.yaml](app/pubspec.yaml). Versi aplikasi `1.0.0+1`, rentang Dart SDK `^3.13.3`. Versi Flutter SDK tidak dipatok oleh manifest ini; catat keluaran `flutter --version` saat membangun dan menguji.

| Teknologi/paket | Deklarasi | Pemakaian |
|---|---|---|
| Flutter / Dart | SDK Flutter + Dart `^3.13.3` | Shell dan layar native |
| `webview_flutter` | `^4.14.1` | SPA dalam WebView |
| `supabase_flutter` | `^2.17.2` | Sesi/data Supabase dari native |
| `http` | `^1.2.2` | HTTP provider, STT, relay |
| `record` | `^7.1.1` | Rekaman mikrofon; Bot BPJS memakai encoder AAC LC |
| `flutter_tts` | `^4.2.0` | Pertanyaan terpandu dan suara Papan |
| `flutter_secure_storage` | `^9.2.2` | Konfigurasi rahasia lokal native |
| `cryptography` | `^2.7.0` | Kompatibilitas enkripsi kredensial |
| `wireguard_flutter` | `^0.1.3` | Tunnel WireGuard |
| `openvpn_flutter` | `^1.3.4` + override lokal | Tunnel OpenVPN; patch ada di `app/third_party/openvpn_flutter` |
| `dartssh2`, `xterm` | `^4.1.0`, `^4.0.0` | Koneksi dan tampilan terminal SSH |
| `pdf`, `printing` | `^3.11.3`, `^5.13.4` | Penyusunan/penanganan PDF |
| `docx_creator` | `^1.4.0` | Ekspor DOCX |
| `share_plus`, `path_provider` | `^11.0.0`, `^2.1.5` | Berbagi dan lokasi berkas |
| `flutter_test`, `flutter_lints` | SDK, `^6.0.0` | Tes dan analisis statis |

STT utama yang terlihat pada kode kini menggunakan **AssemblyAI melalui HTTP**. Jangan menyebut implementasi sekarang sebagai Whisper lokal atau `speech_to_text` Android hanya berdasarkan dokumen lama. Nama model STT vendor yang benar-benar digunakan harus dicatat dari konfigurasi/hasil eksperimen; request sekarang tidak mematok nama model Whisper.

### 3.2 Web, layanan, dan pengujian

| Lapisan | Stack/versi pada konfigurasi | Catatan |
|---|---|---|
| SPA | HTML, CSS, JavaScript ES Modules | Tanpa React/Vue, bundler, atau instalasi npm frontend |
| Router | Hash router buatan proyek | Contoh `#/chat`, `#/bots` |
| Supabase web SDK | `@supabase/supabase-js@2` melalui jsDelivr | CDN memakai major v2, bukan patch version yang dikunci |
| Kriptografi browser | Web Crypto, PBKDF2 SHA-256, AES-GCM 256 | HTTPS/localhost diperlukan untuk secure context |
| Web container | `nginx:1.27-alpine` + Node dari paket Alpine | Relay dapat dijalankan di image yang sama pada Fly |
| Relay container | `node:20-alpine` | Modul bawaan Node HTTP/fetch |
| Admin container | `node:20-alpine` | HTTP server Node dan JS native, tanpa dependensi npm tambahan |
| Database | Supabase Postgres, Auth, Realtime | Versi server managed tidak dipatok di repo |
| Mastra runtime | Node `>=22.18.0`, image `node:22-alpine` | Docker menjalankan `npm run dev` untuk Studio lokal |
| Mastra packages | `@mastra/core 1.78.0`, CLI `mastra 1.34.2` | Versi persis di `mastra-test/package.json` |
| TypeScript/Zod | `typescript 6.0.3`, `zod 4.6.7` | Implementasi dan validasi kontrak Mastra |
| Desktop bridge | Python stdlib, PowerShell, .NET Drawing, Windows user32 | Berjalan di host Windows, bukan di container Linux |
| Pengujian | Python Playwright + Chrome; Node test runner; Flutter test | Fixture dipisahkan dari panggilan layanan nyata |
| Hosting | Docker Compose lokal; konfigurasi Fly.io | Snapshot konfigurasi bukan pemeriksaan status deployment terbaru |

Tag Docker yang disebut tidak semuanya memakai digest tetap di Dockerfile. Untuk reproduksi eksperimen, catat digest image dan versi runtime yang benar-benar dijalankan.

## 4. Struktur direktori dan titik masuk

```text
PROJECT MOBILE APP/
├─ app/
│  ├─ lib/main.dart
│  ├─ lib/screens/       WebView, BPJS, Anamnesis, Terminal
│  ├─ lib/services/      Supabase, STT, LLM, ekspor, VPN, SSH
│  ├─ android/           integrasi Android/native
│  ├─ supabase/          schema.sql, schema-admin.sql
│  ├─ third_party/       plugin OpenVPN yang dipatch
│  └─ test/              tes native/logika
├─ web/
│  ├─ public/app.js      registrasi route dan penjagaan login
│  ├─ public/views/      satu modul per halaman
│  ├─ public/ai.js       adapter request provider/agent
│  ├─ public/bridge.js   kontrak WebView ↔ Flutter
│  ├─ public/skills.js   tools provider yang diintegrasikan
│  ├─ public/chat-content.js  pemisahan gambar dari prompt teks
│  ├─ relay/server.js
│  ├─ tests/
│  ├─ Dockerfile
│  ├─ nginx.conf.template
│  ├─ docker-compose.yml
│  └─ fly.toml
├─ mastra-test/
│  ├─ src/mastra/index.ts
│  ├─ src/mastra/agents/ai-hub.ts
│  ├─ src/mastra/tools/
│  ├─ src/mastra/connection-adapter.ts
│  ├─ scripts/           kode koneksi dan bridge desktop
│  └─ tests/
├─ admin/                panel dan backend admin
├─ docs/                 dokumen topik, keputusan, handoff, paket evaluasi
├─ PRD/                  kebutuhan; sebagian lebih lama dari kode
├─ tool/                 utilitas kerja proyek
├─ TEST VPN/             lingkungan/skrip uji VPN terpisah
├─ Dokumentasi/          laporan progres dan bukti lokal
├─ README.md             panduan mulai cepat
└─ Dokumentasi Seluruh sistem.md
```

`TEST VPN/` bukan backend data utama. Berkas profil/key asli dan `.env` tidak boleh dipublikasikan atau disalin ke dokumen ini.

## 5. Modul aplikasi dan alur pengguna

### 5.1 Akun, navigasi, dan sesi

Pengguna masuk/daftar melalui Supabase Auth. `web/public/app.js` memasang guard pada route privat. `db.js` menyediakan fungsi profil, aktivitas, data dokumentasi dan subscription. Sesi web diteruskan ke native melalui pesan `session_changed`, sehingga layar native dapat menggunakan akun yang sama.

Router menyiapkan halaman dalam container sementara dan memakai token render untuk mencegah dua render async menimpa halaman. Navigasi aplikasi berada pada web, bukan bottom navigation Flutter tersendiri. WebView dipertahankan untuk menjaga state saat berpindah layar native.

| Route | Fungsi |
|---|---|
| `#/login`, `#/home` | Akun dan beranda |
| `#/chat`, `#/history` | Chat per provider/agent, sesi percakapan dan riwayat |
| `#/bots` | BPJS, Papan Komunikasi, Anamnesis, panduan wawancara |
| `#/bpjs` | Dokumentasi dan riwayat gabungan |
| `#/papan-komunikasi` | Papan milik pengguna/perawat |
| `#/p?t=...` | Halaman pasien berbasis token ruangan |
| `#/vpn`, `#/vpn-config`, `#/terminal` | Konfigurasi/tunnel VPN dan pintu masuk SSH |
| `#/settings` dan turunannya | Profil, API/agent, aktivitas |

### 5.2 Chat, provider, dan agent

Katalog provider berada di `providers.js`; pengaturan agent memakai `agent-setup.js` dan koneksi Mastra memakai `mastra-connection.js`. Pengenalan pola key membantu menentukan format, tetapi bukan bukti key valid atau kuota tersedia. Token server umum masih dapat memerlukan URL/jenis agent dari pengguna.

| Integrasi | Format/jalur client | Kemampuan yang ditampilkan |
|---|---|---|
| OpenAI | Chat Completions; jalur hosted tools sesuai adapter | Search/code hanya model yang diizinkan aplikasi |
| Gemini | `generateContent`, discovery model | Google Search, Code Execution, URL context sesuai dukungan |
| Anthropic | Messages | Search untuk keluarga model yang dipetakan |
| OpenRouter | OpenAI-compatible | Search melalui plugin web |
| Groq | OpenAI-compatible | Chat; label “Llama Medis” berasal dari prompt aplikasi, bukan model medis khusus |
| Nous Portal/Hermes model | OpenAI-compatible | API inferensi model; tidak otomatis memiliki terminal/browser |
| Hermes Agent A2A | JSON-RPC dan polling task | Discovery agent card, tools milik server |
| Hermes API Server | Endpoint kompatibel Chat Completions | Kemampuan mengikuti konfigurasi agent; discovery belum otomatis setara A2A |
| OpenClaw HTTP | Chat Completions gateway | Konfigurasi endpoint gateway harus aktif |
| OpenClaw webhook legacy | Adapter webhook | Bukan seluruh API OpenClaw |
| Mastra agent | Kontrak `ai-hub-mastra-agent-v1` | Discovery terautentikasi; model ditetapkan server |
| Custom | Endpoint manual | Kompatibilitas format tidak menjamin hosted tools vendor |

Key disimpan dalam slot per akun/provider. `ai.js` dapat mencoba slot berikutnya saat kuota/rate limit; error autentikasi atau jaringan tidak otomatis dianggap alasan menghabiskan semua slot. Pilihan model dan toggle tools mengikuti entry yang dipilih agar kemampuan provider tidak bocor ke provider lain.

Perintah umum adalah `/system`, `/clear`, `/help`, dan `/skills`. Skills di coding assistant atau aplikasi resmi vendor tidak otomatis tersedia lewat API. A2A/Mastra mengumumkan skill melalui server; nama vendor bukan dasar untuk menjanjikan computer use.

Riwayat dibagi oleh `session_id`, `provider_id` dan pemilik. Keluaran asisten berupa teks dengan renderer Markdown terbatas: teks di-escape, lalu bold/list/link dan gambar yang memenuhi allowlist dirender. Gambar dapat diketuk untuk tampilan besar dan diunduh; native menggunakan jalur berbagi gambar yang sudah ada.

### 5.3 Bot BPJS: pipeline utama PA

1. Perawat menyiapkan identitas sesi dan meminta izin mikrofon.
2. `AudioRecorder` merekam percakapan perawat–pasien ke berkas audio lokal.
3. Setelah berhenti, audio diunggah untuk AssemblyAI; bukan live caption setiap kata.
4. Request STT mengaktifkan `speaker_labels`, `speakers_expected: 2`, `language_code: id`, punctuation dan formatting.
5. Sistem memetakan kelompok pembicara menjadi perawat/pasien. Jika hanya satu kelompok terdeteksi, ada fallback relabel berbasis LLM. Perawat juga dapat memperbaiki pemetaan.
6. LLM menyusun draf dari transkrip. Format keluaran mencakup ringkasan, keluhan utama, durasi, riwayat kesehatan dan hasil anamnesis.
7. Perawat melihat transkrip dan menyunting draf, menyimpan, menyalin atau mengekspor PDF/DOCX.
8. Dokter menerima dokumentasi di luar aplikasi. Status “terkirim” bukan bukti dokter sudah memverifikasi diagnosis.

AssemblyAI dapat dipanggil lewat relay dengan key server bersama. Jika relay menyatakan key belum dikonfigurasi, aplikasi memiliki jalur key pribadi. Kegagalan jaringan biasa tidak sama dengan key bersama tidak tersedia. Rekaman yang gagal diproses dapat dipertahankan untuk proses ulang; retensi audio permanen untuk dataset penelitian tidak otomatis disediakan pipeline. Siapkan salinan audio penelitian sendiri sesuai protokol sebelum pengujian.

Pemilihan kredensial LLM native saat ini hanya menerima format `hermes-api`, `openai`, `anthropic`, `gemini`. Koneksi `mastra-agent` Chat bukan otomatis provider Bot BPJS. Jangan menyatakan pemasangan Mastra mengubah engine dokumentasi.

Untuk audit evaluasi, simpan keluaran STT mentah dan label sebelum relabel di luar salinan yang telah dikoreksi bila perlu. Proses penggantian segmen pada repository sesi bukan jaminan seluruh versi label vendor tersimpan sebagai version history.

Sumber: `app/lib/screens/bot_bpjs_screen.dart`, `assemblyai_service.dart`, `bpjs_service.dart`.

### 5.4 Anamnesis Terpandu

Tujuh pertanyaan standar membahas keluhan utama, waktu mulai, lokasi/berat keluhan, riwayat penyakit, alergi, obat rutin dan keluhan lain. Pertanyaan dibacakan melalui TTS. Pasien menjawab melalui rekaman/STT AssemblyAI atau isian yang tersedia, lalu perawat mengonfirmasi/memperbaiki jawaban sebelum penyusunan draf.

Kode memisahkan jawaban STT mentah, jawaban yang disetujui, dan penanda asal suara. Hasil disimpan melalui tabel dokumentasi yang sama dengan metadata alur. Pada laporan PA, ini adalah interaksi **sistem–pasien yang didampingi perawat**, bukan pengganti dataset percakapan dua manusia untuk pengujian diarization.

### 5.5 Papan Komunikasi

Papan menawarkan kebutuhan seperti nyeri, sesak, haus, lapar, mual, toilet, dingin/panas, ubah posisi, permintaan obat dan panggil perawat. Pilihan nyeri meminta skala 0–10 dan lokasi. Ini laporan/pilihan pasien, bukan rekomendasi terapi oleh AI.

Suara menggunakan native TTS saat tersedia, dengan fallback browser. Event mencatat jenis, detail, waktu dan penanda mendesak. Perawat dapat mengelola ruangan dan memberikan tautan bertoken; pasien mengirim pilihan melalui RPC terbatas. Pemilik melihat event dan riwayat, lalu dapat menyalin catatan untuk dokumentasi.

Papan bukan nurse-call resmi rumah sakit. Cache lokal untuk fallback bukan jaminan sinkronisasi cloud. Implementasi cache Papan yang ada masih memakai key localStorage umum; isolasi cache lokal saat akun berganti merupakan batas yang harus diuji/ditindaklanjuti, terpisah dari kebijakan RLS cloud. Jangan menyamakan keberadaan RLS dengan audit keseluruhan perangkat bersama.

### 5.6 VPN dan Terminal SSH

WireGuard/OpenVPN membuka tunnel native Android. Konfigurasi akun disimpan terenkripsi di `vpn_configs`, lalu dicerminkan ke secure storage native untuk koneksi. Override lokal plugin OpenVPN menangani kebutuhan password private key yang sebelumnya belum diteruskan ke engine.

Terminal adalah layar native berbasis `dartssh2`/`xterm`, dengan target SSH tersendiri yang disimpan menggunakan secure storage. SSH bukan VPN seluruh perangkat. Alur yang umum: hubungkan VPN agar jaringan privat terjangkau, lalu SSH ke server tujuan. Konfigurasi dan keberhasilan uji pada satu jaringan tidak otomatis membuktikan semua jaringan/profil bekerja.

Fallback VPN pada browser pengembangan dapat mensimulasikan status terhubung. Itu **bukan tunnel nyata**. Pengujian VPN harus memakai perangkat dan verifikasi jaringan aktual.

### 5.7 Panel Admin

Panel tersedia terpisah dari akun aplikasi. Server Node memakai `ADMIN_USER`, `ADMIN_PASSWORD`, `SESSION_SECRET`, dan Supabase service key. Cookie admin ditandatangani HMAC, HttpOnly, SameSite Strict, TTL delapan jam; Secure diaktifkan lewat konfigurasi produksi. Kode juga menyediakan pembatas kegagalan login per IP.

Menu saat ini: dashboard, maintenance, pengumuman, akun, profil, metadata tabel, audit, status/setup. Menu katalog bot/provider dan pemilihan peran pengguna tidak ditampilkan dalam desain saat ini. Tabel katalog lama dapat tetap berada di schema karena pembacaan konfigurasi aplikasi tidak identik dengan menu CRUD admin.

Service key melewati RLS. Karena itu pembatas kolom server pada `admin/lib/resources.js` adalah pagar terpisah: konten chat/transkrip, identitas pasien dan nilai credential tidak dipilih oleh halaman metadata. Admin bukan antarmuka membaca dokumentasi klinis pemilik sesi.

## 6. NativeBridge dan kontrak antarbagian

Web memanggil `NativeBridge.postMessage(JSON)`. Payload memuat `id`, `type`, dan `payload`. Flutter membalas melalui `window.__nativeReply(id, json)` atau mengirim event lewat `window.__nativeEvent(type, json)`. Client menyimpan pending request dan timeout agar UI tidak menunggu tanpa batas.

| Kelompok | Contoh pesan |
|---|---|
| Akun | `session_changed`, `sign_out` |
| VPN | `get_vpn_config`, `save_vpn_config`, `vpn_connect`, `vpn_disconnect`, `vpn_state` |
| Speech | `open_bot_bpjs`, `open_anamnesis_terpandu`, `speak` |
| Perangkat | `open_terminal`, `pick_text_file`, penyimpanan/berbagi gambar |
| Transport agent | `http_relay` |

Nama dan bentuk pesan adalah kontrak `web/public/bridge.js` ↔ `app/lib/screens/web_shell_screen.dart`. Perubahan salah satu sisi harus diberitahukan melalui HANDOFF. Pembaruan screenshot Chat pada dokumen ini memakai balasan teks/gambar yang sudah didukung, tidak mengubah kontrak native atau schema database.

## 7. Penyimpanan data dan akses

| Tabel | Data/peran | Pemilik/kontrol utama |
|---|---|---|
| `profiles` | Profil akun | Kebijakan profil pada schema; bukan tabel data klinis |
| `activity_log` | Aktivitas aplikasi | `user_id`; hindari isi percakapan di log |
| `bpjs_sessions` | Header sesi dan status | `perawat_id` |
| `bpjs_transcripts` | Segmen, teks, pembicara, offset | Kepemilikan melalui sesi |
| `bpjs_documents` | Ringkasan, JSON dokumentasi, metadata proses | Kepemilikan melalui sesi |
| `api_credentials` | Label, format, endpoint, model, key terenkripsi | `user_id`; slot `provider_id` + label |
| `chat_messages` | Role, content, provider, session_id, error, waktu | `user_id`; append-only pada jalur RLS pesan |
| `vpn_configs` | Protocol dan konfigurasi terenkripsi | `user_id` |
| `komunikasi_rooms` | Ruangan, token, status aktif | `owner_id` |
| `komunikasi_events` | Pilihan pasien dan detail | `user_id`; input pasien lewat RPC bertoken |
| `app_settings`, `announcements` | Maintenance dan pengumuman | Kebijakan baca konfigurasi; tulis lewat admin |
| `remote_bots`, `remote_providers` | Konfigurasi katalog yang masih ada di schema | Tidak berarti menu CRUD aktif |
| `admin_audit_log` | Aksi admin | Jalur admin; bukan isi percakapan |

RPC `komunikasi_room_info` dan `komunikasi_kirim` memungkinkan akses terbatas berdasarkan token ruangan. Token bukan hak membaca seluruh tabel atau sesi pemilik. Peninjauan izin ruangan harus mempertimbangkan siapa yang memegang tautannya.

Schema mendefinisikan RLS, tetapi keberadaan file SQL tidak membuktikan semua migrasi sudah diterapkan di Supabase produksi. Pemeriksaan database harus memakai metadata dan uji akun terisolasi, tanpa memperluas hak akses data pasien.

### Enkripsi kredensial

`secure_store.js` menggunakan PBKDF2 SHA-256, 100.000 iterasi, AES-GCM 256-bit dan IV acak 12 byte. Material derivasi berasal dari UID dan pepper/salt publik dalam kode. Enkripsi ini mencegah nilai tersimpan sebagai teks biasa, tetapi **bukan end-to-end encryption dengan kunci rahasia yang hanya diketahui pengguna**. RLS dan keamanan akun tetap pengendali akses utama.

Native secure storage berbeda dari derivasi web tersebut. Jangan memasukkan key provider, token agent, service key, refresh token, profil VPN, atau password SSH ke repository, log maupun screenshot laporan publik.

## 8. Mastra dan screenshot di Chat

### 8.1 Tiga jenis credential yang berbeda

| Variabel/format | Fungsi | Dikirim ke mana |
|---|---|---|
| `GOOGLE_API_KEY` | Key model pemilik server contoh | Server Mastra → Google |
| `AI_HUB_AGENT_TOKEN` | Akses adapter Mastra | Client Chat → server Mastra |
| `AI_HUB_DESKTOP_TOKEN` | Akses bridge host | Mastra Docker → bridge Windows |
| `aihub-mastra-v1.…` | Kode AI Hub berisi endpoint, agent ID, token agent | Ditempel pengguna pada Hubungkan Agent |

Kode koneksi bukan API key universal dari Mastra dan base64url bukan enkripsi. Server pihak lain perlu memasang adapter AI Hub. `mastra-test` contoh memakai `google/gemini-2.5-flash`; provider/model agent lain mengikuti pemilik server. Referensi resmi untuk eksplorasi model: [Mastra model router](https://mastra.ai/models).

### 8.2 Kontrak HTTP

| Route internal Mastra | Kegunaan |
|---|---|
| `/ai-hub/health` | Kesehatan integrasi, tanpa key model |
| `/ai-hub/agents/ai-hub/capabilities` | Discovery nama/model/skills, bearer token agent wajib |
| `/ai-hub/agents/ai-hub/chat` | Percakapan terautentikasi, balasan `{ protocol, text }` |
| `/ai-hub/capabilities`, `/ai-hub/chat` | Jalur BYOK lama, tetap terpisah dari koneksi agent baru |

URL dari web Docker menambahkan prefix `/mastra`. nginx hanya meneruskan route integrasi yang diizinkan; Studio/API generik tidak dibuka lewat prefix itu. Port Studio 4111 dipublikasikan hanya di loopback laptop. Token kosong tidak membuat endpoint agent menjadi publik.

Adapter membatasi input 256 KiB, maksimal 100 pesan, maksimal 16.000 karakter per pesan. Tools umum adalah `calculate` dan `current_time`. Memory/tracing bersama tidak dipasang pada contoh agar riwayat tetap dimiliki akun AI Hub. Token contoh berlaku per agent, bukan identitas Supabase yang diverifikasi oleh server Mastra; jangan membagikan token desktop pribadi kepada pihak lain.

### 8.3 Screenshot dan kontrol desktop

`/computer screenshot` diproses langsung oleh adapter setelah autentikasi. Mastra memanggil `host.docker.internal:4112/action`; bridge mendengarkan loopback Windows, memeriksa token terpisah dan masa aktif, lalu mengambil layar utama dengan PowerShell/.NET. Screenshot tersimpan di `mastra-test/.desktop-captures/`.

**Perilaku terbaru:** bridge mengirim PNG ke Mastra melalui respons terautentikasi. Mastra memvalidasi MIME PNG, byte signature, ukuran dan SHA-256, kemudian menyertakan gambar sebagai data URI pada pesan Chat. Renderer menampilkan gambar; ketuk untuk memperbesar/unduh. Tidak diperlukan endpoint gambar publik atau token di URL.

PNG dibatasi **4 MiB**; jika lebih besar, salinan lokal tetap dibuat dan balasan menerangkan bahwa lampiran tidak disertakan. Pembacaan respons bridge dibatasi 6 MiB untuk menampung encoding base64. Data URI menambah ukuran pesan tersimpan, sehingga riwayat bergambar lebih besar daripada teks saja.

Pesan bergambar mengikuti jalur `chat_messages.content` dan kebijakan akun yang sama dengan pesan biasa. Gambar **sekarang meninggalkan laptop menuju client Chat dan penyimpanan riwayat akun jika penyimpanan berhasil**. Jangan menggunakan penjelasan versi awal “gambar hanya ada di laptop” untuk versi ini. Tidak ada Supabase Storage bucket baru atau migrasi schema untuk lampiran.

`chat-content.js` mengganti data gambar dengan penanda teks sebelum riwayat dikirim lagi ke provider. Gambar tetap terlihat/tersimpan, tetapi belum menjadi input vision kepada LLM. Pertanyaan “apa isi screenshot ini?” belum otomatis menghasilkan analisis gambar. Ini juga mencegah satu screenshot membuat pesan lanjutan melampaui limit 16.000 karakter.

Kontrol opsional: `/computer click X Y`, `/computer key TAB|ESC|UP|DOWN|LEFT|RIGHT`. Wajib menyalakan bridge dengan `--allow-control`. Tidak ada shell, input bebas, tombol Enter, atau loop kontrol otonom. Satu aksi per pesan terbaru yang eksplisit; teks model/riwayat tidak mengizinkan aksi. Endpoint BYOK lama tidak mengakses desktop.

## 9. Konfigurasi dan menjalankan sistem

### 9.1 Prasyarat

- Docker Desktop dalam mode Linux containers.
- Internet untuk Supabase, CDN SDK web, provider AI dan download awal image/dependensi.
- Untuk Android native: Flutter/Dart yang cocok dengan manifest, Android SDK, platform-tools/ADB, izin USB debugging.
- Untuk Mastra di host tanpa Docker: Node sesuai `engines` dan npm; dependency lock tersedia.
- Untuk screenshot: sesi desktop Windows aktif, Python, PowerShell dan bridge lokal.
- Untuk tes browser: Python Playwright dan Chrome. Lingkungan tes bukan runtime aplikasi pengguna.

### 9.2 Variabel konfigurasi

| Lokasi | Nama | Pemakaian |
|---|---|---|
| `mastra-test/.env` | `GOOGLE_API_KEY`, `AI_HUB_AGENT_TOKEN` | Model dan akses agent |
| `mastra-test/.env` | `AI_HUB_DESKTOP_TOKEN` | Dibuat bridge pada pemakaian awal jika belum ada |
| `web/.env` | `ASSEMBLYAI_API_KEY` | Key STT server bersama opsional |
| `web/.env` / env admin | `ADMIN_USER`, `ADMIN_PASSWORD`, `SESSION_SECRET` | Login/sesi admin |
| env admin | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Backend admin; service key tidak boleh masuk web public |
| build Flutter | `WEB_HUB_URL` | Override alamat SPA |
| env web/relay | `PORT`, `RELAY_URL`, `RUN_RELAY`, `RELAY_BLOCK_PRIVATE` | Topologi container/deployment |

Konfigurasi Supabase client ada di `web/public/supabase-config.js` dan layanan Supabase native. URL/publishable/anon key client tidak sama dengan service key. Akses tetap bergantung pada Auth/RLS. Dokumen ini tidak menyalin nilainya.

### 9.3 Docker lokal

Dari root proyek:

```powershell
docker compose -f web/docker-compose.yml --profile mastra up -d --build web relay mastra
docker compose -f web/docker-compose.yml --profile mastra ps
```

| Layanan | Akses laptop | Catatan |
|---|---|---|
| Web | `http://localhost:8090` | Port host 8090 → nginx 80 |
| Relay | Via `http://localhost:8090/relay/` | Container internal 8091, tidak dipublikasikan sendiri oleh Compose |
| Mastra Studio | `http://localhost:4111` | Bind host `127.0.0.1` |
| Health Mastra | `http://localhost:8090/mastra/ai-hub/health` | Tidak memerlukan generasi AI |
| Bridge desktop | Loopback host 4112 | Bukan halaman browser; akses hanya request bridge yang terautentikasi |
| Admin opsional | `http://localhost:8095` | Konfigurasi admin harus diisi |

Tanpa Mastra, jalankan service `web relay` saja. Admin dapat dijalankan dengan `docker compose -f web/docker-compose.yml up -d --build admin` setelah konfigurasi siap. Jangan menjalankan build Flutter, Compose build dan instalasi npm bersamaan.

### 9.4 Koneksi Mastra lokal dan desktop

Isi key provider dan token agent di `.env` privat, lalu dari folder `mastra-test`:

```powershell
node --env-file=.env scripts/connection-code.mjs http://localhost:8090/mastra ai-hub laptop.connection.txt
```

Script menolak menimpa file lama. Salin isi kode ke **Hubungkan Agent → Periksa koneksi → Simpan**, kemudian pilih Mastra di Chat. Jika koneksi sudah tersimpan, tidak perlu membuat kode baru hanya karena UI diperbarui.

Dari root, jalankan bridge di terminal tersendiri:

```powershell
python mastra-test/scripts/desktop_bridge.py --minutes 60
```

Setelah token pertama dibuat atau konfigurasi/kode berubah, bangun/muat ulang container dari terminal lain:

```powershell
docker compose -f web/docker-compose.yml --profile mastra up -d --build web mastra
```

Muat ulang Chat dan kirim `/computer screenshot`. Pesan screenshot lama yang hanya berisi path tidak otomatis memperoleh lampiran; kirim perintah baru. Bridge berhenti saat Ctrl+C atau waktu habis. Klik/tombol hanya bila bridge dimulai dengan `--allow-control`.

### 9.5 HP Android melalui USB

```powershell
adb devices
adb reverse tcp:8090 tcp:8090
cd app
flutter pub get
flutter run --dart-define=WEB_HUB_URL=http://localhost:8090
```

Terima dialog USB debugging pada HP. Jika beberapa perangkat, tambahkan `adb -s <serial>` dan `flutter run -d <serial>`. Ulangi reverse setelah kabel/daemon terputus. Untuk fitur web saja, Chrome HP dapat membuka `http://localhost:8090` melalui reverse.

URL Mastra tetap `/mastra` pada origin web, jadi tidak perlu reverse 4111 untuk Chat. Reverse 4111 hanya diperlukan jika ingin membuka Studio di browser HP. Screenshot yang ditampilkan tetap layar **laptop Windows**, bukan layar HP.

Debug Flutter default menunjuk localhost; release default pada kode `WebHubConfig` menunjuk `https://ai-hub-web.fly.dev`. APK release lama tidak otomatis menggunakan Docker lokal. Browser di `http://IP-laptop:8090` lewat LAN bukan secure context Web Crypto; gunakan HTTPS dipercaya perangkat atau jalur USB/localhost.

## 10. Deployment dan pemeliharaan

`web/fly.toml` mendefinisikan app `ai-hub-web`, region `sin`, internal port 8080, HTTPS, mesin shared CPU dengan memori 512 MB dan auto-start/stop. Relay dijalankan dalam container web pada Fly (`RUN_RELAY=1`), dengan blok target jaringan privat (`RELAY_BLOCK_PRIVATE=1`). Ini berbeda dari Compose lokal yang memisahkan service relay agar agent LAN dapat dijangkau.

`admin/fly.toml` mendefinisikan app admin terpisah, port 8095, memori 256 MB, secure cookie dan health check `/healthz`. Service key hanya berada pada konfigurasi rahasia admin. Mastra/bridge laptop tidak otomatis ikut deployment web ini. Docker Linux di cloud juga tidak dapat mengambil layar laptop tanpa bridge yang sengaja disediakan.

Perubahan web dapat diterapkan dengan rebuild/deploy tanpa APK baru jika URL shell tetap sama. Perubahan Dart/plugin/native memerlukan build APK baru. Jangan menyalin `.env`, file kode koneksi, audio, screenshot desktop, atau profil VPN ke image maupun commit. `.desktop-captures` diabaikan oleh Git dan konteks Docker.

Push, deploy Fly, perubahan RLS, dan tindakan database yang sulit dibalik memerlukan konfirmasi sesuai AGENTS.md. Instruksi ini tidak menjalankan deployment. Hindari menyatakan status produksi sama dengan checkout lokal tanpa pemeriksaan terpisah.

## 11. Pengujian dan bukti

### Perintah pengujian

```powershell
python web/tests/ui_smoke.py
python web/tests/mastra_skills_smoke.py
python web/tests/desktop_bridge_test.py
node --test web/tests/chat-content.test.mjs
python web/tests/mastra_desktop_live.py --screenshot
```

Tes live terakhir memakai model Google/bridge nyata tetapi account/history fixture. Tidak menulis data pasien atau login ke Supabase nyata. Tes fixture menguji request dan UI, bukan validitas semua key/provider layanan luar.

```powershell
cd mastra-test
npm run typecheck
npm test
npm run build
```

Untuk perubahan native, jalankan sesuai aturan proyek:

```powershell
cd app
flutter analyze --no-pub
flutter test --no-pub
```

### Bukti pada pembaruan screenshot ini

| Pemeriksaan | Hasil/batas |
|---|---|
| Typecheck Mastra | Lulus |
| Tes Node Mastra | 15 lulus, termasuk validasi PNG/hash/ukuran |
| Tes bridge | 4 lulus, termasuk pengiriman byte dan batas 4 MiB |
| Tes sanitasi konteks chat | 2 lulus; base64 tidak dikirim sebagai prompt teks |
| Browser skills/provider | Lulus dengan fixture |
| Chat live Mastra → Gemini | Hitungan awal 42 dan sesudah screenshot 72, HTTP 200 |
| Screenshot live | PNG tampil dan lightbox terbuka di browser Chat |
| Riwayat/Supabase nyata | Penyimpanan memakai jalur content yang ada; belum diuji ulang dengan akun Supabase nyata pada pembaruan ini |
| Native speech/VPN/SSH | Tidak diuji ulang pada pembaruan screenshot; perlu perangkat dan konfigurasi nyata |

Tes sebelumnya pada tugas 20 Oktober mencakup 13 halaman × empat ukuran, pemanggilan native BPJS/Anamnesis dan skala/lokasi Papan dengan fixture. Jangan memperluas bukti itu menjadi klaim STT/diagnosis akurat atau semua bot sudah diuji end-to-end di HP.

## 12. Evaluasi akademik PA

Paket di [docs/PAKET-UJI-PA/README.md](docs/PAKET-UJI-PA/README.md) berisi 12 dialog fiktif, 36 slot rekaman, 72 penugasan catatan, fakta acuan, rubrik dan lembar hasil kosong. Kondisi meliputi tenang, bising kipas, dan suara pelan dengan jarak lebih jauh. Ini rancangan studi kecil yang perlu ditinjau perawat/dosen, bukan dataset audio yang sudah direkam.

Bandingkan baseline STT saja dengan proposed STT + LLM memakai transkrip yang sama. Ukur WER terhadap referensi manual, ketepatan peran, kelengkapan fakta, kesesuaian isi, konsistensi faktual, koreksi perawat dan waktu proses/kerja. Nilai draf awal serta catatan final secara terpisah. Ringkasan tidak dinilai memakai WER karena memang memadatkan kata.

Skenario sengaja memuat negasi, angka yang dikoreksi, tidak tahu, pasien bertanya, perawat mengulang, jeda dan overlap. Jangan menganggap “tidak disebutkan” sebagai normal, “tidak tahu” sebagai tidak, atau diam sebagai jawaban. Mastra screenshot, VPN dan Papan adalah pengujian fungsional pendukung; bukan substitusi eksperimen utama speech.

Bekukan versi kode/model/prompt sebelum rekaman utama. Jangan mengisi angka keberhasilan dari perkiraan. Verifikasi diagnosis tetap oleh dokter di luar aplikasi, tanpa membuat label diagnosis otomatis dalam dataset keluaran AI.

## 13. Masalah umum dan penanganan

| Gejala | Pemeriksaan/tindakan |
|---|---|
| Web/Mastra tidak terbuka | `docker compose ... ps`; cek port dan service yang dijalankan |
| `/mastra` 502 | Service Mastra belum hidup/siap; profil Mastra belum dijalankan |
| Token agent 401/403 | Cocokkan token server/kode koneksi; token model bukan token agent |
| Screenshot hanya path | Muat ulang web, restart bridge versi baru, rebuild Mastra; kirim perintah baru |
| Desktop tidak tersedia | Bridge aktif? Belum kedaluwarsa? Token host sudah termuat dalam container? |
| Lampiran terlalu besar | PNG lebih dari 4 MiB; gunakan salinan lokal yang disebutkan |
| Model tidak tahu isi screenshot | Lampiran untuk dilihat pengguna; input vision belum terintegrasi |
| Setelah screenshot chat ditolak | Pastikan frontend baru memuat `chat-content.js`; base64 tidak boleh menjadi prompt teks |
| Skills tidak sesuai | `/skills`; cek format/model dan discovery, bukan nama vendor saja |
| Key ditolak atau kuota habis | Bedakan autentikasi 401/403, kuota 429, model tidak tersedia dan jaringan |
| STT gagal | Izin mikrofon, audio, jaringan, key AssemblyAI bersama/pribadi; catat kegagalan sebelum retry |
| Suara Papan diam | Native TTS/voice bahasa Indonesia; browser TTS berbeda dari perangkat |
| HP membuka versi lama | Periksa `WEB_HUB_URL`; APK release mungkin menunjuk Fly |
| VPN terlihat aktif di browser | Bisa berupa fallback pengembangan; verifikasi tunnel pada Android |
| Admin gagal login | Password tidak boleh kosong; konfigurasi secret/cookie dan service key server |
| Menyimpan key lewat IP LAN gagal | Secure context Web Crypto: HTTPS atau localhost melalui USB |

## 14. Batas implementasi dan tindak lanjut

- Belum ada klaim uji produksi menyeluruh, validitas klinis, kepatuhan regulasi atau keamanan menyeluruh dari dokumen ini.
- RLS cloud tidak otomatis menyelesaikan cache perangkat, kebocoran log, salah konfigurasi relay, atau pembagian token agent. Area tersebut perlu uji khusus sebelum pemakaian data nyata.
- Riwayat screenshot berbentuk base64 dalam kolom teks menambah ukuran query/penyimpanan. Untuk skala besar perlu rancangan lampiran privat dengan retensi dan penghapusan yang konsisten; itu belum diimplementasikan.
- `saveMessage` masih mengikuti jalur penyimpanan lama; pesan yang terlihat di layar tidak sendirinya membuktikan write cloud berhasil. Verifikasi refresh/riwayat pada akun uji nyata sebelum mengklaim persistensi end-to-end.
- Token Mastra contoh bukan token per pengguna, memory agent bersama tidak dipakai, computer use belum vision/otonom, dan bridge host harus aktif.
- Sebagian PRD/naskah Drive menyebut dikte, Whisper dan parameter belum diisi. Gunakan [telaah keselarasan](docs/TELAAH-SPEECH-DAN-PA-2026-10-20.md), bukan mengimplementasikan fitur lama yang bertentangan dengan pagar PA.

## 15. Rujukan internal dan tata kerja

| Kebutuhan | Dokumen/kode |
|---|---|
| Setup cepat dan HP | [README.md](README.md) |
| Arsitektur/fitur aktual | File sumber pada setiap bab di atas |
| Aturan PA dan kepemilikan | [AGENTS.md](AGENTS.md) |
| Kontrak Mastra | [docs/MASTRA-KONEKSI.md](docs/MASTRA-KONEKSI.md) |
| Desktop dan checklist HP | [docs/MASTRA-DESKTOP-DAN-UJI.md](docs/MASTRA-DESKTOP-DAN-UJI.md) |
| Keputusan desain | [docs/KEPUTUSAN.md](docs/KEPUTUSAN.md) |
| Serah terima antaragen | [docs/HANDOFF.md](docs/HANDOFF.md) |
| Dataset/protokol uji | [docs/PAKET-UJI-PA/README.md](docs/PAKET-UJI-PA/README.md) |
| Indeks dokumen lain | [docs/README.md](docs/README.md) |

Codex menangani web, tes web, dan deployment web; Claude memegang native, schema/RLS, admin dan dokumen akademik sesuai AGENTS.md. Otorisasi tugas tertentu dapat mengalihkan kepemilikan sementara dan dicatat di HANDOFF. Perubahan screenshot ini tidak mengubah native, admin atau RLS. Dokumen root ini disusun dari kode yang dibaca, tanpa menyalin nilai rahasia atau konten pasien.
