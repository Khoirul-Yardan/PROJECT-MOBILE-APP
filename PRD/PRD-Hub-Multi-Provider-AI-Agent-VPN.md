# Product Requirement Document (PRD)
## Aplikasi Mobile Hub Multi-Provider AI, AI Agent, dan VPN
**(Cross-Platform — Android & iOS via Flutter, Arsitektur Hybrid Flutter + WebView)**

> Dokumen ini adalah PRD untuk **konsep produk umum/original** (aplikasi hub AI multi-provider). Ini terpisah dari PRD Proyek Akhir kamu (`PRD-Dokumentasi-Percakapan-Perawat-Pasien.md`), yang merupakan proyek akademik dengan topik & scope berbeda (dokumentasi klinis perawat-pasien). Kedua PRD ini **tidak berkaitan** secara konsep — hanya sama-sama proyek yang sedang kamu kerjakan/rencanakan.

---

## 1. Ringkasan Produk

Aplikasi mobile cross-platform (Flutter — Android & iOS) yang berfungsi sebagai **hub terpusat** untuk mengakses berbagai provider AI (Gemini, ChatGPT, LLM lain), menjalankan AI agent (mis. OpenClaw, Hermes, dan agent framework lain), serta menyediakan koneksi VPN (OpenVPN, WireGuard, dll.) untuk menghubungkan ke server pribadi/kerja. Aplikasi menyimpan kredensial pengguna (API key, config VPN) secara aman dan mencatat seluruh aktivitas dalam sistem log.

---

## 2. Latar Belakang

Saat ini, pengguna yang ingin memakai berbagai provider AI (Gemini, ChatGPT, dsb.) dan menjalankan AI agent yang berbeda (OpenClaw, Hermes, dll.) harus berpindah-pindah aplikasi/platform. Ditambah lagi, banyak pengguna teknis yang perlu mengakses server pribadi via VPN untuk keperluan agent (mis. agent yang perlu mengakses resource internal). Kebutuhan ini tersebar di banyak aplikasi terpisah, membuat pengalaman tidak efisien dan pengelolaan kredensial (API key, config VPN) menjadi berantakan.

Aplikasi ini hadir sebagai **satu pintu masuk** untuk semua kebutuhan tersebut: provider AI, AI agent, dan koneksi VPN, dengan pengelolaan kredensial yang aman dan log aktivitas yang transparan.

---

## 3. Tujuan Produk

1. Menyediakan satu aplikasi mobile yang mengagregasi berbagai provider AI (Gemini, ChatGPT, LLM lain) dalam satu antarmuka
2. Mendukung eksekusi AI agent dari berbagai framework (OpenClaw, Hermes, dll.) dari dalam aplikasi
3. Menyediakan koneksi VPN terintegrasi (OpenVPN, WireGuard, dll.) untuk mendukung agent/provider yang butuh akses ke server tertentu
4. Menyediakan onboarding yang aman untuk pengelolaan API key dan kredensial lain
5. Mencatat seluruh aktivitas pengguna & sistem dalam log yang dapat ditinjau

---

## 4. Ruang Lingkup Fitur

### 4.1 Onboarding & Setup Awal
- Saat pertama kali membuka aplikasi, pengguna diarahkan ke halaman setup:
  - Input API key untuk provider AI (Gemini, ChatGPT, dll.) — bisa lebih dari satu, ditambah belakangan
  - Input kredensial VPN (config file/credential OpenVPN, WireGuard, dll.)
  - Kredensial lain sesuai kebutuhan agent (mis. token API pihak ketiga)
- Semua kredensial disimpan **terenkripsi** di local secure storage (Keystore/Keychain)

### 4.2 Multi-Provider AI Chat
- Pengguna dapat memilih provider aktif (Gemini/ChatGPT/LLM lain) dari satu antarmuka chat
- Pengguna dapat menambah/menghapus provider dari pengaturan
- Riwayat percakapan tersimpan per provider

### 4.3 AI Agent Hub
- Mendukung integrasi dengan agent framework seperti OpenClaw, Hermes, dan lainnya
- Pengguna dapat menjalankan agent tertentu untuk tugas otonom (mis. riset, otomasi, coding assistant, dll., tergantung kapabilitas masing-masing framework)
- Agent dapat memanfaatkan provider AI yang sudah dikonfigurasi sebagai backend-nya

