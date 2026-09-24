# Product Requirement Document (PRD)
## AI Hub — Multi-Provider AI, AI Agent, Bot, Friend & VPN
**dengan Modul Khusus: Jarvis Voice Assistant untuk Dokumentasi Percakapan Perawat-Pasien (Bot BPJS)**
**(Cross-Platform — Android & iOS via Flutter, Arsitektur Hybrid Flutter + WebView)**

> Dokumen ini adalah revisi gabungan dari `PRD-Hub-Multi-Provider-AI-Agent-VPN.md`. Fitur baru pada revisi ini: **Login/Autentikasi**, **Friend System** (pertemanan antar pengguna, khususnya perawat↔dokter), **menu Bot** (terpisah dari AI Agent Hub), **VPN dengan protokol yang bisa diganti-ganti**, dan **Bot BPJS "Jarvis"** — modul voice assistant yang mengimplementasikan topik Proyek Akhir (PA) pemilik produk: *"Pengembangan Aplikasi Mobile untuk Otomatisasi Dokumentasi Percakapan Perawat-Pasien sebagai Pendukung Verifikasi Diagnosis Pasien Menggunakan Speech-to-Text dan Large Language Model"* (PENS, PSDKU Lamongan).
>
> **Pendekatan win-win:** AI Hub tetap menjadi produk umum (general-purpose: chat multi-provider, agent, VPN, bot), sementara Bot BPJS adalah salah satu bot yang berjalan **di atas** platform ini. Dengan begitu, pengerjaan PA sekaligus menghasilkan fitur nyata untuk produk, dan produk menyediakan infrastruktur (autentikasi, friend list, chat multi-provider, logging) yang dibutuhkan skenario PA tanpa membangun aplikasi terpisah.

---

## 1. Ringkasan Produk

AI Hub adalah aplikasi mobile cross-platform (Flutter, hybrid native shell + WebView) yang menjadi **hub terpusat** untuk:
- Chat dengan berbagai provider AI (OpenAI, Claude, Gemini, dll.)
- Menjalankan AI Agent (tugas otonom: riset, coding, data, planner, dll.)
- Menjalankan **Bot** siap pakai (termasuk **Bot BPJS/Jarvis** untuk dokumentasi klinis)
- **Login** dan mengelola identitas pengguna (perawat, dokter, pengguna umum)
- **Berteman (Friend System)** dengan pengguna lain di dalam aplikasi, agar bot/agent tahu ke siapa hasil pekerjaan harus dikirim
- Koneksi **VPN** dengan pilihan protokol yang bisa diganti sesuai kebutuhan
- Log aktivitas terpusat, tersimpan di Supabase, agar dapat diaudit

---

## 2. Latar Belakang

### 2.1 Latar belakang produk (umum)
Pengguna yang ingin memakai berbagai provider AI, agent, dan bot otomatis harus berpindah-pindah aplikasi dan mengelola kredensial secara terpisah. AI Hub menyatukan semuanya dalam satu aplikasi dengan pengelolaan kredensial aman dan log yang transparan.

### 2.2 Latar belakang akademik (Proyek Akhir)
Transformasi digital layanan kesehatan (Permenkes No. 24/2022 tentang Rekam Medis) mendorong rekam medis elektronik yang terintegrasi. Dalam praktiknya, banyak informasi klinis penting (keluhan, anamnesis, riwayat) muncul dari **percakapan** perawat-pasien yang belum terdokumentasi secara terstruktur. Penelitian menunjukkan:
- **Speech-to-Text** (Blackley et al., 2019; Radford et al./Whisper) dapat membantu transkripsi percakapan klinis, meski akurasinya bervariasi.
- **AI Scribe** (Sasseville et al., 2025) berpotensi mengurangi beban dokumentasi, tapi kualitas keluaran bergantung pada teknologi & implementasi.
- **LLM** (Christof et al., 2026; Woo et al.) efektif untuk meringkas dan menyusun draf dokumentasi, namun tetap berisiko *hallucination* sehingga keluarannya **wajib** ditinjau tenaga kesehatan, bukan menggantikan keputusan klinis.
- **Speaker diarization + role identification** (Zolensky et al., 2026) diperlukan agar transkrip dapat memisahkan ucapan perawat vs. pasien secara andal.

Bot BPJS/Jarvis pada AI Hub adalah implementasi produk dari riset PA ini: percakapan perawat-pasien direkam, ditranskrip, dipisah per pembicara, diringkas terstruktur oleh LLM, dikirim ke dokter tujuan (lewat Friend System) untuk **diverifikasi** — dokter tetap pemegang keputusan akhir, sistem hanya alat bantu dan penyedia informasi pendukung.

---

## 3. Tujuan Produk

