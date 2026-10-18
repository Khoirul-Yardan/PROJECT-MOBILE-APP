# Speech Perawat & Dokter — Mana yang Cocok Masuk Sistem, dan Keselarasan dengan Judul PA

> Pertanyaan yang dijawab dokumen ini: dari sekian banyak kemungkinan ucapan/skenario
> bicara **perawat** dan **dokter**, mana yang cocok dimasukkan ke sistem Bot Hub yang
> sudah ada — dan apakah itu masih selaras dengan **judul resmi Proyek Akhir**. Disusun
> dengan membaca progres kode terbaru (bukan hanya dokumen rencana lama).

---

## 1. Progres yang sudah dibangun (dibaca langsung dari kode, bukan asumsi)

| Tool | Status di kode | Lokasi |
|---|---|---|
| **Bot BPJS** (rekam percakapan perawat-pasien → STT+diarization AssemblyAI → ringkasan LLM → ekspor ke dokter) | Implementasi tersedia, fungsional | `app/lib/screens/bot_bpjs_screen.dart`, `assemblyai_service.dart`, `bpjs_service.dart` |
| **Papan Komunikasi** (Touch-to-Speech, pasien pilih ikon keluhan, TTS browser) | Implementasi tersedia (WebView) | `web/public/views/papan-komunikasi.js`, tabel `komunikasi_events` |
| **Anamnesis Terpandu** (asisten suara membacakan pertanyaan, pasien jawab via suara, LLM mengisi form) | Implementasi tersedia (Flutter) | `app/lib/screens/anamnesis_terpandu_screen.dart` |
| **Dokumentasi/Riwayat gabungan** (Bot BPJS + Anamnesis + Papan Komunikasi dalam satu pencarian) | Implementasi tersedia | `web/public/views/bpjs-review.js` |

Commit terkait (`a84fcec` dan beberapa commit "update" sebelumnya) mengonfirmasi dua tool
baru ini sudah menggantikan kartu placeholder "Bot FAQ"/"Bot Penerjemah" di Bot Hub, sesuai
rencana di `kemungkinan tools yang dapat dikembangkan.md` §8.

**Poin penting dari membaca kode `anamnesis_terpandu_screen.dart` baris 292 & 313:**
Peran yang direkam sistem selalu **`perawat`** (pertanyaan terstandar/asisten) dan
**`pasien`** (jawaban). Nama dokter (`_doctorCtrl`) hanya **teks tujuan pengiriman**
(seperti kolom "kepada" pada surat rujukan) — **dokter tidak pernah berbicara ke sistem**
di alur manapun yang sudah dibangun.

---

## 2. Cek keselarasan dengan judul PA resmi — temuan penting

Judul resmi (dari `PRD-Dokumentasi-Percakapan-Perawat-Pasien.md`):

> *"...Otomatisasi Dokumentasi **Percakapan Perawat-Pasien** sebagai Pendukung Verifikasi
> Diagnosis Pasien Menggunakan Speech-to-Text dan Large Language Model"*

Dan dari PRD §5.2 (Out-of-Scope):

> *"Sistem tidak menggantikan tanggung jawab klinis dokter — dokter tetap melakukan
> verifikasi akhir"*

**Implikasi langsung:** judul PA kamu secara eksplisit membatasi objek yang direkam jadi
**percakapan perawat-pasien** — bukan "perawat-dokter" atau "dokter-pasien". Peran dokter
dalam desain resmi adalah **penerima & peninjau dokumentasi** (verifikasi), bukan sumber
ucapan yang direkam sistem. Ini **konsisten dengan apa yang sudah dibangun**: dokter cuma
menerima PDF/DOCX/teks untuk ditinjau, tidak pernah bicara ke mic aplikasi.

**Jadi untuk pertanyaan "speech dokter mana yang cocok dimasukkan ke sistem" — jawaban
jujurnya:**

