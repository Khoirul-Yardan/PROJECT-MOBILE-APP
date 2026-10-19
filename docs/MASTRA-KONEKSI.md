# Mastra: satu kode koneksi untuk agent milik siapa pun

Status 20 Oktober 2026: implementasi lokal, belum deployment. Panduan ini menggantikan setup baru dengan key Gemini di dokumentasi lama. Mastra adalah koneksi **Agent**; provider/model adalah konfigurasi pemilik server.

## Untuk pengguna AI Hub

1. Minta **kode koneksi AI Hub** dari pemilik agent Mastra. Awal kode: `aihub-mastra-v1.`.
2. Buka **Hubungkan Agent**, tempel seluruh kode ke kolom **API key atau kode koneksi agent**. Tidak perlu URL atau key Gemini/OpenAI/Claude terpisah.
3. Periksa tujuan server yang tampil, lalu tekan **Periksa koneksi Mastra**. Token dikirim ke server tersebut untuk autentikasi dan discovery. Tidak ada percakapan yang dikirim pada tahap ini.
4. Periksa nama agent, provider, dan model yang dilaporkan server, lalu **Simpan & Hubungkan Agent**.
5. Pilih agent di Chat. `/skills` memuat kemampuan yang dipublikasikan pemilik server. Model tidak dipilih dari UI: pemilik agent yang mengaturnya.

Identitas/provider adalah deklarasi server, bukan verifikasi independen oleh AI Hub. Jika provider atau model tidak diumumkan, AI Hub tidak menebaknya. Model ditampilkan sebagai “diatur server”. Nama/provider disimpan sebagai label saat koneksi dibuat; hubungkan ulang jika ingin memperbarui label setelah pemilik mengganti konfigurasinya.

API key biasa tidak cukup untuk menemukan server Mastra yang berbeda-beda. Kode ini mengemas endpoint, agent ID, dan token sehingga cukup sekali tempel. Ini **format integrasi AI Hub**, bukan API key universal/resmi Mastra dan bukan token platform Mastra yang otomatis kompatibel.

## Untuk pemilik agent: provider tetap bebas

Agent tetap menggunakan provider, model, tools, dan credential yang sudah dikonfigurasi pemiliknya. Key provider tidak diberikan kepada pengguna AI Hub. Pemilik harus menyediakan adapter HTTP di bawah ini; server Mastra tanpa adapter belum kompatibel.

Implementasi yang bisa dipakai ulang: `mastra-test/src/mastra/connection-adapter.ts` (memakai `@mastra/core/server` dan `zod`). Salin file ini ke proyek Mastra Anda, lalu tambahkan hasil `connectionRoutes(...)` ke `server.apiRoutes` pada instance Mastra. Registrasikan agent yang sudah ada pada `agents` seperti biasa. Jangan mengganti model agent dengan model dari pengguna AI Hub.

Contoh konfigurasi (variabel `existingAgent` menunjuk agent Anda yang sudah dibuat):

```ts
import { connectionRoutes } from './connection-adapter.ts';

const routes = connectionRoutes({
  id: 'asisten-saya',
  name: 'Asisten Saya',
  // Opsional: isi sesuai konfigurasi nyata; hilangkan jika dinamis/rahasia.
  provider: 'Nama provider milik Anda',
  model: 'Nama model milik Anda',
  token: () => process.env.AI_HUB_AGENT_TOKEN,
  skills: [], // Isi hanya kemampuan yang benar-benar tersedia.
  generate: async messages => {
    const input = messages.map(m => m.role === 'system'
      ? { role: 'system' as const, content: m.content }
      : m.role === 'assistant'
        ? { role: 'assistant' as const, content: m.content }
        : { role: 'user' as const, content: m.content });
    const result = await existingAgent.generate(input, {
      maxSteps: 5, abortSignal: AbortSignal.timeout(90000),
    });
    return result.text;
  },
});
// Pada konfigurasi Mastra: server: { apiRoutes: [...routes] }
```

Token akses harus acak, minimal 16 karakter (disarankan 32 byte acak), berbeda dari API key provider. Adapter contoh memvalidasi satu token per agent, sehingga menggantinya mencabut semua kode yang memakai token lama. Untuk token per pengguna/expiry/rate limiting, pemilik perlu menambahkan pengelolaan token di server. Contoh ini tidak otomatis menerbitkan akun atau billing.

Adapter tidak memasang memory/storage/tracing. Jika agent Anda memakai fitur tersebut, pemilik wajib menjaga pemisahan sesi dan aturan retensi; protokol ini hanya mengirim riwayat sesi aktif dan **tidak membawa identitas akun AI Hub yang terverifikasi**. Jangan mengikat semua pemanggil ke satu thread memory. Uji dengan data fiktif; koneksi ini adalah Chat umum, bukan jalur dokumentasi pasien.

## Membuat kode koneksi

Di checkout AI Hub, isi `.env` lokal `mastra-test` dengan `AI_HUB_AGENT_TOKEN` yang sama seperti server. Jangan commit file tersebut. Dari direktori `mastra-test`, jalankan:

```powershell
node --env-file=.env scripts/connection-code.mjs https://agent.example.com asisten-saya pemilik.connection.txt
```

Ganti domain dan agent ID sesuai server Anda. Script menulis kode ke file baru, tidak mencetak token ke terminal, dan menolak menimpa file. Berkas `*.connection.txt` masuk `.gitignore`. Serahkan isi file melalui saluran privat kepada pengguna yang diberi akses. Simpan file di lokasi privat dan hapus jika sudah tidak dibutuhkan. Script mengemas konfigurasi; pemeriksaan token aktif dilakukan saat pengguna menekan **Periksa koneksi**.