### 3.1 Tujuan produk (umum)
1. Satu aplikasi untuk banyak provider AI, agent, dan bot.
2. Login & manajemen identitas pengguna yang aman.
3. Friend system agar hasil kerja agent/bot bisa diarahkan ke pengguna lain yang tepat.
4. VPN terintegrasi dengan protokol yang fleksibel.
5. Log aktivitas yang transparan dan dapat diaudit (Supabase).

### 3.2 Tujuan akademik (selaras dengan proposal PA)
1. Mengembangkan aplikasi mobile yang menangkap & mengelola percakapan perawat-pasien sebagai sumber dokumentasi.
2. Menerapkan Speech-to-Text untuk transkripsi percakapan.
3. Menerapkan LLM untuk ekstraksi informasi, ringkasan, dan penyusunan dokumentasi terstruktur.
4. Menyediakan dokumentasi + informasi pendukung bagi dokter untuk verifikasi diagnosis.
5. Menyediakan mekanisme evaluasi (WER, kelengkapan informasi, factual consistency, waktu proses) — baseline (STT saja) vs. proposed (STT+LLM) sesuai metode penelitian PA.

---

## 4. Ruang Lingkup Fitur

### 4.1 Login & Autentikasi
- Login via email/password dan/atau OTP, didukung Supabase Auth.
- Role pengguna: `general`, `perawat`, `dokter` (role menentukan bot/menu apa yang relevan — mis. Bot BPJS aktif penuh untuk role perawat/dokter, pengguna umum tetap bisa memakai chat/agent/VPN).
- Sesi anonim (yang sudah berjalan di MVP saat ini) di-upgrade menjadi akun penuh saat pengguna login — riwayat log tetap terhubung ke akun.
- Profil pengguna: nama, foto, role, spesialisasi (untuk dokter), rumah sakit/instansi (opsional, untuk pencarian teman di lingkup yang relevan).

### 4.2 Friend System
- Pengguna dapat mencari pengguna lain (by nama/username/email), mengirim **permintaan pertemanan**, menerima/menolak.
- Friend list dipakai oleh:
  - Bot BPJS: menentukan dokter tujuan pengiriman hasil dokumentasi ("mau dikirim ke dokter siapa?" → cukup sebut nama, sistem mencocokkan ke friend list perawat tsb).
  - Chat/agent umum: berbagi hasil chat atau kolaborasi (opsional, fase lanjutan).
- Status online/last-active teman ditampilkan agar perawat tahu dokter yang dituju sedang aktif atau tidak.
- Privasi: seorang dokter hanya menerima kiriman dari perawat yang **sudah** berteman dengannya — mencegah spam/pengiriman ke pihak tak dikenal.

### 4.3 Multi-Provider AI Chat (diperluas)
- Tetap seperti sebelumnya (pilih provider aktif: OpenAI/Claude/Gemini/lainnya).
- **Baru:** dari layar chat yang sama, pengguna bisa memilih target percakapan: *provider AI biasa*, *agent tertentu*, atau *bot tertentu* (termasuk Bot BPJS) — satu antarmuka chat untuk tiga jenis "lawan bicara".
- Riwayat chat tetap tersimpan per konteks (per provider/agent/bot).

### 4.4 AI Agent Hub (tetap ada)
- Agent tugas otonom umum (Research, Code, Content, Data, Planner Agent, dst.) — tidak berubah dari PRD sebelumnya.

### 4.5 Bot Hub (menu baru)
Menu terpisah dari Agent Hub, khusus untuk **bot dengan skenario percakapan/voice yang sudah dipaketkan** (bukan tugas otonom bebas seperti agent):
- **Bot BPJS (Jarvis)** — lihat detail di 4.7.
- Slot bot umum lainnya di masa depan (mis. bot FAQ, bot penerjemah, bot notulen rapat) — arsitektur bot dibuat modular agar bot baru tinggal didaftarkan (nama, wake word/trigger, alur pertanyaan, output format), tanpa mengubah struktur inti (sejalan dengan NFR modularitas PRD sebelumnya).

### 4.6 VPN dengan Protokol Dinamis
- Pengguna dapat memilih protokol VPN aktif: **WireGuard**, **OpenVPN**, (dapat diperluas ke IKEv2/lainnya) langsung dari layar VPN, tidak hardcoded ke satu protokol seperti MVP sebelumnya.
- Saat berganti protokol, aplikasi menampilkan status transisi (disconnect protokol lama → connect protokol baru) dan mencatat pergantian protokol di Activity Log.
- Kredensial/config per protokol disimpan terpisah di secure storage (native shell), sesuai NFR-01 PRD sebelumnya.

### 4.7 Bot BPJS "Jarvis" — Voice Assistant Dokumentasi Perawat-Pasien

**Alur inti (sesuai skenario yang diberikan):**

