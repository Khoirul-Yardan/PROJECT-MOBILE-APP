# Rincian Sistem — AI Hub (Aplikasi Mobile)

> Dokumen ini merangkum **kondisi sistem yang sudah dibangun dan berjalan**, ditulis ulang per **5 Oktober 2026** dengan membaca kode sumber langsung (`app/lib/`, `web/public/`, `app/supabase/schema.sql`) — bukan dari PRD awal lagi. Dokumen aslinya (lihat riwayat git) ditulis saat proyek masih tahap *UI preview* murni native tanpa backend; sejak itu arsitekturnya **sudah berubah signifikan** dari rencana awal, dan beberapa fitur yang direncanakan (Friend System, wake word "Halo Jarvis", TTS, alur review-dokter-berbasis-akun) **sengaja dihapus total** atas keputusan eksplisit pemilik produk setelah diuji — bukan belum selesai dikerjakan.
>
> Untuk alur teknis step-by-step + diagram Mermaid, lihat `docs/diagram-alur.md` — dokumen ini fokus ke gambaran sistem secara keseluruhan dan alasan di balik keputusan arsitektur.

Sumber PRD asli (masih relevan sebagai konteks tujuan produk, **tidak lagi akurat soal fitur spesifik** — lihat §2 untuk daftar fitur yang benar-benar berjalan):
- `PRD/PRD-Hub-Multi-Provider-AI-Agent-VPN.md`
- `PRD/PRD-AI-Hub-Jarvis-BPJS.md`
- `PRD/PRD-Dokumentasi-Percakapan-Perawat-Pasien.md`

---

## 1. Gambaran Umum Sistem

**AI Hub** adalah aplikasi mobile Android (dibangun dengan Flutter sebagai cangkang tipis + WebView) yang berfungsi sebagai **hub terpusat** untuk:

1. **Chat multi-provider & multi-agent AI** — satu antarmuka untuk ChatGPT, Claude, Gemini, OpenRouter (provider), serta Hermes dan OpenClaw (agent) — setara, bisa dipilih bebas, tanpa hierarki "agent vs provider" yang dibeda-bedakan di Chat.
2. **Universal API key** — pengguna tempel satu API key apa pun, sistem mengenali sendiri vendornya dari bentuk key-nya (atau quick-pick manual jika tidak dikenali). Bisa menyimpan **lebih dari satu key untuk provider yang sama** (mis. 2 akun Gemini gratis) — sistem otomatis berpindah key kalau satu kena limit, tanpa pengguna harus bolak-balik ganti chip di Chat.
3. **VPN** — WireGuard dengan tunnel jaringan **sungguhan** (via `VpnService` Android, bukan simulasi); OpenVPN/SSH baru sebatas form konfigurasi (jujur ditampilkan ke pengguna sebagai belum punya tunnel nyata).
4. **Bot BPJS** — asisten suara untuk mendokumentasikan percakapan perawat-pasien: tekan mikrofon, bicara, dapat draf dokumentasi dari LLM yang **bisa diedit langsung** di layar, lalu disalin/diekspor (PDF/DOCX) untuk dikirim ke dokter lewat kanal apa pun yang perawat pakai sehari-hari (WhatsApp, email, cetak).
5. **Riwayat Chat** — percakapan tersimpan permanen per AI/agent, bisa diakses lagi lewat halaman Riwayat meski sempat pindah menu atau menutup aplikasi.
6. **Login & profil** sederhana (email/password via Supabase Auth), dan **Activity Log** append-only untuk jejak aktivitas.

**Yang sudah tidak ada** (dihapus total, bukan belum dibangun): Friend System (pertemanan antar pengguna), AI Agent Hub bergaya "jalankan task card simulasi" (diganti pendekatan "agent = chip setara provider di Chat"), wake word "Halo Jarvis" + Text-to-Speech, dan alur review-dokter-via-akun (`matches_bpjs_form`/`needs_revision`).

Produk ini tetap menggabungkan dua tujuan: **produk produktivitas AI serbaguna** (chat, agent, VPN) dan **modul akademik Bot BPJS** (dokumentasi klinis berbasis STT + LLM) — tapi jalur kerja Bot BPJS sekarang jauh lebih sederhana daripada rencana awal: tidak butuh akun dokter, tidak butuh pertemanan, tidak ada verdict/approval — perawat merekam, mengedit draf, lalu mengirim sendiri seperti mengisi dan membagikan form rujukan kertas.