| Opsi | Selaras judul? | Alasan |
|---|---|---|
| **Dokter bicara/didiktekan ke sistem (voice dictation dokter untuk catatan verifikasi)** | ❌ **Tidak selaras** | Judul spesifik "Perawat-Pasien"; menambah rekaman suara dokter mengubah objek penelitian jadi tiga pihak, butuh revisi judul resmi ke pembimbing dulu — bukan keputusan teknis semata |
| **Dokter membalas secara suara ke perawat (misal rekam catatan revisi lisan)** | ❌ **Tidak selaras** (tanpa revisi judul) | Sama alasan di atas — PRD §5.2 menegaskan dokter hanya "melakukan verifikasi akhir" (tindakan, bukan ucapan terekam sistem) |
| **Dokter menggunakan Text-to-Speech untuk *mendengarkan* draf (bukan bicara, cuma didengarkan)** | ✅ **Selaras** | Ini bukan merekam ucapan dokter — cuma aksesibilitas membaca draf. Tidak mengubah objek penelitian; dokter tetap "membaca/menyimak" sebelum verifikasi tertulis |
| **Perawat merekam dikte verifikasi dokter SECARA LISAN LEWAT TELEPON lalu dimasukkan sistem** (dokter tidak pegang app) | 🟡 **Abu-abu — sebaiknya dihindari** | Secara teknis dokter tetap "sumber ucapan" meski tidak langsung pegang app; lebih aman diposisikan sebagai catatan tertulis perawat, bukan transkrip suara dokter |

**Rekomendasi tegas:** jangan tambahkan alur dimana **ucapan dokter direkam dan
ditranskripsi oleh sistem** — itu akan membuat laporan PA menyimpang dari judul resmi yang
sudah disetujui pembimbing (17 September 2026), dan bisa dipertanyakan saat sidang
("judul bilang perawat-pasien, kenapa ada modul suara dokter?"). Kalau kamu memang ingin
mengeksplorasi sisi dokter, **ajukan dulu ke dosen pembimbing sebagai usulan revisi/
perluasan judul** sebelum dikerjakan — ini keputusan akademik, bukan teknis.

---

## 3. Speech perawat — mana yang cocok masuk sistem (tetap dalam scope "Perawat-Pasien")

Karena dokter di luar scope rekaman suara, fokus realistis ada di memperluas **sisi
perawat**. Berikut taksonomi skenario ucapan perawat yang relevan dengan anamnesis dan
*cocok* ditambahkan — dicek kesesuaiannya dengan tool yang sudah ada:

| # | Skenario ucapan perawat | Cocok masuk tool mana | Alasan cocok/tidak |
|---|---|---|---|
| S1 | Perawat membuka sesi, menyapa, bertanya keluhan (sudah ada) | Bot BPJS | ✅ Sudah diimplementasikan |
| S2 | Perawat membaca ulang/konfirmasi jawaban pasien ("jadi nyeri 3 hari ya?") | Bot BPJS | ✅ Cocok — tapi ini justru kasus **P4** di `PENGUJIAN-SPEECH-REALISTIS.md` §3a yang rawan salah label oleh `relabelSpeakers()`. **Perbaiki prompt itu dulu** sebelum menambah skenario baru |
| S3 | Perawat membacakan pertanyaan terstruktur (anamnesis terpandu) | Anamnesis Terpandu | ✅ Sudah diimplementasikan — tapi suara perawat di sini sebenarnya **TTS asisten**, bukan suara perawat asli (lihat §4) |
| S4 | Perawat mendikte ringkasan/catatan tambahan setelah sesi selesai (bukan ke pasien, tapi dikte sendiri untuk catatan) | **Belum ada tool** — kandidat baru | 🟡 Cocok secara konsep (masih "perawat" sebagai sumber, bukan dokter), tapi ini **dikte satu-arah**, beda dari "percakapan" — perlu dicek apakah masih pas dengan kata "percakapan" di judul, atau diposisikan sebagai pelengkap draf (anotasi), bukan objek penelitian utama |
| S5 | Perawat menjawab pertanyaan balik pasien di tengah sesi ("ini bahaya nggak, Sus?" → perawat jawab) | Bot BPJS | ✅ Cocok, bagian dari percakapan asli — tapi ini kasus **Q2** yang juga rawan di diarization. Prioritas perbaikan sama dengan S2 |
| S6 | Perawat memanggil ulang kata kunci darurat yang terdengar dari pasien (mis. "nyeri dada" → perawat ulang untuk konfirmasi lisan) | Bot BPJS / Papan Komunikasi (kata kunci darurat) | ✅ Cocok — ini sudah disinggung sebagai mitigasi risiko di `ANALISIS-PEMILIHAN-SISTEM-SPEECH.md` §7 ("kata kunci darurat tanpa menunggu LLM") tapi **belum diimplementasikan** sebagai fitur nyata di kode |

