# 03 — Database dan RLS (Postgres 16 di Docker)

Skema `app/supabase/schema.sql` + `migrasi_komunikasi_rooms.sql` dijalankan di Postgres 16 terpisah (port 55432, dihapus setelah selesai) dengan tiruan minimal skema `auth` Supabase (`auth.uid()`, `auth.role()`, peran `anon` dan `authenticated`). Supabase asli tidak disentuh. File: `app/supabase/tests/` (`rls_bootstrap.sql`, `rls_test.sql`, `run-rls-test.sh`).

Batasan: ini tiruan, bukan Supabase sungguhan. Perilaku PostgREST, Realtime, dan izin default Supabase hanya dimodelkan lewat `grant` ke `anon`/`authenticated` seperti default Supabase.

## Hasil: 31/31 lulus
- `schema.sql` dijalankan dua kali tanpa error (idempoten).
- **Akun A melihat datanya sendiri.**
- **Akun B tidak melihat** satu pun baris A di: `activity_log`, `bpjs_sessions`, `bpjs_transcripts`, `bpjs_documents`, `api_credentials`, `chat_messages`, `vpn_configs`, `komunikasi_events`, `komunikasi_rooms`.
- **Akun B tidak bisa** mengubah sesi A, menghapus kredensial A, menyisipkan transkrip ke sesi A, membuat sesi atas nama A, atau menanam kredensial di akun A.
- **Anon tidak melihat** `bpjs_sessions`, `bpjs_transcripts`, `api_credentials`, `komunikasi_events`, `komunikasi_rooms`, `profiles`, dan tidak bisa INSERT langsung ke `komunikasi_events`.
- **RPC Papan Komunikasi untuk anon:** token valid → nama ruangan dan pesan diterima; token palsu, jenis > 30 karakter, detail > 1000 karakter ditolak; anti-spam membatasi (19 dari 30 tambahan diterima, batas 20 per 10 detik per ruangan); pesan masuk ke akun pemilik ruangan; tautan yang dinonaktifkan ditolak.

## Catatan desain (bukan kegagalan)
- `profiles` terbaca oleh semua pengguna yang login (nama tampilan, peran, bio). Itu sisa dari pencarian pengguna; Friend System sudah dihapus, jadi kebijakan ini tidak lagi dibutuhkan. Rekomendasi: batasi ke pemilik sendiri, kecuali ada fitur yang memang perlu membaca profil orang lain. Tidak saya ubah (perubahan RLS butuh persetujuan Anda dan uji di Supabase asli).
- Token ruangan Papan Komunikasi adalah pengaman utama tautan pasien: siapa pun yang memegang tautan bisa mengirim pesan (dibatasi laju). Tautan sebaiknya mudah dinonaktifkan dan tidak dibagikan sembarangan.
