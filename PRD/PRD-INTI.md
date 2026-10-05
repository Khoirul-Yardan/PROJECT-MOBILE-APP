# PRD Inti — AI Hub

> **Status: dokumen acuan utama**, ditulis per **5 Oktober 2026** langsung dari sistem yang sudah berjalan (bukan rencana). Menggantikan tiga PRD lama (`PRD-Hub-Multi-Provider-AI-Agent-VPN.md`, `PRD-AI-Hub-Jarvis-BPJS.md`, `PRD-Dokumentasi-Percakapan-Perawat-Pasien.md`) sebagai **acuan fitur yang berlaku** — ketiganya tetap disimpan sebagai arsip sejarah/konteks tujuan awal, tapi berisi fitur yang **sudah dihapus** (Friend System, wake word "Halo Jarvis", TTS, review-dokter-berbasis-akun) dan tidak lagi mencerminkan produk sebenarnya.
>
> Untuk detail teknis (diagram alur, status tiap fitur, skema database) lihat `docs/diagram-alur.md`. Untuk evaluasi arsitektur (apa yang terbukti benar/meleset setelah dibangun) lihat `docs/RINCIAN-SISTEM.md`. Dokumen ini fokus ke **requirement produk**: apa yang harus dilakukan sistem, untuk siapa, dan kenapa.

---

## 1. Ringkasan Produk

**AI Hub** adalah aplikasi mobile Android yang menjadi hub terpusat untuk:
- Mengobrol dengan berbagai provider AI (ChatGPT, Claude, Gemini, OpenRouter) dan agent (Hermes, OpenClaw) lewat satu antarmuka, dengan API key milik pengguna sendiri (*bring-your-own-key*).
- Menghubungkan VPN pribadi (WireGuard real, OpenVPN/SSH sebagai config).
- Mendokumentasikan percakapan perawat-pasien secara otomatis lewat **Bot BPJS** — rekam suara, dapat draf dokumentasi dari AI, edit, lalu kirim ke dokter lewat kanal apa pun yang sudah dipakai (WhatsApp, email, cetak).

Arsitekturnya **hybrid**: hampir seluruh UI berjalan sebagai SPA web (disajikan container Docker nginx) yang dimuat dalam satu WebView persisten di dalam shell Flutter. Hanya fungsi yang betul-betul butuh akses OS (mikrofon, VPN, secure storage) yang tetap native. Ini memungkinkan hampir semua perbaikan dan fitur baru dirilis lewat `docker compose up --build`, tanpa submit ulang ke Play Store.

---

## 2. Tujuan & Non-Tujuan

### 2.1 Tujuan

1. Satu aplikasi untuk berganti-ganti provider/agent AI tanpa harus membuka banyak aplikasi terpisah.
2. Pengguna bebas memakai API key sendiri (tidak ada server AI Hub yang jadi perantara/biaya tambahan) — kunci dienkripsi dan disinkronkan lewat akun, bukan hanya tersimpan di satu device.
3. Bot BPJS mempercepat dokumentasi klinis perawat-pasien secara nyata di lapangan, tanpa menambah syarat administratif baru (akun dokter, approval, dsb.) yang justru menghambat pemakaian.
4. VPN bawaan untuk akses jaringan pribadi, dengan WireGuard sebagai protokol utama yang benar-benar berfungsi.
5. Iterasi produk cepat — mayoritas fitur bisa diperbarui tanpa rilis ulang aplikasi ke store.

### 2.2 Non-Tujuan (sengaja tidak dikerjakan)

- **Bukan** platform sosial/pertemanan — Friend System sempat ada lalu **dihapus total** karena menambah friksi tanpa manfaat sepadan.
- **Bukan** penyedia model AI sendiri — semua panggilan AI memakai API key milik pengguna, langsung ke vendor (tidak ada proxy/server AI Hub yang menangani request).
- **Bukan** sistem yang memutuskan diagnosis medis atau memproses klaim BPJS — murni alat bantu dokumentasi; keputusan klinis dan administratif tetap di tangan tenaga medis dan sistem BPJS resmi.
- **Bukan** asisten suara pasif dengan wake word — "Halo Jarvis" dan TTS sempat direncanakan, tidak pernah benar-benar jadi wake-word pasif, dan akhirnya dihapus total dari produk atas keputusan eksplisit.

---

## 3. Pengguna & Persona

| Persona | Kebutuhan utama |
|---|---|
| **Pengguna umum** | Chat dengan AI/agent pilihan sendiri, kelola beberapa API key tanpa takut kehilangan saat ganti HP, VPN pribadi yang benar-benar jalan |
| **Perawat** | Mendokumentasikan percakapan dengan pasien secepat mungkin lewat suara, tanpa ketik manual, lalu mengirim hasilnya ke dokter lewat cara yang sudah biasa dipakai (bukan sistem baru yang harus dipelajari) |
| **Developer/maintainer** | Bisa menambah provider/agent AI baru, memperbaiki bug, atau mengubah UI tanpa proses rilis app store setiap kali |

