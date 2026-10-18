# Pengujian Speech Realistis — Bukan Hanya Audio Jelas (Audible)

> **Status dokumentasi — 19 Oktober 2026:** Dokumen ini adalah rencana/protokol evaluasi. Progres 2 menyediakan bukti tampilan dan catatan operasional, belum tabel pengukuran speech baru. WER harus memakai acuan manual; pisahkan STT murni dari relabel/koreksi LLM, serta jangan campurkan pertanyaan TTS Anamnesis dengan rekaman perawat. Pipeline tidak diubah pada tugas dokumentasi ini.

> **Pemicu dokumen:** arahan dosen pembimbing — pengujian Bot BPJS (STT + diarization +
> LLM) **tidak boleh hanya memakai rekaman yang jelas/bersih (audible)**, tetapi harus
> mencakup jenis ucapan yang **umum terjadi sungguhan dalam percakapan perawat-pasien**
> di rumah sakit. Dokumen ini: (1) memetakan kondisi pengujian saat ini, (2) menjelaskan
> kenapa itu belum cukup, (3) menyusun taksonomi kondisi speech realistis yang perlu
> diuji, (4) mengecek sistem/tool tambahan apa yang mungkin dibutuhkan proyek, dan
> (5) memberi rencana bertahap yang bisa disesuaikan dengan sisa waktu Proyek Akhir.
>
> Status: **usulan untuk didiskusikan dengan dosen**, bukan keputusan final. Semua
> estimasi effort bersifat indikatif.

---

## 1. Kondisi pengujian saat ini (berdasarkan dokumen proyek)

| Sumber | Apa yang sudah diuji |
|---|---|
| `docs/ujitest dan dokumentasi.md` §4 | Storyboard **simulasi dengan data fiktif** (foto + video), bukan rekaman audio asli — dibuat agar alur jelas, bukan untuk uji akurasi STT |
| `docs/BOT-BPJS-PERBANDINGAN.md` | Metodologi perbandingan STT vs ringkasan LLM sudah ada (WER, rasio ringkas, dll.), tapi baru **kerangka metrik** — belum ada data dari sesi nyata dalam jumlah memadai (dokumen itu sendiri menyarankan ≥10 sesi) |
| `docs/ASSEMBLYAI-DIARIZATION.md` | Mencatat masalah nyata yang sudah ditemui: **1 mikrofon → AssemblyAI kadang hanya mendeteksi 1 suara**, semua kalimat dilabeli ke pembicara pertama — sudah ada mitigasi (`speakers_expected: 2`, relabel LLM, tombol tukar peran) |
| `docs/ujitest dan dokumentasi.md` §6 | Mengakui: *"Belum diukur akurasi (WER, kelengkapan ringkasan) — fungsi ada, data evaluasi belum"* dan *"Diarization bergantung pada AssemblyAI; bila hanya 1 suara terdeteksi, peran ditebak LLM — perlu diuji ≥10 sesi nyata"* |

**Kesimpulan jujur:** sejauh ini pengujian berfokus pada **apakah alur aplikasi berjalan**
(rekam → STT → ringkasan → review dokter), bukan pada **seberapa akurat STT/diarization/LLM
saat kondisi audio tidak ideal**. Permintaan dosen tepat menyasar celah ini.

---

## 2. Kenapa "speech yang audible" saja tidak cukup

Clean/scripted speech (seperti storyboard simulasi) secara sistematis melebih-lebihkan akurasi
ASR dibanding kondisi lapangan. Beberapa temuan riset yang relevan untuk dijadikan justifikasi
akademik (silakan verifikasi ulang & kutip langsung di BAB II/metodologi, bukan hanya dari
ringkasan ini):

