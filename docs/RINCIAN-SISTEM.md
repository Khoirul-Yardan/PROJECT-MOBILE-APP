# Rincian Sistem AI Hub — status 19 Oktober 2026

Ringkasan ini menggantikan snapshot 5 Oktober yang disimpan di [arsip/RINCIAN-SISTEM.md](arsip/RINCIAN-SISTEM.md). Dasar: kode lokal, [hasil uji perangkat 18 Oktober](<hasil percobaan vpn dan terminal asli.md>), [HANDOFF](HANDOFF.md), serta 21 gambar `Dokumentasi/Progres 2`. Tidak ada pengujian aplikasi baru dalam pekerjaan penyusunan laporan ini.

## 1. Tujuan dan batas sistem

Inti PA adalah dokumentasi **percakapan perawat–pasien**: audio → STT dan diarization → draf LLM → pemeriksaan perawat → ekspor untuk dokter. LLM mengekstrak dan merangkum; tidak menetapkan diagnosis atau obat. Transkrip asli harus tetap dapat ditelusuri. Verifikasi dokter berlangsung di luar aplikasi (K-003); tidak ada akun/antarmuka verifikasi dokter.

Papan Komunikasi dan Anamnesis Terpandu merupakan dua tambahan yang dipilih dalam dokumen pengajuan 15 Oktober. Menurut pengguna pada 19 Oktober, jawaban dosen masih belum diterima dan keduanya ditambahkan secara mandiri. Kata “inti” pada pengajuan lama berarti prioritas pengembangan tambahan, bukan pengganti objek utama evaluasi PA.

## 2. Modul dan batas pembuktiannya

| Modul | Kondisi implementasi | Bukti dan batas |
|---|---|---|
| Bot BPJS | Rekam native, AssemblyAI, diarization/relabel konteks, draf LLM, edit, ekspor | Kode native dan dokumen perbandingan; Progres 2 menampilkan 4 entri BPJS. Jumlah entri bukan bukti akurasi atau kelulusan rekam sampai ekspor |
| Papan Komunikasi | 11 pilihan, TTS, lokasi/skala nyeri, catatan, ruangan dan tautan, riwayat gabungan | Kode web dan gambar papan/catatan/ruangan. Suara, pengiriman lintas perangkat, dan latensi perlu uji langsung |
| Anamnesis Terpandu | 7 pertanyaan TTS, jawaban suara/STT, koreksi, draf dan penyimpanan | `app/lib/screens/anamnesis_terpandu_screen.dart`. Riwayat Progres 2 menunjukkan 0 sesi Anamnesis; belum ada bukti sesi lengkap pada folder ini |
| Dokumentasi & Riwayat | Pencarian/filter Bot BPJS, Anamnesis, Papan | Gambar berisi 7 entri: 4 BPJS, 0 Anamnesis, 3 Papan; kondisi satu tangkapan layar |
| Chat/API & Agent | BYOK, pemilih model, riwayat, integrasi provider/agent | Panduan teknis dan catatan uji lama; tidak diuji ulang pada penyusunan Progres 2 |
| OpenVPN | Tunnel native; kompatibilitas cipher CBC ditambahkan | Uji 18 Oktober berhasil pada HP di Wi-Fi yang sama dengan laptop; seluler/stabilitas panjang belum dibuktikan |
| Terminal SSH | Login SSH melalui koneksi jaringan/VPN | Server asli terbuka sampai prompt; perintah di server asli tidak diuji |
| WireGuard | Implementasi native; hasil uji server tiruan tersedia | Tidak disamakan dengan kelulusan server asli di HP |
| Panel Admin | Akun/profil umum, metadata, maintenance, pengumuman, audit, status | Uji fixture, Fly desktop, dan Chrome HP tercatat di HANDOFF. Bukan peninjauan diagnosis |

## 3. Arsitektur dan data

- `app/`: shell Flutter, satu WebView persisten, mikrofon, perekaman, TTS native, VPN, secure storage, layar BPJS/Anamnesis.
- `web/public/`: SPA vanilla JS untuk halaman umum, papan, dokumentasi/riwayat, dan pengaturan.
- `web/relay/`: relay untuk integrasi yang memerlukan perantara (termasuk jalur AssemblyAI dengan kunci bersama). Karena itu pernyataan lama “semua API tanpa perantara” tidak berlaku untuk seluruh jalur.
- Supabase: Auth, Postgres, RLS, Realtime. Sesi/transkrip/draf memakai `bpjs_sessions`, `bpjs_transcripts`, `bpjs_documents`; papan memakai `komunikasi_events`, `komunikasi_rooms`.
- `admin/`: layanan Node terpisah; service key hanya di server. Resource pasien hanya metadata read-only dengan daftar kolom eksplisit. RLS pemilik data tetap berlaku pada aplikasi.
- Deploy tercatat 18 Oktober: web dan relay pada aplikasi Fly `ai-hub-web`; admin pada `ai-hub-admin`. Ini riwayat deployment, bukan pemeriksaan uptime saat dokumen dibaca.

## 4. Penjelasan speech dan TTS

Pada Bot BPJS, yang direkam adalah percakapan perawat–pasien. Peran pembicara ditetapkan dari konteks sesi, bukan identifikasi biometrik. Pada Anamnesis, suara yang mengajukan pertanyaan adalah **suara sistem TTS**, bukan rekaman perawat. Pada Papan, suara berasal dari teks pilihan pasien; bukan STT dan bukan jawaban AI. “Minta obat” adalah penyampaian permintaan, bukan rekomendasi obat otomatis.

Wake word, balasan suara Bot BPJS, Friend System, dan review dokter berbasis akun tetap dihapus. TTS pada Papan dan Anamnesis adalah fungsi yang berbeda dan tersedia di kode.

## 5. Status admin terbaru

Katalog Bot, Provider AI, dan Pengaturan generik telah dikeluarkan dari panel. Akun/profil tidak menawarkan pilihan peran. Tabel lama atau pembacaan konfigurasi di aplikasi tidak otomatis dihapus. Maintenance dan Pengumuman tetap ada. Admin menampilkan ID/status/waktu/provider sebagai metadata, bukan isi transkrip/ringkasan. Lihat [PANEL-ADMIN.md](PANEL-ADMIN.md).

## 6. Evaluasi yang masih diperlukan

Baseline STT saja dibanding proposed STT + LLM pada audio yang sama, dengan transkrip acuan manual: WER, kelengkapan, kesesuaian isi, factual consistency, dan waktu proses. Catat relabel otomatis/koreksi manual terpisah agar baseline tidak diam-diam mencakup LLM. Papan dinilai secara fungsional; Anamnesis dinilai sebagai modul tambahan dengan sumber pertanyaan TTS dijelaskan. Belum ada angka evaluasi baru yang dapat diambil dari screenshot Progres 2.

Rincian tindak lanjut: [PENGUJIAN-SPEECH-REALISTIS.md](PENGUJIAN-SPEECH-REALISTIS.md), [DAFTAR-BUG.md](DAFTAR-BUG.md), dan [Progres.md](Progres.md).