---

## 4. Fitur & Requirement

### 4.1 Autentikasi (FR-AUTH)

- **FR-AUTH-01**: Pengguna login/registrasi dengan email + password lewat Supabase Auth.
- **FR-AUTH-02**: Sesi tersimpan dan dicek ulang di setiap navigasi (guard router) — belum login diarahkan ke `/login`, sudah login tidak bisa membuka `/login` lagi.
- **FR-AUTH-03**: Sesi web dicerminkan (mirror) ke klien Supabase native, supaya layar Bot BPJS yang sepenuhnya native tetap bisa menulis `activity_log` dan tabel BPJS atas nama pengguna yang sama, tanpa login kedua.

### 4.2 Chat Multi-Provider & Agent (FR-CHAT)

- **FR-CHAT-01**: Pengguna memilih satu entry (provider atau agent) dari daftar yang sudah terhubung; provider dan agent **setara**, tidak ada hierarki atau menu terpisah saat memakainya.
- **FR-CHAT-02**: Mendukung minimal 4 bentuk komunikasi API: format OpenAI-compatible (ChatGPT, OpenRouter, Hermes), Anthropic, Google Gemini, dan gateway self-hosted kustom (OpenClaw).
- **FR-CHAT-03**: Pengguna bisa memakai perintah `/` (skill) langsung dari kolom chat: `/system <instruksi>` (atur system prompt sesi berjalan), `/clear` (hapus riwayat chat lokal **dan** di server untuk entry aktif), `/help` (daftar perintah). Palet skill muncul otomatis saat mengetik `/` sebagai karakter pertama, atau lewat tombol pintas di sebelah kolom pesan.
- **FR-CHAT-04**: Riwayat percakapan **wajib bertahan** melewati navigasi antar halaman dan penutupan aplikasi — tidak boleh hilang hanya karena pengguna pindah menu.
- **FR-CHAT-05**: Tersedia halaman Riwayat terpisah yang mengelompokkan percakapan per AI/agent (bukan daftar pesan datar), menampilkan pratinjau pesan terakhir, dan membuka Chat langsung ke entry yang dipilih.

### 4.3 Universal API Key (FR-KEY)

- **FR-KEY-01**: Pengguna menempel satu API key di satu kolom tanpa harus memilih vendor dulu; sistem mendeteksi vendor dari bentuk key (regex per vendor). Jika tidak dikenali, tampilkan quick-pick dari katalog yang diketahui, atau form manual (nama, jenis, endpoint, model) sebagai jalan terakhir.
- **FR-KEY-02**: Alur penghubungan key **dipisah secara eksplisit** antara "Provider AI" dan "Agent" sejak langkah awal (dua pintu masuk berbeda), supaya pengguna tidak salah paham keduanya adalah hal yang sama — meski setelah tersambung keduanya tampil setara di Chat (lihat FR-CHAT-01).
- **FR-KEY-03**: Satu provider bisa punya **lebih dari satu key** ("slot"), masing-masing diberi nama (mis. "Gemini", "Gemini 2"). Chat tetap menampilkan **satu** entry per provider — bukan satu chip per slot.
- **FR-KEY-04**: Saat memanggil AI dan key yang dipakai mengembalikan error kuota/rate-limit, sistem **otomatis mencoba slot lain** milik provider yang sama sebelum menyerah, dan memberi tahu pengguna bahwa pergantian terjadi. Error yang bukan soal kuota (key salah, jaringan, diblokir konten) **tidak** memicu percobaan ke slot lain.
- **FR-KEY-05**: Setiap API key dienkripsi (AES-GCM) sebelum disimpan ke database, dan disinkronkan lewat akun pengguna — bukan hanya tersimpan di satu perangkat, supaya tidak hilang saat uninstall/ganti HP.
- **FR-KEY-06**: Pengguna bisa melihat dan menghapus slot key satu per satu dari halaman "Provider & Agent", tanpa harus memutus seluruh koneksi provider.

### 4.4 Keandalan Panggilan AI — Khusus Gemini (FR-GEMINI)

- **FR-GEMINI-01**: Saat model yang dipakai tidak lagi tersedia, tidak memiliki kuota gratis sama sekali (`limit: 0`), atau sedang kelebihan permintaan (503), sistem **otomatis mencoba model Gemini lain** yang tersedia — bukan langsung menampilkan error ke pengguna.
- **FR-GEMINI-02**: Error 503 dicoba ulang otomatis (retry singkat) sebelum dianggap perlu berpindah model.
- **FR-GEMINI-03**: Pengguna tetap bisa memilih model secara manual lewat "Pilih Model", termasuk mengetik ID model sendiri untuk provider mana pun.

