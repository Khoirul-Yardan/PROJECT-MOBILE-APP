# Implementasi desain — 3 Oktober 2026

Acuan: [desain.md](desain.md). Perubahan ini melanjutkan Beranda, Bot, Pengaturan, dan rancangan state Chat yang sudah berada di working tree.

## Sudah diterapkan

- Token warna netral/biru solid, font sistem, permukaan tanpa dekorasi gradien, fokus keyboard, kontrol utama 48 px, serta tema/widget Flutter yang sejalan.
- Navigasi Beranda, Chat, Bot, VPN, Pengaturan; riwayat BPJS mengaktifkan Bot. Navigasi bawah diukur untuk padding konten, sidebar digunakan mulai 840 px. Shell tetap menggunakan satu navigasi web.
- Beranda berfokus pada tugas, status layanan aktual, dan aktivitas. Bot menjelaskan keterbatasan browser. Pengaturan berupa kelompok daftar.
- Chat disimpan di memori modul selama sesi halaman: pesan, input, instruksi, request berjalan, dan pilihan layanan bertahan saat pindah tab. Konteks terpisah per layanan; reset saat akun berubah. Refresh tetap menghapus chat. Retry memakai request semula, tanpa menambah pesan pengguna duplikat. Menu perintah tidak menimpa input; hapus percakapan memerlukan konfirmasi. Respons tidak memaksa scroll ketika pengguna membaca bagian lama.
- Provider/agent berlabel Tersimpan, key disamarkan, pilihan katalog ditinjau sebelum simpan, endpoint/model standar tersedia pada pengaturan lanjutan. Hapus memerlukan konfirmasi. Gagal muat/simpan dibedakan dari data kosong.
- Login mendukung submit form, status pendaftaran/masuk, dan panel konfirmasi email. Keluar memberi peringatan atas Chat sementara dan membersihkan state akun.
- Riwayat BPJS memiliki pencarian pasien/dokter dan filter status. Detail mempertahankan filter saat kembali dan mendukung kembali browser. Isi dinamis di-escape. Status legacy `terkirim` diberi keterangan konservatif. Salin tidak mengubah status menjadi terkirim.
- Persiapan BPJS native menggunakan satu form. Identitas tetap ada setelah izin ditolak. Tidak ada janji wake word atau waveform buatan. Status mikrofon mengikuti STT; timer menghitung waktu mikrofon aktif. Ketika STT berhenti, pengguna dapat memproses hasil yang tersedia. Latar belakang menghentikan capture; kembali dari rekaman menghentikan capture sebelum pilihan proses/buang.
- Draf native menunjukkan identitas, urutan bagian, transkrip, sumber, serta label AI atau transkrip mentah. Kegagalan penyimpanan ditampilkan dan hasil tetap dapat disalin/diekspor dari layar. Repository tidak lagi menelan kegagalan penyimpanan.
- Ekspor memiliki pilihan PDF/DOCX, ringkasan pasien/tujuan, label draf/transkrip mentah, sumber penyusun, referensi sesi, nama file tanpa pasien, dan footer referensi/nomor halaman PDF. Salin/ekspor tidak menulis status `terkirim` baru.
- VPN browser tidak mensimulasikan tunnel aktif. OpenVPN/SSH tetap konfigurasi saja. Query status native menggunakan `isConnected()`, termasuk setelah resume; hasil tidak diketahui ditampilkan eksplisit. Penggantian server menjelaskan pemutusan koneksi. Form mempertahankan isian ketika protokol berganti dan menyediakan alamat interface WireGuard.

## Validasi otomatis

- `python web/tests/ui_smoke.py`: fixture lokal tanpa Supabase/provider nyata; 12 rute × lebar 320, 360, 390, 768, 1024. Meliputi overflow, navigasi, posisi composer, retensi/isolasi/retry/reset Chat, filter dan status BPJS, escaping, form VPN, peninjauan provider, serta state kosong/gagal.
- `flutter test --no-pub`: identitas wajib sebelum rekam, pembesaran teks, isian tetap setelah izin ditolak, splash, serta pembedaan label ekspor AI/transkrip mentah.
- `dart analyze --fatal-infos`: pemeriksaan statis Flutter.
- Screenshot fixture dihasilkan oleh smoke test ke direktori temporer; bukan bukti layanan produksi atau hasil pengguna nyata.

## Belum menjadi kemampuan yang dijanjikan

- Penyimpanan Chat lintas refresh/restart, sinkronisasi chat, uji koneksi provider berbayar, streaming/cancellation, dan pemilih layanan berbentuk sheet pencarian khusus.
- Pemilihan provider native sebelum rekam, diarization, pemutar audio, editing draf dengan versi, serta retry AI/sinkronisasi idempoten. STT yang berhenti tidak otomatis direstart tanpa batas; proses hasil yang tersedia atau mulai sesi baru.
- Event ekspor terpisah beserta migrasi database. Baris legacy tetap konservatif; aktivitas salin/ekspor baru belum menjadi riwayat event tersendiri.
- Membuka sesi historis melalui deep link native untuk PDF/DOCX; riwayat web hanya menyediakan salin teks.
- Header/footer nomor halaman DOCX, pemulihan hasil setelah aplikasi ditutup, dan penyimpanan offline terlindungi.

## Masih memerlukan perangkat/pengujian manual

Rekaman panjang dan interupsi telepon, izin OS sebenarnya, background/resume, share sheet batal/berhasil, PDF multi-halaman panjang dan DOCX di aplikasi pembaca, WireGuard ke server nyata, safe area/keyboard/landscape WebView, zoom browser, TalkBack/VoiceOver, serta evaluasi pengguna pada bagian 16 desain. Kelulusan tes otomatis tidak menandai seluruh checklist WCAG atau penerimaan perangkat selesai.