1. **Wake word**: Perawat mengucapkan **"Halo Jarvis"** (nama trigger, bukan "OK Google"). Deteksi wake word berjalan on-device (hemat baterai, tidak mengirim audio terus-menerus ke server) menggunakan model wake-word ringan.
2. **Respon Jarvis**: AI voice menjawab *"Iya, ada yang bisa saya bantu?"* (text-to-speech).
3. **Perintah perawat**: *"Bantu saya mendiagnosis penyakit"* (atau variasi kalimat serupa — dikenali via intent classification sederhana, bukan hanya exact match).
4. **Aktivasi Bot BPJS**: Jarvis menjawab *"Oke, saya akan mengaktifkan Bot BPJS"*, lalu mulai merekam sesi.
5. **Perekaman & pemrosesan**:
   - Audio percakapan direkam selama sesi berlangsung.
   - **Speech-to-Text** mengubah audio menjadi transkrip.
   - **Speaker diarization** memisahkan segmen ucapan perawat vs. pasien (peran ditentukan dari konteks sesi: sesi dimulai oleh akun perawat, sehingga pembicara pertama/sesuai konteks dipetakan sebagai perawat, lainnya sebagai pasien).
   - **LLM** memproses transkrip berlabel pembicara menjadi:
     1. Ekstraksi informasi relevan (keluhan utama, durasi gejala, riwayat, dsb.)
     2. Ringkasan percakapan
     3. Dokumentasi terstruktur
     4. Alur percakapan (timeline ringkas: apa yang ditanyakan → apa yang dijawab pasien → temuan)
6. **Penentuan tujuan pengiriman**: Sebelum/atau setelah sesi, Jarvis bertanya *"Ini mau dikirim ke dokter siapa?"* — perawat cukup menyebut **nama** dokter tujuan; sistem mencocokkan nama tersebut dengan **Friend List** perawat tersebut (harus sudah berteman) untuk menentukan `doctor_id` tujuan yang tepat. Jika nama ambigu (lebih dari satu match) atau tidak ditemukan di friend list, Jarvis meminta klarifikasi.
7. **Pengiriman ke dokter**: Dokumentasi terstruktur + transkrip + ringkasan + alur percakapan dikirim sebagai notifikasi/pesan ke dokter tujuan, dengan metadata jelas: **dari perawat siapa**, **untuk pasien siapa**, waktu sesi.
8. **Verifikasi dokter**: Dokter meninjau dokumentasi — yang sudah disusun **mengikuti struktur field form BPJS** (bukan format bebas) — sehingga dokter cukup mengecek **kecocokan isi dengan form BPJS** tanpa perawat harus menulis ulang manual. Dokter dapat dibantu menyusun ulang/mengecek dengan **AI provider pilihannya sendiri** (lihat 4.7.1) dan menandai:
   - **Sesuai** → status **"Dokumentasi Sesuai Form BPJS"** — dokumentasi ini yang lalu dipakai RS (lewat proses/sistem klaim milik RS sendiri) untuk pengajuan klaim. **Keputusan pencairan dana BPJS sepenuhnya berada di sistem RS/BPJS Kesehatan, bukan di aplikasi ini** — lihat catatan cakupan di bawah.
   - **Perlu Perbaikan** → dikirim balik ke perawat dengan catatan revisi (mis. field form yang belum lengkap/tidak sesuai), perawat dapat melengkapi/mengulang sesi.
9. **Log**: setiap tahap (mulai sesi, transkrip selesai, dokumentasi dibuat, dikirim ke dokter, hasil verifikasi) tercatat di Activity Log agar dapat diaudit — juga menjadi data evaluasi (waktu proses per tahap) untuk keperluan PA.

**4.7.1 Kebebasan Provider LLM untuk Dokter**
Dokter tidak terkunci pada satu LLM: saat meninjau dokumentasi dari Bot BPJS, dokter bisa membuka hasil tsb di layar Chat AI Hub dan meminta provider AI pilihannya sendiri (mis. Claude, GPT-4o, Gemini yang sudah dokter tsb konfigurasi API key-nya) untuk membantu menyusun ulang, meringkas ulang, atau mengecek konsistensi — sehingga sistem **tidak bergantung pada satu LLM** (selaras dengan arsitektur multi-provider AI Hub secara keseluruhan).

**4.7.2 Catatan cakupan penting — pencairan BPJS bukan wewenang aplikasi**
Aplikasi ini **tidak** memutuskan atau memproses pencairan dana BPJS. Peran aplikasi murni membantu **efisiensi pelaporan**: mengubah percakapan perawat-pasien menjadi dokumentasi yang sudah terstruktur sesuai field yang dibutuhkan form BPJS, supaya perawat tidak perlu menulis manual, dan dokter tinggal mengecek kecocokannya. Setelah dokter menandai "Sesuai", dokumentasi tsb yang dipakai sebagai lampiran/masukan ke **proses klaim milik RS sendiri** (sistem internal RS/BPJS Kesehatan) — proses itu berjalan di luar aplikasi ini.
- Status internal yang dikelola aplikasi hanya: `pending_review` → `matches_bpjs_form` (dokter menyatakan dokumentasi sudah sesuai form BPJS) atau `needs_revision`.
- **Tidak ada** status seperti "dana cair"/"klaim disetujui" yang dikelola aplikasi — itu murni ranah sistem RS.
- Jika di masa depan RS ingin mengekspor dokumentasi `matches_bpjs_form` langsung ke sistem internal mereka (mis. lewat file export atau integrasi API RS), modul ini dirancang agar status tsb tinggal dihubungkan ke ekspor/integrasi itu, tanpa mengubah alur inti aplikasi.

