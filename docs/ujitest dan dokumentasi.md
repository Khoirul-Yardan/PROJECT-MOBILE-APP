# Uji Test & Dokumentasi — 14 Oktober 2026

Uji menyeluruh sistem AI Hub di Docker: chat ChatGPT, VPN (WireGuard / OpenVPN / SSH),
terminal, dan alur Bot BPJS. Semua screenshot ada di `Images/UjiTest/`.

**Cara baca label:** ✅ terbukti jalan · 🟡 jalan sebagian / hanya simulasi · ❌ belum bisa / gagal.

---

## 1. Ringkasan satu layar

| Area | Hasil | Catatan singkat |
|---|---|---|
| Chat ChatGPT (jalur nyata) | 🟡 | Kunci valid & terautentikasi (`/v1/models` → 200), tapi akun OpenAI **kehabisan kredit** → tidak ada balasan asli. Error ditampilkan rapi. |
| Chat ChatGPT (jalur sukses) | ✅ *(simulasi respons)* | Kirim → balasan → riwayat 2 giliran → pemilih model, semua jalan. Respons OpenAI ditiru karena kredit habis. |
| Deteksi API key | ✅ | Pola `sk-proj-…` dikenali sebagai ChatGPT. |
| VPN WireGuard | ✅ | Klien WireGuard sungguhan: handshake, ping 0% loss, SSH lewat tunnel. |
| VPN OpenVPN | ✅ | Konek (`Initialization Sequence Completed`), ping 0% loss; password salah → `AUTH_FAILED`. |
| VPN SSH sebagai "tunnel" | ❌ | Hanya tersimpan sebagai konfigurasi, belum membuka tunnel (by design, tertulis di kode). |
| Terminal (SSH) | ✅ | `dartssh2` (library yang sama dengan app) login, jalankan perintah, password salah ditolak. |
| Layar VPN/Terminal di browser | 🟡 | "Connect" hanya simulasi tampilan; terminal & ekspor file hanya di app Android — pesannya jujur. |
| Bot BPJS — rekam & STT | ⚪ tidak diuji | Butuh mikrofon + app Android; di luar jangkauan uji Docker. |
| Bot BPJS — riwayat & detail | ✅ | Daftar sesi, status, detail (ringkasan/STT/perbandingan) tampil benar. |
| Bot BPJS — desain layar review | 🟡 | Diperbaiki (lihat §5); lolos `flutter analyze` + 3 tes unit, **belum dilihat visual di perangkat**. |

---

## 2. Lingkungan uji (semua Docker)

| Layanan | Kontainer | Port | Dipakai untuk |
|---|---|---|---|
| Web AI Hub | `ai-hub-web` | 8090 | UI yang diuji Playwright |
| Relay | `ai-hub-relay` | (lewat nginx `/relay/`) | CORS agent + kunci AssemblyAI bersama |
| OpenVPN tiruan | `ovpn-test` | 1194/tcp | `TEST VPN/docker` (sudah ada) |
| **WireGuard + SSH tiruan (baru)** | `wg-test` | 51820/udp, 2222/tcp | `TEST VPN/wireguard` |

Tidak ada server VPN asli yang disentuh. Kunci WireGuard dibuat otomatis di container
(`TEST VPN/wireguard/out/` sudah di-`.gitignore`).

**Menjalankan ulang**

```sh
cd web && docker compose up -d --build
cd "TEST VPN/wireguard" && docker compose up -d --build
cd "TEST VPN/wireguard" && docker compose --profile test run --rm wg-client   # tes WireGuard + SSH
cd "TEST VPN/docker"    && bash test-client.sh                               # tes OpenVPN
cd app && dart run tool/ssh_probe.dart                                        # tes terminal (dartssh2)
export OPENAI_API_KEY=sk-...                                                  # jangan di-commit
python web/tests/e2e_docker.py        # chat + API key
python web/tests/e2e_vpn_bpjs.py      # VPN, terminal, riwayat BPJS
python web/tests/simulasi_bpjs.py     # foto + video simulasi perawat–pasien
```

> **Keamanan:** kunci OpenAI hanya dibaca dari variabel lingkungan dan tidak ditulis ke file
> mana pun di repo. Karena kunci itu sempat ditempel di chat, **sebaiknya di-revoke/ganti**
> di platform.openai.com setelah uji selesai.

---

## 3. Hasil per fitur

### 3.1 Chat ChatGPT
| Uji | Hasil | Bukti |
|---|---|---|
| Tab ChatGPT + model `gpt-4o-mini` tampil | ✅ | `01-chat-chatgpt-siap-kirim.png` |
| Kirim pesan dengan kunci asli | 🟡 Error `You have no credits remaining` ditampilkan di gelembung merah, UI tetap bisa dipakai | `02-chat-chatgpt-API-NYATA-error-kredit-habis.png` |
| Balasan sukses (respons ditiru) | ✅ | `03-…SIMULASI-balasan-sukses.png` |
| Percakapan 2 giliran (riwayat dikirim ulang) | ✅ | `04-…SIMULASI-percakapan-2-giliran.png` |
| Pemilih model | ✅ | `05-chat-chatgpt-pemilih-model.png` |
| Kunci `sk-proj-…` dikenali otomatis | ✅ | `06`, `07-tambah-api-key-terdeteksi-ChatGPT.png` |

