from pathlib import Path
import hashlib
import json
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'
WORK = Path(__file__).parent
BACKUP = WORK / 'before'
BACKUP.mkdir(exist_ok=True)

def write(rel, content):
    path = DOCS / rel
    if path.exists():
        backup = BACKUP / rel
        backup.parent.mkdir(parents=True, exist_ok=True)
        if not backup.exists():
            shutil.copy2(path, backup)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.strip() + '\n', encoding='utf-8')

def update(rel, fn):
    write(rel, fn((DOCS / rel).read_text(encoding='utf-8-sig')))

def prepend(rel, note):
    def fn(text):
        first, rest = text.split('\n', 1)
        return first + '\n\n> **Status dokumentasi — 19 Oktober 2026:** ' + note + '\n\n' + rest.lstrip()
    update(rel, fn)

handoff = '''
## 2026-10-19 — Codex → Claude: penataan dokumentasi dan laporan Progres 2
- Otorisasi: permintaan langsung pengguna untuk merapikan seluruh `docs` dan membuat laporan Word berdasarkan `Dokumentasi/Progres 2` dipakai sebagai alih kepemilikan sementara area dokumentasi untuk tugas ini (AGENTS.md §3). Tidak ada perubahan aplikasi, skema, atau RLS.
- Susunan: seluruh enam dokumen Word pengguna dikumpulkan di `docs/word/{referensi,pengajuan,laporan,arsip}`. Markdown dan aset non-Word tetap di lokasi stabil agar rujukan AGENTS.md, kode, dan catatan lama tidak putus. `docs/README.md` menjadi pintu masuk dan inventaris. Berkas `~$...docx` adalah penanda Word yang sedang/pernah dibuka, bukan laporan; tidak disentuh.
- Laporan baru: `Dokumentasi/Progres 2/progres 2 Try and error sistem.docx`; gambar dari folder itu, identitas/akun/alamat server disamarkan pada salinan laporan. Gambar asli tidak diubah. Tidak ada klaim seluruh data gambar adalah fiktif karena asal identitas tidak dapat dipastikan.
- Penyesuaian: kondisi terkini sistem, kronologi Progres 1–2, admin sederhana di Fly, hasil OpenVPN/SSH asli, status dua tambahan (Papan Komunikasi dan Anamnesis Terpandu), serta batas bukti uji. Versi lama rincian/progres/alur disimpan di `docs/arsip/`.
- Dasar dua tambahan: dokumen pengajuan 15 Oktober dan analisis pemilihan; pengguna menyatakan jawaban dosen belum diterima. Implementasi mandiri bukan persetujuan pembimbing. Bukti riwayat pada Progres 2 menampilkan Anamnesis = 0; alur penuh Anamnesis belum boleh diklaim lulus dari gambar tersebut.
- PRD masih perlu disinkronkan oleh pemiliknya dengan keputusan K-003 dan ringkasan terkini; tugas ini hanya mengubah dokumentasi yang diminta pengguna.
- Akar masalah dokumentasi: catatan rencana, hasil uji lama, dan status implementasi terbaru bercampur tanpa label waktu yang konsisten.
- Status: penyusunan dan penataan selesai; pemeriksaan artefak dicatat di `docs/PERUBAHAN-DOKUMENTASI-2026-10-19.md`.
'''
update('HANDOFF.md', lambda t: t + '\n' + handoff)

for rel in ['Progres.md', 'RINCIAN-SISTEM.md', 'diagram-alur.md']:
    original = (DOCS / rel).read_text(encoding='utf-8-sig')
    write('arsip/' + rel, original)

