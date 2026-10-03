import { h, header, toast } from '../ui.js';
import { Native } from '../bridge.js';
import { logActivity } from '../db.js';

// Each protocol has genuinely different fields — WireGuard is a key pair,
// not a login; OpenVPN ships as a .ovpn file; SSH is host/port/username +
// password-or-key. One shared form pretending they're all "host/port/
// username/password" was wrong, so the fields below swap per protocol.
const PROTOCOLS = ['WireGuard', 'OpenVPN', 'SSH'];

export default async function render(root) {
  const existing = await Native.getVpnConfig();
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
          <input id="wg-private" placeholder="base64, 44 karakter" value="${existing?.protocol === 'WireGuard' ? existing?.privateKey ?? '' : ''}" />
        </div>
        <div class="field">
          <label for="wg-public">Public key server/peer tujuan</label>
          <input id="wg-public" placeholder="base64, 44 karakter" value="${existing?.protocol === 'WireGuard' ? existing?.publicKey ?? '' : ''}" />
        </div>
        <div class="field">
          <label for="wg-endpoint">Endpoint server</label>
          <input id="wg-endpoint" placeholder="vpn.example.com:51820" value="${existing?.protocol === 'WireGuard' ? existing?.endpoint ?? '' : ''}" />
        </div>
        <div class="field">
          <label for="wg-allowed">Allowed IPs</label>
          <input id="wg-allowed" placeholder="0.0.0.0/0" value="${existing?.protocol === 'WireGuard' ? existing?.allowedIPs ?? '0.0.0.0/0' : '0.0.0.0/0'}" />
        </div>
        <div class="field">
          <label for="wg-dns">DNS (opsional)</label>
          <input id="wg-dns" placeholder="1.1.1.1" value="${existing?.protocol === 'WireGuard' ? existing?.dns ?? '' : ''}" />
        </div>
        <div class="field">
          <label for="wg-psk">Preshared key (opsional)</label>
          <input id="wg-psk" placeholder="lapisan keamanan tambahan" value="${existing?.protocol === 'WireGuard' ? existing?.presharedKey ?? '' : ''}" />
        </div>
        </div>
      `)
      );
    } else if (protocol === 'OpenVPN') {
      panel.appendChild(
        h(`
        <div>
        <p class="muted small">Tempel isi file <code>.ovpn</code> yang diberikan provider/server kamu.</p>
        <div class="field">
          <label for="ovpn-content">Isi file .ovpn</label>
          <textarea id="ovpn-content" rows="6" placeholder="client&#10;dev tun&#10;proto udp&#10;...">${existing?.protocol === 'OpenVPN' ? existing?.ovpnFileContent ?? '' : ''}</textarea>
        </div>
        <div class="field">
          <label for="ovpn-user">Username (jika server minta auth tambahan)</label>
          <input id="ovpn-user" value="${existing?.protocol === 'OpenVPN' ? existing?.username ?? '' : ''}" />
        </div>
        <div class="field">
          <label for="ovpn-pass">Password</label>
          <input id="ovpn-pass" type="password" value="${existing?.protocol === 'OpenVPN' ? existing?.password ?? '' : ''}" />
        </div>
        </div>
      `)
      );
    } else {
      panel.appendChild(
        h(`
        <div>
        <p class="muted small">Tunnel SSH — cocok untuk akses server pribadi/agent, bukan VPN seluruh perangkat.</p>
        <div class="field">
          <label for="ssh-host">Host</label>
          <input id="ssh-host" placeholder="203.0.113.10" value="${existing?.protocol === 'SSH' ? existing?.host ?? '' : ''}" />
        </div>
        <div class="field">
          <label for="ssh-port">Port</label>
          <input id="ssh-port" type="number" placeholder="22" value="${existing?.protocol === 'SSH' ? existing?.port ?? '22' : '22'}" />
        </div>
        <div class="field">
          <label for="ssh-user">Username</label>
          <input id="ssh-user" value="${existing?.protocol === 'SSH' ? existing?.username ?? '' : ''}" />
        </div>
        <div class="field">
          <label for="ssh-password">Password (atau isi private key di bawah)</label>
          <input id="ssh-password" type="password" value="${existing?.protocol === 'SSH' ? existing?.password ?? '' : ''}" />
        </div>
        <div class="field">
          <label for="ssh-key">Private key (opsional, format OpenSSH/PEM)</label>
          <textarea id="ssh-key" rows="4" placeholder="-----BEGIN OPENSSH PRIVATE KEY-----">${existing?.protocol === 'SSH' ? existing?.privateKey ?? '' : ''}</textarea>
        </div>
        <div class="field">
          <label for="ssh-local">Local port forward</label>
          <input id="ssh-local" type="number" placeholder="8080" value="${existing?.protocol === 'SSH' ? existing?.localPort ?? '' : ''}" />
        </div>
        <div class="field">
          <label for="ssh-remote">Remote port tujuan</label>
          <input id="ssh-remote" type="number" placeholder="80" value="${existing?.protocol === 'SSH' ? existing?.remotePort ?? '' : ''}" />
        </div>
        </div>
      `)
      );
    }

    const saveBtn = h('<button class="btn btn-primary" style="margin-top:4px;">Simpan</button>');
    saveBtn.onclick = save;
    panel.appendChild(saveBtn);

    panel.appendChild(
      h(`
      <p class="muted small" style="margin-top:14px;margin-bottom:0;">
        Tersimpan hanya di perangkat ini (Keystore/Keychain). Membuka tunnel jaringan
        sungguhan masih perlu plugin VPN/SSH native per protokol.
      </p>
    `)
    );
  }

  async function save() {
    let config;
    if (protocol === 'WireGuard') {
      const host = formHost.querySelector('#wg-endpoint').value.trim();
      const privateKey = formHost.querySelector('#wg-private').value.trim();
      const publicKey = formHost.querySelector('#wg-public').value.trim();
      if (!host || !privateKey || !publicKey) {
        toast('Endpoint, private key, dan public key wajib diisi.');
        return;
      }
      config = {
        protocol,
        endpoint: host,
        privateKey,
        publicKey,
        allowedIPs: formHost.querySelector('#wg-allowed').value.trim() || '0.0.0.0/0',
        dns: formHost.querySelector('#wg-dns').value.trim(),
        presharedKey: formHost.querySelector('#wg-psk').value.trim(),
      };
    } else if (protocol === 'OpenVPN') {
      const content = formHost.querySelector('#ovpn-content').value.trim();
      if (!content) {
        toast('Tempel isi file .ovpn dulu.');
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
        toast('Host dan username wajib diisi.');
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

    await Native.saveVpnConfig(config);
    const label = protocol === 'WireGuard' ? config.endpoint : protocol === 'SSH' ? config.host : 'File .ovpn';
    logActivity({ category: 'VPN', title: 'Server VPN disimpan', subtitle: `${protocol} · ${label}`, badge: 'Success' });
    toast('Server VPN disimpan.');
    history.back();
  }

  renderFields();
}
