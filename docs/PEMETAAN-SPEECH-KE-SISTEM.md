# Pemetaan 9 Jenis Komunikasi Perawat–Pasien ke Sistem AI Hub

Sumber: *Dokumentasi macam speech perawat dan pasien.docx* (Drive, folder Doku Konsep; juga `docs/Dokumentasi-Speech-Perawat-ke-Pasien.docx`). Tolok ukur keselarasan: judul PA "Dokumentasi **Percakapan Perawat-Pasien** … STT dan LLM" dan batas scope PRD §5.2. Pelengkap: `docs/SPEECH-PERAWAT-DOKTER-DAN-KESELARASAN-JUDUL.md`.

Kriteria "cocok": (a) pihak yang bicara tetap perawat dan pasien, (b) berkaitan dengan STT/LLM/dokumentasi atau pelengkap langsung anamnesis, (c) tidak butuh perangkat khusus, (d) tidak menetapkan diagnosis.

| # | Jenis (dokumen Drive) | Status di sistem | Keputusan | Tindakan |
|---|---|---|---|---|
| 1 | Komunikasi terapeutik & wawancara | **Inti**: Bot BPJS merekam wawancara | ✅ Sudah | Perbaiki akurasi relabel pola mengulang/konfirmasi (backlog #1) |
| 2 | STT untuk dokumentasi | **Inti**: AssemblyAI + diarization + LLM, hasil bisa diedit | ✅ Sudah | Pertahankan transkrip asli berdampingan dengan hasil LLM; "hasil otomatis perlu dikoreksi" sudah sejalan dengan fitur edit |
| 3 | STT untuk dibaca pasien (live caption) | Belum ada | 🟡 Tunda | Masih perawat-pasien, tetapi tujuannya aksesibilitas, bukan dokumentasi. Bahas dengan pembimbing sebelum dibangun |
| 4 | Papan gambar/simbol | **Ada**: Papan Komunikasi (11 ikon, `komunikasi_events`) | ✅ Sudah | Tambah aksesibilitas (backlog #4) |
| 5 | Ketik/pilih huruf menjadi suara (TTS) | Sebagian: TTS native dipakai Papan Komunikasi; belum ada ketik bebas | 🟡 Opsional | Kolom ketik bebas bisa ditambah di Papan; catat sebagai pengembangan, bukan inti PA. Ingat PRD-INTI: TTS balasan di Bot BPJS sengaja dihapus; TTS di Papan dan Anamnesis tetap sah karena itu sisi pasien/pertanyaan |
| 6 | Ya / Tidak / Tidak tahu | Belum ada | ✅ Cocok, kecil | Backlog #3. "Tidak tahu" ≠ "tidak"; tanpa respons ≠ jawaban tidak |
| 7 | Lokasi & intensitas nyeri | **Ada**: alur `pain` di Papan (lokasi `BODY` + skala 0–10) | ✅ Sudah | Tampilkan sebagai laporan pasien, bukan diagnosis; masuk ke Dokumentasi/Riwayat gabungan |
| 8 | Teach-back | Belum ada | ✅ Cocok | Backlog #5. Perawat menandai paham / perlu diulang; tetap sisi perawat-pasien |
| 9 | Pelacakan mata (AAC tatapan) | Tidak ada | ❌ Di luar scope | Butuh perangkat khusus (mis. TD Pilot); cukup disebut di tinjauan pustaka sebagai pengembangan lanjutan |

## Hal yang tidak boleh melenceng

- Dokumen Drive ini memuat jenis komunikasi **perawat–pasien** saja, jadi tidak bertabrakan dengan judul. Jangan diperluas ke ucapan dokter.
- Dari 9 jenis, yang menopang rumusan masalah PA (STT → LLM → dokumentasi → verifikasi dokter) adalah **#1 dan #2**. #4–#8 adalah *pelengkap anamnesis* untuk pasien yang sulit bicara; posisikan di laporan sebagai modul pendukung (input alternatif ke dokumentasi yang sama), bukan objek evaluasi utama WER/factual consistency.
- Evaluasi komparatif baseline vs proposed (WER, kelengkapan, kesesuaian, factual consistency, waktu) cukup dijalankan pada #1–#2. Modul pelengkap dievaluasi secara fungsional (uji skenario), tidak dengan WER.

## Catatan ketidaksesuaian dokumen

- `PRD/PRD-INTI.md` (5 Oktober) belum memuat Papan Komunikasi, Anamnesis Terpandu, `komunikasi_events/rooms`, maupun AssemblyAI. Kode lebih baru. Perbarui PRD-INTI bila ingin dijadikan acuan sidang (tugas Claude, tunggu persetujuan pengguna).
- Dokumen Drive menyebut sumber diperiksa 16 Oktober 2026; kutip rujukan [1]–[11] apa adanya bila dimasukkan ke Bab 2 (tinjauan pustaka). Lihat juga `docs/REFERENSI-SUMBER-ILMIAH.md`.
