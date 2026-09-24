# Rincian Sistem — AI Hub (Aplikasi Mobile)

> Dokumen ini merangkum **seluruh sistem** dari tiga PRD yang ada di folder `PRD/` menjadi satu penjelasan teknis yang koheren, ditambah **kajian pertimbangan arsitektur hybrid Flutter + WebView** secara mendalam (kelebihan, kekurangan, alternatif, dan rekomendasi). Dokumen ini adalah dokumen *pembacaan*, bukan pengganti PRD — jika ada perbedaan detail fitur, PRD tetap acuan utama.

Sumber:
- `PRD/PRD-Hub-Multi-Provider-AI-Agent-VPN.md` — produk umum (hub AI/agent/VPN)
- `PRD/PRD-AI-Hub-Jarvis-BPJS.md` — revisi gabungan + modul Bot BPJS/Jarvis (Proyek Akhir)
- `PRD/PRD-Dokumentasi-Percakapan-Perawat-Pasien.md` — PRD akademik murni (Proyek Akhir, PENS PSDKU Lamongan)
- `app/` — codebase Flutter saat ini (UI preview, belum terhubung backend penuh)

---

> **Update status implementasi (terbaru menggantikan asumsi di dokumen ini):**
> Arsitektur hybrid yang dibahas di §4 **sudah diimplementasikan penuh**, dengan
> keputusan akhir yang lebih agresif dari rekomendasi awal dokumen ini: hampir
> seluruh UI (Login, Home, Chat, Bot/Agent Hub, Friends, Settings, Profile, VPN
> status) sekarang **berjalan di layer web** (`web/`, kontainer Docker nginx
> terpisah, di-load lewat satu `WebView` persisten), sehingga submit ke
> Play Store/App Store cukup sekali dan pembaruan berikutnya tidak perlu rilis
> ulang. Native Flutter (`app/lib/screens/web_shell_screen.dart`) kini jadi
> cangkang tipis: bottom navigation asli + jembatan (bridge) dua arah ke web.
> **Tetap 100% native** (sesuai batasan wajib di §3.1 dan §4.5 dokumen ini):
> mikrofon/wake-word/TTS Bot BPJS (`bot_bpjs_screen.dart`), penyimpanan
> kredensial API key & VPN (Keystore/Keychain), dan aksi koneksi VPN itu
> sendiri. Detail kontrak bridge, tabel trade-off, dan catatan risiko App
> Store ada di `web/README.md` dan `app/README.md`. Bagian lain dokumen ini
> (ringkasan fitur PRD, model data, risiko akademik) tetap berlaku sebagai
> acuan produk.

---

## 1. Gambaran Umum Sistem

**AI Hub** adalah aplikasi mobile cross-platform (Android & iOS, dibangun dengan Flutter) yang berfungsi sebagai **hub terpusat** untuk:

1. **Chat multi-provider AI** — satu antarmuka untuk berbicara dengan berbagai provider (OpenAI/ChatGPT, Claude, Gemini, dll.), tinggal berpindah provider tanpa ganti aplikasi.
2. **AI Agent Hub** — menjalankan agent otonom (riset, coding, data, planner, dll.) yang bisa memanfaatkan provider AI yang sudah dikonfigurasi dan (bila perlu) VPN untuk mengakses server pribadi.
3. **Bot Hub** — bot dengan skenario percakapan/voice yang sudah dipaketkan (berbeda dari agent bebas), termasuk **Bot BPJS "Jarvis"**.
4. **VPN terintegrasi** dengan protokol yang bisa diganti (WireGuard, OpenVPN, dst.).
5. **Login, profil, dan Friend System** — pertemanan antar pengguna (terutama perawat ↔ dokter) sehingga hasil kerja bot/agent bisa diarahkan ke orang yang tepat.
6. **Activity Log** terpusat tersimpan di Supabase, untuk audit dan (untuk modul Bot BPJS) evaluasi akademik.

Produk ini menggabungkan dua tujuan sekaligus secara *win-win*:
- **Tujuan produk umum**: aplikasi produktivitas AI serbaguna.
- **Tujuan akademik (Proyek Akhir)**: modul **Bot BPJS/Jarvis** adalah implementasi nyata dari topik PA pemilik produk — *"Pengembangan Aplikasi Mobile untuk Otomatisasi Dokumentasi Percakapan Perawat-Pasien sebagai Pendukung Verifikasi Diagnosis Pasien Menggunakan Speech-to-Text dan Large Language Model"* (studi kasus RS Ahmad Yani Surabaya, PENS PSDKU Lamongan).