### 4.8 Manajemen Kredensial (tetap ada, diperluas)
- API key AI provider, kredensial VPN per protokol, dan sekarang juga **kredensial akun** (login) — semua dikelola dari Settings.

### 4.9 Logging & Riwayat Aktivitas (tetap ada, diperluas)
Kategori log bertambah: `AI`, `Agents`, `Bots`, `VPN`, `Friends`, `System`. Untuk sesi Bot BPJS, log memuat jejak lengkap tahapan (lihat 4.7 poin 9) untuk keperluan audit dan evaluasi akademik (mengukur waktu proses tiap tahap).

---

## 5. Kebutuhan Fungsional

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-01 | Pengguna dapat memasukkan & menyimpan API key beberapa provider AI saat onboarding | Must |
| FR-02 | Pengguna dapat memilih provider AI aktif saat chat | Must |
| FR-03 | Pengguna dapat menjalankan AI agent dari aplikasi | Must |
| FR-04 | Pengguna dapat menghubungkan VPN dari dalam aplikasi | Must |
| FR-05 | Status koneksi VPN ditampilkan secara real-time | Should |
| FR-06 | Kredensial disimpan terenkripsi secara lokal | Must |
| FR-07 | Pengguna dapat mengelola (tambah/edit/hapus) kredensial dari Settings | Must |
| FR-08 | Sistem mencatat log aktivitas ke Supabase (provider, agent, bot, VPN, friend, waktu, status) | Must |
| FR-09 | Pengguna dapat melihat & memfilter riwayat log secara real-time | Should |
| FR-10 | Arsitektur modular: provider/agent/bot baru tanpa mengubah struktur inti | Should |
| FR-11 | Konten UI non-native dapat diperbarui dari server tanpa update aplikasi (hybrid WebView) | Must |
| FR-12 | Mode fallback/offline saat WebView gagal memuat konten | Should |
| **FR-13** | **Pengguna dapat login/registrasi (email+password, dengan opsi upgrade dari sesi anonim)** | **Must** |
| **FR-14** | **Pengguna dapat mencari, mengirim, menerima/menolak permintaan pertemanan** | **Must** |
| **FR-15** | **Pengguna dapat melihat daftar teman beserta status online** | **Should** |
| **FR-16** | **Pengguna dapat memilih & mengganti protokol VPN aktif (WireGuard/OpenVPN/lainnya)** | **Must** |
| **FR-17** | **Aplikasi menyediakan menu Bot terpisah dari Agent Hub** | **Must** |
| **FR-18** | **Aplikasi mendeteksi wake word "Halo Jarvis" dan merespons via voice (TTS)** | **Must** |
| **FR-19** | **Bot BPJS merekam sesi percakapan, melakukan STT + speaker diarization + ringkasan LLM terstruktur** | **Must** |
| **FR-20** | **Perawat dapat menentukan dokter tujuan pengiriman hasil dokumentasi berdasarkan nama, dicocokkan ke friend list** | **Must** |
| **FR-21** | **Dokter menerima notifikasi berisi dokumentasi + transkrip + metadata (perawat, pasien, waktu)** | **Must** |
| **FR-22** | **Dokter dapat menandai hasil sebagai "Sesuai" (verified) atau "Perlu Perbaikan" (revisi kembali ke perawat)** | **Must** |
| **FR-23** | **Dokter dapat memakai AI provider pilihannya sendiri untuk membantu meninjau/menyusun ulang dokumentasi** | **Should** |
| **FR-24** | **Aplikasi menandai status kecocokan dokumentasi dengan form BPJS (`pending_review`/`matches_bpjs_form`/`needs_revision`) — bukan status pencairan dana, yang tetap diproses lewat sistem RS sendiri** | **Should** |

---

## 6. Kebutuhan Non-Fungsional

