# Hasil percobaan VPN dan Terminal asli

Tanggal: 18 Oktober 2026. Perangkat: Infinix X6851 (Android, USB debugging). Laptop pembanding: Windows dengan OpenVPN Connect 3.11.3 dan Termius.

Ini pengujian pertama terhadap **server VPN asli** (profil `kp-la-2`) dan **server SSH asli di balik VPN**. Pengujian sebelumnya (`docs/pengujian-minggu-ini/02-vpn-docker.md`) hanya memakai server tiruan di Docker.

Yang sengaja tidak dicatat di sini: IP publik server VPN, IP dan username server SSH, kata sandi, dan isi `.ovpn`. Isi kredensial hanya dimasukkan pengguna sendiri; agen tidak membacanya. Terminal hanya dibuka sampai prompt; tidak ada perintah yang dijalankan di server.

## 1. Ringkasan

| Pertanyaan | Hasil |
|---|---|
| Apakah VPN asli bisa tersambung dari aplikasi di HP? | **Ya**, setelah perbaikan cipher (bagian 5). Sebelumnya selalu gagal. |
| Apakah penyebabnya username/password atau jaringan? | **Bukan.** Kredensial sama persis dengan laptop dan server terjangkau dari HP. |
| Penyebab sebenarnya | Mesin OpenVPN di aplikasi tidak mengiklankan cipher `AES-128-CBC`, sehingga server memutus koneksi tepat setelah verifikasi sertifikat. |
| Apakah Terminal SSH di aplikasi bisa masuk ke server asli lewat VPN? | **Ya.** Shell terbuka sampai prompt. Tanpa VPN, gagal dengan `Connection timed out (errno = 110)`, sesuai harapan. |
| Dugaan lama "server hanya terjangkau dari jaringan tertentu" | **Tidak berlaku** untuk jaringan ini (Wi-Fi yang sama dengan laptop). |

## 2. Kronologi percobaan

| No | Percobaan | Hasil | Bukti |
|---|---|---|---|
| 1 | Buka aplikasi di HP lewat adb | Layar hitam: HP terkunci dan layar mati | `mWakefulness=Dozing`, `isKeyguardShowing=true`. Pengguna membuka kunci sendiri; saya tidak menebak PIN. |
| 2 | Masuk ke aplikasi, buka tab VPN, tekan **Hubungkan VPN** (profil lama `OpenVPN`) | Gagal. Pesan: "Server menolak login (username/password) ... dihentikan agar tidak memicu pemblokiran" | Tahapan: `tcp_connect > wait_connection > authenticating > reconnect > tcp_connect`, berulang |
| 3 | Cek jaringan dari HP | Server terjangkau. HP dan laptop di Wi-Fi yang sama (`192.168.100.x`). Port 1194 menjawab dengan paket OpenVPN yang valid, tanpa tanda `tls-auth`/`tls-crypt`. Ping sekitar 7 ms | `nc` dari `adb shell`, `Test-NetConnection` dari laptop |
| 4 | Pengguna mengisi ulang username/password; saya tambah tombol **Tampilkan/Sembunyikan** di form VPN supaya salah ketik bisa dilihat | Tetap gagal, padahal semua cocok dengan laptop | Pengguna memverifikasi huruf demi huruf |
| 5 | Tambah log mesin OpenVPN ke logcat (tag `OvpnEngine`), coba sekali lagi | Sertifikat server lolos (`VERIFY OK`, `VERIFY KU OK`, `VERIFY EKU OK`). Sekitar 40 ms kemudian `Connection reset, restarting`. **Tidak ada** `AUTH_FAILED`, `TLS Error`, atau galat password key | Log `OvpnEngine` pada percobaan itu |
| 6 | Bandingkan dengan log OpenVPN Connect 3.11.3 di laptop (yang berhasil) | Laptop mengiklankan `IV_CIPHERS=AES-128-CBC:AES-192-CBC:AES-256-CBC:AES-128-GCM:...` dan server memilih `AES-128-CBC`/`SHA512`. Aplikasi hanya punya `ncp_ciphers = AES-256-GCM:AES-128-GCM`, plus catatan `--cipher set to 'AES-128-CBC' but missing in --data-ciphers` | Log laptop dan baris `ncp_ciphers` di log mesin HP |
| 7 | Perbaikan 1: tambah `ncp-disable` ke profil | Ditolak mesin: `Options error: Unrecognized option ... ncp-disable (2.5_master)` | Log `OvpnEngine` |
| 8 | Perbaikan 2: tambah `data-ciphers AES-128-CBC:AES-256-GCM:AES-128-GCM` | **Tersambung.** `PUSH_REPLY` diterima, `Outgoing/Incoming Data Channel: Cipher 'AES-128-CBC'`, `Initialization Sequence Completed`. `tun0` mendapat `10.0.1.124/24`. Dari HP: ping server SSH 0% loss, port 22 membalas banner SSH | Log `OvpnEngine`, `ip addr show tun0`, `ping`, `nc` |
| 9 | Terminal di aplikasi, **tanpa** VPN (VPN ternyata padam karena saya menjalankan `force-stop`) | Gagal: `SocketException: Connection timed out ... (errno = 110)` | Screenshot di HP; `tun0` tidak ada |
| 10 | Sambungkan VPN lagi, buka Terminal, tekan Hubungkan | **Shell terbuka** sampai prompt (login berhasil). Tidak ada perintah dijalankan | Screenshot terminal di HP |

