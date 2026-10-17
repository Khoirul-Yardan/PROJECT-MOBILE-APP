# Pengujian Minggu Ini (17 Oktober 2026)

Pengujian menyeluruh di Docker dan terminal laptop. Pengujian di HP/emulator sengaja ditaruh paling akhir (lihat `05-perlu-hp-emulator.md`) karena butuh Anda.

## Lingkungan

| Komponen | Versi / keterangan |
|---|---|
| OS | Windows 11 Home |
| Docker | 29.4.1 (Docker Desktop) |
| Node / Python | v26.7.0 / 3.10.0 (Playwright + Chrome, mode headless) |
| Flutter | 3.47.4 stable |
| Basis kode | branch `setup/dua-cli`, di atas commit `8c1e93e` |
| Yang tidak disentuh | Supabase asli, server VPN asli (`kp-la-2.ovpn`), proyek Docker lain di laptop (`darsi-cs-*`) |

## Ringkasan hasil

| # | Area | Cara | Hasil akhir | Detail |
|---|---|---|---|---|
| 1 | Sintaks JS web | `node --check` semua `web/public/**/*.js` | Lulus | 01 |
| 2 | Logika Gemini | `node --test web/tests/gemini.test.mjs` | 14/14 lulus (awal 12/14, tes usang diperbarui) | 01 |
| 3 | UI smoke (13 rute x 4 lebar layar) | Playwright `ui_smoke.py` | Lulus (awal gagal, fixture usang diperbaiki) | 01 |
| 4 | Pemilihan model + fallback Gemini | `model_smoke.py` | Lulus (awal gagal, 2 asersi usang diperbarui) | 01 |
| 5 | Palet "/" skill di Chat | `e2e_skills.py` | 12/12 lulus | 01 |
| 6 | Login OAuth OpenRouter (PKCE, ditiru) | `e2e_oauth.py` | 14/14 lulus | 01 |
| 7 | Layar VPN, Terminal, Riwayat BPJS | `e2e_vpn_bpjs.py` | 11/11 lulus (awal 10/11) | 01 |
| 8 | Build dan jalan di Docker (web + relay) | `docker compose up --build`, cek HTTP | Lulus; halaman utama 200 | 01 |
| 9 | OpenVPN tiruan (login benar / salah / password key salah) | `TEST VPN/docker/test-client.sh` | 3/3 sesuai harapan | 02 |
| 10 | WireGuard + SSH lewat tunnel | `docker compose run wg-client` | Lulus | 02 |
| 11 | Preflight TCP OpenVPN (fitur baru) | `ovpn_preflight_docker_test.dart` terhadap server tiruan | Lulus (server hidup) dan port tertutup terdeteksi | 02 |
| 12 | RLS database dua akun + anon | Postgres 16 Docker, `app/supabase/tests/` | 31/31 lulus, `schema.sql` idempoten | 03 |
| 13 | Flutter analyze + test | Host | analyze: 0 error, 5 info lama; test: 10 lulus, 1 dilewati tanpa server tiruan | 04 |

## Temuan utama

1. **Banyak tes lama sudah usang, bukan aplikasinya rusak.** Fixture tes tertinggal dari kode (fungsi baru `fetchAll*`, `listCredentialSlots`, `sb.from`, teks UI berubah, Bot FAQ diganti Papan Komunikasi). Empat dari tujuh tes web gagal murni karena itu. Tanpa CI hal ini tidak terdeteksi. Rekomendasi: CI GitHub Actions (rencana Fase 2).
2. **Perilaku Gemini 503 sesuai keputusan produk** (retry 2x lalu pindah model hingga 5 kandidat); hanya tesnya yang masih menuliskan perilaku lama.
3. **RLS kuat untuk data pasien:** akun B tidak bisa membaca, mengubah, menghapus, atau menyisipkan data akun A; anon hanya bisa memakai dua RPC Papan Komunikasi (token valid, panjang dibatasi, anti-spam). Catatan desain: `profiles` terbaca semua pengguna login (nama, peran, bio).
4. **Server VPN tiruan lengkap berfungsi**, jadi masalah VPN asli yang hanya jalan di laptop Anda bukan pada kode OpenVPN/WireGuard aplikasi, setidaknya pada skenario tiruan. Penyebabnya masih perlu diagnosa di laptop (lihat 02 dan 05).
5. **Belum ada e2e untuk Papan Komunikasi** selain uji render halaman; Anamnesis Terpandu dan Bot BPJS (mikrofon, AssemblyAI) hanya bisa diuji di perangkat.

## Hal yang tidak diuji dan alasannya

| Hal | Alasan |
|---|---|
| `e2e_docker.py` | Butuh `OPENAI_API_KEY` asli; tidak dipakai |
| Jalur relay AssemblyAI tanpa kunci (503) | `web/.env` berisi kunci, jalur itu tidak bisa dicoba tanpa mengubah konfigurasi |
| Supabase asli (RLS di server sungguhan, Realtime) | Tidak diakses; RLS diuji di Postgres tiruan dengan skema yang sama |
| VPN asli `kp-la-2.ovpn` | Hanya bisa di laptop Anda (OpenVPN + Termius) |
| HP/emulator | Lihat `05-perlu-hp-emulator.md` |

## Kejadian yang perlu diketahui (transparansi)

- Saat memeriksa relay, saya mengirim `POST /relay/assemblyai/upload` dengan isi `x`. Karena `web/.env` berisi kunci AssemblyAI, permintaan itu diteruskan ke AssemblyAI sungguhan dan dijawab 200. Dampak sangat kecil (satu unggahan 1 byte); tidak diulang.
- Build Docker pertama sempat macet karena Docker Desktop baru menyala dan menghidupkan proyek lain di laptop; build diulang dan berhasil. Kontainer proyek lain tidak disentuh.
- Perubahan pada tes (file `web/tests/*`) saya kerjakan langsung walau area itu milik Codex, karena penyebabnya sudah pasti dan perbaikannya kecil. Dicatat di `DAFTAR-BUG.md`.
- Gambar tangkapan layar yang dihasilkan tes (`Images/UjiTest/`) saya kembalikan ke versi sebelumnya supaya riwayat git tidak berisik.

## Cara mengulang

```sh
# web + relay
cd web && docker compose up -d --build
cd .. && node --test web/tests/gemini.test.mjs
python web/tests/ui_smoke.py && python web/tests/model_smoke.py
python -m http.server 8091 --directory web/public &      # lalu:
E2E_ORIGIN=http://localhost:8091 python web/tests/e2e_skills.py
E2E_ORIGIN=http://localhost:8091 python web/tests/e2e_oauth.py
python web/tests/e2e_vpn_bpjs.py
# VPN tiruan
cd "TEST VPN/docker" && PUBLIC_HOST=127.0.0.1 docker compose up -d --build && ./test-client.sh
cd ../wireguard && docker compose up -d --build && docker compose run --rm wg-client
# RLS
bash app/supabase/tests/run-rls-test.sh
# Flutter
cd app && flutter analyze --no-pub && OVPN_FILE="../TEST VPN/docker/out/kp-la-test.ovpn" flutter test --no-pub
```
