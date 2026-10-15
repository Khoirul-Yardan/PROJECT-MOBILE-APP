// VPN server config, synced through the user's Supabase account instead of
// only living in one device's Keystore/Keychain — a server added on one
// device is still there after a reinstall or on another device. See
// secure_store.js for the encryption scheme (same one api_credentials
// uses) and its security note.
//
// The native side (VpnConfigService/VpnTunnelService) still keeps its own
// local copy: that's what's actually read the moment "Connect" opens a real
// tunnel, so it must keep working even offline or before this module's
// first cloud round-trip resolves. This module is the account-level source
// of truth; callers (vpn.js, vpn-config.js) mirror whatever they load here
// into Native.saveVpnConfig() so the two stay in sync.
import { sb, currentUser } from './db.js';
import { encryptForUser, decryptForUser } from './secure_store.js';

const PEPPER = 'aihub-vpn-v1'; // not secret; just domain-separates the key derivation from credentials.js's

export async function saveVpnConfig(config) {
  const user = await currentUser();
  if (!user) throw new Error('Belum masuk akun.');
  const { encrypted, iv } = await encryptForUser(user.id, PEPPER, JSON.stringify(config));
  const { error } = await sb.from('vpn_configs').upsert(
    {
      user_id: user.id,
      protocol: config.protocol,
      encrypted_config: encrypted,
      iv,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}

export async function loadVpnConfig() {
  const user = await currentUser();
  if (!user) return null;
  const { data } = await sb
    .from('vpn_configs')
    .select('encrypted_config,iv')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!data) return null;
  const json = await decryptForUser(user.id, PEPPER, data.encrypted_config, data.iv);
  return JSON.parse(json);
}

export async function clearVpnConfig() {
  const user = await currentUser();
  if (!user) return;
  await sb.from('vpn_configs').delete().eq('user_id', user.id);
}