---

## 2. Ruang Lingkup Fitur (Kondisi Riil)

### 2.1 Fitur umum (produk)

| Modul | Status | Deskripsi |
|---|---|---|
| Login & Registrasi | ✅ Berjalan | Email + password via Supabase Auth |
| Chat multi-provider & agent | ✅ Berjalan (butuh API key milik pengguna) | Satu picker, provider dan agent setara, histori tersimpan |
| Skills chat (`/system`, `/clear`, `/help`) | ✅ Berjalan | Gaya Telegram — ketik `/` memunculkan palet perintah |
| Riwayat Chat | ✅ Berjalan | Tabel `chat_messages`, halaman `/history` mengelompokkan per AI/agent |
| Universal API key + deteksi otomatis | ✅ Berjalan | Regex per vendor, quick-pick untuk yang tidak dikenali |
| Multi-key per provider + auto-rotation | ✅ Berjalan | Simpan beberapa key per provider sebagai "slot", otomatis pindah slot saat kena limit |
| Gemini: pemilihan & fallback model otomatis | ✅ Berjalan | Model tidak tersedia/limit:0/503 → coba model lain otomatis, bukan langsung gagal |
| VPN WireGuard | ✅ Berjalan | Tunnel jaringan asli via Android `VpnService` |
| VPN OpenVPN/SSH | 🟡 Parsial | Form config tersimpan, tunnel belum nyata |
| Manajemen Kredensial | ✅ Berjalan | API key dienkripsi AES-GCM sebelum disimpan ke Supabase; config VPN di Keystore/Keychain lewat native |
| Activity Log | ✅ Berjalan | Append-only, realtime, bisa difilter |
| Friend System | ❌ Dihapus total | Bukan belum dibangun — sempat ada, lalu dicabut atas permintaan eksplisit karena menambah friksi tanpa manfaat sepadan |
| AI Agent Hub (task card simulasi) | ❌ Dihapus dari desain | Diganti: agent (Hermes, OpenClaw) jadi entri setara provider di Chat, dipanggil via API/gateway sungguhan, bukan kartu tugas simulasi |

### 2.2 Modul akademik: Bot BPJS

Alur inti saat ini (jauh lebih sederhana dari rencana awal):

1. Perawat buka Bot BPJS, **tekan lingkaran mikrofon langsung** — tidak ada wake word, tidak ada "Halo Jarvis", tidak ada balasan suara (TTS).
2. Aplikasi menanyakan nama pasien, lalu nama + instansi dokter tujuan (diketik bebas, seperti mengisi form rujukan kertas — bukan memilih dari daftar akun/pertemanan).
3. Perawat bicara dengan pasien; audio diproses **Speech-to-Text on-device** (`speech_to_text`, locale Indonesia) secara langsung, teks tampil real-time.
4. Perawat tekan "Hentikan Sesi" → transkrip dikirim ke LLM (provider/agent AI yang sudah terhubung oleh perawat) untuk disusun jadi draf dokumentasi terstruktur (ringkasan, catatan, dll).
5. **Draf ditampilkan di layar Review dan bisa diedit langsung** (bukan teks statis) — perawat membenarkan tulisan sebelum lanjut.
6. Perawat memilih: **Salin Teks**, **Ekspor PDF**, atau **Ekspor DOCX** — lalu membagikannya sendiri lewat share sheet OS (WhatsApp, email, Drive, dll) ke dokter tujuan.
7. Sesi ditandai `terkirim` di database (`bpjs_sessions.status`) sebagai jejak riwayat perawat sendiri.

**Yang dihapus dari rencana awal (dan kenapa):**
- **Wake word "Halo Jarvis" + TTS** — tidak pernah diimplementasikan sebagai deteksi suara pasif sungguhan (selalu terpicu tombol), dan atas permintaan eksplisit pemilik produk, klaim "Jarvis" dihapus total dari UI/copy — bot ini sekarang murni *tekan-mic-lalu-bicara*, tanpa persona asisten bernama.
- **Friend List sebagai syarat kirim dokumentasi** — pendekatan lama mewajibkan dokter sudah punya akun aplikasi dan sudah "berteman" dengan perawat sebelum dokumentasi bisa dibuat. Ini terbukti jadi penghambat nyata (dokter jarang memakai aplikasi internal rumah sakit). Diganti: nama dokter + instansi cukup diketik manual, dokumentasi dikirim keluar aplikasi oleh perawat sendiri — meniru alur kerja rumah sakit yang sudah ada.
- **Review & verdict dokter via akun** (`matches_bpjs_form` / `needs_revision`) — ikut dihapus bersama Friend System karena bergantung pada akun dokter.
- **Speaker diarization** (pisah suara perawat vs pasien) — **belum ada**, semua segmen percakapan masih ditandai `speaker: 'perawat'` secara default (keterbatasan jujur, bukan fitur yang diklaim selesai).