write('RINCIAN-SISTEM.md', '''
# Rincian Sistem AI Hub — status 19 Oktober 2026

Ringkasan ini menggantikan snapshot 5 Oktober yang disimpan di [arsip/RINCIAN-SISTEM.md](arsip/RINCIAN-SISTEM.md). Dasar: kode lokal, [hasil uji perangkat 18 Oktober](<hasil percobaan vpn dan terminal asli.md>), [HANDOFF](HANDOFF.md), serta 21 gambar `Dokumentasi/Progres 2`. Tidak ada pengujian aplikasi baru dalam pekerjaan penyusunan laporan ini.

## 1. Tujuan dan batas sistem

Inti PA adalah dokumentasi **percakapan perawat–pasien**: audio → STT dan diarization → draf LLM → pemeriksaan perawat → ekspor untuk dokter. LLM mengekstrak dan merangkum; tidak menetapkan diagnosis atau obat. Transkrip asli harus tetap dapat ditelusuri. Verifikasi dokter berlangsung di luar aplikasi (K-003); tidak ada akun/antarmuka verifikasi dokter.

Papan Komunikasi dan Anamnesis Terpandu merupakan dua tambahan yang dipilih dalam dokumen pengajuan 15 Oktober. Menurut pengguna pada 19 Oktober, jawaban dosen masih belum diterima dan keduanya ditambahkan secara mandiri. Kata “inti” pada pengajuan lama berarti prioritas pengembangan tambahan, bukan pengganti objek utama evaluasi PA.

## 2. Modul dan batas pembuktiannya

| Modul | Kondisi implementasi | Bukti dan batas |
|---|---|---|
| Bot BPJS | Rekam native, AssemblyAI, diarization/relabel konteks, draf LLM, edit, ekspor | Kode native dan dokumen perbandingan; Progres 2 menampilkan 4 entri BPJS. Jumlah entri bukan bukti akurasi atau kelulusan rekam sampai ekspor |
| Papan Komunikasi | 11 pilihan, TTS, lokasi/skala nyeri, catatan, ruangan dan tautan, riwayat gabungan | Kode web dan gambar papan/catatan/ruangan. Suara, pengiriman lintas perangkat, dan latensi perlu uji langsung |
| Anamnesis Terpandu | 7 pertanyaan TTS, jawaban suara/STT, koreksi, draf dan penyimpanan | `app/lib/screens/anamnesis_terpandu_screen.dart`. Riwayat Progres 2 menunjukkan 0 sesi Anamnesis; belum ada bukti sesi lengkap pada folder ini |
| Dokumentasi & Riwayat | Pencarian/filter Bot BPJS, Anamnesis, Papan | Gambar berisi 7 entri: 4 BPJS, 0 Anamnesis, 3 Papan; kondisi satu tangkapan layar |
| Chat/API & Agent | BYOK, pemilih model, riwayat, integrasi provider/agent | Panduan teknis dan catatan uji lama; tidak diuji ulang pada penyusunan Progres 2 |
| OpenVPN | Tunnel native; kompatibilitas cipher CBC ditambahkan | Uji 18 Oktober berhasil pada HP di Wi-Fi yang sama dengan laptop; seluler/stabilitas panjang belum dibuktikan |
| Terminal SSH | Login SSH melalui koneksi jaringan/VPN | Server asli terbuka sampai prompt; perintah di server asli tidak diuji |
| WireGuard | Implementasi native; hasil uji server tiruan tersedia | Tidak disamakan dengan kelulusan server asli di HP |
| Panel Admin | Akun/profil umum, metadata, maintenance, pengumuman, audit, status | Uji fixture, Fly desktop, dan Chrome HP tercatat di HANDOFF. Bukan peninjauan diagnosis |

## 3. Arsitektur dan data

- `app/`: shell Flutter, satu WebView persisten, mikrofon, perekaman, TTS native, VPN, secure storage, layar BPJS/Anamnesis.
- `web/public/`: SPA vanilla JS untuk halaman umum, papan, dokumentasi/riwayat, dan pengaturan.
- `web/relay/`: relay untuk integrasi yang memerlukan perantara (termasuk jalur AssemblyAI dengan kunci bersama). Karena itu pernyataan lama “semua API tanpa perantara” tidak berlaku untuk seluruh jalur.
- Supabase: Auth, Postgres, RLS, Realtime. Sesi/transkrip/draf memakai `bpjs_sessions`, `bpjs_transcripts`, `bpjs_documents`; papan memakai `komunikasi_events`, `komunikasi_rooms`.
- `admin/`: layanan Node terpisah; service key hanya di server. Resource pasien hanya metadata read-only dengan daftar kolom eksplisit. RLS pemilik data tetap berlaku pada aplikasi.
- Deploy tercatat 18 Oktober: web dan relay pada aplikasi Fly `ai-hub-web`; admin pada `ai-hub-admin`. Ini riwayat deployment, bukan pemeriksaan uptime saat dokumen dibaca.

## 4. Penjelasan speech dan TTS

Pada Bot BPJS, yang direkam adalah percakapan perawat–pasien. Peran pembicara ditetapkan dari konteks sesi, bukan identifikasi biometrik. Pada Anamnesis, suara yang mengajukan pertanyaan adalah **suara sistem TTS**, bukan rekaman perawat. Pada Papan, suara berasal dari teks pilihan pasien; bukan STT dan bukan jawaban AI. “Minta obat” adalah penyampaian permintaan, bukan rekomendasi obat otomatis.

Wake word, balasan suara Bot BPJS, Friend System, dan review dokter berbasis akun tetap dihapus. TTS pada Papan dan Anamnesis adalah fungsi yang berbeda dan tersedia di kode.

## 5. Status admin terbaru

Katalog Bot, Provider AI, dan Pengaturan generik telah dikeluarkan dari panel. Akun/profil tidak menawarkan pilihan peran. Tabel lama atau pembacaan konfigurasi di aplikasi tidak otomatis dihapus. Maintenance dan Pengumuman tetap ada. Admin menampilkan ID/status/waktu/provider sebagai metadata, bukan isi transkrip/ringkasan. Lihat [PANEL-ADMIN.md](PANEL-ADMIN.md).

## 6. Evaluasi yang masih diperlukan

Baseline STT saja dibanding proposed STT + LLM pada audio yang sama, dengan transkrip acuan manual: WER, kelengkapan, kesesuaian isi, factual consistency, dan waktu proses. Catat relabel otomatis/koreksi manual terpisah agar baseline tidak diam-diam mencakup LLM. Papan dinilai secara fungsional; Anamnesis dinilai sebagai modul tambahan dengan sumber pertanyaan TTS dijelaskan. Belum ada angka evaluasi baru yang dapat diambil dari screenshot Progres 2.

Rincian tindak lanjut: [PENGUJIAN-SPEECH-REALISTIS.md](PENGUJIAN-SPEECH-REALISTIS.md), [DAFTAR-BUG.md](DAFTAR-BUG.md), dan [Progres.md](Progres.md).
''')

