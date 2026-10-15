# Uji VPN di Docker (tanpa membebani server asli)

`TEST VPN/docker/` berisi server OpenVPN **tiruan** yang meniru profil asli
(`kp-la-2.ovpn`) supaya uji coba tidak spam ke server produksi.

| Aspek | Profil asli | Server tiruan |
|---|---|---|
| Transport | tcp / 1194, `dev tun` | sama |
| Cipher / auth | `AES-128-CBC` / `SHA512` | sama |
| Login | `auth-user-pass` | sama (default `tester` / `tester123`) |
| Sertifikat klien | ada, private key **terenkripsi** | sama (password key `keypass123`) |
| Verifikasi server | `remote-cert-tls server` | sama |
| `reneg-sec`, `ping`, `user nobody` … | — | disalin persis |

PKI (CA, server, klien) dibuat sendiri di container pada start pertama dan
disimpan di volume `ovpn-pki`; tidak ada rahasia server asli di sini.

## Jalankan

```sh
cd "TEST VPN/docker"
# PUBLIC_HOST = alamat yang dilihat klien:
#   emulator Android -> 10.0.2.2 (default) | HP fisik -> IP LAN laptop | laptop -> 127.0.0.1
set PUBLIC_HOST=192.168.1.20      # (opsional; PowerShell: $env:PUBLIC_HOST="...")
docker compose up -d --build
```

Hasil: **`TEST VPN/docker/out/kp-la-test.ovpn`**. Impor file itu di aplikasi
(Pengaturan VPN → OpenVPN) dengan:

- Username `tester`, Password `tester123`
- Password private key `keypass123`

Ganti lewat env `VPN_USER`, `VPN_PASS`, `KEY_PASS` (hapus volume dengan
`docker compose down -v` bila `KEY_PASS` diganti, agar key dibuat ulang).
Di Windows, izinkan port 1194 di firewall bila HP fisik yang menyambung.

## Uji otomatis dari klien OpenVPN sungguhan

```sh
./test-client.sh                       # harus: Initialization Sequence Completed + ping 10.99.0.1 sukses
./test-client.sh tester salah          # harus: AUTH_FAILED
./test-client.sh tester tester123 x    # harus: private key password verification failed
```

Hasil uji pada 2026‑10‑13: ketiganya sesuai harapan (konek + ping 0% loss;
password salah ditolak; password key salah ditolak).

## Pindah ke server asli

Cukup impor `kp-la-2.ovpn` asli dengan kredensial aslinya — alur di aplikasi
sama persis. File asli dan `out/` sudah masuk `.gitignore` (berisi private
key); jangan di-commit.

## Banyak VPN di aplikasi (Pengaturan VPN)

- Daftar profil: tiap VPN punya nama; tombol **Pakai ini** menentukan VPN aktif,
  **Ubah**, hapus (ketuk dua kali), dan **+ Tambah VPN**. Konfigurasi lama
  (satu server) otomatis menjadi satu profil.
- Halaman Koneksi VPN menampilkan semua profil — ketuk untuk memilih yang dipakai
  (tidak bisa pindah saat sedang terhubung).
- **Host yang dipakai:** jika file `.ovpn` memuat beberapa baris `remote`, bisa
  dipilih satu, atau isi host kustom (`host:port`). Tunnel hanya menerima baris
  `remote` yang dipilih.
- Kolom mengikuti isi file: username/password hanya bila ada `auth-user-pass`;
  "Password private key" hanya bila private key-nya terenkripsi; bila file tidak
  punya private key, tidak ada kolom key sama sekali.