**Batasan etik & hukum yang tetap dijaga:**
- Sistem tidak pernah menetapkan diagnosis — hanya draf dokumentasi yang **wajib diverifikasi/diedit perawat** sebelum dikirim (kini difasilitasi langsung lewat field yang bisa diedit di layar Review, bukan sekadar label peringatan).
- Sistem tidak memutuskan/memproses klaim BPJS — hanya alat bantu dokumentasi.
- Data kesehatan (transkrip, dokumentasi) dibatasi lewat Row Level Security: hanya `perawat_id` pemilik sesi yang bisa membaca/menulis baris terkait, tidak ada akses lintas akun sama sekali (lebih ketat dari rencana awal yang membuka akses ke dokter tujuan juga).

---

## 3. Arsitektur Sistem

### 3.1 Keputusan akhir: Hybrid Flutter Shell + WebView — lebih agresif dari rencana awal

Rencana awal (§4 versi lama dokumen ini) mempertimbangkan hybrid secara hati-hati, menyisakan opsi "tunda WebView, selesaikan dulu versi native". Keputusan akhir yang **sungguh-sungguh diimplementasikan** justru lebih jauh ke arah web: **hampir seluruh UI aplikasi** (Login, Home, Chat, Riwayat, Bot Hub, VPN status & config, Settings, Provider & Agent, Activity Log) berjalan di **satu WebView persisten** yang memuat SPA vanilla JS dari kontainer Docker nginx terpisah (`web/`). Flutter (`app/lib/screens/web_shell_screen.dart`) kini betul-betul jadi cangkang tipis: hanya memuat WebView dan menjembatani 7 jenis pesan native (lihat §3.3).

**Yang tetap 100% native** (sesuai prinsip awal — tidak berubah):
- **Mikrofon & Speech-to-Text** Bot BPJS (`BotBpjsScreen`, widget Flutter penuh, bukan WebView) — demi latensi rendah dan kontrol izin OS langsung.
- **VPN**: config tersimpan di `FlutterSecureStorage` (Keystore/Keychain), dan koneksi WireGuard sungguhan lewat `wireguard_flutter` (`VpnService` Android) — butuh akses OS-level yang tidak bisa dilakukan dari web.
- **Enkripsi/dekripsi kredensial** di sisi native untuk kebutuhan Bot BPJS (mirror dari enkripsi yang dilakukan web lewat Web Crypto API).

**Yang berubah dari rencana awal**: penyimpanan **API key provider/agent AI** semula direncanakan lewat Keystore/Keychain native. Implementasi akhir memindahkannya ke **Supabase, terenkripsi AES-GCM di sisi web** (`web/public/credentials.js`) — alasannya: key yang hanya tersimpan di satu device hilang total setiap kali aplikasi di-uninstall/reinstall atau pengguna ganti HP. Row Level Security tetap jadi kontrol akses sesungguhnya; enkripsi klien adalah lapisan defense-in-depth tambahan, bukan pengganti RLS.

```
┌─────────────────────────────────────────────────────────────────┐
│                     FLUTTER NATIVE SHELL                        │
│                                                                   │
│   FlutterSecureStorage      WireGuard/VpnService    Mic + STT    │
│     (config VPN)              (tunnel asli)       (Bot BPJS)     │
│         │                        │                    │          │
│         └────────────────────────┴────────────────────┘          │
│                              │                                    │
│                     NativeBridge (postMessage)                    │
│                   7 tipe pesan — lihat §3.3                       │
│                              │                                    │
│                       WebViewController                           │
│              (immersiveSticky — nav bar Android disembunyikan)    │
└──────────────────────────────┼───────────────────────────────────┘
                                 │ http://localhost:8090 (dev)
                                 ▼
                    ┌────────────────────────────┐
                    │   SPA (nginx, Docker)       │
                    │  Login · Home · Chat ·      │
                    │  Riwayat · Bot Hub ·        │
                    │  VPN · Settings · Activity  │
                    └──────────────┬───────────────┘
                                    │ fetch() langsung (tanpa server AI Hub)
              ┌─────────────────────┼──────────────────────────┐
              ▼                     ▼                          ▼
      Supabase (Auth,         Provider AI                Agent (Hermes,
      PostgreSQL+RLS,       (OpenAI/Claude/              OpenClaw gateway
      Realtime)              Gemini/OpenRouter)           self-hosted)
```