write('Progres.md', '''
# Progres AI Hub — dari dokumentasi awal sampai Progres 2

Diselaraskan 19 Oktober 2026. Catatan panjang versi sebelumnya dipertahankan di [arsip/Progres.md](arsip/Progres.md). Tabel ini membedakan rencana, implementasi, dan hasil uji; tanggal mengikuti sumber tertulis, bukan tebakan dari nama gambar.

| Tahap / tanggal sumber | Perkembangan | Status dan sumber |
|---|---|---|
| Konsep awal, September 2026 | Kelayakan hub AI, hybrid, API/provider, peran native/web | Kajian historis `Kemungkinan-Pembangunan-Sistem.md`; bukan daftar fitur aktif |
| 2–5 Oktober | Desain dan implementasi UI hybrid, penyederhanaan BPJS | `desain.md`, `IMPLEMENTASI-DESAIN.md`, `ui-preview/`; snapshot lama di `arsip/` |
| Progres 1 | Dokumentasi gambar BPJS (STT, ringkasan, perbandingan, tukar peran), chat, VPN dan terminal | 16 gambar di `Dokumentasi/Progres 1`; tanggal setiap pengambilan tidak ditetapkan hanya dari nama berkas |
| 14 Oktober | Uji Docker/web, server VPN/SSH tiruan, penanganan galat chat | `ujitest dan dokumentasi.md`; percobaan provider nyata terhambat kuota, jalur sukses chat memakai simulasi |
| 15–16 Oktober | Pengajuan pilihan speech dan bahan diskusi 9 bentuk komunikasi | Word pada `word/pengajuan` dan `word/referensi`; dua tambahan: Papan Komunikasi + Anamnesis Terpandu |
| 17 Oktober | Uji web/relay, RLS tiruan, Flutter; audit BPJS dan relabel | `pengujian-minggu-ini/`, `DAFTAR-BUG.md`, K-002; bukan bukti seluruh alur native lulus |
| 18 Oktober | OpenVPN asli berhasil setelah kompatibilitas cipher; SSH asli sampai prompt | `hasil percobaan vpn dan terminal asli.md`; Wi-Fi tertentu, belum jaringan seluler/stabilitas panjang |
| 18 Oktober | Panel admin disederhanakan, deploy web/admin Fly, uji desktop dan HP | `HANDOFF.md`, `PANEL-ADMIN.md`; katalog dan pilihan peran dihapus dari panel |
| Progres 2, dirangkum 19 Oktober | Papan, ruangan, catatan, riwayat gabungan, admin, bukti gagal/berhasil VPN dan terminal | 21 gambar di `Dokumentasi/Progres 2`; laporan Word baru memakai gambar tersebut |

## Posisi penambahan mandiri

Pengguna menyatakan jawaban dosen atas pengajuan speech belum diterima. Dua tambahan dicatat sebagai implementasi mandiri untuk dibahas, bukan persetujuan pembimbing. Papan mendukung komunikasi dengan pilihan ikon/TTS; Anamnesis memakai pertanyaan sistem/TTS dan jawaban pasien/STT. Inti PA tetap dokumentasi percakapan perawat–pasien pada Bot BPJS. Verifikasi dokter di luar aplikasi; LLM tidak menetapkan diagnosis.

## Ringkasan hasil Progres 2

- Gambar memperlihatkan papan, catatan bertimestamp, ruangan/tautan, serta pencarian/filter riwayat.
- Riwayat pada gambar berisi 7 entri: BPJS 4, Anamnesis 0, Papan 3. Angka ini hanya inventaris pada saat gambar diambil.
- OpenVPN pernah gagal dengan pesan login yang menyesatkan; catatan uji mengaitkan keberhasilan dengan penambahan cipher CBC dalam negosiasi. Terminal timeout ketika VPN tidak aktif, lalu berhasil membuka prompt setelah VPN disambungkan.
- Admin menyediakan pemantauan operasional dan metadata; bukan akses isi dokumentasi pasien atau antarmuka dokter.
- Screenshot tidak membuktikan keluaran suara, ketepatan STT, kelengkapan LLM, real-time lintas perangkat, atau keberhasilan sesi Anamnesis penuh.

## Pekerjaan berikutnya

| Prioritas | Pekerjaan | Kriteria bukti |
|---|---|---|
| 1 | Diskusikan dua tambahan dan batas TTS dengan dosen | Keputusan tertulis; tanggal/respons asli dicatat saat diterima |
| 2 | Uji BPJS fiktif dari rekam sampai ekspor | Audio + acuan manual + transkrip + draf + koreksi + berkas ekspor |
| 3 | Uji Anamnesis lengkap | Pertanyaan TTS, jawaban STT, koreksi, penyimpanan, muncul di riwayat |
| 4 | Uji papan pada dua perangkat | TTS terdengar, event diterima pemilik, link nonaktif ditolak, jaringan putus tertangani |
| 5 | Evaluasi baseline/proposed | WER dan penilaian isi/waktu dengan kondisi serta versi yang dicatat |
| 6 | Uji jaringan dan perbaikan pesan galat | VPN seluler/stabilitas; pesan kegagalan tidak otomatis menyalahkan password |

Laporan: [progres 2 Try and error sistem.docx](<../Dokumentasi/Progres 2/progres 2 Try and error sistem.docx>). Indeks keseluruhan: [README.md](README.md).
''')

write('diagram-alur.md', '''
# Alur Sistem AI Hub — 19 Oktober 2026

Alur berikut merangkum implementasi lokal dan batas hasil uji. Diagram snapshot 5 Oktober dipertahankan di [arsip/diagram-alur.md](arsip/diagram-alur.md). Panah menunjukkan urutan proses, bukan bukti setiap langkah telah lulus uji perangkat.

## Bot BPJS — inti PA

1. Perawat membuka sesi dan merekam percakapan perawat–pasien.
2. Audio diproses STT/diarization AssemblyAI; peran ditafsirkan berdasarkan konteks sesi dan dapat dikoreksi.
3. Transkrip dipertahankan; LLM menyusun draf terstruktur.
4. Perawat memeriksa sumber dan menyunting draf, lalu menyimpan/mengekspor.
5. Dokter menerima dokumentasi dan memverifikasi **di luar aplikasi**.

Baseline evaluasi adalah STT saja; relabel LLM harus dicatat terpisah. LLM tidak menetapkan diagnosis.

## Anamnesis Terpandu — tambahan mandiri

1. Sistem membacakan satu pertanyaan TTS.
2. Pasien menjawab; STT mengubah jawaban menjadi teks.
3. Perawat memeriksa/koreksi tiap jawaban.
4. LLM menyusun draf; transkrip sumber dan koreksi tetap dapat ditelusuri.
5. Draf disimpan ke dokumentasi/riwayat.

Pertanyaan adalah suara sistem, bukan rekaman perawat. Implementasi tersedia; folder Progres 2 belum menunjukkan sesi Anamnesis lengkap.

## Papan Komunikasi — tambahan mandiri

1. Perawat membuka papan atau membuat ruangan dan tautan pasien/keluarga.
2. Pasien memilih ikon; khusus nyeri dapat memilih lokasi dan skala.
3. Pilihan dibacakan lewat TTS dan dicatat sebagai event.
4. Pada tautan, event dikirim ke pemilik ruangan melalui RPC yang dibatasi token; bukan akses bebas riwayat pasien.
5. Perawat memeriksa Catatan atau Dokumentasi & Riwayat, lalu menyalin informasi yang diperlukan.

Papan bukan STT, bukan penentu diagnosis/obat, dan bukan pengganti panggilan perawat resmi. TTS/pengiriman lintas perangkat perlu bukti uji langsung.

## VPN dan Terminal

Profil pengguna → pemeriksaan jangkauan/konfigurasi → negosiasi OpenVPN → tunnel aktif → koneksi SSH → prompt terminal. Uji 18 Oktober mencatat masalah cipher pada VPN dan timeout SSH ketika tunnel tidak aktif. Shell asli baru diuji sampai prompt.

## Admin

Login admin → sesi cookie → dashboard/akun/metadata/maintenance/pengumuman/audit/status. Service key tetap di server; akses tabel pasien hanya metadata sesuai daftar kolom. Tidak ada alur rekam atau verifikasi dokter di panel.
''')