Bot BPJS berjalan **di atas** infrastruktur umum AI Hub (autentikasi, friend list, chat, logging) sehingga PA tidak perlu membangun aplikasi terpisah, dan produk umum mendapat fitur nyata bernilai tinggi.

---

## 2. Ruang Lingkup Fitur

### 2.1 Fitur umum (produk)
| Modul | Deskripsi singkat |
|---|---|
| Onboarding & Login | Setup API key AI, kredensial VPN, login/registrasi email+password, upgrade dari sesi anonim |
| Multi-Provider AI Chat | Pilih provider aktif per percakapan; riwayat tersimpan per konteks |
| AI Agent Hub | Menjalankan agent otonom (Research, Code, Data, Planner, dll.) |
| Bot Hub | Bot siap pakai dengan alur percakapan/voice yang sudah dipaketkan (modular — bot baru tinggal didaftarkan) |
| VPN | Koneksi VPN dengan protokol dinamis (WireGuard/OpenVPN), status real-time |
| Friend System | Cari pengguna, kirim/terima permintaan pertemanan, status online |
| Manajemen Kredensial | API key, config VPN, kredensial akun — semua di Settings, terenkripsi |
| Activity Log | Log semua aktivitas (AI, Agents, Bots, VPN, Friends, System), bisa difilter |

### 2.2 Modul akademik: Bot BPJS "Jarvis"
Alur inti (voice assistant untuk dokumentasi klinis):

1. Perawat ucapkan wake word **"Halo Jarvis"** → dideteksi on-device.
2. Jarvis menjawab via TTS: *"Iya, ada yang bisa saya bantu?"*
3. Perawat: *"Bantu saya mendiagnosis penyakit"* → intent dikenali.
4. Jarvis mengaktifkan Bot BPJS dan mulai merekam sesi.
5. Audio diproses: **Speech-to-Text** → **Speaker Diarization** (pisahkan ucapan perawat vs pasien) → **LLM** (ekstraksi info, ringkasan, dokumentasi terstruktur, timeline percakapan).
6. Jarvis menanyakan tujuan pengiriman ("dikirim ke dokter siapa?") → dicocokkan ke **Friend List** perawat.
7. Dokumentasi + transkrip + metadata dikirim ke dokter tujuan.
8. Dokter meninjau (boleh dibantu provider LLM pilihannya sendiri), menandai **Sesuai** (`matches_bpjs_form`) atau **Perlu Perbaikan** (`needs_revision`, balik ke perawat).
9. Semua tahap tercatat di Activity Log untuk audit klinis dan evaluasi akademik (WER, waktu proses, dsb.).

**Batasan penting yang wajib dijaga (etik & hukum):**
- Sistem **tidak pernah** menetapkan diagnosis — hanya menyediakan draf/dokumentasi pendukung.
- Sistem **tidak** memutuskan/memproses pencairan dana BPJS — itu wewenang penuh sistem internal RS/BPJS Kesehatan. Status yang dikelola aplikasi hanya `pending_review` → `matches_bpjs_form` / `needs_revision`.
- Setiap output AI wajib berlabel **"Draf AI — perlu verifikasi dokter"**.
- Data kesehatan (audio, transkrip, dokumentasi) adalah data sensitif — enkripsi wajib, akses dibatasi RLS (hanya perawat pengirim & dokter tujuan), selaras Permenkes No. 24/2022 dan UU PDP.

---

## 3. Arsitektur Sistem

### 3.1 Prinsip inti: Hybrid Flutter Native Shell + WebView

Aplikasi menggunakan pendekatan **hybrid**: sebagian UI/logic native (Flutter dikompilasi ke Android/iOS), sebagian lagi di-*hosting* sebagai konten web yang dimuat via WebView di dalam shell native.

**Yang wajib native** (butuh akses OS-level atau keamanan tinggi):
- Secure Credential Store (Android Keystore / iOS Keychain) — API key, config VPN, token sesi.
- VPN Manager (WireGuard/OpenVPN) — butuh VPN service/permission tingkat OS.
- Wake Word Engine (on-device, "Halo Jarvis") — hemat baterai, tidak mengirim audio terus-menerus ke server.
- Voice Session Recorder — mengelola izin mikrofon, aktif hanya setelah wake word + intent terdeteksi.
- Text-to-Speech (TTS) untuk respons suara Jarvis.
- Push notification, biometric lock, navigasi bawah, splash screen.
- WebView container (`webview_flutter` / `flutter_inappwebview`) sebagai host konten.

