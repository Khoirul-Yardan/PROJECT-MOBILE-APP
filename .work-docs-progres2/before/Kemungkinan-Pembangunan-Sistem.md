# Kemungkinan Pembangunan Sistem — AI Hub

> Dokumen ini menakar **apakah AI Hub (dengan arsitektur hybrid Flutter-shell + WebView + Docker yang sudah dibangun) bisa dikembangkan lebih jauh** ke arah hub AI serbaguna dengan konsep **"semua lewat API"**: satu kolom input API universal (auto-deteksi jenisnya, entah provider chat biasa atau agentic AI), menu Chat yang bebas dipakai dengan provider AI apapun atau agent apapun, menu Bot yang punya sistemnya sendiri terpisah dari chat/agent, dan VPN yang field-nya sesuai protokol sungguhan. Untuk tiap topik: **status saat ini → apakah bisa dibangun → seberapa sulit → alternatif desain → rekomendasi.**
>
> Konteks kode dirujuk dari `app/lib/`, `web/public/`, dan `app/supabase/schema.sql` per 27 Sept 2026. Lihat juga `docs/RINCIAN-SISTEM.md` (arsitektur umum) dan `web/README.md` (kontrak bridge).

---

## 1. Ringkasan Eksekutif

**Kesimpulan singkat: bisa dibangun**, dan konsep yang Anda mau — **satu pintu masuk API universal, provider & agent setara sebagai "target chat", Bot punya jalur sendiri** — justru lebih rapi daripada desain sebelumnya (yang masih per-provider punya menu pengaturan API sendiri-sendiri). Ini butuh perubahan cukup mendasar di tiga tempat:

1. **Model data kredensial** — dari `enum AiProvider { openai, anthropic, gemini }` yang statis, jadi **registry dinamis** (tabel provider/agent yang bisa dikenali dari pola API key, bukan daftar tetap 3 pilihan).
2. **Menu Agent** — dari kartu simulasi ("Code Agent", "Data Agent", dst. yang cuma menampilkan log palsu) jadi **daftar sistem agentic sungguhan** (Hermes, OpenClaw, dan sejenisnya) yang saat diklik **membuka Chat** dengan agent itu sebagai lawan bicara — bukan layar terpisah.
3. **VPN** — dari satu bentuk form generik (`host/port/username/password`) jadi **form yang berubah sesuai protokol** (WireGuard beda field-nya dari OpenVPN, beda lagi dari SSH).

| Area | Status sekarang | Konsep yang diminta | Bisa dibangun? | Effort |
|---|---|---|---|---|
| Input API key | Per-provider, menu terpisah (harus pilih provider dulu) | Satu kolom universal, auto-deteksi jenis key | Ya | Sedang (3-5 hari) |
| Menu "Agent" | Kartu simulasi (Content/Data/Planner Agent) | Daftar agentic AI (Hermes, OpenClaw, dst.) via API, klik → masuk Chat | Ya | Sedang (agent yang expose API HTTP biasa: mudah; yang butuh runtime sendiri: lebih berat, lihat §3) |
| Chat sebagai satu pintu | Sudah unified AI+Friend, tapi provider masih dropdown tetap 3 pilihan | Chat bisa pilih **provider apa saja atau agent apa saja** yang sudah didaftarkan user | Ya | Kecil-Sedang (perluasan dari yang sudah ada) |
| Bot (Bot BPJS, dst.) | Sudah terpisah dari chat, alur sendiri | Tetap terpisah — dipertegas | Sudah sesuai | - |
| VPN protokol-spesifik | Satu form generik untuk semua protokol | Form berbeda per protokol (WireGuard/OpenVPN/SSH) | Ya | Sedang (2-4 hari untuk form + model data; native plugin sungguhan tetap effort besar terpisah, lihat §7) |

---

## 2. Konsep Inti: "Semua Lewat API" + Input Universal

### Apa yang diminta
Saat pertama kali pakai app, user **tidak perlu masuk ke menu spesifik per-provider** ("masuk ke menu Gemini dulu, baru tempel API key Gemini"). Sebaliknya: **satu kolom "Tempel API Key"** di mana pun user berada (onboarding, Settings, atau bahkan langsung dari Chat saat belum ada key) — user tempel key apa saja (ChatGPT, Gemini, Claude, OpenRouter, atau bahkan API dari layanan agentic seperti Hermes/OpenClaw), **sistem yang mengenali sendiri itu key dari mana**, lalu otomatis tersambung dan langsung bisa dipakai. Kalau sistem tidak yakin, baru user dikasih pilihan manual "Ini API dari mana?" / "Ini tipe apa — provider chat atau agent?".

