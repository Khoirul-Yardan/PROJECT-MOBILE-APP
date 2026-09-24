# Product Requirement Document (PRD)
## Pengembangan Aplikasi Mobile untuk Otomatisasi Dokumentasi Percakapan Perawat-Pasien sebagai Pendukung Verifikasi Diagnosis Pasien Menggunakan Speech-to-Text dan Large Language Model
**Studi Kasus: Rumah Sakit Ahmad Yani Surabaya**

---

## 1. Informasi Umum

| Item | Keterangan |
|---|---|
| Nama Mahasiswa | Khoirul Yardan Mauluddin Zhorif |
| NRP | 3124521022 |
| Kelas | IT-A |
| Program Studi | D3 Teknik Informatika, PSDKU Lamongan — PENS |
| Dosen Pembimbing 1 | Amma Liesvarastranta Haz, S.Tr.T., M.T. |
| Dosen Pembimbing 2 | Sritrusta Sukaridhoto, ST., Ph.D. |
| Studi Kasus | Rumah Sakit Ahmad Yani Surabaya |
| Dokumen Versi | v1.0 — disusun berdasarkan Judul Proyek Akhir resmi (17 September 2026) |

---

## 2. Latar Belakang

Transformasi digital di layanan kesehatan mendorong penerapan rekam medis elektronik, sebagaimana diatur dalam Permenkes RI No. 24 Tahun 2022 tentang Rekam Medis, yang mewajibkan penyelenggaraan rekam medis berbasis digital dan terintegrasi.

Sebagian besar informasi klinis (keluhan utama, durasi gejala, hasil anamnesis, riwayat kesehatan) berasal dari **percakapan langsung antara perawat dan pasien**, bukan dari data terstruktur semata. Proses pendokumentasian percakapan ini secara manual memakan waktu dan berisiko terhadap kehilangan informasi penting.

Penelitian terdahulu menunjukkan:
- **Speech recognition** telah lama digunakan untuk dokumentasi klinis dan berpotensi meningkatkan efisiensi, meski akurasinya bervariasi (Blackley et al.)
- **AI scribe** (transkripsi + dokumentasi otomatis) berpotensi mengurangi beban dokumentasi, namun bukti masih heterogen (Sasseville et al.)
- **LLM** dinilai paling konsisten membantu *workflow* dokumentasi & ringkasan, tetapi tetap punya keterbatasan (halusinasi, privasi) sehingga hasilnya wajib diverifikasi tenaga kesehatan, bukan menggantikan keputusan klinis (Christof et al.)
- **Speaker diarization** dan **speaker role identification** membantu memisahkan & mengidentifikasi peran pembicara (perawat vs pasien) dalam percakapan klinis (Zolensky et al.)

Proyek akhir ini mengusulkan aplikasi mobile yang merekam percakapan perawat-pasien, mengubahnya jadi transkripsi (STT), memisahkan pembicara (speaker diarization), lalu mengolahnya dengan LLM menjadi dokumentasi terstruktur — sebagai **bahan pendukung**, bukan pengganti, proses verifikasi diagnosis oleh dokter.

---

## 3. Rumusan Masalah

1. Bagaimana membangun aplikasi mobile yang dapat menangkap percakapan perawat-pasien sebagai sumber dokumentasi terstruktur?
2. Bagaimana menerapkan Speech-to-Text untuk mengubah percakapan suara menjadi transkripsi teks yang dapat diproses lebih lanjut?
3. Bagaimana menerapkan LLM untuk mengekstraksi dan merangkum informasi relevan dari hasil percakapan menjadi dokumentasi terstruktur?
4. Bagaimana menyediakan hasil dokumentasi dan informasi pendukung yang membantu dokter melakukan verifikasi diagnosis pasien?
5. Bagaimana mengevaluasi kinerja sistem dalam menghasilkan transkripsi & dokumentasi yang akurat, lengkap, dan berguna sebagai bahan verifikasi dokter?

---

## 4. Tujuan Proyek Akhir

1. Mengembangkan aplikasi mobile yang menangkap dan mengelola percakapan perawat-pasien sebagai sumber dokumentasi.
2. Menerapkan Speech-to-Text (STT) untuk mengubah percakapan suara menjadi transkripsi teks.
3. Menerapkan LLM untuk ekstraksi informasi, penyusunan dokumentasi, dan peringkasan dari percakapan perawat-pasien.
4. Menyediakan hasil dokumentasi & informasi pendukung bagi dokter untuk proses verifikasi diagnosis.
5. Mengevaluasi akurasi transkripsi dan kualitas dokumentasi yang dihasilkan sistem.

---

## 5. Ruang Lingkup (Scope)

