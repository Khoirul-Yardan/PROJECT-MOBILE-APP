# Kemungkinan Tools yang Dapat Dikembangkan di Menu Bot

> **Status dokumentasi — 19 Oktober 2026:** Ini daftar usulan historis. Papan Komunikasi dan Anamnesis Terpandu kini tersedia di kode sebagai tambahan mandiri; pilihan lain tetap usulan kecuali ada keputusan/bukti baru. Jawaban dosen atas dua pilihan tersebut belum diterima. Lihat [Progres.md](Progres.md).

Dokumen perencanaan: tools berbasis suara/komunikasi untuk pasien dan perawat
yang dapat **mendukung proses anamnesis**, dan cara memasukkannya ke sistem
yang sudah ada (Bot Hub). Status awal: **usulan**; status implementasi terbaru mengikuti catatan di atas.

## 1. Prinsip penempatan

Semua tools masuk sebagai **kartu baru di Bot Hub** (`web/public/views/bots.js`,
daftar `ITEMS`), berdampingan dengan Bot BPJS. Tidak ada menu baru; perawat
cukup memilih bot sesuai kondisi pasien.

Aturan memilih Flutter (native) atau WebView:

| Kebutuhan fitur | Implementasi | Alasan |
|---|---|---|
| Mikrofon kontinu, wake word, akurasi suara tinggi, diarization | **Flutter** | WebView tidak andal untuk audio latar/kontinu (sama seperti alasan Bot BPJS) |
| Kamera real-time + ML on-device (lip-reading, eye-tracking, isyarat) | **Flutter** | Butuh akses kamera frame demi frame dan inferensi lokal |
| TTS yang harus jalan andal / di latar | **Flutter** | Kontrol audio focus & volume native |
| Layar sentuh sederhana (papan ikon, form, daftar, dashboard) | **WebView** | Cukup HTML/JS, bisa diuji di browser desktop, tidak perlu rilis APK |
| Pemanggilan LLM, penyimpanan, ekspor, riwayat | **WebView + Supabase** | Infrastruktur sudah ada (`ai.js`, `db.js`, `bridge.js`) |

Pola hibrida yang sudah dipakai: UI & logika di web, hal yang tidak bisa dilakukan
WebView dipanggil lewat `bridge.js` → `Native.*` ke Flutter (`web_shell_screen.dart`).
Tools baru mengikuti pola yang sama.

## 2. Ringkasan usulan

Peran dalam anamnesis: **P** = pasien yang mengisi/berkomunikasi, **N** = perawat
yang memakai hasilnya.

| # | Nama tool | Target pasien | Peran di anamnesis | Platform | Prioritas |
|---|---|---|---|---|---|
| 1 | Bot Panggil Perawat (Voice Nurse Call) | Pasca-operasi | Pasien menyebut keluhan → perawat dapat notifikasi + keluhan terstruktur | Flutter (suara) + Web (dashboard) | Tinggi |
| 2 | Bot Papan Komunikasi (Touch-to-Speech) | ICU, stroke, tak bisa bicara | Pasien memilih ikon keluhan → jadi data anamnesis + suara | **WebView** | **Tinggi (paling mudah)** |
| 3 | Bot Anamnesis Terpandu (Voice Assistant) | Lansia, demensia, pasien umum | Asisten bertanya pertanyaan anamnesis, jawaban jadi form | Flutter (suara) + Web (form) | Tinggi |
| 4 | Bot Pengingat & Orientasi | Lansia/demensia | Pengingat obat/makan, orientasi waktu-tempat; jawaban dicatat | Web + TTS Flutter | Sedang |
| 5 | Bot Penilaian Bicara (Disartria) | Stroke, Parkinson | Skor kejelasan ucapan untuk pemantauan pemulihan | Flutter (rekam) + Web (grafik) | Sedang |
| 6 | Bot Pengenal Ucapan Kustom | Gangguan saraf | STT yang toleran ucapan tidak jelas + konfirmasi perawat | Flutter | Sedang |
| 7 | Bot Smart Room (kontrol ruangan) | Pasca-operasi | Tidak langsung ke anamnesis; hemat panggilan perawat | Flutter + IoT | Rendah |
| 8 | Bot Baca Bibir / Isyarat | Intubasi/ventilator | Terjemah gerak bibir/isyarat → teks | Flutter (kamera + ML) | Rendah (riset) |
| 9 | Bot AAC Eye-Tracking | ALS, stroke berat | Pilih ikon dengan gerak mata | Flutter (kamera + ML) | Rendah (riset) |

