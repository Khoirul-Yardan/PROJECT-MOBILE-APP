# Lempar masalah ke Codex dari terminal yang sama (bergantian dengan Claude).
# Pemakaian:  powershell -File tool\codex-bantu.ps1 -Tiket "gejala, yang sudah dicoba, file terkait"
# Default read-only (Codex menganalisis dan memberi saran). Tambah -Tulis agar Codex boleh mengedit.
param([Parameter(Mandatory)][string]$Tiket, [switch]$Tulis)
$root = Split-Path $PSScriptRoot -Parent
$sandbox = if ($Tulis) { 'workspace-write' } else { 'read-only' }
$prompt = @"
Kamu Codex di proyek AI Hub. Baca AGENTS.md dan docs/HANDOFF.md. Claude Code buntu dan melempar masalah ini kepadamu:

$Tiket

Aturan: patuhi pagar akademik dan area kepemilikan di AGENTS.md. Beri akar masalah yang paling mungkin, bukti dari kode, dan langkah perbaikan konkret. Jika kamu juga tidak yakin, katakan apa yang kurang dan usulkan percobaan.
"@
Push-Location $root
$prompt | codex exec -C $root -s $sandbox -
Pop-Location