### Kenapa ini bisa dibangun — dan bagaimana caranya
Setiap provider/vendor API key punya **pola yang bisa dikenali** (prefix, panjang, struktur). Ini bukan hal baru — banyak tool developer (mis. GitHub secret scanning, 1Password) melakukan persis ini: mendeteksi jenis credential dari bentuknya. Beberapa contoh pola nyata yang bisa dipakai sebagai titik awal:

| Provider/Agent | Pola API key (indikatif) | Catatan |
|---|---|---|
| OpenAI | `sk-...` (panjang ~51 karakter, kadang `sk-proj-...`) | Prefix `sk-proj-` = project-scoped key (OpenAI generasi baru) |
| Anthropic (Claude) | `sk-ant-...` | Prefix jelas beda dari OpenAI |
| Google Gemini | `AIzaSy...` (39 karakter, diawali `AIza`) | Pola sama dipakai semua Google API key, bukan cuma Gemini — perlu penanda tambahan (lihat di bawah) |
| OpenRouter | `sk-or-v1-...` | Prefix unik, gampang dikenali |
| Hermes / OpenClaw / agent lain | **Bervariasi** — kalau vendor pakai format sendiri, mungkin tidak berupa "key" tapi kombinasi endpoint URL + token | Perlu fallback manual (lihat di bawah) |

**Desain konkret ("Universal Key Input"):**
1. **Registry provider** (bukan `enum` statis lagi) — tabel/daftar konfigurasi di `web/public/providers.js` (baru), tiap entri: `{ id, label, type: 'chat' | 'agent', keyPattern: RegExp, endpointTemplate, icon }`. Menambah provider/agent baru = tambah satu entri di sini, bukan ubah enum Dart + enum JS + UI di banyak tempat seperti sekarang.
2. **Detector** — fungsi `detectProvider(rawKey)` yang mencocokkan `rawKey` ke `keyPattern` tiap entri registry, urut dari pola paling spesifik ke paling umum. Kalau cocok satu → langsung simpan & konfirmasi ke user ("Terdeteksi: OpenRouter ✓"). Kalau cocok lebih dari satu atau tidak cocok sama sekali → tampilkan **dropdown manual** singkat: "Sepertinya ini API key. Ini dari mana?" dengan daftar registry + opsi "Agent/Sistem lain (isi manual)" yang minta user isi label + endpoint URL sendiri (untuk agent custom yang tidak dikenal sistem).
3. **Satu input, di mana saja** — komponen `views/add-api-key.js` (atau modal, bukan halaman penuh) yang bisa dipanggil dari: (a) onboarding pertama kali, (b) Settings, (c) tombol "+" langsung di dalam Chat kalau user belum punya provider/agent apapun. Bukan "menu Gemini", "menu OpenAI" terpisah-pisah.
4. **Penyimpanan tetap native** (prinsip lama dipertahankan: key tidak boleh nangkring di WebView) — tapi `AiProviderService` di Dart berubah dari method per-enum jadi **generic key-value store** (`saveApiKey(String providerId, String key)`), karena daftar provider sekarang dinamis, bukan 3 pilihan tetap.

### Yang perlu disadari (batasan realistis)
- **Deteksi otomatis tidak akan 100% akurat untuk semua vendor selamanya** — pola key bisa berubah (vendor rotasi format), dan agent/layanan kecil yang tidak populer mungkin tidak punya pola yang gampang dikenali sama sekali. Karena itu **fallback manual wajib ada**, bukan opsional — sistem ini "auto-deteksi dengan jaring pengaman", bukan "auto-deteksi tanpa cela".
- Untuk agent yang butuh lebih dari satu credential (mis. API key + endpoint URL kustom + model ID), form manual perlu sedikit lebih dari satu kolom — tapi tetap dalam **satu alur yang sama**, bukan menu terpisah per-agent.

### Rekomendasi
Ini realistis dan sejalan dengan prinsip yang sudah dipakai (key disimpan native, dipakai sesaat, tidak pernah di web). Prioritas tinggi karena langsung mengubah pengalaman "banyak klik per provider" jadi "tempel sekali, jalan". Effort ±3-5 hari: registry + detector + komponen input + migrasi `AiProviderService` dari enum ke key dinamis.

---

## 3. Menu "Agent" — Diperjelas: Bukan Kartu Tugas, tapi Sistem Agentic via API

