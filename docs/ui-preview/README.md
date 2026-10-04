# Preview UI AI Hub

Desain menyeluruh mengikuti referensi 4 Oktober 2026: permukaan kertas, garis
tepi gelap, sudut membulat, bayangan tegas, ilustrasi pastel, dan label pil.
Header, panel pembuka, navigasi, login, chat, form, pengaturan, akun, VPN,
provider, bot, dan riwayat memakai bahasa visual yang sama.
Navigasi mengambang di bawah pada ponsel dan menjadi sidebar pada desktop.

Perapian lanjutan: font sistem tanpa unduhan font eksternal, jarak yang konsisten,
header dan dekorasi lebih ringkas, bayangan lebih tipis, tombol kartu sejajar,
katalog bot satu kolom pada ponsel, dan empat fitur berjajar pada desktop lebar.
Baris provider memakai kolom tetap untuk ikon, informasi, status, dan tombol.
Form API memakai petunjuk singkat di bawah input; tombol VPN berada sebelum
catatan penjelasannya. Screenshot di bawah mencerminkan versi perapian ini.

## Pratinjau

- [Beranda](dashboard.png) / [desktop](home-desktop.png)
- [Login](login.png) / [desktop](login-desktop.png)
- [Chat](chat.png)
- [Bot Hub](agents.png)
- [VPN](vpn.png) / [konfigurasi server](vpn-config.png)
- [Pengaturan](settings.png) / [akun](settings-profile.png)
- [Provider dan agent](settings-apikeys.png) / [hubungkan provider](settings-add-api-key.png)
- [Log aktivitas](settings-activity.png) / [riwayat BPJS](bpjs.png)

Screenshot memakai data contoh terisolasi, berukuran 390 x 844 atau 1280 x 844.
Aplikasi produksi tetap menggunakan akun, provider, dan aktivitas sebenarnya.
Ilustrasi SVG lokal tidak memerlukan unduhan aset eksternal.

## Deployment dan pemeriksaan

Container lokal `ai-hub-web` sudah dibangun ulang dengan
`docker compose -f web/docker-compose.yml up -d --build` dan berstatus healthy.
Alamat: http://localhost:8090. Seluruh 28 aset JS/HTML/CSS yang disajikan Docker
dicocokkan byte demi byte dengan file proyek. CSS kini ikut aturan no-store
bersama JS/HTML/SVG agar pembaruan desain terbaca setelah muat ulang.

`python web/tests/ui_smoke.py` lulus untuk 12 rute pada lebar 320/390/768/1280 px,
navigasi kartu, contoh pesan chat, filter aktivitas, provider terisi, perintah
chat lokal, status bot, validasi login, dan bridge Bot BPJS. Untuk memeriksa
container langsung, set `UI_SMOKE_ORIGIN=http://localhost:8090` sebelum tes.
Data Supabase dan kredensial diganti fixture; tes tidak mengirim data pengguna.

`flutter analyze --no-pub` dan `flutter test --no-pub` lulus. Tema, splash, dan
layar native Bot BPJS juga disesuaikan di source Flutter. Perubahan native itu
memerlukan build/install APK baru; deploy Docker memperbarui halaman WebView.
Backend, tunnel VPN nyata, dan mikrofon perangkat tidak diuji ulang di sini.


## Penggunaan HP dan model AI

Header ponsel dipadatkan, target sentuh diperbesar, dan kolom chat mengikuti
viewport saat keyboard terbuka. Enter pada layar sentuh membuat baris baru.
Model dapat dipilih dari Chat maupun Provider & Agent. Gemini memperbarui URL
sesuai pilihan model dan mencoba pengganti dari daftar API ketika model tidak
tersedia. Lihat [panduan dan validasi model](../ai-models.md).

- [Notifikasi pergantian model](chat-model-fallback.png)
- [Pemilih model di HP](model-picker-phone.png)
- [Chat pada viewport keyboard](chat-keyboard-390.png)