**Yang perlu Anda lakukan:** isi saldo di `platform.openai.com/settings/organization/billing`.
Setelah itu `python web/tests/e2e_docker.py` otomatis membuktikan jalur nyata.
Rotasi multi-key sudah memperlakukan `insufficient_quota` sebagai error kuota, jadi bila
ada kunci cadangan, app akan lanjut ke kunci berikutnya.

### 3.2 VPN
| Protokol | Uji | Hasil |
|---|---|---|
| WireGuard | handshake, ping `10.98.0.1`, SSH lewat tunnel, SSH password salah | ✅ 3/3 paket, `latest handshake: Now`, login OK, salah → ditolak |
| OpenVPN | login benar / password salah / key salah | ✅ konek + ping 0% loss / `AUTH_FAILED` |
| SSH-tunnel | — | ❌ belum ada tunnel (hanya konfigurasi) |

Layar app (browser): 3 profil Docker tampil (`12-…`), pindah profil saat terhubung ditolak
(`14-…`), kondisi kosong menyuruh tambah server (`10-…`). Tombol Connect di browser
**hanya simulasi** dan app mengakuinya (`13-…`); tunnel asli hanya di Android.

### 3.3 Terminal
- Layar web hanyalah "pintu" ke terminal native; di browser menolak dengan pesan jelas (`20`, `21`).
- Terminal asli diuji dengan `app/tool/ssh_probe.dart` (dartssh2): login `tester` → perintah
  `echo/whoami/pwd` jalan → password salah memunculkan `SSHAuthFailError`.
- **Belum teruji:** tampilan xterm di layar HP, login dengan private key, dan terminal *lewat*
  tunnel VPN di perangkat. (Lewat tunnel sudah terbukti dengan klien Linux, bukan dengan app.)

### 3.4 Bot BPJS — riwayat
Tiga sesi dengan status Sudah Dikirim / Siap Dikirim / Diproses (`30-…`), detail memuat
Ringkasan AI, STT per pembicara, dan Perbandingan (`31-…`); ekspor PDF/DOCX di browser
ditolak dengan pesan jujur (`32-…`).

---

## 4. Simulasi alur perawat & pasien

Foto per langkah + video: `Images/UjiTest/Simulasi/` (sumber: `docs/simulasi-bpjs/simulasi.html`).
Ini **storyboard tersimulasi dengan data fiktif**, bukan rekaman app asli — dibuat agar alurnya
jelas bagi semua pihak.

| # | Perawat | Pasien | Layar | File |
|---|---|---|---|---|
| 1 | Membuka Bot BPJS | Duduk, tidak memegang apa pun | Siap merekam | `sim-01-…` |
| 2 | Isi nama pasien & dokter | (dimintai izin merekam — *tidak ada langkah izin di app*) | Dialog form | `sim-02-…` |
| 3 | Menyapa, bertanya keluhan | Menjawab | Merekam | `sim-03-…` |
| 4 | Menggali riwayat | Bercerita | Merekam | `sim-04-…` |
| 5 | Tekan "Hentikan Sesi" | — | Memproses (STT → LLM) | `sim-05-…` |
| 6 | Cek transkrip, tukar peran bila terbalik | — | Tab Transkrip | `sim-06-…` |
| 7 | Edit ringkasan | — | Tab Ringkasan | `sim-07-…` |
| 8 | Lihat metrik | — | Tab Banding | `sim-08-…` |
| 9 | Bagikan PDF/teks ke dokter | — | Share sheet | `sim-09-…` |

Video: `sim-alur-bot-bpjs-perawat-pasien.webm`.
Kesimpulan alur: **pasien sepenuhnya pasif** (tidak butuh akun/perangkat); seluruh beban ada di perawat,
dan dokter menerima dokumen di luar aplikasi.

---

## 5. Perbaikan desain Bot BPJS (Flutter)

Masalah yang terlihat di `Dokumentasi/*.jpeg` dan perbaikannya di `app/lib/screens/bot_bpjs_screen.dart`:

| Masalah di screenshot | Perbaikan |
|---|---|
| Banner "Draf AI (…) — perlu verifikasi dokter" **overflow 39 px** (garis kuning-hitam) | Teks dibungkus `Expanded` + `softWrap`, banner selebar penuh, ikon rata atas |
| Tab "Ringkasan AI" patah dua baris, tinggi tab tidak sama | Label dipendekkan (**Transkrip / Ringkasan / Banding**), satu baris, `FittedBox` + padding rapat |
| Label field mentah: `keluhan_utama`, `durasi_gejala` | `_humanizeKey` → "Keluhan utama", "Durasi gejala" (judul lebih tegas) |
| Tiga paragraf bantuan kecil (11 px, miring) menumpuk | Disatukan jadi satu kalimat 12 px |

