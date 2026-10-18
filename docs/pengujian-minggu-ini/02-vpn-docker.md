# 02 — VPN (server tiruan di Docker)

> **Status dokumentasi — 19 Oktober 2026:** Hasil server tiruan di bawah tetap berlaku untuk lingkungan uji tersebut. Dugaan tentang server asli telah diperbarui oleh [hasil 18 Oktober](<../hasil percobaan vpn dan terminal asli.md>): kompatibilitas cipher pada klien diperbaiki; bukan bukti password salah.

Server tiruan meniru profil asli `kp-la-2.ovpn`: TCP 1194, `dev tun`, AES-128-CBC, auth SHA512, `auth-user-pass`, private key terenkripsi (password key terpisah), `remote-cert-tls server`. Server asli tidak diakses.

## OpenVPN (`TEST VPN/docker`)
Dijalankan dengan `PUBLIC_HOST=127.0.0.1`, klien OpenVPN sungguhan di kontainer terpisah.

| Skenario | Harapan | Hasil |
|---|---|---|
| Kredensial benar | `Initialization Sequence Completed` + ping server | Terhubung (`tun0` 10.99.0.6), ping 2/2, 0% loss |
| Password login salah | `AUTH_FAILED` | `AUTH_FAILED` |
| Password private key salah | gagal memuat key | `private key password verification failed` |

## WireGuard + SSH (`TEST VPN/wireguard`)
`docker compose run --rm wg-client`:
- Handshake berhasil (`latest handshake: Now`), ping 3/3, 0% loss.
- SSH lewat tunnel dengan password benar: login `tester` berhasil.
- SSH dengan password salah: ditolak (benar).

## Preflight TCP OpenVPN (fitur baru, `ovpn_remote.dart`)
`app/test/ovpn_preflight_docker_test.dart` dengan `OVPN_FILE=../TEST VPN/docker/out/kp-la-test.ovpn`:
- Saat server tiruan hidup: remote terbaca (`127.0.0.1:1194/tcp`) dan probe berhasil. Lulus.
- Port tertutup (`127.0.0.1:1`): terdeteksi tidak terjangkau. Lulus.
- Remote UDP tidak diprobe (diserahkan ke mesin OpenVPN).
- Setelah pengujian, kontainer tiruan dihentikan; menjalankan tes ini tanpa server hidup akan gagal pada kasus pertama, itu wajar.

## Kesimpulan
Seluruh jalur OpenVPN dan WireGuard pada skenario tiruan bekerja. Ini menggeser dugaan: masalah VPN asli lebih mungkin soal **jaringan/izin akses server** (hanya terjangkau dari jaringan tertentu) atau kredensial/profil asli, bukan logika aplikasi. Belum terbukti.

## Yang masih perlu Anda lakukan
Jalankan `TEST VPN/diagnosa-laptop.ps1` di laptop (sebelum dan sesudah OpenVPN tersambung) dan tempel hasilnya; lalu uji di HP (lihat `05-perlu-hp-emulator.md`).
