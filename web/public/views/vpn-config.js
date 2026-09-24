import { h, header, toast } from '../ui.js';
import { Native } from '../bridge.js';
import { logActivity } from '../db.js';

const PROTOCOLS = ['OpenVPN', 'WireGuard', 'SSH (Termius-style)'];

export default async function render(root) {
  const existing = await Native.getVpnConfig();

  const el = h(`<div></div>`);
  el.appendChild(header('VPN Server', { back: true }));
  el.appendChild(
    h(`
    <p class="muted small">Enter your VPN/SSH server details (OpenVPN, WireGuard, or an SSH tunnel like Termius).</p>
    <div class="field">
      <label>Protocol</label>
      <select id="protocol">
        ${PROTOCOLS.map((p) => `<option ${existing?.protocol === p ? 'selected' : ''}>${p}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label>Server host</label>
      <input id="host" placeholder="vpn.example.com or 203.0.113.10" value="${existing?.host ?? ''}" />
    </div>
    <div class="field">
      <label>Port</label>
      <input id="port" type="number" placeholder="1194" value="${existing?.port ?? ''}" />
    </div>
    <div class="field">
      <label>Username</label>
      <input id="username" value="${existing?.username ?? ''}" />
    </div>
    <div class="field">
      <label>Password</label>
      <input id="password" type="password" value="${existing?.password ?? ''}" />
    </div>
    <p class="muted small">
      Saved to this device only (Keystore/Keychain). Opening an actual network tunnel
      still needs a native VPN/SSH plugin.
    </p>
    <button id="save" class="btn btn-primary" style="margin-top:12px;">Save</button>
  `)
  );
  root.appendChild(el);

  el.querySelector('#save').onclick = async () => {
    const config = {
      protocol: el.querySelector('#protocol').value,
      host: el.querySelector('#host').value.trim(),
      port: el.querySelector('#port').value.trim(),
      username: el.querySelector('#username').value.trim(),
      password: el.querySelector('#password').value,
    };
    if (!config.host || !config.port) {
      toast('Host dan port wajib diisi.');
      return;
    }
    await Native.saveVpnConfig(config);
    logActivity({
      category: 'VPN',
      title: 'VPN server saved',
      subtitle: `${config.protocol} · ${config.host}:${config.port}`,
      badge: 'Success',
    });
    toast('Server VPN disimpan.');
    history.back();
  };
}
