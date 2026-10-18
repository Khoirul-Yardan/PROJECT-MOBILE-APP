# 05 — Pengujian yang butuh HP atau emulator (paling akhir)

> **Status dokumentasi — 19 Oktober 2026:** Checklist berlanjut setelah uji 18 Oktober: VPN asli pada Wi-Fi dan SSH sampai prompt sudah dibuktikan. Seluler, sesi Anamnesis lengkap, dan papan lintas perangkat tetap perlu uji; gambar tidak membuktikan keluaran suara.

Semua uji di Docker sudah selesai (lihat README). Yang tersisa hanya bisa dilakukan di perangkat. Urutan disusun dari yang paling menentukan.

Persiapan umum: `cd web && docker compose up -d --build`; HP via USB: `adb reverse tcp:8090 tcp:8090`; `cd app && flutter run`. Untuk emulator Android, host laptop adalah `10.0.2.2`; untuk HP fisik di Wi-Fi yang sama, IP LAN laptop.

| # | Uji | Langkah | Yang diperiksa | Hasil (isi) |
|---|---|---|---|---|
| 1 | **Perbaikan A-001: rekaman tidak hilang** | Mulai Bot BPJS, rekam 20 detik, matikan internet HP, hentikan rekaman | Muncul galat dengan keterangan rekaman disimpan dan tombol **Proses ulang rekaman**; nyalakan internet, tekan tombol: transkrip dan draf muncul | |
| 2 | Bot BPJS normal | Rekam percakapan fiktif perawat-pasien, hentikan | Transkrip dua pembicara, draf bisa diedit, salin teks, ekspor PDF dan DOCX terbuka dan isinya sama dengan yang diedit | |
| 3 | Izin mikrofon | Cabut izin mikrofon lalu coba rekam | Pesan jelas, tidak crash | |
| 4 | **VPN asli: diagnosa laptop** | Di laptop: `powershell -ExecutionPolicy Bypass -File ".\TEST VPN\diagnosa-laptop.ps1" -SshHost <IP SSH>` sebelum dan sesudah OpenVPN tersambung | Server terjangkau atau tidak, adapter VPN, port SSH. Tempel hasil ke Claude (tanpa isi `.ovpn`) | |
| 5 | **VPN asli di HP** | Impor profil asli di aplikasi, tekan Connect, di jaringan yang sama dengan laptop yang berhasil, lalu di jaringan seluler | Jika gagal: apakah pesannya "Server VPN tidak terjangkau dari jaringan perangkat ini" (preflight) atau galat login/handshake; catat teks galat tanpa alamat/kredensial | Wi-Fi lulus 18 Oktober setelah perbaikan cipher; seluler belum |
| 6 | VPN tiruan di emulator | `PUBLIC_HOST=10.0.2.2 docker compose up -d --build` di `TEST VPN/docker`, impor `out/kp-la-test.ovpn`; login `tester`/`tester123`, password key `keypass123` | Status terhubung | |
| 7 | Terminal SSH lewat VPN | Setelah terhubung VPN, buka Terminal di aplikasi, isi host SSH | Shell terbuka; bandingkan dengan Termius | Lulus sampai prompt pada server asli, 18 Oktober; perintah belum diuji |
| 8 | WireGuard tiruan di HP | `docker compose up` di `TEST VPN/wireguard`, impor konfigurasi klien | Terhubung, trafik lewat tunnel | |
| 9 | Anamnesis Terpandu | Jalankan satu sesi: suara asisten, jawab lewat suara, koreksi | TTS terdengar, STT menangkap jawaban, draf form terisi | |
| 10 | Papan Komunikasi | Ketuk ikon (Nyeri, Sesak, Panggil Suster), buat ruangan, buka tautan dari HP lain | Suara keluar cepat dan jelas (kecepatan sesuai engine/perangkat; fallback browser saat ini 1,05), event tercatat, pesan dari tautan masuk ke perawat | |
| 11 | Riwayat gabungan | Buka Riwayat setelah uji 2, 9, 10 | Ketiganya muncul, bisa dicari dan dibuka | |
| 12 | Kontras dan ukuran teks | Lihat layar 320 dan 390 px, mode terang | Tidak terpotong | |

Catat hasil di kolom terakhir dan kirim ke Claude; temuan akan masuk `docs/DAFTAR-BUG.md`.
