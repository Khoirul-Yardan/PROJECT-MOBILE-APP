# Mastra Test dan skills Chat

> **Pembaruan 20 Oktober 2026:** setup baru memakai satu kode koneksi agent, bukan key Gemini pengguna. Ikuti [panduan koneksi Mastra](MASTRA-KONEKSI.md). Bagian BYOK di bawah dipertahankan sebagai dokumentasi integrasi lama `format: mastra`, yang masih didukung untuk kredensial tersimpan.

Tanggal: 19 Oktober 2026. Status: integrasi lokal Docker, bukan deployment Fly. Panduan operasional HP ada di [README utama](../README.md).

## Tujuan dan batas akademik

Permintaan pengguna: proyek `mastra-test`, provider awal Gemini (`google`), dapat dipilih dan diuji melalui Chat, skills mengikuti provider, penggunaan awal melalui Docker. Posisi fitur adalah pendukung hub AI umum. Pipeline rekaman, STT, relabel, dan draf Bot BPJS tidak berubah. Tidak ada akun dokter, diagnosis AI, perubahan skema/RLS, atau perekaman dokter.

## Jalur permintaan

1. Pengguna menyimpan key Google di entri **Mastra Test (Gemini)** menggunakan enkripsi dan RLS kredensial yang sudah ada.
2. Chat membaca key milik pengguna, mengirim riwayat aktif ke `/mastra/ai-hub/chat`.
3. nginx meneruskan hanya endpoint `health`, `capabilities`, dan `chat` ke container Mastra pada port 4111.
4. Agent Mastra memakai Gemini dengan key dari permintaan tersebut. Key tidak ditulis ke `process.env`, file, storage, maupun log.
5. Balasan dikembalikan ke Chat. Riwayat tetap ditangani `chat-history.js` milik akun AI Hub, bukan memory bersama Mastra.

Port Studio hanya dipublikasikan di `127.0.0.1:4111`. Agent integrasi tidak memakai filesystem/shell, memory, penyimpanan lokal percakapan, atau exporter observability. Tool kalkulator menghitung dua angka dengan operasi terbatas; tidak mengeksekusi kode bebas. Tool waktu menerima zona waktu IANA.

Server lokal ini bukan layanan publik siap produksi. Endpoint chat menggunakan key Google milik pemanggil dan tidak memakai key Studio sebagai fallback. Key salah/missing tidak memperoleh key server. Sebelum deployment publik diperlukan autentikasi/rate limiting operasional tersendiri. Jangan memakai data pasien nyata untuk eksperimen ini.

## Kontrak HTTP

URL dasar Docker dari halaman AI Hub: `<origin>/mastra`. URL langsung server host: `http://localhost:4111`. Semua respons sukses menyertakan `protocol: "ai-hub-mastra-v1"`.

| Metode/path | Isi |
|---|---|
| `GET /ai-hub/health` | Status server; tidak memanggil Google |
| `GET /ai-hub/capabilities` | Daftar tools agent dan pilihan model integrasi |
| `POST /ai-hub/chat` | Header `Authorization: Bearer <key-Google>`; body `{model, messages:[{role,content}]}`; balasan `{protocol,text}` |

Server memvalidasi ukuran input, role, isi pesan, dan model Google yang diizinkan. Percakapan baru hanya mengirim riwayat baru. Error 400 untuk input tidak valid, 401 untuk key kosong/ditolak, 429 untuk kuota, dan 502/504 untuk masalah upstream. Isi error upstream tidak diteruskan mentah agar key/permintaan tidak bocor.

Kontrak tersebut milik proyek ini. Mastra Cloud token, API key provider lain, dan URL Mastra tanpa adapter ini tidak otomatis kompatibel. Tidak ada pola universal untuk mendeteksi sebuah key sebagai “Mastra”; pengguna memilih koneksi Mastra secara eksplisit.

## Skills yang ditampilkan

Istilah “skills” di Chat mencakup perintah lokal, toggle hosted tools, dan kemampuan yang dilaporkan agent. Ketiganya mengikuti jalur API yang benar:

| Koneksi | Mekanisme |
|---|---|
| Gemini | `google_search`, `code_execution`, `url_context` pada request Gemini |
| OpenAI | Responses `/v1/responses`, `store:false`, `web_search`/`code_interpreter`; hanya endpoint resmi dan model dalam allowlist |
| OpenRouter | `plugins: [{id:"web"}]` pada chat completions |
| Claude | Messages API dengan `web_search_20250305`; hanya keluarga model yang mendukung |
| Mastra | Discovery `/ai-hub/capabilities`; daftar tools berasal dari tools yang diregistrasikan |
| Hermes A2A | Agent card modern, fallback path legacy pada 404; discovery memakai bearer token |

`/help` memuat skills agent yang telah ditemukan; `/skills` memuat ulang. Kegagalan discovery terlihat dan dapat dicoba kembali. Toggle tersaring berdasarkan provider/model saat pengiriman agar tidak bocor ke koneksi lain. Sumber web dikembalikan sebagai URL yang dapat diketuk. Biaya dan akses tools tetap mengikuti provider.

Tidak semua fitur UI vendor merupakan API yang tersedia. Hermes API Server/OpenClaw belum memiliki discovery skills dalam adapter aplikasi; perintah tetap diteruskan ke agent. Groq/Nous/custom tidak diberi tools OpenAI hanya karena kompatibel chat completions. MCP, file search, computer use, upload, dan skills coding assistant belum dihubungkan ke Chat. Klaim “semua skills vendor aktif” tidak dibuat.

## Menjalankan dan menguji

```powershell
docker compose -f web/docker-compose.yml --profile mastra up -d --build web relay mastra
adb reverse tcp:8090 tcp:8090
```

Browser HP: `http://localhost:8090`. APK debug: `flutter run --dart-define=WEB_HUB_URL=http://localhost:8090` dari `app/`. APK release lama tetap menuju Fly. Studio laptop: `http://localhost:4111`; untuk HP tambahkan reverse port 4111. Akses LAN melalui browser perlu HTTPS untuk Web Crypto; USB localhost adalah jalur pengujian utama.

Studio dapat melihat konfigurasi tanpa key. Generasi langsung di Studio memerlukan `GOOGLE_API_KEY` di `.env` lokal; Chat AI Hub tidak membutuhkan key server karena membawa key pengguna.

Checklist uji nyata oleh pengguna:

- Login akun sendiri, tambahkan Mastra dan key Google yang memiliki kuota.
- Kirim sapaan; pastikan balasan masuk ke chip Mastra.
- Coba `/calculate hitung 6 dikali 7` dan `/current_time waktu Asia/Jakarta`.
- Kirim pertanyaan lanjutan; mulai sesi baru dan pastikan konteks lama tidak ikut.
- Pilih Gemini langsung: daftar skills berubah menjadi search/code/url; kembali ke Mastra: tools Mastra muncul.
- Hapus/nonaktifkan key: error harus jelas tanpa menampilkan key/isi permintaan di log.
- Putuskan USB: jalankan reverse lagi; periksa reload web lokal pada HP.

Tes otomatis: `python web/tests/mastra_skills_smoke.py` memeriksa adapter/UI memakai fixture; `python web/tests/ui_smoke.py` memeriksa 13 halaman pada 4 ukuran layar. Keduanya tidak membuktikan kuota atau keberhasilan generasi Gemini nyata. Typecheck, tes server, dan build dijalankan dari `mastra-test/`; hasil akhir dicatat di HANDOFF.

## Sumber teknis

- [Mastra quickstart](https://mastra.ai/docs), [custom API routes](https://mastra.ai/docs/server/custom-api-routes), dan [model router dengan ribuan model](https://mastra.ai/models).
- [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search) dan [Code Interpreter](https://developers.openai.com/api/docs/guides/tools-code-interpreter).
- [Gemini URL context](https://ai.google.dev/gemini-api/docs/url-context), [Claude web search](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool), [OpenRouter web search](https://openrouter.ai/docs/guides/features/plugins/web-search).

Versi paket dikunci melalui `package-lock.json`. Nama model registry tidak menjamin akses key tertentu; hasil uji nyata harus dicatat terpisah dari tes fixture.