### 3.2 Model Data (Supabase) — 7 tabel, semua RLS aktif

| Tabel | Isi | Catatan |
|---|---|---|
| `profiles` | id, display_name, role, bio | role hanya label diri sendiri, tidak lagi dipakai untuk logika Friend System |
| `activity_log` | category, title, badge | Append-only (tidak ada policy update/delete) |
| `api_credentials` | provider_id, **label (nama slot)**, type, format, endpoint, model, encrypted_key, iv | Constraint unik **`(user_id, provider_id, label)`** — bukan lagi `(user_id, provider_id)` — supaya satu provider bisa punya banyak slot key |
| `chat_messages` | provider_id, provider_label, role, content, is_error | **Tabel baru** — persist riwayat chat per AI/agent per pengguna |
| `bpjs_sessions` | perawat_id, **dokter_nama + dokter_instansi (teks bebas)**, pasien_nama, status | `dokter_id` (FK ke akun) **sudah dihapus** — bukan lagi relasi akun |
| `bpjs_transcripts` | session_id, speaker, text_segment, timestamp_offset_ms | |
| `bpjs_documents` | session_id, ringkasan, dokumentasi_terstruktur (jsonb), alur_percakapan (jsonb) | |

**Tabel yang sudah dihapus permanen**: `friendships`, `messages` (chat 1:1 Friend System), `bpjs_reviews` (verdict dokter berbasis akun).

Aturan RLS kunci: semua tabel Bot BPJS hanya bisa diakses oleh `perawat_id` pemilik baris — **tidak ada lagi** syarat relasi/pertemanan dengan akun lain seperti rencana awal.

### 3.3 Native Bridge — 7 jenis pesan (bukan rencana, ini yang betul-betul diimplementasikan)

`session_changed`, `get_vpn_config`, `save_vpn_config`, `vpn_connect`, `vpn_disconnect`, `open_bot_bpjs`, `sign_out`. **Kredensial API AI/agent tidak lewat bridge ini sama sekali** (lihat §3.1) — hanya VPN, Bot BPJS, dan sesi yang butuh jembatan native.

---

## 4. Retrospektif: Hybrid WebView — Apa yang Terbukti Benar, Apa yang Meleset

Bagian ini menggantikan kajian "pertimbangan" versi lama (yang masih berupa opsi sebelum implementasi) dengan **evaluasi setelah dibangun dan diuji di device fisik**.

### 4.1 Yang terbukti sesuai prediksi (kelebihan)

| Prediksi awal | Realitas setelah dibangun |
|---|---|
| Iterasi fitur web jauh lebih cepat dari rebuild native | Terbukti — puluhan perubahan UI/logic (skills chat, riwayat, multi-key, deteksi provider baru) selesai lewat `docker compose up --build` dalam hitungan detik, tanpa sentuh APK sama sekali |
| Modularitas provider/agent tanpa rebuild | Terbukti — menambah Hermes dan OpenClaw ke katalog hanya mengedit `providers.js`, tidak menyentuh kode Flutter |
| Fungsi sensitif tetap aman di native | Terbukti — VPN (WireGuard asli) dan mikrofon Bot BPJS tidak pernah tersentuh layer web |

### 4.2 Yang meleset atau butuh perbaikan tambahan (realita operasional)

