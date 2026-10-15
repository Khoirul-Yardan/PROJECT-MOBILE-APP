import { h, header, toast, pageIntro, icon } from '../ui.js';
import { Native } from '../bridge.js';
import { logActivity } from '../db.js';
import { analyzeOvpn, redactedPreview, listRemotes } from '../ovpn_info.js';
import { loadState, saveState, newId, profileSummary } from '../vpn_profiles.js';

// Banyak profil VPN per akun: halaman ini punya dua mode — DAFTAR (pilih VPN
// yang aktif, tambah, ubah, hapus) dan FORM (satu profil). Tiap protokol punya
// field yang benar-benar berbeda: WireGuard = pasangan kunci, OpenVPN = file
// .ovpn, SSH = host/port/username. Untuk OpenVPN, kolom yang tidak relevan
// disembunyikan berdasarkan isi file (login hanya bila `auth-user-pass`,
// password key hanya bila private key-nya terenkripsi).
const PROTOCOLS = ['WireGuard', 'OpenVPN', 'SSH'];

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export default async function render(root) {
  let state = await loadState();

  const el = h(`<div class="page vpn-config-page"></div>`);
  el.appendChild(header('Server VPN', { back: true }));
  el.appendChild(pageIntro('Siapkan jalur koneksimu.', 'Simpan beberapa VPN, lalu pilih yang dipakai.', { art: 'vpn', label: 'PENGATURAN SERVER', tone: 'intro-mint' }));
  const body = h('<div></div>');
  el.appendChild(body);
  root.appendChild(el);

  async function persist(message) {
    const { cloudFailed } = await saveState(state);
    toast(cloudFailed ? 'Tersimpan di perangkat ini saja — gagal sinkron ke akun (cek koneksi).' : message);
  }

  // ------------------------------------------------------------------ DAFTAR
  function renderList() {
    body.innerHTML = '';
    if (state.profiles.length === 0) {
      body.appendChild(h('<div class="card"><p class="muted small" style="margin:0;">Belum ada VPN. Tambahkan dari file .ovpn, atau isi WireGuard/SSH.</p></div>'));
    }
    state.profiles.forEach((p) => {
      const isActive = p.id === state.activeId;
      const card = h(`
        <div class="card" style="margin-bottom:10px;">
          <div class="row-between">
            <strong>${esc(p.name)}</strong>
            ${isActive ? '<span class="pill pill--ok">Dipakai</span>' : ''}
          </div>
          <p class="muted small" style="margin:6px 0 10px;">${esc(profileSummary(p))}</p>
          <div class="row" style="gap:8px;flex-wrap:wrap;">
            ${isActive ? '' : '<button type="button" class="btn btn-primary" data-use style="flex:1;min-width:110px;">Pakai ini</button>'}
            <button type="button" class="btn btn-outline" data-edit style="flex:1;min-width:90px;">Ubah</button>
            <button type="button" class="icon-button" data-del aria-label="Hapus ${esc(p.name)}">${icon('trash')}</button>
          </div>
        </div>
      `);
      const useBtn = card.querySelector('[data-use]');
      if (useBtn) {
        useBtn.onclick = async () => {
          state.activeId = p.id;
          await persist(`VPN aktif: ${p.name}`);
          renderList();
        };
      }
      card.querySelector('[data-edit]').onclick = () => renderForm(p);
      const del = card.querySelector('[data-del]');
      let armed = false;
      // Dua ketukan (bukan dialog confirm) supaya tidak bergantung pada
      // dukungan dialog JS di WebView.
      del.onclick = async () => {
        if (!armed) {
          armed = true;
          toast(`Ketuk hapus sekali lagi untuk menghapus "${p.name}".`);
          setTimeout(() => (armed = false), 3500);
          return;
        }
        state.profiles = state.profiles.filter((x) => x.id !== p.id);
        if (state.activeId === p.id) state.activeId = state.profiles[0]?.id ?? null;
        await persist(`"${p.name}" dihapus.`);
        renderList();
      };
      body.appendChild(card);
    });
    const add = h('<button type="button" class="btn btn-outline" style="width:100%;margin-top:4px;">+ Tambah VPN</button>');
    add.onclick = () => renderForm(null);
    body.appendChild(add);
    body.appendChild(
      h('<p class="muted small" style="margin-top:14px;">Tersimpan terenkripsi di akunmu dan di perangkat ini. Untuk pindah VPN saat sedang terhubung, putuskan dulu lalu hubungkan lagi.</p>')
    );
  }

  // -------------------------------------------------------------------- FORM
  function renderForm(editing) {
    let protocol = editing?.protocol || 'OpenVPN';
    // Draf OpenVPN yang sedang dikerjakan (file bisa dipilih ulang).
    const draft = {
      source: editing?.protocol === 'OpenVPN' ? editing.ovpnSource ?? editing.ovpnFileContent ?? '' : '',
      fileName: editing?.protocol === 'OpenVPN' ? editing.ovpnFileName ?? '' : '',
      remote: editing?.protocol === 'OpenVPN' ? editing.remote ?? '' : '',
      dirty: false,
    };
    const ex = (proto, key, fallback = '') => (editing?.protocol === proto ? editing[key] ?? fallback : fallback);

    body.innerHTML = '';
    const nameField = h(`
      <div class="card" style="margin-bottom:10px;">
        <div class="field" style="margin:0;">
          <label for="vpn-name">Nama VPN</label>
          <input id="vpn-name" placeholder="mis. Kantor Pusat" value="${esc(editing?.name ?? '')}" />
        </div>
      </div>`);
    body.appendChild(nameField);

    const tabs = h('<div class="tabs"></div>');
    PROTOCOLS.forEach((p) => {
      const b = h(`<button type="button" class="tab ${p === protocol ? 'active' : ''}">${p}</button>`);
      b.onclick = () => {
        protocol = p;
        tabs.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b));
        renderFields();
      };
      tabs.appendChild(b);
    });
    body.appendChild(tabs);

    const fieldsHost = h('<div></div>');
    body.appendChild(fieldsHost);

    const activate = h(`
      <label class="row" style="gap:8px;margin:12px 0;">
        <input type="checkbox" id="vpn-activate" ${!editing || editing.id === state.activeId || !state.activeId ? 'checked' : ''} />
        <span class="small">Jadikan VPN yang dipakai</span>
      </label>`);
    body.appendChild(activate);

    const saveBtn = h('<button type="button" class="btn btn-primary" style="width:100%;">Simpan</button>');
    const cancelBtn = h('<button type="button" class="btn btn-outline" style="width:100%;margin-top:8px;">Batal</button>');
    body.appendChild(saveBtn);
    body.appendChild(cancelBtn);
    cancelBtn.onclick = renderList;

    const $ = (sel) => fieldsHost.querySelector(sel);

    function renderFields() {
      fieldsHost.innerHTML = '';
      const panel = h('<div class="card form-panel"></div>');
      fieldsHost.appendChild(panel);
      if (protocol === 'WireGuard') {
        panel.innerHTML = `
          <p class="muted small">WireGuard memakai pasangan kunci, bukan username/password.</p>
          <div class="field"><label for="wg-private">Private key perangkat ini</label>
            <input id="wg-private" placeholder="base64, 44 karakter" value="${esc(ex('WireGuard', 'privateKey'))}" /></div>
          <div class="field"><label for="wg-public">Public key server/peer tujuan</label>
            <input id="wg-public" placeholder="base64, 44 karakter" value="${esc(ex('WireGuard', 'publicKey'))}" /></div>
          <div class="field"><label for="wg-endpoint">Endpoint server</label>
            <input id="wg-endpoint" placeholder="vpn.example.com:51820" value="${esc(ex('WireGuard', 'endpoint'))}" /></div>
          <div class="field"><label for="wg-allowed">Allowed IPs</label>
            <input id="wg-allowed" placeholder="0.0.0.0/0" value="${esc(ex('WireGuard', 'allowedIPs', '0.0.0.0/0'))}" /></div>
          <div class="field"><label for="wg-dns">DNS (opsional)</label>
            <input id="wg-dns" placeholder="1.1.1.1" value="${esc(ex('WireGuard', 'dns'))}" /></div>
          <div class="field"><label for="wg-psk">Preshared key (opsional)</label>
            <input id="wg-psk" placeholder="lapisan keamanan tambahan" value="${esc(ex('WireGuard', 'presharedKey'))}" /></div>`;
      } else if (protocol === 'OpenVPN') {
        panel.innerHTML = `
          <p class="muted small">Pilih file <code>.ovpn</code> dari perangkat — kolom yang tidak diperlukan file itu akan disembunyikan.</p>
          <button type="button" class="btn btn-outline" id="ovpn-pick" style="width:100%;">Pilih file .ovpn…</button>
          <div id="ovpn-preview" class="card" style="margin:12px 0;" hidden></div>
          <div class="field" id="ovpn-remote-field" hidden>
            <label for="ovpn-remote">Host yang dipakai</label>
            <select id="ovpn-remote"></select>
            <input id="ovpn-remote-custom" placeholder="host atau host:port" style="margin-top:8px;" hidden />
          </div>
          <div id="ovpn-auth" hidden>
            <div class="field"><label for="ovpn-user">Username</label>
              <input id="ovpn-user" autocomplete="off" value="${esc(ex('OpenVPN', 'username'))}" /></div>
            <div class="field"><label for="ovpn-pass">Password</label>
              <input id="ovpn-pass" type="password" autocomplete="off" value="${esc(ex('OpenVPN', 'password'))}" /></div>
          </div>
          <div class="field" id="ovpn-keypass-field" hidden>
            <label for="ovpn-keypass">Password private key</label>
            <input id="ovpn-keypass" type="password" autocomplete="off" value="${esc(ex('OpenVPN', 'keyPassword'))}" />
            <div class="muted small">Private key di file ini terenkripsi. Ini password untuk membukanya — beda dari password login.</div>
          </div>
          <details style="margin-top:6px;" id="ovpn-manual">
            <summary class="muted small" style="cursor:pointer;">Tempel isi file manual (opsional)</summary>
            <textarea id="ovpn-content" rows="6" style="margin-top:8px;" placeholder="client&#10;dev tun&#10;remote ...">${esc(draft.source)}</textarea>
          </details>`;
        wireOvpn();
      } else {
        panel.innerHTML = `
          <p class="muted small">Tunnel SSH — cocok untuk akses server pribadi/agent, bukan VPN seluruh perangkat.</p>
          <div class="field"><label for="ssh-host">Host</label>
            <input id="ssh-host" placeholder="203.0.113.10" value="${esc(ex('SSH', 'host'))}" /></div>
          <div class="field"><label for="ssh-port">Port</label>
            <input id="ssh-port" type="number" placeholder="22" value="${esc(ex('SSH', 'port', '22'))}" /></div>
          <div class="field"><label for="ssh-user">Username</label>
            <input id="ssh-user" value="${esc(ex('SSH', 'username'))}" /></div>
          <div class="field"><label for="ssh-password">Password (atau isi private key di bawah)</label>
            <input id="ssh-password" type="password" value="${esc(ex('SSH', 'password'))}" /></div>
          <div class="field"><label for="ssh-key">Private key (opsional, format OpenSSH/PEM)</label>
            <textarea id="ssh-key" rows="4" placeholder="-----BEGIN OPENSSH PRIVATE KEY-----">${esc(ex('SSH', 'privateKey'))}</textarea></div>
          <div class="field"><label for="ssh-local">Local port forward</label>
            <input id="ssh-local" type="number" placeholder="8080" value="${esc(ex('SSH', 'localPort'))}" /></div>
          <div class="field"><label for="ssh-remote">Remote port tujuan</label>
            <input id="ssh-remote" type="number" placeholder="80" value="${esc(ex('SSH', 'remotePort'))}" /></div>`;
      }
    }

    // Semua yang bergantung pada isi file .ovpn: pratinjau, daftar host,
    // dan kolom login/password-key yang hanya tampil kalau memang dibutuhkan.
    function wireOvpn() {
      const textarea = $('#ovpn-content');
      const preview = $('#ovpn-preview');
      const remoteField = $('#ovpn-remote-field');
      const remoteSel = $('#ovpn-remote');
      const remoteCustom = $('#ovpn-remote-custom');

      function refresh() {
        const text = draft.source;
        const a = analyzeOvpn(text);
        textarea.value = text;
        if (!text.trim()) {
          preview.hidden = true;
          remoteField.hidden = true;
          $('#ovpn-auth').hidden = true;
          $('#ovpn-keypass-field').hidden = true;
          return;
        }
        preview.hidden = false;
        if (!a.valid) {
          preview.innerHTML = '<strong>Pratinjau</strong><p class="small" style="color:var(--bad);margin:6px 0 0;">Isi ini tidak terlihat seperti file .ovpn (tidak ada baris "client"/"remote").</p>';
          remoteField.hidden = true;
          $('#ovpn-auth').hidden = true;
          $('#ovpn-keypass-field').hidden = true;
          return;
        }
        const keyText = !a.hasKey ? 'Tidak ada' : a.encryptedKey ? 'Ada — terenkripsi' : 'Ada — tidak terenkripsi';
        const row = (k, v) => `<div class="row-between" style="margin:3px 0;"><span class="muted small">${k}</span><span class="small" style="text-align:right;">${esc(v)}</span></div>`;
        const saved = editing && !draft.dirty;
        preview.innerHTML = `
          <div class="row-between"><strong>${esc(draft.fileName || 'File .ovpn')}</strong>
            <span class="pill ${saved ? 'pill--ok' : 'pill--warn'}">${saved ? 'Tersimpan' : 'Belum disimpan'}</span></div>
          <div style="margin-top:8px;">
            ${row('Server', a.server || '—')}
            ${row('Cipher / Auth', [a.cipher, a.auth].filter(Boolean).join(' / ') || '—')}
            ${row('Login username/password', a.needsAuth ? 'Diperlukan' : 'Tidak perlu')}
            ${row('Sertifikat CA / klien', (a.hasCa ? '✓' : '✗') + ' / ' + (a.hasCert ? '✓' : '✗'))}
            ${row('Private key', keyText)}
          </div>
          <details style="margin-top:8px;"><summary class="muted small" style="cursor:pointer;">Lihat isi (key disembunyikan)</summary>
            <pre style="font-size:11px;white-space:pre-wrap;word-break:break-all;margin:6px 0 0;">${esc(redactedPreview(text))}</pre></details>`;

        // Pilihan host: semua baris `remote` di file, plus host kustom.
        const remotes = listRemotes(text);
        remoteField.hidden = remotes.length === 0;
        remoteSel.innerHTML =
          remotes.map((r) => `<option value="${esc(r.key)}">${esc(r.host)}:${esc(r.port)} (${esc(r.proto.toUpperCase())})</option>`).join('') +
          '<option value="__custom">Host lain…</option>';
        if (!draft.remote) draft.remote = remotes[0]?.key ?? '';
        if (remotes.some((r) => r.key === draft.remote)) {
          remoteSel.value = draft.remote;
          remoteCustom.hidden = true;
        } else {
          remoteSel.value = '__custom';
          remoteCustom.hidden = false;
          remoteCustom.value = draft.remote;
        }

        // Kolom yang hanya muncul bila file memintanya.
        $('#ovpn-auth').hidden = !a.needsAuth;
        $('#ovpn-keypass-field').hidden = !(a.hasKey && a.encryptedKey);
      }

      remoteSel.onchange = () => {
        if (remoteSel.value === '__custom') {
          remoteCustom.hidden = false;
          draft.remote = remoteCustom.value.trim();
        } else {
          remoteCustom.hidden = true;
          draft.remote = remoteSel.value;
        }
      };
      remoteCustom.oninput = () => (draft.remote = remoteCustom.value.trim());

      $('#ovpn-pick').onclick = async () => {
        if (!Native.attached) {
          $('#ovpn-manual').open = true;
          toast('Pemilih file hanya ada di aplikasi terpasang — tempel isinya di sini.');
          return;
        }
        try {
          const r = await Native.pickTextFile();
          if (!r || r.cancelled) return;
          if (!r.ok) {
            toast(r.message || 'Gagal membaca file.');
            return;
          }
          draft.source = r.text;
          draft.fileName = r.name || '';
          draft.remote = '';
          draft.dirty = true;
          const nameInput = nameField.querySelector('#vpn-name');
          if (!nameInput.value.trim()) nameInput.value = (r.name || 'OpenVPN').replace(/\.(ovpn|conf|txt)$/i, '');
          refresh();
          if (!analyzeOvpn(r.text).valid) toast('File ini sepertinya bukan konfigurasi OpenVPN.');
        } catch (e) {
          toast('Gagal membaca file: ' + e.message);
        }
      };
      textarea.addEventListener('input', () => {
        draft.source = textarea.value;
        draft.dirty = true;
        refresh();
      });
      refresh();
    }

    saveBtn.onclick = async () => {
      const name = nameField.querySelector('#vpn-name').value.trim();
      if (!name) {
        toast('Beri nama VPN ini dulu.');
        return;
      }
      const val = (sel) => ($(sel)?.value ?? '').trim();
      let profile;
      if (protocol === 'WireGuard') {
        if (!val('#wg-endpoint') || !val('#wg-private') || !val('#wg-public')) {
          toast('Endpoint, private key, dan public key wajib diisi.');
          return;
        }
        profile = {
          protocol,
          endpoint: val('#wg-endpoint'),
          privateKey: val('#wg-private'),
          publicKey: val('#wg-public'),
          allowedIPs: val('#wg-allowed') || '0.0.0.0/0',
          dns: val('#wg-dns'),
          presharedKey: val('#wg-psk'),
        };
      } else if (protocol === 'OpenVPN') {
        const a = analyzeOvpn(draft.source);
        if (!draft.source.trim()) {
          toast('Pilih file .ovpn dulu.');
          return;
        }
        if (!a.valid) {
          toast('Isi file ini bukan konfigurasi OpenVPN.');
          return;
        }
        if (a.needsAuth && (!val('#ovpn-user') || !$('#ovpn-pass').value)) {
          toast('VPN ini butuh username dan password.');
          return;
        }
        if (a.hasKey && a.encryptedKey && !$('#ovpn-keypass').value) {
          toast('Private key terenkripsi — isi password key-nya.');
          return;
        }
        profile = {
          protocol,
          ovpnSource: draft.source,
          ovpnFileName: draft.fileName,
          remote: draft.remote,
          username: a.needsAuth ? val('#ovpn-user') : '',
          password: a.needsAuth ? $('#ovpn-pass').value : '',
          keyPassword: a.hasKey && a.encryptedKey ? $('#ovpn-keypass').value : '',
        };
      } else {
        if (!val('#ssh-host') || !val('#ssh-user')) {
          toast('Host dan username wajib diisi.');
          return;
        }
        profile = {
          protocol,
          host: val('#ssh-host'),
          port: val('#ssh-port') || '22',
          username: val('#ssh-user'),
          password: $('#ssh-password').value,
          privateKey: val('#ssh-key'),
          localPort: val('#ssh-local'),
          remotePort: val('#ssh-remote'),
        };
      }
      profile.id = editing?.id ?? newId();
      profile.name = name;
      const idx = state.profiles.findIndex((p) => p.id === profile.id);
      if (idx >= 0) state.profiles[idx] = profile;
      else state.profiles.push(profile);
      if (activate.querySelector('input').checked) state.activeId = profile.id;
      if (!state.activeId) state.activeId = profile.id;
      saveBtn.disabled = true;
      try {
        await persist(`"${name}" disimpan${state.activeId === profile.id ? ' dan dipakai' : ''}.`);
        logActivity({ category: 'VPN', title: 'Server VPN disimpan', subtitle: `${protocol} · ${name}`, badge: 'Success' });
        renderList();
      } finally {
        saveBtn.disabled = false;
      }
    };

    renderFields();
  }

  renderList();
}