write('PANEL-ADMIN.md', '''
# Panel Admin AI Hub — status 19 Oktober 2026

Panel operasional untuk akun/profil pengguna, metadata database, maintenance, pengumuman, audit, dan status layanan. Pembaruan ini menyelaraskan implementasi setelah penyederhanaan dan deployment 18 Oktober; dasar: `admin/lib/resources.js`, `admin/public/js/`, dan [HANDOFF.md](HANDOFF.md). Riwayat keputusan awal K-004 dipertahankan; cakupan terbaru dijelaskan K-005.

## 1. Akses dan arsitektur

Lokal: `cd web` lalu `docker compose up -d --build`; admin di `http://localhost:8095`, aplikasi di `http://localhost:8090`. Pengelola menyiapkan `ADMIN_USER`, `ADMIN_PASSWORD`, `SESSION_SECRET`, dan `SUPABASE_SERVICE_KEY` melalui environment; lihat `admin/.env.example`. Jangan menyalin nilai rahasia ke dokumentasi.

Deployment 18 Oktober tercatat pada `https://ai-hub-admin.fly.dev`; web/relay pada `https://ai-hub-web.fly.dev`. Alamat tersebut adalah catatan deployment, tidak diperiksa ulang sewaktu penyusunan laporan. Kode deployment berada di `admin/fly.toml` dan `admin/Dockerfile.fly`.

Browser → cookie sesi → layanan Node admin → Supabase. Service key berada di server; data aplikasi tetap memakai akses pengguna dan RLS. Skema admin ada di `app/supabase/schema-admin.sql`. Menjalankan/mengubah migrasi adalah tindakan terpisah dari membaca dokumen ini.

## 2. Cakupan panel terbaru

| Menu | Fungsi | Batas |
|---|---|---|
| Dashboard | Hitungan data, grafik sesi, aktivitas admin | Ringkasan operasional, bukan hasil evaluasi klinis |
| Akun pengguna | Buat/kelola akun umum, nama, password, status akses | Tidak menawarkan pilihan peran dokter/perawat |
| Profil pengguna | Kelola field profil yang diizinkan | Field `role` tidak dapat diedit melalui panel |
| Metadata database | Sesi BPJS, segmen, dokumentasi LLM, event/ruangan papan, pesan, kredensial/VPN/log | Daftar kolom eksplisit; tanpa isi pasien atau kunci rahasia; read-only |
| Maintenance | Jadwal, pesan, banner atau overlay web | Tidak memblokir tautan pasien `#/p`; layar native BPJS/Anamnesis tidak otomatis tertutup overlay web |
| Pengumuman | Buat/edit/hapus, jenis, jadwal tayang | Gambar formulir bukan bukti pengumuman sudah terkirim ke semua perangkat |
| Audit log | Jejak tindakan admin | Tidak sama dengan log klinis atau bukti persetujuan dokter |
| Status & Setup | Kesehatan layanan, keberadaan tabel, SQL sumber | Status satu saat tidak menjamin uptime jangka panjang |

Katalog **Bot**, **Provider AI**, dan **Pengaturan** generik sudah dikeluarkan dari navigasi/API CRUD panel. Tabel konfigurasi lama/pembacaan remote di aplikasi tidak otomatis dihapus. Maintenance dan Pengumuman tetap dipertahankan.

## 3. Privasi dan akses

- `admin/lib/resources.js` membatasi data pasien pada metadata; contoh segmen hanya ID, sesi, speaker, offset, waktu. Isi transkrip dan draf LLM tidak ditampilkan.
- Tulis ke resource metadata ditolak. Penghitungan/cek tabel menggunakan HEAD sesuai perbaikan 18 Oktober.
- Service key melewati RLS, sehingga pembatasan server tetap wajib; keberadaan RLS saja bukan pagar untuk layanan admin.
- Audit mencatat nama field dan ID, bukan nilai perubahan. Penghapusan akun berdampak ke data terkait dan memerlukan konfirmasi dalam UI.
- Login memakai akun environment; sesi cookie HttpOnly/SameSite, Secure pada HTTPS; pemeriksaan Origin/CSRF dan pembatasan percobaan login tersedia.
- Tidak ada editor SQL bebas, antarmuka dokter, penetapan diagnosis, atau akses isi dokumentasi klinis melalui panel.

## 4. Hasil uji yang tercatat

| Lingkup | Sumber | Hasil / batas |
|---|---|---|
| API dan UI desktop/mobile fixture | `web/tests/admin_smoke.py`, HANDOFF 18 Oktober | Tercatat lulus; katalog lama 404, role ditolak, metadata dibatasi |
| Web fixture | `web/tests/ui_smoke.py` | Tercatat 13 rute × 4 lebar layar; fixture bukan database pasien nyata |
| Admin Fly desktop | `web/tests/admin_live.py` | Tercatat lulus login HTTPS/cookie, status, halaman dan metadata; tidak mengubah data bisnis |
| Admin di HP | `web/tests/admin_phone.mjs` | Chrome pada Infinix X6851, akses Fly, navigasi sentuh; bukan uji seluruh alur dalam WebView APK |
| Gambar Progres 2 | 12 screenshot admin | Dokumentasi tampilan, formulir, metadata, dashboard; bukan uji ulang server |

Penyusunan laporan ini tidak menjalankan ulang tes aplikasi. Rekaman STT/LLM, VPN/SSH nyata ujung ke ujung, dan publikasi maintenance/pengumuman pada pengguna produksi tidak dibuktikan oleh tes admin tersebut.

## 5. Tindak lanjut

Uji perubahan maintenance dan pengumuman secara terkendali; periksa penerimaan pada perangkat, penjadwalan, dan pengecualian tautan papan. Pertahankan pembatasan metadata. Catat tanggal, versi, lingkungan, serta hasil aktual setiap pengujian baru sebelum mengubah status laporan.
''')

