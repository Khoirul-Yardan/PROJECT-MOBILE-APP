# Paket pengujian PA yang bisa langsung dipersiapkan

Versi draf 20 Oktober 2026. Semua dialog fiktif; belum direkam, belum dinilai tenaga keperawatan, dan belum menghasilkan angka eksperimen. Jumlah di bawah adalah rancangan praktis studi kecil, bukan hasil perhitungan kecukupan sampel atau bukti manfaat klinis.

## Mulai dari sini

1. Baca [naskah 12 skenario](NASKAH-SIMULASI.md) bersama perawat/dosen keperawatan. Perbaiki kewajaran bahasa, daftar fakta dan negasi sebelum membekukan versi.
2. Lakukan pilot terpisah: dua dialog latihan × tiga kondisi suara = enam rekaman. Dialog pilot tidak masuk pengujian utama; gunakan untuk melatih prosedur, bukan menyesuaikan prompt memakai data uji akhir.
3. Rekam 12 skenario × tiga kondisi = **36 rekaman**. Dua orang dewasa bermain sebagai perawat dan pasien; tiga pasangan pemeran bergantian (empat skenario per pasangan). Tidak perlu pasien sungguhan, dokter, atau anak-anak.
4. Dua penyusun mendengarkan audio dan membuat referensi manual. Referensi berasal dari **ucapan yang sungguh terekam**, bukan menyalin naskah. Jika ada improvisasi, perbarui fakta acuan untuk rekaman itu; simpan naskah awal untuk audit.
5. Jalankan STT satu kali per rekaman, simpan keluaran mentah. Pakai transkrip yang **sama** pada baseline dan proposed. Simpan versi sesudah relabel terpisah. Jangan menimpa data asli.
6. Bandingkan catatan akhir baseline vs proposed, serta nilai draf LLM sebelum diedit. Isi CSV hanya setelah pengukuran. Angka kosong berarti belum diukur, bukan nol.

## Isi paket

| File | Fungsi |
|---|---|
| `skenario.json` | Data sumber: dialog, fakta dengan nomor giliran, informasi yang tidak disebutkan, jebakan kesalahan |
| `NASKAH-SIMULASI.md` | Naskah untuk dua pemeran; 12 kasus, bukan panduan klinis |
| `fakta-acuan.csv` | Fakta awal dari skenario; sesuaikan terhadap audio referensi final |
| `manifest-rekaman.csv` | 36 slot rekaman; isi perangkat, kondisi, durasi, hash dan lokasi audio setelah merekam |
| `penugasan.csv` | 72 tugas catatan: 36 baseline dan 36 proposed |
| `hasil-kosong.csv` | Waktu, WER, kelengkapan, klaim, skor isi, kegagalan; seluruh hasil sengaja kosong |
| `penilaian-fakta-kosong.csv` | Satu baris per fakta × penilai × keluaran |
| `penilaian-klaim-kosong.csv` | Satu baris per klaim × penilai × keluaran |

Generator `python web/tests/prepare_pa_dataset.py` menulis ulang lembar kosong. **Jangan menjalankannya setelah mengisi hasil di folder ini.** Salin paket ke direktori data penelitian privat sebelum pengukuran; simpan audio/referensi/hasil di luar repo publik. Jangan commit rekaman atau screenshot desktop.

## Kondisi rekaman dan realisme

| Kode | Pelaksanaan | Dicatat |
|---|---|---|
| C0 | Ruang tenang, HP sekitar 50 cm, suara percakapan biasa | Jarak nyata, ruangan, perangkat, gangguan |
| C1 | Posisi sama, kipas/AC pada posisi tetap; tanpa suara orang lain | Sumber/jarak/setelan noise; dB hanya jika benar-benar diukur |
| C2 | HP sekitar 100 cm, pemeran pasien berbicara lebih pelan namun nyaman | Jarak nyata; kondisi ini menggabungkan jarak dan volume, tidak mengisolasi efek keduanya |

