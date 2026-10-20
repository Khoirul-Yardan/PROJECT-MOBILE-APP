# Mastra lokal, screenshot laptop, dan batas bukti uji

Tanggal: 20 Oktober 2026. Tambahan Chat umum, terpisah dari pipeline PA. Windows + Docker Desktop Linux containers. Tidak dipush atau deploy ke Fly.

## API Mastra didapat dari mana?

Mastra adalah framework. Untuk server contoh **milik kita sendiri**, bukan membeli API key universal Mastra:

- `GOOGLE_API_KEY`: key model Google milik pemilik server, sudah berada pada `.env` lokal; jangan dibagikan ke pemakai Chat.
- `AI_HUB_AGENT_TOKEN`: token akses server kita, berbeda dari key Google.
- Kode koneksi AI Hub: mengemas URL server, ID `ai-hub`, dan token agent. Pengguna menempelkannya di **Hubungkan Agent**.

Dari root proyek, buat file baru (jangan timpa file kode yang ada):

```powershell
cd mastra-test
node --env-file=.env scripts/connection-code.mjs http://localhost:8090/mastra ai-hub laptop.connection.txt
```

Buka file tersebut sendiri dan salin seluruh isinya ke Hubungkan Agent. Tekan Periksa, Simpan, lalu pilih **Mastra · Mastra Test (Google)** di Chat. Untuk HP USB, jalankan `adb reverse tcp:8090 tcp:8090`; URL yang sama tetap berlaku. Kode adalah credential rahasia, bukan contoh untuk dimasukkan laporan.

