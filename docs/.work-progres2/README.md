# Pembuat laporan Progres 2

Jalankan dari root proyek:

```powershell
python docs/.work-progres2/build_report.py
python docs/.work-progres2/validate_report.py
```

Pustaka lokal `python-docx`, Pillow, dan PyMuPDF dibaca dari `docs/.work-speech/lib`; jangan commit folder pustaka itu. Laporan dibuat di `Dokumentasi/Progres 2/progres 2 Try and error sistem.docx`. Skrip menimpa laporan hasil generate; jika laporan diedit manual, simpan salinannya sebelum menjalankan ulang.

Gambar sumber tidak diubah. Salinan tersamarkan ada di `docs/progres2-assets` dan dapat dipakai untuk membangun laporan pada checkout tanpa gambar asli. `manifest.json` menghubungkan gambar dengan sumbernya. Jangan ikut commit screenshot mentah yang berisi identitas/alamat.

Validasi memeriksa paket Word, 21 gambar tertanam, tautan relatif Markdown, keutuhan enam Word lama terhadap hash asal, dan hash screenshot sumber bila tersedia. Hasil lokal: `.work-docs-progres2/validation.json`.

`render_report.ps1` membuka Word secara tersembunyi dan mencoba ekspor PDF lokal. Pada lingkungan penyusunan 19 Oktober, dokumen berhasil dibuka tetapi Repaginate/ekspor tertahan, termasuk pada dokumen uji satu halaman; jumlah halaman cetak belum diverifikasi. Daftar isi tidak memakai nomor halaman statis. `-Inspect` adalah diagnosis proses; `-Smoke` menggunakan dokumen uji lokal bila tersedia. Jangan menganggap jumlah bagian terencana pada JSON sebagai jumlah halaman cetak.
