# Menyambungkan Hermes Agent lewat API (bukan cuma A2A)

Dokumen ini untuk siapa pun di tim yang perlu menyambungkan **Hermes Agent**
(Nous Research) ke AI Hub dan ingin akses penuh ke tools-nya (terminal,
file, computer_use, dll), bukan cuma mode A2A yang sandboxed.

## Kenapa A2A saja tidak cukup

Hermes Agent punya **dua** permukaan self-hosted yang berbeda, dan keduanya
sudah didukung di AI Hub (lihat `web/public/providers.js`):

| | A2A | API Server |
|---|---|---|
| Entri di AI Hub | **Hermes Agent (A2A)** | **Hermes Agent (API Server)** |
| Protokol | JSON-RPC 2.0 (Agent2Agent) | REST biasa, format OpenAI chat-completions |
| Port default | `9900` | `8642` |
| Model trust | **Sandboxed** — agent sengaja menolak aksi sensitif (computer_use, dsb) lewat jalur ini | **Penuh** — jalur yang sama dipakai Open WebUI/LobeChat untuk akses penuh |
| Kapan dipakai | Channel umum/tidak terlalu sensitif, mirip kirim pesan Telegram | Saat AI Hub harus bisa menyuruh Hermes menjalankan tools sungguhan |

Kalau kemarin yang dicoba cuma mode A2A, itu sebabnya Hermes selalu menolak
aksi tertentu dan minta "persetujuan lewat sesi langsung" — itu bukan bug,
itu memang desain Hermes: A2A tidak pernah dipercaya untuk aksi sensitif
karena siapa pun yang bisa bicara A2A ke instance-mu bisa memalsukan sinyal
persetujuan yang sama. Satu-satunya jalan sah untuk akses penuh dari luar
adalah **API Server**, bukan trik di sisi A2A.

## 1. Aktifkan API Server di sisi Hermes

Di komputer/server yang menjalankan Hermes Agent:

1. Buka (atau buat) file env Hermes — biasanya `~/.hermes/.env`, atau di
   folder yang ditunjuk variabel `HERMES_HOME` kalau kamu mengatur itu.
2. Tambahkan:
   ```
   API_SERVER_ENABLED=true
   API_SERVER_KEY=ganti-dengan-token-rahasia-milikmu
   ```
   `API_SERVER_KEY` adalah token Bearer yang nanti dipakai AI Hub untuk
   autentikasi — buat yang panjang dan acak, jangan dipakai ulang dari tempat
   lain.
3. (Opsional, kalau nanti mau akses langsung dari browser tanpa lewat relay)
   set juga `API_SERVER_CORS_ORIGINS` ke origin AI Hub kamu. AI Hub sendiri
   tidak memerlukan ini — lihat bagian CORS di bawah.
4. Restart gateway-nya:
   ```
   hermes gateway restart
   ```
5. Pastikan servernya benar jalan di port default `8642`:
   ```
   curl -H "Authorization: Bearer <API_SERVER_KEY>" \
        http://localhost:8642/v1/models
   ```
   Harus balas daftar model, bukan error koneksi.

## 2. Sambungkan dari AI Hub

Di aplikasi AI Hub (web layer, Settings → API & Agent → Tambah):

1. Pilih kartu **Hermes Agent (API Server)** di daftar provider self-hosted.
2. **URL**: `http://host-tempat-hermes-jalan:8642/v1/chat/completions`
   (ganti `host-tempat-hermes-jalan` dengan IP/hostname komputer yang
   menjalankan Hermes — kalau satu LAN dengan device yang pakai AI Hub,
   cukup IP lokalnya, mis. `http://192.168.1.20:8642/v1/chat/completions`).
3. **Token**: isi dengan `API_SERVER_KEY` yang kamu set di langkah 1.
4. Simpan & Hubungkan.
5. Buka Chat, pilih Hermes Agent dari daftar tab provider, dan kirim pesan
   test. Kalau terhubung, model-picker (ikon layers di topbar chat) juga
   bisa memuat daftar model langsung dari `/v1/models` Hermes-mu.

Entri **Hermes Agent (A2A)** tetap boleh dipasang berdampingan kalau kamu
masih mau channel ringan untuk obrolan biasa — keduanya bukan saling
menggantikan, cuma dua pintu berbeda ke instance yang sama.

## Soal CORS — kamu tidak perlu mengurus ini sendiri

Hermes API Server hampir pasti tidak mengirim header CORS (ia dirancang
untuk dipanggil dari server/app, bukan langsung dari browser). AI Hub sudah
menangani ini otomatis lewat dua jalur, tergantung di mana AI Hub berjalan:

- **Aplikasi terpasang (APK/IPA)**: permintaan dilewatkan ke HTTP native
  Flutter (`http_relay` di `web_shell_screen.dart`), yang tidak kena aturan
  CORS browser sama sekali.
- **Preview browser biasa** (`docker compose up` di `web/`, dibuka di
  `localhost:8090`): permintaan dilewatkan ke container `relay/` (lihat
  `web/relay/server.js`), yang memanggil Hermes dari sisi server, lalu
  mengembalikan hasilnya ke halaman lewat origin yang sama.

Jadi kamu tidak perlu set `API_SERVER_CORS_ORIGINS` di Hermes kecuali kamu
sengaja ingin browser memanggil Hermes langsung tanpa relay sama sekali.

## Keamanan

- `API_SERVER_KEY` setara password penuh ke komputer yang menjalankan
  Hermes (akses tools termasuk terminal/file). Jangan commit ke git, jangan
  share di chat biasa.
- Kalau Hermes-nya jalan di server yang bisa diakses dari internet (bukan
  cuma LAN), pastikan port `8642` tidak terbuka publik tanpa perlindungan
  tambahan (firewall, VPN, atau reverse proxy dengan TLS) — token saja
  cukup untuk autentikasi API-nya, tapi tetap lebih aman kalau port itu
  tidak langsung terekspos ke seluruh internet.
- Rotasi `API_SERVER_KEY` kalau kamu curiga token pernah bocor, lalu update
  ulang token yang tersimpan di AI Hub (Settings → API & Agent → kelola
  provider ini → hapus & tambah ulang dengan token baru).

## Troubleshooting cepat

| Gejala | Kemungkinan sebab |
|---|---|
| "Gagal menghubungi jembatan native" / request gantung lama lalu gagal | Hermes tidak jalan di alamat itu, atau port `8642` diblok firewall antara device dan host Hermes |
| 401/403 dari Hermes | Token di AI Hub tidak sama dengan `API_SERVER_KEY` saat ini (termasuk kalau Hermes baru di-restart dengan key baru) |
| Balasan selalu "(respons kosong)" | Model yang dipilih belum benar-benar tersedia di instance Hermes-mu — buka model-picker, "Perbarui daftar model", pilih dari daftar yang benar-benar live |
| Masih diminta approval di sesi langsung meski sudah lewat API Server | Pastikan entri yang dipilih di Chat benar-benar **Hermes Agent (API Server)**, bukan **Hermes Agent (A2A)** — keduanya tampil terpisah di daftar provider |