Target praktis 30–90 detik per skenario pendek, tetapi jangan menambahkan fakta hanya untuk mengejar durasi. Ukur durasi asli. Variasikan urutan C0/C1/C2 sesuai manifest untuk mengurangi efek latihan. Pakai model HP, posisi mikrofon, format audio, bahasa dan parameter layanan yang sama. Gunakan logat alami pemeran, jangan meniru gangguan disabilitas atau menahan napas. S10 memuat overlap ringan dua pembicara, S12 memuat jeda; jangan memasukkan suara dokter/keluarga ke dataset utama.

Skenario mencakup pertanyaan terbuka, negasi, koreksi angka, pasien bertanya, perawat menjawab, ketidakpastian alergi, pengulangan, istilah awam, obat tidak diingat, perubahan waktu keluhan, jawaban pendek, teach-back, dan diam. Ini variasi komunikasi, bukan kumpulan diagnosis. Teach-back dipakai untuk menilai pencatatan apa yang diucapkan, bukan menilai kecerdasan atau kondisi klinis pasien.

## Pembanding yang adil

**Baseline:** STT saja; perawat menyusun catatan dari transkrip ke lima kolom yang sama dengan sistem. **Proposed:** STT yang sama + LLM; perawat meninjau dan menyunting draf pada lima kolom yang sama. Kedua kelompok mendapat akses transkrip asli dan aturan yang sama tentang mendengarkan ulang audio. Jika audio tidak tersedia di UI, jangan memberi hanya salah satu kelompok akses eksternal.

Penugasan contoh memakai enam reviewer N01–N06 (perawat atau mahasiswa keperawatan, sebutkan statusnya). Masing-masing memperoleh enam baseline dan enam proposed, **tanpa melihat rekaman yang sama dua kali**. Rekaman yang sama dinilai pada dua kondisi oleh reviewer berbeda. Pasangan rekaman berulang/isi skenario serupa masih bisa memberi efek belajar: acak urutan tugas, seimbangkan mana kondisi yang dikerjakan dulu, dan catat sebagai keterbatasan. Kolom `order` diisi sebelum uji. Pemeran dan reviewer adalah peran berbeda; sebaiknya reviewer tidak menyusun naskah yang sedang dinilai.

Jangan menganggap 72 tugas sebagai 72 pasien atau sampel independen. Ada pengelompokan menurut pemeran, skenario, dan reviewer. Laporkan jumlah pada setiap tingkat. Untuk skala D3 ini utamakan tabel per skenario/kondisi dan statistik deskriptif; jika menggunakan Wilcoxon, rangkum paired difference per reviewer lebih dulu dan jelaskan bahwa kasusnya berimbang tetapi berbeda. Enam reviewer tidak otomatis cukup untuk klaim signifikan. Pembimbing menentukan analisis akhir dan kecukupan sampel.

Bekukan: commit aplikasi, STT/model diarization yang benar-benar dipakai, provider/model LLM, prompt/hash, bahasa, parameter sampling, tanggal, perangkat, dan retry. Jika sistem memilih provider pertama, gunakan akun uji khusus dengan satu provider agar kondisi tetap. Perubahan prompt sesudah melihat hasil berarti versi eksperimen baru.

## Pengukuran

| Ukuran | Cara menghitung | Hal yang dijaga |
|---|---|---|
| WER STT | `(substitusi + penghapusan + sisipan) / jumlah kata referensi` | Referensi manual, huruf kecil, tanda baca dihapus; angka dan kata pengisi mengikuti aturan yang dibekukan |
| Ketepatan peran | Segmen/giliran yang perannya benar ÷ segmen/giliran yang dapat dinilai | Laporkan sebelum/sesudah relabel, pisahkan dari WER; overlap tidak dapat dinilai diberi alasan dan jumlah |
| Kelengkapan | Fakta acuan yang tercakup benar ÷ semua fakta relevan di audio | Negasi/ketidakpastian bagian dari fakta; jangan menghitung kelengkapan dari banyaknya kolom terisi |
| Kesesuaian isi | Dua penilai memberi skor 0–3 dengan rubrik di bawah | Penilai tidak diberi label baseline/proposed; boleh menelaah acuan audio/transkrip |
| Factual consistency | Klaim yang didukung ÷ seluruh klaim faktual keluaran | Pisahkan klaim bertentangan dan tidak didukung; output kosong = N/A, bukan 100% |
| Waktu mesin | STT dan LLM dicatat terpisah | Baseline LLM = N/A; kegagalan tidak dibuang diam-diam |
| Waktu kerja perawat | Dari mulai melihat transkrip/draf sampai catatan dinyatakan siap | Termasuk membaca, koreksi, dengar ulang jika diizinkan; rekaman tidak masuk waktu kerja ini |
| Waktu total | Awal proses STT sampai catatan siap | Jangan menjumlah ulang jika tahap tumpang tindih; pakai stopwatch/cap waktu aktual |