**Kandidat paling layak dikerjakan lanjut (urutan prioritas):**
1. **S2 + S5** → perbaikan prompt `relabelSpeakers()` di `bpjs_service.dart` — ini **bukan
   fitur baru**, melainkan memperbaiki yang sudah ada supaya menangani pola bicara perawat
   yang sudah teridentifikasi (sudah dibahas di dokumen `PENGUJIAN-SPEECH-REALISTIS.md`).
   Effort kecil, dampak langsung ke akurasi evaluasi PA.
2. **S6** → deteksi kata kunci darurat sederhana (regex/daftar kata: "nyeri dada", "sesak",
   "tidak sadar") yang memicu prioritas tinggi di UI tanpa menunggu LLM — selaras dengan
   mitigasi risiko yang **sudah direncanakan** tapi belum dibangun.
3. **S4** → didiskusikan dulu dengan dosen apakah "catatan dikte perawat pasca-sesi" masih
   dianggap bagian dari "dokumentasi percakapan perawat-pasien" atau sudah keluar scope
   (karena bukan percakapan dua arah, hanya ucapan satu arah perawat). Ini **pertanyaan
   akademik**, bukan hal yang perlu diputuskan sendiri secara teknis.

---

## 4. Catatan teknis: "suara perawat" di Anamnesis Terpandu itu TTS, bukan rekaman perawat

Satu hal yang perlu diluruskan supaya tidak salah paham waktu menulis bab metodologi:
pada `AnamnesisTerpandu`, baris `segments.add({'speaker': 'perawat', 'text':
_questions[i].text, ...})` — ini **teks pertanyaan yang sudah ditulis sebelumnya** dan
dibacakan lewat **TTS** (`flutter_tts`), **bukan rekaman suara perawat sungguhan**.
Jadi "peran perawat" di tool ini adalah **representasi/simulasi** dari pertanyaan standar
perawat, bukan ucapan perawat yang direkam. Ini sendiri **masih selaras dengan judul**
(tetap tentang perawat-pasien, tetap STT untuk sisi pasien, tetap LLM untuk mengisi form) —
tapi **perlu dijelaskan secara jujur di laporan PA** bahwa "perawat" di tool ini bersifat
terstandar/otomatis, bukan interaksi langsung perawat-pasien real-time seperti Bot BPJS.
Dua tool punya karakter metodologis yang agak berbeda meski sama-sama dalam scope judul.

---

## 5. Ringkasan rekomendasi

1. **Jangan tambahkan rekaman ucapan dokter** ke sistem — di luar judul resmi tanpa
   persetujuan revisi dari pembimbing. Peran dokter tetap: menerima & memverifikasi teks.
2. **Speech perawat yang paling layak dikerjakan lanjut** bukan tool baru, tapi **perbaikan
   diarization/relabel** pada tool yang sudah ada (S2, S5) — langsung menjawab permintaan
   dosen soal pengujian speech realistis dari percakapan sebelumnya.
3. **Kata kunci darurat (S6)** adalah fitur kecil yang sudah direncanakan di dokumen lama
   tapi belum dibangun — kandidat tambahan yang murah dan bernilai untuk keselamatan.
4. **S4 (dikte satu arah perawat)** perlu ditanyakan ke dosen dulu — abu-abu terhadap kata
   "percakapan" di judul.
5. Jelaskan di laporan PA bahwa "perawat" pada Anamnesis Terpandu adalah pertanyaan
   terstandar lewat TTS, bukan rekaman perawat langsung — supaya metodologi dua tool
   (Bot BPJS vs Anamnesis Terpandu) tidak disalahpahami sebagai identik.

---

## 6. Referensi internal

- `PRD/PRD-Dokumentasi-Percakapan-Perawat-Pasien.md` — judul resmi & batas scope (§5.2)
- `docs/PENGUJIAN-SPEECH-REALISTIS.md` §3a/§3b — taksonomi pola bicara & perbaikan prompt yang direkomendasikan
- `docs/kemungkinan tools yang dapat dikembangkan.md`, `docs/ANALISIS-PEMILIHAN-SISTEM-SPEECH.md` — rencana & penilaian tool
- `app/lib/screens/anamnesis_terpandu_screen.dart`, `app/lib/services/bpjs_service.dart` — kode sumber yang dirujuk langsung
