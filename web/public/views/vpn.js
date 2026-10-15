import { h, toast, icon as uiIcon, pageIntro } from '../ui.js';
import { Native } from '../bridge.js';
import { navigate } from '../router.js';
import { logActivity } from '../db.js';
import { ovpnLabel, listRemotes } from '../ovpn_info.js';
import { loadState, saveState, flatten, activeProfile, profileSummary } from '../vpn_profiles.js';

export default async function render(root) {
  let connected = false;
  // Banyak profil VPN (lihat vpn_profiles.js): `state` = semua profil + yang
  // aktif; `config` = profil aktif yang sudah diratakan, yaitu persis yang
  // dibaca tunnel native saat "Hubungkan".
  let state = await loadState();
  let config = state.activeId ? flatten(state) : null;
  let connectedSince = null;
  // Ask native for the real tunnel state instead of assuming "disconnected"
  // on every load — otherwise a tunnel that is already up looks off, and
  // tapping Hubungkan again fights the live connection.
  try {
    const st = Native.attached ? await Native.vpnState() : null;
    if (st && st.connected) {
      connected = true;
      connectedSince = new Date();
    }
  } catch (e) {
    console.warn('[vpn] gagal membaca status tunnel', e);
  }

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
      <div id="profile-list" style="margin-bottom:12px;"></div>
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
    if (config.protocol === 'WireGuard' || config.protocol === 'OpenVPN') {
      noteEl.textContent = `${config.protocol} membuka tunnel jaringan asli di HP — trafik benar-benar dialihkan lewat server ini saat Connect.`;
    } else {
      noteEl.textContent = `${config.protocol} baru tersimpan sebagai konfigurasi — tunnel jaringan asli untuk ${config.protocol} belum tersedia, jadi Connect belum benar-benar mengalihkan trafik.`;
    }
  }

  function serverLabel(cfg) {
    if (!cfg) return null;
    if (cfg.protocol === 'WireGuard') return cfg.endpoint;
    if (cfg.protocol === 'OpenVPN') return ovpnLabel(cfg);
    return cfg.host ? `${cfg.host}:${cfg.port || 22}` : null;
  }

  function refresh() {
    icon.innerHTML = uiIcon(connected ? 'lock' : 'shield');
    text.textContent = connected ? 'Terhubung' : 'Belum terhubung';
    circle.classList.toggle('is-connected', connected);
    btn.textContent = connected ? 'Putuskan koneksi' : 'Hubungkan VPN';
    const label = serverLabel(config);
    serverText.textContent = label
      ? `${config.name || config.protocol} · ${config.protocol}`
      : 'Belum ada server — ketuk untuk menambah';
    renderProfiles();
    el.querySelector('#stat-host').textContent = connected ? label || '—' : '—';
    el.querySelector('#stat-protocol').textContent = config?.protocol || '—';
    el.querySelector('#stat-since').textContent =
      connected && connectedSince
        ? connectedSince.toTimeString().slice(0, 5)
        : '—';
    updateNote();
  }

  el.querySelector('#server-card').onclick = () => navigate('/vpn-config');

  const profileListEl = el.querySelector('#profile-list');
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  async function applyState(message) {
    config = state.activeId ? flatten(state) : null;
    const { cloudFailed } = await saveState(state);
    if (cloudFailed) toast('Tersimpan di perangkat ini saja — gagal sinkron ke akun.');
    else if (message) toast(message);
    refresh();
  }

  // Pilih VPN yang dipakai (satu ketukan) dan, untuk file .ovpn yang memuat
  // beberapa `remote`, host mana yang dipakai.
  function renderProfiles() {
    profileListEl.innerHTML = '';
    if (state.profiles.length === 0) return;
    const active = activeProfile(state);
    const rows = state.profiles.map((p) => {
      const on = p.id === state.activeId;
      return `<button type="button" class="card tappable" data-id="${esc(p.id)}" style="width:100%;text-align:left;margin-bottom:8px;${on ? 'border-color:var(--accent,#2f6f64);' : ''}">
        <div class="row-between"><strong>${esc(p.name)}</strong><span class="pill ${on ? 'pill--ok' : ''}">${on ? 'Dipakai' : 'Pilih'}</span></div>
        <div class="muted small" style="margin-top:4px;">${esc(profileSummary(p))}</div></button>`;
    });
    profileListEl.appendChild(h(`<div><div class="muted small" style="margin:0 0 6px;">VPN yang dipakai</div>${rows.join('')}</div>`));
    profileListEl.querySelectorAll('[data-id]').forEach((b) => {
      b.onclick = async () => {
        if (b.dataset.id === state.activeId) return;
        if (connected) {
          toast('Putuskan koneksi dulu sebelum pindah VPN.');
          return;
        }
        state.activeId = b.dataset.id;
        await applyState(`VPN aktif: ${activeProfile(state).name}`);
      };
    });
    const remotes = active?.protocol === 'OpenVPN' ? listRemotes(active.ovpnSource ?? active.ovpnFileContent) : [];
    if (remotes.length > 1) {
      const sel = h(`<div class="card"><label class="muted small" for="host-pick">Host yang dipakai</label>
        <select id="host-pick" style="width:100%;margin-top:6px;">${remotes
          .map((r) => `<option value="${esc(r.key)}" ${(active.remote || remotes[0].key) === r.key ? 'selected' : ''}>${esc(r.host)}:${esc(r.port)} (${esc(r.proto.toUpperCase())})</option>`)
          .join('')}</select></div>`);
      sel.querySelector('select').onchange = async (e) => {
        if (connected) {
          toast('Putuskan koneksi dulu sebelum pindah host.');
          e.target.value = active.remote || remotes[0].key;
          return;
        }
        active.remote = e.target.value;
        await applyState(`Host dipakai: ${e.target.value}`);
      };
      profileListEl.appendChild(sel);
    }
  }

  btn.onclick = async () => {
    if (!connected && !config) {
      toast('No VPN server configured yet — add one first.');
      navigate('/vpn-config');
      return;
    }
    // OpenVPN in particular can legitimately take tens of seconds to give a
    // definite yes/no (see bridge.js's vpnConnect timeout note) — without
    // this, a tap during that window looked exactly like a dead button
    // (nothing visibly happens), which just invited more taps piling up
    // more concurrent connect attempts in the background.
    btn.disabled = true;
    btn.textContent = connected ? 'Memutuskan…' : 'Menghubungkan…';
    let result;
    try {
      result = connected ? await Native.vpnDisconnect() : await Native.vpnConnect();
    } finally {
      btn.disabled = false;
    }
    connected = !!(result && result.connected);
    connectedSince = connected ? new Date() : null;
    if (result && result.message) {
      toast(result.message);
    } else if (!result) {
      toast('Tidak ada jawaban dari sisi native — coba lagi, atau cek apakah konfigurasi VPN valid.');
    }
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