update('KEPUTUSAN.md', lambda t: t + '''

## K-005 — Penyederhanaan dan deployment admin (18 Oktober 2026; dicatat 19 Oktober, Codex)
- Apa: keluarkan katalog Bot/Provider/Pengaturan dari panel; akun/profil umum tanpa pemilih peran; pertahankan maintenance, pengumuman, metadata, audit/status. Deploy admin dan web ke Fly sesuai HANDOFF 18 Oktober.
- Dasar: permintaan pengguna dan hasil implementasi/uji yang sudah tercatat; pencatatan ini tidak membuat deployment baru.
- Dampak: operasional saja, tanpa perubahan pipeline PA atau pelonggaran RLS. Metadata pasien tetap tanpa isi klinis.
- Posisi di laporan: pendukung. K-004 adalah riwayat rancangan awal, bukan cakupan panel terkini.

## K-006 — Pelaporan dua tambahan mandiri dan pemisahan dokumen (19 Oktober 2026, Codex)
- Apa: melaporkan Papan Komunikasi dan Anamnesis Terpandu sebagai dua tambahan mandiri berdasarkan pengajuan 15 Oktober; pengguna menyatakan dosen belum menjawab. Tidak menyatakan persetujuan pembimbing atau validasi klinis.
- Dasar: permintaan pengguna, dokumen pengajuan lama, kode lokal, 21 gambar Progres 2, dan catatan hasil uji. Tidak ada fitur aplikasi baru pada tugas ini.
- Dampak ke PA: Bot BPJS tetap inti; suara pertanyaan Anamnesis adalah TTS sistem. Gambar riwayat menunjukkan nol sesi Anamnesis; evaluasi baseline/proposed masih perlu data terukur. Dokter meninjau di luar aplikasi.
- Penataan: enam Word lama di `docs/word`; non-Word tetap di lokasi stabil dengan indeks/status. Laporan baru berada di `Dokumentasi/Progres 2/progres 2 Try and error sistem.docx`. Identitas/alamat pada gambar laporan disamarkan tanpa mengubah sumber asli.
- Posisi di laporan: perkembangan prototipe dan batas pengujian, bukan kesimpulan efektivitas klinis.
''')

prepend('ANALISIS-PEMILIHAN-SISTEM-SPEECH.md', 'Skor di bawah adalah penilaian usulan, bukan hasil eksperimen atau persetujuan dosen. Dua pilihan, Papan Komunikasi dan Anamnesis Terpandu, sudah tersedia di kode dan ditambahkan mandiri menurut pengguna. Dosen belum menjawab pengajuan. “Inti” pada tabel lama berarti prioritas tambahan; inti akademik tetap Bot BPJS. Lihat [Progres.md](Progres.md).')
update('ANALISIS-PEMILIHAN-SISTEM-SPEECH.md', lambda t: t.replace('### Inti (dikerjakan sekarang)', '### Prioritas tambahan (dipilih pada usulan; implementasi mandiri tersedia)').replace('Mikrofon kontinu, wake word, rekaman berkualitas', 'Mikrofon dan rekaman berkualitas (wake word tidak aktif)'))
prepend('PEMETAAN-SPEECH-KE-SISTEM.md', 'Sembilan jenis adalah peta konsep, bukan sembilan fitur selesai. Dua tambahan mandiri yang diajukan adalah Papan Komunikasi dan Anamnesis Terpandu; jawaban dosen belum diterima. Anamnesis menggunakan pertanyaan TTS sistem, bukan rekaman perawat. Status uji terkini ada di [Progres.md](Progres.md).')
update('PEMETAAN-SPEECH-KE-SISTEM.md', lambda t: t.replace('docs/Dokumentasi-Speech-Perawat-ke-Pasien.docx', 'docs/word/referensi/Dokumentasi-Speech-Perawat-ke-Pasien.docx').replace('tugas Claude, tunggu persetujuan pengguna', 'tugas pemilik PRD; sinkronkan dengan keputusan pengguna yang sudah tercatat'))
prepend('SPEECH-PERAWAT-DOKTER-DAN-KESELARASAN-JUDUL.md', 'Kajian keselarasan tetap berlaku. Pengguna melaporkan penambahan mandiri Papan Komunikasi dan Anamnesis Terpandu sambil menunggu jawaban dosen. Ini bukan izin merekam ucapan dokter atau persetujuan scope baru; K-003 tetap berlaku. Lihat [RINCIAN-SISTEM.md](RINCIAN-SISTEM.md).')
prepend('PENGUJIAN-SPEECH-REALISTIS.md', 'Dokumen ini adalah rencana/protokol evaluasi. Progres 2 menyediakan bukti tampilan dan catatan operasional, belum tabel pengukuran speech baru. WER harus memakai acuan manual; pisahkan STT murni dari relabel/koreksi LLM, serta jangan campurkan pertanyaan TTS Anamnesis dengan rekaman perawat. Pipeline tidak diubah pada tugas dokumentasi ini.')
prepend('BOT-BPJS-PERBANDINGAN.md', 'Metrik yang tersedia dalam aplikasi tidak otomatis berarti eksperimen baseline/proposed selesai. Screenshot Progres 2 tidak memuat hasil WER baru. Tandai relabel LLM/koreksi manual terpisah dari STT murni dan gunakan acuan manual untuk WER. Lihat [Progres.md](Progres.md).')
prepend('kemungkinan tools yang dapat dikembangkan.md', 'Ini daftar usulan historis. Papan Komunikasi dan Anamnesis Terpandu kini tersedia di kode sebagai tambahan mandiri; pilihan lain tetap usulan kecuali ada keputusan/bukti baru. Jawaban dosen atas dua pilihan tersebut belum diterima. Lihat [Progres.md](Progres.md).')
update('kemungkinan tools yang dapat dikembangkan.md', lambda t: t.replace('Status: **usulan, belum diimplementasikan**.', 'Status awal: **usulan**; status implementasi terbaru mengikuti catatan di atas.'))
prepend('RENCANA-PRODUKSI-DAN-PENUGASAN.md', 'Ini backlog, bukan klaim semua fase selesai. OpenVPN asli dan SSH sampai prompt berhasil pada 18 Oktober; admin/web Fly dan navigasi HP juga telah diuji sesuai HANDOFF. Evaluasi speech, Anamnesis lengkap, papan lintas perangkat, dan kesiapan produksi tetap perlu bukti masing-masing.')
update('RENCANA-PRODUKSI-DAN-PENUGASAN.md', lambda t: t.replace('- OpenVPN/SSH belum punya tunnel nyata (WireGuard sudah). Risiko store (WebView-heavy) belum didokumentasikan.', '- Koreksi status jaringan: OpenVPN memiliki tunnel native dan berhasil diuji pada 18 Oktober; Terminal SSH berhasil sampai prompt melalui VPN. Konfigurasi SSH bukan tunnel VPN penuh. Detail/batas ada di `hasil percobaan vpn dan terminal asli.md`.'))
prepend('DAFTAR-BUG.md', 'Daftar audit bertanggal tetap dipertahankan; jangan menganggap seluruh temuan sudah selesai. Hasil VPN asli 18 Oktober dan validasi admin/Fly ada di [Progres.md](Progres.md) serta [HANDOFF.md](HANDOFF.md). Penulisan laporan tidak mengubah status bug tanpa bukti uji.')

