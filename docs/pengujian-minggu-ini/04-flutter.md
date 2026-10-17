# 04 — Flutter (host)

Dijalankan di laptop (Flutter 3.47.4), bukan di Docker: aplikasi Android tidak bisa diuji penuh tanpa perangkat/emulator.

| Perintah | Hasil |
|---|---|
| `flutter analyze --no-pub` | 0 error. 5 info lama: `avoid_print` di `tool/ssh_probe.dart` (3) dan komentar HTML di plugin `openvpn_flutter` (2) |
| `flutter test --no-pub` (tanpa server tiruan) | 10 lulus, 1 dilewati (tes yang butuh server OpenVPN tiruan) |
| `flutter test --no-pub` dengan `OVPN_FILE` dan server tiruan hidup | 11 lulus |

Tes yang ada: logika BPJS (`bpjs_logic_test.dart`), pembacaan remote OpenVPN (`ovpn_remote_test.dart`), penghentian polling AssemblyAI pada 400/401/403/404 (`assemblyai_poll_test.dart`), preflight OpenVPN terhadap server tiruan, dan dua tes widget (splash, izin mikrofon ditolak).

## Belum tercakup tes otomatis
Perekaman mikrofon, alur AssemblyAI end to end, tombol "Proses ulang rekaman" (perbaikan A-001), Anamnesis Terpandu, TTS native, WebView dan NativeBridge, tunnel VPN sungguhan, ekspor PDF/DOCX di perangkat. Semuanya butuh HP/emulator (lihat 05).