Mastra model router menyediakan akses ke ribuan model: [katalog resmi](https://mastra.ai/models). Key, kuota, dan dukungan tools tetap mengikuti provider/model. Server contoh ini memakai Gemini; daftar ribuan model bukan berarti semuanya sudah dikonfigurasi pada server kita. [Dokumentasi Mastra](https://mastra.ai/docs).

## Menjalankan screenshot dan kontrol laptop

Container Linux tidak melihat desktop Windows secara langsung. Bridge kecil di host menangkap layar utama melalui Windows dan menerima aksi terbatas dari Mastra. Tidak ada port host yang dipublikasikan ke LAN: bridge mendengarkan `127.0.0.1:4112`; Docker Desktop menjangkaunya melalui `host.docker.internal`.

Di terminal laptop pertama:

```powershell
python mastra-test/scripts/desktop_bridge.py --minutes 60
```

Pada pemakaian pertama, script membuat `AI_HUB_DESKTOP_TOKEN` acak di `.env` lokal. Di terminal kedua, muat konfigurasi tersebut:

```powershell
docker compose -f web/docker-compose.yml --profile mastra up -d --build web mastra
```

Di Chat Mastra:

```text
/skills
/computer screenshot
```

Balasan menyebut path PNG, dimensi, dan SHA-256. Berkas berada di `mastra-test/.desktop-captures/` dan diabaikan Git serta konteks Docker. Gambar **belum ditampilkan inline di Chat** dan **tidak dikirim ke model**. Ini bukti screenshot OS nyata, bukan screenshot halaman browser fixture.

Untuk mengizinkan klik dan navigasi, hentikan bridge dengan Ctrl+C lalu mulai sendiri dengan:

```powershell
python mastra-test/scripts/desktop_bridge.py --allow-control --minutes 60
```

```text
/computer click 400 300
/computer key TAB
/computer key ESC
```

Koordinat adalah piksel layar utama. Tombol yang diizinkan: TAB, ESC, UP, DOWN, LEFT, RIGHT. Satu aksi per pesan; tidak ada shell, pengetikan bebas, Enter, upload, atau loop kontrol otonom. Screenshot dapat dipakai pengguna untuk menentukan koordinat. Bridge mati otomatis setelah durasinya atau saat Ctrl+C. Beri akses token agent hanya kepada pemilik laptop selama fitur desktop diaktifkan. Permintaan berasal dari pemegang token agent, bukan identitas Supabase yang diverifikasi server.

Perintah `/computer` diproses deterministik oleh adapter yang sudah terautentikasi. Panggilan otomatis model, isi screenshot, dan riwayat percakapan tidak dapat mengizinkan aksi. Endpoint BYOK lama tidak memiliki akses bridge. Studio menampilkan tool beserta petunjuknya; aksi desktop harus dikirim melalui Chat AI Hub.

## Bukti yang sudah dijalankan

| Pemeriksaan | Hasil 20 Oktober | Batas bukti |
|---|---|---|
| Docker web, relay, Mastra | Berjalan; web dan Mastra dibangun ulang | Lokal, bukan Fly |
| TypeScript | Lulus `npm run typecheck` | Pemeriksaan statis |
| Tes Node Mastra | 14 lulus | Kontrak/auth/isolasi/desktop dengan mock transport |
| Bridge Windows | 3 tes lulus | Token salah, origin browser, kedaluwarsa, route salah ditolak; kontrol mati tidak menyentuh Windows |
| Skrip WER | 3 tes lulus | Negasi hilang, substitusi/sisipan, referensi kosong |
| Daftar skills | 1 tes regresi lulus | Nama vendor tidak otomatis menambahkan tools host atau klinis |
| Chat Mastra + Google nyata | HTTP 200; jawaban 6 × 7 = 42 terlihat | Account/history fixture, bukan login/simpan Supabase baru |
| Screenshot lewat Chat → Docker → Windows | HTTP 200; PNG tersimpan di laptop | Layar utama saja; tidak menguji klik nyata |
| Menu skills dan request provider | Lulus fixture Gemini, OpenAI, OpenRouter, Claude, Mastra/A2A | Bukan bukti semua key/provider berbayar aktif |
| UI dan kartu bot | 13 halaman × 4 ukuran layar lulus | Fixture |
| Bot BPJS | Navigasi dan `open_bot_bpjs` diuji | Rekaman HP, diarization, LLM, ekspor belum diuji ulang |
| Anamnesis Terpandu | Navigasi dan `open_anamnesis_terpandu` diuji | TTS/mikrofon dan hasil akhir HP belum diuji ulang |
| Papan Komunikasi | Navigasi, pilih nyeri 4/10, lokasi perut, pencatatan fixture | Suara HP, Realtime/RLS nyata belum diuji ulang |
| Hermes/OpenClaw server pengguna | Kontrak client/fixture tersedia | Tidak ada endpoint/token live untuk tes pada tugas ini |

Tes live yang bisa diulang (menggunakan `.env` lokal, tidak mencetak key):

```powershell
python web/tests/mastra_desktop_live.py --screenshot
python web/tests/ui_smoke.py
python web/tests/mastra_skills_smoke.py
```

## Checklist HP untuk menutup batas pengujian

Gunakan skenario fiktif S01/S02 dari [paket PA](PAKET-UJI-PA/README.md), bukan pasien nyata.

1. Jalankan Docker, sambungkan HP, `adb devices`, `adb reverse tcp:8090 tcp:8090`.
2. Buka build Flutter dengan `WEB_HUB_URL=http://localhost:8090`. APK Fly lama tidak menunjuk Docker.
3. Bot BPJS: rekam dua pemeran, berhenti, pastikan transkrip asli dan draf tampak; edit satu kata, buka ulang sesi, ekspor. Catat waktu dan kegagalan.
4. Anamnesis: dengarkan TTS, jawab via mikrofon, tuntaskan sesi, periksa draf. Catat sebagai sistem–pasien, bukan rekaman perawat.
5. Papan: pilih nyeri 4 dan perut; dengar TTS, cek catatan pada akun pemilik. Uji ruang dan penerimaan pesan memakai data fiktif jika fitur itu digunakan.
6. Chat: tempel kode, periksa, pilih Mastra, kirim hitungan dan `/computer screenshot` ketika bridge laptop aktif.
7. Uji penolakan izin mikrofon dan putus jaringan secara terpisah. Catat apa yang benar-benar terjadi, bukan mengisi otomatis “lulus”.

Pipeline/native tetap milik Claude sesuai AGENTS.md. Temuan yang membutuhkan perubahan Dart dicatat di HANDOFF.

Pemeriksaan ADB pada tugas ini tidak menampilkan perangkat terhubung. Karena itu pengujian rekaman/TTS/mikrofon belum dilakukan ulang di HP.