**Yang berada di Web Layer** (sering berubah, tidak butuh akses native langsung):
- UI & logic chat multi-provider.
- AI Agent Hub (daftar agent, konfigurasi, progres eksekusi).
- Bot Hub (daftar bot, termasuk tampilan sesi Bot BPJS — kecuali kontrol mikrofon/rekaman yang tetap native).
- Friend list & pencarian pengguna.
- Settings/Credentials UI (form input — data dikirim ke native lewat bridge, **tidak pernah** disimpan di layer web).
- Activity Log viewer.

**JS Bridge (native ↔ web)** — jembatan komunikasi dua arah (`JavascriptChannel` / `postMessage`):
- Web meminta native menyimpan/membaca kredensial terenkripsi (kredensial mentah tidak pernah "lewat" di layer JS di luar sesi aktif).
- Web meminta native connect/disconnect VPN, menerima status real-time.
- Native mengirim event (status VPN, hasil agent, status sesi Bot BPJS) ke web untuk update UI.

```
┌─────────────────────────────────────────────────────────────────┐
│                     FLUTTER NATIVE SHELL                        │
│                (dikompilasi sekali per rilis store)              │
│                                                                   │
│  Secure Credential Store   VPN Manager   Wake Word / TTS / Mic   │
│         │                       │                  │             │
│         └───────────────────────┴──────────────────┘             │
│                              │                                    │
│                        JS Bridge (native ↔ web)                   │
│                              │                                    │
│                       WebView Container                           │
└──────────────────────────────┼───────────────────────────────────┘
                                 │ HTTPS (domain whitelist/pinned)
                                 ▼
                    ┌────────────────────────────┐
                    │       WEB LAYER (server)     │
                    │  Chat UI · Agent Hub · Bot   │
                    │  Hub · Friends · Settings ·  │
                    │  Activity Log                │
                    │  (di-update tanpa rebuild)   │
                    └──────────────┬───────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
      Provider AI            AI Agent Hub            Logging Service
      (OpenAI/Claude/         (agent framework)        (Supabase)
       Gemini, dll.)
```

### 3.2 Model Data (Supabase)

**Tabel umum:**
- `profiles` — id, display_name, role (`general`/`perawat`/`dokter`), instansi, spesialisasi.
- `friendships` — user_id_a, user_id_b, status (`pending`/`accepted`/`blocked`), created_at.
- `activity_log` — provider/agent/bot/VPN/friend, waktu, status.

**Tabel khusus Bot BPJS:**
- `bpjs_sessions` — id, perawat_id, dokter_id, pasien_nama/identifier, status (`recording`/`processing`/`sent`/`needs_revision`/`matches_bpjs_form`), created_at, updated_at.
- `bpjs_transcripts` — session_id, speaker (`perawat`/`pasien`), text_segment, timestamp_offset.
- `bpjs_documents` — session_id, ringkasan, dokumentasi_terstruktur (json), alur_percakapan (json), generated_by_llm_provider.
- `bpjs_reviews` — session_id, dokter_id, verdict (`approved`/`needs_revision`), catatan, reviewed_at.

Semua tabel menggunakan **Row Level Security (RLS)**: baris hanya bisa diakses oleh pihak yang relevan (mis. perawat pengirim & dokter tujuan saja), bukan seluruh pengguna.

### 3.3 Status Implementasi Saat Ini (`app/`)

Codebase Flutter yang ada sekarang (`app/lib/`) adalah **UI preview murni**, belum terhubung ke backend penuh:
- Layar sudah ada: splash, onboarding API key, onboarding VPN, home dashboard, chat, agent hub, agent execution, bot hub, bot BPJS, VPN connection, settings, activity log (`app/lib/screens/`).
- Dependency `supabase_flutter` sudah terpasang, ada `app/supabase/schema.sql`, tapi menurut `app/README.md`: *"No AI requests or VPN connections are made. API keys and credentials are neither persisted nor transmitted."* — artinya ini masih tahap **mockup interaktif** dengan data contoh (sample data), belum ada WebView, JS bridge, VPN service, wake-word engine, atau koneksi provider AI/LLM sungguhan.
- Belum ada implementasi hybrid WebView — seluruh UI saat ini murni native Flutter widgets.