### 4.4 VPN Terintegrasi
- Mendukung protokol OpenVPN dan WireGuard (dapat diperluas ke protokol lain)
- Pengguna dapat mengaktifkan/menonaktifkan koneksi VPN dari dalam aplikasi
- Status koneksi VPN ditampilkan secara real-time (terhubung/tidak, server yang dipakai)
- VPN dapat digunakan mendukung agent yang perlu mengakses server pribadi/kerja pengguna

### 4.5 Manajemen Kredensial
- Semua API key & kredensial VPN dikelola dalam satu halaman "Settings/Credentials"
- Pengguna dapat mengedit, menghapus, atau menambah kredensial baru kapan saja
- Enkripsi end-to-end untuk penyimpanan lokal; tidak ada kredensial yang dikirim ke server pihak ketiga tanpa sepengetahuan pengguna

### 4.6 Logging & Riwayat Aktivitas
- Mencatat: provider yang digunakan, agent yang dijalankan, status koneksi VPN, waktu, hasil (sukses/gagal)
- Pengguna dapat melihat & mem-filter log berdasarkan jenis aktivitas
- Log dapat digunakan untuk debugging maupun audit penggunaan pribadi

---

## 5. Kebutuhan Fungsional

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-01 | Pengguna dapat memasukkan & menyimpan API key beberapa provider AI saat onboarding | Must |
| FR-02 | Pengguna dapat memilih provider AI aktif saat chat | Must |
| FR-03 | Pengguna dapat menjalankan AI agent (mis. OpenClaw/Hermes) dari aplikasi | Must |
| FR-04 | Pengguna dapat menghubungkan VPN (OpenVPN/WireGuard) dari dalam aplikasi | Must |
| FR-05 | Status koneksi VPN ditampilkan secara real-time | Should |
| FR-06 | Kredensial (API key, config VPN) disimpan terenkripsi secara lokal | Must |
| FR-07 | Pengguna dapat mengelola (tambah/edit/hapus) kredensial dari halaman Settings | Must |
| FR-08 | Sistem mencatat log aktivitas: provider, agent, VPN, waktu, status | Must |
| FR-09 | Pengguna dapat melihat & memfilter riwayat log | Should |
| FR-10 | Aplikasi dapat menambah provider/agent baru tanpa mengubah struktur inti (arsitektur modular) | Should |
| FR-11 | Konten UI non-native (chat, agent hub, settings, log) dapat diperbarui dari server dan langsung dimuat ulang oleh WebView tanpa update aplikasi | Must |
| FR-12 | Aplikasi menyediakan mode fallback/offline saat WebView gagal memuat konten dari server | Should |

---

## 6. Kebutuhan Non-Fungsional

| ID | Kebutuhan |
|---|---|
| NFR-01 | Keamanan: seluruh kredensial (API key, VPN config) wajib terenkripsi, memakai Keystore (Android) / Keychain (iOS) — **tidak pernah** diserahkan ke lapisan WebView; hanya native shell yang memegang kredensial mentah |
| NFR-02 | Cross-platform: satu codebase Flutter (native shell) berjalan di Android & iOS |
| NFR-03 | Modularitas: penambahan provider AI atau agent framework baru cukup lewat update konten web, tanpa perubahan arsitektur inti dan **tanpa rebuild/release ulang aplikasi native** |
| NFR-04 | Reliabilitas VPN: koneksi VPN harus stabil dan dapat di-disconnect/reconnect tanpa membuat aplikasi crash |
| NFR-05 | Privasi: tidak ada data kredensial pengguna yang dikirim ke server milik aplikasi tanpa izin eksplisit |
| NFR-06 | Performa: pergantian antar-provider AI dalam chat harus instan tanpa reload aplikasi |
| NFR-07 | Updatability: konten UI/logika bisnis non-native (chat, agent hub, settings) dapat diperbarui dari server (OTA content update) tanpa submit ulang ke App Store/Play Store |
| NFR-08 | Ketersediaan offline: fitur inti (VPN connect/disconnect, akses kredensial tersimpan) tetap berfungsi walau WebView gagal memuat konten (mode offline/fallback) |
| NFR-09 | Keamanan WebView: seluruh trafik WebView wajib HTTPS dengan pinning ke domain resmi; JS bridge dibatasi origin whitelist untuk mencegah injeksi dari konten pihak ketiga |

