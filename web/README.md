# AI Hub — web

Antarmuka plain JavaScript yang disajikan nginx, untuk browser dan Flutter WebView.
Navigasi utama dimiliki web: Beranda, Chat, Bot, VPN, Pengaturan. Tidak ada navigasi
native kedua atau Friend System pada cakupan saat ini.

## Menjalankan

```sh
cd web
docker compose up -d --build
```

Buka http://localhost:8090. Tidak ada tahap build JavaScript.

## Batas web dan native

- Login, akun, konfigurasi provider/agent, Chat, aktivitas, dan riwayat BPJS: web + Supabase.
- Konfigurasi provider tersimpan pada akun melalui `credentials.js`. Kunci enkripsi
  diturunkan dari UID dan konstanta publik; jangan menganggap ini enkripsi end-to-end.
- Chat hanya di memori, bertahan saat pindah tab dan dihapus saat akun berubah atau halaman dimuat ulang.
- Rekaman STT, pembuatan draf BPJS, ekspor PDF/DOCX, dan tunnel WireGuard: Flutter.
- OpenVPN/SSH hanya konfigurasi. Browser tidak membuka tunnel VPN; konfigurasi preview
  browser disimpan pada localStorage dan bukan penyimpanan rahasia perangkat.
- Riwayat BPJS web menyediakan salin teks; belum ada deep link ekspor sesi historis.

## Bridge

`bridge.js` mengirim request melalui `NativeBridge.postMessage`; Flutter membalas lewat
`window.__nativeReply` atau mengirim event `window.__nativeEvent`.

| Request | Fungsi |
|---|---|
| `get_vpn_config`, `save_vpn_config` | Konfigurasi VPN perangkat |
| `get_vpn_status` | Pemeriksaan koneksi perangkat |
| `vpn_connect`, `vpn_disconnect` | Tunnel WireGuard |
| `open_bot_bpjs` | Membuka persiapan perekaman native |
| `session_changed`, `sign_out` | Menyamakan sesi web/native |

Event `vpn_status` memperbarui status setelah aplikasi kembali dari background.
Status tidak tersedia dilaporkan sebagai tidak diketahui, bukan koneksi berhasil.

## Validasi

```sh
python web/tests/ui_smoke.py
```

Jalankan dari akar repository. Memerlukan Python Playwright dan Chrome; menggunakan
fixture lokal tanpa layanan produksi. Screenshot disimpan di direktori temporer.
Lihat [desain](../docs/desain.md) dan [status implementasi](../docs/IMPLEMENTASI-DESAIN.md)
untuk batas kemampuan dan pemeriksaan perangkat yang masih diperlukan.