Ini penting untuk konteks pertimbangan arsitektur di bagian berikut: keputusan hybrid vs full-native **belum terkunci** oleh implementasi — masih di tahap desain/PRD, sehingga masih terbuka untuk dievaluasi ulang.

---

## 4. Pertimbangan Arsitektur: Hybrid Flutter + WebView

Ini adalah bagian inti yang diminta — kajian mendalam tentang keputusan arsitektur hybrid, karena ini pilihan besar yang memengaruhi biaya, kecepatan iterasi, dan risiko produk.

### 4.1 Mengapa hybrid dipertimbangkan (alasan di balik PRD)

Motivasi utama di PRD adalah **"build sekali, tetap bisa diupdate tanpa build ulang"**:
- Perubahan UI, penambahan provider AI/bot/agent baru, perbaikan tampilan → cukup update konten web di server, langsung terlihat semua pengguna **tanpa** submit ulang ke App Store/Play Store.
- Fungsi sensitif (VPN, penyimpanan kredensial, mikrofon/wake-word) tetap 100% native — aman & sesuai kebijakan platform.
- Iterasi produk jauh lebih cepat karena tidak terikat siklus review App Store/Play Store untuk *setiap* perubahan non-native.

### 4.2 Kelebihan (Pros)

| Aspek | Manfaat |
|---|---|
| **Kecepatan iterasi** | Update fitur chat/agent/bot/UI hub bisa tayang dalam hitungan menit (deploy web), bukan hari/minggu (review store) |
| **Modularitas provider/agent/bot** | Provider/agent/bot baru bisa didaftarkan lewat konten web + config, tanpa rebuild aplikasi (selaras NFR-03/NFR-10) |
| **Eksperimen A/B & rollback cepat** | Konten web bisa di-rollback instan jika ada bug, tanpa menunggu approval store |
| **Keamanan fungsi sensitif tetap terjaga** | VPN, kredensial, mikrofon tetap native — tidak diserahkan ke lapisan web (NFR-01) |
| **Satu codebase native untuk shell** | Tetap cross-platform Android/iOS dengan satu basis Flutter untuk bagian yang benar-benar perlu native |
| **Relevan untuk skenario akademik** | Bot BPJS bisa terus disempurnakan (prompt LLM, alur UI dokumentasi) selama masa evaluasi PA tanpa perlu build ulang tiap iterasi |

### 4.3 Kekurangan & Risiko (Cons)

| Risiko | Penjelasan | Tingkat keseriusan |
|---|---|---|
| **Kebijakan App Store 4.7 / Play Console** | Apple secara eksplisit mengatur "remote code/content" — WebView yang memuat & mengeksekusi logic dari server bisa dianggap upaya bypass review jika tidak didokumentasikan dan dibatasi dengan jelas | **Tinggi** — bisa berujung penolakan/takedown jika salah kelola |
| **Kompleksitas JS Bridge** | Setiap fitur yang butuh native (kredensial, VPN, mikrofon) butuh desain bridge API yang aman dan stabil dua arah; makin banyak fitur, makin kompleks permukaan bridge | Sedang–Tinggi |
| **Versioning mismatch** | Shell native versi lama + konten web versi baru bisa menyebabkan fitur error/crash jika bridge API berubah tanpa strategi versi | Sedang |
| **Performa & UX** | WebView pada umumnya terasa kurang "native" dibanding widget Flutter asli (animasi, scrolling, transisi) — terutama terasa untuk layar dengan interaksi kompleks (chat streaming, animasi rekaman waveform) | Sedang |
| **Ketergantungan jaringan** | Konten web harus dimuat dari server — perlu mode fallback/offline yang matang (NFR-08/NFR-12) agar fitur inti (VPN, kredensial, wake-word) tetap jalan tanpa koneksi | Sedang |
| **Keamanan WebView** | Harus HTTPS + domain whitelist ketat untuk JS bridge, karena WebView yang memuat domain sembarang berisiko injeksi/XSS yang bisa menyentuh bridge native | Tinggi jika lalai |
| **Untuk modul Bot BPJS khususnya** | Sensor mikrofon, indikator rekaman, dan animasi waveform sebaiknya tetap native agar transparansi rekaman (etika) benar-benar real-time dan tidak tertunda oleh loading WebView | Perlu native murni di bagian ini |

### 4.4 Alternatif yang dipertimbangkan (untuk perbandingan)