| ID | Kebutuhan |
|---|---|
| NFR-01 | Keamanan: kredensial (API key, VPN config, token sesi) wajib terenkripsi via Keystore/Keychain; tidak pernah diserahkan ke lapisan WebView |
| NFR-02 | Cross-platform: satu codebase Flutter (native shell) berjalan di Android & iOS |
| NFR-03 | Modularitas: provider/agent/bot baru + protokol VPN baru dapat ditambahkan tanpa perubahan arsitektur inti (bot baru cukup didaftarkan lewat konfigurasi) |
| NFR-04 | Reliabilitas VPN: koneksi & pergantian protokol tidak boleh membuat aplikasi crash |
| NFR-05 | Privasi: tidak ada data kredensial dikirim ke server aplikasi tanpa izin eksplisit |
| NFR-06 | Performa: pergantian provider AI dalam chat instan tanpa reload |
| NFR-07 | Updatability: konten non-native diperbarui via OTA tanpa submit ulang ke store |
| NFR-08 | Ketersediaan offline: fitur inti (VPN, kredensial, wake-word detection) tetap berfungsi tanpa koneksi WebView |
| NFR-09 | Keamanan WebView: HTTPS + domain whitelist untuk JS bridge |
| **NFR-10** | **Privasi data kesehatan: transkrip & dokumentasi percakapan pasien adalah data sensitif — wajib dienkripsi saat transit & at-rest, akses dibatasi RLS per akun (perawat pengirim & dokter tujuan saja), selaras semangat Permenkes No. 24/2022 tentang Rekam Medis dan UU PDP** |
| **NFR-11** | **Akurasi & keterbatasan LLM harus dikomunikasikan ke pengguna: hasil Bot BPJS adalah draf/pendukung, bukan diagnosis final — wajib ada label "Perlu verifikasi dokter" pada tiap output** |
| **NFR-12** | **Wake-word detection berjalan on-device (tidak mengirim audio mentah terus-menerus ke cloud) untuk efisiensi baterai & privasi; audio sesi baru diunggah setelah bot BPJS diaktifkan secara eksplisit** |
| **NFR-13** | **Auditability: setiap transisi status dokumentasi (dibuat → dikirim → diverifikasi/direvisi) harus tercatat dengan timestamp untuk keperluan evaluasi akademik (WER, waktu proses) dan audit klinis** |
| **NFR-14** | **Konsistensi identitas: pengiriman dokumentasi hanya dapat dilakukan ke pengguna yang berstatus "friend" — mencegah data pasien terkirim ke akun yang salah/tidak dikenal** |

---

## 7. Arsitektur Sistem

### 7.1 Prinsip: Hybrid Flutter Native Shell + WebView (tetap seperti PRD sebelumnya)
Fungsi sensitif (VPN — kini multi-protokol, secure credential store, wake-word listener, mikrofon) tetap 100% native. UI chat, agent hub, bot hub, friend list, settings, dan activity log tetap di layer WebView agar dapat diperbarui tanpa rebuild.

**Tambahan komponen native untuk PA:**
- **Wake Word Engine** (on-device, ringan) — mendengarkan trigger "Halo Jarvis" secara lokal.
- **Voice Session Recorder** — aktif merekam hanya setelah wake word + intent terdeteksi, mengelola izin mikrofon.
- **Text-to-Speech (TTS)** — untuk respons suara Jarvis.

### 7.2 Alur Data Bot BPJS (arsitektur pemrosesan)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          NATIVE SHELL (Flutter)                      │
│                                                                       │
│  Wake Word Engine ──"Halo Jarvis"──▶ TTS: "Iya, ada yang bisa saya   │
│  (on-device, idle-listening)         bantu?"                         │
│         │                                                            │
│         ▼ (intent: "bantu diagnosis")                                │
│  TTS: "Oke, saya akan mengaktifkan Bot BPJS"                          │
│         │                                                            │
│         ▼                                                            │
│  Voice Session Recorder ── merekam audio sesi perawat-pasien          │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ audio (setelah sesi selesai / per-chunk)
                                 ▼
                 ┌───────────────────────────────┐
                 │   Speech-to-Text (Whisper/     │
                 │   provider STT pilihan)        │
                 └───────────────┬───────────────┘
                                 ▼
                 ┌───────────────────────────────┐
                 │   Speaker Diarization          │
                 │   (pisahkan: Perawat / Pasien) │
                 └───────────────┬───────────────┘
                                 ▼
                 ┌───────────────────────────────┐
                 │   LLM (provider terkonfigurasi)│
                 │   → ekstraksi info relevan     │
                 │   → ringkasan percakapan       │
                 │   → dokumentasi terstruktur    │
                 │   → alur percakapan (timeline) │
                 └───────────────┬───────────────┘
                                 ▼
                 ┌───────────────────────────────┐
                 │  Tanya tujuan: "Kirim ke dokter │
                 │  siapa?" → cocokkan nama ke     │
                 │  Friend List perawat            │
                 └───────────────┬───────────────┘
                                 ▼
                 ┌───────────────────────────────┐
                 │  Kirim ke Dokter (notifikasi +  │
                 │  metadata: perawat, pasien,     │
                 │  waktu) — status: pending       │
                 └───────────────┬───────────────┘
                                 ▼
                 ┌───────────────────────────────┐
                 │  Dokter meninjau (+ opsional    │
                 │  bantuan LLM provider pilihan   │
                 │  dokter sendiri)                │
                 └───────┬───────────────┬─────────┘
                         ▼               ▼
                 "Sesuai"           "Perlu Perbaikan"
                         │               │
                         ▼               ▼
   status: matches_bpjs_form        kembali ke perawat
   (siap dipakai RS untuk proses    dengan catatan revisi
   klaim internal mereka)
