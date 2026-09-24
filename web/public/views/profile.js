import { h, header, initial, toast } from '../ui.js';
import { currentUser, myProfile, upsertProfile } from '../db.js';

const ROLES = [
  ['general', 'Umum'],
  ['perawat', 'Perawat'],
  ['dokter', 'Dokter'],
];

export default async function render(root) {
  const user = await currentUser();
  const profile = await myProfile();
  let role = profile?.role || 'general';

  const el = h(`<div></div>`);
  el.appendChild(header('Profil', { back: true }));
  el.appendChild(
    h(`
    <div style="text-align:center;margin-bottom:18px;">
      <div class="avatar" id="avatar" style="width:72px;height:72px;font-size:28px;margin:0 auto;">
        ${initial(profile?.display_name || user?.email)}
      </div>
      <p class="muted small" style="margin-top:8px;">${user?.email ?? ''}</p>
    </div>
    <div class="field">
      <label>Nama tampilan</label>
      <input id="name" value="${profile?.display_name ?? ''}" placeholder="Nama yang dilihat teman lain" />
    </div>
    <div class="field">
      <label>Peran</label>
      <div id="roles" class="row" style="gap:8px;"></div>
    </div>
    <div class="field">
      <label>Bio (opsional)</label>
      <textarea id="bio" rows="3" placeholder="Instansi, spesialisasi, atau info singkat lain">${profile?.bio ?? ''}</textarea>
    </div>
    <button id="save" class="btn btn-primary">Simpan Profil</button>
  `)
  );
  root.appendChild(el);

  const rolesEl = el.querySelector('#roles');
  ROLES.forEach(([id, label]) => {
    const btn = h(`<button class="chip ${role === id ? 'active' : ''}" style="flex:1;">${label}</button>`);
    btn.onclick = () => {
      role = id;
      rolesEl.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
    };
    rolesEl.appendChild(btn);
  });

  el.querySelector('#save').onclick = async () => {
    const name = el.querySelector('#name').value.trim();
    if (!name) {
      toast('Nama tidak boleh kosong.');
      return;
    }
    await upsertProfile(name, { role, bio: el.querySelector('#bio').value.trim() });
    toast('Profil disimpan.');
  };
}