### 5.1 In-Scope
- Perekaman audio percakapan perawat-pasien melalui aplikasi mobile
- Speaker diarization (pemisahan pembicara berdasarkan konteks sesi — sesi dimulai akun perawat)
- Speech-to-Text (disarankan: Whisper — mendukung multibahasa tanpa fine-tuning khusus)
- Pemrosesan LLM: ekstraksi informasi relevan, ringkasan percakapan, penyusunan dokumentasi terstruktur, pemeriksaan kelengkapan informasi
- Antarmuka verifikasi dokter: melihat transkrip + dokumentasi terstruktur, menyetujui atau meminta revisi
- Alur revisi: jika dokter meminta perbaikan, kembali ke perawat untuk koreksi
- Evaluasi sistem menggunakan pendekatan eksperimen komparatif (baseline vs proposed method)

### 5.2 Out-of-Scope (Batasan Masalah)
- Sistem **tidak** menetapkan diagnosis secara otomatis — LLM hanya menghasilkan draf/dokumentasi pendukung
- **Tidak** menggantikan tanggung jawab klinis dokter — dokter tetap melakukan verifikasi akhir
- Identifikasi peran pembicara (perawat/pasien) hanya berdasarkan konteks sesi aplikasi, bukan voice-print/biometric recognition
- Tidak mencakup integrasi penuh ke sistem rekam medis elektronik rumah sakit (RS Ahmad Yani) — cukup sebagai purwarupa/prototipe yang diuji dengan skenario percakapan

> Catatan: keputusan platform/teknologi pembangunan aplikasi (Flutter, strategi update, dsb.) dibahas terpisah pada dokumen **Keputusan Arsitektur Teknis**, agar PRD ini tetap fokus pada kebutuhan fungsional & akademik sesuai judul resmi.

---

## 6. Metode / Tinjauan Pustaka Singkat

| Komponen | Fungsi dalam Sistem | Referensi Pendukung |
|---|---|---|
| **Speech-to-Text (STT)** | Mengubah audio percakapan menjadi transkripsi teks. Rujukan: Whisper (dilatih ±680.000 jam data audio multibahasa, kuat tanpa fine-tuning khusus dataset) | Radford et al.; Joseph et al. |
| **Speaker Diarization** | Memisahkan segmen audio berdasarkan pembicara; peran (perawat/pasien) dipetakan dari konteks sesi aplikasi | Zolensky et al. |
| **Large Language Model (LLM)** | Mengolah transkripsi menjadi: (1) ekstraksi informasi relevan, (2) ringkasan percakapan, (3) dokumentasi terstruktur, (4) informasi pendukung verifikasi. **Tidak** dipakai untuk menetapkan diagnosis | Woo et al.; Christof et al. |

---

## 7. Kebutuhan Fungsional

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-01 | Aplikasi dapat merekam audio percakapan perawat-pasien | Must |
| FR-02 | Sistem dapat melakukan speaker diarization berdasarkan konteks sesi (perawat memulai sesi) | Must |
| FR-03 | Sistem dapat mengonversi audio menjadi transkripsi teks (STT) | Must |
| FR-04 | Sistem dapat mengekstraksi informasi relevan dari transkripsi menggunakan LLM | Must |
| FR-05 | Sistem dapat menghasilkan ringkasan percakapan | Must |
| FR-06 | Sistem dapat menyusun dokumentasi terstruktur dari hasil ekstraksi & ringkasan | Must |
| FR-07 | Sistem dapat memeriksa kelengkapan informasi dokumentasi | Should |
| FR-08 | Dokter dapat meninjau transkrip + dokumentasi terstruktur melalui antarmuka aplikasi | Must |
| FR-09 | Dokter dapat menyetujui dokumentasi (status: Disetujui) atau meminta revisi (status: Perlu Perbaikan) | Must |
| FR-10 | Jika revisi diminta, sistem mengirim kembali ke perawat untuk koreksi | Must |
| FR-11 | Sistem menyimpan seluruh histori (audio asli, transkrip, dokumentasi, status verifikasi) sebagai log | Should |

---

## 8. Kebutuhan Non-Fungsional

| ID | Kebutuhan | Keterangan |
|---|---|---|
| NFR-01 | Akurasi Transkripsi | Diukur dengan Word Error Rate (WER) |
| NFR-02 | Konsistensi Faktual | Dokumentasi hasil LLM harus sesuai isi percakapan asli (factual consistency) |
| NFR-03 | Kelengkapan Informasi | Dokumentasi harus mencakup poin-poin penting dari percakapan |
| NFR-04 | Efisiensi Waktu | Waktu pemrosesan dari rekam audio hingga dokumentasi siap ditinjau harus terukur dan wajar |
| NFR-05 | Keamanan & Privasi Data | Data percakapan pasien bersifat sensitif — perlu enkripsi penyimpanan & akses terbatas |
| NFR-06 | Auditabilitas | Dokter harus tetap bisa melihat transkrip asli, bukan hanya hasil ringkasan LLM, untuk verifikasi |