| Masalah nyata yang ditemukan | Akar penyebab | Status |
|---|---|---|
| Konten web "basi" meski server sudah di-rebuild | ES module browser/WebView tetap cache modul lama per-dokumen walau header `Cache-Control: no-store` sudah benar | Mitigasi operasional: hard refresh/tab baru/force-stop app — bukan bug kode, keterbatasan platform |
| `adb reverse` (port forward USB) sering ter-reset setelah install ulang APK | Perilaku normal ADB, bukan bug aplikasi | Perlu dipasang ulang tiap kali reinstall saat development |
| Render halaman dobel saat startup | `onAuthStateChange` Supabase bisa fire lebih dari sekali beruntun, masing-masing memicu render | Diperbaiki dengan `renderToken` guard di `router.js` |
| Plugin native (`wireguard_flutter`) gagal build berkali-kali | Plugin pihak ketiga meng-hardcode `compileSdkVersion` lama yang bentrok dengan dependency transitifnya sendiri | Diperbaiki dengan override Gradle di level project, bukan menunggu plugin di-update upstream |
| APK debug terasa berat/lambat di device kelas menengah | Build debug (JIT, Dart VM service aktif) secara inheren lambat — cold start pertama bisa ~4 detik | Bukan bug arsitektur hybrid — build `--release` jauh lebih responsif; perlu dibedakan saat menilai performa |

### 4.3 Risiko kebijakan App Store/Play Console — masih relevan, belum teruji di proses review sungguhan

Kajian §4.3 versi lama (soal Apple Guideline 4.7 "remote code") **masih berlaku sebagai risiko**, karena aplikasi memang belum pernah disubmit ke store sungguhan. Mitigasi yang sudah berjalan sesuai rencana: WebView hanya menyajikan UI aplikasi sendiri (bukan mini-app pihak ketiga), domain tetap terbatas ke kontainer milik sendiri. Yang **belum** dilakukan: dokumentasi formal ke reviewer store, dan strategi versioning bridge API jika shell native dan konten web suatu saat berbeda versi signifikan — ini tetap jadi pekerjaan rumah sebelum rilis produksi, bukan sesuatu yang sudah selesai.

---

## 5. Kebutuhan Non-Fungsional — Status Riil

| Kategori | Kebutuhan | Status |
|---|---|---|
| Keamanan kredensial | API key terenkripsi, tidak pernah plaintext di database | ✅ AES-GCM (web) + mirror dekripsi native; RLS sebagai kontrol akses sesungguhnya |
| Privasi data kesehatan | Transkrip/dokumentasi dibatasi akses | ✅ RLS per `perawat_id`, **lebih ketat** dari rencana awal (tidak ada lagi akses dokter via akun) |
| Modularitas | Provider/agent baru tanpa ubah arsitektur inti | ✅ Terbukti — `providers.js` katalog-driven |
| Updatability | Konten non-native diperbarui tanpa submit ulang store | ✅ Terbukti berulang kali selama development |
| Reliabilitas panggilan AI | Tidak gagal total saat satu key/model bermasalah | ✅ Auto-rotation slot key (kena limit) + auto-fallback model Gemini (model tak tersedia/503) |
| Ketersediaan tanpa koneksi | Fitur inti (VPN, kredensial, mic) tetap jalan tanpa web | 🟡 Parsial — VPN config & koneksi WireGuard tidak butuh web aktif; Bot BPJS butuh koneksi untuk panggil LLM (fallback: transkrip mentah tersimpan jika LLM gagal) |
| Auditability | Setiap transisi status Bot BPJS tercatat | ✅ `bpjs_sessions.status` + `activity_log` |
| Identitas penerima dokumentasi | ~~Hanya ke "friend"~~ | ❌ Persyaratan ini **dicabut** — pengiriman sekarang di luar aplikasi (WhatsApp/email/cetak), bukan lagi lewat sistem pertemanan internal |

---

## 6. Risiko Utama & Mitigasi (Diperbarui)

| Risiko | Mitigasi riil yang sudah berjalan |
|---|---|
| Kebocoran API key | Enkripsi AES-GCM sebelum simpan, RLS per user, tidak pernah lewat server perantara (fetch langsung dari klien ke vendor) |
| WebView dianggap bypass review store | Domain terbatas ke kontainer sendiri; **belum** didokumentasikan formal ke reviewer — tetap risiko terbuka sebelum submit produksi |
| Satu API key kena limit menghentikan seluruh chat | Auto-rotation ke slot key lain milik provider yang sama (§7 `diagram-alur.md`) |
| Model AI tidak tersedia/overload menghentikan chat | Auto-fallback ke model lain (khusus Gemini, §8 `diagram-alur.md`) |
| Salah kirim dokumentasi pasien | **Berubah pendekatan**: bukan lagi dicegah lewat sistem Friend List, melainkan diserahkan ke kebiasaan kerja perawat (mengetik nama dokter manual, mengirim sendiri lewat kanal yang sudah dipercaya seperti form rujukan kertas) |
| Halusinasi LLM dalam draf dokumentasi | Draf **wajib ditampilkan sebagai field yang bisa diedit** sebelum disalin/diekspor — bukan sekadar label peringatan pasif |
| Kesalahpahaman soal pencairan BPJS | Aplikasi tidak pernah mengklaim memproses klaim — hanya alat bantu dokumentasi |
| Chat hilang saat pindah layar | Diperbaiki — riwayat chat dipersist ke `chat_messages`, bukan hanya di memori halaman |
| Navigation bar Android mengganggu tampilan | `SystemUiMode.immersiveSticky` + reapply otomatis saat app resume |

