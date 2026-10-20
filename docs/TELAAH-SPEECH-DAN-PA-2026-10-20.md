# Telaah speech perawat–pasien dan naskah PA

Tanggal pemeriksaan: 20 Oktober 2026. Bahan yang dibaca: DOCX lokal `docs/word/referensi/Dokumentasi macam speech perawat dan pasien.docx`, [folder PA pengguna](https://drive.google.com/drive/folders/1ixe66yaAqCGxh3TUnGXnXTcFlqQuiuiw), dan isi [PROYEK AKHIR](https://docs.google.com/document/d/1Ss47KlCuX3dhKs1KynghFTvC-RYY7q-U9IJm19P7qZo/edit) (modified time dari Drive: 15 Oktober 2026). Folder Doku Konsep dan BAB 1–3 juga diinventarisasi. Tidak semua berkas PDF/Word arsip pada folder dibaca, dan tidak ada perubahan ke Drive.

## Apakah dokumen Word sudah sesuai?

**Sesuai sebagai pengantar bentuk komunikasi perawat–pasien**, dengan contoh fiktif dan sumber. Dokumen itu sendiri menjelaskan bahwa kata “speech” dipakai luas. Sembilan isinya tidak boleh disebut sembilan kategori ucapan lisan: wawancara/teach-back adalah bentuk interaksi; STT/TTS adalah teknologi; papan simbol, kartu jawaban, dan pelacakan mata adalah cara akses komunikasi. Pemisahan ini konsisten dengan penjelasan AAC oleh [ASHA](https://www.asha.org/practice-portal/professional-issues/augmentative-and-alternative-communication/).

Untuk “speech umum perawat dan pasien” dalam eksperimen PA, lengkapi dengan **pola tuturan**: perawat bertanya terbuka, meminta klarifikasi, mengulang jawaban, menjelaskan, dan menutup; pasien menjawab, bercerita, mengoreksi, menyatakan tidak tahu, menolak asumsi, dan balik bertanya. Keduanya dapat mengulang, berhenti, berbicara pelan, memakai istilah awam, atau saling menyela. Tanda tanya tidak otomatis berarti perawat. Pola itu sudah dimasukkan ke 12 skenario [paket pengujian](PAKET-UJI-PA/README.md).

Teach-back berguna untuk meminta pasien menjelaskan kembali pesan dengan bahasanya sendiri, bukan hanya menjawab “sudah paham”. Sumber primer: [AHRQ Teach-Back](https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/teachback.html). Paket menggunakan contoh belajar papan komunikasi, tanpa instruksi pengobatan.

## Mana yang masuk sistem dan selaras PA?

| Tambahan | Penempatan | Status dan alasan |
|---|---|---|
| Panduan kalimat wawancara | Di dekat pintu masuk Bot BPJS | Ditambahkan pada web sebagai panduan yang dibaca perawat sendiri; tidak mengubah rekaman atau pipeline |
| Data uji negasi, koreksi, peran, ketidakpastian | Paket evaluasi | Sudah disiapkan; paling langsung membantu pembuktian PA |
| Ya / Tidak / Tidak tahu | Papan Komunikasi | Cocok sebagai tahap berikut; harus menyertakan konteks pertanyaan, tidak menganggap diam sebagai jawaban, dan diuji penyimpanannya |
| Teach-back | Panduan perawat + skenario uji | Ada di panduan/skenario. Penilaian pemahaman tetap manusia; belum menambah penilai otomatis |
| Penanda informasi belum disebutkan | Dokumentasi hasil LLM | Layak sebagai usulan kepada pemilik pipeline; jangan mengisi diagnosis/saran obat atau menganggap kosong sebagai normal |
| Caption langsung | Aksesibilitas | Tunda; bukan syarat pembuktian STT → LLM → dokumentasi pada PA ini |
| Eye-tracking | AAC perangkat khusus | Tetap di luar implementasi PA |
| Computer use Mastra | Chat umum | Eksperimen terpisah; screenshot laptop bukan data evaluasi speech/diagnosis |

Prioritas yang disarankan: tuntaskan bukti pipeline, baru tambah pelengkap. Penambahan fitur tidak menggantikan pengukuran WER dan konsistensi faktual. Papan/Anamnesis diuji fungsional, jangan dicampur sebagai rekaman perawat–pasien.

## Ketidaksinkronan naskah Drive terhadap aturan/kode kini

| Bagian naskah Drive yang ditemukan | Penyesuaian untuk versi berikutnya |
|---|---|
| Mode percakapan dan dikte, termasuk pemulihan audio rusak lewat dikte | Batas sekarang hanya percakapan perawat–pasien. Hapus dikte dari rancangan utama atau ajukan eksplorasi ke pembimbing; jangan mengimplementasikannya otomatis |
| Whisper/diarization masih bertanda `[ISI]`; deskripsi prototipe STT Android | Tuliskan engine/model yang benar-benar digunakan saat eksperimen; kode kini memiliki AssemblyAI dan relabel. Jangan menamai semua hasil sebagai Whisper |
| Parameter/versi bertumpu commit 5 Oktober | Isi commit eksperimen baru, model, parameter dan prompt sebelum uji. Konfigurasi terpasang harus diperiksa, bukan hanya membaca versi minimum pubspec |
| evaluation_logs sebagai lokasi waktu semua tahap | Verifikasi implementasi/log yang tersedia; paket CSV dapat menjadi catatan eksternal. Jangan menyatakan tabel itu sudah dipakai jika belum dibuktikan |
| Peserta, jumlah skenario, tempat, waktu, peralatan masih `[ISI]` | Gunakan rancangan 12 skenario/36 rekaman sebagai bahan diskusi, isi jumlah/lokasi/waktu sebenarnya setelah disepakati |
| WER dan atribusi, kualitas catatan, waktu, penilai | Arah sudah sesuai; bedakan hasil STT mentah, relabel, draf LLM, dan catatan sesudah koreksi |
| Peninjauan dokter | Pertahankan peran dokter di luar aplikasi sesuai K-003, tanpa akun/status verifikasi baru |

Telaah ini tidak menilai validitas seluruh daftar pustaka Drive satu per satu. Klaim angka hasil dan manfaat klinis belum bisa dibuat. Dokumen Drive tidak disunting agar revisi akademik final dapat ditinjau pengguna/pembimbing; temuan dicatat di HANDOFF.

## Tindakan yang konkret sekarang

Panduan wawancara web dan paket pengujian dapat dipakai dengan kode saat ini. Uji awal: baca S04 (alergi belum diketahui), rekam dua orang di HP, bandingkan audio → STT mentah → draf → hasil edit. Bila draf mengatakan “tidak ada alergi”, catat sebagai perubahan makna; jangan menutupinya dengan nilai kelengkapan tinggi. Mulai dengan enam rekaman pilot, selesaikan persoalan operasional, lalu bekukan versi sebelum 36 rekaman utama.
