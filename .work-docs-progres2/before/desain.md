# Desain UI/UX AI Hub

> Versi 1.0 · 2 Oktober 2026 · Spesifikasi desain untuk implementasi berikutnya.
> Cakupan: web di dalam Flutter WebView, browser, serta layar native Bot BPJS.
> Dokumen ini menetapkan desain target; keberadaan spesifikasi tidak berarti fiturnya sudah diimplementasikan atau diuji pada perangkat.

> Pembaruan implementasi 3 Oktober 2026: lihat [status implementasi dan validasi](IMPLEMENTASI-DESAIN.md). Tabel baseline di bawah tetap merekam kondisi saat audit awal.

**Daftar isi**

1. [Keputusan desain utama](#1-keputusan-desain-utama)
2. [Dasar sistem dan batas cakupan](#2-dasar-sistem-dan-batas-cakupan)
3. [Pengguna dan pekerjaan utama](#3-pengguna-dan-pekerjaan-utama)
4. [Prinsip dan hukum UI/UX](#4-prinsip-dan-hukum-uiux-yang-diterapkan)
5. [Definisi desain yang tidak terasa generik](#5-definisi-desain-yang-tidak-terasa-generik)
6. [Arsitektur informasi dan navigasi](#6-arsitektur-informasi-dan-navigasi)
7. [Sistem visual dan token](#7-sistem-visual-dan-token)
8. [Layout responsif dan batas web–native](#8-layout-responsif-dan-batas-webnative)
9. [Komponen dan kontrak interaksi](#9-komponen-dan-kontrak-interaksi)
10. [Spesifikasi tiap layar](#10-spesifikasi-tiap-layar)
11. [State dan kejujuran status](#11-state-dan-kejujuran-status)
12. [Wireframe acuan](#12-wireframe-acuan)
13. [Bahasa, microcopy, dan integritas data](#13-bahasa-microcopy-dan-integritas-data)
14. [Aksesibilitas](#14-aksesibilitas-dan-cara-memeriksanya)
15. [Urutan implementasi dan dependensi](#15-urutan-implementasi-dan-dependensi)
16. [Evaluasi pengguna dan kriteria penerimaan](#16-rencana-evaluasi-pengguna-dan-kriteria-penerimaan)
17. [Referensi dan pemeliharaan](#17-referensi-dan-pemeliharaan-dokumen)

## 1. Keputusan desain utama

AI Hub dirancang sebagai ruang kerja untuk percakapan AI, penggunaan agent, dokumentasi perawat–pasien, dan pengelolaan VPN. Tampilan harus membantu pengguna menemukan pekerjaan, memahami statusnya, dan menyelesaikannya dengan sedikit keraguan.

Arah visualnya adalah **antarmuka kerja yang tenang dan presisi**: latar abu-abu sangat terang, permukaan putih, teks gelap, satu aksen biru solid, garis pembatas yang terukur, dan tipografi yang nyaman untuk membaca transkrip. Identitas aplikasi muncul melalui susunan informasi dan konsistensi interaksi, bukan dekorasi bertema AI.

Keputusan inti:

1. Pertahankan lima tujuan navigasi sistem: **Beranda, Chat, Bot, VPN, Pengaturan**.
2. Tempatkan provider dan agent pada satu pemilih di Chat; pengelolaannya berada di Pengaturan.
3. Jadikan Bot BPJS alur dokumentasi yang jelas: persiapan → rekam → susun draf → periksa → ekspor.
4. Gunakan daftar untuk data berulang dan kartu hanya untuk kelompok yang memang memiliki batas atau tindakan sendiri.
5. Prioritaskan status yang dapat dibuktikan. Kredensial tersimpan tidak otomatis berarti koneksi berhasil; file diekspor tidak berarti dokter sudah menerimanya.
6. Terapkan bahasa Indonesia yang konsisten dan tombol dengan kata kerja spesifik.
7. Tetapkan aksesibilitas sebagai kriteria penerimaan, dengan WCAG 2.2 tingkat AA sebagai target untuk web, disertai pemeriksaan native.

## 2. Dasar sistem dan batas cakupan

### 2.1 Sumber lokal yang menjadi acuan

Audit dilakukan terhadap kode, skema, PRD, dan screenshot yang tersedia. Status berikut berasal dari pembacaan implementasi, bukan pembuktian layanan produksi.

| Sumber | Informasi yang dipakai |
|---|---|
| [PRD gabungan](../PRD/PRD-AI-Hub-Jarvis-BPJS.md) | Tujuan produk, dokumentasi klinis, batas keputusan AI |
| [Rincian sistem](RINCIAN-SISTEM.md) | Latar belakang dan pertimbangan arsitektur |
| [Registrasi rute](../web/public/app.js) | Layar yang benar-benar terdaftar |
| [Navigasi web](../web/public/navigation.js) | Lima tab dan pemetaan navigasi |
| [Shell Flutter](../app/lib/screens/web_shell_screen.dart) | WebView dan jembatan fungsi native |
| [Tema web](../web/public/style.css), [tema Flutter](../app/lib/theme.dart) | Fondasi visual yang akan diperbarui |
| [Chat](../web/public/views/chat.js), [katalog provider](../web/public/providers.js) | Provider/agent, konteks percakapan, perintah `/` |
| [Kredensial AI](../web/public/credentials.js) | Penyimpanan melalui akun Supabase |
| [Bot BPJS native](../app/lib/screens/bot_bpjs_screen.dart), [layanan BPJS](../app/lib/services/bpjs_service.dart) | STT, draf, fallback transkrip, ekspor |
| [Riwayat BPJS](../web/public/views/bpjs-review.js), [skema SQL](../app/supabase/schema.sql) | Sesi milik pengguna, status, nama dokter manual |
| [Layanan VPN](../app/lib/services/vpn_tunnel_service.dart) | Dukungan tunnel WireGuard dalam kode |
| [Screenshot lama](ui-preview/dashboard.png) | Referensi visual historis, bukan spesifikasi navigasi terbaru |

### 2.2 Perbedaan PRD lama dengan implementasi

| Topik | Temuan pada kode saat audit | Konsekuensi desain |
|---|---|---|
| Navigasi | Navigasi utama dirender web; shell Flutter tidak menggambar bottom navigation | Satu navigasi utama; jangan membuat versi native kedua |
| Friend System | Alur pertemanan dan review akun dokter telah dihapus | Tidak ada tab Teman, pemilih teman dokter, atau inbox review dokter |
| Tujuan dokumentasi | Nama dokter dan instansi diisi manual | Jelaskan bahwa nama tujuan bukan akun penerima terverifikasi |
| Status BPJS | `recording`, `processing`, `siap_dikirim`, `terkirim` | Jangan memakai status persetujuan dokter dari PRD lama |
| Ekspor | Native membuat teks/PDF/DOCX; riwayat web menyediakan salin teks | Tampilkan aksi sesuai kemampuan lingkungan dan sesi |
| Identifikasi pembicara | Segmen STT diberi label `perawat` secara default | Jangan menyajikan pemisahan perawat/pasien sebagai hasil terverifikasi |
| Wake word/TTS | Nama Jarvis ada, tetapi alur yang dibaca dimulai melalui tindakan pengguna dan plugin STT | Jangan menjanjikan deteksi suara selalu aktif atau TTS yang belum terbukti |
| Chat | Pesan disimpan dalam `Map` di lingkup render layar | Jangan menjanjikan riwayat chat permanen atau sinkronisasi percakapan |
| Kredensial AI | Disinkronkan melalui Supabase; komentar kode menjelaskan keterbatasan derivasi kunci | Jangan menulis bahwa API key hanya berada di Keystore/Keychain atau terenkripsi end-to-end |
| VPN | WireGuard memiliki implementasi tunnel; OpenVPN/SSH masih konfigurasi; browser mempunyai fallback simulasi | Bedakan konfigurasi, simulasi, dan koneksi perangkat nyata |
| Akun | Halaman profil sekarang berisi email dan tindakan akun | Jangan menampilkan pengeditan peran/bio seolah sudah tersedia |

Jika dokumentasi lama bertentangan dengan kode, gunakan tabel ini sebagai baseline desain versi ini. Perubahan kebutuhan produk tetap dapat dilakukan, tetapi harus dicatat sebagai perubahan cakupan.

### 2.3 Arti penandaan kebutuhan

- **Baseline**: kemampuan atau struktur yang ditemukan dalam kode.
- **Target UI**: perubahan tampilan/interaksi yang ditetapkan dokumen ini.
- **Dependensi**: membutuhkan perubahan state, layanan, penyimpanan, atau integrasi; tidak boleh diwujudkan sebagai tombol palsu.

Semua ukuran, breakpoint, target waktu, dan susunan layar di bawah adalah keputusan desain produk ini, bukan angka universal yang diturunkan dari “hukum UI/UX”.

## 3. Pengguna dan pekerjaan utama

Persona berikut adalah hipotesis kerja dari kebutuhan sistem, belum hasil wawancara pengguna.

| Pengguna | Pekerjaan | Hambatan yang diantisipasi | Respons desain |
|---|---|---|---|
| Pengguna AI umum | Memilih layanan dan mengirim pertanyaan | Bingung antara provider, agent, dan bot | Penjelasan singkat pada titik pemilihan; satu pola Chat |
| Perawat/operator dokumentasi | Merekam percakapan dan menyiapkan draf untuk dokter | Gangguan ruangan, salah identitas, rekaman berhenti | Identitas persisten, indikator mikrofon aktual, pemulihan jelas |
| Pengguna server pribadi | Menyimpan endpoint dan menghubungkan VPN | Istilah teknis, konfigurasi benar tetapi tunnel gagal | Form bertahap, status konfigurasi terpisah dari status koneksi |
| Dokter penerima dokumen | Memeriksa draf yang dibagikan di luar aplikasi | Tidak tahu asal data dan status verifikasi | Identitas dokumen, sumber AI, label draf, transkrip pendukung |

Dokter penerima bukan peran dengan dashboard khusus dalam cakupan saat ini. Akun pengguna tidak otomatis membuktikan profesi atau kewenangan klinis.

### 3.1 Urutan prioritas

1. Pengguna tahu apa yang sedang terjadi dan data mana yang sedang dikerjakan.
2. Tindakan utama mudah ditemukan dan tidak tertukar dengan tindakan merusak.
3. Isi chat dan dokumentasi mudah dibaca dalam sesi panjang.
4. Pengguna bisa pulih dari koneksi putus, izin ditolak, atau provider gagal.
5. Tampilan konsisten ketika berpindah dari web ke native.

## 4. Prinsip dan hukum UI/UX yang diterapkan

“Hukum UI/UX” di sini mencakup model perilaku dan prinsip persepsi; heuristik digunakan sebagai panduan evaluasi. Prinsip-prinsip tersebut tidak menjamin hasil tanpa pengujian pengguna.

| Prinsip | Penerapan spesifik di AI Hub | Cara memeriksa |
|---|---|---|
| Fitts | Target kontrol utama 48 × 48 atau lebih; tombol berhenti merekam mudah dijangkau | Uji sentuh satu tangan, terutama dekat tombol batal |
| Hick–Hyman | Provider dikelompokkan dan dapat dicari ketika daftar panjang; konfigurasi lanjut dibuka saat dibutuhkan | Pengguna bisa memilih layanan tanpa membaca seluruh pengaturan teknis |
| Jakob | Navigasi bawah berlabel, tombol kembali di kiri atas, composer chat di bawah | Pengguna baru mengenali kontrol tanpa penjelasan fasilitator |
| Gestalt: proximity | Label, isian, bantuan, dan error berdekatan; jarak antarbagian lebih besar | Tidak ada error yang tampak milik field lain |
| Gestalt: similarity | Tombol dengan fungsi setara memakai bentuk dan bobot yang sama | Aksi sekunder tidak tampak sebagai aksi utama |
| Gestalt: common region | Satu kelompok identitas sesi memiliki batas yang jelas | Pasien, tujuan dokter, dan status terbaca sebagai satu konteks |
| Recognition over recall | Provider/model aktif, identitas sesi, dan pilihan ekspor selalu terlihat | Pengguna tidak perlu mengingat pilihan dari layar sebelumnya |
| Visibility of system status | Bedakan mendengarkan, memproses, menyimpan, gagal, dan siap diperiksa | Label mengikuti kejadian layanan, bukan timer dekoratif |
| User control and freedom | Batalkan persiapan; hentikan rekaman; kembali tanpa kehilangan isian yang masih dapat dipertahankan | Uji tombol kembali sistem, tutup dialog, dan batal |
| Error prevention and recovery | Periksa identitas sebelum rekam dan ekspor; pertahankan transkrip saat AI gagal | Pengguna dapat melanjutkan tanpa merekam ulang seluruh percakapan |
| Progressive disclosure | Endpoint/model dan parameter VPN lanjut tidak memenuhi layar awal | Form sederhana tetap cukup untuk kasus umum |

Dasar rujukan: [Fitts](https://www.nngroup.com/articles/fitts-law/), [Hick–Hyman](https://www.nngroup.com/videos/hicks-law-long-menus/), [Jakob](https://www.nngroup.com/articles/end-of-web-design/), [proximity](https://www.nngroup.com/articles/gestalt-proximity/), [similarity](https://www.nngroup.com/articles/gestalt-similarity/), dan [heuristik Nielsen](https://www.nngroup.com/articles/ten-usability-heuristics/). Penerapan ke AI Hub pada tabel merupakan keputusan desain dokumen ini.

Jangan memaksakan “maksimal tujuh item” untuk semua daftar. Ketika pilihan banyak, gunakan pengelompokan, label yang dapat dibedakan, dan pencarian. Jangan mengurangi langkah jika akibatnya konteks pasien atau tujuan ekspor menjadi kurang jelas.

## 5. Definisi desain yang tidak terasa generik

### 5.1 Ciri yang harus terlihat

- Beranda menunjukkan pekerjaan dan aktivitas aktual; ruang terbesar diberikan pada tindakan yang berguna.
- Chat memberi ruang pada percakapan, sementara nama provider dan model tetap mudah ditemukan.
- Bot BPJS terasa seperti alat dokumentasi: identitas sesi, transkrip, urutan isi, dan status draf lebih menonjol daripada ilustrasi.
- VPN menunjukkan server, protokol, dan status perangkat dalam susunan ringkas.
- Pengaturan berupa daftar terkelompok dengan label yang menjelaskan tujuannya.

### 5.2 Batas visual

| Hindari | Ganti dengan |
|---|---|
| Gradien biru–ungu pada setiap tombol dan kartu | Biru solid hanya untuk tindakan atau pilihan aktif |
| Glow, blob, glassmorphism, dan latar dekoratif di layar kerja | Latar datar dan pembatas yang membantu membaca |
| Semua fitur menjadi kartu berukuran sama | Hierarki sesuai kepentingan tugas |
| Emoji sebagai ikon UI utama | Ikon garis dari sistem ikon yang sudah ada |
| Sapaan besar dengan slogan produktivitas | Judul halaman dan satu kalimat konteks yang relevan |
| Angka statistik, grafik, atau “tingkat akurasi” tanpa sumber data | Informasi operasional yang benar-benar tersedia |
| Katalog bot “segera hadir” mendominasi halaman | Fokus pada bot yang dapat dipakai |
| Ikon sparkle untuk semua jenis konten | Ikon chat, dokumen, bot, kunci, dan jaringan sesuai makna |
| Efek mengambang dan kartu membesar saat hover | Perubahan warna/border yang ringan |
| Nama fitur mengikuti jargon pemasaran | Label tindakan: “Mulai rekam”, “Salin teks”, “Atur server” |

Logo jaringan AI Hub yang sudah ada dapat dipertahankan sebagai identitas. Tidak diperlukan maskot, ilustrasi raster, font dekoratif, atau pustaka UI baru untuk menerapkan arah ini.

## 6. Arsitektur informasi dan navigasi

### 6.1 Pemetaan rute

| Label target | Rute baseline | Fungsi | Tab induk |
|---|---|---|---|
| Masuk / Buat akun | `/login` | Autentikasi | Tidak ada |
| Beranda | `/home` | Akses tugas dan aktivitas terbaru | Beranda |
| Chat | `/chat` | Percakapan provider dan agent | Chat |
| Bot | `/bots` | Bot BPJS dan akses riwayat | Bot |
| Riwayat Bot BPJS | `/bpjs` | Daftar sesi dan detail | Bot |
| VPN | `/vpn` | Status koneksi | VPN |
| Konfigurasi VPN | `/vpn-config` | Form server | VPN |
| Pengaturan | `/settings` | Pengelompokan preferensi dan akun | Pengaturan |
| Akun | `/settings/profile` | Email dan tindakan akun | Pengaturan |
| Provider & Agent | `/settings/apikeys` | Daftar kredensial | Pengaturan |
| Tambah provider/agent | `/settings/add-api-key?type=provider` atau `type=agent` | Setup layanan | Pengaturan |
| Aktivitas | `/settings/activity` | Riwayat kejadian | Pengaturan |
| Sesi Bot BPJS | Layar native, melalui bridge | Persiapan, STT, draf, ekspor | Kembali ke asal |

Label navigasi menggunakan **Beranda · Chat · Bot · VPN · Pengaturan** dalam urutan tetap. Pada layar sangat sempit, label Pengaturan tetap utuh; jangan diganti ikon tanpa teks.

### 6.2 Perilaku navigasi

- Tab aktif ditandai warna, bentuk latar, dan `aria-current="page"`, bukan warna saja.
- `/bpjs` tetap mengaktifkan Bot; `/vpn-config` tetap mengaktifkan VPN.
- Detail yang dibuka dari Pengaturan mengembalikan pengguna ke asal dan posisi scroll sebelumnya.
- Tombol kembali sistem menutup lapisan teratas lebih dulu: keyboard → dialog/sheet → detail → halaman asal, sesuai perilaku platform yang tersedia.
- Saat native Bot BPJS terbuka, layar itu memiliki kontrol kembali sendiri; web di belakangnya tidak menerima interaksi.
- Jangan menambahkan hamburger menu pada ponsel untuk menduplikasi lima tab.
- Pembukaan detail dan perubahan tab tidak otomatis menghapus input. Pelestarian state Chat memerlukan perubahan karena baseline menyimpan state pada fungsi render.
- Native fullscreen tidak menampilkan dua app bar atau dua bottom navigation.

## 7. Sistem visual dan token

### 7.1 Warna

Tema terang adalah target versi pertama. Tema gelap menjadi pekerjaan terpisah setelah setiap pasangan warna dan seluruh state dapat diuji; jangan membuatnya melalui inversi warna otomatis.

| Token | Nilai | Penggunaan |
|---|---|---|
| `--bg` | `#F7F8FA` | Latar aplikasi |
| `--surface` | `#FFFFFF` | Form, dialog, area baca |
| `--surface-sunken` | `#F0F2F5` | Kelompok sekunder |
| `--ink` | `#182230` | Teks utama |
| `--ink-muted` | `#52606D` | Bantuan, metadata, placeholder yang tetap terbaca |
| `--accent` | `#2457C5` | Aksi utama, tautan, pilihan aktif |
| `--accent-strong` | `#1D469E` | Hover/pressed untuk aksi utama |
| `--accent-tint` | `#EEF3FC` | Latar pilihan aktif |
| `--line` | `#DCE1E7` | Pemisah dekoratif |
| `--control-border` | `#7C8998` | Batas field dan kontrol yang perlu dikenali |
| `--ok` / `--ok-tint` | `#176B45` / `#ECF6F0` | Keberhasilan yang terkonfirmasi |
| `--warn` / `--warn-tint` | `#805300` / `#FFF5DC` | Perlu perhatian/periksa |
| `--bad` / `--bad-tint` | `#B42318` / `#FEF0EE` | Gagal, hapus, mikrofon merekam dengan label |
| `--focus` | `#2457C5` | Cincin fokus dengan celah putih |

Warna status selalu disertai teks dan bila perlu ikon. Merah pada rekaman harus ditulis “Mikrofon aktif”; jangan bergantung pada titik merah untuk menjelaskan status.

Hasil perhitungan kontras sRGB untuk warna solid:

| Pasangan | Rasio sekitar |
|---|---:|
| Teks utama / putih | 16,03:1 |
| Teks sekunder / putih | 6,46:1 |
| Teks sekunder / latar aplikasi | 6,08:1 |
| Putih / biru utama | 6,47:1 |
| Biru utama / latar pilihan | 5,81:1 |
| Teks sukses / latar sukses | 5,89:1 |
| Teks perhatian / latar perhatian | 6,13:1 |
| Teks gagal / latar gagal | 5,92:1 |
| Border kontrol / putih | 3,57:1 |

Angka ini memvalidasi pasangan token, bukan seluruh halaman. Opacity, gambar, overlay, dan state interaksi harus diperiksa lagi. `--line` adalah separator dekoratif; jangan memakainya sebagai satu-satunya batas input.

### 7.2 Tipografi

Gunakan font sistem agar aplikasi cepat dibuka dan konsisten dengan perangkat. Web: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`. Flutter mengikuti font platform dari tema. Jangan mengasumsikan Inter terpasang hanya karena namanya tertulis di CSS.

| Gaya | Ukuran web / Flutter | Bobot | Line height |
|---|---|---:|---:|
| Judul halaman | 24px / 24 logical px sebelum text scaling | 600–700 | 1,3 |
| Judul bagian | 18px / 18 | 600 | 1,4 |
| Isi/transkrip | 16px / 16 | 400 | 1,6 |
| Label field/tombol | 14–16px / 14–16 | 600 | 1,4 |
| Metadata | 13–14px / 13–14 | 400 | 1,5 |
| Label navigasi | 12px / 12 | 500–600 | 1,3 |
| Timer/host/ID | 14–16px / 14–16 | 400–600 | 1,5 |

- Gunakan angka tabular pada timer agar lebar tidak berubah setiap detik.
- Monospace hanya untuk host, kode, ID, atau nilai teknis; transkrip memakai font isi.
- Teks klinis tidak diringkas dengan ellipsis pada halaman detail.
- Tinggi elemen mengikuti konten saat pembesaran teks; jangan mengunci tinggi paragraf atau baris daftar.
- Batas lebar bacaan sekitar 60–75 karakter pada area dokumen di layar besar.

### 7.3 Ruang, bentuk, dan elevasi

| Aspek | Token/aturan |
|---|---|
| Spacing | 4, 8, 12, 16, 24, 32, 48 |
| Margin ponsel | 16; menjadi 20 pada lebar ≥390 |
| Padding permukaan | 16 ponsel, 24 layar besar |
| Label ke field | 8 |
| Field ke bantuan/error | 4–8 |
| Antarfield | 20–24 |
| Antarbagian | 24–32 |
| Radius field/tombol | 8 |
| Radius kartu | 12 |
| Radius sheet/dialog | 16 |
| Radius badge | 4–6; pill penuh hanya untuk tag pendek bila diperlukan |
| Border | 1px; fokus 2px dengan offset 2px |
| Shadow | Tidak pada daftar biasa; dialog/menu dapat memakai `0 8px 24px #1822301A` |

Jangan menempatkan kartu di dalam kartu berulang kali. Satu permukaan dengan judul, baris, dan separator biasanya cukup untuk satu kelompok informasi.

### 7.4 Ikon dan animasi

- Pertahankan helper ikon SVG web dan ikon Material native yang sudah tersedia; pilih padanan makna yang sama.
- Ikon visual 20–24; area tekan minimum produk 48 × 48.
- Ikon dekoratif disembunyikan dari pembaca layar. Tombol ikon mempunyai nama, misalnya “Kirim pesan”.
- Transisi warna 120–160 ms; sheet 180–220 ms. Durasi adalah target produk, dapat disesuaikan setelah pengujian.
- Hormati `prefers-reduced-motion` dan pengaturan pengurangan animasi native.
- Tidak ada waveform palsu, confetti saat menyimpan, atau animasi berulang tanpa informasi.
- Timer dan teks mikrofon aktif tetap terlihat ketika animasi dinonaktifkan.

## 8. Layout responsif dan batas web–native

| Lebar viewport CSS | Pola layout target |
|---|---|
| 320–599 | Satu kolom, navigasi bawah, sheet dapat menjadi fullscreen |
| 600–839 | Konten dipusatkan maksimal sekitar 720; navigasi bawah tetap |
| ≥840 | Browser dapat memakai sidebar 208–224 dan area kerja maksimal 1120 |
| ≥1024 untuk detail dokumen | Ringkasan dan transkrip dapat berdampingan, masing-masing tetap nyaman dibaca |

Breakpoint mengikuti ruang konten, bukan nama perangkat. Sidebar desktop merupakan **Target UI**, bukan kemampuan yang sudah ada pada CSS sekarang. Jika belum diimplementasikan, gunakan satu kolom terpusat yang tetap berfungsi.

Aturan operasional:

1. Tidak ada scroll horizontal pada halaman utama di 320 CSS px. Blok kode atau tabel yang benar-benar memerlukan dua dimensi boleh memiliki area scroll sendiri.
2. Navigasi bawah sekitar 64–72 tinggi konten ditambah safe area; ukuran aktual diukur, bukan ditebak pada banyak komponen.
3. Padding bawah halaman = tinggi navigasi aktual + safe area + ruang 16 untuk konten terakhir.
4. Gunakan `100dvh` dengan fallback; uji perubahan viewport ketika keyboard dan address bar berubah.
5. Composer Chat berada di atas keyboard. Navigasi bawah boleh disembunyikan selama keyboard terbuka jika perpindahan layout tidak menutupi input.
6. Sticky action bar pada draf tidak menutupi teks yang sedang difokuskan. Pada viewport pendek atau teks besar, tindakan kembali ke alur dokumen biasa.
7. Di native, gunakan SafeArea dan text scaling sistem; hindari penerapan inset dua kali di batas WebView.
8. Refresh dan tombol kembali browser harus memiliki hasil yang dapat dipahami. Pemulihan draft lintas refresh baru dijanjikan setelah penyimpanannya tersedia.

## 9. Komponen dan kontrak interaksi

### 9.1 Tombol

| Jenis | Pemakaian | Contoh |
|---|---|---|
| Primary solid | Satu aksi dominan per kelompok tugas | Masuk, Mulai rekam, Ekspor dokumen |
| Secondary outline | Alternatif yang relevan | Lihat transkrip, Atur server |
| Tertiary/text | Navigasi atau tindakan ringan | Lihat semua, Batal |
| Destructive | Penghapusan yang mempunyai konsekuensi | Hapus kredensial |
| Icon button | Aksi yang sudah dikenal dengan label aksesibel | Kembali, Kirim pesan |

State wajib: default, hover untuk pointer, pressed, focus-visible, disabled, loading. Loading mempertahankan lebar tombol dan mengganti label menjadi tindakan berjalan. Cegah pengiriman ganda. Disabled harus memiliki alasan di dekat kontrol jika alasannya tidak jelas.

“Putuskan VPN” bukan penghapusan data; tampilkan sebagai aksi sekunder biasa. “Hentikan rekaman” harus mudah diakses dan tidak memakai dialog konfirmasi sebelum mikrofon benar-benar berhenti.

### 9.2 Form

- Label permanen di atas isian; placeholder hanya contoh.
- Tandai “opsional” pada field tidak wajib; jelaskan aturan field sebelum pengguna gagal.
- Validasi format setelah blur atau submit; jangan memunculkan error saat pengguna baru mengetik karakter pertama.
- Error spesifik: “Isi nama dokter tujuan”, bukan “Input tidak valid”.
- Saat submit gagal, pertahankan isian dan fokuskan ringkasan error/field pertama yang bermasalah.
- Gunakan jenis keyboard yang sesuai; kata sandi mendukung paste dan password manager.
- API key disamarkan secara default, memiliki tombol Tampilkan/Sembunyikan, tidak dikirim ke log atau analitik.
- Field teknis panjang mendukung paste tanpa perubahan huruf atau pemotongan karakter.
- Form identitas sesi menggunakan satu halaman, bukan rangkaian modal nama pasien lalu nama dokter.

### 9.3 Daftar, kartu, badge, dan filter

- Satu baris daftar memiliki judul, metadata, status, dan area klik yang jelas.
- Chevron hanya untuk membuka detail; toggle hanya untuk pilihan on/off; jangan memakai keduanya dengan makna ambigu.
- Satu kartu tidak boleh memiliki tombol bersarang di dalam elemen `<button>`.
- Badge menjelaskan status, bukan dekorasi. “Siap diperiksa” lebih informatif daripada “Aktif”.
- Filter aktif dapat dibedakan dari status data; selalu sediakan cara menghapus filter.
- Pencarian/filter baru pada riwayat adalah Target UI dan harus benar-benar menyaring data, bukan hanya mengubah chip.

### 9.4 Dialog, sheet, toast, dan pesan persisten

- Sheet untuk pemilih provider, perintah Chat, dan format ekspor.
- Dialog untuk keputusan yang berisiko menghilangkan pekerjaan atau menghapus kredensial.
- Dialog memiliki judul, fokus awal yang aman, penahanan fokus selama terbuka, Escape untuk menutup bila aman, dan pemulihan fokus ke pemicu.
- Toast hanya untuk konfirmasi ringan seperti “Teks disalin”; tidak menjadi satu-satunya tempat menyatakan gagal simpan atau izin ditolak.
- Error, fallback transkrip, dan status belum tersimpan tampil persisten dekat bagian yang terdampak.
- Jangan memunculkan modal otomatis setelah setiap keberhasilan.

## 10. Spesifikasi tiap layar

### 10.1 Masuk dan buat akun

**Tujuan:** pengguna masuk tanpa distraksi dan memahami langkah berikutnya.

Urutan: logo 32–40 → nama AI Hub → judul “Masuk” → deskripsi singkat → email → kata sandi → aksi Masuk → tautan Buat akun.

Copy pembuka: “Masuk untuk menggunakan layanan AI dan mengelola dokumentasi Anda.” Hindari janji bahwa percakapan dan teman tersimpan karena baseline tidak mendukung klaim tersebut.

- Lebar form maksimal 400–440; pada ponsel menjadi bagian halaman biasa tanpa bingkai kartu besar berlapis.
- Kata sandi tidak memakai placeholder aturan pendaftaran pada mode masuk.
- Status masuk: “Sedang masuk…”; status daftar: “Membuat akun…”.
- Pendaftaran yang membutuhkan konfirmasi email menampilkan panel informasi “Periksa email Anda”, bukan pesan merah seolah pendaftaran gagal.
- Tombol kirim dapat digunakan lewat submit keyboard.
- Pemulihan kata sandi hanya ditampilkan sebagai aksi jika alur backend dan halaman kembalinya sudah tersedia; ini dependensi, bukan tautan kosong.
- Jangan meminta izin mikrofon/VPN pada login.

### 10.2 Beranda

**Tujuan:** membuka tugas utama dan melihat kejadian terbaru.

Urutan informasi:

1. Judul “Beranda”, avatar akun kecil.
2. Kelompok “Mulai bekerja”: **Buka Chat**, lalu baris **Dokumentasi Bot BPJS**.
3. Status ringkas “Provider & Agent” dan “VPN” dalam baris terpisah, dengan tindakan Kelola/Lihat.
4. Aktivitas terbaru maksimal tiga sampai lima item aktual dan tautan Lihat semua.

Gunakan satu tombol utama Buka Chat untuk baseline umum. Bot BPJS tetap terlihat tanpa scroll berlebihan pada viewport ponsel normal. Personalisasi berdasarkan peran belum masuk cakupan karena profil saat ini tidak menyediakan alur peran yang dapat diandalkan.

- Tidak perlu mengulang keempat modul sebagai kartu besar jika sudah tersedia di navigasi bawah.
- Jika belum ada provider, tampilkan bantuan “Tambahkan provider untuk mulai chat” dengan aksi yang jelas.
- Jumlah konfigurasi dinamai “2 layanan tersimpan”, bukan “2 layanan online”.
- Status VPN yang belum dibaca ditulis “Memeriksa status…”, bukan langsung Tidak terhubung.
- Ikon lonceng dihapus jika hanya mengarah ke Activity Log dan tidak ada sistem notifikasi.
- Jika belum ada aktivitas, berikan satu kalimat netral; jangan mengisi contoh palsu.

### 10.3 Chat provider dan agent

**Tujuan:** pengguna tahu layanan yang menerima pesan dan dapat membaca jawaban dengan nyaman.

Struktur: judul Chat → pemilih layanan dan metadata model → daftar pesan → composer.

- Pemilih menampilkan layanan aktif, tipe Provider/Agent, serta model bila tersedia. Detail endpoint berada di pengaturan lanjut.
- Untuk daftar singkat, pilihan dapat berupa chip. Ketika tidak lagi muat dengan jelas, gunakan sheet daftar dengan pencarian; jangan memaksa scroll chip panjang sebagai satu-satunya akses.
- Pesan pengguna menggunakan tint biru lembut; respons AI memakai latar netral tanpa gradien.
- Layanan yang mengirim respons ditandai dengan teks, bukan hanya logo.
- Ketika ganti layanan, konteksnya tetap terpisah sesuai perilaku baseline. Tampilkan pemberitahuan ringan “Konteks percakapan terpisah untuk setiap layanan”.
- Jangan mengirim pesan ke provider lain secara otomatis saat provider aktif gagal.
- Pemilih dinonaktifkan selama request jika implementasi belum menjamin atribusi respons ke konteks yang benar.
- Tidak ada klaim streaming atau tombol Stop sampai request cancellation benar-benar didukung.
- Saat menunggu: “Menunggu jawaban dari [layanan]…”; bila gagal, tampilkan pesan gagal pada request terkait dan aksi Coba lagi.
- Percobaan ulang memakai pesan yang sama tanpa menambah duplikat tidak terkendali.
- Auto-scroll hanya jika pengguna berada dekat akhir percakapan. Saat membaca bagian lama, tampilkan “Pesan baru”.
- Pada desktop Enter mengirim dan Shift+Enter membuat baris baru; pada ponsel tombol kirim eksplisit tetap tersedia. Hormati komposisi keyboard/IME.
- Berikan keterangan “Percakapan belum tersimpan permanen” selama baseline masih berlaku. Pelestarian saat pindah tab menjadi dependensi prioritas tinggi.

**Perintah Chat:** tombol `/` berlabel aksesibel “Buka perintah”. Menu menampilkan `/system`, `/clear`, `/help` beserta penjelasan. Membuka menu tidak boleh menimpa pesan yang sudah diketik. `/clear` meminta konfirmasi bila ada percakapan yang akan hilang; dialog menyebut layanan yang terdampak.

**Agent:** label Agent menjelaskan jenis layanan, bukan bukti adanya eksekusi pekerjaan otonom. Jangan menampilkan langkah “Menganalisis → Menjalankan → Selesai” tanpa event eksekusi dari layanan.

### 10.4 Provider & Agent

**Tujuan:** menyimpan konfigurasi dan memahami kesiapan layanan.

Daftar menampilkan nama, jenis layanan, model jika ada, dan status “Tersimpan” atau hasil pemeriksaan koneksi yang nyata. Primary action “Tambah layanan”; pilihan berikutnya Provider AI atau Agent mengikuti dua mode form yang sudah ada.

Alur tambah: pilih jenis → tempel key → tinjau hasil deteksi → lengkapi konfigurasi bila diperlukan → simpan.

- Deteksi pola key berarti “Format dikenali sebagai [provider]”; bukan “Key valid”.
- Nama provider yang tidak terdeteksi bisa dipilih manual; jangan langsung menyatakan key salah.
- Endpoint dan model tampil pada bagian “Pengaturan lanjutan” untuk kasus standar; gateway pribadi tetap meminta alamat yang dibutuhkan.
- Pilihan katalog tidak langsung menyimpan sebelum pengguna meninjau ringkasan.
- Tombol baseline “Simpan konfigurasi”. “Uji koneksi” baru tersedia jika request uji dan error mapping sudah diimplementasikan; jelaskan jika pengujian menggunakan kuota provider.
- Sukses simpan ditulis “Konfigurasi tersimpan”.
- Copy penyimpanan: “Konfigurasi layanan tersimpan pada akun Anda.” Rincian keamanan hanya memakai klaim yang telah diverifikasi tim teknis.
- Hapus kredensial menyebut nama layanan dan dampak pada chat berikutnya; rahasia tidak tampil dalam konfirmasi.

### 10.5 Bot

**Tujuan:** menjalankan alur yang sudah dipaketkan.

Tampilkan Bot BPJS sebagai fitur utama dengan deskripsi “Ubah percakapan perawat–pasien menjadi draf dokumentasi.” Aksi utama “Mulai dokumentasi”; aksi sekunder “Riwayat sesi”.

- Bot FAQ dan Penerjemah yang belum tersedia tidak menjadi kartu aktif setara dengan Bot BPJS. Jika perlu ditampilkan, letakkan di bagian bawah bertajuk “Dalam pengembangan” tanpa CTA menjalankan.
- Browser tanpa native menampilkan “Perekaman tersedia di aplikasi mobile” sebelum pengguna menekan mulai. Jangan berakhir pada klik yang tidak bereaksi.
- Istilah Jarvis boleh menjadi nama asisten, tetapi tidak menyiratkan wake word aktif di background.
- Deskripsi tidak menjanjikan diagnosis otomatis atau dokumen sudah memenuhi seluruh persyaratan BPJS.

### 10.6 Bot BPJS: persiapan

**Tujuan:** memastikan sesi yang benar sebelum mikrofon aktif.

Satu layar berisi nama pasien, nama dokter tujuan, instansi opsional, serta ringkasan bahwa hasil adalah draf. Gunakan label “Nama dokter tujuan” dengan bantuan “Digunakan pada dokumen; pengiriman dilakukan saat Anda membagikan hasil”.

- Informasi persetujuan perekaman ditampilkan sebelum mulai, dengan tindakan pengguna mengikuti prosedur instansi; checkbox UI bukan bukti kepatuhan hukum dengan sendirinya.
- Jelaskan bahwa suara diproses menjadi teks dan draf dapat diproses oleh layanan AI yang digunakan. Jangan menjanjikan pemrosesan STT sepenuhnya offline tanpa verifikasi platform.
- Tampilkan layanan penyusun draf jika tersedia; pemilihan eksplisit provider merupakan Target UI dengan dependensi pada layanan native yang saat ini memilih kredensial tersedia.
- Jika tidak ada provider, jelaskan bahwa hasil dapat berupa transkrip tanpa ringkasan AI; jangan memberi label “AI berhasil”.
- Aksi “Mulai rekam” meminta izin OS bila belum diberikan. Isian identitas tidak hilang saat kembali dari pengaturan izin.
- Tidak ada status “Mendengarkan” saat pengguna baru mengisi identitas dan mikrofon belum aktif.

### 10.7 Bot BPJS: merekam

Susunan: judul Bot BPJS → identitas pasien/tujuan → status **Mikrofon aktif** dan durasi aktual → transkrip berjalan → tombol **Hentikan rekaman**.

- Status didasarkan pada callback perekaman/pengenalan suara, bukan hanya enum UI yang diubah sebelum layanan berhasil.
- Jika mesin STT berhenti, tulis “Mikrofon terhenti” atau “Mengaktifkan kembali mikrofon…” sesuai kejadian aktual.
- Pengguna tetap dapat menghentikan proses restart; tidak ada restart tanpa batas yang mengabaikan tindakan berhenti.
- Timer mengukur sesi aktual; jangan memakai durasi buatan. Waveform hanya muncul jika ada data level suara nyata.
- Pada gangguan telepon/background, hentikan atau jeda sesuai kemampuan yang telah diuji dan beri status saat kembali. Perekaman background bukan janji default.
- Tidak ada tombol Jeda jika resume dan penyatuan segmen belum didukung.
- Kembali dari sesi aktif menghentikan penangkapan suara sebelum keputusan membuang hasil. Tawarkan “Proses hasil” dan “Buang hasil” jika data memang masih tersedia.
- Label pembicara ditampilkan sebagai “Pembicara belum diverifikasi” pada baseline. Nilai `perawat` bawaan tidak boleh ditampilkan sebagai identifikasi otomatis yang pasti.

### 10.8 Bot BPJS: memproses dan memeriksa draf

Saat proses berjalan, tampilkan tahap yang benar-benar terjadi: “Menyimpan transkrip” dan “Menyusun draf”. Jangan memakai persentase bila jumlah pekerjaan tidak dapat diukur.

Ketika selesai, urutan tampilan:

1. Identitas pasien, dokter tujuan, instansi, tanggal, dan referensi sesi.
2. Label persisten **Draf AI — perlu verifikasi dokter** bila disusun AI.
3. Ringkasan.
4. Keluhan utama.
5. Durasi gejala.
6. Riwayat kesehatan.
7. Hasil anamnesis.
8. Transkrip pendukung.
9. Provider penyusun dan waktu pembuatan bila tersedia.
10. Aksi ekspor dan salin.

Urutan mengikuti field yang digunakan layanan saat audit. Field kosong berbunyi “Belum disebutkan dalam percakapan”, bukan “Normal” atau “Tidak ada”. Jika respons hanya berisi ringkasan, tampilkan ringkasan dan informasi bahwa bagian lain belum tersedia.

- Label AI juga muncul pada dokumen ekspor, bukan hanya layar.
- Fallback tanpa AI memakai **Transkrip mentah — belum disusun AI**. Kegagalan AI tidak mengubah transkrip mentah menjadi dokumentasi terstruktur yang tampak berhasil.
- Transkrip tetap dapat dibaca saat penyusunan AI gagal.
- Target “Perbaiki teks” memerlukan penyimpanan perubahan dan jejak versi. Sampai tersedia, gunakan pemeriksaan baca-saja dan jelaskan bahwa koreksi dilakukan pada salinan dokumen.
- Tautan ringkasan ke potongan transkrip hanya dibuat setelah referensi segmen tersedia. Jangan membuat sumber kutipan atau timestamp buatan.
- Layar `review` native berarti pengguna memeriksa draf, bukan dokter telah memverifikasi diagnosis.

### 10.9 Ekspor dan berbagi

Aksi utama “Ekspor dokumen” membuka pilihan PDF dan DOCX. “Salin teks” menjadi aksi sekunder tersendiri. Sebelum membuka share sheet, ringkasan menampilkan pasien, nama dokter tujuan, dan format.

- PDF untuk pembacaan yang stabil; DOCX untuk koreksi di aplikasi dokumen. Keduanya tetap berlabel draf.
- Ekspor memuat identitas sesi, tanggal, isi terstruktur yang tersedia, transkrip sesuai pilihan yang benar-benar didukung, sumber penyusun, dan catatan verifikasi.
- Header/footer multi-halaman mencantumkan referensi sesi dan nomor halaman agar halaman tidak tertukar.
- Nama file target memakai referensi sesi dan tanggal, misalnya `draf-bpjs-20261002-sesi-01.pdf`; hindari nama pasien sebagai nama file default.
- Setelah copy: “Teks disalin”. Setelah pembuatan file: “File siap dibagikan”. Setelah share sheet dibatalkan: kembali ke draf tanpa klaim terkirim.
- Nama dokter pada form tidak otomatis memilih penerima di aplikasi lain. Pengguna harus memeriksa penerima pada share sheet/aplikasi tujuan.
- Jangan menampilkan “Diterima dokter”, “Diverifikasi”, atau “Klaim disetujui” tanpa mekanisme pembuktian yang sesuai.
- Baseline belum menunjukkan alur membuka kembali sesi historis ke native yang lengkap. Tombol “Buka di aplikasi” dari riwayat hanya ditampilkan setelah bridge/deep link dengan ID sesi tersedia.

### 10.10 Riwayat Bot BPJS

Daftar berbentuk baris dengan nama pasien, tanggal/jam, dokter tujuan, dan status. Identitas penting boleh membungkus menjadi dua baris. Detail menampilkan draf dan transkrip tanpa memaksa pembaca mengingat identitas dari daftar.

- Judul halaman adalah “Riwayat Bot BPJS”, bukan “Review dokter”.
- Target pencarian berdasarkan nama pasien/dokter dan filter status membutuhkan implementasi query atau penyaringan yang sesuai volume data.
- Detail mendukung kembali ke daftar dengan filter dan scroll tetap.
- Data gagal dimuat mempunyai state error berbeda dari “Belum ada sesi”.
- Riwayat web menampilkan Salin teks sesuai kemampuan baseline; ekspor PDF/DOCX tidak boleh berupa tombol tanpa jalur data.

### 10.11 VPN dan konfigurasi

**Tujuan:** mengetahui apakah perangkat benar-benar terhubung dan ke server mana.

Urutan: judul VPN → status teks/ikon → nama server/endpoint → protokol → aksi Sambungkan/Putuskan → rincian opsional.

- Ganti lingkaran gradien besar dengan panel status ringkas. Tidak ada ilustrasi gembok yang menyiratkan keamanan menyeluruh.
- Belum ada konfigurasi: aksi utama “Tambah server”.
- Browser: label “Pratinjau browser — koneksi VPN perangkat tidak tersedia”; simulasi hanya untuk mode pengembangan yang jelas.
- OpenVPN/SSH: “Konfigurasi tersimpan; koneksi belum didukung”. Tombol Sambungkan tidak aktif dan alasannya terlihat.
- WireGuard: tampilkan koneksi nyata hanya setelah layanan native mengonfirmasi. Dukungan perangkat/OS tetap diuji, tidak diasumsikan dari adanya plugin.
- Tampilkan waktu mulai koneksi hanya jika sumber datanya valid; jika tidak, gunakan “Tidak tersedia”.
- Jangan mengklaim semua trafik melewati VPN karena konfigurasi AllowedIPs dapat membatasi rute.
- Tidak menampilkan kecepatan, lokasi server, ping, atau public IP palsu.
- Pergantian konfigurasi saat aktif menjelaskan bahwa koneksi akan terputus; jangan mengganti server secara diam-diam.

Form mengelompokkan protokol, identitas server, dan kredensial. Untuk WireGuard, tampilkan alamat interface, endpoint, private key, public key peer, AllowedIPs, dan bagian lanjutan DNS/preshared key. Field harus memakai label yang sesuai model konfigurasi aktual.

### 10.12 Pengaturan, akun, aktivitas

Pengaturan memakai kelompok “Layanan” (Provider & Agent, VPN), “Dokumentasi” (Riwayat Bot BPJS), dan “Akun” (Akun, Aktivitas, Keluar). Hindari kartu dengan avatar dekoratif pada tiap baris.

Halaman akun menampilkan email dan aksi yang benar-benar tersedia. “Ganti akun” menjelaskan bahwa pengguna akan keluar terlebih dahulu; jangan memberi kesan ada multi-account switcher. Tindakan keluar memperingatkan pekerjaan belum tersimpan jika ada, membersihkan state pengguna, dan menyinkronkan logout native/web.

Aktivitas menampilkan kejadian, objek layanan, waktu, dan hasil. Kelompok tanggal membantu pemindaian. Filter kategori menggunakan kategori yang benar-benar tersedia. Jangan tampilkan token, API key, isi transkrip, atau data pasien dalam ringkasan log umum.

## 11. State dan kejujuran status

### 11.1 State lintas layar

| Kondisi | Tampilan | Tindakan/pemulihan |
|---|---|---|
| Muat awal | Skeleton ringan atau teks memuat pada area terkait | Navigasi yang masih tersedia tetap berfungsi |
| Data kosong | Penjelasan spesifik | Satu CTA relevan |
| Hasil pencarian kosong | “Tidak ada hasil untuk …” | Ubah kata kunci / hapus filter |
| Request lambat | “Masih menunggu …” | Pertahankan input; jangan mengarang progres |
| Gagal jaringan | Error dekat konten | Coba lagi tanpa menghapus pekerjaan |
| Belum tersimpan | Label persisten | Simpan ulang jika jalur retry aman |
| Sesi login berakhir | Pemberitahuan dan masuk kembali | Jangan membuka data pengguna lain setelah login |
| Izin ditolak | Penjelasan izin yang diperlukan | Buka pengaturan jika didukung / kembali |
| Fitur tidak didukung | Alasan konkret | Aksi alternatif yang tersedia |
| Offline | Status koneksi dan batas kemampuan | Jangan menjanjikan antrean otomatis tanpa implementasi |

Target respons interaksi visual sekitar 100 ms; bila menunggu lebih dari sekitar satu detik, tampilkan status yang dapat dibaca; setelah sekitar sepuluh detik, beri pesan tunggu lebih jelas. Ini target pengalaman, bukan janji kecepatan backend. Jangan otomatis mengulang request AI berbayar tanpa diketahui pengguna.

### 11.2 Pemetaan status BPJS

| Nilai data baseline | Label UI target | Catatan |
|---|---|---|
| `recording` | Sesi belum selesai | “Mikrofon aktif” hanya untuk sesi live yang dikonfirmasi perangkat |
| `processing` | Memproses dokumentasi | Pada sesi lama tanpa event aktif, sediakan keterangan proses belum terkonfirmasi selesai |
| `siap_dikirim` | Draf siap diperiksa | Tidak berarti sudah diperiksa dokter |
| `terkirim` | Pernah diekspor/disalin | Status legacy tidak membuktikan penerimaan dokter |

Kode saat audit mengubah status menjadi `terkirim` setelah copy/ekspor. Sebagian status lama juga dimigrasikan ke nilai ini. Karena itu detail harus menjelaskan **“Status lama; penerimaan oleh dokter tidak tercatat di aplikasi.”** Jangan menganggap semua baris legacy mempunyai bukti ekspor lengkap.

Target lanjutan: pisahkan status penyusunan dokumen dari event `copied`, `export_created`, `share_opened`, `share_cancelled`, dan hasil berbagi yang benar-benar disediakan platform. Ini membutuhkan perubahan model data, pencatatan layanan, dan migrasi; bukan sekadar mengganti label CSS. Bahkan hasil share yang berhasil tidak membuktikan dokumen dibaca dokter.

### 11.3 Pemetaan status VPN

```text
Belum ada konfigurasi → Tambah server
Konfigurasi tersedia → Memeriksa status perangkat
Tidak terhubung → Meminta izin → Menghubungkan → Terhubung
Terhubung → Memutuskan → Tidak terhubung
Setiap proses → Gagal / Tidak didukung
Browser tanpa native → Pratinjau, tanpa tunnel perangkat
```

Jangan memakai boolean lokal sebagai satu-satunya sumber status setelah aplikasi kembali dari background. Query status perangkat atau event native diperlukan; jika belum tersedia, tampilkan ketidakpastian secara jelas.

## 12. Wireframe acuan

Wireframe menunjukkan urutan dan bobot informasi, bukan ukuran piksel final. Semua nama dan isi contoh bersifat fiktif.

### 12.1 Beranda ponsel

```text
┌────────────────────────────────────┐
│ Beranda                       Akun │
│                                    │
│ Mulai bekerja                      │
│ [ Buka Chat                      ] │
│ Dokumentasi Bot BPJS            ›  │
│ Rekam dan periksa draf percakapan   │
│ ────────────────────────────────── │
│ Layanan                            │
│ Provider & Agent   2 tersimpan   ›  │
│ VPN                Belum aktif  ›  │
│ ────────────────────────────────── │
│ Aktivitas terbaru      Lihat semua │
│ Konfigurasi layanan disimpan       │
│ Hari ini, 09.20                    │
│ Draf dokumentasi dibuat            │
│ Hari ini, 08.45                    │
│                                    │
├────────────────────────────────────┤
│ Beranda  Chat  Bot  VPN Pengaturan  │
└────────────────────────────────────┘
```

### 12.2 Chat

```text
┌────────────────────────────────────┐
│ Chat                               │
│ [ Layanan aktif                 ▾] │
│ Model: sesuai konfigurasi          │
│ ────────────────────────────────── │
│                 Pesan pengguna     │
│                                    │
│ Nama layanan                       │
│ Jawaban dengan lebar baca yang      │
│ nyaman dan paragraf yang jelas.     │
│                                    │
│ Menunggu jawaban…                  │
│ ────────────────────────────────── │
│ [ / ] [ Tulis pesan…     ] [Kirim] │
├────────────────────────────────────┤
│ Beranda  Chat  Bot  VPN Pengaturan  │
└────────────────────────────────────┘
```

### 12.3 Rekam dan periksa draf

```text
REKAM                               DRAF
┌────────────────────────────┐      ┌────────────────────────────┐
│ ‹ Bot BPJS                 │      │ ‹ Draf dokumentasi         │
│ Pasien contoh              │      │ Pasien contoh              │
│ Tujuan: dr. Contoh         │      │ Tujuan: dr. Contoh         │
│ ────────────────────────── │      │ Draf AI — perlu verifikasi │
│ ● Mikrofon aktif    02:14   │      │ dokter                     │
│                            │      │ ────────────────────────── │
│ Transkrip berjalan         │      │ Ringkasan                  │
│ Pembicara belum            │      │ Isi sesuai percakapan…     │
│ diverifikasi               │      │ Keluhan utama              │
│ “Keluhan mulai kemarin…”   │      │ …                          │
│                            │      │ …                          │
│                            │      │ [Lihat transkrip]          │
│ [ Hentikan rekaman        ]│      │ [ Ekspor dokumen         ]│
└────────────────────────────┘      │ Salin teks                 │
                                    └────────────────────────────┘
```

Wireframe native tidak mempunyai bottom navigation web. Layar draf menggunakan scroll; tombol tidak boleh menutupi paragraf terakhir atau elemen yang difokuskan.

## 13. Bahasa, microcopy, dan integritas data

Gunakan “Anda” untuk teks bantuan; tombol cukup kata kerja. Hindari campuran Home Dashboard, More, Connected, dan istilah Indonesia pada hierarki yang sama. Istilah API key, endpoint, model, WireGuard, PDF, dan DOCX dipertahankan ketika dibutuhkan pengguna teknis.

| Situasi | Copy target |
|---|---|
| Belum ada provider | “Belum ada layanan AI. Tambahkan provider atau agent untuk mulai chat.” |
| Deteksi key | “Format dikenali sebagai [provider]. Koneksi belum diuji.” |
| Key tersimpan | “Konfigurasi tersimpan.” |
| Gagal AI | “Jawaban belum diterima. Pesan Anda tetap tersedia untuk dicoba lagi.” |
| Izin mikrofon | “Izinkan mikrofon untuk merekam percakapan pada sesi ini.” |
| STT berhenti | “Mikrofon terhenti. Periksa izin atau mulai kembali.” |
| Tidak ada ucapan | “Belum ada ucapan yang dikenali. Coba rekam kembali.” |
| Fallback tanpa AI | “Transkrip tersedia. Draf AI belum berhasil disusun.” |
| Salin | “Teks disalin. Pilih penerima saat membagikannya.” |
| Ekspor | “File siap dibagikan.” |
| Browser tanpa VPN | “Koneksi VPN perangkat tersedia melalui aplikasi mobile yang mendukungnya.” |
| Error server | “Layanan belum dapat dihubungi. Coba lagi.” |

Ketentuan data pada UI:

- Gunakan data fiktif untuk mockup, screenshot, dan uji visual; jangan menempel transkrip pasien nyata dalam artefak desain.
- Jangan menampilkan key lengkap dalam riwayat, toast, pesan error, atau screenshot pengujian.
- Notifikasi umum menggunakan “Dokumentasi siap diperiksa” tanpa nama pasien.
- Teks pengguna dan keluaran AI dirender sebagai teks aman; jangan memperlakukan markup dari data sebagai HTML tepercaya.
- Nama dokter manual diberi konteks sebagai tujuan dokumen, bukan identitas yang telah diverifikasi sistem.
- Ekspor menyatakan status draf dan asal penyusunan; jangan menyebut AI menentukan diagnosis atau aplikasi menyetujui klaim.
- Detail kesehatan ditampilkan hanya dalam konteks sesi yang sengaja dibuka, bukan sebagai cuplikan di Beranda.

Ketentuan ini adalah kebutuhan produk dan desain. Dokumen ini tidak menyatakan aplikasi telah memenuhi sertifikasi keamanan, persyaratan institusi, atau kepatuhan hukum tertentu.

## 14. Aksesibilitas dan cara memeriksanya

Target web adalah WCAG 2.2 AA. Klaim “sesuai” baru dibuat setelah seluruh kriteria yang berlaku diperiksa pada implementasi, bukan hanya karena token warnanya lolos.

| Area | Kriteria desain dan pengujian |
|---|---|
| Kontras teks | Teks normal minimal 4,5:1; teks besar minimal 3:1. Dokumen ini memilih ≥4,5:1 untuk semua pasangan teks utama agar implementasi lebih sederhana |
| Kontras kontrol | Batas/indikator visual yang diperlukan untuk mengenali kontrol memenuhi minimal 3:1 terhadap warna bersebelahan |
| Target sentuh | Standar produk 48 × 48 CSS px pada web dan sekitar 48 logical px pada Flutter; ukuran visual ikon boleh lebih kecil |
| Navigasi keyboard | Semua aksi dapat dicapai dan diaktifkan; urutan fokus sesuai urutan baca |
| Fokus | Ring 2px dengan offset; fokus tidak tertutup sticky composer, sheet, atau navigasi |
| Struktur | Satu judul utama; hierarki heading logis; label input terhubung; daftar dan tombol memiliki semantik yang benar |
| Pembaca layar | Status proses diumumkan tanpa membaca ulang seluruh transkrip setiap token; nama tombol menjelaskan tindakan |
| Pembesaran | Teks 200% tetap terbaca dan dapat dipakai; reflow diuji pada 320 CSS px dan zoom yang menghasilkan lebar ekuivalen |
| Form | Error terhubung melalui `aria-describedby`/semantik native; bukan warna merah saja |
| Autentikasi | Paste, autofill, dan password manager tidak diblokir |
| Motion | Animasi dekoratif dapat dikurangi; informasi tidak bergantung pada animasi |
| Suara | Tombol manual dan status teks selalu tersedia; perintah suara bukan satu-satunya metode kontrol |

WCAG 2.2 AA menetapkan target minimum 24 × 24 CSS px atau kondisi jarak/pengecualian yang ditentukan; **48 × 48 adalah keputusan produk ini**, bukan angka minimum WCAG AA. Lihat [Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

Dasar batas kontras: [Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Pemeriksaan fokus dan layout: [Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) dan [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html). Ketentuan lain merujuk pada [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

Untuk Flutter, periksa label `Semantics`, TalkBack/VoiceOver, pembesaran teks, dan transisi kembali ke WebView. Uji ini melengkapi pemeriksaan web; unit CSS dan logical pixel tidak dianggap identik dengan ukuran fisik pada semua perangkat.

## 15. Urutan implementasi dan dependensi

### 15.1 Tahap A — fondasi dan copy

Prioritas pertama, dampak langsung pada semua layar:

- Sinkronkan token [CSS](../web/public/style.css), [tema Flutter](../app/lib/theme.dart), dan [widget native](../app/lib/widgets/hub_ui.dart).
- Ganti gradien umum, radius berlebihan, shadow kartu, serta warna status dekoratif.
- Samakan istilah navigasi dan pemetaan tab induk.
- Perbaiki copy kemampuan, label legacy `terkirim`, dan fallback AI.
- Perbaiki ukuran kontrol, focus state, safe area, dan jarak bawah.
- Audit copy lama yang masih menyebut teman, review dokter, atau profil peran.

### 15.2 Tahap B — susunan tugas

- Susun ulang Beranda, Bot, Provider & Agent, serta Pengaturan.
- Satukan form persiapan BPJS.
- Pisahkan pilihan ekspor dari klaim pengiriman.
- Tingkatkan halaman draf sebagai dokumen yang mudah dibaca.
- Tambahkan state loading/empty/error yang berbeda pada setiap sumber data.

### 15.3 Tahap C — perubahan perilaku yang diperlukan

| Target | Dependensi | Perilaku sebelum dependensi selesai |
|---|---|---|
| Chat tidak hilang ketika pindah tab | State/store di luar fungsi render | Beri keterangan keterbatasan; jangan menjanjikan riwayat permanen |
| Uji koneksi provider | Request uji dan pemetaan error | Gunakan status Tersimpan |
| Status VPN akurat setelah resume | Query/event native dan lifecycle | Tampilkan Memeriksa atau status belum diketahui |
| Retry penyusunan draf tanpa rekam ulang | Retensi transkrip aman dan request yang tidak menggandakan sesi | Tampilkan data yang masih tersedia; jangan mengarang autosave |
| Koreksi draf | Penyimpanan edit, versi, dan kegagalan simpan | Baca-saja dengan ekspor DOCX |
| Ekspor sesi historis dari native | Bridge/deep link berdasarkan ID, pemuatan data | Salin teks pada web sesuai baseline |
| Status ekspor terpisah | Model event, migrasi legacy, hasil platform | Label legacy konservatif dan penjelasan |
| Identitas pembicara akurat | Diarization atau koreksi manual yang disimpan | Pembicara belum diverifikasi |
| Audio replay/timestamp | Penyimpanan audio dan offset valid | Jangan tampilkan kontrol pemutar atau penanda waktu palsu |
| Offline/pemulihan lintas restart | Penyimpanan lokal terlindungi, sinkronisasi, kebijakan konflik | Tampilkan batas kemampuan dan status belum tersimpan |

### 15.4 Tahap D — validasi

Lakukan pemeriksaan visual web, pengujian interaksi, dan pengujian native pada perangkat. Screenshot lama dan kelulusan lint tidak membuktikan rekaman, ekspor, tunnel VPN, atau penggunaan pembaca layar telah bekerja.

Untuk perubahan desain nanti, gunakan pengujian yang tersedia di [web/tests/ui_smoke.py](../web/tests/ui_smoke.py) dan [app/test/widget_test.dart](../app/test/widget_test.dart), setelah menyesuaikan fixture/asersi yang masih mewakili arsitektur lama. Penulisan dokumen ini sendiri tidak memerlukan menjalankan build aplikasi.

## 16. Rencana evaluasi pengguna dan kriteria penerimaan

### 16.1 Skenario uji

Gunakan peserta pengguna AI umum dan perawat/operator yang mewakili konteks kerja; dokter dapat menilai keterbacaan keluaran dokumen. Mulai dengan sesi formatif kecil, misalnya 5–8 peserta total, lalu perluas bila hambatan antarsegmen berbeda. Jumlah tersebut adalah rencana awal, bukan jaminan cakupan masalah.

| Skenario | Bukti yang dicari |
|---|---|
| Tambah provider yang belum dikenal otomatis | Peserta menemukan mode manual dan memahami belum ada uji koneksi |
| Kirim chat lalu pindah layanan | Peserta tahu layanan mana yang menerima pesan dan apakah konteks ikut berpindah |
| Mulai dokumentasi BPJS | Identitas pasien/tujuan benar dan peserta memahami kapan mikrofon aktif |
| Izin mikrofon ditolak | Peserta menemukan tindakan pemulihan tanpa mengulang seluruh isian |
| Provider AI gagal | Peserta memahami transkrip mentah berbeda dari draf AI |
| Salin/ekspor kemudian batalkan share | Peserta tidak mengira dokter telah menerima dokumen |
| Buka riwayat lama berstatus `terkirim` | Peserta memahami keterbatasan bukti status legacy |
| Atur OpenVPN/SSH | Peserta memahami konfigurasi tersimpan belum berarti tunnel tersedia |
| Gunakan teks besar dan pembaca layar | Semua tindakan penting dapat ditemukan dan dijalankan |

### 16.2 Target evaluasi

- ≥90% penyelesaian tugas rutin tanpa bantuan fasilitator sebagai target awal, bukan hasil yang sudah tercapai.
- Tidak ada kesalahan kritis pada salah pasien, mikrofon aktif tanpa disadari, atau asumsi dokumen sudah diterima dokter. Jika terjadi, revisi desain dan uji ulang.
- Catat waktu per tugas, jumlah salah tekan, titik ragu, dan komentar pemahaman; bandingkan dengan baseline aktual, bukan angka waktu yang dibuat-buat.
- Keterbacaan transkrip dan draf dinilai melalui tugas menemukan informasi, bukan hanya pertanyaan “apakah desainnya bagus?”.
- Analitik pengujian mencatat event dan durasi minimum yang diperlukan; tidak menyertakan transkrip pasien atau kredensial.

### 16.3 Checklist sebelum implementasi dinyatakan selesai

**Visual dan navigasi**

- [ ] Beranda, Chat, Bot, VPN, Pengaturan konsisten di seluruh jalur.
- [ ] Tidak ada navigasi ganda di native/WebView.
- [ ] Tidak ada pemotongan label penting pada lebar 320, 360, 390, 768, dan 1024+.
- [ ] Konten terakhir tidak tertutup bottom navigation atau sticky action.
- [ ] Warna, radius, ukuran teks, dan ikon memakai token yang disepakati.
- [ ] Data contoh hanya berada pada fixture/mockup.

**Interaksi dan integritas status**

- [ ] Setiap request memiliki loading, gagal, dan pemulihan yang jelas.
- [ ] Tidak ada submit ganda atau input hilang karena refresh tampilan biasa.
- [ ] Key tersimpan tidak diberi label koneksi terverifikasi.
- [ ] Mikrofon hanya dinyatakan aktif berdasarkan keadaan perangkat.
- [ ] Fallback transkrip tidak disamakan dengan draf AI.
- [ ] Salin/ekspor/batal share tidak disamakan dengan dokumen diterima.
- [ ] Status VPN berasal dari perangkat; browser dan protokol unsupported jelas.
- [ ] Tombol kembali, logout, serta perpindahan akun menangani pekerjaan yang belum tersimpan.

**Aksesibilitas dan platform**

- [ ] Kontras setiap state diperiksa, bukan hanya warna dasar.
- [ ] Target sentuh produk, fokus, urutan keyboard, dan label aksesibel terpenuhi.
- [ ] Zoom, text scaling, landscape, keyboard terbuka, dan safe area diuji.
- [ ] TalkBack/VoiceOver tidak membaca transkrip ulang setiap pembaruan kecil.
- [ ] Pembatasan izin, jaringan terputus, background/resume, dan native bridge gagal diuji.
- [ ] Ekspor multi-halaman terbaca dan tetap menampilkan status draf.

## 17. Referensi dan pemeliharaan dokumen

Referensi eksternal diperiksa pada 2 Oktober 2026. Standar aksesibilitas dan heuristik menyediakan dasar; token, struktur halaman, serta keputusan cakupan di dokumen ini disusun khusus untuk implementasi AI Hub yang diaudit.

- [WCAG 2.2 — W3C](https://www.w3.org/TR/WCAG22/): acuan persyaratan aksesibilitas web.
- [10 Usability Heuristics — Nielsen Norman Group](https://www.nngroup.com/articles/ten-usability-heuristics/): evaluasi status, konsistensi, kontrol, pencegahan dan pemulihan kesalahan.
- [Fitts’s Law — Nielsen Norman Group](https://www.nngroup.com/articles/fitts-law/): ukuran dan jarak target interaksi.
- [Hick’s Law — Nielsen Norman Group](https://www.nngroup.com/videos/hicks-law-long-menus/): kompleksitas pilihan.
- [Jakob’s Law — Nielsen Norman Group](https://www.nngroup.com/articles/end-of-web-design/): ekspektasi pola yang sudah dikenal.
- [Proximity — Nielsen Norman Group](https://www.nngroup.com/articles/gestalt-proximity/): pengelompokan melalui jarak.
- [Similarity — Nielsen Norman Group](https://www.nngroup.com/articles/gestalt-similarity/): konsistensi visual berdasarkan fungsi.

Perbarui dokumen ini ketika rute, model status, metode penyimpanan, atau kemampuan native berubah. Catat perubahan sebagai baseline baru, perbarui microcopy dan state terkait, lalu ulangi pengujian pada alur yang terdampak.
