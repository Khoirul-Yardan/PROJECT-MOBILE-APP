# Diagram Alur — AI Hub (PROJECT MOBILE APP)

> Dokumen ini ditulis ulang dengan membaca kode sumber langsung (bukan asumsi, bukan commit message) per **5 Oktober 2026**, mencerminkan *working tree* saat ini (termasuk perubahan yang belum di-commit). Semua diagram pakai [Mermaid](https://mermaid.js.org/) — buka file ini di Obsidian, GitHub, atau editor Markdown apa pun yang mendukung Mermaid untuk melihat visualnya.
>
> Status tiap alur ditandai: ✅ **Fungsional** (diverifikasi dengan data sungguhan / dibangun dan diuji di device asli) · 🟡 **Parsial** (jalan tapi ada batasan) · 🔴 **Simulasi/belum ada**.

## Daftar Isi

1. [Tech Stack](#1-tech-stack)
2. [Arsitektur Sistem](#2-arsitektur-sistem)
3. [Skema Database](#3-skema-database)
4. [Alur Autentikasi & Startup](#4-alur-autentikasi--startup)
5. [Alur Chat AI / Agent](#5-alur-chat-ai--agent)
6. [Alur Universal API Key (Deteksi Otomatis + Provider vs Agent)](#6-alur-universal-api-key-deteksi-otomatis--provider-vs-agent)
7. [Multi-Key per Provider (Slot & Auto-Rotation)](#7-multi-key-per-provider-slot--auto-rotation)
8. [Gemini: Pemilihan Model & Fallback Otomatis](#8-gemini-pemilihan-model--fallback-otomatis)
9. [Riwayat Chat (Chat History)](#9-riwayat-chat-chat-history)
10. [Alur Bot BPJS — End to End](#10-alur-bot-bpjs--end-to-end)
11. [Alur Export & Bagikan Dokumentasi](#11-alur-export--bagikan-dokumentasi)
12. [Alur VPN](#12-alur-vpn)
13. [Alur Activity Log](#13-alur-activity-log)
14. [Native Bridge (Web ⇄ Flutter)](#14-native-bridge-web--flutter)
15. [Deployment](#15-deployment)
16. [Ringkasan Status Fitur](#16-ringkasan-status-fitur)

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
      wireguard_flutter 0.1.3
      speech_to_text ^7.5.0
      cryptography ^2.9.0
      http ^1.2.2
      pdf + printing
      docx_creator
      share_plus
      path_provider
    Web SPA
      Vanilla JS (ES Modules, tanpa framework/bundler)
      Supabase JS v2 (CDN)
      Web Crypto API (AES-GCM + PBKDF2)
      CSS murni
      Hash router sendiri (router.js)
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
      Google Gemini API (model discovery + fallback)
      OpenRouter API
      Hermes (Nous Research, OpenAI-compatible)
      OpenClaw self-hosted gateway (Custom Webhook/REST)
```

| Lapisan | Teknologi | Peran |
|---|---|---|
| Native shell | Flutter / Dart | Splash screen, WebView persisten, Bot BPJS (mic/STT), VPN tunnel, secure storage |
| Native — Supabase | `supabase_flutter` | Mirror sesi untuk `activity_log`, baca/tulis `bpjs_*` dari Bot BPJS |
| Native — WebView | `webview_flutter` | Merender SPA web di dalam shell, `NativeBridge` JS channel |
| Native — storage | `flutter_secure_storage` | Simpan config VPN lokal (Keystore/Keychain) |
| Native — VPN | `wireguard_flutter` (dengan patch `compileSdk` via `android/build.gradle.kts`, lihat §12) | Tunnel WireGuard sungguhan via Android `VpnService` |
| Native — STT | `speech_to_text` | Speech-to-text on-device untuk Bot BPJS |
| Native — kripto | `cryptography` | Dekripsi kredensial AES-GCM (mirror dari Web Crypto) |
| Native — PDF/DOCX | `pdf`+`printing` / `docx_creator` | Generate dokumen hasil Bot BPJS |
| Native — share | `share_plus` | Share sheet OS untuk file hasil ekspor |
| Web SPA | Vanilla JS ES Modules | Seluruh UI aplikasi, tanpa build step |
| Web — Supabase | `@supabase/supabase-js@2` (CDN) | Auth, query Postgres via REST, Realtime |
| Web — kripto | Web Crypto API | Enkripsi kredensial AI sebelum disimpan |
| Backend | Supabase | Auth, PostgreSQL, Row Level Security, Realtime |
| Web server | nginx `1.27-alpine` | Sajikan static files, `Cache-Control: no-store` untuk `.js/.html` |

**Catatan arsitektur penting**: `web/` di root project adalah SPA aktif yang disajikan nginx. `app/web/` (di dalam folder Flutter) adalah output build target Flutter-web bawaan, **tidak dipakai**.

---

## 2. Arsitektur Sistem

```mermaid
flowchart TD
    User["👤 Pengguna"]

    subgraph Native["📱 Flutter Native Shell"]
        Splash["SplashScreen"]
        Shell["WebShellScreen\n(WebViewController persisten)"]
        BotBpjs["BotBpjsScreen\n(100% native)"]
        Bridge["NativeBridge\n(postMessage JSON)"]
        SecureStorage["FlutterSecureStorage\n(VPN config)"]
        WireGuard["VpnTunnelService\n(wireguard_flutter → VpnService)"]
        STT["speech_to_text\n(on-device)"]
        NativeSupabase["Supabase Client (native)\n(mirror sesi)"]
    end

    subgraph DockerWeb["🐳 Docker: nginx (port 8090)"]
        SPA["SPA AI Hub\n(index.html + ES Modules)"]
    end

    subgraph Cloud["☁️ Supabase Cloud"]
        Auth["Auth (email/password)"]
        DB[("PostgreSQL\n+ Row Level Security\n7 tabel")]
        Realtime["Realtime\n(postgres_changes)"]
    end

    subgraph External["🌐 Provider/Agent AI Eksternal"]
        OpenAI["OpenAI API"]
        Anthropic["Anthropic API"]
        Gemini["Google Gemini API\n(+ model discovery)"]
        OpenRouter["OpenRouter API"]
        Hermes["Hermes (Nous Research)"]
        OpenClaw["OpenClaw Gateway\n(self-hosted, REST/Webhook)"]
    end

    User --> Splash --> Shell
    Shell -->|load URL, immersive sticky nav bar| SPA
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
- **Tidak ada server aplikasi AI Hub khusus** — container nginx hanya menyajikan file statis.
- Web SPA memanggil provider AI **langsung dari browser/WebView** — kunci API didekripsi sesaat sebelum dipakai.
- Flutter shell hanya menangani hal yang **wajib native**: mikrofon (Bot BPJS), tunnel VPN (WireGuard butuh `VpnService`), dan secure storage config VPN.
- `NativeBridge` adalah satu-satunya jalur komunikasi Web ↔ Flutter.
- `MainActivity`/`main.dart` memakai `SystemUiMode.immersiveSticky` (bukan sekadar edge-to-edge transparan) supaya navigation bar Android benar-benar tersembunyi, dengan `WidgetsBindingObserver` yang menerapkannya ulang setiap `AppLifecycleState.resumed` (Android cenderung memunculkan kembali nav bar setelah resume/keyboard ditutup).

---

## 3. Skema Database

```mermaid
erDiagram
    auth_users ||--|| profiles : "1:1"
    auth_users ||--o{ activity_log : "memiliki"
    auth_users ||--o{ api_credentials : "memiliki (banyak slot per provider)"
    auth_users ||--o{ chat_messages : "memiliki"
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
        text provider_id "mis. 'gemini' — bisa berulang"
        text label "nama slot, mis. 'Gemini 2' — unik per provider_id"
        text type "chat|agent"
        text format "openai|anthropic|gemini|openclaw"
        text endpoint
        text model
        text encrypted_key "AES-GCM ciphertext"
        text iv
    }
    chat_messages {
        uuid id PK
        uuid user_id FK
        text provider_id
        text provider_label
        text role "user|assistant"
        text content
        bool is_error
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

**7 tabel total**, semua dengan **Row Level Security aktif**. Tabel `friendships`, `messages`, `bpjs_reviews` sudah dihapus permanen (Friend System). Tabel terbaru: **`chat_messages`** (persist riwayat chat per provider, lihat §9).

**Constraint unik yang berubah**: `api_credentials` dulu `unique(user_id, provider_id)` — **sekarang `unique(user_id, provider_id, label)`**, supaya satu `provider_id` (mis. `gemini`) bisa punya beberapa baris/slot kunci sekaligus (lihat §7). Migrasi ini idempotent (`drop constraint if exists` lalu cek `pg_constraint` sebelum `add constraint`), aman dijalankan ulang di Supabase SQL Editor.

| Tabel | Aturan RLS kunci |
|---|---|
| `bpjs_sessions` / `bpjs_transcripts` / `bpjs_documents` | CRUD/insert/select hanya oleh `perawat_id` pemilik baris/sesi induk |
| `api_credentials` | CRUD penuh hanya oleh `user_id` pemilik baris |
| `chat_messages` | Select & insert & delete hanya oleh `user_id` pemilik — tidak ada policy update (pesan tidak diedit, hanya ditambah/dihapus sekaligus lewat `/clear`) |
| `activity_log` | Append-only: ada policy `insert`+`select`, **tidak ada** `update`/`delete` |

---

## 4. Alur Autentikasi & Startup

```mermaid
sequenceDiagram
    participant U as Pengguna
    participant F as Flutter (main.dart)
    participant W as WebView (SPA)
    participant S as Supabase

    U->>F: Buka aplikasi
    F->>F: SystemUiMode.immersiveSticky + overlay transparan
    F->>S: SupabaseService.init() (best-effort, native mirror)
    F->>F: SplashScreen tampil ±1200ms (Column center, logo+teks)
    F->>W: pushReplacementNamed('/shell') → WebShellScreen
    W->>W: WebViewController dibuat, JS diaktifkan, NativeBridge dipasang
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
    Note over F: didChangeAppLifecycleState(resumed) →\nterapkan ulang immersiveSticky\n(Android sering menampakkan nav bar lagi\nsetelah resume/keyboard tertutup)
```

**Status: ✅ Fungsional.**

**Detail penting:**
- Guard router (`app.js`) mengecek sesi di setiap render.
- `onAuthStateChange` bisa fire lebih dari sekali saat startup — ditangani dengan `renderToken` di `router.js` (anti render dobel).
- `SplashScreen` sempat punya bug nyata: `Column` tanpa pembungkus `Center` hanya selebar kontennya sendiri lalu nempel ke kiri layar (dikonfirmasi lewat `adb screencap` langsung di device, bukan asumsi) — sudah diperbaiki dengan `Center` + `mainAxisSize: MainAxisSize.min`.

---

## 5. Alur Chat AI / Agent

```mermaid
flowchart TD
    Start["Pengguna buka /chat"] --> LoadPicker["loadPicker():\nlistRegisteredProviders()\n+ hydrateMessages() dari chat_messages"]
    LoadPicker --> HasProvider{Ada provider\nterhubung?}
    HasProvider -->|Tidak| EmptyState["Chip:\n+ Hubungkan Provider AI\n+ Hubungkan Agent"]
    HasProvider -->|Ya| ShowChips["Chip semua provider/agent\n(ChatGPT, Hermes, dst — setara)\n+ tombol Pilih Model + Riwayat"]
    ShowChips --> SelectEntry["User pilih satu entry\n→ hydrateMessages() jika belum ada cache"]
    SelectEntry --> TypeMsg["User ketik pesan, atau ketik '/' / tekan tombol skill"]
    TypeMsg --> IsSkill{Diawali '/'?}
    IsSkill -->|Ya| SkillMenu["Palet skill muncul (gaya Telegram):\n/system, /clear, /help"]
    SkillMenu --> RunSkill["Dijalankan lokal, tanpa API call\n('/clear' juga hapus chat_messages di server)"]
    IsSkill -->|Tidak| SendChat["sendChat(entry, history)"]
    SendChat --> Rotation["callWithRotation():\ncoba slot kunci berurutan,\nlihat §7"]
    Rotation --> Format{entry.format}
    Format -->|openai| CallOpenAI["POST .../chat/completions\n(OpenAI, OpenRouter, Hermes, dsb)"]
    Format -->|anthropic| CallClaude["POST .../messages\n(x-api-key header)"]
    Format -->|gemini| CallGemini["generateGemini():\nauto-pilih model + fallback,\nlihat §8"]
    Format -->|openclaw| CallOpenClaw["POST gateway kustom\n(session-based, bukan full history)"]
    CallOpenAI --> ShowReply["Tampilkan balasan + simpan ke chat_messages"]
    CallClaude --> ShowReply
    CallGemini --> ShowReply
    CallOpenClaw --> ShowReply
    ShowReply --> LogActivity["logActivity(category:'AI')"]
```

**Status: 🟡 Parsial** — kode lengkap dan adapter 4 format benar secara logic, tapi butuh API key asli milik pengguna untuk benar-benar memanggil provider (bring-your-own-key, bukan bug).

**Yang baru dibanding versi sebelumnya:**
- **Skills ala Telegram** — ketik `/` sebagai karakter pertama (atau tekan tombol `/` di sebelah kolom pesan) memunculkan palet perintah: `/system <instruksi>` (atur system prompt per-provider untuk sesi berjalan), `/clear` (bersihkan chat lokal **dan** di server), `/help`.
- **Riwayat chat persisten** — lihat §9.
- **Tombol "Pilih Model"** di topbar Chat (ikon lapis) mengarah ke `/settings/apikeys`; tombol riwayat (ikon jam) mengarah ke `/history`.

---

## 6. Alur Universal API Key (Deteksi Otomatis + Provider vs Agent)

```mermaid
flowchart TD
    EntryPoint["User tekan '+ Provider AI'\natau '+ Agent'\n(di Chat atau halaman Provider & Agent)"] --> Mode{"URL query\n?type=provider / ?type=agent"}
    Mode -->|provider| FilterChat["Tampilkan hanya katalog type:'chat'\n(ChatGPT, Claude, Gemini, OpenRouter)"]
    Mode -->|agent| FilterAgent["Tampilkan hanya katalog type:'agent'\n(Hermes) + Self-hosted (OpenClaw)"]
    FilterChat --> Paste["User tempel API key\ndi satu kolom"]
    FilterAgent --> Paste
    FilterAgent --> SelfHosted["Atau isi URL Gateway + Bearer token\n(OpenClaw — bukan API key vendor)"]
    Paste --> Detect["detectProvider(rawKey)"]
    Detect --> Match{Cocok regex\nKNOWN_PROVIDERS?}
    Match -->|sk-... (bukan ant-/or-v1-/nous-)| OpenAI["ChatGPT (OpenAI)"]
    Match -->|sk-ant-...| Claude["Claude (Anthropic)"]
    Match -->|AIzaSy... / AQ....| GeminiD["Gemini (Google)\n— 2 format key didukung"]
    Match -->|sk-or-v1-...| OR["OpenRouter"]
    Match -->|sk-nous-...| HermesD["Hermes (Nous Research)"]
    Match -->|Tidak cocok apa pun| Manual["Quick-pick dari katalog (sesuai mode)\n+ opsi 'API/agent lain' (form manual)"]
    OpenAI --> ExistingCheck
    Claude --> ExistingCheck
    GeminiD --> ExistingCheck
    OR --> ExistingCheck
    HermesD --> ExistingCheck
    Manual --> FillForm["User isi: nama, jenis, endpoint, model"]
    FillForm --> ExistingCheck
    SelfHosted --> ExistingCheckSH["saveProvider() langsung\n(format: openclaw)"]
    ExistingCheck{"countCredentialSlots(provider_id) > 0?\n(sudah ada key provider ini?)"}
    ExistingCheck -->|Tidak, slot pertama| Save
    ExistingCheck -->|Ya| AskSlotName["Minta nama slot baru\n(disarankan: 'Gemini 2', dst)"]
    AskSlotName --> Save
    Save["saveCredential(entry, apiKey)"] --> Encrypt["PBKDF2-SHA256 (100k iterasi)\n→ turunkan AES-256-GCM key\ndari UID + pepper"]
    Encrypt --> EncryptValue["AES-GCM encrypt(apiKey)"]
    EncryptValue --> Upsert["UPSERT api_credentials\nonConflict: user_id,provider_id,label"]
    Upsert --> Done["Entry muncul di Chat sebagai 1 chip\n(walau provider punya >1 slot — lihat §7)"]
```

**Status: ✅ Fungsional.**

**Perubahan penting dibanding versi sebelumnya:**
- **Pemisahan Provider AI vs Agent saat setup** — sebelumnya satu form campur, sekarang `/settings/add-api-key?type=provider` dan `?type=agent` adalah dua pintu masuk berbeda (judul, deskripsi, katalog yang ditampilkan semua ikut berbeda), supaya pengguna tidak bingung antara "AI biasa" dan "agent". Setelah tersambung, keduanya tetap setara dan tampil bersisian di Chat (keputusan desain lama tetap dipertahankan).
- **Hermes** kini punya entri katalog asli (bukan simulasi) — endpoint Nous Research Portal (`inference-api.nousresearch.com`, OpenAI-compatible, key `sk-nous-...`).
- **OpenClaw** punya jalur tersendiri di luar `KNOWN_PROVIDERS` (`SELF_HOSTED_PROVIDERS`) karena bukan API key vendor tetap — field-nya adalah URL Gateway + Bearer token milik instance self-hosted pengguna sendiri, memakai *Custom Webhook/Gateway REST API* OpenClaw supaya balasan agent masuk ke Chat aplikasi ini (bukan Telegram/WhatsApp seperti biasanya).
- **Bug regex OpenAI** (menangkap key provider lain karena semua diawali `sk-`) sudah diperbaiki dengan negative lookahead `(?!ant-|or-v1-|nous-)`.
- **Simpan key kedua untuk provider yang sama** sekarang tidak lagi diam-diam menimpa key lama — lihat §7.

**Keamanan kunci**: AES-GCM key diturunkan dari `UID + pepper` via PBKDF2, bukan secret independen seperti Keystore asli perangkat. **Row Level Security tetap kontrol akses sesungguhnya.**

---

## 7. Multi-Key per Provider (Slot & Auto-Rotation)

```mermaid
sequenceDiagram
    participant U as Pengguna
    participant Add as add-api-key.js
    participant Cred as credentials.js
    participant Chat as chat.js
    participant AI as ai.js
    participant Prov as Provider (mis. Gemini)

    U->>Add: Tempel key Gemini kedua
    Add->>Cred: countCredentialSlots('gemini')
    Cred-->>Add: 1 (sudah ada 1 slot: "Gemini")
    Add->>U: Minta nama slot baru (saran: "Gemini 2")
    U->>Add: Konfirmasi "Gemini 2"
    Add->>Cred: saveCredential({id:'gemini', label:'Gemini 2'}, apiKey)
    Cred->>Cred: UPSERT onConflict(user_id, provider_id, label)
    Note over Cred: 2 baris di api_credentials,\nsama-sama provider_id='gemini'

    U->>Chat: Buka Chat → listRegisteredProviders()
    Chat->>Cred: listCredentials() → group by provider_id
    Cred-->>Chat: 1 entry "Gemini" (slotCount: 2)
    Note over Chat: Chat TETAP hanya tampilkan 1 chip "Gemini"

    U->>Chat: Kirim pesan
    Chat->>AI: sendChat(entry, history)
    AI->>Cred: getCredentialKeySlots('gemini')
    Cred-->>AI: [{slot:'Gemini', key}, {slot:'Gemini 2', key}]
    AI->>Prov: Panggil pakai slot index terakhir yang berhasil (default 0)
    alt 429 / quota / rate limit
        Prov-->>AI: error (isQuotaError = true)
        AI->>Prov: Coba slot berikutnya ("Gemini 2")
        Prov-->>AI: Berhasil
        AI->>Chat: onSlotChange("Gemini 2")
        Chat->>U: Notice: 'Kunci sebelumnya kena limit —\notomatis dialihkan ke kunci "Gemini 2".'
    else Error lain (key salah, network, safety block)
        Prov-->>AI: error
        AI->>Chat: Lempar langsung, TIDAK coba slot lain\n(bukan masalah kuota, ganti key tak membantu)
    end
```

**Status: ✅ Fungsional (baru).**

**Kenapa ini ada**: sebelumnya menyimpan key kedua untuk provider yang sama (mis. 2 akun Gemini gratis untuk menghindari limit) akan **menimpa diam-diam** key pertama (constraint lama `unique(user_id, provider_id)`). Sekarang:
- Constraint jadi `unique(user_id, provider_id, label)` — banyak slot per provider diperbolehkan.
- `credentials.js` punya dua lapisan: `listCredentialSlots()` (mentah, per baris — dipakai halaman Provider & Agent untuk kelola slot satu-satu) dan `listCredentials()` (dikelompokkan per `provider_id` — dipakai Chat supaya tetap 1 chip per provider).
- `ai.js`'s `callWithRotation()` mengingat slot index terakhir yang berhasil (`lastGoodSlot`, hanya di memori halaman, reset saat reload) dan hanya pindah slot kalau errornya **spesifik soal kuota/rate-limit** (`status 429` atau pesan mengandung "quota"/"rate limit"/"resource_exhausted") — error lain (key salah, jaringan putus, konten diblokir) langsung dilempar ke pengguna tanpa membuang percobaan ke semua slot.
- Halaman **Provider & Agent** (`apikeys.js`) menampilkan badge jumlah slot (mis. "Provider chat · 2 kunci") dan daftar slot individual di dalam card yang sama (bukan blok terpisah tanpa gaya) — tiap slot bisa dihapus sendiri-sendiri tanpa memutus seluruh provider.

---

## 8. Gemini: Pemilihan Model & Fallback Otomatis

```mermaid
flowchart TD
    Send["sendChat() format:'gemini'"] --> HasPreferred{entry.model\nsudah diset & bukan 'auto'?}
    HasPreferred -->|Ya| TryPreferred["Coba model pilihan pengguna"]
    HasPreferred -->|Tidak| Discover["listGeminiModels():\nGET .../models, rank by\nflash/pro, preview di-deprioritaskan"]
    TryPreferred --> Result{Hasil?}
    Discover --> TryTop5["Coba sampai 5 kandidat teratas\nyang belum dicoba"]
    TryTop5 --> Result
    Result -->|Sukses| Done["Balas + updateCredentialModel()\nkalau model berubah dari semula"]
    Result -->|modelUnavailable| NextCandidate["Coba kandidat berikutnya"]
    NextCandidate --> TryTop5
    Result -->|Error lain (auth/safety/network)| Stop["Hentikan — bukan masalah\nketersediaan model"]

    subgraph ErrorClassification["Klasifikasi error (gemini.js)"]
        E400["400/404 + pesan 'model...not found/deprecated'"] --> MU["modelUnavailable = true"]
        E429Zero["429 + pesan mengandung 'limit: 0'\n(model memang tak dapat kuota gratis\nsama sekali, bukan kuota habis)"] --> MU
        E503["503 'high demand'"] -->|retry 2x (700ms, 1800ms)\nmasih gagal| MU
        E429Normal["429 kuota habis terpakai (limit > 0)"] --> QuotaErr["Error biasa →\npicu rotasi SLOT (§7), bukan ganti model"]
    end
```

**Status: ✅ Fungsional (baru, hasil debugging sesi nyata).**

**Tiga bug nyata yang ditemukan & diperbaiki saat pengujian:**
1. **`limit: 0` disalahartikan sebagai kuota habis** — padahal artinya model itu (mis. model preview/eksperimental tertentu) memang tidak mendapat kuota gratis sama sekali untuk siapa pun, permanen. Mengganti API key tidak membantu. Sekarang error ini diklasifikasikan sebagai `modelUnavailable`, memicu percobaan **model lain**, bukan rotasi key.
2. **503 "sedang sibuk" langsung menyerah** — sekarang di-retry otomatis 2× dengan jeda singkat (700ms, 1800ms) sebelum dianggap `modelUnavailable` dan beralih ke model lain.
3. **Jumlah kandidat fallback dinaikkan** dari 3 ke 5 model, karena 503 kini juga "memakai jatah" percobaan.

Pengguna juga bisa memilih model manual lewat tombol **"Pilih Model"** (`model-picker.js`) — menampilkan daftar model Gemini yang tersedia (hasil `listGeminiModels()`) atau mengetik ID model sendiri untuk provider non-Gemini.

---

## 9. Riwayat Chat (Chat History)

```mermaid
sequenceDiagram
    participant U as Pengguna
    participant Chat as chat.js
    participant Hist as chat-history.js
    participant DB as Supabase (chat_messages)
    participant HistPage as history.js (/history)

    U->>Chat: Kirim pesan ke "Gemini"
    Chat->>Hist: saveMessage('gemini','Gemini','user', teks)
    Hist->>DB: INSERT chat_messages
    Chat->>Hist: (setelah dibalas) saveMessage(...,'assistant', balasan)
    Hist->>DB: INSERT chat_messages

    U->>Chat: Pindah ke menu lain lalu balik ke Chat
    Note over Chat: Sebelumnya: chat hilang total\n(hanya tersimpan di memori per-render)
    Chat->>Hist: hydrateMessages('gemini') — hanya sekali\nper entry per kunjungan halaman
    Hist->>DB: SELECT chat_messages WHERE provider_id='gemini' ORDER BY created_at
    DB-->>Chat: Riwayat utuh dimuat kembali

    U->>Chat: Tekan ikon jam (Riwayat) di topbar
    Chat->>HistPage: navigate('/history')
    HistPage->>Hist: listConversations()
    Hist->>DB: SELECT ... GROUP BY provider_id (ambil 1 pesan terakhir per provider)
    DB-->>HistPage: [{id:'gemini', label:'Gemini', lastMessage, lastAt}, ...]
    HistPage->>U: Daftar percakapan, dikelompokkan per AI/agent,\npreview pesan terakhir + waktu
    U->>HistPage: Tap salah satu
    HistPage->>Chat: navigate('/chat?provider=gemini')
    Chat->>Chat: Baca query param, auto-pilih entry itu
```

**Status: ✅ Fungsional (baru).**

**Masalah yang diperbaiki**: sebelumnya chat disimpan **hanya di memori JS halaman** (`Map` lokal di dalam `chat.js`'s `render()`) — begitu pengguna pindah ke menu lain, router membuang instance halaman itu, dan percakapan hilang total. Sekarang setiap pesan (user & balasan AI, bukan output lokal skill seperti `/help`) disimpan ke tabel `chat_messages` lewat `chat-history.js`, dan dimuat ulang dari server saat Chat dibuka lagi.

**Halaman Riwayat** (`/history`, tombol ikon jam di topbar Chat — tepat di sebelah tombol yang mengarah ke "Provider & Agent" sesuai desain yang diminta) mengelompokkan riwayat per AI/agent, menampilkan preview pesan terakhir, lalu membuka Chat dengan AI/agent itu langsung aktif saat ditekan.

`/clear` di Chat menghapus baik cache lokal **maupun** baris di `chat_messages` (`clearConversation()`), bukan cuma tampilan.

---

## 10. Alur Bot BPJS — End to End

```mermaid
sequenceDiagram
    actor Perawat
    participant App as BotBpjsScreen (native)
    participant STT as speech_to_text
    participant DB as Supabase (RLS)
    participant LLM as Provider/Agent AI

    Perawat->>App: Tekan lingkaran mikrofon\n(bukan lagi tombol "Ucapkan Halo Jarvis")
    App->>STT: initialize() + minta izin mikrofon
    alt Izin ditolak / tidak didukung
        STT-->>App: false
        App->>Perawat: "Izin mikrofon diperlukan"
    else Izin diberikan
        App->>Perawat: Dialog "Nama pasien?"
        Perawat->>App: Isi nama
        App->>Perawat: Dialog "Dokumentasi untuk dokter siapa?"\n(nama + instansi, teks bebas)
        Perawat->>App: Isi nama dokter + instansi (opsional)
        App->>STT: listen(localeId:'id_ID', partialResults:true)
        loop Selama merekam
            STT-->>App: onResult(recognizedWords, finalResult)
            App->>App: Tambahkan ke _segments[] saat finalResult
            alt Jeda bicara (error_speech_timeout / error_no_match / error_client)
                STT-->>App: onError (kode di atas)
                App->>App: Diamkan (bukan error sungguhan) +\nrestart listen() setelah jeda 350ms + guard anti-tabrakan
            end
        end
        Perawat->>App: Tekan "Hentikan Sesi"
        App->>App: Bersihkan _errorMessage (stage→processing)\n— cegah error basi "nyangkut" ke layar Review
        App->>DB: createSession(dokter_nama, dokter_instansi, pasien_nama)
        App->>DB: addTranscriptSegment() × N segmen
        App->>App: fetchAcceptedCredential() → dekripsi AES-GCM (native)
        App->>LLM: generateDocumentation(transcript)
        alt LLM berhasil
            LLM-->>App: JSON {ringkasan, keluhan_utama, ...}
        else LLM gagal / tidak ada provider
            App->>App: Fallback: transkrip mentah + catatan
        end
        App->>DB: saveDocumentation() + markStatus('siap_dikirim')
        App->>Perawat: Layar Review — tiap field BISA DIEDIT\n(TextField, bukan teks statis)
        Note over Perawat: Salin/Ekspor pakai hasil EDITAN,\nbukan draf mentah AI — lihat §11
    end
```

**Status: ✅ Fungsional — dirombak ulang untuk menghapus branding "Halo Jarvis" dan menambah review yang bisa diedit.**

| Bagian | Status | Keterangan |
|---|---|---|
| Nyalakan sesi | ✅ Fungsional | **Tekan lingkaran mikrofon langsung** — tombol "Ucapkan Halo Jarvis" terpisah sudah dihapus, tidak ada lagi klaim wake-word |
| Rekam suara → teks (STT) | ✅ Fungsional | `speech_to_text` on-device, auto-restart saat jeda, error transien (`error_speech_timeout`/`error_no_match`/`error_client`) disaring agar tidak tampil sebagai error merah |
| Target dokter | ✅ Fungsional | Nama + instansi diketik manual, tidak butuh akun dokter |
| Generate dokumentasi via LLM | ✅ Fungsional (jika ada API key) | Fallback transkrip mentah jika tak ada provider |
| **Review bisa diedit** | ✅ Fungsional (baru) | Tiap field (`ringkasan`, `catatan`, dst.) jadi `TextField` — perawat membenarkan tulisan sebelum disalin/diekspor, bukan sekadar baca draf AI mentah |
| Salin teks / ekspor PDF & DOCX | ✅ Fungsional | Memakai hasil **editan** perawat (`_editedDraft`), bukan draf asli dari AI — lihat §11 |
| ~~Wake word "Halo Jarvis"~~ | — | **Dihapus total** atas permintaan eksplisit pengguna — bot ini sekarang murni tekan-mic, bukan asisten bernama |
| Speaker diarization | 🔴 Belum ada | Semua segmen ditandai `speaker: 'perawat'` — butuh model diarization terpisah |

---

## 11. Alur Export & Bagikan Dokumentasi

```mermaid
flowchart TD
    Review["Perawat di layar Review\n(field sudah diedit bila perlu)"] --> Choice{Pilih aksi}
    Choice -->|Salin Teks| CopyText["BpjsExport.plainText(_editedDraft)\n→ Clipboard.setData()"]
    Choice -->|Ekspor PDF| BuildPdf["BpjsExport.buildPdf(_editedDraft)"]
    Choice -->|Ekspor DOCX| BuildDocx["BpjsExport.buildDocx(_editedDraft)"]
    CopyText --> MarkSent["markStatus(session, 'terkirim')"]
    BuildPdf --> SaveTemp1["Simpan ke temp dir (path_provider)"]
    BuildDocx --> SaveTemp2["Simpan ke temp dir (path_provider)"]
    SaveTemp1 --> ShareSheet["share_plus: buka share sheet OS"]
    SaveTemp2 --> ShareSheet
    ShareSheet --> AppPicker["Perawat pilih aplikasi\n(WhatsApp, Email, Drive, dll)"]
    AppPicker --> MarkSent
    MarkSent --> Done["Dokter menerima dokumentasi\ndi luar aplikasi — perawat yang mengirim langsung"]
```

**Status: ✅ Fungsional** — ketiganya kini memakai `_editedDraft` (getter yang membaca langsung dari `TextEditingController` layar Review), sehingga apa yang disalin/diekspor **selalu** sama persis dengan yang terakhir diketik perawat di layar — bukan draf asli AI yang belum tentu benar.

---

## 12. Alur VPN

```mermaid
flowchart TD
    OpenVpn["User buka /vpn"] --> GetConfig["Native.getVpnConfig()"]
    GetConfig --> HasConfig{Config\ntersimpan?}
    HasConfig -->|Tidak| PromptAdd["Arahkan ke /vpn-config"]
    HasConfig -->|Ya| ShowStatus["Tampilkan protocol + endpoint"]
    PromptAdd --> FillForm["Isi field sesuai protokol:\nWireGuard / OpenVPN / SSH"]
    FillForm --> SaveConfig["Native.saveVpnConfig(config)\n→ FlutterSecureStorage"]
    SaveConfig --> ShowStatus
    ShowStatus --> Connect["User tekan 'Connect'"]
    Connect --> Protocol{Protokol?}
    Protocol -->|WireGuard| RealTunnel["VpnTunnelService.connect()\n→ wireguard_flutter\n→ Android VpnService AKTIF\n(dibangun & diuji di device asli)"]
    Protocol -->|OpenVPN / SSH| FakeConnect["Native balas {connected:false, message:...}\nTIDAK ada tunnel nyata — pesan ini\nditampilkan jujur ke pengguna via toast"]
    RealTunnel --> LogVpn["logActivity(category:'VPN')"]
    FakeConnect --> LogVpn

    NoBridge["Dibuka di browser biasa\n(tanpa shell Flutter)"] -.->|Native.attached = false| BrowserNote["Catatan di UI:\n'Preview browser — simulasi tampilan,\nbukan tunnel asli'"]
```

**Status: 🟡 Parsial** — WireGuard **sungguhan** (tunnel nyata via `VpnService`, APK sudah berhasil dibuild & diinstall ke device fisik), OpenVPN/SSH masih **config-only**.

**Catatan build WireGuard**: plugin `wireguard_flutter 0.1.3` meng-hardcode `compileSdkVersion 31` di `android/build.gradle` miliknya sendiri, padahal dependency transitifnya (AndroidX) butuh compile SDK 33+ — menyebabkan build gagal berulang kali. Diperbaiki dengan override langsung di `app/android/build.gradle.kts`: `project(":wireguard_flutter").afterEvaluate { ...compileSdk = 35... }` (harus pakai `afterEvaluate` yang di-scope ke modul itu saja, bukan `subprojects` umum, karena `:app` sudah dipaksa evaluasi lebih dulu oleh `evaluationDependsOn(":app")` yang sudah ada).

**Catatan UX**: halaman VPN sekarang jujur membedakan tiga kondisi — WireGuard dengan tunnel asli aktif, protokol lain yang baru config-only, dan mode preview-browser (tanpa shell native sama sekali) — supaya pengguna tidak salah kira semuanya sudah jalan sungguhan.

---

## 13. Alur Activity Log

```mermaid
flowchart LR
    Action["Aksi pengguna\n(login, chat, bot, vpn)"] --> LogCall["logActivity({category, title, badge})"]
    LogCall --> Insert["INSERT activity_log\n(best-effort, tidak pernah throw)"]
    Insert --> RT["Realtime channel\n'activity-log-changes-*'"]
    RT --> ViewUpdate["Halaman /settings/activity\nauto-refresh"]
    Insert -.->|RLS: append-only| NoUpdate["❌ Tidak ada policy UPDATE/DELETE"]
```

**Status: ✅ Fungsional.** Kategori: `AI`, `Agents`, `Bots`, `VPN`, `System`.

---

## 14. Native Bridge (Web ⇄ Flutter)

```mermaid
sequenceDiagram
    participant Web as SPA (bridge.js)
    participant Native as Flutter (WebShellScreen handler)

    Note over Web,Native: Transport: NativeBridge.postMessage(JSON)\nBalasan: window.__nativeReply(id, json)\nEvent: window.__nativeEvent(type, json)

    Web->>Native: {id, type:'get_vpn_config'}
    Native-->>Web: __nativeReply(id, configJson)

    Web->>Native: {id, type:'save_vpn_config', payload}
    Native-->>Web: __nativeReply(id, {})

    Web->>Native: {id, type:'vpn_connect'}
    alt Protokol WireGuard
        Native->>Native: VpnTunnelService.connect() — tunnel ASLI
        Native-->>Web: __nativeReply(id, {connected:true})
    else Protokol lain / gagal
        Native-->>Web: __nativeReply(id, {connected:false, message:'...'})
    end

    Web->>Native: {id, type:'vpn_disconnect'}
    Native-->>Web: __nativeReply(id, {connected:false})

    Web->>Native: {id, type:'open_bot_bpjs'}
    Native->>Native: Navigator push BotBpjsScreen

    Web->>Native: {type:'session_changed', payload:{refresh_token}}
    Note right of Native: Native mirror Supabase session

    Web->>Native: {id, type:'sign_out'}
    Native-->>Web: __nativeReply(id, {})

    Note over Web: Tanpa bridge (browser biasa, dev mode):\nVPN config fallback ke localStorage (insecure, dev-only)\nvpn_connect/disconnect disimulasikan,\ncall lain di-ignore + warning
```

**Timeout**: setiap panggilan native punya batas 8 detik (`CALL_TIMEOUT_MS`) — jika native tidak membalas, Promise resolve `null`.

**7 tipe pesan** ditangani native: `session_changed`, `get_vpn_config`, `save_vpn_config`, `vpn_connect`, `vpn_disconnect`, `open_bot_bpjs`, `sign_out`. Kredensial API AI/agent **tidak lagi lewat bridge ini sama sekali** — sejak dipindah ke penyimpanan Supabase terenkripsi langsung dari web (`credentials.js`), supaya key tidak hilang saat uninstall/ganti device.

---

## 15. Deployment

```mermaid
flowchart TD
    Dev["Developer"] -->|docker compose up -d --build| Build["Docker build:\nFROM nginx:1.27-alpine\nCOPY public/ → /usr/share/nginx/html/"]
    Build --> Container["Container: ai-hub-web\nPort host 8090 → container 80"]
    Container --> Serve["nginx menyajikan SPA\nCache-Control: no-store untuk .js/.html"]
    Serve --> Browser["Browser / WebView mengakses\nhttp://localhost:8090"]

    FlutterApp["Flutter app (Android)"] -->|adb reverse tcp:8090 tcp:8090\n+ WebViewController.loadUrl| Serve

    subgraph DeviceTest["Testing di device fisik"]
        Note2["USB tethering + adb reverse —\nforwarding port bisa ter-reset\nsetelah install/restart app,\nperlu dipasang ulang"]
    end

    subgraph Prod["Untuk produksi (belum diimplementasi)"]
        Note1["URL web perlu di-host publik\n(bukan localhost) agar device fisik\nbisa mengaksesnya tanpa USB"]
    end
```

**Konfigurasi kunci `nginx.conf`:**
- `Access-Control-Allow-Origin: *` — supaya SPA bisa dibuka langsung dari browser biasa saat development.
- `Cache-Control: no-store, must-revalidate` khusus `.js`/`.html` — supaya rebuild langsung terlihat efeknya.

**Build native**: `flutter build apk --debug` dipakai untuk iterasi cepat (tapi lambat — cold start pertama bisa ~4 detik di device kelas menengah karena JIT/Dart VM debug) dan `flutter build apk --release` untuk pengujian performa sungguhan.

---

## 16. Ringkasan Status Fitur

| Fitur | Status | Catatan |
|---|---|---|
| Login / Registrasi | ✅ Fungsional | |
| Profil (nama, role, bio) | ✅ Fungsional | |
| Pertemanan (Friend System) | — | Dihapus total — lihat §10 |
| Chat dengan provider/agent AI | 🟡 Parsial | Logic benar, butuh API key asli pengguna |
| Skills chat (`/system`, `/clear`, `/help`) | ✅ Fungsional | Gaya Telegram, palet muncul saat ketik `/` |
| Riwayat chat persisten + halaman Riwayat | ✅ Fungsional | Lihat §9 |
| Universal API key (deteksi otomatis) | ✅ Fungsional | Pemisahan Provider vs Agent saat setup |
| Hermes (agent, API asli) | ✅ Fungsional | Nous Research Portal, OpenAI-compatible |
| OpenClaw (agent self-hosted) | ✅ Fungsional | Via Gateway REST/Custom Webhook milik pengguna |
| Multi-key per provider + auto-rotation saat limit | ✅ Fungsional | Lihat §7 |
| Gemini auto-fallback model (404/429 limit:0/503) | ✅ Fungsional | Lihat §8 |
| Kredensial terenkripsi (AES-GCM) | ✅ Fungsional | |
| Bot Hub (katalog) | ✅ Fungsional | |
| Bot BPJS — rekam suara (STT) | ✅ Fungsional | Error transien disaring, auto-restart |
| Bot BPJS — mulai sesi | ✅ Fungsional | Tekan mic langsung, "Halo Jarvis" dihapus |
| Bot BPJS — review bisa diedit | ✅ Fungsional (baru) | `TextField` per section, bukan teks statis |
| Bot BPJS — salin teks / ekspor PDF & DOCX | ✅ Fungsional | Pakai hasil editan, bukan draf AI mentah |
| Bot BPJS — wake word pasif | — | Dihapus total, tidak pernah diklaim lagi |
| Bot BPJS — speaker diarization | 🔴 Belum ada | Butuh model terpisah |
| VPN WireGuard (tunnel asli) | ✅ Fungsional | Build berhasil, diuji di device fisik |
| VPN OpenVPN/SSH | 🟡 Parsial | Config tersimpan, tunnel belum nyata |
| Immersive nav bar (Android) | ✅ Fungsional | `immersiveSticky` + reapply saat resume |
| Splash screen center | ✅ Fungsional (bug nyata, sudah diperbaiki) | Dikonfirmasi via screenshot device langsung |
| Activity Log | ✅ Fungsional | |

### Riwayat Perbaikan Penting (sesi terbaru)

| Area | Temuan | Perbaikan |
|---|---|---|
| Gemini key detection | Format key baru `AQ.Ab8R...` dari aistudio.google.com belum dikenali | Regex diperluas: `AIzaSy...` ATAU `AQ....` |
| Chat setup | Provider & Agent tercampur dalam satu form, membingungkan | Dipisah jadi dua mode (`?type=provider`/`?type=agent`) |
| Agent nyata | Hermes/OpenClaw awalnya cuma konsep, belum diverifikasi API-nya | Diriset: Hermes punya endpoint resmi (Nous Portal); OpenClaw punya Gateway REST/Webhook — keduanya diimplementasikan sungguhan |
| VPN | Tidak ada tunnel asli sama sekali | WireGuard diimplementasikan via `wireguard_flutter` + fix `compileSdk` plugin yang gagal build berkali-kali |
| Multi API key | Key kedua untuk provider sama menimpa diam-diam key pertama | Constraint DB diubah jadi per-slot + UI penamaan slot + auto-rotation saat limit |
| Gemini reliability | Model `limit:0` dan `503` dianggap error fatal, chat macet terus | Diklasifikasikan ulang sebagai `modelUnavailable` → otomatis coba model lain |
| Chat persistence | Pindah menu = riwayat chat hilang total | Tabel `chat_messages` + hydrasi otomatis + halaman `/history` |
| Bot BPJS UX | Branding "Halo Jarvis" tidak sesuai kebutuhan nyata (perawat cuma mau tekan-mic) | Tombol wake-word dihapus, lingkaran mic langsung bisa ditekan, review jadi bisa diedit |
| Bot BPJS STT | `error_speech_timeout`/`error_client` tampil sebagai error merah padahal cuma jeda bicara normal | Disaring dari tampilan, recognizer di-restart dengan jeda+guard anti race |
| Native UI | Navigation bar Android tidak hilang, mengganggu | `SystemUiMode.immersiveSticky` + reapply di lifecycle resume |
| Native UI | Splash screen logo/teks mepet ke kiri | `Center` yang hilang saat refactor dikembalikan, dikonfirmasi via screenshot device |

---

*Dokumen ini mencerminkan kondisi **working tree** (termasuk perubahan belum di-commit) per 5 Oktober 2026. Untuk status paling akurat, baca langsung kode di `app/lib/` dan `web/public/` — dokumen bisa menjadi usang seiring pengembangan lanjutan.*
