# Analisis Pemilihan Sistem Speech untuk Anamnesis

> **Status dokumentasi — 19 Oktober 2026:** Skor di bawah adalah penilaian usulan, bukan hasil eksperimen atau persetujuan dosen. Dua pilihan, Papan Komunikasi dan Anamnesis Terpandu, sudah tersedia di kode dan ditambahkan mandiri menurut pengguna. Dosen belum menjawab pengajuan. “Inti” pada tabel lama berarti prioritas tambahan; inti akademik tetap Bot BPJS. Lihat [Progres.md](Progres.md).

Turunan dari `kemungkinan tools yang dapat dikembangkan.md`. Menjawab:
**dari semua sistem speech, mana yang dipilih lebih dulu (inti), dan mengapa.**
Rujukan bernomor [n] ada di `REFERENSI-SUMBER-ILMIAH.md`.

> **Perubahan dari dokumen sebelumnya:** "Panggil Perawat (aktif suara)" yang
> semula direncanakan tahap 3 **diturunkan prioritasnya**. Alasannya: buktinya
> hanya pilot/klaim vendor [11][12] dan risikonya paling tinggi (salah
> dengar pada keadaan darurat). Kebutuhan "memanggil perawat" tetap terpenuhi
> lewat tombol **Panggil Suster** di Papan Komunikasi (sentuh, tanpa STT).

## 1. Metode seleksi

Setiap tool dinilai 1–5 (5 = terbaik) pada lima kriteria berbobot. Skor akhir
= jumlah(bobot × nilai) / 5, rentang 20–100.

| Kode | Kriteria | Bobot | Penjelasan |
|---|---|---|---|
| K | Relevansi dengan anamnesis | 30% | Seberapa langsung tool menghasilkan atau memperbaiki data anamnesis (keluhan utama, durasi, riwayat) yang dipakai perawat. |
| B | Kekuatan bukti ilmiah | 20% | Ketersediaan tinjauan sistematis/studi tervalidasi yang mendukung kelayakan dan manfaat (bukan sekadar klaim vendor). |
| T | Kelayakan teknis | 20% | Kecocokan dengan tumpukan teknologi saat ini (Flutter + WebView + Supabase + STT/LLM) tanpa perangkat khusus. |
| R | Risiko rendah | 15% | Risiko keselamatan pasien, regulasi, dan privasi yang lebih rendah mendapat nilai lebih tinggi. |
| W | Waktu & biaya rendah | 15% | Perkiraan upaya pengembangan dan pengujian dalam jadwal tugas akhir; lebih murah/cepat = nilai lebih tinggi. |

**Batasan:** nilai adalah penilaian peneliti berdasarkan bukti yang
dikumpulkan dan kondisi proyek, bukan hasil pengukuran. Sebaiknya
divalidasi bersama pembimbing/perawat; ubah nilai di tabel jika ada
pertimbangan lain. Bobot dan ambang keputusan dapat diubah.

## 2. Hasil penilaian

Ambang keputusan: ≥70 inti; 60–69 tahap 2; 50–59 ditunda; <50 saran
pengembangan.

| Peringkat | Tool | K | B | T | R | W | Skor | Keputusan | Platform |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1. Papan Komunikasi (sentuh ke suara) | 4 | 4 | 5 | 4 | 5 | **87** | INTI – kerjakan sekarang | WebView |
| 2 | 2. Anamnesis Terpandu (asisten suara) | 5 | 3 | 4 | 3 | 3 | **76** | INTI – kerjakan sekarang | Flutter + WebView |
| 3 | 4. Pengingat & Orientasi (lansia/demensia) | 2 | 3 | 4 | 4 | 4 | **64** | Tahap 2 – setelah inti stabil | WebView + TTS |
| 4 | 5. Penilaian Bicara (disartria) | 2 | 4 | 3 | 4 | 3 | **61** | Tahap 2 – setelah inti stabil | Flutter + WebView |
| 5 | 3. Panggil Perawat (aktif suara) | 3 | 2 | 3 | 2 | 3 | **53** | Ditunda – butuh bukti/data tambahan | Flutter + WebView |
| 6 | 6. Pengenal Ucapan Kustom | 3 | 3 | 2 | 3 | 2 | **53** | Ditunda – butuh bukti/data tambahan | Flutter |
| 7 | 9. AAC Eye-Tracking | 2 | 3 | 1 | 3 | 1 | **40** | Saran pengembangan (riset) | Flutter (kamera + ML) |
| 8 | 8. Baca Bibir / Isyarat | 2 | 2 | 1 | 2 | 1 | **33** | Saran pengembangan (riset) | Flutter (kamera + ML) |
| 9 | 7. Smart Room (kontrol ruangan) | 1 | 1 | 1 | 3 | 1 | **26** | Saran pengembangan (riset) | Flutter + IoT |