### 4.5 VPN (FR-VPN)

- **FR-VPN-01**: Pengguna mengisi konfigurasi server VPN sesuai protokol yang dipilih (WireGuard: key pair + endpoint + allowed IPs; OpenVPN: isi file `.ovpn`; SSH: host/port/kredensial) — bukan satu form generik untuk semua protokol.
- **FR-VPN-02**: Protokol **WireGuard** membuka tunnel jaringan sungguhan lewat `VpnService` Android saat pengguna menekan Connect.
- **FR-VPN-03**: Protokol OpenVPN/SSH yang belum punya tunnel nyata **wajib** ditampilkan jujur ke pengguna (status "config tersimpan, belum ada tunnel aktif") — tidak boleh berpura-pura terhubung.
- **FR-VPN-04**: Saat dibuka di luar aplikasi native (preview browser tanpa shell Flutter), sistem menampilkan dengan jelas bahwa itu hanya simulasi tampilan, bukan koneksi sungguhan.

### 4.6 Bot BPJS (FR-BPJS)

- **FR-BPJS-01**: Perawat memulai sesi dengan menekan ikon mikrofon secara langsung — **tanpa** wake word, tanpa nama asisten ("Jarvis"), tanpa balasan suara (TTS).
- **FR-BPJS-02**: Sebelum merekam, perawat mengisi nama pasien dan nama+instansi dokter tujuan sebagai teks bebas (bukan memilih dari daftar akun atau daftar pertemanan).
- **FR-BPJS-03**: Audio diproses Speech-to-Text on-device secara real-time (locale Indonesia); jeda bicara alami **tidak** boleh ditampilkan sebagai pesan error ke perawat — sistem melanjutkan mendengarkan secara otomatis.
- **FR-BPJS-04**: Setelah sesi dihentikan, transkrip dikirim ke provider/agent AI yang sudah terhubung perawat untuk disusun jadi draf dokumentasi terstruktur. Jika tidak ada provider terhubung atau AI gagal merespons, sistem tetap menyimpan transkrip mentah sebagai fallback — bukan gagal total.
- **FR-BPJS-05**: Draf dokumentasi ditampilkan sebagai **field yang bisa diedit langsung** (bukan teks baca-saja) — perawat wajib bisa membenarkan tulisan sebelum dibagikan.
- **FR-BPJS-06**: Perawat bisa menyalin teks polos, atau mengekspor sebagai PDF/DOCX, lalu membagikannya sendiri lewat share sheet OS (WhatsApp, email, aplikasi lain) — hasil yang dibagikan harus sama persis dengan versi yang terakhir diedit di layar, bukan draf asli AI yang belum dikoreksi.
- **FR-BPJS-07**: Setiap sesi (status: `recording` → `processing` → `siap_dikirim` → `terkirim`) tercatat untuk audit dan evaluasi akademik.

### 4.7 Activity Log (FR-LOG)

- **FR-LOG-01**: Aktivitas penting (chat terkirim, API tersambung, sesi VPN, sesi Bot BPJS) dicatat otomatis dengan kategori, judul, dan status.
- **FR-LOG-02**: Log bersifat append-only — tidak bisa diedit atau dihapus pengguna lewat aplikasi.
- **FR-LOG-03**: Halaman log memperbarui diri secara realtime saat ada entri baru.

---

## 5. Model Data (ringkasan)

7 tabel di Supabase, semua dengan Row Level Security aktif, dibatasi per `user_id`/`perawat_id` pemilik baris — tidak ada akses lintas akun untuk data pribadi mana pun (termasuk data kesehatan Bot BPJS, yang sebelumnya sempat direncanakan bisa diakses "dokter tujuan" via relasi pertemanan — keputusan itu dicabut demi privasi yang lebih ketat dan kesederhanaan implementasi):

`profiles`, `activity_log`, `api_credentials` (multi-slot per provider), `chat_messages` (riwayat chat), `bpjs_sessions`, `bpjs_transcripts`, `bpjs_documents`.

Detail kolom dan relasi: lihat `docs/diagram-alur.md` §3.

---

## 6. Arsitektur (ringkasan)

- **Native (Flutter)**: shell tipis — splash screen, WebView persisten, jembatan (`NativeBridge`) 7 jenis pesan, layar Bot BPJS sepenuhnya native (mikrofon/STT), penyimpanan config VPN (Keystore/Keychain), dan koneksi WireGuard sungguhan.
- **Web (SPA vanilla JS, Docker/nginx)**: seluruh UI lainnya — Login, Home, Chat, Riwayat, Bot Hub, VPN status, Settings, Provider & Agent, Activity Log. Memanggil Supabase dan vendor AI langsung dari klien, tanpa server perantara AI Hub.
- **Backend**: Supabase (Auth, PostgreSQL + RLS, Realtime) — satu-satunya backend, tidak ada server aplikasi kustom.