---

## 9. Diagram Alur Sistem

```
[Perawat melakukan wawancara pasien]
                │
                ▼
   [Rekam Audio melalui Aplikasi Mobile]
                │
                ▼
        [Speaker Diarization]
   (peran ditentukan dari konteks sesi:
    pembicara yang memulai sesi = perawat)
                │
                ▼
          [Speech-to-Text]
                │
                ▼
       [Transkripsi Percakapan]
                │
                ▼
   ┌─────────── LLM ───────────┐
   │  • Ekstraksi Informasi     │
   │    Relevan                │
   │  • Ringkasan Percakapan   │
   │  • Pemeriksaan Kelengkapan │
   │    Informasi               │
   └────────────┬───────────────┘
                ▼
      [Dokumentasi Terstruktur]
                │
                ▼
   [Informasi Pendukung Verifikasi]
                │
                ▼
            [Dokter]
                │
        ┌───────┴────────┐
        ▼                ▼
   [Verifikasi          [Perlu
    Sesuai]              Perbaikan/Revisi]
        │                │
        ▼                ▼
 [Dokumentasi      [Kembali ke Perawat
  Disetujui]        untuk Koreksi]
```

*(Diagram ini konsisten dengan rancangan diagram sistem pada dokumen judul resmi.)*

---

## 10. Metode Penelitian (Evaluasi)

Pendekatan: **eksperimen komparatif**, membandingkan dua konfigurasi:

| Konfigurasi | Deskripsi |
|---|---|
| **Baseline** | Dokumentasi hanya dari hasil transkripsi STT, tanpa pemrosesan LLM |
| **Proposed Method** | Dokumentasi dari STT + LLM (ekstraksi, ringkasan, penyusunan terstruktur) |

Kedua konfigurasi diuji dengan skenario percakapan perawat-pasien, kondisi audio, dan informasi klinis yang **sama**, lalu dibandingkan berdasarkan metrik:

| Metrik | Mengukur |
|---|---|
| Word Error Rate (WER) | Kualitas transkripsi |
| Kelengkapan Informasi | Seberapa lengkap dokumentasi mencakup isi percakapan |
| Kesesuaian Isi | Kesesuaian dokumentasi terhadap percakapan asli |
| Factual Consistency | Ketiadaan informasi yang menyimpang/halusinasi dari LLM |
| Waktu Pemrosesan | Efisiensi waktu menghasilkan dokumentasi |

---

## 11. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Akurasi STT rendah untuk aksen/istilah medis Bahasa Indonesia | Transkripsi salah, dokumentasi tidak akurat | Uji coba awal dengan berbagai skenario percakapan nyata; evaluasi WER sejak awal pengembangan |
| Halusinasi LLM (informasi yang tidak sesuai percakapan asli) | Dokumentasi menyesatkan dokter | Tampilkan transkrip asli berdampingan dengan hasil LLM; dokter wajib verifikasi sebelum disetujui |
| Kesalahan pemetaan peran pembicara (diarization) | Informasi tertukar antara ucapan perawat & pasien | Validasi pemetaan peran berdasarkan konteks sesi, uji dengan berbagai skenario percakapan |
| Isu privasi data percakapan pasien | Pelanggaran kerahasiaan rekam medis | Enkripsi data, akses terbatas sesuai peran (perawat/dokter), kepatuhan terhadap Permenkes No. 24/2022 |
| Keterbatasan waktu pengerjaan PA | Fitur tidak selesai | Prioritaskan fitur "Must Have" (FR-01 s.d. FR-06, FR-08 s.d. FR-10); fitur "Should" bisa menyusul jika waktu cukup |

---

## 12. Kesimpulan

PRD ini menyelaraskan rencana produk dengan judul resmi PA yang telah disetujui pembimbing: aplikasi mobile untuk **otomatisasi dokumentasi percakapan perawat-pasien** guna mendukung **verifikasi diagnosis oleh dokter**, menggunakan kombinasi **Speech-to-Text, Speaker Diarization, dan Large Language Model**. Sistem diposisikan sebagai alat bantu dokumentasi — bukan pengganti keputusan klinis — dengan evaluasi berbasis perbandingan baseline vs proposed method menggunakan metrik WER, kelengkapan, kesesuaian isi, factual consistency, dan waktu proses.