---

## 7. Arsitektur Sistem (Gambaran Umum)

### 7.1 Pendekatan Hybrid: Flutter Native Shell + WebView

Untuk mendukung kebutuhan **"build sekali, tetap bisa diupdate tanpa build ulang"**, aplikasi menggunakan arsitektur **hybrid Flutter + WebView**:

- **Native Shell (Flutter, dikompilasi sekali ke Android/iOS)** menangani bagian yang *harus* native karena butuh akses OS-level atau keamanan tinggi:
  - Secure Credential Store (Keystore/Keychain)
  - VPN Manager (OpenVPN/WireGuard — butuh VPN service/permission tingkat OS)
  - Push notification, biometric lock, navigasi bawah (bottom nav), splash screen
  - WebView container (`webview_flutter` / `flutter_inappwebview`) sebagai host konten
- **Web Layer (HTML/JS/CSS, di-hosting di server & di-load via WebView)** menangani bagian yang sering berubah dan tidak butuh akses native langsung:
  - Multi-Provider AI Chat UI & logic pemanggilan API provider
  - AI Agent Hub (daftar agent, konfigurasi, tampilan progres eksekusi)
  - Settings/Credentials UI (form input — data dikirim ke native lewat bridge, **bukan** disimpan di layer web)
  - Activity Log viewer
- **JS Bridge (native ↔ web)**: jembatan komunikasi dua arah antara Flutter dan WebView (mis. `JavascriptChannel` / `postMessage`) untuk:
  - Web meminta native menyimpan/membaca kredensial terenkripsi (tanpa kredensial pernah "lewat" di layer JS dalam bentuk plain di luar sesi aktif)
  - Web meminta native connect/disconnect VPN & menerima status real-time
  - Native mengirim event (status VPN, hasil agent) ke web untuk update UI

**Keuntungan pendekatan ini:**
1. Build & rilis ke App Store/Play Store **hanya dilakukan sekali** untuk shell native — perubahan UI, penambahan provider AI/agent baru, perbaikan bug tampilan, dsb. cukup update konten web di server, langsung terlihat oleh semua pengguna tanpa perlu update aplikasi.
2. Fungsi sensitif (VPN, penyimpanan kredensial) tetap 100% native — aman dan sesuai kebijakan store.
3. Iterasi produk jadi jauh lebih cepat karena tidak terikat siklus review App Store/Play Store untuk setiap perubahan non-native.

**Batasan yang perlu diperhatikan:**
- Perubahan yang menyentuh permission native baru (mis. protokol VPN baru yang butuh library native tambahan) tetap butuh update aplikasi via store.
- WebView harus punya mode fallback/offline jika gagal memuat konten dari server (lihat NFR-08).
- Perlu strategi versioning konten web (kompatibel dengan bridge API versi native yang terpasang) agar tidak terjadi mismatch antara shell lama dan konten web baru.

```
┌─────────────────────────────────────────────────────────────────┐
│                     FLUTTER NATIVE SHELL                        │
│                (dikompilasi sekali per rilis store)              │
│                                                                   │
│  ┌───────────────────────┐        ┌───────────────────────────┐ │
│  │  Onboarding & Setup    │        │   Secure Credential Store  │ │
│  │ (API Key, Kred. VPN)   │───────▶│  (Keystore/Keychain,        │ │
│  └───────────────────────┘        │   terenkripsi)              │ │
│                                    └──────────────┬──────────────┘ │
│                                                   │                │
│  ┌───────────────────────┐        ┌───────────────▼──────────────┐│
│  │     VPN Manager        │◀──────▶│        JS Bridge              ││
│  │ (OpenVPN, WireGuard)   │        │  (native ↔ web, 2 arah)       ││
│  └───────────────────────┘        └───────────────┬──────────────┘│
│                                                   │                │
│                                    ┌───────────────▼──────────────┐│
│                                    │      WebView Container        ││
│                                    └───────────────┬──────────────┘│
└────────────────────────────────────────────────────┼───────────────┘
                                                       │ HTTPS (pinned)
                                                       ▼
                              ┌────────────────────────────────────┐
                              │           WEB LAYER (server)         │
                              │  - Multi-Provider AI Chat UI         │
                              │  - AI Agent Hub UI                   │
                              │  - Settings/Credentials form         │
                              │  - Activity Log viewer               │
                              │  (di-update kapan saja tanpa rebuild) │
                              └───────────────────┬───────────────────┘
                                                   │
                        ┌──────────────────────────┼──────────────────────────┐
                        ▼                          ▼                          ▼
               ┌───────────────┐         ┌───────────────────┐       ┌───────────────┐
               │ Provider AI    │         │   AI Agent Hub     │       │  Logging       │
               │ (Gemini, GPT,  │         │ (OpenClaw, Hermes, │       │  Service       │
               │  LLM lain)     │         │  dll.)             │       │ (semua aktivitas)│
               └───────────────┘         └───────────────────┘       └───────────────┘
```

