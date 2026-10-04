# Model AI dan penggunaan di HP

## Memilih model

Di **Chat**, pilih asisten lalu ketuk **Pilih model** di bawah daftar asisten.
Pilihan yang sama tersedia di **Pengaturan → API & Agent → Pilih model**.

- Gemini: pilih model dari daftar API, pilih **Otomatis**, atau **Ketik ID model sendiri**.
- Provider lain dengan format OpenAI-compatible/Anthropic: masukkan ID model dari provider.
- Gateway OpenClaw tidak menampilkan pemilih, karena aplikasi tidak mengirim parameter model ke gateway itu.

Ketuk **Simpan model**. Model disimpan pada metadata provider milik akun,
tanpa mengganti endpoint atau menulis ulang API key. Tidak perlu migrasi database;
kolom `api_credentials.model` dan kebijakan update milik pengguna sudah tersedia.
Model manual digunakan untuk pesan berikutnya.

## Pemulihan Gemini

Endpoint permintaan dibangun dari model yang benar-benar dipilih. Endpoint lama
yang masih memuat `gemini-1.5-flash` tetap kompatibel; bagian model di URL diganti
saat mengirim, sementara host dan versi API dipertahankan.

Jika model mengembalikan 404/400 yang khusus menyatakan model tidak ditemukan
atau tidak mendukung metode itu, aplikasi mengambil daftar model melalui
[`models.list`](https://ai.google.dev/api/models), mengikuti pagination dan
memilih model chat yang mendukung `generateContent`. Model khusus gambar,
suara, embedding, live, dan robotics dikeluarkan dari pilihan chat otomatis.
Model Flash stabil diutamakan, tanpa mengunci nomor versi tertentu.

Maksimal tiga model pengganti dicoba untuk satu pesan; riwayat dan instruksi
sistem tetap sama. Error kunci API, izin, kuota, jaringan, server, dan penolakan
konten tidak memicu pergantian model. Daftar API belum menjamin sebuah model
dapat dipakai oleh akun; keberhasilan dikonfirmasi saat permintaan dijawab.

Pengganti model lama disimpan setelah jawaban berhasil. Jika penyimpanan gagal,
jawaban tetap ditampilkan dan pengguna diberi tahu bahwa pengganti hanya dipakai
di sesi berjalan. Pilihan **Otomatis** tetap tersimpan sebagai `auto`; model yang
berhasil dipakai kembali selama sesi itu. Koneksi Gemini baru memakai `auto`.
API key dikirim lewat header `x-goog-api-key`, bukan parameter URL.

## Penyesuaian HP

Header lebih ringkas, target sentuh minimum 44–48 px, input pesan 16 px untuk
menghindari zoom saat fokus, serta pemilih model berupa panel dari bawah.
Saat keyboard mengurangi viewport, navigasi bawah disembunyikan dan kolom pesan
tetap di area terlihat. Enter pada perangkat sentuh membuat baris baru; kirim
dengan tombol panah. Pada desktop, Enter tetap mengirim (Shift+Enter untuk baris baru).

## Validasi

- `node --test web/tests/gemini.test.mjs`: 14 kasus, termasuk 404, pagination,
  URL model manual, bounded retries, kuota, auth, safety, dan riwayat pesan.
- `python web/tests/ui_smoke.py`: 12 rute pada 320/390/768/1280 px.
- `python web/tests/model_smoke.py`: fallback, persistensi/manual, kegagalan
  penyimpanan/daftar model, provider lain, lebar HP 320/360/390/412 px dan viewport keyboard.
- Tes integrasi juga dijalankan terhadap Docker dengan
  `UI_SMOKE_ORIGIN=http://localhost:8090`; semua permintaan kredensial/API memakai fixture.

Validasi ini tidak memakai API key pengguna, tidak menghabiskan kuota Gemini,
dan memakai emulasi browser, bukan keyboard atau perangkat HP fisik.
