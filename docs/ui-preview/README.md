# Preview UI AI Hub

Desain disesuaikan dengan referensi 25 September 2026: permukaan putih kebiruan,
aksen biru–ungu, logo jaringan, kartu membulat, ikon garis, dan navigasi bawah.

- [Dashboard](dashboard.png)
- [Login](login.png)
- [Agent Hub](agents.png)

Screenshot berukuran 390 px menggunakan data contoh terisolasi untuk pemeriksaan
visual. Data contoh hanya ada di skrip pengujian, bukan aplikasi produksi.
Dashboard aplikasi tetap membaca profil, status provider, dan aktivitas aktual.

Tema mencakup seluruh halaman WebView serta splash, komponen bersama, navigasi,
dan Jarvis/Bot BPJS di Flutter. Tab bawah: Home, Chat, Agents, Friends, More.
VPN tersedia melalui dashboard dan More. Navigasi browser otomatis disembunyikan
saat aplikasi berjalan di dalam Flutter.

Validasi: `flutter analyze`, `flutter test`, pemeriksaan sintaks JavaScript, dan
`python web/tests/ui_smoke.py` (Python Playwright + Chrome). Pemeriksaan browser
mencakup 11 rute pada lebar 320/390/768 px, navigasi, pencarian agen, validasi login,
dan pencegahan navigasi ganda. Backend dan fitur native yang masih berupa preview
tidak diimplementasikan ulang dalam perubahan desain ini.
