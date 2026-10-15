// Banyak profil VPN per akun. Penyimpanan tetap SATU blob terenkripsi yang
// sama seperti sebelumnya (vpn_store.js + native VpnConfigService), supaya
// sisi native tidak perlu diubah: blob itu = profil AKTIF yang diratakan
// (protocol, ovpnFileContent, username, …) ditambah `profiles` dan
// `activeId`. Native hanya membaca field profil aktif dan mengabaikan sisanya.
import { Native } from './bridge.js';
import { saveVpnConfig as cloudSave, loadVpnConfig as cloudLoad, clearVpnConfig } from './vpn_store.js';
import { effectiveOvpn, analyzeOvpn } from './ovpn_info.js';

export function newId() {
  return 'vpn_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** Konfigurasi lama (satu server, tanpa `profiles`) dibungkus jadi satu profil. */
export function toState(config) {
  if (!config || (!config.protocol && !config.profiles)) return { profiles: [], activeId: null };
  if (Array.isArray(config.profiles)) {
    const profiles = config.profiles;
    const activeId = profiles.some((p) => p.id === config.activeId) ? config.activeId : profiles[0]?.id ?? null;
    return { profiles, activeId };
  }
  const { protocol } = config;
  const legacy = { ...config, id: newId(), name: protocol === 'OpenVPN' ? config.ovpnFileName || 'OpenVPN' : protocol };
  if (protocol === 'OpenVPN') {
    legacy.ovpnSource = config.ovpnFileContent;
    delete legacy.ovpnFileContent;
  }
  return { profiles: [legacy], activeId: legacy.id };
}

export function activeProfile(state) {
  return state.profiles.find((p) => p.id === state.activeId) ?? null;
}

/** Bentuk yang dibaca native: profil aktif diratakan + daftar profil. */
export function flatten(state) {
  const a = activeProfile(state);
  if (!a) return { profiles: state.profiles, activeId: null };
  const flat = { ...a, profiles: state.profiles, activeId: a.id };
  if (a.protocol === 'OpenVPN') flat.ovpnFileContent = effectiveOvpn(a);
  return flat;
}

export async function loadState() {
  let config = null;
  try {
    config = await cloudLoad();
  } catch (e) {
    console.warn('[vpn] gagal memuat dari akun, pakai penyimpanan perangkat', e);
  }
  const state = toState(config ?? (await Native.getVpnConfig()));
  // Cermin ke native supaya "Hubungkan" selalu membaca profil aktif terbaru.
  if (config) await Native.saveVpnConfig(flatten(state));
  return state;
}

/** Simpan ke perangkat dulu (itu yang dibaca tunnel), lalu ke akun. */
export async function saveState(state) {
  const flat = flatten(state);
  await Native.saveVpnConfig(flat);
  if (!flat.protocol) {
    try { await clearVpnConfig(); } catch (e) { console.warn(e); }
    return { cloudFailed: false };
  }
  try {
    await cloudSave(flat);
    return { cloudFailed: false };
  } catch (e) {
    console.warn('[vpn] gagal sinkron ke akun', e);
    return { cloudFailed: true };
  }
}

export function profileSummary(p) {
  if (p.protocol === 'WireGuard') return `WireGuard · ${p.endpoint || '—'}`;
  if (p.protocol === 'SSH') return `SSH · ${p.host || '—'}:${p.port || 22}`;
  const a = analyzeOvpn(effectiveOvpn(p));
  return `OpenVPN · ${a.server || 'file .ovpn'}`;
}