### Koreksi konsep dari desain sebelumnya
Draf sebelumnya (`web/public/views/bots.js`, kartu "Research Agent", "Code Agent", "Content Agent", dst.) adalah **simulasi tugas** — cuma menampilkan daftar log palsu (`"Initializing..."`, `"Task completed"`) tanpa benar-benar memanggil apa pun. Itu **bukan** yang dimaksud "Agent" di konsep baru ini.

**Yang benar sesuai permintaan:** menu Agent berisi **sistem/layanan agentic AI sungguhan** yang diakses lewat API — contohnya **Hermes** (baik sebagai model lewat OpenRouter, atau sebagai layanan agent hosted kalau vendornya menyediakan endpoint agent), **OpenClaw**, atau agent framework lain yang punya API publik. Ini sejajar konsepnya dengan provider AI biasa (ChatGPT, Gemini) — **sama-sama "sesuatu yang dipanggil pakai API key"** — bedanya provider biasa jawab satu kali per pesan, agent bisa menjalankan langkah berganda di baliknya (tergantung implementasi vendornya sendiri, bukan sesuatu yang AI Hub perlu bangun sendiri kalau agent-nya sudah punya API hosted).

### Alur yang diminta: klik Agent → masuk Chat, pakai agent itu
Ini **perubahan UX yang bagus dan konsisten** dengan pola yang sudah ada di Chat sekarang (pemilih "AI Assistant" vs teman). Perluasannya:

```
Chat — pemilih target (diperluas dari yang sudah ada):
┌─────────────────────────────────────────────┐
│ [ChatGPT] [Gemini] [Hermes] [OpenClaw] [Budi]│  ← provider, agent, dan teman
│    ▲ provider AI      ▲ agent        ▲ friend│     semua jadi "chip" yang setara
└─────────────────────────────────────────────┘
```
- **Provider AI dan Agent diperlakukan setara** sebagai target chat — user bebas pilih, tidak ada hierarki "agent itu menu terpisah yang lebih ribet". Ini persis yang Anda minta: "terserah user mau pakai agent atau provider AI, bebas di situ."
- Secara teknis: baik provider biasa maupun agent, keduanya tinggal masuk ke **registry yang sama** dari §2 (`type: 'chat'` untuk provider biasa, `type: 'agent'` untuk yang agentic) — `chat.js` yang sudah ada sekarang **tidak perlu dirombak total**, cukup diperluas: pemilihnya baca dari registry dinamis (bukan 3 provider hardcoded + friend list terpisah), dan `ai.js`/bridge memanggil endpoint sesuai `endpointTemplate` milik entri itu, bukan `switch (provider) { case 'openai': ... }` yang statis.
- Menu **katalog Agent** (`views/bots.js` bagian atas, terpisah dari Bot) jadi **daftar agent yang sudah didaftarkan user** (dari registry) + tombol "Tambah Agent" yang membuka input universal (§2). Klik satu agent di katalog → `navigate('/chat?target=hermes')` → Chat langsung terbuka dengan agent itu terpilih.

### Kalau agent-nya tidak punya API hosted (misal mau jalankan Hermes/OpenClaw sendiri di server)
Ini beda kasus dari "agent yang sudah ada API-nya" — kalau frameworknya perlu dijalankan sendiri (self-hosted), itu baru masuk kategori `agent-svc` (komponen backend baru, lihat pembahasan detail di dokumen versi sebelumnya soal Docker container tambahan) — bukan sekadar "tempel API key". Untuk kebanyakan kasus yang disebut user (Hermes lewat OpenRouter, OpenClaw kalau punya API publik), **cukup didaftarkan sebagai entri registry biasa**, tidak perlu backend baru.

### Rekomendasi
Perluas `chat.js` dan registry dari §2 supaya provider & agent sama-sama muncul sebagai chip target chat. Hapus/ganti total konsep kartu simulasi tugas di `bots.js` bagian agent (pindahkan jadi bagian "Agent Hub" yang isinya daftar agent terdaftar, bukan simulasi). Effort kecil-sedang karena numpang pada pola Chat yang sudah ada — bukan fitur baru dari nol.

---

## 4. Bot — Dipertegas Tetap Terpisah dengan Sistemnya Sendiri

Konfirmasi: **Bot (seperti Bot BPJS) memang harus tetap terpisah dari Chat/Agent**, dan desain yang sudah ada sekarang **sudah benar** soal ini — tidak perlu diubah konsepnya, cuma perlu dipertegas supaya tidak tercampur secara UI dengan Agent setelah §3 di atas diterapkan.