update('PANDUAN-PENGGUNAAN.md', lambda t: t.replace('(Chat, Bot BPJS, VPN)', '(Chat, Bot BPJS, Papan Komunikasi, Anamnesis, VPN/Terminal)').replace('lihat bagian 2.6', 'lihat bagian 2.2').replace('Riwayat (web → Riwayat Bot BPJS)', 'Dokumentasi & Riwayat (dari Bot Hub)').replace('### VPN\n', '''### Papan Komunikasi
Bot Hub → Papan Komunikasi. Gunakan kode/label tempat tidur, pilih ikon, lalu periksa tab Catatan. Nyeri memiliki pilihan lokasi dan skala 0–10 sebagai laporan pasien. Tab Ruangan dapat membuat tautan untuk pasien/keluarga; nonaktifkan bila tidak dipakai. Tautan tidak memberikan akses bebas ke isi riwayat. TTS perlu diperiksa pada perangkat yang digunakan; pilihan “Minta obat” bukan resep dan tombol panggil bukan pengganti sistem panggil perawat resmi.

### Anamnesis Terpandu
Buka dari aplikasi Android. Sistem membacakan tujuh pertanyaan, pasien menjawab, lalu perawat memeriksa/koreksi teks sebelum membuat draf. Simpan dan periksa kemunculannya di Dokumentasi & Riwayat. Pertanyaan adalah TTS sistem, bukan suara perawat yang direkam. Implementasi tersedia, tetapi gambar Progres 2 belum membuktikan sesi lengkap berhasil.

### Dokumentasi & Riwayat
Gunakan pencarian dan filter Semua/Bot BPJS/Anamnesis/Papan. Tinjau transkrip sumber bersama draf sebelum ekspor atau berbagi. Verifikasi dokter dilakukan di luar aplikasi. Gunakan contoh fiktif untuk latihan.

### VPN
''').replace('## 4. Masalah umum', '''### Terminal dan admin
Untuk server SSH di balik VPN, sambungkan VPN terlebih dahulu lalu buka Terminal. Uji asli 18 Oktober baru membuktikan login sampai prompt; `force-stop` aplikasi memutus VPN. Pesan “Server menolak login” pada percobaan lama ternyata berkaitan dengan negosiasi cipher, sehingga bukan bukti pasti password salah.

Panel admin terpisah; lihat [PANEL-ADMIN.md](PANEL-ADMIN.md). Cakupan saat ini akun umum, metadata, maintenance/pengumuman, audit/status; tidak ada katalog bot/provider atau pilihan peran.

## 4. Masalah umum'''))
prepend('PANDUAN-PENGGUNAAN.md', 'Panduan diperbarui untuk tiga modul Bot Hub dan admin sederhana. Keberadaan langkah penggunaan tidak berarti semua skenario telah diuji pada perangkat; batas pembuktian ada di [Progres.md](Progres.md).')

history_notes = {
 'desain.md': 'Spesifikasi desain historis 2 Oktober; target/usulan di bawah tidak otomatis fitur aktif. Kondisi terkini ada di [RINCIAN-SISTEM.md](RINCIAN-SISTEM.md).',
 'IMPLEMENTASI-DESAIN.md': 'Catatan implementasi 3 Oktober dipertahankan sebagai riwayat. Tampilan Progres 2 dan perkembangan berikutnya ada di [Progres.md](Progres.md).',
 'Kemungkinan-Pembangunan-Sistem.md': 'Kajian historis September dipertahankan sebagai dasar awal, bukan spesifikasi aktif. Lihat [RINCIAN-SISTEM.md](RINCIAN-SISTEM.md) untuk arsitektur dan fitur saat ini.',
 'ujitest dan dokumentasi.md': 'Hasil uji 14 Oktober dipertahankan sesuai lingkungan saat itu. Uji VPN asli 18 Oktober dan admin/Fly dirangkum di [Progres.md](Progres.md); hasil simulasi tidak diubah menjadi klaim data nyata.',
 'pengujian-minggu-ini/README.md': 'Laporan 17 Oktober adalah snapshot historis. Dugaan masalah VPN asli pada jaringan telah dikoreksi oleh [uji 18 Oktober](<../hasil percobaan vpn dan terminal asli.md>): negosiasi cipher diperbaiki dan SSH terbuka sampai prompt. Word lama ada di [word/laporan](../word/laporan/).',
 'pengujian-minggu-ini/01-web-dan-relay.md': 'Hasil bertanggal 17 Oktober, tidak dijalankan ulang saat penyusunan laporan. Validasi admin/Fly 18 Oktober ada di [HANDOFF](../HANDOFF.md).',
 'pengujian-minggu-ini/02-vpn-docker.md': 'Hasil server tiruan di bawah tetap berlaku untuk lingkungan uji tersebut. Dugaan tentang server asli telah diperbarui oleh [hasil 18 Oktober](<../hasil percobaan vpn dan terminal asli.md>): kompatibilitas cipher pada klien diperbaiki; bukan bukti password salah.',
 'pengujian-minggu-ini/03-database-rls.md': '31/31 adalah hasil lingkungan Postgres tiruan yang dicatat 17 Oktober, bukan pengujian ulang kebijakan produksi. RLS dan skema tidak diubah pada tugas laporan.',
 'pengujian-minggu-ini/04-flutter.md': 'Angka tes di bawah mengikuti catatan 17 Oktober. Tes cipher tambahan 18 Oktober tercatat di hasil VPN asli; tidak ada flutter test/build baru pada penyusunan laporan.',
 'pengujian-minggu-ini/05-perlu-hp-emulator.md': 'Checklist berlanjut setelah uji 18 Oktober: VPN asli pada Wi-Fi dan SSH sampai prompt sudah dibuktikan. Seluler, sesi Anamnesis lengkap, dan papan lintas perangkat tetap perlu uji; gambar tidak membuktikan keluaran suara.',
 'ui-preview/README.md': 'Aset preview historis awal Oktober; gambar laporan terbaru ada di `Dokumentasi/Progres 2`. Jangan memakai preview sebagai bukti fitur terbaru sudah lulus uji.',
}
for rel, note in history_notes.items():
    prepend(rel, note)
