import { h, toast, icon as uiIcon, pageIntro } from '../ui.js';
import { Native } from '../bridge.js';
import { navigate } from '../router.js';
import { logActivity } from '../db.js';

export default async function render(root) {
  let connected = false;
  let config = await Native.getVpnConfig();
  let connectedSince = null;

  const el = h(`
    <div class="page vpn-page">
      <div class="topbar"><h1>Koneksi VPN</h1></div>
      <div class="vpn-hero">
        <div id="status-circle" role="status" aria-live="polite">
          <span id="status-icon" aria-hidden="true">${uiIcon('shield')}</span>
          <span id="status-text" style="font-weight:700;margin-top:8px;">Belum terhubung</span>
        </div>
      </div>
      <button type="button" class="card tappable" id="server-card" style="margin-bottom:12px;">
        <div class="row">
          <span class="feature-icon">${uiIcon('layers')}</span>
          <span id="server-text" class="grow item-title">Loading…</span>
          <span>›</span>
        </div>
      </button>
      <div class="card">
        <div class="status-grid">
          <div style="text-align:center;">
            <div class="muted small">Host</div>
            <div id="stat-host" class="vpn-stat">—</div>
          </div>
          <div style="text-align:center;">
            <div class="muted small">Protokol</div>
            <div id="stat-protocol" class="vpn-stat">—</div>
          </div>
          <div style="text-align:center;">
            <div class="muted small">Sejak</div>
            <div id="stat-since" class="vpn-stat">—</div>
          </div>
        </div>
      </div>
      <button id="connect-btn" class="btn btn-primary vpn-connect">Hubungkan VPN</button>
      <p id="vpn-note" class="muted small vpn-note"></p>
    </div>
  `);
  root.appendChild(el);
  el.querySelector('.topbar').after(pageIntro('Terhubung dengan tenang.', 'Atur server dan kelola koneksi dari satu tempat.', { art: 'vpn', label: 'KONEKSI PRIBADI', tone: 'intro-mint' }));

  const circle = el.querySelector('#status-circle');
  const icon = el.querySelector('#status-icon');
  const text = el.querySelector('#status-text');
  const btn = el.querySelector('#connect-btn');
  const serverText = el.querySelector('#server-text');

  const noteEl = el.querySelector('#vpn-note');

  function updateNote() {
    if (!Native.attached) {
      // Opened in a plain browser (no Flutter shell) — bridge.js's dev
      // fallback fakes "connected: true" so the screen stays testable, but
      // no real tunnel exists here at all, WireGuard included. Only the
      // installed Android app talks to a real VpnService.
      noteEl.textContent = 'Preview browser: tidak ada shell native, jadi Connect di sini cuma simulasi tampilan (localStorage), bukan tunnel asli. Coba dari aplikasi Android untuk tunnel WireGuard sungguhan.';
      return;
    }
    if (!config) {
      // Every real VPN needs a server with its own credentials — there's no
      // "default, zero-setup" server to hand out, same as any general VPN
      // app (you either run your own server or subscribe to someone's).
      noteEl.textContent = 'Semua protokol butuh server dan kredensialnya sendiri — belum ada server default, ketuk di atas untuk mengisi WireGuard/OpenVPN/SSH milikmu.';
      return;
    }
    if (config.protocol === 'WireGuard') {
      noteEl.textContent = 'WireGuard membuka tunnel jaringan asli di HP — trafik benar-benar dialihkan lewat server ini saat Connect.';
    } else {
      noteEl.textContent = `${config.protocol} baru tersimpan sebagai konfigurasi — tunnel jaringan asli untuk ${config.protocol} belum tersedia, jadi Connect belum benar-benar mengalihkan trafik.`;
    }
  }

  function serverLabel(cfg) {
    if (!cfg) return null;
    if (cfg.protocol === 'WireGuard') return cfg.endpoint;
    if (cfg.protocol === 'OpenVPN') return 'File .ovpn tersimpan';
    return cfg.host ? `${cfg.host}:${cfg.port || 22}` : null;
  }

  function refresh() {
    icon.innerHTML = uiIcon(connected ? 'lock' : 'shield');
    text.textContent = connected ? 'Terhubung' : 'Belum terhubung';
    circle.classList.toggle('is-connected', connected);
    btn.textContent = connected ? 'Putuskan koneksi' : 'Hubungkan VPN';
    const label = serverLabel(config);
    serverText.textContent = label
      ? `${config.protocol} · ${label}`
      : 'Belum ada server — ketuk untuk menambah';
    el.querySelector('#stat-host').textContent = connected ? label || '—' : '—';
    el.querySelector('#stat-protocol').textContent = config?.protocol || '—';
    el.querySelector('#stat-since').textContent =
      connected && connectedSince
        ? connectedSince.toTimeString().slice(0, 5)
        : '—';
    updateNote();
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
    if (result && result.message) toast(result.message);
    logActivity({
      category: 'VPN',
      title: connected ? 'VPN connected' : 'VPN disconnected',
      subtitle: config ? `${config.protocol} · ${serverLabel(config) || ''}` : undefined,
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
