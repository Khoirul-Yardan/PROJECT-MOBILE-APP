# Pembuat laporan Progres 2

Jalankan dari root proyek:

```powershell
python docs/.work-progres2/build_report.py
python docs/.work-progres2/validate_report.py
```

Pustaka lokal `python-docx`, Pillow, dan PyMuPDF dibaca dari `docs/.work-speech/lib`; jangan commit folder pustaka itu. Laporan dibuat di `Dokumentasi/Progres 2/progres 2 Try and error sistem.docx`. Skrip menimpa laporan hasil generate; jika laporan diedit manual, simpan salinannya sebelum menjalankan ulang.

Revisi atas permintaan pengguna memakai **21 gambar asli**, langsung dari `Dokumentasi/Progres 2`, tanpa penyamaran, crop, atau kompresi ulang. Gambar tersebut wajib tersedia ketika menjalankan pembuat laporan. Salinan tersamarkan di `docs/progres2-assets` adalah arsip versi sebelumnya dan tidak dipakai dalam laporan terbaru. Manifest revisi lokal: `.work-docs-progres2/original-report-manifest.json`.

Laporan bergambar asli disimpan lokal untuk pengguna kirim kepada dosen. Revisi biner DOCX tidak dimasukkan ke commit karena memuat identitas yang statusnya sebagai data simulasi belum dikonfirmasi; mengikuti batas commit data pasien pada AGENTS.md. Skrip serta catatan perubahan boleh dicatat terpisah.

Validasi memeriksa paket Word, kecocokan byte 21 gambar tertanam dengan gambar asli, tautan relatif Markdown, keutuhan enam Word lama terhadap hash asal, dan hash screenshot sumber bila tersedia. Hasil lokal: `.work-docs-progres2/validation.json`.

`render_report.ps1` membuka Word secara tersembunyi dan mencoba ekspor PDF lokal. Pada lingkungan penyusunan 19 Oktober, dokumen awal berhasil dibuka tetapi Repaginate/ekspor tertahan, termasuk pada dokumen uji satu halaman; jumlah halaman cetak belum diverifikasi. Revisi memakai penomoran bagian dan footer halaman dinamis, tanpa daftar isi bernomor halaman statis. `-Inspect` adalah diagnosis proses; `-Smoke` menggunakan dokumen uji lokal bila tersedia. Jangan menganggap jumlah bagian terencana pada JSON sebagai jumlah halaman cetak.
