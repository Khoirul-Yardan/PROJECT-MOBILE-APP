# AI Hub — Flutter shell

Flutter menampilkan WebView persisten untuk antarmuka web, tanpa bottom navigation
native kedua. `BotBpjsScreen` menangani persiapan identitas, STT, draf, dan ekspor.
`VpnTunnelService` membuka WireGuard; OpenVPN/SSH masih konfigurasi saja.

## Menjalankan

Jalankan server di `../web`, lalu dari direktori `app`:

```sh
flutter pub get
flutter run
```

Alamat web dikonfigurasi pada `services/web_hub_config.dart`. Untuk deployment,
pakai `--dart-define=WEB_HUB_URL=https://domain-anda`.

## Validasi

```sh
flutter analyze --no-pub
flutter test --no-pub
```

Tes widget memakai mock izin/STT, bukan mikrofon atau tunnel nyata. Pengujian pada
perangkat tetap diperlukan untuk rekaman, lifecycle, WebView, VPN, dan berbagi berkas.

## Data dan status

- Login dimiliki web; sesi dicerminkan ke Supabase native untuk dokumentasi BPJS.
- Provider/agent tersimpan pada akun Supabase. VPN memakai penyimpanan perangkat.
- Nama dokter tujuan diisi manual, bukan akun penerima terverifikasi.
- Transkrip tidak memiliki diarization terverifikasi. AI gagal menghasilkan transkrip mentah.
- Kegagalan simpan ditampilkan; data di layar belum pulih otomatis setelah aplikasi ditutup.
- Salin/ekspor tidak menandakan dokter menerima dokumen dan tidak mengubah status menjadi `terkirim`.

Gunakan `supabase/schema.sql` untuk skema yang sesuai. Perubahan desain ini tidak
memerlukan migrasi skema baru. Lihat [status implementasi](../docs/IMPLEMENTASI-DESAIN.md).
