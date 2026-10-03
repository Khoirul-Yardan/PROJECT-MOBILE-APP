import { h, icon } from '../ui.js';
import { Native } from '../bridge.js';
import { navigate } from '../router.js';

export default async function render(root) {
  let connected = null, busy = false, config = null;
  const el = h(`<div class="page vpn-page"><div class="topbar"><h1>VPN</h1></div>
    <section class="card vpn-status">${icon('shield')}<h2 id="status-text" role="status">Memeriksa status…</h2>
    <p id="server-text">Memuat server…</p><p id="protocol"></p></section>
    <p id="vpn-note" class="notice"></p><p id="error" class="error-text" role="alert"></p>
    <button id="connect-btn" class="btn btn-primary" disabled>Sambungkan</button>
    <button id="server-card" class="btn btn-outline" style="margin-top:12px">Atur server</button>
    <button id="refresh" class="btn-text">Periksa status</button>
    <p class="muted small">Waktu mulai koneksi: tidak tersedia. Rute trafik mengikuti konfigurasi AllowedIPs.</p></div>`);
  root.appendChild(el);
  const $ = s => el.querySelector(s);
  function paint() {
    $('#status-text').textContent = !Native.attached ? 'Pratinjau browser' : connected === null ? 'Status belum diketahui' : connected ? 'Terhubung' : 'Tidak terhubung';
    $('#server-text').textContent = config?.endpoint || config?.host || (config?.protocol === 'OpenVPN' ? 'File .ovpn tersimpan' : 'Belum ada server');
    $('#protocol').textContent = config ? `Protokol: ${config.protocol}` : '';
    $('#vpn-note').textContent = !Native.attached ? 'Pratinjau browser — koneksi VPN perangkat tidak tersedia.' : config && config.protocol !== 'WireGuard' ? 'Konfigurasi tersimpan; koneksi belum didukung.' : 'Status koneksi diperiksa dari perangkat. Sambungkan untuk meminta izin VPN.';
    $('#connect-btn').textContent = busy ? 'Memproses…' : !config ? 'Tambah server' : connected ? 'Putuskan VPN' : 'Sambungkan';
    $('#connect-btn').className = `btn ${connected ? 'btn-outline' : 'btn-primary'}`;
    $('#connect-btn').disabled = busy || !!config && (!Native.attached || config.protocol !== 'WireGuard' || connected === null);
    $('#server-card').disabled = busy;
  }
  async function refresh() {
    if (busy) return;
    $('#status-text').textContent = 'Memeriksa status…';
    const result = await Native.getVpnStatus();
    connected = typeof result?.connected === 'boolean' ? result.connected : null;
    paint();
  }
  $('#refresh').onclick = refresh;
  $('#server-card').onclick = () => navigate('/vpn-config');
  $('#connect-btn').onclick = async () => {
    if (!config) return navigate('/vpn-config');
    if (busy) return;
    busy = true; $('#error').textContent = ''; paint();
    const result = connected ? await Native.vpnDisconnect() : await Native.vpnConnect();
    connected = typeof result?.connected === 'boolean' ? result.connected : null;
    $('#error').textContent = result?.message || (result === null ? 'Perangkat belum memberikan hasil. Periksa status sebelum mencoba lagi.' : '');
    busy = false; paint();
  };
  const unwatch = Native.on('vpn_status', payload => { connected = typeof payload?.connected === 'boolean' ? payload.connected : null; paint(); });
  const resume = () => { if (!document.hidden) refresh(); };
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('focus', resume);
  config = await Native.getVpnConfig();
  if (!config?.protocol) config = null;
  await refresh();
  return { dispose() { unwatch(); document.removeEventListener('visibilitychange', resume); window.removeEventListener('focus', resume); } };
}