| Pendekatan | Kecepatan iterasi | Kualitas UX native | Risiko kebijakan store | Kompleksitas dev |
|---|---|---|---|---|
| **Full-native Flutter** (tanpa WebView) | Rendah — tiap perubahan UI butuh build+release ulang | Tinggi | Rendah | Rendah–Sedang |
| **Hybrid Flutter + WebView** (pendekatan PRD) | Tinggi untuk layer web | Sedang (campuran) | Sedang–Tinggi (perlu mitigasi) | Tinggi (perlu bridge) |
| **Full WebView/PWA-wrapper** (shell tipis) | Sangat tinggi | Rendah (semua terasa web) | Tinggi (fungsi sensitif seperti VPN/mic sulit diakses aman dari web) | Sedang, tapi limitasi akses native besar |
| **Server-driven UI native** (native tapi layout dikirim dari server, mis. JSON schema → widget Flutter) | Tinggi, tanpa risiko kebijakan WebView | Tinggi | Rendah | Tinggi (butuh engine render dinamis sendiri) |

### 4.5 Rekomendasi

1. **Pertahankan hybrid, tapi batasi cakupannya dengan tegas**: WebView hanya untuk UI/logic yang **benar-benar** non-sensitif dan sering berubah (chat, agent hub, bot hub tampilan non-mikrofon, friends, settings, activity log). Semua yang menyentuh VPN, kredensial, mikrofon, wake-word, TTS **wajib** tetap 100% native — ini sudah selaras dengan PRD dan harus dijaga ketat saat implementasi.
2. **Dokumentasikan justifikasi WebView ke reviewer store sejak awal** (App Store Guideline 4.7 / Play Console): jelaskan bahwa WebView hanya menyajikan UI aplikasi sendiri (bukan mini-app pihak ketiga), domain di-whitelist, dan fungsi inti native tidak terpengaruh oleh update konten web.
3. **Rancang versioning bridge API secara eksplisit sejak MVP** — server konten web sebaiknya bisa mendeteksi versi shell dan menyajikan konten kompatibel, agar tidak ada breaking change tiba-tiba bagi pengguna yang belum update shell.
4. **Untuk layar Bot BPJS sesi aktif (indikator rekaman, waveform, tombol stop) — implementasikan sebagai widget Flutter native**, bukan WebView, demi latensi rendah dan transparansi etis (indikator harus real-time, tidak menunggu load WebView).
5. **Pertimbangkan menunda WebView untuk MVP/skripsi**: mengingat codebase saat ini masih 100% native preview dan deadline akademik (PA) umumnan terbatas, ada opsi pragmatis: **selesaikan dulu Bot BPJS + alur inti secara full-native** (lebih cepat diverifikasi, lebih rendah risiko kebijakan store, cukup untuk kebutuhan evaluasi PA), lalu **migrasi bertahap ke hybrid WebView** untuk modul non-akademik (chat multi-provider, agent hub umum) setelah PA selesai/pada fase produk lanjutan. Ini memisahkan risiko: kebutuhan akademik yang berbatas waktu tidak tersandera kompleksitas bridge yang belum matang.

---

## 5. Kebutuhan Non-Fungsional Kunci

| Kategori | Kebutuhan |
|---|---|
| Keamanan | Kredensial (API key, VPN config, token sesi) wajib terenkripsi via Keystore/Keychain, tidak pernah diserahkan ke layer WebView |
| Privasi data kesehatan | Transkrip & dokumentasi pasien wajib dienkripsi in-transit & at-rest, akses dibatasi RLS, selaras Permenkes No. 24/2022 & UU PDP |
| Cross-platform | Satu codebase Flutter untuk Android & iOS |
| Modularitas | Provider/agent/bot/protokol VPN baru ditambahkan tanpa mengubah arsitektur inti |
| Reliabilitas | Koneksi & pergantian protokol VPN tidak boleh membuat aplikasi crash |
| Updatability | Konten non-native diperbarui via OTA tanpa submit ulang ke store |
| Ketersediaan offline | Fitur inti (VPN, kredensial, wake-word) tetap berfungsi tanpa koneksi WebView |
| Auditability | Setiap transisi status dokumentasi Bot BPJS tercatat dengan timestamp untuk audit klinis & evaluasi akademik |
| Identitas | Pengiriman dokumentasi pasien hanya ke pengguna berstatus "friend" — mencegah salah kirim |

---