Detail dan diagram: `docs/RINCIAN-SISTEM.md` §3, `docs/diagram-alur.md` §2.

---

## 7. Kebutuhan Non-Fungsional

| Kategori | Kebutuhan |
|---|---|
| Keamanan | API key terenkripsi (AES-GCM) sebelum disimpan; RLS sebagai kontrol akses sesungguhnya, enkripsi sebagai lapisan tambahan |
| Privasi data kesehatan | Data Bot BPJS hanya bisa diakses oleh perawat pemilik sesi — tidak ada akses lintas akun sama sekali |
| Updatability | Perubahan pada layer web harus bisa tayang ke seluruh pengguna tanpa submit ulang ke store |
| Keandalan panggilan AI | Satu key/model bermasalah tidak boleh menghentikan seluruh percakapan — lihat FR-KEY-04 dan FR-GEMINI-01 |
| Keandalan UX native | Navigasi Android (nav bar) tidak boleh mengganggu tampilan; layar startup wajib tampil center, bukan bergeser ke satu sisi |
| Modularitas | Menambah provider/agent AI baru tidak boleh mengubah arsitektur inti — cukup tambah entri katalog |

---

## 8. Batasan & Risiko yang Masih Terbuka

- **Kebijakan App Store/Play Console** — aplikasi yang "mayoritas WebView" berisiko mendapat tinjauan ketat (Apple Guideline 4.7 khususnya). Mitigasi arsitektur sudah berjalan (domain web dibatasi ke container sendiri, fungsi sensitif tetap native), tapi dokumentasi formal ke reviewer **belum** dibuat — ini tetap pekerjaan rumah sebelum rilis produksi.
- **OpenVPN/SSH** belum punya tunnel nyata — hanya WireGuard yang sudah terverifikasi berfungsi di device fisik.
- **Speaker diarization** (membedakan suara perawat vs pasien) belum ada — seluruh segmen transkrip saat ini berlabel "perawat" secara default.
- **Belum pernah disubmit ke store sungguhan** — strategi versioning antara shell native dan konten web (jika suatu saat berbeda signifikan) belum dirancang secara eksplisit.

---

## 9. Perubahan Besar vs PRD Lama

| Dari PRD lama | Jadi di sistem sekarang | Alasan |
|---|---|---|
| Friend System (pertemanan, kirim dokumentasi hanya ke "friend") | Dihapus total — dokter dituju diketik manual, dokumentasi dikirim keluar aplikasi oleh perawat sendiri | Mewajibkan dokter punya akun & pertemanan terbukti jadi penghambat nyata di lapangan |
| Wake word "Halo Jarvis" + TTS | Tekan mikrofon langsung, tanpa persona asisten bernama, tanpa suara balasan | Tidak pernah benar-benar jadi deteksi pasif; disederhanakan sesuai kebutuhan nyata pengguna |
| Review & verdict dokter via akun (`matches_bpjs_form`/`needs_revision`) | Draf bisa diedit langsung oleh perawat sebelum dikirim; tidak ada verdict pihak lain di dalam aplikasi | Bergantung pada akun dokter yang ikut dihapus bersama Friend System |
| AI Agent Hub bergaya kartu tugas simulasi | Agent (Hermes, OpenClaw) jadi entry setara provider di Chat, dipanggil lewat API/gateway sungguhan | Pendekatan lama tidak pernah terhubung ke agent nyata |
| Satu API key per provider (tersimpan di Keystore device) | Banyak slot key per provider, disinkron lewat akun Supabase terenkripsi, dengan auto-rotation saat limit | Key hilang total saat uninstall/ganti device; satu key kena limit menghentikan seluruh percakapan |
| — (belum ada di PRD lama) | Riwayat chat persisten + halaman Riwayat terkelompok per AI/agent | Chat sebelumnya hilang total setiap pindah menu |
| — (belum ada di PRD lama) | Fallback model otomatis untuk Gemini saat model tidak tersedia/limit/overload | Chat sempat macet permanen saat model tertentu bermasalah |

---

*Dokumen ini mencerminkan sistem per 5 Oktober 2026. PRD lama di folder ini (`PRD-Hub-Multi-Provider-AI-Agent-VPN.md`, `PRD-AI-Hub-Jarvis-BPJS.md`, `PRD-Dokumentasi-Percakapan-Perawat-Pasien.md`) disimpan sebagai arsip sejarah dan konteks tujuan akademik — bukan acuan fitur yang berlaku.*