Status: `flutter analyze` bersih, `flutter test test/bpjs_logic_test.dart` lulus (3/3).
**Belum diverifikasi secara visual di emulator/HP** — mohon cek sekali setelah `flutter run`.
Hal desain yang *belum* disentuh: bayangan/garis tebal kartu yang berat, layar riwayat web
(`bpjs-review.js`) masih memakai `snake_case → spasi` sederhana, dan header halaman yang tertimpa
saat scroll (terlihat di `ringkasan bot.jpeg`).

---

## 6. Apakah sistem benar-benar membantu alur BPJS?

Dibandingkan dengan `PRD-Dokumentasi-Percakapan-Perawat-Pasien.md` dan `docs/RINCIAN-SISTEM.md`:

**Membantu:**
- Mengubah percakapan menjadi 5 kolom anamnesis (ringkasan, keluhan utama, durasi gejala, riwayat
  kesehatan, hasil anamnesis) — sesuai tujuan PRD (dokumentasi keluhan, durasi, riwayat).
- Draf **bisa diedit**, ada penanda "perlu verifikasi dokter", sistem tidak mendiagnosis.
- Dua keluaran + metrik perbandingan siap untuk bab evaluasi tugas akhir.
- Dibagikan lewat kanal yang sudah dipakai (WhatsApp/PDF), tanpa memaksa dokter punya akun.

**Belum cukup / risiko:**
1. **Tidak ada persetujuan (consent) pasien** sebelum merekam, padahal audio percakapan medis
   dikirim ke pihak ketiga (AssemblyAI, lalu penyedia LLM). Ini isu privasi data pribadi/kesehatan
   (UU PDP) dan etik — perlu langkah izin + catatan di UI. *(Prioritas tertinggi.)*
2. Cakupan hanya **anamnesis**. Form BPJS/rekam medis lazimnya juga butuh tanda vital, pemeriksaan
   fisik, diagnosis (ICD-10), terapi. Tool ini membantu bagian subjektif saja — klaim "sesuai form
   BPJS" di komentar kode sebaiknya diperjelas.
3. **Metrik "rasio ringkas" menyesatkan** untuk rekaman sangat pendek (contoh uji lama: 563%
   karena hanya 8 kata). Beri catatan atau sembunyikan bila < ~30 kata.
4. **Diarization bergantung pada AssemblyAI**; bila hanya 1 suara terdeteksi, peran ditebak LLM
   (ada penanda, tapi tetap berisiko tertukar). Perlu diuji ≥10 sesi nyata (lihat `BOT-BPJS-PERBANDINGAN.md`).
5. **Belum diukur akurasi** (WER, kelengkapan ringkasan) — fungsi ada, data evaluasi belum.
6. Kualitas ringkasan tergantung LLM terhubung; uji terakhir (`ringkasan bot.jpeg`) benar menolak
   mengarang saat transkrip hanya "tes tes" — perilaku aman yang baik.

**Verdict:** alurnya masuk akal dan menghemat waktu pencatatan anamnesis, tetapi **belum layak
dipakai pada pasien sungguhan** sebelum ada consent, pengukuran akurasi, dan kejelasan data
dikirim ke mana.

---

## 7. Fungsi yang belum bisa / belum teruji

| Item | Status | Alasan / langkah |
|---|---|---|
| Balasan ChatGPT asli | ❌ | Saldo OpenAI habis → isi kredit |
| Tunnel untuk profil SSH | ❌ | Memang config-only |
| Rekam mikrofon + STT AssemblyAI end-to-end | ⚪ | Perlu perangkat Android; relay sudah memiliki kunci AssemblyAI |
| Tampilan Flutter hasil perbaikan | ⚪ | Perlu `flutter run` di emulator/HP |
| Login Supabase nyata & sinkron kredensial/VPN | ⚪ | Uji memakai fixture; belum ke Supabase sungguhan |
| Terminal di app (xterm, private key) & VPN WireGuard/OpenVPN di Android | ⚪ | Hanya terbukti di level library/klien Linux |
| Tunnel VPN **dari emulator** ke Docker | ⚪ | Gunakan `PUBLIC_HOST=10.0.2.2` (emulator) atau IP LAN (HP) |
| `web/tests/ui_smoke.py` & `model_smoke.py` | ❌ usang | Fixture `db.js` tak memuat ekspor baru (`deleteBpjsSession`); `e2e_docker.py` menghasilkan stub otomatis — bisa dipakai ulang di sana |
| Dokumen usang | 🟡 | `RINCIAN-SISTEM.md` §2.2 dan `diagram-alur.md` masih menyebut STT on-device & "diarization belum ada"; kode kini memakai AssemblyAI + diarization |

## 8. Berkas yang ditambahkan

```
TEST VPN/wireguard/{Dockerfile,entrypoint.sh,test-client.sh,docker-compose.yml}
app/tool/ssh_probe.dart
web/tests/{e2e_docker.py,e2e_vpn_bpjs.py,simulasi_bpjs.py}
docs/simulasi-bpjs/simulasi.html
docs/ujitest dan dokumentasi.md
Images/UjiTest/**            (screenshot + video + hasil-*.json)
app/lib/screens/bot_bpjs_screen.dart   (perbaikan desain)
.gitignore                              (+ TEST VPN/wireguard/out/)
```