Struktur isi sebelum encoding:

```json
{
  "endpoint": "https://agent.example.com",
  "agentId": "asisten-saya",
  "token": "TOKEN_AGENT_DARI_PEMILIK"
}
```

Format: `aihub-mastra-v1.` + base64url JSON UTF-8 (tanpa padding). Endpoint adalah base URL server, boleh memiliki path prefix, tanpa query/fragment/userinfo. HTTPS wajib kecuali `http://localhost`, `http://127.0.0.1`, atau `http://[::1]` untuk uji lokal. Agent ID hanya huruf/angka/underscore/hyphen, maksimal 80 karakter. Kode dibatasi 16.000 karakter, token 16–4096 karakter ASCII tanpa spasi.

**Base64url bukan enkripsi atau tanda tangan.** Kode berisi token rahasia, dapat dibaca pemegangnya, dan bukan bukti keaslian server. UI menampilkan host tujuan sebelum token dikirim. Saat disimpan, token memakai enkripsi kredensial dan RLS akun yang sudah ada; kode utuh tidak disimpan pada metadata. Endpoint dan nama/provider adalah metadata.

## Mencoba server contoh lokal

Server `mastra-test` tetap memakai Gemini sebagai contoh, tetapi adapter dan client tidak mewajibkan Gemini. Di `mastra-test/.env`, pemilik mengisi `GOOGLE_API_KEY` dan `AI_HUB_AGENT_TOKEN` yang berbeda. Jalankan dari root:

```powershell
docker compose -f web/docker-compose.yml --profile mastra up -d --build web relay mastra
```

Dari `mastra-test` buat kode:

```powershell
node --env-file=.env scripts/connection-code.mjs http://localhost:8090/mastra ai-hub lokal.connection.txt
```

Buka AI Hub pada `http://localhost:8090`, tempel kode tersebut. Untuk HP via USB gunakan `adb reverse tcp:8090 tcp:8090` dan origin localhost yang sama. Endpoint localhost merujuk perangkat yang melakukan koneksi; untuk pengguna lain gunakan domain HTTPS yang benar-benar dapat dijangkau, bukan localhost pemilik.

Koneksi same-origin menuju server langsung melalui nginx; koneksi server lain memakai relay web/native yang sudah ada. Aturan jaringan relay tetap berlaku, termasuk pemblokiran target privat pada deployment yang mengaktifkannya. Endpoint `/mastra` pada nginx hanya membuka kontrak AI Hub, bukan Studio/API Mastra umum.

## Kontrak HTTP agent

Protokol respons: `ai-hub-mastra-agent-v1`. Kedua endpoint wajib mengautentikasi header `Authorization: Bearer <token-agent>`; gunakan `Cache-Control: no-store`.

| Metode/path | Request dan respons |
|---|---|
| `GET /ai-hub/agents/{agentId}/capabilities` | `{protocol, agent:{id,name,provider?,model?}, skills:[{id,name,description?}]}` |
| `POST /ai-hub/agents/{agentId}/chat` | Body `{messages:[{role,content}]}`; respons `{protocol,text}` |

Client memeriksa protocol dan kecocokan agent ID sebelum menyimpan. Client tidak mengirim model, key provider, atau kode koneksi utuh ke chat; hanya token agent di header dan riwayat aktif di body. ID koneksi dibuat dari hash endpoint + agent ID agar dua server/agent tidak tercampur dalam rotasi kredensial.

Adapter menolak field tambahan (termasuk override model), role tidak valid, pesan terakhir bukan user, lebih dari 100 pesan, pesan >16.000 karakter, dan body >256 KiB. Status: 401 token hilang/salah atau konfigurasi belum ada; 400 body tidak valid; 413 terlalu besar; 502 generasi gagal. Detail error upstream tidak diteruskan/dilog. Kegagalan autentikasi atau discovery tidak menyimpan koneksi. Provider/model belum diumumkan bukan alasan menebak provider.

## Migrasi dan pengujian

Kredensial lama `format: mastra` tetap memakai kontrak BYOK `ai-hub-mastra-v1` dan key Gemini pengguna. Setup baru menghasilkan `format: mastra-agent`; tidak mengubah kredensial lama diam-diam. Hubungkan kode baru lalu hapus koneksi lama secara manual jika sudah tidak dipakai. Tidak ada perubahan skema Supabase, RLS, atau payload NativeBridge.

Validasi otomatis: `npm run typecheck`, `npm test`, `npm run build` dari `mastra-test`, serta `python web/tests/mastra_skills_smoke.py` dari root. Tes memakai fixture tanpa key nyata atau panggilan model berbayar: validasi kode, isolasi identitas, token ditolak, autentikasi discovery/chat, override model ditolak, batas body, penyembunyian error, UI deteksi provider, penyimpanan hanya token, chat tanpa parameter model, dan regresi koneksi lama.

Uji pemilik sebelum dibagikan: jalankan server, buat kode, hubungkan di AI Hub, kirim pesan fiktif, cek `/skills`, mulai sesi baru, lalu rotasi token dan pastikan kode lama ditolak. Ulangi dari perangkat pengguna sesungguhnya. Tes fixture tidak membuktikan akses/kuota provider atau kompatibilitas server pihak ketiga yang belum memasang adapter.

Dasar API: dokumentasi `@mastra/core` terpasang versi 1.78.0, [custom API routes Mastra](https://mastra.ai/docs/server/custom-api-routes). Format koneksi dan kontrak HTTP pada halaman ini adalah milik AI Hub.
