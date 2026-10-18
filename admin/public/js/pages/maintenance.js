// Mode maintenance + pemberitahuan ke pengguna. Satu form mengatur:
//  - app_settings.maintenance          -> dibaca aplikasi (overlay/banner)
//  - announcements (kind=maintenance)  -> notifikasi di aplikasi, ikut disinkronkan
import { api, esc, h, pageHead, toast, toLocalInput, fromLocalInput, fmtDate } from '../lib.js';

export default async function maintenance(root) {
  root.append(pageHead('Operasional', 'Maintenance', 'Jadwalkan pemeliharaan dan beri tahu pengguna jamnya. Pemberitahuan muncul di aplikasi secara langsung (realtime), tanpa rilis ulang APK.'));
  const wrap = h('<div></div>');
  root.append(wrap);

  let m;
  try { m = await api('/maintenance'); } catch (e) {
    wrap.innerHTML = `<div class="notice bad"><div><b>Gagal memuat</b><p>${esc(e.message)}</p><p>Jika tabel belum dibuat, buka <a href="#/system">Status &amp; Setup</a>.</p></div></div>`;
    return;
  }

  const now = Date.now();
  const status = !m.enabled ? ['Nonaktif', 'ok']
    : m.starts_at && new Date(m.starts_at) > now ? ['Terjadwal', 'warn']
      : m.ends_at && new Date(m.ends_at) < now ? ['Sudah lewat', '']
        : ['Sedang berlangsung', 'bad'];

  wrap.innerHTML = `
    <div class="card">
      <div class="actions" style="justify-content:space-between;margin-bottom:14px"><h3>Status saat ini</h3><span class="pill ${status[1]}">${status[0]}</span></div>
      <form id="f">
        <div class="field inline"><input type="checkbox" id="enabled" ${m.enabled ? 'checked' : ''}><label for="enabled">Aktifkan maintenance (jadwal di bawah berlaku)</label></div>
        <div class="field"><label for="title">Judul pemberitahuan</label><input id="title" maxlength="120" value="Pemeliharaan sistem"></div>
        <div class="field"><label for="message">Pesan untuk pengguna *</label><textarea id="message" maxlength="500" placeholder="Contoh: Aplikasi tidak dapat dipakai pada Sabtu 24 Okt pukul 22.00–23.30 WIB karena pemeliharaan server.">${esc(m.message)}</textarea></div>
        <div class="form-grid">
          <div class="field"><label for="starts">Mulai</label><input type="datetime-local" id="starts" value="${esc(toLocalInput(m.starts_at))}"><p class="hint">Kosong = langsung sekarang. Sebelum waktu mulai, pengguna hanya melihat banner pengingat.</p></div>
          <div class="field"><label for="ends">Selesai</label><input type="datetime-local" id="ends" value="${esc(toLocalInput(m.ends_at))}"><p class="hint">Kosong = sampai admin mematikan manual.</p></div>
        </div>
        <div class="field inline"><input type="checkbox" id="block" ${m.block !== false ? 'checked' : ''}><label for="block">Blokir pemakaian aplikasi selama jam maintenance (layar penuh)</label></div>
        <p class="hint" style="margin:-8px 0 14px 28px">Dimatikan = hanya banner peringatan, aplikasi tetap bisa dipakai.</p>
        <div class="field inline"><input type="checkbox" id="notify" checked><label for="notify">Kirim pemberitahuan ke semua pengguna (notifikasi dalam aplikasi)</label></div>
        <p class="error-text" id="err" hidden></p>
        <div class="actions" style="margin-top:8px"><button class="btn btn-primary" type="submit">Simpan &amp; terapkan</button></div>
      </form>
      ${m.enabled && m.starts_at ? `<p class="muted small" style="margin-bottom:0">Tersimpan: ${esc(fmtDate(m.starts_at))} → ${esc(m.ends_at ? fmtDate(m.ends_at) : 'manual')}</p>` : ''}
    </div>
    <div class="card"><h3>Cara kerjanya</h3>
      <p class="muted small" style="margin:0">Menyimpan menulis pengaturan <span class="mono">maintenance</span> (publik, terbaca layar login) dan membuat/memperbarui satu pengumuman bertipe maintenance. Mematikan maintenance menonaktifkan pengumuman itu dan pengguna langsung bisa masuk lagi. Semua perubahan tercatat di Audit log.</p></div>`;

  wrap.querySelector('#f').onsubmit = async (e) => {
    e.preventDefault();
    const err = wrap.querySelector('#err');
    err.hidden = true;
    const enabled = wrap.querySelector('#enabled').checked;
    try {
      await api('/maintenance', { method: 'PUT', body: {
        enabled,
        title: wrap.querySelector('#title').value,
        message: wrap.querySelector('#message').value.trim(),
        starts_at: fromLocalInput(wrap.querySelector('#starts').value),
        ends_at: fromLocalInput(wrap.querySelector('#ends').value),
        block: wrap.querySelector('#block').checked,
        notify: wrap.querySelector('#notify').checked,
      } });
      toast(enabled ? 'Maintenance diterapkan' : 'Maintenance dimatikan');
      root.replaceChildren();
      await maintenance(root);
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  };
}
