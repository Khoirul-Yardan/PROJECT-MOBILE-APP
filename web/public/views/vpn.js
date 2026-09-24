import { h, toast } from '../ui.js';
import { Native } from '../bridge.js';
import { navigate } from '../router.js';
import { logActivity } from '../db.js';

export default async function render(root) {
  let connected = false;
  let config = await Native.getVpnConfig();
  let connectedSince = null;

  const el = h(`
    <div>
      <div class="topbar"><h1>VPN Connection</h1></div>
      <div style="text-align:center;padding:30px 0;">
        <div id="status-circle" style="width:150px;height:150px;border-radius:50%;margin:0 auto;
          display:flex;align-items:center;justify-content:center;flex-direction:column;
          background:linear-gradient(135deg,#fff,#e7faff,#e3d7ff);border:6px solid var(--border);">
          <span id="status-icon" style="font-size:34px;">🔓</span>
          <span id="status-text" style="font-weight:700;margin-top:8px;">Disconnected</span>
        </div>
      </div>
      <div class="card tappable" id="server-card" style="margin-bottom:12px;">
        <div class="row">
          <span style="font-size:20px;">🖧</span>
          <span id="server-text" style="flex:1;font-size:12px;font-weight:600;">Loading…</span>
          <span>›</span>
        </div>
      </div>
      <div class="card">
        <div class="status-grid">
          <div style="text-align:center;">
            <div class="muted small">Host</div>
            <div id="stat-host" style="font-size:12px;font-weight:600;margin-top:4px;">—</div>
          </div>
          <div style="text-align:center;">
            <div class="muted small">Protocol</div>
            <div id="stat-protocol" style="font-size:12px;font-weight:600;margin-top:4px;">—</div>
          </div>
          <div style="text-align:center;">
            <div class="muted small">Since</div>
            <div id="stat-since" style="font-size:12px;font-weight:600;margin-top:4px;">—</div>
          </div>
        </div>
      </div>
      <p class="muted small center" style="margin-top:14px;">
        Uses your saved server config. Opening a live network tunnel needs a native
        VPN/SSH plugin — not wired up yet, so no traffic is actually routed.
      </p>
      <button id="connect-btn" class="btn btn-primary" style="margin-top:18px;">Connect</button>
    </div>
  `);
  root.appendChild(el);

  const circle = el.querySelector('#status-circle');
  const icon = el.querySelector('#status-icon');
  const text = el.querySelector('#status-text');
  const btn = el.querySelector('#connect-btn');
  const serverText = el.querySelector('#server-text');

  function refresh() {
    icon.textContent = connected ? '🔒' : '🔓';
    text.textContent = connected ? 'Connected' : 'Disconnected';
    circle.style.background = connected
      ? 'linear-gradient(135deg,#20d7e5,#6588ff,#c15aff)'
      : 'linear-gradient(135deg,#fff,#e7faff,#e3d7ff)';
    circle.style.color = connected ? '#fff' : 'var(--text-dark)';
    btn.textContent = connected ? 'Disconnect' : 'Connect';
    serverText.textContent = config
      ? `${config.protocol} · ${config.host}:${config.port}`
      : 'No server configured — tap to add one';
    el.querySelector('#stat-host').textContent = connected ? config?.host || '—' : '—';
    el.querySelector('#stat-protocol').textContent = config?.protocol || '—';
    el.querySelector('#stat-since').textContent =
      connected && connectedSince
        ? connectedSince.toTimeString().slice(0, 5)
        : '—';
  }

  el.querySelector('#server-card').onclick = () => navigate('/vpn-config');

  btn.onclick = async () => {
    if (!connected && !config) {
      toast('No VPN server configured yet — add one first.');
      navigate('/vpn-config');
      return;
    }
    const result = connected ? await Native.vpnDisconnect() : await Native.vpnConnect();
    connected = !!(result && result.connected);
    connectedSince = connected ? new Date() : null;
    logActivity({
      category: 'VPN',
      title: connected ? 'VPN connected' : 'VPN disconnected',
      subtitle: config ? `${config.protocol} · ${config.host}` : undefined,
      badge: connected ? 'Success' : 'Info',
    });
    refresh();
  };

  Native.on('vpn_status', (payload) => {
    connected = !!payload?.connected;
    refresh();
  });

  refresh();
}