Urutan pengerjaan yang disarankan: **2 → 3 → 1 → 4 → 5 → 6**, sisanya sebagai
riset lanjutan/saran pengembangan tugas akhir.

## 3. Detail per tool

### 3.1 Bot Papan Komunikasi (Touch-to-Speech) — WebView

- **Kondisi:** pasien ICU, stroke, intubasi yang jarinya masih bisa menyentuh.
- **Alur:** pasien membuka papan ikon besar (Nyeri, Haus, Sesak, Mual, Toilet,
  Dingin/Panas, Panggil Suster) → pilih ikon → opsi lanjutan (skala nyeri 0–10,
  lokasi nyeri pada gambar tubuh) → sistem memutar suara via TTS dan mengirim
  notifikasi ke perawat.
- **Nilai untuk anamnesis:** setiap pilihan tersimpan sebagai entri bertanda
  waktu (keluhan utama, lokasi, skala, durasi sejak pilihan pertama). Perawat
  bisa menyalin ke form BPJS.
- **Teknis:** HTML/JS murni; TTS memakai `speechSynthesis` browser (cukup untuk
  prototipe, jika kualitas kurang pindah ke TTS Flutter lewat bridge).
  Tombol besar (≥ 64 px), kontras tinggi, tanpa gestur kompleks.
- **Data:** tabel `komunikasi_events` (lihat §5).

### 3.2 Bot Anamnesis Terpandu (Voice Assistant) — Flutter + Web

- **Kondisi:** pasien yang bisa bicara tetapi perawat ingin anamnesis awal
  terstandar (lansia, ruang tunggu, sebelum perawat datang).
- **Alur:** asisten membacakan pertanyaan (keluhan utama, sejak kapan, lokasi,
  riwayat penyakit, alergi, obat rutin) → pasien menjawab dengan suara → STT →
  LLM memetakan jawaban ke kolom form → perawat meninjau dan menyetujui.
- **Hubungan dengan Bot BPJS:** Bot BPJS merekam *percakapan perawat–pasien*;
  tool ini mengisi anamnesis *sebelum/tanpa* perawat. Keluaran memakai skema
  ringkasan yang sama (`keluhan_utama`, `durasi_gejala`, `riwayat_kesehatan`,
  `hasil_anamnesis`) sehingga bisa dipakai ulang di ekspor PDF/DOCX yang ada.
- **Teknis:** rekam & STT memakai `record` + `assemblyai_service.dart` yang
  sudah ada; pertanyaan dibacakan TTS Flutter; pemetaan jawaban lewat provider
  LLM perawat (pola `bpjs_service.dart`).
- **Catatan keselamatan:** hasil selalu berstatus *draf* sampai perawat
  menyetujui.

### 3.3 Bot Panggil Perawat (Voice Nurse Call) — Flutter + Web