## 3. Akar masalah

Server VPN adalah OpenVPN lama dengan `cipher AES-128-CBC`. Klien yang ikut negosiasi NCP hanya menawarkan AES-GCM akan ditolak. Mesin `ics-openvpn` 2.5 di aplikasi menawarkan hanya `AES-256-GCM:AES-128-GCM`, sedangkan OpenVPN Connect di laptop menawarkan juga CBC. Server lalu memutus koneksi (`connection-reset`) setelah handshake TLS, sebelum tahap login.

Pesan aplikasi "Server menolak login" berasal dari tebakan di `vpn_tunnel_service.dart`: stage yang mundur ke `tcp_connect` setelah `authenticating` dianggap login ditolak. Pada kasus ini tebakan itu salah dan menyesatkan.

Batas kepastian: isi konfigurasi server tidak terlihat. Penyebab di atas didukung oleh dua hal: log laptop vs HP berbeda tepat di daftar cipher, dan menambahkan CBC ke `data-ciphers` langsung membuat koneksi berhasil.

## 4. Pelajaran lain dari percobaan

- `force-stop` aplikasi mematikan layanan VPN. Saat menguji dari adb, jangan `force-stop` bila VPN harus tetap hidup.
- Profil VPN dan sesi login tersimpan per alamat web (penyimpanan lokal WebView). Pindah dari web Fly ke `localhost:8090` membuat login dan profil `kp-la-2` hilang; profil harus diimpor ulang.
- `adb reverse` terlepas bila USB terputus; halaman aplikasi lalu menampilkan `ERR_CONNECTION_REFUSED`.
- Profil memakai `redirect-gateway def1`, jadi saat VPN menyala semua trafik HP lewat server. Kualitas internet HP mengikuti kualitas server (pernah terukur loss 66% sesaat, lalu 0%).
- HP dan laptop memakai akun/sertifikat VPN yang sama dan mendapat IP tunnel yang sama (`10.0.1.124`). Bila server hanya mengizinkan satu sesi per akun, menyambungkan satu perangkat bisa memutus yang lain. **Belum terbukti.**

## 5. Perubahan kode

| File | Perubahan |
|---|---|
| `app/lib/services/vpn_tunnel_service.dart` | `withLegacyCipherCompat`: bila profil memakai `cipher ...-CBC` dan belum punya `data-ciphers`/`ncp-ciphers`, tambahkan `data-ciphers <CBC>:AES-256-GCM:AES-128-GCM` sebelum menyambung |
| `app/test/ovpn_cipher_compat_test.dart` | Tes baru: CBC mendapat `data-ciphers`; tidak ditambah dua kali; cipher AEAD dan profil tanpa cipher tidak diubah |
| `app/android/openvpn_library/.../VpnStatus.java` | Meneruskan log mesin OpenVPN ke logcat dengan tag `OvpnEngine` (sebelumnya hanya tersimpan di buffer internal). Hanya teks log mesin, bukan isi profil atau kredensial; memuat nama profil |
| `web/public/views/vpn-config.js` | Tombol **Tampilkan/Sembunyikan** di setiap kolom password (OpenVPN, password private key, SSH). File ini milik Codex; diubah atas permintaan pengguna |

Validasi: `flutter analyze --no-pub` hanya 5 info lama; tes baru lulus; `node --check` pada `vpn-config.js` lolos.

## 6. Belum diuji / belum dikerjakan

- Jaringan seluler (hanya Wi-Fi yang sama dengan laptop).
- WireGuard asli.
- Perintah di dalam shell SSH (hanya sampai prompt).
- Stabilitas jangka panjang dan dua perangkat tersambung bersamaan dengan akun yang sama.
- APK yang terpasang di HP adalah build lokal yang memuat web dari `localhost:8090`; bukan rilis yang memuat web dari Fly.
- Teks galat "Server menolak login" masih perlu diperbaiki supaya tidak menyalahkan kredensial tanpa bukti.

## 7. Dampak ke dokumen lain

- `docs/pengujian-minggu-ini/02-vpn-docker.md` menduga masalah VPN asli ada di jaringan atau izin server. Dugaan itu dibantah di sini.
- Checklist `05-perlu-hp-emulator.md` butir 5 (VPN asli di HP, Wi-Fi sama dengan laptop) dan butir 7 (Terminal SSH lewat VPN) terpenuhi pada Wi-Fi yang sama; jaringan seluler belum.
