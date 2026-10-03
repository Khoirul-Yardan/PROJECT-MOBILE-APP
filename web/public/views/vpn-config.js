import { h, header, toast, escapeHtml } from '../ui.js';
import { Native } from '../bridge.js';
import { logActivity } from '../db.js';

// Each protocol has genuinely different fields — WireGuard is a key pair,
// not a login; OpenVPN ships as a .ovpn file; SSH is host/port/username +
// password-or-key. One shared form pretending they're all "host/port/
// username/password" was wrong, so the fields below swap per protocol.
const PROTOCOLS = ['WireGuard', 'OpenVPN', 'SSH'];

export default async function render(root) {
  const existing = await Native.getVpnConfig();
  const drafts = new Map();
  let saving = false;
  const value = key => escapeHtml(existing?.protocol === protocol ? existing?.[key] ?? '' : '');
  let protocol = existing?.protocol || 'WireGuard';

  const el = h(`<div class="page vpn-config-page"></div>`);
  el.appendChild(header('Server VPN', { back: true }));
  el.appendChild(
    h(`
    <p class="muted small" style="margin-top:-8px;">
      Field yang diminta menyesuaikan protokol yang kamu pilih.
    </p>
  `)
  );

  const protocolTabs = h('<div id="protocol-tabs" class="tabs"></div>');
  el.appendChild(protocolTabs);
  PROTOCOLS.forEach((p) => {
    const btn = h(`<button class="tab ${p === protocol ? 'active' : ''}">${p}</button>`);
    btn.onclick = () => {
      drafts.set(protocol, Object.fromEntries([...formHost.querySelectorAll('input,textarea')].map(f => [f.id,f.value])));
      protocol = p;
      protocolTabs.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === btn));
      renderFields();
    };
    protocolTabs.appendChild(btn);
  });

  const formHost = h('<div></div>');
  el.appendChild(formHost);
  root.appendChild(el);

  function renderFields() {
    formHost.innerHTML = '';
    const panel = h('<div class="card form-panel"></div>');
    formHost.appendChild(panel);

    if (protocol === 'WireGuard') {
      panel.appendChild(
        h(`
        <div>
        <p class="muted small">WireGuard memakai pasangan kunci, bukan username/password.</p>
        <div class="field">
          <label for="wg-private">Private key perangkat ini</label>
          <input type="password" id="wg-private" placeholder="base64, 44 karakter" value="${value('privateKey')}" />
        </div>
        <div class="field">
          <label for="wg-public">Public key server/peer tujuan</label>
          <input id="wg-public" placeholder="base64, 44 karakter" value="${value('publicKey')}" />
        </div>
        <div class="field">
          <label for="wg-endpoint">Endpoint server</label>
          <input id="wg-endpoint" placeholder="vpn.example.com:51820" value="${value('endpoint')}" />
        </div>
        <div class="field"><label for="wg-address">Alamat interface perangkat (CIDR)</label><input id="wg-address" placeholder="10.0.0.2/32" value="${value('address')}" /></div>
        <div class="field">
          <label for="wg-allowed">Allowed IPs</label>
          <input id="wg-allowed" placeholder="0.0.0.0/0" value="${value('allowedIPs') || '0.0.0.0/0'}" />
        </div>
        <div class="field">
          <label for="wg-dns">DNS (opsional)</label>
          <input id="wg-dns" placeholder="1.1.1.1" value="${value('dns')}" />
        </div>
        <div class="field">
          <label for="wg-psk">Preshared key (opsional)</label>
          <input type="password" id="wg-psk" placeholder="lapisan keamanan tambahan" value="${value('presharedKey')}" />
        </div>
        </div>
      `)
      );
    } else if (protocol === 'OpenVPN') {
      panel.appendChild(
        h(`
        <div>
        <p class="muted small">Konfigurasi OpenVPN dapat disimpan; koneksi belum didukung. Tempel isi file <code>.ovpn</code>.</p>
        <div class="field">
          <label for="ovpn-content">Isi file .ovpn</label>
          <textarea id="ovpn-content" rows="6" placeholder="client&#10;dev tun&#10;proto udp&#10;...">${value('ovpnFileContent')}</textarea>
        </div>
        <div class="field">
          <label for="ovpn-user">Username (jika server minta auth tambahan)</label>
          <input id="ovpn-user" value="${value('username')}" />
        </div>
        <div class="field">
          <label for="ovpn-pass">Password</label>
          <input id="ovpn-pass" type="password" value="${value('password')}" />
        </div>
        </div>
      `)
      );
    } else {
      panel.appendChild(
        h(`
        <div>
        <p class="muted small">Konfigurasi SSH dapat disimpan; koneksi belum didukung.</p>
        <div class="field">
          <label for="ssh-host">Host</label>
          <input id="ssh-host" placeholder="203.0.113.10" value="${value('host')}" />
        </div>
        <div class="field">
          <label for="ssh-port">Port</label>
          <input id="ssh-port" type="number" placeholder="22" value="${value('port') || '22'}" />
        </div>
        <div class="field">
          <label for="ssh-user">Username</label>
          <input id="ssh-user" value="${value('username')}" />
        </div>
        <div class="field">
          <label for="ssh-password">Password (atau isi private key di bawah)</label>
          <input id="ssh-password" type="password" value="${value('password')}" />
        </div>
        <div class="field">
          <label for="ssh-key">Private key (opsional, format OpenSSH/PEM)</label>
          <textarea id="ssh-key" rows="4" placeholder="-----BEGIN OPENSSH PRIVATE KEY-----">${value('privateKey')}</textarea>
        </div>
        <div class="field">
          <label for="ssh-local">Local port forward</label>
          <input id="ssh-local" type="number" placeholder="8080" value="${value('localPort')}" />
        </div>
        <div class="field">
          <label for="ssh-remote">Remote port tujuan</label>
          <input id="ssh-remote" type="number" placeholder="80" value="${value('remotePort')}" />
        </div>
        </div>
      `)
      );
    }

    const saveBtn = h('<button class="btn btn-primary" style="margin-top:4px;">Simpan</button>');
    saveBtn.onclick = save;
    for (const [id,val] of Object.entries(drafts.get(protocol) || {})) { const field = panel.querySelector('#' + id); if (field) field.value = val; }
    panel.appendChild(h('<p id="save-error" class="error-text" role="alert" tabindex="-1"></p>'));
    panel.appendChild(saveBtn);

    panel.appendChild(
      h(`
      <p class="muted small" style="margin-top:14px;margin-bottom:0;">
        ${Native.attached ? 'Konfigurasi disimpan pada perangkat. Koneksi hanya didukung untuk WireGuard.' : 'Pratinjau browser: konfigurasi disimpan di localStorage browser. Koneksi VPN perangkat tidak tersedia.'}
      </p>
    `)
    );
  }

  async function save() {
    if (saving) return;
    const errorEl = formHost.querySelector('#save-error');
    const invalid = text => { errorEl.textContent = text; errorEl.focus(); };
    let config;
    if (protocol === 'WireGuard') {
      const host = formHost.querySelector('#wg-endpoint').value.trim();
      const privateKey = formHost.querySelector('#wg-private').value.trim();
      const publicKey = formHost.querySelector('#wg-public').value.trim();
      if (!host || !privateKey || !publicKey || !formHost.querySelector('#wg-address').value.trim()) {
        invalid('Alamat interface, endpoint, private key, dan public key wajib diisi.');
        return;
      }
      config = {
        protocol,
        endpoint: host,
        privateKey,
        publicKey,
        address: formHost.querySelector('#wg-address').value.trim(),
        allowedIPs: formHost.querySelector('#wg-allowed').value.trim() || '0.0.0.0/0',
        dns: formHost.querySelector('#wg-dns').value.trim(),
        presharedKey: formHost.querySelector('#wg-psk').value.trim(),
      };
    } else if (protocol === 'OpenVPN') {
      const content = formHost.querySelector('#ovpn-content').value.trim();
      if (!content) {
        invalid('Tempel isi file .ovpn dulu.');
        return;
      }
      config = {
        protocol,
        ovpnFileContent: content,
        username: formHost.querySelector('#ovpn-user').value.trim(),
        password: formHost.querySelector('#ovpn-pass').value,
      };
    } else {
      const host = formHost.querySelector('#ssh-host').value.trim();
      const username = formHost.querySelector('#ssh-user').value.trim();
      if (!host || !username) {
        invalid('Host dan username wajib diisi.');
        return;
      }
      config = {
        protocol,
        host,
        port: formHost.querySelector('#ssh-port').value.trim() || '22',
        username,
        password: formHost.querySelector('#ssh-password').value,
        privateKey: formHost.querySelector('#ssh-key').value.trim(),
        localPort: formHost.querySelector('#ssh-local').value.trim(),
        remotePort: formHost.querySelector('#ssh-remote').value.trim(),
      };
    }

    saving = true;
    el.querySelectorAll('button').forEach(b => b.disabled = true);
    try {
      if (Native.attached) {
        const status = await Native.getVpnStatus();
        if (status?.connected && !window.confirm('Mengganti server akan memutus koneksi VPN. Simpan konfigurasi?')) return;
      }
      const result = await Native.saveVpnConfig(config);
      if (result === null) throw new Error('unavailable');
      logActivity({ category: 'VPN', title: 'Server VPN disimpan' });
      toast('Konfigurasi tersimpan'); history.back();
    } catch { invalid('Konfigurasi belum tersimpan. Periksa koneksi perangkat dan coba lagi.'); }
    finally { saving = false; el.querySelectorAll('button').forEach(b => b.disabled = false); }
  }

  renderFields();
}
