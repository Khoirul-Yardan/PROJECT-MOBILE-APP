# Alur Sistem AI Hub — 19 Oktober 2026

Alur berikut merangkum implementasi lokal dan batas hasil uji. Diagram snapshot 5 Oktober dipertahankan di [arsip/diagram-alur.md](arsip/diagram-alur.md). Panah menunjukkan urutan proses, bukan bukti setiap langkah telah lulus uji perangkat.

## Bot BPJS — inti PA

1. Perawat membuka sesi dan merekam percakapan perawat–pasien.
2. Audio diproses STT/diarization AssemblyAI; peran ditafsirkan berdasarkan konteks sesi dan dapat dikoreksi.
3. Transkrip dipertahankan; LLM menyusun draf terstruktur.
4. Perawat memeriksa sumber dan menyunting draf, lalu menyimpan/mengekspor.
5. Dokter menerima dokumentasi dan memverifikasi **di luar aplikasi**.

Baseline evaluasi adalah STT saja; relabel LLM harus dicatat terpisah. LLM tidak menetapkan diagnosis.

## Anamnesis Terpandu — tambahan mandiri

1. Sistem membacakan satu pertanyaan TTS.
2. Pasien menjawab; STT mengubah jawaban menjadi teks.
3. Perawat memeriksa/koreksi tiap jawaban.
4. LLM menyusun draf; transkrip sumber dan koreksi tetap dapat ditelusuri.
5. Draf disimpan ke dokumentasi/riwayat.

Pertanyaan adalah suara sistem, bukan rekaman perawat. Implementasi tersedia; folder Progres 2 belum menunjukkan sesi Anamnesis lengkap.

## Papan Komunikasi — tambahan mandiri

1. Perawat membuka papan atau membuat ruangan dan tautan pasien/keluarga.
2. Pasien memilih ikon; khusus nyeri dapat memilih lokasi dan skala.
3. Pilihan dibacakan lewat TTS dan dicatat sebagai event.
4. Pada tautan, event dikirim ke pemilik ruangan melalui RPC yang dibatasi token; bukan akses bebas riwayat pasien.
5. Perawat memeriksa Catatan atau Dokumentasi & Riwayat, lalu menyalin informasi yang diperlukan.

Papan bukan STT, bukan penentu diagnosis/obat, dan bukan pengganti panggilan perawat resmi. TTS/pengiriman lintas perangkat perlu bukti uji langsung.

## VPN dan Terminal

Profil pengguna → pemeriksaan jangkauan/konfigurasi → negosiasi OpenVPN → tunnel aktif → koneksi SSH → prompt terminal. Uji 18 Oktober mencatat masalah cipher pada VPN dan timeout SSH ketika tunnel tidak aktif. Shell asli baru diuji sampai prompt.

## Admin

Login admin → sesi cookie → dashboard/akun/metadata/maintenance/pengumuman/audit/status. Service key tetap di server; akses tabel pasien hanya metadata sesuai daftar kolom. Tidak ada alur rekam atau verifikasi dokter di panel.
