# AI Hub

Aplikasi mobile Android yang jadi hub terpusat untuk **chat multi-provider/agent AI**, **VPN pribadi**, dan **Bot BPJS** — asisten suara untuk dokumentasi klinis perawat-pasien.

Arsitekturnya hybrid: hampir seluruh UI adalah SPA vanilla JS (`web/`) yang disajikan container Docker dan dimuat dalam satu WebView persisten di dalam shell Flutter (`app/`). Hanya fungsi yang betul-betul butuh akses OS — mikrofon Bot BPJS, koneksi VPN WireGuard, penyimpanan config VPN — yang tetap native. Hasilnya: hampir semua perubahan (fitur baru, perbaikan bug, UI) bisa dirilis lewat `docker compose up --build`, tanpa submit ulang ke Play Store.

## Mulai cepat

```sh
# 1. Jalankan layer web (wajib — ini yang dimuat WebView di dalam app)
cd web
docker compose up -d --build
# tersedia di http://localhost:8090

# 2. Jalankan aplikasi Flutter
cd ../app
flutter pub get
flutter run
```

Testing di device Android fisik lewat USB butuh port-forward manual (sering ter-reset setelah install ulang APK):

```sh
adb reverse tcp:8090 tcp:8090
```

### Validasi sebelum commit

```sh
cd app
flutter analyze --no-pub
flutter test --no-pub
```

```sh
cd web/public
node --check <file-yang-diubah>.js
```

## Struktur Proyek

```
PROJECT MOBILE APP/
├── app/                    # Flutter — cangkang native tipis
│   ├── lib/
│   │   ├── main.dart                  # setup immersive nav bar
│   │   ├── screens/
│   │   │   ├── splash_screen.dart
│   │   │   ├── web_shell_screen.dart  # WebView persisten + native bridge
│   │   │   └── bot_bpjs_screen.dart   # 100% native: mic, STT, review, export
│   │   └── services/                  # VPN config, tunnel WireGuard, Supabase mirror
│   ├── android/                       # termasuk override compileSdk untuk wireguard_flutter
│   └── supabase/schema.sql            # skema database (7 tabel + RLS)
├── web/                    # SPA aktif — INI yang disajikan nginx, dimuat WebView
│   ├── public/
│   │   ├── views/                     # satu file per halaman (chat, history, vpn, dst.)
│   │   ├── providers.js               # katalog provider/agent + deteksi API key
│   │   ├── credentials.js             # penyimpanan key terenkripsi (multi-slot)
│   │   ├── ai.js / gemini.js          # panggilan AI + auto-rotation + auto-fallback model
│   │   └── chat-history.js            # riwayat chat persisten
│   └── docker-compose.yml
├── docs/
│   ├── RINCIAN-SISTEM.md              # gambaran sistem + evaluasi arsitektur
│   └── diagram-alur.md                # diagram Mermaid + status tiap fitur
└── PRD/
    ├── PRD-INTI.md                    # ⭐ acuan fitur yang berlaku saat ini
    └── (3 PRD lama — arsip sejarah, beberapa fitur di dalamnya sudah dihapus)
```

## Baca ini dulu kalau ingin paham sistemnya

| Butuh apa | Baca |
|---|---|
| Fitur apa saja yang **benar-benar berjalan** dan requirement-nya | `PRD/PRD-INTI.md` |
| Diagram alur teknis tiap fitur + status (✅/🟡/🔴) | `docs/diagram-alur.md` |
| Kenapa arsitekturnya begini, apa yang terbukti benar/meleset | `docs/RINCIAN-SISTEM.md` |
| Konteks tujuan produk & akademik (sudah banyak berubah, jangan jadi acuan fitur) | `PRD/PRD-Hub-Multi-Provider-AI-Agent-VPN.md`, `PRD/PRD-AI-Hub-Jarvis-BPJS.md`, `PRD/PRD-Dokumentasi-Percakapan-Perawat-Pasien.md` |

> **Catatan**: `app/README.md` dan `web/README.md` memuat detail setup yang sebagian sudah usang (masih menyebut Friend System, `ai_provider_service.dart` yang sudah dihapus, dll). Untuk kondisi sistem yang akurat, rujuk `PRD/PRD-INTI.md` dan `docs/` di atas, bukan README di subfolder.

## Yang tetap native (sengaja, bukan keterbatasan)

| Fungsi | Kenapa tetap native |
|---|---|
| Mikrofon + Speech-to-Text (Bot BPJS) | Latensi rendah, kontrol izin OS langsung — WebView Web Audio API kurang andal untuk ini |
| Koneksi VPN WireGuard (`VpnService`) | Butuh akses OS-level yang tidak tersedia dari web |
| Penyimpanan config VPN | `FlutterSecureStorage` (Keystore/Keychain) |

API key provider/agent AI **tidak** disimpan native — dienkripsi (AES-GCM) di sisi web lalu disinkron lewat akun Supabase, supaya tidak hilang saat uninstall/ganti device. Row Level Security tetap jadi kontrol akses sesungguhnya.

## Supabase

Jalankan `app/supabase/schema.sql` di Supabase SQL Editor (aman dijalankan berkali-kali — pakai `if not exists`/migrasi idempoten). Aktifkan Email sign-up di Authentication → Providers.

## Yang sudah dihapus dari rencana awal

Beberapa fitur yang sempat direncanakan di PRD lama **sengaja dihapus total**, bukan belum selesai dikerjakan — lihat `PRD/PRD-INTI.md` §9 untuk daftar lengkap dan alasannya: Friend System, wake word "Halo Jarvis" + Text-to-Speech, dan alur review-dokter-berbasis-akun.
