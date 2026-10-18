# Penataan dokumentasi — 19 Oktober 2026

Permintaan: pisahkan Word dan non-Word, selaraskan riwayat awal–akhir, dan buat laporan Progres 2 berdasarkan gambar pengguna.

## Perubahan

1. Enam Word asli dipindahkan utuh ke `word/referensi`, `word/pengajuan`, `word/laporan`, dan `word/arsip`; isi historis tidak ditimpa laporan baru.
2. Dokumen non-Word tetap di root `docs` dan folder aset/pengujian yang sudah ada, terpisah dari `word`. Lokasinya dipertahankan karena AGENTS.md dan kode memakai jalur tersebut. README mengelompokkan semuanya menurut fungsi/status.
3. Progres, rincian sistem, alur, panel admin, panduan penggunaan, pemetaan/analisis speech, checklist, dan catatan terkait diselaraskan. Snapshot rincian/progres/alur sebelumnya disimpan di `arsip`.
4. Catatan uji lama mempertahankan tanggal, angka, dan lingkungan aslinya; label status menjelaskan koreksi VPN, perubahan admin, dan kebutuhan uji yang belum selesai.
5. Dua tambahan adalah Papan Komunikasi dan Anamnesis Terpandu berdasarkan pengajuan lama; pengguna menyatakan belum mendapat jawaban dosen. Laporan tidak mengklaim persetujuan akademik.
6. Laporan baru di `Dokumentasi/Progres 2/progres 2 Try and error sistem.docx`; gambar berasal dari 21 bukti pada folder tersebut. Identitas, email, ID terkait, dan alamat server disamarkan hanya pada salinan laporan.

## Validasi dan batas

- Struktur paket Word valid, 21 gambar tertanam tanpa tautan gambar eksternal, keenam Word asli identik dengan sumber sebelum dipindah, hash gambar asli tetap, dan tidak ada tautan Markdown relatif putus. Pemeriksaan: `docs/.work-progres2/validate_report.py`.
- Microsoft Word berhasil membuka dokumen pada otomasi, tetapi Repaginate/ekspor PDF macet; dokumen uji satu halaman juga mengalami hambatan yang sama. Tata letak cetak dan jumlah halaman final belum dapat diverifikasi otomatis. Daftar isi memakai nomor bagian dan topik, tanpa nomor halaman yang belum terverifikasi. Footer tetap memakai nomor halaman dinamis Word.
- Tidak ada pengujian aplikasi/provider/database baru. Hasil uji dalam laporan adalah kutipan/parafrasa bukti lokal bertanggal dan dibedakan dari pengamatan gambar.
- Gambar riwayat menunjukkan BPJS 4, Anamnesis 0, Papan 3; tidak dipakai sebagai ukuran akurasi.
- Dokumen referensi ilmiah lama tidak diverifikasi ulang ke web pada tugas penataan ini; laporan perkembangan memakai sumber internal.
- PRD serta kode aplikasi tidak diubah. Berkas pengguna yang sebelumnya berubah tetap dipertahankan.
- Pengguna mengonfirmasi langsung bahwa dua tambahan adalah Papan Komunikasi dan Anamnesis Terpandu pada percakapan tugas ini.

## Revisi laporan untuk pembimbing

Atas permintaan lanjutan pengguna, laporan `progres 2 Try and error sistem.docx` diganti dengan versi bergambar asli. Seluruh 21 gambar ditanam langsung dari sumber tanpa penyamaran atau kompresi ulang. File gambar sumber tidak diubah. Salinan tersamarkan tetap sebagai arsip versi pertama.

Bahasa laporan disederhanakan: pembuka ditulis dari sudut pandang penyusun, penjelasan fitur dipersingkat, dan kalimat pembatas yang berulang dihapus. Susunan menjadi perkembangan, fitur komunikasi, percobaan VPN/Terminal, panel admin, lalu pekerjaan berikutnya. Gambar diperbesar, caption dibuat singkat, font dan jarak antarbagian diseragamkan. Status Anamnesis yang belum memiliki sesi lengkap tetap dijelaskan.

Revisi DOCX bergambar asli tersedia lokal untuk dikirim pengguna kepada dosen. Tidak dimasukkan ke commit karena identitas pada gambar belum dikonfirmasi sebagai data fiktif; perubahan skrip dan catatan dicatat terpisah. Pemeriksaan mencakup kecocokan hash seluruh gambar tertanam dengan sumber, paket Word, dan rujukan lokal. Pratinjau cetak Word belum tersedia karena hambatan ekspor lingkungan yang tercatat di atas.