update('ujitest dan dokumentasi.md', lambda t: t.replace('Dokumentasi/*.jpeg', 'Dokumentasi/Progres 1/*.jpeg'))
update('pengujian-minggu-ini/05-perlu-hp-emulator.md', lambda t: t.replace('kecepatan 0,95', 'kecepatan sesuai engine/perangkat; fallback browser saat ini 1,05').replace('atau galat login/handshake; catat teks galat lengkap termasuk "Tahapan: ..." | |', 'atau galat login/handshake; catat teks galat tanpa alamat/kredensial | Wi-Fi lulus 18 Oktober setelah perbaikan cipher; seluler belum |').replace('Shell terbuka; bandingkan dengan Termius | |', 'Shell terbuka; bandingkan dengan Termius | Lulus sampai prompt pada server asli, 18 Oktober; perintah belum diuji |'))
prepend('REFERENSI-SUMBER-ILMIAH.md', 'Daftar pustaka lama tetap sebagai bahan penelusuran. Penyusunan Progres 2 tidak memverifikasi ulang sumber eksternal, tidak mengubah skor usulan menjadi bukti efektivitas, dan memakai bukti internal untuk klaim implementasi. Pengajuan Word dipindah ke `word/pengajuan/Pengajuan-Pemilihan-Sistem-Speech.docx`.')

write('word/README.md', '''
# Dokumen Word

Semua enam dokumen Word yang sebelumnya tersebar di `docs` dikumpulkan di sini. Isi historis dipertahankan; nama/jenis dokumen bukan bukti persetujuan dosen. Laporan terbaru tersedia di [Progres 2](<../../Dokumentasi/Progres 2/progres 2 Try and error sistem.docx>).

| Folder | Dokumen | Cara memakai |
|---|---|---|
| referensi | [Dokumentasi macam speech perawat dan pasien.docx](<referensi/Dokumentasi macam speech perawat dan pasien.docx>) | Acuan gaya dan 9 jenis komunikasi; versi asli, bukan laporan implementasi terbaru |
| referensi | [Dokumentasi-Speech-Perawat-ke-Pasien.docx](referensi/Dokumentasi-Speech-Perawat-ke-Pasien.docx) | Konsep/model dan rancangan uji |
| referensi | [Revisi bahan diskusi](referensi/Dokumentasi-Speech-Perawat-ke-Pasien-Revisi-Diskusi.docx) | Bahan diskusi dengan dosen |
| pengajuan | [Pengajuan-Pemilihan-Sistem-Speech.docx](pengajuan/Pengajuan-Pemilihan-Sistem-Speech.docx) | Pengajuan 15 Oktober; jawaban dosen belum diterima menurut pengguna 19 Oktober |
| laporan | [laporan mingguan.docx](<laporan/laporan mingguan.docx>) | Hasil 17 Oktober; koreksi/perkembangan lanjut ada di laporan Progres 2 |
| arsip | [versi 1](arsip/Dokumentasi-Speech-Perawat-ke-Pasien-v1.docx) | Jejak awal, tidak dipakai sebagai spesifikasi aktif |

Word template di `.work-speech/lib` adalah komponen pustaka pembuat dokumen, bukan dokumen proyek. Berkas `~$...docx` adalah lock Word, bukan laporan; tidak ikut dipindahkan.
''')

write('arsip/README.md', '''
# Arsip non-Word

Snapshot sebelum sinkronisasi 19 Oktober 2026 dipertahankan untuk menelusuri perkembangan. Jangan memakai status lama sebagai status aplikasi terkini.

- [Progres lama](Progres.md): catatan panjang awal dan pembaruan sampai pertengahan Oktober.
- [Rincian sistem lama](RINCIAN-SISTEM.md): snapshot 5 Oktober.
- [Alur lama](diagram-alur.md): snapshot 5 Oktober.

Versi terkini berada satu tingkat di atas; pengajuan dan arsip Word ada di `../word/`.
''')

# Repair references in the local Word-generation helper after relocation.
helper = DOCS / '.work-speech/export_pdf.ps1'
update('.work-speech/export_pdf.ps1', lambda t: t.replace("'Dokumentasi-Speech-Perawat-ke-Pasien-Revisi-Diskusi.docx'", "'word/referensi/Dokumentasi-Speech-Perawat-ke-Pasien-Revisi-Diskusi.docx'"))
update('.work-speech/build_revision.py', lambda t: t.replace("ROOT/'Dokumentasi-Speech-Perawat-ke-Pasien-Revisi-Diskusi.docx'", "ROOT/'word/referensi/Dokumentasi-Speech-Perawat-ke-Pasien-Revisi-Diskusi.docx'"))