## 6. Risiko Utama & Mitigasi (Ringkasan)

| Risiko | Mitigasi |
|---|---|
| Kebocoran API key/kredensial | Enkripsi wajib, tidak pernah log plain text |
| WebView dianggap bypass review store | Batasi WebView untuk UI non-sensitif, whitelist domain, dokumentasikan ke reviewer |
| Wake word salah terpicu / rekam tanpa sadar | Konfirmasi visual+suara jelas, tombol stop selalu terlihat, izin eksplisit tiap sesi |
| Salah kirim dokumentasi pasien | Kirim hanya via Friend List, konfirmasi ulang nama dokter, log lengkap |
| Halusinasi LLM | Label "Draf AI — perlu verifikasi dokter", dokter wajib approve, transkrip asli selalu tersedia |
| Kesalahpahaman soal pencairan BPJS | PRD & laporan PA menegaskan aplikasi hanya menandai kecocokan dokumentasi dengan form BPJS, bukan memutuskan klaim |
| Data kesehatan bocor | RLS ketat per sesi, enkripsi penuh, retensi data dibatasi, audit log lengkap |

---

## 7. Pemetaan Fitur ke Proyek Akhir (Akademik)

| Permasalahan/Tujuan PA | Fitur/Komponen Terkait |
|---|---|
| Menangkap percakapan perawat-pasien sebagai sumber dokumentasi | Wake word + rekaman sesi Bot BPJS |
| Menerapkan Speech-to-Text | Komponen STT pada arsitektur alur data Bot BPJS |
| Menerapkan LLM untuk ekstraksi & ringkasan terstruktur | Komponen LLM, tabel `bpjs_documents` |
| Menyediakan dokumentasi untuk verifikasi dokter | Layar dokumentasi Bot BPJS, status `approved`/`needs_revision` |
| Evaluasi kinerja sistem (WER, kelengkapan, factual consistency, waktu) | Auditability timestamp tiap tahap → data mentah evaluasi baseline (STT-only) vs proposed (STT+LLM) |
| Speaker diarization + role identification | Komponen diarization, tabel `bpjs_transcripts` |

---

## 8. Struktur Proyek Saat Ini

```
PROJECT MOBILE APP/
├── PRD/                                          # Dokumen kebutuhan produk
│   ├── PRD-Hub-Multi-Provider-AI-Agent-VPN.md     # Produk umum
│   ├── PRD-AI-Hub-Jarvis-BPJS.md                  # Revisi gabungan + modul akademik
│   └── PRD-Dokumentasi-Percakapan-Perawat-Pasien.md  # PRD akademik murni (PA)
├── docs/
│   └── RINCIAN-SISTEM.md                          # Dokumen ini
└── app/                                           # Codebase Flutter
    ├── lib/
    │   ├── main.dart
    │   ├── screens/     # splash, onboarding, dashboard, chat, agent hub,
    │   │                # bot hub, bot BPJS, VPN, settings, activity log
    │   ├── widgets/      # komponen UI bersama (hub_ui.dart, onboarding_scaffold.dart)
    │   ├── services/     # supabase_service.dart
    │   └── theme.dart
    ├── supabase/
    │   └── schema.sql
    └── pubspec.yaml     # dependency: supabase_flutter, dll.
```

Status saat ini: **UI preview native Flutter dengan data contoh** — belum ada WebView/JS bridge, belum ada koneksi provider AI/LLM sungguhan, belum ada VPN service atau wake-word engine yang berfungsi nyata.

---

## 9. Kesimpulan

AI Hub adalah platform mobile hybrid yang menggabungkan produk agregator AI/agent/VPN dengan modul akademik Bot BPJS/Jarvis untuk dokumentasi klinis perawat-pasien. Arsitektur yang direncanakan adalah **Flutter native shell + WebView untuk konten yang sering berubah**, dengan batasan tegas: seluruh fungsi sensitif (kredensial, VPN, mikrofon, wake-word, TTS) tetap native. Pendekatan hybrid memberi kecepatan iterasi tinggi dan modularitas, tapi membawa risiko kebijakan store dan kompleksitas bridge yang harus dikelola secara sengaja sejak desain awal — bukan ditambal belakangan. Mengingat implementasi saat ini masih berupa preview 100% native, ada ruang untuk memulai dari fondasi native yang solid (terutama untuk modul akademik berbatas waktu) sebelum memperluas ke arsitektur hybrid penuh untuk fitur produk jangka panjang.
