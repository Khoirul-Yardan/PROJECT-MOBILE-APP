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