### Beda mendasar Bot vs Agent/Provider
| | Provider AI / Agent (§2, §3) | Bot (Bot BPJS, dst.) |
|---|---|---|
| Cara pakai | Chat bebas, user yang arahkan percakapan | **Alur tetap** (fixed flow) — mis. Bot BPJS: wake word → rekam → transkrip → ringkasan → kirim ke dokter |
| Akses | Lewat API key milik user | Bisa pakai API key yang sama di baliknya, tapi **dibungkus logika/UI khusus**, bukan chat bebas |
| Kapabilitas native | Umumnya tidak perlu (teks saja) | Sering butuh (mikrofon untuk Bot BPJS, kamera untuk bot OCR, dst.) |
| Tempat di menu | Chip di dalam Chat | **Layar/sistem sendiri**, diklik dari katalog Bot → buka alur khususnya, bukan masuk Chat |

### Implementasi yang sudah sesuai
`web/public/views/bots.js` + `Native.openBotBpjs()` di `web_shell_screen.dart` **sudah mengikuti pola yang benar**: klik Bot BPJS tidak masuk Chat, tapi membuka layar/alur native khusus. Untuk bot teks baru non-BPJS (Bot FAQ, Bot Penerjemah) yang tidak butuh native, tetap bisa berupa "mini-app" sendiri dengan UI khusus (misal Bot Penerjemah: dua kotak teks kiri-kanan + tombol translate, bukan bubble chat biasa) — bukan diseret masuk jadi salah satu chip di Chat.

### Rekomendasi
Setelah §3 diterapkan (agent jadi bagian dari Chat), **pisahkan tampilan katalog**: satu bagian untuk "Agent & Provider" (masuk ke Chat saat diklik), satu bagian terpisah untuk "Bot" (masuk ke layar/sistem sendiri saat diklik) — supaya user tidak bingung dua konsep yang beda cara pakainya digabung visual jadi satu grid seperti sekarang.

---

## 5. Registry Provider/Agent — Rancangan Teknis Ringkas

Supaya §2-§4 di atas konsisten dan tidak jadi wacana, berikut bentuk konkret registry yang disarankan (`web/public/providers.js`, baru):

```js
export const REGISTRY = [
  {
    id: 'openai', label: 'ChatGPT (OpenAI)', type: 'chat',
    keyPattern: /^sk-(proj-)?[A-Za-z0-9]{20,}$/,
    endpoint: 'https://api.openai.com/v1/chat/completions',
  },
  {
    id: 'anthropic', label: 'Claude (Anthropic)', type: 'chat',
    keyPattern: /^sk-ant-/,
    endpoint: 'https://api.anthropic.com/v1/messages',
  },
  {
    id: 'gemini', label: 'Gemini (Google)', type: 'chat',
    keyPattern: /^AIza[0-9A-Za-z_-]{35}$/,
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
  },
  {
    id: 'openrouter', label: 'OpenRouter', type: 'chat',
    keyPattern: /^sk-or-v1-/,
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  },
  {
    id: 'hermes', label: 'Hermes', type: 'agent',
    keyPattern: null, // tidak ada pola baku — selalu lewat konfirmasi manual
    endpoint: null,   // diisi user saat pendaftaran manual (bisa lewat OpenRouter atau endpoint sendiri)
  },
  // Agent/provider custom yang didaftarkan manual oleh user disimpan
  // dengan struktur yang sama, id di-generate (mis. slug dari label).
];
```

- **Native side**: `AiProviderService` (Dart) tidak lagi punya `enum AiProvider` tetap — cukup `Map<String, String>` (providerId → key) di secure storage, plus satu tabel kecil di Supabase (`ai_providers` milik user: id, label, type, endpoint, dibuat kapan) supaya daftar provider/agent yang sudah didaftarkan **ikut sinkron** kalau user ganti device (key-nya sendiri tetap cuma di secure storage device itu, tapi *daftar apa saja yang pernah didaftarkan* bisa disinkronkan supaya UI tidak kosong di device baru sampai user isi ulang key-nya).
- **Web side**: `ai.js` yang sekarang punya `callOpenAi/callAnthropic/callGemini` terpisah bisa disatukan jadi satu `callGeneric(entry, apiKey, history)` untuk provider yang formatnya kompatibel OpenAI (kebanyakan agent modern ikut format ini), dengan override kecil untuk yang beda format (Anthropic, Gemini tetap butuh fungsi sendiri karena skema request/response-nya memang beda struktur, bukan cuma beda URL).