- **Kondisi:** pasien pasca-operasi yang sulit bergerak/menekan tombol.
- **Alur:** wake word ("Suster") → pasien menyebut kebutuhan ("saya butuh obat
  nyeri") → STT → LLM mengklasifikasikan (nyeri, obat, toilet, darurat) dan
  prioritas → notifikasi ke dashboard perawat → perawat menandai *ditangani*.
- **Teknis:** wake word sudah menjadi kemampuan Bot BPJS (native) — gunakan
  ulang. Dashboard antrean panggilan berupa halaman web dengan Supabase Realtime.
- **Nilai anamnesis:** riwayat panggilan (jenis keluhan & waktu) menjadi data
  tren nyeri pasca-operasi.
- **Batasan:** ini alat bantu, **bukan** pengganti nurse call resmi rumah sakit
  (lihat §6).

### 3.4 Bot Pengingat & Orientasi — Web + TTS

- **Kondisi:** lansia, demensia/Alzheimer.
- **Alur:** jadwal pengingat (minum obat, makan) dibacakan TTS; asisten
  memberi orientasi ("Hari ini Kamis, Anda di Rumah Sakit …"); pasien menjawab
  "sudah/belum" lewat tombol besar atau suara; jawaban dicatat.
- **Nilai anamnesis:** kepatuhan obat dan kebingungan orientasi (salah
  menjawab hari/tempat) menjadi indikator untuk perawat.
- **Teknis:** penjadwalan di web (`Notification` / alarm via bridge Flutter bila
  perlu berjalan di latar).

### 3.5 Bot Penilaian Bicara (Disartria) — Flutter + Web

- **Kondisi:** stroke, Parkinson; perawat/terapis wicara memantau pemulihan.
- **Alur:** pasien membaca kalimat standar → rekam → STT → hitung skor
  **WER terhadap kalimat acuan**, kecepatan bicara (kata/menit), jeda → simpan
  per sesi → grafik tren di web.
- **Teknis:** pola yang sudah dipakai di `docs/BOT-BPJS-PERBANDINGAN.md`
  (metrik per sesi) dapat dipakai ulang. Pengukuran fitur akustik (jitter,
  shimmer, volume) opsional; tahap awal cukup WER + kecepatan.
- **Batasan:** skor ini indikator pendamping, bukan diagnosis disartria.

### 3.6 Bot Pengenal Ucapan Kustom — Flutter

- **Kondisi:** ucapan pasien gangguan saraf tidak jelas/terbata.
- **Pendekatan realistis:** bukan melatih model sendiri, melainkan
  1) *custom vocabulary / word boost* pada STT untuk kosakata keluhan,
  2) LLM menafsirkan kemungkinan maksud, 3) **konfirmasi** ke pasien
  ("Maksud Anda: nyeri dada?" Ya/Tidak) sebelum disimpan.
- **Catatan:** pelatihan model khusus butuh dataset ucapan disartria; masukkan
  sebagai saran penelitian lanjutan.

### 3.7 Bot Smart Room — Flutter + IoT

- Perintah suara untuk bed elektrik, lampu, AC. Bergantung pada perangkat
  IoT rumah sakit (MQTT/Home Assistant) dan tidak memberi nilai langsung ke
  anamnesis. **Tunda**; cukup dicatat sebagai pengembangan masa depan.

### 3.8 Bot Baca Bibir / Isyarat dan 3.9 AAC Eye-Tracking — Flutter (riset)

- Membutuhkan kamera real-time + model ML on-device (mis. MediaPipe Face
  Mesh/Hands, TFLite). Akurasi lip-reading bahasa Indonesia untuk kosakata
  medis belum teruji dan dataset sulit didapat.
- **Versi sederhana yang layak:** eye-tracking berbasis arah pandang
  (kiri/kanan/atas/bawah) untuk memilih 4 ikon papan komunikasi (§3.1) —
  memakai UI yang sama, hanya input yang berbeda.
- Posisikan sebagai **prototipe riset**, bukan fitur produksi.

## 4. Perubahan pada Bot Hub

Rencana `ITEMS` di `web/public/views/bots.js`:

```js
{ icon: 'bot',  title: 'Bot BPJS',                 available: true  },  // sudah ada
{ icon: 'chat', title: 'Papan Komunikasi',         available: false }, // tahap 1
{ icon: 'bot',  title: 'Anamnesis Terpandu',       available: false }, // tahap 2
{ icon: 'bot',  title: 'Panggil Perawat',          available: false }, // tahap 3
{ icon: 'bot',  title: 'Pengingat & Orientasi',    available: false }, // tahap 4
{ icon: 'bot',  title: 'Penilaian Bicara',         available: false }, // tahap 5
```