write('PERUBAHAN-DOKUMENTASI-2026-10-19.md', '''
# Penataan dokumentasi — 19 Oktober 2026

Permintaan: pisahkan Word dan non-Word, selaraskan riwayat awal–akhir, dan buat laporan Progres 2 berdasarkan gambar pengguna.

## Perubahan

1. Enam Word asli dipindahkan utuh ke `word/referensi`, `word/pengajuan`, `word/laporan`, dan `word/arsip`; isi historis tidak ditimpa laporan baru.
2. Dokumen non-Word tetap di root `docs` dan folder aset/pengujian yang sudah ada, terpisah dari `word`. Lokasinya dipertahankan karena AGENTS.md dan kode memakai jalur tersebut. README mengelompokkan semuanya menurut fungsi/status.
3. Progres, rincian sistem, alur, panel admin, panduan penggunaan, pemetaan/analisis speech, checklist, dan catatan terkait diselaraskan. Snapshot rincian/progres/alur sebelumnya disimpan di `arsip`.
4. Catatan uji lama mempertahankan tanggal, angka, dan lingkungan aslinya; label status menjelaskan koreksi VPN, perubahan admin, dan kebutuhan uji yang belum selesai.
5. Dua tambahan adalah Papan Komunikasi dan Anamnesis Terpandu berdasarkan pengajuan lama; pengguna menyatakan belum mendapat jawaban dosen. Laporan tidak mengklaim persetujuan akademik.
6. Laporan baru di `Dokumentasi/Progres 2/progres 2 Try and error sistem.docx`; gambar berasal dari 21 bukti pada folder tersebut. Identitas, email, ID terkait, dan alamat server disamarkan hanya pada salinan laporan.

## Validasi dan batas

- Struktur Word, gambar tertanam, halaman, tabel/caption, dan rujukan lokal diperiksa setelah pembuatan; detail mesin pemeriksaan disimpan bersama skrip pembuat laporan.
- Tidak ada pengujian aplikasi/provider/database baru. Hasil uji dalam laporan adalah kutipan/parafrasa bukti lokal bertanggal dan dibedakan dari pengamatan gambar.
- Gambar riwayat menunjukkan BPJS 4, Anamnesis 0, Papan 3; tidak dipakai sebagai ukuran akurasi.
- Dokumen referensi ilmiah lama tidak diverifikasi ulang ke web pada tugas penataan ini; laporan perkembangan memakai sumber internal.
- PRD serta kode aplikasi tidak diubah. Berkas pengguna yang sebelumnya berubah tetap dipertahankan.
''')

groups = {
 'Mulai dari sini / status terkini': ['Progres.md','RINCIAN-SISTEM.md','diagram-alur.md','PANDUAN-PENGGUNAAN.md','PANEL-ADMIN.md','PERUBAHAN-DOKUMENTASI-2026-10-19.md'],
 'Akademik, pemilihan speech, dan evaluasi': ['PEMETAAN-SPEECH-KE-SISTEM.md','SPEECH-PERAWAT-DOKTER-DAN-KESELARASAN-JUDUL.md','ANALISIS-PEMILIHAN-SISTEM-SPEECH.md','BOT-BPJS-PERBANDINGAN.md','PENGUJIAN-SPEECH-REALISTIS.md','REFERENSI-SUMBER-ILMIAH.md'],
 'Panduan teknis': ['ai-models.md','ASSEMBLYAI-DIARIZATION.md','HERMES-API-SETUP.md','VPN-TEST-DOCKER.md'],
 'Hasil uji bertanggal': ['hasil percobaan vpn dan terminal asli.md','ujitest dan dokumentasi.md','pengujian-minggu-ini/README.md','pengujian-minggu-ini/01-web-dan-relay.md','pengujian-minggu-ini/02-vpn-docker.md','pengujian-minggu-ini/03-database-rls.md','pengujian-minggu-ini/04-flutter.md','pengujian-minggu-ini/05-perlu-hp-emulator.md'],
 'Keputusan dan pekerjaan berlanjut': ['KEPUTUSAN.md','HANDOFF.md','DISKUSI.md','DAFTAR-BUG.md','RENCANA-PRODUKSI-DAN-PENUGASAN.md','PANDUAN-DUA-CLI.md'],
 'Rencana/desain historis dan aset': ['desain.md','IMPLEMENTASI-DESAIN.md','Kemungkinan-Pembangunan-Sistem.md','kemungkinan tools yang dapat dikembangkan.md','arsip/README.md','speech-assets/README.md','speech-assets/bahan-diskusi/README.md','ui-preview/README.md','simulasi-bpjs/simulasi.html'],
}
index = '''# Indeks Dokumentasi AI Hub

Diselaraskan **19 Oktober 2026**. Untuk laporan terbaru, buka [progres 2 Try and error sistem.docx](<../Dokumentasi/Progres 2/progres 2 Try and error sistem.docx>). Mulai membaca status aplikasi dari [Progres](Progres.md) dan [Rincian Sistem](RINCIAN-SISTEM.md).

## Pemisahan berkas

| Jenis | Lokasi | Keterangan |
|---|---|---|
| Word | [word/](word/README.md) | Enam dokumen lama: referensi, pengajuan, laporan, arsip |
| Non-Word | Root `docs/` dan subfolder topik di bawah | Markdown, HTML simulasi, dan gambar; jalur stabil untuk rujukan AGENTS.md/kode |
| Laporan Progres 2 | `Dokumentasi/Progres 2/` | Lokasi khusus sesuai permintaan pengguna; satu dokumen final dengan 21 gambar sumber |
| Riwayat gambar Progres 1 | `Dokumentasi/Progres 1/` | 16 gambar tahap sebelumnya |
| Alat bantu lokal | `.work-speech/` | Skrip/pustaka pembuat dokumen, bukan bahan laporan; template/lock Word dikecualikan dari inventaris |

## Cara membaca status

**Terkini** menjelaskan kode dan bukti terbaru yang tersedia. **Hasil uji** hanya berlaku untuk tanggal/lingkungan yang disebut. **Usulan** tidak berarti persetujuan dosen. **Arsip** dipertahankan untuk kronologi. Gambar bukan pengukuran akurasi atau bukti semua alur lulus.

Dua tambahan mandiri ialah **Papan Komunikasi dan Anamnesis Terpandu**. Pengguna menyatakan jawaban dosen belum diterima. Bot BPJS tetap inti PA; pertanyaan Anamnesis adalah TTS sistem; LLM tidak menetapkan diagnosis; dokter meninjau di luar aplikasi.
'''
for title, paths in groups.items():
    index += '\n## ' + title + '\n\n'
    for rel in paths:
        index += f'- [{Path(rel).stem}](<{rel}>)\n'
write('README.md', index)

manifest = []
for p in sorted(DOCS.rglob('*')):
    if p.is_file() and '.work-speech' not in p.parts and not p.name.startswith('~$'):
        manifest.append({'path': str(p.relative_to(ROOT)).replace('\\','/'), 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()})
(WORK/'docs-inventory.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('Documentation synchronized;', len(manifest), 'files inventoried.')