### Rekomendasi
Bangun registry ini **sebelum** implementasi UI universal input (§2) — registry adalah fondasi data-nya, UI tinggal baca dari situ. Effort gabungan §2+§3+§5: **±1-1.5 minggu** untuk versi solid (deteksi + fallback manual + Chat terintegrasi + registry tersinkron).

---

## 6. Konsep Chat & Sistem Skill (dipertahankan dari analisis sebelumnya, disesuaikan)

Bagian ini tetap relevan dari analisis awal, dengan penyesuaian kecil mengikuti §3: pemilih target Chat sekarang mencakup **provider + agent + teman** (bukan cuma "AI Assistant" tunggal + teman seperti sebelumnya).

**Yang sudah kuat (tidak berubah):**
- Unified Chat (sekarang makin unified: provider, agent, DAN teman semua di satu pemilih).
- Toggle AI saat ngobrol dengan teman (privat, tidak terkirim ke teman).
- Realtime via Supabase.

**Yang perlu ditambah:**
- Riwayat chat per-provider/agent sebaiknya disimpan ke Supabase (tabel `ai_conversations`), bukan cuma in-memory — makin penting sekarang karena user bisa punya banyak provider+agent sekaligus, riwayat hilang tiap reload akan terasa lebih mengganggu dibanding sebelumnya (dulu cuma 1 percakapan AI, sekarang bisa banyak).
- **Skill/tool-calling** (function calling) — konsepnya tidak berubah dari analisis sebelumnya: didukung native oleh hampir semua provider chat modern (format OpenAI-compatible), jadi begitu registry (§5) berdiri, menambahkan `tools` ke body request tinggal ditambahkan di `callGeneric()` — tidak perlu komponen terpisah untuk skill dasar.

---

## 7. Friend System (tidak berubah dari analisis sebelumnya)

Kesimpulan sebelumnya tetap berlaku: **desain sudah cukup bagus untuk MVP**, RLS terjaga, terintegrasi rapi dengan Chat. Catatan perbaikan (notifikasi push, username unik, anti-spam, status online) masih relevan sebagai *polish*, bukan cacat mendasar — lihat versi sebelumnya dokumen ini untuk detail tabelnya (tidak diulang di sini karena tidak ada perubahan konsep).

---

## 8. VPN — Form Harus Sesuai Protokol Sungguhan

### Masalah pada desain sebelumnya
`VpnConfig` saat ini (`vpn_config_service.dart`) cuma satu bentuk generik:
```dart
class VpnConfig {
  final String protocol; // 'OpenVPN' | 'WireGuard' | 'SSH (Termius-style)'
  final String host;
  final String port;
  final String username;
  final String password;
}
```
Ini **tidak sesuai kebutuhan nyata tiap protokol** — `username`/`password` cocok untuk SSH atau OpenVPN dengan autentikasi password, tapi **WireGuard sama sekali tidak pakai username/password**. WireGuard berbasis **kunci kriptografi** (key pair), bukan kredensial login.

### Field yang benar per protokol

**WireGuard** (berbasis key pair, bukan login):
```dart
class WireGuardConfig {
  final String privateKey;      // kunci privat device ini (base64, 44 char)
  final String publicKey;       // kunci publik server/peer tujuan
  final String endpoint;        // host:port server WireGuard, mis. "vpn.example.com:51820"
  final String allowedIPs;      // mis. "0.0.0.0/0" (semua trafik) atau subnet spesifik
  final String? presharedKey;   // opsional, lapisan keamanan tambahan
  final String dns;             // mis. "1.1.1.1"
  final int persistentKeepalive; // detik, mis. 25 — penting untuk device di belakang NAT (HP)
}
```

**OpenVPN** (biasanya berbasis file config `.ovpn` yang sudah berisi sertifikat, bukan field terpisah):
```dart
class OpenVpnConfig {
  final String ovpnFileContent;   // isi file .ovpn lengkap (embed cert/key client)
  final String? username;         // hanya kalau server pakai auth tambahan (user/pass di atas cert)
  final String? password;
}
```
*(Alternatif form manual field-by-field seperti host/port/cipher juga valid untuk setup lanjutan, tapi mayoritas provider OpenVPN mendistribusikan file `.ovpn` siap pakai — UI sebaiknya utamakan "import file .ovpn" ketimbang isi form manual.)*

