# Bot BPJS — Perbandingan Hasil STT vs Ringkasan LLM

> **Status dokumentasi — 19 Oktober 2026:** Metrik yang tersedia dalam aplikasi tidak otomatis berarti eksperimen baseline/proposed selesai. Screenshot Progres 2 tidak memuat hasil WER baru. Tandai relabel LLM/koreksi manual terpisah dari STT murni dan gunakan acuan manual untuk WER. Lihat [Progres.md](Progres.md).

Bahan metodologi untuk tugas akhir. Setiap sesi Bot BPJS menghasilkan **dua
keluaran dari audio yang sama**, plus metrik pembandingnya.

## Alur

```
audio (m4a) ─► AssemblyAI (STT + diarization, bahasa id, speakers_expected=2)
                 │
                 ├─► HASIL 1: transkrip mentah per pembicara (perawat/pasien)
                 │       └─ bila AssemblyAI hanya mendengar 1 suara → kalimat
                 │          dipecah, LLM menentukan peran tiap kalimat
                 ▼
              LLM (provider OpenAI-style milik perawat, mis. Hermes API Server)
                 └─► HASIL 2: ringkasan terstruktur
                     (ringkasan, keluhan_utama, durasi_gejala,
                      riwayat_kesehatan, hasil_anamnesis)
```

## Metrik (tab "Banding", tabel `bpjs_documents.perbandingan`)

| Kunci | Arti |
|---|---|
| `durasi_audio_ms` | durasi rekaman menurut AssemblyAI |
| `stt_waktu_ms` | upload + transkripsi + polling |
| `stt_kata`, `stt_segmen` | volume hasil STT |
| `pembicara_terdeteksi` | jumlah suara yang AssemblyAI laporkan **sebelum** koreksi |
| `relabel_llm` | `true` bila peran dikoreksi LLM karena STT hanya 1 suara |
| `llm_provider`, `llm_waktu_ms`, `llm_kata` | model peringkas, lama, panjang ringkasan |
| `rasio_ringkas` | `llm_kata / stt_kata` (makin kecil = makin ringkas) |
| `llm_berhasil` | `false` bila AI gagal dan yang tampil hanya fallback |

## Cara mengumpulkan data

1. Rekam N sesi simulasi (disarankan ≥ 10, durasi bervariasi 1–5 menit).
2. Untuk tiap sesi catat transkrip acuan manual (ground truth) di luar sistem.
3. Hitung **WER** hasil STT terhadap acuan, dan nilai ringkasan (kelengkapan
   keluhan utama, riwayat, durasi gejala; kesalahan/halusinasi) oleh perawat/
   dokter dengan rubrik 1–5.
4. Ambil metrik otomatis dengan SQL:
   ```sql
   select s.pasien_nama, d.perbandingan
   from bpjs_documents d join bpjs_sessions s on s.id = d.session_id
   order by d.created_at;
   ```
   atau salin dari tab Banding / ekspor PDF-DOCX (tabel ikut tercetak).

## Catatan validitas

- Label peran "perawat" = pembicara pertama (heuristik). Gunakan tombol
  *Tukar peran* bila terbalik; hasil tukar disimpan.
- `stt_waktu_ms` termasuk waktu upload (tergantung jaringan); `llm_waktu_ms`
  tergantung model/beban Hermes. Laporkan keduanya sebagai latensi end‑to‑end.
- Ringkasan LLM hanya boleh memakai isi transkrip (prompt melarang
  mengarang); tetap perlu diverifikasi dokter.
