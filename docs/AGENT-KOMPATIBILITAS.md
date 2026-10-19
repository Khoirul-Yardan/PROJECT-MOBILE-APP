# Pengenalan key dan kompatibilitas agent

Diperiksa 20 Oktober 2026 melalui dokumentasi resmi dan kode lokal. Cakupan implementasi: koneksi yang sudah ada, ditambah koreksi jalur HTTP OpenClaw. DeepSeek/harness lain tidak diklaim otomatis kompatibel hanya berdasarkan nama. Halaman Agent tetap satu input, dengan daftar **Dikenal otomatis dari pola key-nya** di bawahnya.

## Tiga hal yang berbeda

1. **Pola key** membantu mengenali kemungkinan penerbit credential; belum membuktikan key valid/berkuota.
2. **Protokol API** menentukan bagaimana aplikasi memanggil server. URL OpenAI-compatible tidak membuktikan bahwa server itu OpenAI, Hermes, atau OpenClaw.
3. **Agent/harness** memakai model/provider di belakangnya. Key Gemini/DeepSeek tidak memberi tahu nama agent, lokasi server, atau konfigurasi harness.

Tidak ada klaim “semua agent dapat dikenali dari API key”. Yang dijamin aplikasi adalah parser/adapter untuk format yang didukung, status yang membedakan pola/pilihan/discovery, serta error saat kontrak tidak cocok.

## Daftar pola yang benar-benar dipakai aplikasi

| Label | Pola lokal | Batas |
|---|---|---|
| ChatGPT/OpenAI | `sk-proj-…` | `sk-…` umum tidak lagi dideteksi sebagai OpenAI |
| Claude | `sk-ant-api…` | Token OAuth/setup `sk-ant-oat…` bukan API key Messages |
| Gemini | `AIza…` atau `AQ.…` | Key Google tidak berarti agent Mastra; akses model/kuota diuji saat panggilan |
| OpenRouter | `sk-or-v1-…` | Credential provider, bukan bukti framework agent |
| Groq | `gsk_…` | Credential provider |
| Nous Portal / Hermes API model | `sk-nous-…` | Bukan token gateway Hermes Agent milik pengguna |

Pola di atas adalah aturan pengenal pada katalog aplikasi, bukan kontrak universal yang dijamin selamanya oleh vendor. Input tidak dikenal tetap dapat dipilih/dikonfigurasi manual. Tidak dilakukan probing key ke banyak vendor untuk menebak pemiliknya.

## Hasil pemeriksaan dokumentasi dan dukungan

| Produk/jalur | Fakta dokumentasi resmi | Dukungan AI Hub |
|---|---|---|
| Mastra | Auth dapat dikonfigurasi memakai token mapping, JWT, atau penyedia identitas. Tidak ada format token yang harus dipakai semua deployment. [Mastra Auth](https://mastra.ai/docs/auth/overview) | Kode `aihub-mastra-v1.` dan URL `/ai-hub/agents/{id}` dikenali sebagai **format adapter AI Hub**. Discovery terautentikasi membaca identitas/provider; server wajib memasang adapter. |
| Hermes Agent A2A | Agent card ada di `/.well-known/agent-card.json`; JSON-RPC menerima alias `message/send`; credential dapat memakai token per-peer atau bearer bersama. [Hermes A2A](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/a2a) | URL+token dipilih manual; adapter A2A dan discovery tersedia. Nama/token umum tidak cukup untuk auto-detection. |
| Hermes Agent API Server | Server OpenAI-compatible memakai `API_SERVER_KEY` dan `/v1/chat/completions`. [Hermes API Server](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server) | URL base atau `/v1` dinormalisasi ke endpoint chat; body menargetkan `hermes-agent`. Tidak menganggap key Nous Portal sebagai token server ini. |
| OpenClaw Gateway HTTP | Endpoint `/v1/chat/completions` harus diaktifkan; bearer memakai token/password Gateway; target default `openclaw/default`. [OpenClaw HTTP API](https://docs.openclaw.ai/gateway/openai-http-api) | Pilihan **OpenClaw Gateway (HTTP resmi)** memakai format `openclaw-http`, relay/native, dan request chat completions. URL base atau `/v1` dilengkapi otomatis. Jalur webhook lama tetap hanya untuk kompatibilitas plugin lama. |
| DeepSeek | API model memakai format kompatibel OpenAI; dokumentasi integrasi menyebut key berawalan `sk-`. [DeepSeek API](https://api-docs.deepseek.com/), [integrasi Copilot](https://api-docs.deepseek.com/quick_start/agent_integrations/github_copilot/) | `sk-` umum ambigu dan tidak dikirim otomatis ke OpenAI. DeepSeek bukan otomatis nama harness. Bisa dikonfigurasi melalui API OpenAI-compatible jika endpoint/model sudah diketahui; belum diuji live pada tugas ini. |
| Harness lain | Sebagai contoh, AgentController Mastra adalah lapisan sesi/mode/tool di sekitar agent; bukan penerbit API key tersendiri. [Mastra AgentController](https://mastra.ai/docs/harness/agent-controller) | Nama “harness” saja belum menentukan kontrak HTTP. Pengguna mengarahkan agar memakai integrasi yang ada dahulu; produk lain memerlukan dokumentasi endpoint sebelum adapter baru dibuat. |

Key Gemini yang baru dapat berbentuk authorization key yang terikat identitas, dan key provider tetap di server Mastra pada alur agent. [Dokumentasi key Gemini](https://ai.google.dev/gemini-api/docs/api-key).

OpenClaw menjelaskan bahwa bearer Gateway memberikan akses operator, sehingga pemilik perlu memakai jaringan/ingress privat yang sesuai. AI Hub tidak mengubah izin server. Pembacaan skills tidak membuktikan semua kemampuan CLI/UI framework sudah terhubung.

## Bukti uji dan batasnya

- Fixture browser: daftar pengenal, key ambigu `sk-` tidak dianggap OpenAI, OAuth Claude tidak dianggap API key, slot tambahan Hermes tetap tersedia, Mastra discovery/chat, serta request OpenClaw HTTP (endpoint normalisasi, model `openclaw/default`, dan body messages).
- Uji live memakai akun uji yang ditunjuk pengguna dan server Mastra Docker lokal. Tidak menulis key/password ke laporan atau source. Hasil per tahap dicatat di HANDOFF; pengujian ini bukan tes live seluruh provider.
- Hasil live 20 Oktober 2026: login berhasil; discovery HTTP 200; provider Google/model `google/gemini-2.5-flash`; koneksi tersimpan dengan enkripsi/RLS yang sudah ada; chat HTTP 200; jawaban hitungan fiktif memuat 42 dan terlihat di UI. Key provider dikonfigurasi karena `.env` sebelumnya belum ada. Setelah tes browser sign out, koneksi dan sesi uji tetap tersimpan.
- Skrip opt-in `web/tests/mastra_live.py` menerima path JSON login privat dan `.env` Mastra. Script membuat koneksi pada akun, memulai sesi baru, mengirim satu hitungan fiktif, kemudian sign out. Jangan gunakan akun/data pasien untuk pengujian ini. Kredensial dan percakapan uji yang berhasil tersimpan tetap ada agar dapat diperiksa pengguna.
- Pengujian fixture tidak membuktikan gateway Hermes/OpenClaw milik pengguna sedang hidup. Identitas provider yang dilaporkan Mastra merupakan deklarasi server, bukan attestation independen.

Panduan kode koneksi: [MASTRA-KONEKSI.md](MASTRA-KONEKSI.md).