---

## 7. Struktur Proyek Saat Ini

```
PROJECT MOBILE APP/
├── PRD/                                   # Dokumen kebutuhan awal (konteks tujuan, bukan acuan fitur terkini)
├── docs/
│   ├── RINCIAN-SISTEM.md                  # Dokumen ini
│   └── diagram-alur.md                    # Diagram alur Mermaid + status fitur detail
├── app/                                   # Flutter — cangkang native tipis
│   ├── lib/
│   │   ├── main.dart                      # immersiveSticky + lifecycle observer
│   │   ├── screens/
│   │   │   ├── splash_screen.dart
│   │   │   ├── web_shell_screen.dart      # WebView persisten + NativeBridge (7 pesan)
│   │   │   └── bot_bpjs_screen.dart       # 100% native: mic, STT, review-bisa-edit, export
│   │   ├── services/
│   │   │   ├── supabase_service.dart      # mirror sesi native
│   │   │   ├── vpn_config_service.dart    # FlutterSecureStorage
│   │   │   ├── vpn_tunnel_service.dart    # wireguard_flutter → VpnService
│   │   │   └── bpjs_service.dart          # kredensial + panggilan LLM + export PDF/DOCX
│   │   ├── widgets/hub_ui.dart
│   │   └── theme.dart
│   ├── android/build.gradle.kts           # override compileSdk untuk wireguard_flutter
│   └── supabase/schema.sql                # 7 tabel, migrasi idempotent
├── web/                                   # SPA aktif — INI yang disajikan nginx
│   ├── public/
│   │   ├── app.js                         # router + daftar route
│   │   ├── db.js, credentials.js, chat-history.js, ai.js, gemini.js
│   │   ├── providers.js                   # katalog provider/agent + deteksi key
│   │   └── views/                         # chat.js, history.js, apikeys.js,
│   │                                       # add-api-key.js, vpn.js, vpn-config.js, dst.
│   ├── nginx.conf
│   └── docker-compose.yml
└── app/web/                                # Output build Flutter-web bawaan — TIDAK DIPAKAI
```

---

## 8. Kesimpulan

AI Hub sudah bertransisi dari tahap *UI preview native* ke **sistem hybrid yang benar-benar berjalan**: satu WebView persisten menyajikan hampir seluruh antarmuka dari kontainer web yang bisa diperbarui tanpa rebuild APK, sementara fungsi yang betul-betul butuh akses OS (mikrofon, VPN, secure storage) tetap native. Keputusan ini terbukti memberi kecepatan iterasi yang dijanjikan di kajian awal — puluhan perbaikan dan fitur baru (multi-key rotation, fallback model Gemini, riwayat chat, integrasi Hermes/OpenClaw, penyederhanaan Bot BPJS) selesai lewat deploy Docker, bukan rilis ulang aplikasi.

Dua keputusan produk terbesar yang mengubah arah dari rencana awal: **Friend System dihapus total** (dokumentasi Bot BPJS dikirim langsung oleh perawat lewat kanal yang sudah dipakai sehari-hari, bukan lewat sistem pertemanan internal), dan **wake word "Halo Jarvis" beserta TTS tidak pernah dipertahankan sebagai fitur** — Bot BPJS disederhanakan jadi tekan-mic-langsung-bicara, dengan penekanan baru pada **draf yang bisa diedit perawat** sebelum dikirim, menggantikan alur review-dokter-berbasis-akun yang dinilai menambah friksi tanpa manfaat sepadan di lapangan. Risiko kebijakan App Store/Play Console terhadap WebView tetap belum teruji lewat proses submit sungguhan dan masih jadi pekerjaan rumah sebelum rilis produksi.
