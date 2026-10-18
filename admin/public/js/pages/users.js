import { api, esc, h, icon, modal, confirmBox, toast, pageHead, fmtDate, debounce } from '../lib.js';

export default async function users(root) {
  root.append(pageHead('Pengguna', 'Akun pengguna', 'Kelola akun pengguna umum: nama, password, dan status akses. Data klinis pengguna tidak ditampilkan.',
    `<button class="btn" id="reload">${icon('refresh')}</button><button class="btn btn-primary" id="add">${icon('plus')} Tambah pengguna</button>`));
  const bar = h('<div class="toolbar"><input class="search" id="q" type="search" placeholder="Cari email (di halaman ini)…"><span class="muted small" id="count"></span></div>');
  const wrap = h('<div class="table-wrap"></div>');
  const pager = h('<div class="pager"></div>');
  root.append(bar, wrap, pager);
  const state = { page: 1, search: '' };

  async function load() {
    wrap.innerHTML = '<div class="empty">Memuat…</div>';
    try {
      const d = await api(`/users?page=${state.page}&search=${encodeURIComponent(state.search)}`);
      bar.querySelector('#count').textContent = `${d.total} akun`;
      if (!d.users.length) wrap.innerHTML = '<div class="empty">Tidak ada pengguna.</div>';
      else {
        wrap.innerHTML = `<table><thead><tr><th>Email</th><th>Nama</th><th>Status</th><th>Dibuat</th><th>Login terakhir</th><th></th></tr></thead><tbody>${d.users.map((u, i) => {
          const banned = u.banned_until && new Date(u.banned_until) > Date.now();
          return `<tr><td>${esc(u.email || '(tanpa email)')}<div class="muted small">${esc(u.provider)}</div></td><td>${esc(u.display_name) || '<span class="muted">—</span>'}</td>
            <td>${banned ? '<span class="pill bad">diblokir</span>' : u.confirmed ? '<span class="pill ok">aktif</span>' : '<span class="pill warn">belum konfirmasi</span>'}</td>
            <td class="small">${esc(fmtDate(u.created_at))}</td><td class="small">${esc(fmtDate(u.last_sign_in_at))}</td>
            <td class="actions-cell"><button class="btn btn-sm" data-edit="${i}">${icon('edit')} Kelola</button></td></tr>`;
        }).join('')}</tbody></table>`;
        wrap.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => manage(d.users[Number(b.dataset.edit)]); });
      }
      const pages = Math.max(1, Math.ceil(d.total / d.perPage));
      pager.innerHTML = `<span>Halaman ${d.page} / ${pages}</span><span class="actions"><button class="btn btn-sm" id="prev" ${d.page <= 1 ? 'disabled' : ''}>‹</button><button class="btn btn-sm" id="next" ${d.page >= pages ? 'disabled' : ''}>›</button></span>`;
      pager.querySelector('#prev').onclick = () => { state.page -= 1; load(); };
      pager.querySelector('#next').onclick = () => { state.page += 1; load(); };
    } catch (e) { wrap.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }

  function addUser() {
    modal('Tambah pengguna', (body, close) => {
      body.innerHTML = `<form><div class="form-grid">
        <div class="field"><label>Email *</label><input id="email" type="email" required></div>
        <div class="field"><label>Password * (min. 8)</label><input id="pw" type="password" minlength="8" required autocomplete="new-password"></div>
        <div class="field"><label>Nama tampilan</label><input id="dn"></div></div>
        <p class="error-text" id="err" hidden></p>
        <div class="modal-actions"><button type="button" class="btn" data-no>Batal</button><button class="btn btn-primary">Buat akun</button></div></form>`;
      body.querySelector('[data-no]').onclick = close;
      body.querySelector('form').onsubmit = async (e) => {
        e.preventDefault();
        try {
          await api('/users', { method: 'POST', body: { email: body.querySelector('#email').value, password: body.querySelector('#pw').value, display_name: body.querySelector('#dn').value } });
          close(); toast('Akun dibuat'); load();
        } catch (ex) { const er = body.querySelector('#err'); er.textContent = ex.message; er.hidden = false; }
      };
    });
  }

  function manage(u) {
    const banned = u.banned_until && new Date(u.banned_until) > Date.now();
    modal(`Kelola ${u.email}`, (body, close) => {
      body.innerHTML = `<form><div class="form-grid">
        <div class="field"><label>Nama tampilan</label><input id="dn" value="${esc(u.display_name)}"></div>
        <div class="field" style="grid-column:1/-1"><label>Password baru</label><input id="pw" type="password" minlength="8" autocomplete="new-password" placeholder="kosongkan jika tidak diubah"></div></div>
        <p class="error-text" id="err" hidden></p>
        <div class="modal-actions" style="justify-content:space-between">
          <span class="actions"><button type="button" class="btn ${banned ? '' : 'btn-danger'}" id="ban">${banned ? 'Buka blokir' : 'Blokir akun'}</button><button type="button" class="btn btn-danger" id="del">${icon('trash')} Hapus akun</button></span>
          <span class="actions"><button type="button" class="btn" data-no>Tutup</button><button class="btn btn-primary">Simpan</button></span></div></form>`;
      body.querySelector('[data-no]').onclick = close;
      const err = (m) => { const er = body.querySelector('#err'); er.textContent = m; er.hidden = false; };
      body.querySelector('form').onsubmit = async (e) => {
        e.preventDefault();
        const payload = { display_name: body.querySelector('#dn').value };
        const pw = body.querySelector('#pw').value;
        if (pw) payload.password = pw;
        try { await api(`/users/${u.id}`, { method: 'PATCH', body: payload }); close(); toast('Tersimpan'); load(); } catch (ex) { err(ex.message); }
      };
      body.querySelector('#ban').onclick = async () => {
        try { await api(`/users/${u.id}`, { method: 'PATCH', body: { banned: !banned } }); close(); toast(banned ? 'Blokir dibuka' : 'Akun diblokir'); load(); } catch (ex) { err(ex.message); }
      };
      body.querySelector('#del').onclick = async () => {
        close();
        if (!(await confirmBox('Hapus akun & SEMUA datanya?', 'Sesi Bot BPJS, transkrip, chat, API key, dan VPN milik akun ini ikut terhapus permanen. Tidak bisa dibatalkan.', { typed: u.email, okLabel: 'Hapus permanen' }))) return;
        try { await api(`/users/${u.id}?confirm=${encodeURIComponent(u.email)}`, { method: 'DELETE' }); toast('Akun dihapus'); load(); } catch (ex) { toast(ex.message, true); }
      };
    });
  }

  root.querySelector('#reload').onclick = load;
  root.querySelector('#add').onclick = addUser;
  bar.querySelector('#q').addEventListener('input', debounce((e) => { state.search = e.target.value; load(); }));
  await load();
}