- ASR modern tetap terdegradasi signifikan pada audio bising, dan speech-enhancement/denoising
  **tidak selalu membantu** bahkan bisa menurunkan akurasi model ASR besar yang sudah dilatih
  pada data bising — *"When De-noising Hurts: A Systematic Study of Speech..."*
  ([arxiv.org/html/2512.17562v1](https://arxiv.org/html/2512.17562v1)).
- Studi multilingual terhadap 8 model ASR modern (termasuk varian Whisper) menunjukkan
  penurunan performa yang terukur pada kondisi adversarial/noise sintetis —
  *"Speech recognition in adverse conditions: synthetic..."*
  ([link.springer.com/article/10.1186/s13636-026-00458-1](https://link.springer.com/article/10.1186/s13636-026-00458-1)).
- Evaluasi ASR komersial pada 40 rekaman simulasi medis (EMS) nyata menunjukkan hasil
  bervariasi per engine untuk transkripsi informasi medis —
  *"Assessing the Effectiveness of Automatic Speech Recognition..."*
  ([link.springer.com/article/10.1007/s41666-025-00193-w](https://link.springer.com/article/10.1007/s41666-025-00193-w)).
- WER saja tidak cukup untuk domain klinis — perlu metrik tambahan seperti **entity/istilah
  medis recall** karena kesalahan pada kata biasa vs istilah klinis punya bobot risiko
  berbeda — *"How to evaluate medical speech-to-text (ASR): WER, CER, and..."*
  ([corti.ai/guides/how-to-evaluate-automatic-speech-recognition](https://www.corti.ai/guides/how-to-evaluate-automatic-speech-recognition)).
- Disfluency (jeda, pengulangan, kata pengisi) umum pada speech spontan/percakapan dan ASR
  standar cenderung gagal menanganinya dengan baik —
  *"Beyond WER: Entity and Disfluency Recall in Accented..."*
  ([arxiv.org/html/2609.20828](https://arxiv.org/html/2609.20828)).

**Implikasi untuk Bot BPJS:** percakapan perawat-pasien sungguhan nyaris selalu mengandung
noise ruangan, jarak mic yang berubah-ubah, logat daerah, istilah medis campur Bahasa
Indonesia-daerah, serta disfluency (pasien menahan sakit, bicara terputus, batuk di tengah
kalimat). Mengandalkan audio bersih saja akan membuat angka WER/akurasi di laporan PA
**tidak merepresentasikan performa nyata di RS Ahmad Yani**, dan dosen berhak meminta ini
diperbaiki sebelum diklaim sebagai hasil evaluasi.

---

## 3. Taksonomi kondisi speech yang perlu diuji

Disusun sebagai kategori skenario rekaman tambahan — tiap kategori idealnya punya
**≥3-5 sesi** (ideal ≥10 sesuai saran `BOT-BPJS-PERBANDINGAN.md`) agar hasil tidak
kebetulan.

| # | Kategori | Contoh kondisi nyata di RS | Yang diuji pada sistem |
|---|---|---|---|
| K1 | **Noise lingkungan** | Ruang rawat ramai, AC, alat medis berbunyi, pengumuman speaker RS, pintu/kursi bergeser | Apakah STT tetap akurat; apakah diarization tetap memisahkan 2 suara dengan benar |
| K2 | **Jarak & volume mic berubah-ubah** | HP diletakkan di meja (bukan dipegang), pasien bicara pelan/lemas, perawat menjauh saat mencatat | Akurasi STT pada volume rendah; apakah sesi gagal total atau degradasi bertahap |
| K3 | **Logat & variasi bahasa** | Logat Jawa/Madura/Surabaya pada Bahasa Indonesia, kode-switch (selingan bahasa daerah), istilah lokal keluhan | WER per logat; apakah `language_code: 'id'` AssemblyAI cukup atau perlu penyesuaian |
| K4 | **Tumpang tindih bicara (overlapping)** | Perawat memotong, pasien menjawab sebelum pertanyaan selesai, keluarga pasien ikut bicara | Diarization: apakah tetap 2 peran (perawat/pasien) terpisah benar, atau rusak jadi 1 suara/role tertukar |
| K5 | **Disfluency & ucapan terputus** | "eee...", mengulang kata, kalimat terhenti karena batuk/sesak/menahan nyeri, jeda panjang | Apakah transkrip tetap bisa diringkas LLM tanpa informasi penting hilang |
| K6 | **Istilah medis & singkatan** | Nama obat, keluhan klinis ("mual", "nyeri ulu hati", "riwayat hipertensi"), singkatan umum RS | Entity/istilah recall — bukan hanya WER kata biasa |
| K7 | **Profil suara khusus** | Lansia (suara bergetar/pelan), anak-anak, pasien dengan gangguan artikulasi, pasien berbicara sambil menangis/menahan sakit | Apakah sistem tetap menghasilkan draf dokumentasi yang bisa diverifikasi dokter, bukan kosong/ngawur |
| K8 | **Durasi ekstrem** | Sesi sangat pendek (<30 kata — sudah tercatat jadi isu "rasio ringkas" di `ujitest dan dokumentasi.md` §6.3) dan sesi panjang (>5 menit) | Stabilitas metrik & waktu proses pada dua ujung durasi |
| K9 | **1 mikrofon / 1 suara terdeteksi** | Kasus yang sudah diketahui (`ASSEMBLYAI-DIARIZATION.md`) — perlu lebih banyak sampel, bukan cuma 1 fix yang diverifikasi sekali | Efektivitas `speakers_expected: 2` + relabel LLM pada variasi kasus baru, bukan kasus lama yang sudah diperbaiki |
| K10 | **Interferensi perangkat** | Notifikasi HP berbunyi di tengah rekaman, panggilan masuk, baterai low saat merekam | Apakah aplikasi menangani gangguan tanpa kehilangan sesi (lebih ke robustness aplikasi, bukan cuma STT) |

K1-K9 murni tentang **kualitas STT/diarization/LLM**; K10 tentang **ketahanan aplikasi**
— keduanya relevan untuk bab evaluasi, tapi metodenya beda (K10 diuji manual/fungsional,
bukan metrik WER).

---

## 3a. Dipisah per peran — pola bicara perawat vs pasien tidak sama

Permintaan lanjutan: *"banyak speech untuk pasien dan perawat"* — betul, K1-K10 di atas
masih digabung lintas peran, padahal secara karakteristik **perawat dan pasien tidak bicara
dengan pola yang sama**, dan ini penting karena mekanisme relabel di kode (lihat
`bpjs_service.dart` fungsi `relabelSpeakers`) **menebak peran dari pola bicara**, bukan
dari suara — jadi taksonomi harus eksplisit per peran supaya teruji tepat sasaran bagian
mana yang rawan gagal.

Cuplikan prompt relabel yang sudah ada di kode (dasar asumsi heuristik sistem):
> *"...perawat biasanya bertanya, menjelaskan prosedur, atau mengarahkan; pasien menjawab
> dan menceritakan keluhan..."*

Heuristik ini **valid untuk kasus umum**, tapi ada banyak pola bicara nyata yang
melanggar asumsi itu — berikut dipecah per peran:

### Pola bicara khas Perawat (nurse-side)

| # | Pola bicara | Contoh ucapan nyata | Risiko pada sistem |
|---|---|---|---|
| P1 | Bertanya terbuka (sesuai asumsi heuristik) | "Keluhannya apa, Bu?" | Aman — sesuai asumsi `relabelSpeakers` |
| P2 | Mengarahkan/instruksi prosedural | "Tarik napas dulu ya, saya ukur tensinya" | Aman — masih "mengarahkan" |
| P3 | **Menjelaskan/menjawab balik** (bukan bertanya) | Pasien tanya "ini kenapa ya sus?", perawat **menjawab** menjelaskan kondisi | **Rawan tertukar** — heuristik mengasumsikan menjawab = pasien |
| P4 | Membacakan ulang/konfirmasi jawaban pasien | "Jadi nyeri sejak 3 hari ya, Bu, sebelah kanan?" | Berpotensi diberi label pasien karena kalimat deklaratif pendek mirip jawaban |
| P5 | Istilah medis teknis diucapkan cepat | "Nanti kita cek darah lengkap sama urinalisis" | Risiko STT: istilah tidak dikenali kosakata umum Bahasa Indonesia |
| P6 | Bicara ke rekan kerja di tengah sesi (bukan ke pasien) | Perawat menjawab panggilan rekan sejawat sebentar | Transkrip tercampur ke dalam sesi — tidak relevan tapi ikut diringkas LLM |
| P7 | Volume rendah saat mencatat sambil bicara | Menjauh dari pasien, bicara ke diri sendiri/mencatat | Segment pendek/terpotong, bisa salah atribusi |

### Pola bicara khas Pasien (patient-side)

| # | Pola bicara | Contoh ucapan nyata | Risiko pada sistem |
|---|---|---|---|
| Q1 | Menjawab + cerita keluhan (sesuai asumsi heuristik) | "Perut saya sakit dari kemarin malam" | Aman |
| Q2 | **Balik bertanya ke perawat** | "Ini bahaya nggak, Sus?" / "Kenapa ya ini?" | **Rawan tertukar** — heuristik mengasumsikan bertanya = perawat |
| Q3 | Jawaban sangat singkat / ya-tidak | "Iya", "Nggak ada", "Lumayan" | STT mungkin benar tapi diarization/relabel sulit tentukan peran dari kalimat sependek itu |
| Q4 | Bicara sambil menahan sakit/menangis/terbata | Suara tercekat, jeda panjang di tengah kalimat | STT kehilangan kata di antara jeda; faktual konten hilang |
| Q5 | Pasien lansia — suara pelan/bergetar, bicara lambat | Deskripsi keluhan panjang tapi tidak jelas | Akurasi kata kunci klinis turun (lihat K6/K7) |
| Q6 | Pasien anak-anak atau didampingi orang tua yang menjawab | Orang tua menjawab mewakili anak | **Peran ke-3** muncul (bukan cuma 2 suara) — di luar asumsi `speakers_expected: 2` |
| Q7 | Istilah awam/non-medis untuk gejala yang sama | "Mules", "senut-senut", "anget-anget dingin" | LLM harus memetakan istilah awam ke makna klinis saat menyusun `keluhan_utama` — bukan cuma soal STT |
| Q8 | Pasien bicara dalam bahasa daerah murni (bukan campuran) | Pasien lansia yang tidak lancar Bahasa Indonesia | `language_code: 'id'` yang di-hardcode berisiko gagal total, bukan cuma turun akurasi |

### Kenapa pemisahan per peran ini penting secara teknis

Dari membaca kode (`assemblyai_service.dart` + `bpjs_service.dart`) ada tiga titik yang
**bergantung pada asumsi arah peran**, bukan cuma kualitas audio mentah:

1. `mapSpeakers()` menandai suara **pertama yang bicara** sebagai 'perawat' secara default
   (heuristik urutan, bukan isi kalimat) — valid selama perawat memang memulai sesi sesuai
   PRD §5.1, tapi **P6/P7 di atas bisa merusak asumsi ini** kalau ucapan non-sesi (ke rekan
   kerja) terekam duluan.
2. `relabelSpeakers()` (dipakai saat AssemblyAI cuma deteksi 1 suara) menebak peran dari
   **isi kalimat** (bertanya vs menjawab) — ini yang paling rawan kena kasus **P3, P4, Q2,
   Q3** di atas karena asumsi "bertanya = perawat, menjawab = pasien" tidak selalu benar.
3. `language_code` di-hardcode `'id'` tanpa fallback — kasus **Q8** (bahasa daerah murni)
   berisiko gagal total, bukan cuma akurasi turun, karena AssemblyAI tidak diberi sinyal
   bahasa lain untuk dicoba.

---

## 3b. Apakah kemungkinan-kemungkinan ini bisa dimasukkan ke sistem?

Jawaban per titik: **sebagian besar bisa, sebagai perbaikan bertahap** — tidak perlu
rombak arsitektur, karena masalahnya ada di heuristik dan parameter, bukan di pipeline
dasarnya (STT → diarization → LLM tetap sama).

| Pola/risiko | Bisa dimasukkan ke sistem? | Bagaimana (indikatif) | Effort |
|---|---|---|---|
| **P3/P4/Q2/Q3** (heuristik "bertanya=perawat" gagal) | **Ya** — perbaikan prompt, bukan arsitektur | Perkaya `systemPrompt` di `relabelSpeakers()`: beri contoh negatif eksplisit (perawat juga bisa menjawab, pasien juga bisa bertanya), tambahkan sedikit konteks urutan kalimat (kalimat sebelumnya siapa) supaya LLM punya lebih dari sekadar pola tanya/jawab | Kecil (ubah 1 prompt + uji ulang relabel pada sampel P3/P4/Q2/Q3) |
| **P6/P7** (ucapan di luar sesi ikut terekam) | **Ya, parsial** — tidak bisa dideteksi otomatis 100%, tapi bisa dikurangi | Tambahkan panduan prosedur ke perawat (SOP singkat: "jangan bicara ke rekan kerja saat sesi aktif") + opsi UI "potong/hapus segmen" sebelum submit ke LLM (perawat tinjau transkrip dulu — fitur FR-09-mirip sudah ada konsepnya di review) | Sedang (butuh UI edit transkrip pra-ringkas, belum ada sekarang) |
| **Q6** (3 suara: perawat+pasien+pendamping) | **Terbatas** — `speakers_expected: 2` jadi asumsi yang dilanggar | Opsi: ubah `speakers_expected` jadi dinamis (mis. ada toggle "ada pendamping?" sebelum rekam → kirim `speakers_expected: 3`), lalu `mapSpeakers()` perlu peta 3 label bukan 2 (`perawat`/`pasien`/`pendamping`) — **perubahan struktur data kecil** (`DiarizedSegment.speaker` jadi bisa 3 nilai, bukan cuma 2) | Sedang (ubah model data + UI pilihan + prompt LLM ringkasan agar tahu membedakan ucapan pendamping vs pasien) |
| **Q7** (istilah awam vs klinis) | **Ya** — ini memang ranah LLM, bukan STT | Tambahkan ke `systemPrompt` pada `generateDocumentation()`: instruksi eksplisit memetakan istilah awam umum (mual/mules/senut-senut, dst.) ke istilah klinis standar saat mengisi `keluhan_utama` — bisa dibantu glosarium (opsi C di §5 dokumen ini) sebagai referensi dalam prompt | Kecil (tambah instruksi prompt + glosarium acuan) |
| **Q8** (bahasa daerah murni) | **Terbatas** — tergantung dukungan AssemblyAI | Cek dukungan `language_code` AssemblyAI untuk bahasa daerah (Jawa/Madura kemungkinan **tidak didukung** sebagai model khusus — perlu dicek langsung di dokumentasi AssemblyAI terbaru); kalau tidak didukung, realistisnya **di luar scope PA** (karena PRD §5.2 sudah membatasi: tanpa fine-tuning khusus dataset, pakai Whisper/AssemblyAI apa adanya) — cukup didokumentasikan sebagai **batasan sistem yang diketahui**, bukan dipaksakan dibangun | Besar kalau dipaksakan (butuh model ASR khusus bahasa daerah) → **direkomendasikan: dokumentasikan sebagai batasan**, bukan dikerjakan |
| **P5/K6** (istilah medis cepat) | **Ya** — pendekatan non-ASR-retraining | AssemblyAI mendukung **word boost/custom vocabulary** di beberapa paket — cek apakah tier yang dipakai proyek mendukung parameter itu; kalau ya, isi dengan daftar istilah medis dari glosarium (§5 opsi C) supaya STT condong mengenali istilah itu. Kalau tidak didukung di tier gratis, cukup ukur dampaknya lewat entity recall (§4), tanpa mengubah kode | Kecil (kalau fitur tersedia di API) – Sedang (kalau perlu ganti tier berbayar) |
| **K9/general 1-mic** | Sudah ada mitigasi, **perlu diperkuat** bukan dibangun ulang | Tambahkan sampel uji lebih banyak untuk kasus P3/P4/Q2/Q3 spesifik dalam kondisi 1-suara (kombinasi K9 + pola heuristik di atas adalah kasus **paling rawan ganda**) | Kecil — perluasan data uji, bukan kode baru |

**Kesimpulan jujur:** mayoritas yang diminta **bisa masuk sistem** tanpa mengubah arsitektur
besar — perbaikan ada di level **prompt LLM**, **parameter AssemblyAI**, dan **sedikit UI
pra-submit** (edit transkrip). Yang **tidak realistis** untuk sisa waktu PA adalah dukungan
bahasa daerah murni (Q8) — itu didokumentasikan sebagai batasan sistem (konsisten dengan
PRD §5.2: prototipe, bukan model ASR custom-trained).

---

## 4. Metrik evaluasi yang perlu ditambahkan

`BOT-BPJS-PERBANDINGAN.md` sudah punya kerangka (WER, rasio ringkas, `relabel_llm`, dll.).
Untuk menjawab permintaan dosen, tambahkan:

| Metrik baru | Mengukur | Cara hitung (indikatif) |
|---|---|---|
| **WER per kategori** (bukan WER keseluruhan) | Apakah performa berbeda signifikan antar K1-K9 | Hitung WER terpisah per kategori skenario, bandingkan dengan baseline audio bersih |
| **Entity/istilah medis recall** | Seberapa sering istilah klinis penting (keluhan, obat, riwayat) hilang/salah transkrip meski WER kata umum rendah | Buat daftar istilah kunci per skenario sebelum rekam (ground truth), cek kemunculannya di transkrip hasil |
| **Tingkat kegagalan diarization** | Berapa persen sesi yang jatuh ke 1-suara-terdeteksi (butuh relabel LLM) per kategori | Pakai field `pembicara_terdeteksi` & `relabel_llm` yang sudah ada di `bpjs_documents.perbandingan` |
| **Factual consistency pada kondisi sulit** | Apakah LLM mulai "mengarang" saat transkrip rusak/tidak lengkap (risiko halusinasi naik saat input jelek) | Review manual oleh perawat/dokter per sesi kategori sulit, bandingkan dengan sesi bersih |

---

## 5. Sistem/tooling tambahan yang mungkin dibutuhkan

Mengecek terhadap stack yang sudah ada (`AssemblyAI` untuk STT+diarization lewat relay,
LLM OpenAI-compatible untuk ringkasan, Flutter untuk rekam audio) — berikut opsi, **bukan
semuanya wajib**, dipilih sesuai waktu PA yang tersisa:

| Opsi | Fungsi | Perlu sistem baru? | Effort kasar |
|---|---|---|---|
| **A. Rekam ulang skenario asli** (simulasi lebih realistis: noise latar beneran, logat asli, 2 orang bicara tumpang tindih) | Dataset uji K1-K9 yang representatif | Tidak — cukup disiplin protokol rekam + consent, pakai app yang sudah ada | Kecil secara teknis, **butuh waktu lapangan** (koordinasi relawan/simulasi di RS atau kampus) |
| **B. Audio augmentation** (tambah noise/reverb/volume rendah secara sintetis ke rekaman bersih yang sudah ada, mis. pakai library `audiomentations`/`torchaudio` di Python) | Memperbanyak variasi K1/K2/K8 tanpa harus rekam ulang semua dari nol | Ya — script offline kecil, tidak masuk ke app produksi, cuma untuk menyiapkan file uji | Kecil (1-2 hari setup script) — **tapi kurang otentik** dibanding rekaman asli; cocok sebagai pelengkap, bukan pengganti opsi A |
| **C. Daftar istilah medis acuan (ground truth glossary)** | Dasar hitung entity/istilah recall (§4) | Tidak — cukup spreadsheet/Markdown per skenario sebelum rekam | Kecil (disusun bareng narasumber medis/dosen) |
| **D. Script perhitungan WER per kategori otomatis** | Supaya metrik §4 tidak dihitung manual tiap kali | Ya — script kecil (Python, pakai library `jiwer` untuk WER) yang baca ground truth + hasil transkrip dari `bpjs_documents` | Kecil-sedang (2-3 hari), bisa dipakai lintas sesi berikutnya juga |
| **E. Uji sensitivitas parameter AssemblyAI** (`speakers_expected`, `language_code`, format audio) pada tiap kategori | Tahu parameter mana yang paling berpengaruh pada K3/K4/K9 | Tidak — ubah parameter request yang sudah ada di `assemblyai_service.dart`, uji A/B manual | Kecil, murni eksperimen konfigurasi |
| **F. Logging kondisi rekaman per sesi** (tag kategori K1-K10 di metadata sesi) | Supaya metrik §4 bisa difilter per kategori di query SQL, bukan dihitung manual terpisah-pisah | Ya — tambah kolom kecil (mis. `kategori_uji`) ke tabel `bpjs_sessions`/`bpjs_documents`, isi manual saat uji | Kecil (perubahan schema minor) |

**Rekomendasi prioritas (realistis untuk sisa waktu PA):**
1. **C** (glosarium istilah) — murah, langsung dasar metrik baru.
2. **A** (rekam ulang skenario realistis, minimal K1, K3, K4, K9 dulu karena paling umum
   terjadi di RS Ahmad Yani) — paling otentik untuk laporan, prioritaskan.
3. **F** (tag kategori di DB) — supaya data A bisa ditarik rapi untuk tabel evaluasi.
4. **D** (script WER per kategori) — begitu data A+C+F ada, baru otomatiskan penghitungan.
5. **B** (augmentasi sintetis) dan **E** (eksperimen parameter) — pelengkap kalau waktu
   masih ada, untuk memperkaya diskusi bab evaluasi (mis. *"apakah noise sintetis
   seburuk noise asli?"*).

Tidak satu pun opsi di atas memaksa mengubah arsitektur inti (Flutter + relay + AssemblyAI
+ LLM) — semuanya tambahan di lapisan pengujian/evaluasi, sesuai batas skrip PRD §5.2
(prototipe, bukan integrasi penuh ke sistem RS).

---

## 6. Rencana uji bertahap (disesuaikan)

| Tahap | Kegiatan | Keluaran |
|---|---|---|
| 1 | Susun glosarium istilah medis per skenario (opsi C) bersama dosen/narasumber medis | Daftar istilah acuan per kategori |
| 2 | Rekam skenario realistis prioritas: **K1 (noise ruangan)**, **K3 (logat)**, **K4 (overlapping)**, **K9 (1 mic/1 suara)** — minimal 3-5 sesi per kategori | Set audio uji + ground truth transkrip manual |
| 3 | Tambah tag kategori ke metadata sesi (opsi F) sebelum/selama rekam tahap 2 | Data bisa difilter per kategori |
| 4 | Jalankan sesi lewat Bot BPJS seperti biasa, catat hasil STT+diarization+ringkasan | Hasil mentah per sesi (sudah otomatis tersimpan di `bpjs_documents.perbandingan`) |
| 5 | Hitung metrik §4 (WER per kategori, entity recall, tingkat kegagalan diarization) | Tabel metrik per kategori untuk bab evaluasi PA |
| 6 | (Opsional, jika waktu cukup) Tambah skenario K2, K5, K6, K7, K8, K10 dan ulangi tahap 2-5 | Cakupan evaluasi lebih lengkap |
| 7 | Diskusikan hasil dengan dosen — tentukan apakah perlu mitigasi tambahan di kode (mis. pre-processing noise) sebelum sidang | Keputusan scope akhir evaluasi |

---

## 7. Etika & batasan yang tetap berlaku

Sama seperti dicatat di `docs/ujitest dan dokumentasi.md` §6: **belum ada consent pasien**
untuk audio yang dikirim ke pihak ketiga (AssemblyAI, LLM). Untuk pengujian K1-K10 di atas:

- Gunakan **simulasi dengan relawan** (bukan pasien sungguhan) sampai mekanisme consent
  dan kepatuhan privasi (UU PDP, Permenkes No. 24/2022) diselesaikan — ini juga sudah
  jadi catatan prioritas tertinggi di dokumen tersebut.
- Data audio simulasi tetap sebaiknya diperlakukan seolah sensitif (tidak diunggah ke
  tempat publik, dihapus setelah dianalisis) sebagai latihan kebiasaan baik untuk fase
  produksi nanti.

---

## 8. Referensi

1. "When De-noising Hurts: A Systematic Study of Speech Enhancement for ASR" — <https://arxiv.org/html/2512.17562v1>
2. "Speech recognition in adverse conditions: synthetic noise robustness analysis across 8 ASR models" — <https://link.springer.com/article/10.1186/s13636-026-00458-1>
3. "Assessing the Effectiveness of Automatic Speech Recognition for Medical/EMS Simulation Audio" — <https://link.springer.com/article/10.1007/s41666-025-00193-w>
4. Corti — "How to evaluate medical speech-to-text (ASR): WER, CER, and clinical term benchmarks" — <https://www.corti.ai/guides/how-to-evaluate-automatic-speech-recognition>
5. "Beyond WER: Entity and Disfluency Recall in Accented Conversational Speech" — <https://arxiv.org/html/2609.20828>
6. Dokumen internal: `docs/BOT-BPJS-PERBANDINGAN.md`, `docs/ASSEMBLYAI-DIARIZATION.md`, `docs/ujitest dan dokumentasi.md`

> Catatan: sumber 1-5 ditemukan via pencarian web pada saat penyusunan dokumen ini (Oktober
> 2026) — **verifikasi ulang judul, penulis, dan tanggal publikasi langsung dari link** sebelum
> dikutip di naskah akademik resmi (skripsi/PA), karena beberapa tanggal pada deskripsi hasil
> pencarian tampak di masa mendatang (kemungkinan metadata/preprint) dan perlu dicek manual.
