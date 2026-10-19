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


## K-005 — Penyederhanaan dan deployment admin (18 Oktober 2026; dicatat 19 Oktober, Codex)
- Apa: keluarkan katalog Bot/Provider/Pengaturan dari panel; akun/profil umum tanpa pemilih peran; pertahankan maintenance, pengumuman, metadata, audit/status. Deploy admin dan web ke Fly sesuai HANDOFF 18 Oktober.
- Dasar: permintaan pengguna dan hasil implementasi/uji yang sudah tercatat; pencatatan ini tidak membuat deployment baru.
- Dampak: operasional saja, tanpa perubahan pipeline PA atau pelonggaran RLS. Metadata pasien tetap tanpa isi klinis.
- Posisi di laporan: pendukung. K-004 adalah riwayat rancangan awal, bukan cakupan panel terkini.

## K-006 — Pelaporan dua tambahan mandiri dan pemisahan dokumen (19 Oktober 2026, Codex)
- Apa: melaporkan Papan Komunikasi dan Anamnesis Terpandu sebagai dua tambahan mandiri berdasarkan pengajuan 15 Oktober; pengguna menyatakan dosen belum menjawab. Tidak menyatakan persetujuan pembimbing atau validasi klinis.
- Dasar: permintaan pengguna dan konfirmasi langsung nama dua tambahan dalam percakapan ini, dokumen pengajuan lama, kode lokal, 21 gambar Progres 2, dan catatan hasil uji. Tidak ada fitur aplikasi baru pada tugas ini.
- Dampak ke PA: Bot BPJS tetap inti; suara pertanyaan Anamnesis adalah TTS sistem. Gambar riwayat menunjukkan nol sesi Anamnesis; evaluasi baseline/proposed masih perlu data terukur. Dokter meninjau di luar aplikasi.
- Penataan: enam Word lama di `docs/word`; non-Word tetap di lokasi stabil dengan indeks/status. Laporan baru berada di `Dokumentasi/Progres 2/progres 2 Try and error sistem.docx`. Identitas/alamat pada gambar laporan disamarkan tanpa mengubah sumber asli.
- Posisi di laporan: perkembangan prototipe dan batas pengujian, bukan kesimpulan efektivitas klinis.

## K-007 — Mastra/Gemini sebagai agent Chat lokal (19 Oktober 2026, Codex, permintaan pengguna)
- Apa: proyek `mastra-test`, profil Docker opsional, provider/agent baru di Chat, discovery tools Mastra, dan pemetaan tools menurut endpoint/model provider. README mencakup pengujian HP lewat USB dan batas HTTPS LAN.
- Dasar: permintaan langsung pengguna; dokumentasi resmi Mastra, OpenAI, Google, Anthropic, OpenRouter; tes adapter/browser dengan fixture. Rujukan dan batas dukungan ada di `docs/MASTRA.md`.
- Arsitektur: tambahan server Mastra lokal hanya untuk koneksi agent yang dipilih pengguna. Key Google berasal dari permintaan pengguna, bukan key bersama; memory/traces Mastra dinonaktifkan. Supabase tetap backend akun/riwayat/RLS.
- Dampak ke PA: tidak mengubah Bot BPJS, STT/relabel, prompt dokumentasi klinis, WER, maupun eksperimen baseline/proposed; bukan diagnosis AI atau antarmuka dokter. Semua skenario pengujian fiktif.
- Posisi di laporan: pendukung hub AI dan eksperimen integrasi. Belum deployment produksi, bukan bukti peningkatan hasil evaluasi PA.

## K-008 — Mastra sebagai koneksi agent satu kode (20 Oktober 2026, Codex)
- Apa: setup baru menerima kode `aihub-mastra-v1.` berisi endpoint, agent ID, dan token akses agent; discovery terautentikasi membaca nama/provider/model dari server. Provider/model dipilih pemilik Mastra, bukan dipaksa Gemini oleh AI Hub. Format tersimpan baru `mastra-agent`; koneksi BYOK lama tetap kompatibel.
- Dasar: koreksi dan permintaan langsung pengguna untuk agent pihak ketiga dengan provider bebas, satu input, serta dokumentasi jelas; API route pada paket Mastra terpasang dan pengujian fixture. Kontrak lengkap di `docs/MASTRA-KONEKSI.md`.
- Batas: kode ini format AI Hub, bukan token universal Mastra. Pemilik server perlu adapter; provider yang tidak diumumkan tidak ditebak. Contoh server tetap Gemini. Base64url bukan enkripsi; token agent disimpan melalui mekanisme kredensial terenkripsi/RLS yang ada. Metadata server merupakan deklarasi, bukan attestasi.
- Dampak ke PA: hanya pendukung Chat umum. Tidak mengubah Bot BPJS, STT/relabel, diagnosis, verifikasi dokter, skema/RLS, atau evaluasi baseline/proposed. Server contoh tidak memakai memory/traces bersama; pengujian memakai data fiktif.

## K-009 — Setup Agent satu input dengan isian bertahap (20 Oktober 2026, Codex)
- Apa: mengganti deretan kartu Mastra/Hermes/OpenClaw dengan satu input API key, token, URL, atau kode koneksi. Status deteksi dan kolom yang kurang muncul setelah input/pilihan jenis; data pemeriksaan Mastra dibatalkan jika input berubah.
- Dasar: permintaan pengguna agar setup sebersih Provider AI. Token umum tidak cukup untuk membuktikan identitas agent, sehingga jenis yang tidak dikenal dipilih pengguna; status pola/pilihan/hasil discovery dibedakan.
- Dampak ke PA: penyederhanaan UI hub AI umum saja; tidak mengubah pipeline STT/LLM dokumentasi, skema/RLS, atau evaluasi PA. Kontrak Mastra satu kode tetap berlaku.

## K-010 — Daftar pengenal key dan koreksi protokol agent (20 Oktober 2026, Codex)
- Apa: tambah daftar pola key pada setup Agent; batasi OpenAI ke pola sk-proj (sk- umum ambigu dengan DeepSeek), pisahkan OAuth Claude dari API key, jelaskan Nous Portal vs Hermes Agent. Tambah pilihan HTTP resmi OpenClaw dengan chat completions dan target openclaw/default; webhook lama dipertahankan sebagai jalur khusus.
- Dasar: permintaan pengguna, dokumentasi resmi Mastra Auth, Hermes API Server/A2A, OpenClaw Gateway HTTP, DeepSeek API/integrasi, dan Gemini API keys. Ringkasan sumber dan matriks dukungan ada di docs/AGENT-KOMPATIBILITAS.md. Pengguna mengarahkan harness/DeepSeek lain dicatat dahulu, implementasi berfokus pada yang sudah ada.
- Bukti: fixture deteksi/kontrak/UI lulus; uji nyata akun yang ditunjuk pengguna berhasil login, menyimpan koneksi, discovery 200, chat Mastra+Gemini 2.5 Flash 200, jawaban hitungan fiktif 42 terlihat. Credential sementara login dibersihkan; provider key/token agent berada di .env lokal yang diabaikan Git.
- Dampak ke PA: pendukung Chat umum; tidak mengubah pipeline dokumentasi, RLS, evaluasi, atau peran dokter. Uji memakai hitungan fiktif tanpa data pasien. Tidak mengklaim semua harness atau semua token dapat dikenali otomatis.