Nilai proposed pada dua tahap: **draf awal** dan **catatan final**; baseline hanya catatan final. Gunakan `stage` pada lembar fakta/klaim. Laporkan dampak koreksi perawat agar kesalahan LLM tidak tertutup. Kebenaran dinilai terhadap audio referensi, sementara transkrip mentah dipakai menelusuri apakah kesalahan berasal dari STT atau LLM.

Rubrik kesesuaian isi: **3** fakta inti, negasi, waktu, dan atribusi terjaga tanpa klaim tambahan; **2** kekurangan minor yang tidak mengubah arti inti; **1** ada fakta inti hilang atau makna berubah sehingga perlu koreksi penting; **0** keluaran tidak dapat digunakan, tidak relevan, atau mengarang fakta inti. Simpan skor dua penilai sebelum konsensus. Weighted kappa hanya dihitung jika data memadai dan metode bobot ditentukan sebelumnya; jangan menggantinya dengan persentase sepakat tanpa penjelasan.

Contoh fiktif S04: referensi menyatakan alergi **tidak diketahui**. Draf “tidak ada alergi” adalah klaim bertentangan dan fakta ketidakpastian tidak tercakup. Informasi “suhu 36,5” yang tidak pernah diucapkan adalah klaim tidak didukung. Tidak mengisi kolom suhu justru tepat. Satu klaim dengan dua fakta dipecah menjadi dua klaim sebelum penilaian.

WER **bukan** ukuran ringkasan LLM: ringkasan sengaja mengubah jumlah/urutan kata. Jika mengukur koreksi transkrip LLM sebagai eksperimen tambahan, beri label tersendiri dan jangan menyebutnya peningkatan STT mentah. Rasio ringkas dan jumlah kata bukan pengganti factual consistency.

Skrip lokal tanpa mengirim teks ke layanan luar:

```powershell
python web/tests/score_wer.py referensi.txt stt-mentah.txt
```

Hapus label pembicara/timestamp dan anotasi nonverbal dari kedua file sebelum menghitung; simpan salinan asli. Bentuk “4” dan “empat” masih dianggap berbeda oleh skrip. Pilih normalisasi angka sebelumnya dan terapkan identik pada kedua file; laporkan aturan itu. WER dapat melebihi 100% bila banyak sisipan.

## Tambahan uji fungsional, tidak dicampur WER

Uji masing-masing tiga kali: izin mikrofon ditolak, jaringan terputus, LLM gagal/kuota habis, aplikasi ditutup saat merekam, proses ulang rekaman, edit/buka ulang/ekspor, serta akun berbeda tidak dapat membaca sesi. Catat hasil aktual, pesan kesalahan dan data yang terselamatkan. Jangan drop tabel atau melonggarkan RLS demi tes.

Papan Komunikasi: sentuh ikon → TTS → catatan; Anamnesis Terpandu: pertanyaan TTS → respons pasien → draf. Keduanya dilaporkan sebagai modul pendukung, bukan bukti rekaman percakapan perawat-pasien. Verifikasi dokter tetap di luar aplikasi.

Dasar sumber dan perbedaan naskah PA terkini: [telaah speech dan Drive](../TELAAH-SPEECH-DAN-PA-2026-10-20.md). Protokol ini melengkapi [rencana speech realistis](../PENGUJIAN-SPEECH-REALISTIS.md), tanpa mengubah pipeline aplikasi.