```

### 7.3 Model Data Tambahan (Supabase)

Tabel baru selain `activity_log` yang sudah ada:

- **`users`** (dikelola Supabase Auth + tabel profil `profiles`: id, display_name, role [`general`|`perawat`|`dokter`], instansi, spesialisasi)
- **`friendships`** (user_id_a, user_id_b, status [`pending`|`accepted`|`blocked`], created_at) — relasi dua arah, RLS: hanya kedua pihak yang bisa lihat/ubah baris mereka
- **`bpjs_sessions`** (id, perawat_id, dokter_id, pasien_nama/identifier, status [`recording`|`processing`|`sent`|`needs_revision`|`matches_bpjs_form`], created_at, updated_at)
- **`bpjs_transcripts`** (session_id, speaker [`perawat`|`pasien`], text_segment, timestamp_offset) — hasil diarization per segmen
- **`bpjs_documents`** (session_id, ringkasan, dokumentasi_terstruktur (json), alur_percakapan (json), generated_by_llm_provider)
- **`bpjs_reviews`** (session_id, dokter_id, verdict [`approved`|`needs_revision`], catatan, reviewed_at)

Semua tabel di atas mengikuti pola RLS yang sama dengan `activity_log`: baris hanya bisa diakses oleh pihak yang relevan (perawat pengirim & dokter tujuan), bukan seluruh pengguna.

---

## 8. Alur Pengguna (User Flow)

### 8.1 Login & Onboarding
1. Splash → Login/Register (atau lanjut sebagai sesi anonim → upgrade nanti)
2. Setup API key provider AI (seperti sebelumnya)
3. Setup kredensial VPN — kini juga pilih protokol default
4. Masuk ke Home

### 8.2 Berteman
1. Buka menu Friends → cari nama/username
2. Kirim permintaan pertemanan → pihak lain menerima/menolak dari notifikasi
3. Setelah accepted, kedua pihak muncul di friend list masing-masing

### 8.3 Bot BPJS / Jarvis (alur utama PA)
1. Perawat: "Halo Jarvis" → Jarvis: "Iya, ada yang bisa saya bantu?"
2. Perawat: "Bantu saya mendiagnosis penyakit" → Jarvis: "Oke, saya akan mengaktifkan Bot BPJS"
3. Sesi rekam berjalan selama wawancara perawat-pasien
4. Sistem memproses (STT → diarization → LLM) → menghasilkan dokumentasi terstruktur + alur percakapan
5. Jarvis: "Ini mau dikirim ke dokter siapa?" → perawat sebut nama → dicocokkan ke friend list
6. Dokumentasi terkirim ke dokter tujuan dengan metadata lengkap
7. Dokter meninjau (opsional dibantu LLM pilihannya) → tandai Sesuai/Perlu Perbaikan
8. Jika Sesuai → status `matches_bpjs_form` (dokumentasi siap dipakai RS untuk proses klaim internal mereka); jika Perlu Perbaikan → balik ke perawat dengan catatan

### 8.4 Chat / Agent / Bot umum, VPN
Sama seperti PRD sebelumnya, dengan tambahan: chat kini bisa menyasar bot (termasuk histori sesi Bot BPJS), dan VPN kini punya pemilihan protokol.

---

## 9. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Kebocoran API key/kredensial | Penyalahgunaan akun | Enkripsi wajib (Keystore/Keychain), tidak pernah log kredensial plain text |
| Ketergantungan pada provider eksternal (rate limit, downtime) | Fitur chat/agent/bot terganggu | Tampilkan status provider, fallback pesan error jelas |
| Kompleksitas multi-protokol VPN | Bug koneksi, waktu dev molor | Mulai dari 1 protokol default (WireGuard) sebagai MVP, tambah bertahap |
| Kebijakan App Store/Play Store terkait VPN, agent otonom, & rekaman audio kesehatan | Aplikasi ditolak saat review | Deklarasi & justifikasi jelas untuk izin mikrofon dan VPN; batasi otonomi agent; cantumkan disclaimer medis dengan jelas |
| WebView memuat konten dinamis dari server | Berpotensi dianggap bypass review store | Batasi WebView untuk UI/logic non-sensitif; whitelist domain; dokumentasikan ke reviewer |
| **Wake word salah terpicu / merekam tanpa sadar** | **Pelanggaran privasi pasien, rekaman tidak diinginkan** | **Konfirmasi visual+suara jelas saat mulai merekam; tombol stop selalu terlihat; sesi otomatis berhenti bila tidak ada suara dalam durasi tertentu; minta izin eksplisit tiap sesi baru (bukan izin permanen diam-diam)** |
| **Salah kirim dokumentasi pasien ke dokter yang salah** | **Pelanggaran privasi data kesehatan, kesalahan medis serius** | **Pengiriman hanya via Friend List (bukan pencarian bebas); konfirmasi ulang nama dokter tujuan sebelum kirim; log lengkap siapa mengirim ke siapa** |
| **LLM menghasilkan ringkasan tidak akurat (hallucination)** | **Risiko misinformasi klinis** | **Label eksplisit "Draf AI — perlu verifikasi dokter" di setiap output; dokter wajib approve sebelum status berubah; transkrip asli selalu disertakan sebagai bahan cross-check** |
| **Aplikasi disalahpahami seolah memutuskan/mencairkan klaim BPJS** | **Klaim produk/akademik tidak akurat, masalah etik/hukum** | **PRD & laporan PA secara eksplisit menyatakan aplikasi hanya menandai kecocokan dokumentasi dengan form BPJS (`matches_bpjs_form`); keputusan dan pencairan klaim sepenuhnya proses internal RS/BPJS Kesehatan, di luar aplikasi** |
| **Data kesehatan (audio, transkrip, diagnosis) bocor/disalahgunakan** | **Pelanggaran privasi berat, sanksi hukum (UU PDP, Permenkes 24/2022)** | **RLS ketat per sesi (hanya perawat pengirim & dokter tujuan), enkripsi at-rest & in-transit, retensi data dibatasi/dapat dihapus atas permintaan, audit log lengkap** |

---

## 10. Desain / UI-UX

Bagian ini ditulis untuk pembaca yang **belum familiar dengan proses desain** — jadi dijelaskan langsung apa yang perlu dibuat, bukan hanya prinsip abstrak.

### 10.1 Bahasa desain (lanjutan dari mockup AI Hub yang sudah ada)
Gunakan bahasa visual yang **sama** dengan mockup 10 layar yang sudah dibuat sebelumnya (gradient ungu→biru `#6C5CE7 → #4A9EFF`, kartu putih rounded, ikon outline). Layar baru harus terasa seperti bagian dari aplikasi yang sama, bukan aplikasi terpisah.