## 3. Keputusan

### Prioritas tambahan (dipilih pada usulan; implementasi mandiri tersedia)

1. **Papan Komunikasi** (WebView). Pasien yang tidak dapat berbicara memilih
   ikon keluhan; ada skala nyeri 0–10 [19] dan tombol Panggil Suster. Bukti
   menunjukkan AAC berteknologi rendah layak dan aman tetapi kurang dipakai
   [1][2][3]; implementasi paling murah karena murni web.
2. **Anamnesis Terpandu** (Flutter untuk suara + WebView untuk form).
   Memperluas Bot BPJS yang sudah ada: STT (AssemblyAI) [8] dan LLM
   mengisi form anamnesis. **Wajib** ditinjau dan disetujui perawat karena
   pengenalan suara klinis terbukti mempercepat dokumentasi tetapi menambah
   galat [4][5], dan studi LLM anamnesis masih berbasis simulasi [10].

### Tahap 2 (setelah inti stabil)

3. **Pengingat & Orientasi** untuk lansia/demensia [13].
4. **Penilaian Bicara** untuk pemantauan pemulihan disartria: WER terhadap
   kalimat acuan + kecepatan bicara; ukuran otomatis serupa sudah divalidasi
   di literatur [14], tetapi belum pada bahasa Indonesia.

### Ditunda / saran pengembangan

5. **Panggil Perawat aktif suara** dan **Pengenal Ucapan Kustom**:
   butuh bukti/data tambahan [11][12][16].
6. **Smart Room, Baca Bibir/Isyarat, Eye-Tracking**: riset lanjutan
   [17][18]; satu studi ICU melaporkan galat kata 6,3% pada dataset penulis
   sendiri, belum cukup untuk dipakai klinis.

## 4. Pembagian Flutter vs WebView

| Kebutuhan | Pilihan | Alasan |
|---|---|---|
| Mikrofon dan rekaman berkualitas (wake word tidak aktif) | Flutter | Sudah dipakai Bot BPJS (`record`); WebView tidak andal untuk audio latar |
| TTS yang harus andal | Flutter (`flutter_tts`) | Kendali audio native |
| Kamera + ML on-device | Flutter | Hanya untuk tool riset |
| Papan ikon, form, riwayat, grafik, ekspor | WebView | HTML/JS, bisa diuji di browser desktop |
| Pemanggilan LLM, penyimpanan | WebView + Supabase | `ai.js`, `db.js`, `bridge.js` sudah ada |

## 5. Kepatuhan dan etika (wajib untuk semua tool)

- **Data kesehatan = data pribadi spesifik** menurut UU PDP [21]; gunakan kode
  pasien (bukan identitas lengkap), enkripsi, RLS Supabase, dan persetujuan
  pasien.
- **Rekam medis** diatur Permenkes 24/2022 [22]; keluaran sistem ini
  berstatus **draf pendukung**, bukan rekam medis resmi, sampai disahkan
  tenaga kesehatan.
- **Prinsip WHO untuk AI kesehatan** [20]: manusia tetap mengendalikan
  keputusan (perawat menyetujui), transparansi (tampilkan transkrip mentah di
  samping ringkasan), akuntabilitas, dan inklusivitas (pasien dengan
  gangguan bicara tetap terlayani).

## 6. Metrik evaluasi yang diusulkan

| Tool | Metrik |
|---|---|
| Papan Komunikasi | Waktu dari buka papan sampai pesan terkirim; skor SUS (kegunaan); skor kepuasan komunikasi pasien dan perawat; kelengkapan data keluhan yang tercatat |
| Anamnesis Terpandu | WER STT (sudah tersedia); presisi/recall pengisian tiap kolom vs acuan perawat; waktu anamnesis dengan vs tanpa tool; jumlah koreksi perawat; latensi end-to-end |
| Tahap 2 | Kepatuhan jawaban pengingat; korelasi skor bicara dengan penilaian terapis |

## 7. Risiko utama

| Risiko | Mitigasi |
|---|---|
| Salah dengar STT/LLM pada informasi penting | Draf saja, persetujuan perawat, tampilkan transkrip mentah |
| Keadaan darurat tidak terdeteksi | Kata kunci darurat tanpa menunggu LLM; tombol sentuh sebagai jalur utama; jangan klaim pengganti nurse call resmi |
| Kebocoran data kesehatan | Enkripsi, RLS, minimisasi data, persetujuan |
| Akurasi pada ucapan tidak jelas atau bahasa daerah | Konfirmasi ya/tidak; uji dengan rekaman simulasi bervariasi |
| Bukti terbatas untuk sebagian tool | Dinyatakan jujur; evaluasi sendiri dengan skenario simulasi |
