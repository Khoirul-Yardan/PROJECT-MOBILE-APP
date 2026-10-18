# KEPUTUSAN — catatan fungsi baru/berubah dan alasannya

Proyek fleksibel mengikuti dokumentasi dan kejelasan kebutuhan. Setiap fungsi yang ditambah atau diubah arah dicatat di sini (satu entri, paling atas terbaru) agar laporan PA tetap konsisten. Garis keras ada di `AGENTS.md` §2.

Format:
```
## K-001 — <judul>  (tanggal, agen)
- Apa:
- Dasar (dokumen/sumber/temuan uji):
- Dampak ke judul PA dan evaluasi:
- Posisi di laporan: inti | pendukung | pengembangan lanjutan
```

## K-004 — Panel Admin web (18 Okt 2026, Claude, atas permintaan pengguna)
- Apa: layanan `admin/` (port 8095, satu compose dengan web/relay) untuk CRUD bot, provider, pengumuman, pengaturan, profil; mode maintenance dengan notifikasi; manajemen akun; penelusuran data. Tabel baru `app_settings`, `announcements`, `remote_bots`, `remote_providers`, `admin_audit_log` (`app/supabase/schema-admin.sql`). Sisi aplikasi: `web/public/remote-config.js`.
- Dasar: kebutuhan operasional (ubah sistem tanpa rilis APK / tanpa buka Supabase). Detail: `docs/PANEL-ADMIN.md`.
- Keputusan privasi: service key melewati RLS, jadi tabel data pasien dibuka hanya sebagai metadata read-only (kolom isi tidak pernah di-select); tidak ada editor SQL bebas; RLS tabel lama tidak diubah. Tabel baru: pengguna hanya SELECT.
- Dampak ke PA: tidak mengubah pipeline Bot BPJS/metrik. Admin bukan antarmuka dokter dan tidak menampilkan isi dokumentasi (selaras K-003). Sisi evaluasi: tidak ada.
- Posisi di laporan: pendukung (operasional/pengelolaan sistem).

## K-003 — Verifikasi dokter dilakukan di luar aplikasi (17 Okt 2026, keputusan pengguna)
- Apa: tidak ada antarmuka verifikasi dokter (FR-08–FR-10 PRD PA) di aplikasi. Perawat mengedit draf, lalu mengirim PDF/DOCX/teks ke dokter lewat kanal yang sudah dipakai; dokter memverifikasi di luar aplikasi.
- Dasar: review-dokter-berbasis-akun dihapus karena mewajibkan dokter punya akun dan menghambat pemakaian (PRD-INTI §9). Dokumen ekspor sudah memuat catatan bahwa draf perlu diverifikasi dokter (`bpjs_service.dart`).
- Dampak ke PA: FR-08–FR-10 tidak diimplementasikan; harus dinyatakan sebagai batasan/keputusan desain di laporan (teks usulan di `docs/PEMETAAN-SPEECH-KE-SISTEM.md` §B). Auditabilitas tetap lewat transkrip asli + draf yang bisa diedit.
- Posisi di laporan: batasan sistem.

## K-001 — Preflight jangkauan server OpenVPN (17 Okt 2026, Claude)
- Apa: sebelum mesin OpenVPN dijalankan, aplikasi mencoba koneksi TCP ke tiap `remote` (`app/lib/services/ovpn_remote.dart`, `vpn_tunnel_service.dart`). Gagal → pesan jelas "server tidak terjangkau dari jaringan ini, bukan masalah login".
- Dasar: tes asli hanya berhasil di laptop pengguna (OpenVPN + Termius); dugaan server hanya menerima dari jaringan tertentu. Belum terbukti, preflight ini membuat dugaan itu terlihat.
- Dampak ke PA: tidak ada (fitur pendukung VPN).
- Posisi di laporan: pendukung.

## K-002 — Prompt relabel pembicara (17 Okt 2026, Claude)
- Apa: `relabelSpeakers()` diberi aturan untuk perawat yang mengulang/konfirmasi, pasien yang bertanya balik, jawaban sangat pendek (kasus S2, S5).
- Dasar: `docs/SPEECH-PERAWAT-DOKTER-DAN-KESELARASAN-JUDUL.md` §3, `docs/PENGUJIAN-SPEECH-REALISTIS.md`.
- Dampak ke PA: memengaruhi akurasi diarization; ukur ulang sebelum/sesudah dengan skenario yang sama (belum dilakukan).
- Posisi di laporan: inti (pipeline Bot BPJS).

## K-000 — Pemetaan 9 jenis komunikasi (17 Okt 2026, Claude)
- Apa: `docs/PEMETAAN-SPEECH-KE-SISTEM.md`; #1, #2 inti, #4 #6 #7 #8 pendukung, #3 #5 ditunda, #9 di luar scope.
- Dasar: dokumen "Dokumentasi macam speech perawat dan pasien" (Drive, Doku Konsep).
- Dampak: evaluasi WER hanya untuk #1–#2.
- Posisi di laporan: lihat pemetaan.