### 10.2 Layar baru yang perlu didesain

1. **Login / Register**
   - Logo AI Hub di atas, form email+password, tombol "Masuk" (gradient), link "Belum punya akun? Daftar".
   - Toggle role saat registrasi: Umum / Perawat / Dokter (radio card sederhana, mirip pemilihan provider di layar API key).

2. **Friends (daftar teman)**
   - Search bar di atas ("Cari nama atau username").
   - List teman: avatar bulat + nama + role badge (mis. "Dr." untuk dokter) + status online (titik hijau).
   - Tab: "Teman" / "Permintaan Masuk" / "Cari Pengguna".
   - Tombol "+" mengambang untuk mengirim permintaan baru.

3. **Bot Hub (menu baru, sejajar dengan Agent Hub)**
   - Grid kartu seperti Agent Hub, tapi ikon berbeda (mis. ikon gelombang suara/mikrofon untuk membedakan dari Agent).
   - Kartu pertama: **"Bot BPJS"** dengan badge "Voice Assistant" dan subjudul "Dokumentasi perawat-pasien otomatis".
   - Tap kartu → layar detail Bot BPJS (lihat poin 4).

4. **Bot BPJS — layar sesi aktif**
   - Mirip layar VPN Connection (lingkaran status besar di tengah), tapi ikon mikrofon, dengan label status: "Mendengarkan..." / "Merekam sesi..." / "Memproses..." / "Menunggu dokter".
   - Waveform sederhana (animasi garis naik-turun) saat merekam, untuk memberi tahu pengguna bahwa mic aktif — penting secara etika (transparansi rekaman).
   - Tombol "Hentikan Sesi" selalu terlihat (merah), sesuai mitigasi risiko wake-word di atas.
   - Setelah selesai: tampilkan ringkasan singkat + tombol "Pilih Dokter Tujuan" (membuka picker dari friend list, bukan search bebas).

5. **Bot BPJS — layar dokumentasi (untuk dokter)**
   - Header: nama pasien, nama perawat pengirim, waktu sesi.
   - Badge kuning mencolok: **"Draf AI — perlu verifikasi Anda"**.
   - Tab: "Ringkasan" / "Dokumentasi Terstruktur" / "Alur Percakapan" / "Transkrip Lengkap".
   - Tombol aksi bawah: "Tandai Sesuai" (hijau) dan "Perlu Perbaikan" (outline merah, membuka form catatan revisi).
   - Ikon kecil "Tanya AI lain" di pojok kanan atas → membuka chat dengan provider pilihan dokter, dengan konteks dokumentasi ini sudah ter-preload.