**SSH tunnel** (yang selama ini dilabeli "Termius-style" di UI):
```dart
class SshTunnelConfig {
  final String host;
  final int port;                 // default 22
  final String username;
  final String? password;         // salah satu dari password/privateKey
  final String? privateKey;       // format OpenSSH/PEM
  final int localPort;            // port lokal yang di-forward
  final int remotePort;           // port tujuan di server
}
```

### Perubahan yang perlu dilakukan
1. **Model data**: ganti `VpnConfig` generik jadi *sealed class*/union per protokol (Dart 3 sudah mendukung `sealed class` — cocok dipakai di sini), atau minimal simpan sebagai `Map<String, dynamic>` dengan skema berbeda per `protocol` (lebih fleksibel tapi kurang type-safe).
2. **Form web** (`views/vpn-config.js`): field yang ditampilkan **berubah dinamis** begitu user pilih protokol — pilih WireGuard → muncul field private/public key + endpoint; pilih OpenVPN → muncul tombol "Upload file .ovpn"; pilih SSH → muncul field host/port/username + pilihan password atau private key.
3. **Native bridge**: `save_vpn_config`/`get_vpn_config` tetap generic di level bridge (terima/kirim JSON apa saja), tapi validasi bentuknya sesuai protokol dilakukan di masing-masing sisi (web saat submit form, native saat mau dipakai beneran oleh plugin VPN).
4. Ini **baru soal bentuk data & form** — untuk koneksi VPN yang **sungguhan jalan** (bukan simulasi seperti sekarang), tetap perlu plugin native per protokol (`wireguard_flutter` untuk WireGuard, dst.) seperti sudah dibahas di analisis sebelumnya; memperbaiki bentuk field ini adalah **prasyarat** sebelum plugin native itu bisa dipasang dengan benar (plugin WireGuard butuh persis field-field di atas, tidak bisa jalan cuma dari `host/port/username/password`).

### Rekomendasi
Perbaiki model data & form dulu (±2-4 hari, murni struktur data + UI, tidak perlu plugin native) supaya kalau nanti plugin VPN sungguhan dipasang (§7 di analisis versi sebelumnya — WireGuard direkomendasikan duluan), field yang dibutuhkan **sudah tersedia dan benar**, tidak perlu bongkar ulang model data di tengah jalan.

---

## 9. Roadmap yang Disarankan (diperbarui sesuai konsep baru)

1. **Registry provider/agent** (§5) — fondasi data. *±2-3 hari.*
2. **Input API universal + auto-deteksi** (§2) — langsung terasa manfaatnya, mengurangi friksi onboarding. *±2-3 hari (di atas registry).*
3. **Chat: provider + agent + teman dalam satu pemilih** (§3, §6) — perluasan dari yang sudah ada. *±3-5 hari.*
4. **Pisahkan tampilan katalog Agent vs Bot** (§4) — supaya dua konsep beda tidak tercampur visual. *±1-2 hari.*
5. **VPN: model data & form per protokol** (§8) — prasyarat sebelum plugin native. *±2-4 hari.*
6. **Riwayat chat tersimpan ke Supabase** (§6) — polish yang makin penting dengan banyak provider/agent. *±2-3 hari.*
7. **Skill/tool-calling dasar** (§6) — begitu registry berdiri, tinggal tambah field `tools`. *±3-5 hari.*
8. **Plugin VPN native sungguhan** (WireGuard duluan) — pekerjaan besar terpisah, mulai setelah langkah 5 selesai. *±1-2 minggu.*
9. **Bot teks baru & agent-svc untuk agent self-hosted** — sesuai kebutuhan, tidak mem-block langkah lain.

---

## 10. Kesimpulan

Konsep yang Anda mau — **satu pintu API universal, provider dan agent setara sebagai target chat, Bot tetap punya jalurnya sendiri, VPN sesuai protokol sungguhan** — **bisa dibangun di atas fondasi yang sudah ada**, dan sebenarnya membuat arsitekturnya **lebih bersih** dibanding desain sebelumnya yang masih menganggap tiap provider adalah pilihan tetap terpisah. Perubahan intinya ada di satu tempat: **ganti enum/daftar statis jadi registry dinamis** (§5) — begitu itu berdiri, input universal (§2), Chat multi-target (§3), dan skill (§6) semuanya numpang di fondasi yang sama. VPN (§8) adalah pekerjaan terpisah yang tidak tergantung ke registry, bisa dikerjakan paralel.