Satu file view per bot di `web/public/views/` (mis. `papan-komunikasi.js`),
terdaftar di `router.js`. Bot yang butuh native menambah satu method di
`bridge.js` (`Native.xxx`) dan handler di `web_shell_screen.dart`.
Dependensi Flutter baru yang kemungkinan perlu: `flutter_tts` (TTS native),
`camera` + `google_mlkit_*` (hanya untuk tool riset). `record` sudah ada.

## 5. Model data (usulan, Supabase)

Mengikuti pola tabel BPJS (`bpjs_sessions`, `bpjs_documents`) dengan RLS per
pengguna:

| Tabel | Isi |
|---|---|
| `komunikasi_events` | `id, pasien_ref, jenis (nyeri/haus/…), detail (json: skala, lokasi), created_at` |
| `anamnesis_terpandu` | `id, pasien_ref, jawaban_mentah, hasil_terstruktur (json), status (draf/disetujui), created_at` |
| `panggilan_perawat` | `id, pasien_ref, transkrip, kategori, prioritas, status (baru/ditangani), created_at, handled_at` |
| `penilaian_bicara` | `id, pasien_ref, kalimat_acuan, transkrip, wer, kata_per_menit, created_at` |

`pasien_ref` berupa kode/inisial, **bukan** identitas lengkap, selaras dengan
batasan privasi di PRD.

## 6. Risiko dan batasan

| Risiko | Mitigasi |
|---|---|
| Salah paham STT/LLM pada keluhan darurat | Wajib konfirmasi; kata kunci darurat ("sesak", "nyeri dada") langsung prioritas tinggi tanpa menunggu LLM |
| Dipakai sebagai pengganti alat medis resmi | Tampilkan keterangan: alat bantu, bukan pengganti nurse call/diagnosis |
| Data kesehatan sensitif | Enkripsi (pola `credentials.js`), RLS Supabase, tanpa identitas lengkap, persetujuan pasien |
| Latensi/jaringan (VPN, STT cloud) | Papan komunikasi tetap bisa berfungsi lokal; antrean kirim ulang |
| Akurasi STT pada ucapan disartria rendah | Konfirmasi ya/tidak, word boost, jangan simpan otomatis |
| Cakupan terlalu luas untuk tugas akhir | Fokus tahap 1–3; sisanya saran pengembangan |

## 7. Rencana bertahap

1. **Tahap 1 – Papan Komunikasi** (WebView, ±1 minggu): paling cepat, tanpa
   perubahan native, langsung bisa didemokan.
2. **Tahap 2 – Anamnesis Terpandu** (Flutter + Web): memakai ulang STT, LLM, dan
   ekspor Bot BPJS.
3. **Tahap 3 – Panggil Perawat**: memakai ulang wake word + dashboard realtime.
4. **Tahap 4–5 – Pengingat & Penilaian Bicara**.
5. **Riset lanjutan** – ucapan kustom, baca bibir, eye-tracking, Smart Room.

Setiap tahap diuji dengan skenario simulasi seperti
`docs/PENGUJIAN-SPEECH-REALISTIS.md` dan hasilnya dicatat di `docs/Progres.md`.

## 8. Status implementasi (15 Oktober 2026)

Dua tool inti sudah dibuat dan menggantikan kartu "Bot FAQ" dan "Bot Penerjemah"
di Bot Hub. Pemilihannya dijelaskan di `ANALISIS-PEMILIHAN-SISTEM-SPEECH.md`.

| Tool | Berkas | Catatan |
|---|---|---|
| Papan Komunikasi | `web/public/views/papan-komunikasi.js`, rute `/papan-komunikasi`, tabel `komunikasi_events` di `app/supabase/schema.sql` | WebView murni; suara memakai `speechSynthesis` browser; log lokal bila Supabase gagal |
| Anamnesis Terpandu | `app/lib/screens/anamnesis_terpandu_screen.dart`, bridge `open_anamnesis_terpandu` | Flutter: `flutter_tts` (baru), `record`, AssemblyAI, LLM; sesi disimpan ke tabel BPJS yang sama |

Belum dilakukan: menjalankan `schema.sql` terbaru di Supabase, uji di perangkat
Android nyata (TTS bahasa Indonesia, izin mikrofon), dan evaluasi dengan
skenario simulasi.