6. **VPN — pemilihan protokol**
   - Tambahkan satu baris baru di layar VPN Connection yang sudah ada: kartu "Protokol" dengan chip pilihan (WireGuard / OpenVPN), sejajar dengan kartu lokasi yang sudah ada. Gaya sama seperti chip filter yang sudah dipakai di Agent Hub/Activity Log.

### 10.3 Prinsip yang wajib dipegang (khusus modul kesehatan)
- **Transparansi rekaman**: setiap kali mikrofon aktif, harus ada indikator visual yang jelas (bukan hanya ikon kecil di status bar OS).
- **Tidak ada dark pattern**: tombol "Perlu Perbaikan" harus semudah dan sejelas tombol "Sesuai" — jangan membuat dokter "malas" menolak draf yang salah.
- **Label AI selalu terlihat**: warna/badge berbeda (kuning/oranye) untuk semua konten hasil AI, supaya tidak tertukar dengan data yang sudah diverifikasi manusia (yang bisa pakai warna hijau/success seperti pola yang sudah ada di Activity Log).

### 10.4 Rekomendasi proses (karena belum familiar dengan desain)
1. Gunakan skill/tool desain (mis. Claude Design, Figma) untuk membuat mockup 6 layar baru di atas dengan gaya yang sama seperti 10 mockup awal.
2. Setelah mockup disetujui, gunakan sebagai referensi visual saat implementasi Flutter (seperti yang sudah dilakukan untuk 10 layar sebelumnya).
3. Untuk waveform/animasi rekaman, cukup pakai animasi sederhana bawaan Flutter (`AnimatedContainer`/`CustomPainter`) — tidak perlu library pihak ketiga di awal.

---

## 11. Pemetaan ke Proyek Akhir (Akademik)

Agar dokumen ini juga sah dipakai sebagai acuan teknis PA, berikut pemetaan eksplisit antara **Permasalahan/Tujuan PA** (dari proposal judul) dan **fitur PRD**:

| Permasalahan/Tujuan PA | Fitur PRD terkait |
|---|---|
| Menangkap percakapan perawat-pasien sebagai sumber dokumentasi terstruktur | FR-18, FR-19 (wake word + rekaman sesi Bot BPJS) |
| Menerapkan Speech-to-Text | Komponen "Speech-to-Text" pada arsitektur §7.2 |
| Menerapkan LLM untuk ekstraksi & ringkasan terstruktur | Komponen "LLM" pada §7.2, tabel `bpjs_documents` |
| Menyediakan dokumentasi + info pendukung untuk verifikasi dokter | FR-21, FR-22, FR-23; layar "Bot BPJS — dokumentasi" §10.2.5 |
| Evaluasi kinerja sistem (WER, kelengkapan, factual consistency, waktu) | NFR-13 (auditability/timestamp tiap tahap) menyediakan data mentah untuk perhitungan metrik ini; metodologi eksperimen (baseline STT-only vs. proposed STT+LLM) dijalankan di luar aplikasi menggunakan log yang dihasilkan sistem |
| Speaker diarization + role identification | Komponen "Speaker Diarization" §7.2, tabel `bpjs_transcripts` |

Dengan pemetaan ini, aplikasi AI Hub berfungsi sebagai **instrumen penelitian sekaligus produk**: data yang dikumpulkan selama pengujian (transkrip, waktu proses, hasil verifikasi dokter) langsung menjadi bahan evaluasi Bab Hasil & Pembahasan pada laporan PA.

---

## 12. Kesimpulan

PRD ini memperluas AI Hub dari sekadar agregator provider AI/agent/VPN menjadi platform yang juga mendukung **kolaborasi antar-pengguna** (login + friend system) dan **bot dengan skenario spesifik**, dengan Bot BPJS/Jarvis sebagai implementasi nyata dari topik Proyek Akhir pemilik produk. Pendekatan ini sengaja dirancang win-win: fitur akademik (dokumentasi klinis berbasis STT+LLM+diarization, dengan verifikasi dokter sebagai syarat mutlak) dibangun di atas infrastruktur umum yang juga bermanfaat untuk kasus penggunaan non-medis (chat multi-provider, agent, VPN multi-protokol). Batasan penting tetap dijaga: AI tidak pernah menggantikan keputusan klinis, keputusan dan pencairan klaim BPJS sepenuhnya wewenang RS/BPJS Kesehatan (aplikasi hanya membantu menyusun dokumentasi sesuai form BPJS agar dokter tinggal mereview), dan seluruh data kesehatan diperlakukan dengan standar privasi dan keamanan tertinggi yang tersedia di arsitektur ini.
