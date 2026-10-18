# 01 — Web dan Relay (Docker + Playwright)

## Build dan jalan
- `docker compose up -d --build` di `web/`: image `web-web` dan `web-relay` terbangun, kontainer `ai-hub-web` (port 8090) dan `ai-hub-relay` berjalan.
- `GET /` → 200. `GET /relay/` → 405 (relay hidup, metode GET tidak diizinkan, wajar).
- Percobaan pertama macet karena Docker Desktop baru menyala; diulang dan berhasil.

## Hasil per tes

| Tes | Awal | Akhir | Penyebab kegagalan awal | Perbaikan |
|---|---|---|---|---|
| `node --check` semua JS | lulus | lulus | | |
| `gemini.test.mjs` | 12/14 | 14/14 | Dua tes masih menuliskan perilaku lama: "503 berhenti tanpa pindah model" dan "maksimal 4 percobaan". Kode sekarang mencoba ulang 503 dua kali lalu pindah hingga 5 model (FR-GEMINI-01/02, `gemini.js`) | Tes diperbarui: 503 dicoba ulang lalu berhasil di percobaan ke-3; batas percobaan 6 |
| `ui_smoke.py` | gagal, timeout | lulus | (a) fixture `db.js`/`credentials.js` kekurangan ekspor baru (`fetchKomunikasiEvents`, `watchKomunikasi`, `deleteKomunikasiEvents`, `fetchAllBpjsDocuments`, `fetchAllBpjsTranscripts`, `deleteBpjsSession`, `countCredentialSlots`, `getCredentialKeySlots`, `listCredentialSlots`, `removeCredentialSlot`), sehingga modul tidak termuat; (b) `sb.from` tidak ada padahal Chat kini memuat riwayat lewat `chat-history.js`; (c) asersi "Segera Bot FAQ" usang: tiga bot kini semuanya aktif | Stub ditambah, `sb.from` berantai dibuat, asersi diganti "3 kartu bot Aktif"; rute `/papan-komunikasi` ditambahkan (13 rute x 4 lebar) |
| `model_smoke.py` | gagal | lulus | Teks UI berubah ("2 model ditemukan"); provider berformat openai kini juga punya daftar model, sehingga uji "ketik ID manual" pakai format anthropic | Dua asersi diperbarui |
| `e2e_skills.py` | 12/12 | 12/12 | | |
| `e2e_oauth.py` | 14/14 | 14/14 | | |
| `e2e_vpn_bpjs.py` | 10/11 | 11/11 | Halaman Riwayat kini memuat semua dokumen/transkrip sekaligus (`fetchAll*`), fixture masih memakai fungsi per-sesi lama | Override fixture ditambah |

## Cakupan yang masih kosong
- Papan Komunikasi hanya diuji sampai halaman terender; belum ada uji ketuk ikon, TTS, mode ruangan/realtime, offline.
- Mode pasien lewat tautan ruangan (`patientView`) belum diuji di UI (RPC-nya diuji di 03).
- `e2e_docker.py` tidak dijalankan (butuh kunci OpenAI asli).
- Relay `/relay/assemblyai/*`: tidak diuji dengan sengaja setelah kejadian satu panggilan nyata (lihat README).