---

## 8. Alur Pengguna (User Flow)

### 8.1 Onboarding (Pertama Kali)
1. Splash screen → Welcome
2. Setup API key provider AI (minimal 1, bisa tambah nanti)
3. (Opsional) Setup kredensial VPN
4. Masuk ke Home — pilih provider default

### 8.2 Chat dengan Provider AI
1. Pengguna pilih provider dari dropdown/menu
2. Kirim pesan → diteruskan ke provider terpilih
3. Respons ditampilkan, riwayat tersimpan per provider

### 8.3 Menjalankan AI Agent
1. Pengguna pilih agent (mis. OpenClaw) dari daftar agent tersedia
2. Berikan instruksi/tugas ke agent
3. Agent dapat memanggil provider AI & (jika perlu) mengakses server via VPN
4. Hasil ditampilkan, log tercatat otomatis

### 8.4 Mengelola VPN
1. Pengguna pilih server/config VPN dari Settings
2. Tekan "Connect" → status real-time ditampilkan
3. Agent yang butuh akses server dapat berjalan selama VPN aktif

---

## 9. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Kebocoran API key/kredensial | Penyalahgunaan akun pengguna | Enkripsi wajib (Keystore/Keychain), tidak pernah log kredensial dalam bentuk plain text |
| Ketergantungan pada banyak provider eksternal (rate limit, downtime) | Fitur chat/agent terganggu | Tampilkan status provider, fallback/pesan error yang jelas ke pengguna |
| Kompleksitas dukungan multi-VPN protocol | Bug koneksi, waktu development molor | Mulai dari 1 protokol (mis. WireGuard) sebagai MVP, tambah OpenVPN & lainnya bertahap |
| Kebijakan App Store/Play Store terkait VPN & AI agent otonom | Aplikasi ditolak saat review | Riset kebijakan platform sejak awal, terutama untuk fitur VPN (butuh deklarasi & justifikasi jelas) dan agent otonom (batasi otonomi/beri kontrol eksplisit ke pengguna) |
| WebView memuat konten dinamis dari server — berpotensi disalahgunakan untuk bypass review store (dianggap "remote code execution") | Aplikasi ditolak/di-takedown dari store | Batasi WebView hanya untuk UI & logic non-sensitif (bukan mengubah fungsi inti native seperti VPN/kredensial); domain konten di-whitelist & di-pin; dokumentasikan dengan jelas ke reviewer store sesuai guideline (App Store 4.7 / Play Console) |
| Mismatch versi antara native shell lama dan konten web baru (breaking change di bridge API) | Fitur error/crash pada pengguna yang belum update shell | Versioning eksplisit pada bridge API & konten web; server mendeteksi versi shell dan menyajikan konten kompatibel atau versi minimum shell |
| WebView gagal load (jaringan buruk, server down) | Fitur chat/agent/settings tidak bisa diakses | Sediakan mode fallback/offline (NFR-08) dengan pesan error jelas & retry otomatis |

---

## 10. Kesimpulan

PRD ini menggambarkan aplikasi hub AI multi-provider dengan dukungan AI agent dan VPN terintegrasi, dibangun cross-platform dengan Flutter menggunakan **arsitektur hybrid native shell + WebView**. Fokus utama produk adalah **agregasi & kemudahan akses**: satu aplikasi, banyak provider/agent, kredensial terkelola aman, dan log aktivitas transparan — dikembangkan secara modular agar mudah menambah provider atau agent framework baru di masa depan **tanpa perlu build/rilis ulang ke App Store/Play Store** untuk sebagian besar perubahan, sementara fungsi sensitif (VPN, penyimpanan kredensial) tetap dijaga sepenuhnya native untuk keamanan dan kepatuhan kebijakan platform.
