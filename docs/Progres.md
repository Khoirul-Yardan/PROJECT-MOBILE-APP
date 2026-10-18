# Progres AI Hub — dari dokumentasi awal sampai Progres 2

Diselaraskan 19 Oktober 2026. Catatan panjang versi sebelumnya dipertahankan di [arsip/Progres.md](arsip/Progres.md). Tabel ini membedakan rencana, implementasi, dan hasil uji; tanggal mengikuti sumber tertulis, bukan tebakan dari nama gambar.

| Tahap / tanggal sumber | Perkembangan | Status dan sumber |
|---|---|---|
| Konsep awal, September 2026 | Kelayakan hub AI, hybrid, API/provider, peran native/web | Kajian historis `Kemungkinan-Pembangunan-Sistem.md`; bukan daftar fitur aktif |
| 2–5 Oktober | Desain dan implementasi UI hybrid, penyederhanaan BPJS | `desain.md`, `IMPLEMENTASI-DESAIN.md`, `ui-preview/`; snapshot lama di `arsip/` |
| Progres 1 | Dokumentasi gambar BPJS (STT, ringkasan, perbandingan, tukar peran), chat, VPN dan terminal | 16 gambar di `Dokumentasi/Progres 1`; tanggal setiap pengambilan tidak ditetapkan hanya dari nama berkas |
| 14 Oktober | Uji Docker/web, server VPN/SSH tiruan, penanganan galat chat | `ujitest dan dokumentasi.md`; percobaan provider nyata terhambat kuota, jalur sukses chat memakai simulasi |
| 15–16 Oktober | Pengajuan pilihan speech dan bahan diskusi 9 bentuk komunikasi | Word pada `word/pengajuan` dan `word/referensi`; dua tambahan: Papan Komunikasi + Anamnesis Terpandu |
| 17 Oktober | Uji web/relay, RLS tiruan, Flutter; audit BPJS dan relabel | `pengujian-minggu-ini/`, `DAFTAR-BUG.md`, K-002; bukan bukti seluruh alur native lulus |
| 18 Oktober | OpenVPN asli berhasil setelah kompatibilitas cipher; SSH asli sampai prompt | `hasil percobaan vpn dan terminal asli.md`; Wi-Fi tertentu, belum jaringan seluler/stabilitas panjang |
| 18 Oktober | Panel admin disederhanakan, deploy web/admin Fly, uji desktop dan HP | `HANDOFF.md`, `PANEL-ADMIN.md`; katalog dan pilihan peran dihapus dari panel |
| Progres 2, dirangkum 19 Oktober | Papan, ruangan, catatan, riwayat gabungan, admin, bukti gagal/berhasil VPN dan terminal | 21 gambar di `Dokumentasi/Progres 2`; laporan Word baru memakai gambar tersebut |

## Posisi penambahan mandiri

Pengguna menyatakan jawaban dosen atas pengajuan speech belum diterima. Dua tambahan dicatat sebagai implementasi mandiri untuk dibahas, bukan persetujuan pembimbing. Papan mendukung komunikasi dengan pilihan ikon/TTS; Anamnesis memakai pertanyaan sistem/TTS dan jawaban pasien/STT. Inti PA tetap dokumentasi percakapan perawat–pasien pada Bot BPJS. Verifikasi dokter di luar aplikasi; LLM tidak menetapkan diagnosis.

## Ringkasan hasil Progres 2

- Gambar memperlihatkan papan, catatan bertimestamp, ruangan/tautan, serta pencarian/filter riwayat.
- Riwayat pada gambar berisi 7 entri: BPJS 4, Anamnesis 0, Papan 3. Angka ini hanya inventaris pada saat gambar diambil.
- OpenVPN pernah gagal dengan pesan login yang menyesatkan; catatan uji mengaitkan keberhasilan dengan penambahan cipher CBC dalam negosiasi. Terminal timeout ketika VPN tidak aktif, lalu berhasil membuka prompt setelah VPN disambungkan.
- Admin menyediakan pemantauan operasional dan metadata; bukan akses isi dokumentasi pasien atau antarmuka dokter.
- Screenshot tidak membuktikan keluaran suara, ketepatan STT, kelengkapan LLM, real-time lintas perangkat, atau keberhasilan sesi Anamnesis penuh.

## Pekerjaan berikutnya

| Prioritas | Pekerjaan | Kriteria bukti |
|---|---|---|
| 1 | Diskusikan dua tambahan dan batas TTS dengan dosen | Keputusan tertulis; tanggal/respons asli dicatat saat diterima |
| 2 | Uji BPJS fiktif dari rekam sampai ekspor | Audio + acuan manual + transkrip + draf + koreksi + berkas ekspor |
| 3 | Uji Anamnesis lengkap | Pertanyaan TTS, jawaban STT, koreksi, penyimpanan, muncul di riwayat |
| 4 | Uji papan pada dua perangkat | TTS terdengar, event diterima pemilik, link nonaktif ditolak, jaringan putus tertangani |
| 5 | Evaluasi baseline/proposed | WER dan penilaian isi/waktu dengan kondisi serta versi yang dicatat |
| 6 | Uji jaringan dan perbaikan pesan galat | VPN seluler/stabilitas; pesan kegagalan tidak otomatis menyalahkan password |

Laporan: [progres 2 Try and error sistem.docx](<../Dokumentasi/Progres 2/progres 2 Try and error sistem.docx>). Indeks keseluruhan: [README.md](README.md).
