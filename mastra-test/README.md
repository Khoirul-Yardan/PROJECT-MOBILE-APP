# Mastra Test (Gemini)

Agent Mastra untuk Chat AI Hub, dengan key Google per permintaan dan tools kalkulator/waktu.

Jalankan dari root repositori: `docker compose -f web/docker-compose.yml --profile mastra up -d --build web relay mastra`. Studio: http://localhost:4111.

Panduan lengkap: [README utama](../README.md) dan [integrasi Mastra](../docs/MASTRA.md).

Validasi: `npm run typecheck`, `npm test`, `npm run build`.

Template dibuat melalui create-mastra, kemudian disesuaikan untuk integrasi stateless: tidak ada memory/traces, filesystem, shell, atau scheduler. Skills untuk coding assistant berbeda dari tools agent yang muncul di Chat.
