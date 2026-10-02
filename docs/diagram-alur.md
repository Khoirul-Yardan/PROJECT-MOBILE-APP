# Diagram Alur — AI Hub (PROJECT MOBILE APP)

> Dokumen ini dibuat dengan membaca kode sumber langsung (bukan asumsi) per **2 Oktober 2026**, commit `2423dac`. Semua diagram pakai [Mermaid](https://mermaid.js.org/) — buka file ini di Obsidian, GitHub, atau editor Markdown apa pun yang mendukung Mermaid untuk melihat visualnya.
>
> Status tiap alur ditandai: ✅ **Fungsional** (diverifikasi dengan data sungguhan, bukan cuma baca kode) · 🟡 **Parsial** (jalan tapi ada batasan) · 🔴 **Simulasi/belum ada**.

## Daftar Isi

1. [Tech Stack](#1-tech-stack)
2. [Arsitektur Sistem](#2-arsitektur-sistem)
3. [Skema Database](#3-skema-database)
4. [Alur Autentikasi & Startup](#4-alur-autentikasi--startup)
5. [Alur Chat AI / Agent](#5-alur-chat-ai--agent)
6. [Alur Universal API Key (Deteksi Otomatis)](#6-alur-universal-api-key-deteksi-otomatis)
7. [Alur Bot BPJS — End to End](#7-alur-bot-bpjs--end-to-end)
8. [Alur Export & Bagikan Dokumentasi](#8-alur-export--bagikan-dokumentasi)
9. [Alur VPN](#9-alur-vpn)
10. [Alur Activity Log](#10-alur-activity-log)
11. [Native Bridge (Web ⇄ Flutter)](#11-native-bridge-web--flutter)
12. [Deployment](#12-deployment)
13. [Ringkasan Status Fitur](#13-ringkasan-status-fitur)

---

## 1. Tech Stack

```mermaid
mindmap
  root((AI Hub))
    Native Shell (Flutter)
      Dart ^3.13.3
      supabase_flutter ^2.17.2
      webview_flutter ^4.14.1
      flutter_secure_storage ^9.2.2
      wireguard_flutter ^0.1.3
      speech_to_text ^7.5.0
      cryptography ^2.9.0
      http ^1.2.2
      pdf ^3.13.1 + printing ^5.14.3
      docx_creator ^1.4.0
      share_plus ^11.1.0
      path_provider ^2.1.6
    Web SPA
      Vanilla JS (ES Modules, tanpa framework/bundler)
      Supabase JS v2 (CDN)
      Web Crypto API (AES-GCM + PBKDF2)
      CSS murni, tanpa Tailwind/preprocessor
    Backend
      Supabase Auth
      PostgreSQL + Row Level Security
      Supabase Realtime
    Deployment
      Docker
      nginx 1.27-alpine
      docker-compose, port host 8090
    Integrasi Eksternal
      OpenAI API
      Anthropic API
      Google Gemini API
      OpenRouter API
      Hermes (Nous Research, OpenAI-compatible)
      OpenClaw self-hosted gateway
```

| Lapisan | Teknologi | Versi | Peran |
|---|---|---|---|
| Native shell | Flutter / Dart | SDK `^3.13.3` | Splash screen, WebView persisten, Bot BPJS (mic/STT), VPN tunnel, secure storage |
| Native — Supabase | `supabase_flutter` | `^2.17.2` | Mirror sesi untuk `activity_log`, baca/tulis `bpjs_*` dari Bot BPJS |
| Native — WebView | `webview_flutter` | `^4.14.1` | Merender SPA web di dalam shell |
| Native — storage | `flutter_secure_storage` | `^9.2.2` | Simpan config VPN lokal (Keystore/Keychain) |
| Native — VPN | `wireguard_flutter` | `^0.1.3` | Tunnel WireGuard sungguhan via Android `VpnService` |
| Native — STT | `speech_to_text` | `^7.5.0` | Speech-to-text on-device untuk Bot BPJS |
| Native — kripto | `cryptography` | `^2.9.0` | Dekripsi kredensial AES-GCM (mirror dari Web Crypto) |
| Native — PDF | `pdf` + `printing` | `^3.13.1` / `^5.14.3` | Generate dokumen PDF dari draf Bot BPJS |
| Native — DOCX | `docx_creator` | `^1.4.0` | Generate dokumen Word (.docx) murni Dart, tanpa dependency native |
| Native — share | `share_plus` | `^11.1.0` | Buka share sheet OS (WhatsApp, email, dll) untuk file hasil ekspor |
| Web SPA | Vanilla JS ES Modules | — | Seluruh UI aplikasi (10+ halaman), tanpa build step |
| Web — Supabase | `@supabase/supabase-js@2` | CDN | Auth, query Postgres via REST, Realtime subscription |
| Web — kripto | Web Crypto API (`crypto.subtle`) | native browser | Enkripsi kredensial AI sebelum disimpan ke Supabase |
| Backend | Supabase | — | Auth, PostgreSQL, Row Level Security, Realtime |
| Web server | nginx | `1.27-alpine` | Sajikan static files SPA, `Cache-Control: no-store` untuk `.js/.html` |
| Container | Docker Compose | — | 1 service `web`, port host `8090` → container `80` |

**Catatan arsitektur penting**: `web/` di root project adalah SPA aktif yang disajikan nginx. `app/web/` (di dalam folder Flutter) adalah output build target Flutter-web bawaan, **tidak dipakai** — container nginx tidak menyalin folder itu.

---

## 2. Arsitektur Sistem

```mermaid
flowchart TD
    User["👤 Pengguna\n(Perawat / Dokter / Umum)"]

    subgraph Native["📱 Flutter Native Shell"]
        Splash["SplashScreen"]
        Shell["WebShellScreen\n(WebViewController persisten)"]
        BotBpjs["BotBpjsScreen\n(100% native)"]
        Bridge["NativeBridge\n(postMessage JSON)"]
        SecureStorage["FlutterSecureStorage\n(VPN config)"]
        WireGuard["WireGuard Plugin\n(VpnService Android)"]
        STT["speech_to_text\n(on-device)"]
        NativeSupabase["Supabase Client (native)\n(mirror sesi)"]
    end

    subgraph DockerWeb["🐳 Docker: nginx (port 8090)"]
        SPA["SPA AI Hub\n(index.html + ES Modules)"]
    end

    subgraph Cloud["☁️ Supabase Cloud"]
        Auth["Auth\n(email/password)"]
        DB[("PostgreSQL\n+ Row Level Security")]
        Realtime["Realtime\n(postgres_changes)"]
    end

    subgraph External["🌐 Provider/Agent AI Eksternal"]
        OpenAI["OpenAI API"]
        Anthropic["Anthropic API"]
        Gemini["Google Gemini API"]
        OpenRouter["OpenRouter API"]
        Hermes["Hermes (Nous Research)"]
        OpenClaw["OpenClaw Gateway\n(self-hosted)"]
    end

    User --> Splash --> Shell
    Shell -->|load URL| SPA
    SPA <-->|Supabase JS SDK| Auth
    SPA <-->|Supabase JS SDK| DB
    SPA <-->|subscribe| Realtime
    SPA -->|fetch() langsung, tanpa server AI Hub| OpenAI
    SPA --> Anthropic
    SPA --> Gemini
    SPA --> OpenRouter
    SPA --> Hermes
    SPA --> OpenClaw

    SPA <-->|postMessage / __nativeReply| Bridge
    Bridge --> SecureStorage
    Bridge --> WireGuard
    Shell -->|tombol tab VPN/Bot| BotBpjs
    BotBpjs --> STT
    BotBpjs -->|dekripsi kredensial + panggil LLM langsung| External
    BotBpjs <-->|query/insert, RLS aktif| NativeSupabase
    NativeSupabase <--> DB

    style Native fill:#1e293b,color:#fff
    style DockerWeb fill:#0f4c3a,color:#fff
    style Cloud fill:#1a3a5c,color:#fff
    style External fill:#4a2c1a,color:#fff
```

**Poin kunci:**
- **Tidak ada server aplikasi AI Hub khusus.** Container nginx hanya menyajikan file statis (HTML/CSS/JS) — bukan proxy API, bukan worker pemrosesan.
- Web SPA memanggil provider AI **langsung dari browser/WebView** (`fetch()` ke `api.openai.com`, dst.) — kunci API didekripsi sesaat sebelum dipakai, tidak pernah lewat server perantara.
- Flutter shell hanya menangani hal yang **wajib native**: mikrofon (Bot BPJS), tunnel VPN (WireGuard butuh `VpnService` Android), dan secure storage config VPN.
- `NativeBridge` adalah **satu-satunya** jalur komunikasi Web ↔ Flutter — transport `postMessage` (Web→Native) dan `window.__nativeReply`/`__nativeEvent` (Native→Web).

---

## 3. Skema Database

```mermaid
erDiagram
    auth_users ||--|| profiles : "1:1"
    auth_users ||--o{ activity_log : "memiliki"
    auth_users ||--o{ api_credentials : "memiliki"
    auth_users ||--o{ bpjs_sessions : "perawat"
    bpjs_sessions ||--o{ bpjs_transcripts : "1:N"
    bpjs_sessions ||--o{ bpjs_documents : "1:N"

    profiles {
        uuid id PK "= auth.users.id"
        text display_name
        text role "general|perawat|dokter"
        text bio
    }
    activity_log {
        uuid id PK
        uuid user_id FK
        text category "AI|Agents|Bots|VPN|System"
        text title
        text badge "Success|Info|Error"
    }
    api_credentials {
        uuid id PK
        uuid user_id FK
        text provider_id
        text label
        text type "chat|agent"
        text format "openai|anthropic|gemini|openclaw"
        text endpoint
        text model
        text encrypted_key "AES-GCM ciphertext"
        text iv
    }
    bpjs_sessions {
        uuid id PK
        uuid perawat_id FK
        text dokter_nama "diketik manual, bukan akun"
        text dokter_instansi "opsional"
        text pasien_nama
        text status "recording|processing|siap_dikirim|terkirim"
    }
    bpjs_transcripts {
        uuid id PK
        uuid session_id FK
        text speaker "perawat|pasien"
        text text_segment
        int timestamp_offset_ms
    }
    bpjs_documents {
        uuid id PK
        uuid session_id FK
        text ringkasan
        jsonb dokumentasi_terstruktur
        jsonb alur_percakapan
        text generated_by_llm_provider
    }
```

**6 tabel total**, semua dengan **Row Level Security aktif**. Sejak **Friend System dihapus (2 Okt 2026)** — tabel `friendships`, `messages`, dan `bpjs_reviews` tidak lagi ada; `bpjs_sessions.dokter_id` (FK ke `auth.users`) diganti `dokter_nama`+`dokter_instansi` (teks bebas, seperti mengisi form rujukan manual). Aturan RLS yang paling penting (bukan sekadar "user hanya lihat miliknya"):

| Tabel | Aturan RLS kunci |
|---|---|
| `bpjs_sessions` | CRUD penuh hanya oleh `perawat_id` pemilik baris — tidak ada lagi syarat relasi dengan akun lain |
| `bpjs_transcripts` / `bpjs_documents` | Insert & select hanya oleh `perawat_id` pemilik sesi induk |
| `api_credentials` | CRUD penuh hanya oleh `user_id` pemilik baris — tidak ada akses lintas user sama sekali |
| `activity_log` | Append-only: ada policy `insert`+`select`, **tidak ada** policy `update`/`delete` |

---

## 4. Alur Autentikasi & Startup

```mermaid
sequenceDiagram
    participant U as Pengguna
    participant F as Flutter (main.dart)
    participant W as WebView (SPA)
    participant S as Supabase

    U->>F: Buka aplikasi
    F->>F: WidgetsFlutterBinding.ensureInitialized()
    F->>S: SupabaseService.init() (best-effort, native mirror)
    F->>F: SplashScreen tampil ±1200ms
    F->>W: pushReplacementNamed('/shell') → WebShellScreen
    W->>W: WebViewController dibuat, JS diaktifkan, NativeBridge dipasang
    W->>W: index.html load SDK Supabase (CDN) + app.js
    W->>S: sb.auth.getSession()
    alt Belum login
        S-->>W: session = null
        W->>U: Tampilkan #/login
        U->>W: Isi email + password, submit
        W->>S: signInWithPassword() / signUp()
        S-->>W: session + refresh_token
        W->>F: Native.notifySession(refresh_token)
        F->>S: client.auth.setSession(refresh_token) (native mirror)
        W->>U: Redirect ke #/home
    else Sudah login
        S-->>W: session aktif
        W->>U: Tampilkan #/home
    end
```

**Status: ✅ Fungsional** — diverifikasi dengan signup, login, dan persistensi sesi nyata via REST API.

**Detail penting:**
- Guard router (`app.js`) mengecek sesi di **setiap render**: belum login + bukan `/login` → redirect ke `/login`; sudah login + buka `/login` → redirect ke `/home`.
- `onAuthStateChange` bisa fire lebih dari sekali saat startup (`INITIAL_SESSION` lalu event lain) — pernah menyebabkan **bug render dobel** (lihat §13), sudah diperbaiki dengan `renderToken` di `router.js`.
- Validasi lokal: email harus mengandung `@`, password minimal 6 karakter — keputusan auth sesungguhnya tetap dari Supabase.

---

## 5. Alur Chat AI / Agent

```mermaid
flowchart TD
    Start["Pengguna buka /chat"] --> LoadPicker["loadPicker():\nlistRegisteredProviders()"]
    LoadPicker --> HasProvider{Ada provider\nterhubung?}
    HasProvider -->|Tidak| EmptyState["Tampilkan chip:\n+ Hubungkan Provider AI\n+ Hubungkan Agent"]
    HasProvider -->|Ya| ShowChips["Tampilkan chip semua provider/agent\n(ChatGPT, Hermes, dst — setara)"]
    ShowChips --> SelectEntry["User pilih satu entry"]
    SelectEntry --> TypeMsg["User ketik pesan atau /skill"]
    TypeMsg --> IsSkill{Diawali '/'?}
    IsSkill -->|Ya| RunSkill["/system, /clear, /help\n(lokal, tanpa API call)"]
    IsSkill -->|Tidak| SendChat["sendChat(entry, history)"]
    SendChat --> GetKey["getCredentialKey(provider_id)\n← dekripsi AES-GCM"]
    GetKey --> Format{entry.format}
    Format -->|openai| CallOpenAI["POST .../chat/completions\n(OpenAI, OpenRouter, Hermes, dsb)"]
    Format -->|anthropic| CallClaude["POST .../messages\n(x-api-key header)"]
    Format -->|gemini| CallGemini["POST .../generateContent?key=...\n"]
    Format -->|openclaw| CallOpenClaw["POST gateway kustom\n(session-based, bukan full history)"]
    CallOpenAI --> ShowReply["Tampilkan balasan"]
    CallClaude --> ShowReply
    CallGemini --> ShowReply
    CallOpenClaw --> ShowReply
    ShowReply --> LogActivity["logActivity(category:'AI')"]
```

**Status: 🟡 Parsial** — kode lengkap dan adapter 4 format terverifikasi benar secara logic, tapi **butuh API key asli milik pengguna** untuk benar-benar memanggil provider (bring-your-own-key, bukan bug).

---

## 6. Alur Universal API Key (Deteksi Otomatis)

```mermaid
flowchart TD
    Paste["User tempel API key\ndi satu kolom (tanpa pilih provider dulu)"] --> Detect["detectProvider(rawKey)"]
    Detect --> Match{Cocok regex\nKNOWN_PROVIDERS?}
    Match -->|sk-... tanpa prefix vendor| OpenAI["ChatGPT (OpenAI)"]
    Match -->|sk-ant-...| Claude["Claude (Anthropic)"]
    Match -->|AIzaSy... / AQ....| GeminiD["Gemini (Google)"]
    Match -->|sk-or-v1-...| OR["OpenRouter"]
    Match -->|sk-nous-...| HermesD["Hermes (Nous Research)"]
    Match -->|Tidak cocok apa pun| Manual["Tampilkan quick-pick dari katalog\n+ opsi 'API/agent lain' (form manual)"]
    OpenAI --> Save
    Claude --> Save
    GeminiD --> Save
    OR --> Save
    HermesD --> Save
    Manual --> FillForm["User isi: nama, jenis, endpoint, model"]
    FillForm --> Save
    Save["saveCredential(entry, apiKey)"] --> Encrypt["PBKDF2-SHA256 (100k iterasi)\n→ turunkan AES-256-GCM key\ndari UID + pepper"]
    Encrypt --> EncryptValue["AES-GCM encrypt(apiKey)"]
    EncryptValue --> Upsert["UPSERT api_credentials\n(encrypted_key, iv — bukan plaintext)"]
    Upsert --> Done["Provider/agent muncul di Chat\nsebagai chip baru"]
```

**Status: ✅ Fungsional** — diverifikasi dengan test regex (6/6 pola lolos setelah bug diperbaiki) dan round-trip enkripsi sungguhan (encrypt → simpan → baca → dekripsi → plaintext identik).

**Bug yang ditemukan & diperbaiki (1 Okt 2026)**: pola regex OpenAI awalnya `/^sk-(proj-)?[A-Za-z0-9_-]{20,}$/` — terlalu rakus, ikut menangkap `sk-ant-...`, `sk-or-v1-...`, `sk-nous-...` karena semua diawali `sk-`. Diperbaiki dengan negative lookahead `(?!ant-|or-v1-|nous-)`.

**Keamanan kunci**: AES-GCM key diturunkan dari `UID + pepper` via PBKDF2, bukan secret independen seperti Keystore asli perangkat. **Row Level Security tetap kontrol akses sesungguhnya** — enkripsi ini defense-in-depth kalau tabel pernah ter-expose lewat jalur lain (dashboard screen-share, CSV export, dsb).

---

## 7. Alur Bot BPJS — End to End

```mermaid
sequenceDiagram
    actor Perawat
    participant App as BotBpjsScreen (native)
    participant STT as speech_to_text
    participant DB as Supabase (RLS)
    participant LLM as Provider/Agent AI

    Perawat->>App: Tekan "Ucapkan Halo Jarvis"
    App->>STT: initialize() + minta izin mikrofon
    alt Izin ditolak / tidak didukung
        STT-->>App: false
        App->>Perawat: Tampilkan "Izin mikrofon diperlukan"
    else Izin diberikan
        App->>Perawat: Dialog "Nama pasien?"
        Perawat->>App: Isi nama
        App->>Perawat: Dialog "Dokumentasi untuk dokter siapa?"\n(nama + instansi, teks bebas — seperti form rujukan)
        Perawat->>App: Isi nama dokter + instansi (opsional)
        App->>STT: listen(localeId:'id_ID', partialResults:true)
        loop Selama merekam
            STT-->>App: onResult(recognizedWords, finalResult)
            App->>App: Tambahkan ke _segments[] saat finalResult
        end
        Perawat->>App: Tekan "Hentikan Sesi"
        App->>DB: createSession(dokter_nama, dokter_instansi, pasien_nama)
        Note right of DB: RLS: hanya butuh perawat_id = auth.uid()\n— tidak ada syarat relasi dengan akun lain
        App->>DB: addTranscriptSegment() × N segmen
        App->>App: fetchAcceptedCredential() → dekripsi AES-GCM (native)
        App->>LLM: generateDocumentation(transcript)\n(format sesuai provider: openai/anthropic/gemini)
        alt LLM berhasil
            LLM-->>App: JSON {ringkasan, keluhan_utama, ...}
        else LLM gagal / tidak ada provider
            App->>App: Fallback: transkrip mentah + catatan
        end
        App->>DB: saveDocumentation() + markStatus('siap_dikirim')
        App->>Perawat: Tampilkan draf + tombol Salin/Ekspor PDF/DOCX
        Note over Perawat: Lihat §8 untuk alur ekspor & bagikan
    end
```

**Status: ✅ Fungsional (dirombak total 2 Okt 2026)** — diverifikasi end-to-end dengan data sungguhan via REST API (buat sesi tanpa akun dokter → transcript → dokumentasi → tandai terkirim).

| Bagian | Status | Keterangan |
|---|---|---|
| Rekam suara → teks (STT) | ✅ Fungsional | `speech_to_text` on-device, `localeId: 'id_ID'`, auto-restart saat jeda |
| Target dokter | ✅ Fungsional | Nama + instansi diketik manual, **tidak butuh akun dokter atau pertemanan** |
| Simpan sesi/transkrip/dokumen | ✅ Fungsional | RLS: cukup `perawat_id = auth.uid()`, tidak ada syarat relasi lain |
| Generate dokumentasi via LLM | ✅ Fungsional (jika ada API key) | Pakai kredensial yang sudah didekripsi native; fallback transkrip mentah jika tak ada provider |
| Salin teks / ekspor PDF & DOCX | ✅ Fungsional | Lihat §8 — inilah cara dokumentasi sampai ke dokter |
| **Wake word "Halo Jarvis"** | 🔴 Simulasi | Deteksi suara terpicu tombol, bukan listening pasif sungguhan |
| **Speaker diarization** (pisah suara perawat/pasien) | 🔴 Belum ada | Semua segmen ditandai `speaker: 'perawat'` — butuh model diarization terpisah |
| **Text-to-Speech balasan Jarvis** | 🔴 Belum ada | Tidak ada output suara dari aplikasi |

**Perubahan arsitektur penting (2 Okt 2026)**: sebelumnya alur ini mensyaratkan pertemanan (`friendships.status = 'accepted'`) antara perawat dan dokter, dan dokter meninjau draf dari akunnya sendiri di web (`bpjs-review.js` versi lama). Kedua hal itu **dihapus total** atas permintaan eksplisit pengguna. Sekarang dokter tidak perlu akun atau hubungan pertemanan apa pun — perawat cukup mengetik nama/instansi dokter seperti mengisi form rujukan kertas, lalu mengirimkan hasilnya sendiri lewat salin-teks atau file (§8). Ini menyederhanakan alur secara signifikan dan menghilangkan satu titik kegagalan (dokter harus follow-approve dulu sebelum dokumentasi bisa dibuat).

---

## 8. Alur Export & Bagikan Dokumentasi

```mermaid
flowchart TD
    Review["Perawat di layar Review\n(stage: review, setelah LLM selesai)"] --> Choice{Pilih aksi}
    Choice -->|Salin Teks| CopyText["BpjsExport.plainText()\n→ Clipboard.setData()"]
    Choice -->|Ekspor PDF| BuildPdf["BpjsExport.buildPdf()\npackage: pdf (pw.Document)"]
    Choice -->|Ekspor DOCX| BuildDocx["BpjsExport.buildDocx()\npackage: docx_creator"]
    CopyText --> MarkSent["markStatus(session, 'terkirim')"]
    BuildPdf --> SaveTemp1["Simpan ke temp dir\n(path_provider)"]
    BuildDocx --> SaveTemp2["Simpan ke temp dir\n(path_provider)"]
    SaveTemp1 --> ShareSheet["share_plus:\nbuka share sheet OS"]
    SaveTemp2 --> ShareSheet
    ShareSheet --> AppPicker["Perawat pilih aplikasi\n(WhatsApp, Email, Drive, dll)"]
    AppPicker --> MarkSent
    MarkSent --> Done["Dokter menerima dokumentasi\ndi luar aplikasi — perawat yang mengirim langsung"]
```

**Status: ✅ Fungsional** — ketiga jalur (salin teks, PDF, DOCX) memakai data draf + transkrip yang sama persis dengan yang ditampilkan di layar Review, sehingga isinya konsisten dengan apa yang perawat lihat sebelum membagikan.

| Jalur | Mekanisme | Keterangan |
|---|---|---|
| Salin Teks | `Clipboard.setData()` | Teks polos siap tempel ke WhatsApp/Email — paling cepat, tidak perlu aplikasi lain terbuka |
| Ekspor PDF | `pdf` (`pw.Document`) + `printing`/`share_plus` | Dokumen berformat dengan header, field terstruktur, transkrip |
| Ekspor DOCX | `docx_creator` (murni Dart, tanpa native binding) | File Word yang bisa diedit dokter sebelum disimpan ke rekam medis |

**Mengapa tidak ada lagi "kirim ke akun dokter"**: pendekatan lama (dokter login, lihat draf, kasih verdict) butuh dokter sudah punya akun aplikasi dan sudah berteman dengan perawat — dua syarat yang menghambat penggunaan nyata di lapangan (dokter sering tidak pakai aplikasi ini). Pendekatan baru meniru alur kerja nyata rumah sakit: dokumentasi dibuat, lalu **perawat mengirimkannya sendiri** ke dokter lewat kanal komunikasi yang sudah dipakai sehari-hari (WhatsApp, email, dicetak), persis seperti form rujukan kertas.

---

## 9. Alur VPN

```mermaid
flowchart TD
    OpenVpn["User buka /vpn"] --> GetConfig["Native.getVpnConfig()"]
    GetConfig --> HasConfig{Config\ntersimpan?}
    HasConfig -->|Tidak| PromptAdd["Arahkan ke /vpn-config\nuntuk isi server"]
    HasConfig -->|Ya| ShowStatus["Tampilkan protocol + endpoint"]
    PromptAdd --> FillForm["User isi field sesuai protokol:\nWireGuard / OpenVPN / SSH"]
    FillForm --> SaveConfig["Native.saveVpnConfig(config)\n→ FlutterSecureStorage"]
    SaveConfig --> ShowStatus
    ShowStatus --> Connect["User tekan 'Connect'"]
    Connect --> Protocol{Protokol?}
    Protocol -->|WireGuard| RealTunnel["VpnTunnelService.connect()\n→ wireguard_flutter\n→ Android VpnService AKTIF"]
    Protocol -->|OpenVPN / SSH| FakeConnect["Native hanya balas {connected:true}\nTIDAK ada tunnel nyata"]
    RealTunnel --> LogVpn["logActivity(category:'VPN')"]
    FakeConnect --> LogVpn
```

**Status: 🟡 Parsial** — WireGuard **sungguhan** (tunnel nyata via `VpnService`), OpenVPN/SSH masih **config-only** (field tersimpan, tapi tombol Connect tidak benar-benar mengalihkan trafik — aplikasi jujur menampilkan catatan ini ke user).

---

## 10. Alur Activity Log

```mermaid
flowchart LR
    Action["Aksi pengguna\n(login, chat, bot, vpn)"] --> LogCall["logActivity({category, title, badge})"]
    LogCall --> Insert["INSERT activity_log\n(best-effort, tidak pernah throw)"]
    Insert --> RT["Realtime channel\n'activity-log-changes-*'"]
    RT --> ViewUpdate["Halaman /settings/activity\nauto-refresh"]
    Insert -.->|RLS: append-only| NoUpdate["❌ Tidak ada policy UPDATE/DELETE\n— log tidak bisa diubah/dihapus dari client"]
```

**Status: ✅ Fungsional** — insert + realtime subscription diverifikasi. Kategori: `AI`, `Agents`, `Bots`, `VPN`, `System`.

---

## 11. Native Bridge (Web ⇄ Flutter)

```mermaid
sequenceDiagram
    participant Web as SPA (bridge.js)
    participant Native as Flutter (NativeBridge handler)

    Note over Web,Native: Transport: NativeBridge.postMessage(JSON)\nBalasan: window.__nativeReply(id, json)\nEvent: window.__nativeEvent(type, json)

    Web->>Native: {id, type:'get_vpn_config', payload:{}}
    Native-->>Web: __nativeReply(id, configJson)

    Web->>Native: {id, type:'vpn_connect'}
    Native-->>Web: __nativeReply(id, {connected:true})

    Web->>Native: {id, type:'open_bot_bpjs'}
    Native->>Native: Navigator push BotBpjsScreen

    Web->>Native: {type:'session_changed', payload:{refresh_token}}
    Note right of Native: Native mirror Supabase session\n(untuk Bot BPJS logActivity)

    Web->>Native: {id, type:'sign_out'}
    Native-->>Web: __nativeReply(id, {})

    Note over Web: Jika tidak ada bridge (browser biasa, dev mode):\nVPN config fallback ke localStorage (insecure, dev-only)\nPanggilan lain (sign_out, open_bot_bpjs) di-ignore + warning
```

**Timeout**: setiap panggilan native punya batas 8 detik (`CALL_TIMEOUT_MS`) — jika native tidak membalas, Promise resolve `null` alih-alih menggantung selamanya.

---

## 12. Deployment

```mermaid
flowchart TD
    Dev["Developer"] -->|docker compose up -d --build| Build["Docker build:\nFROM nginx:1.27-alpine\nCOPY public/ → /usr/share/nginx/html/"]
    Build --> Container["Container: ai-hub-web\nPort host 8090 → container 80"]
    Container --> Serve["nginx menyajikan SPA\nCache-Control: no-store untuk .js/.html"]
    Serve --> Browser["Browser / WebView mengakses\nhttp://localhost:8090"]

    FlutterApp["Flutter app (Android/iOS/Desktop)"] -->|WebViewController.loadUrl| Serve

    subgraph Prod["Untuk produksi (belum diimplementasi)"]
        Note1["URL web perlu di-host publik\n(bukan localhost) agar device fisik\nbisa mengaksesnya"]
    end
```

**Konfigurasi kunci `nginx.conf`:**
- `Access-Control-Allow-Origin: *` — supaya SPA bisa dibuka langsung dari browser biasa saat development (di luar WebView).
- `Cache-Control: no-store, must-revalidate` khusus file `.js`/`.html` — supaya `docker compose up --build` ulang langsung terlihat efeknya tanpa pengguna perlu hard-refresh manual.

---

## 13. Ringkasan Status Fitur

| Fitur | Status | Verifikasi |
|---|---|---|
| Login / Registrasi | ✅ Fungsional | Signup + login nyata via REST API |
| Profil (nama, role, bio) | ✅ Fungsional | Upsert diverifikasi |
| Pertemanan (Friend System) | — | **Dihapus total (2 Okt 2026)** atas permintaan eksplisit pengguna — lihat §7 |
| Chat dengan provider/agent AI | 🟡 Parsial | Logic benar, butuh API key asli pengguna |
| Universal API key (deteksi otomatis) | ✅ Fungsional | Bug regex kritis ditemukan & diperbaiki |
| Kredensial terenkripsi (AES-GCM) | ✅ Fungsional | Round-trip encrypt→simpan→baca→decrypt diverifikasi sama persis |
| Bot Hub (katalog) | ✅ Fungsional | Navigasi & filter bekerja |
| **Bot BPJS — rekam suara (STT)** | ✅ Fungsional | `speech_to_text` on-device asli |
| **Bot BPJS — target dokter** | ✅ Fungsional | Nama+instansi diketik manual, tanpa akun/pertemanan (diubah 2 Okt 2026) |
| **Bot BPJS — generate dokumentasi LLM** | ✅ Fungsional | Panggil LLM native dengan kredensial terenkripsi |
| **Bot BPJS — salin teks / ekspor PDF & DOCX** | ✅ Fungsional | Baru 2 Okt 2026 — menggantikan alur review dokter berbasis akun |
| Bot BPJS — wake word pasif | 🔴 Simulasi | Terpicu tombol, bukan listening sungguhan |
| Bot BPJS — speaker diarization | 🔴 Belum ada | Butuh model terpisah |
| VPN WireGuard | ✅ Fungsional | Tunnel asli via `wireguard_flutter` |
| VPN OpenVPN/SSH | 🟡 Parsial | Config tersimpan, tunnel belum nyata |
| Activity Log | ✅ Fungsional | Insert + realtime diverifikasi |
| Agent simulasi (Code/Data/Planner Agent) | — | **Dihapus** dari desain — diganti pendekatan "agent = chip di Chat" yang lebih jujur |

### Riwayat Perbaikan Penting

| Tanggal | Temuan | Perbaikan |
|---|---|---|
| 25 Sept | Tabel `api_credentials` belum diterapkan ke DB live | Schema dijalankan manual via SQL Editor |
| 1 Okt | Pola regex OpenAI menangkap key provider lain | Negative lookahead ditambahkan, 6/6 test lolos |
| 1 Okt | Fitur Friends sempat hilang total (tidak ada route/UI/fungsi DB) | Dibangun ulang sementara, lalu **dihapus permanen** keesokan harinya (lihat baris berikut) |
| 1 Okt | Bot BPJS 100% simulasi (`Future.delayed`, data contoh) | STT asli, LLM call asli, simpan DB asli |
| 1 Okt | Konten halaman web terduplikasi vertikal | Race condition `onAuthStateChange` di `router.js`, diperbaiki dengan render-token guard |
| **2 Okt** | **Permintaan pengguna**: fitur Friends dinilai tidak diperlukan, Bot BPJS harus sampai ke dokter lewat salin/PDF/DOCX | Friend System dihapus total (tabel `friendships`/`messages`/`bpjs_reviews` di-drop); `bpjs_sessions.dokter_id` → `dokter_nama`+`dokter_instansi`; tambah `BpjsExport` (plaintext/PDF/DOCX + share sheet OS) |

---

*Dokumen ini mencerminkan kondisi kode pada commit `2423dac`. Untuk status paling akurat, baca langsung kode di `app/lib/` dan `web/public/` — dokumen bisa menjadi usang seiring pengembangan lanjutan.*
