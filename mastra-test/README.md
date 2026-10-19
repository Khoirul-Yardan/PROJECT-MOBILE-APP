# Mastra Test (Gemini)

Agent contoh untuk Chat AI Hub dengan tools kalkulator/waktu. Setup baru memakai satu kode koneksi dan token agent; key Google contoh ini berada di server pemilik. Provider untuk agent pihak ketiga bebas melalui adapter yang sama. Rute BYOK lama tetap didukung.

Panduan pengguna, adapter untuk agent yang sudah ada, pembuatan kode, dan batas keamanan: [Koneksi Mastra](../docs/MASTRA-KONEKSI.md).

Jalankan dari root repositori: `docker compose -f web/docker-compose.yml --profile mastra up -d --build web relay mastra`. Studio: http://localhost:4111.

Panduan lengkap: [README utama](../README.md) dan [integrasi Mastra](../docs/MASTRA.md).

Validasi: `npm run typecheck`, `npm test`, `npm run build`.

Template dibuat melalui create-mastra, kemudian disesuaikan untuk integrasi stateless: tidak ada memory/traces, filesystem, shell, atau scheduler. Skills untuk coding assistant berbeda dari tools agent yang muncul di Chat.
