import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Stores the user's real VPN/SSH server config on-device only — never sent
/// to the AI Hub backend.
///
/// The stored shape is a raw JSON map rather than a fixed Dart class on
/// purpose: WireGuard (private/public key pair, endpoint, allowed IPs),
/// OpenVPN (a full `.ovpn` file, optionally + username/password), and an
/// SSH tunnel (host/port/username + password-or-private-key) genuinely
/// don't share a field shape — always requiring `host/port/username/
/// password` regardless of protocol was wrong (WireGuard doesn't have a
/// username/password at all). The web layer (`views/vpn-config.js`) builds
/// the right shape per protocol; this service just persists whatever it's
/// given and hands it back unchanged.
///
/// Note: this only persists the connection *details*. Actually opening a
/// network tunnel needs a native platform plugin per protocol (e.g.
/// `wireguard_flutter`, `openvpn_flutter`, or an SSH client) wired into the
/// Android/iOS shell — that native integration is not included here, so
/// "Connect" reflects the saved config rather than a live tunnel.
class VpnConfigService {
  VpnConfigService._();

  static const _storage = FlutterSecureStorage();
  static const _key = 'vpn_config';
  // A platform with no secure-storage backend registered (e.g. the plain
  // widget-test harness) can leave the method channel call pending forever
  // instead of failing fast, so every call here is time-boxed.
  static const _timeout = Duration(seconds: 3);

  static Future<void> save(Map<String, dynamic> config) async {
    try {
      await _storage.write(key: _key, value: jsonEncode(config)).timeout(_timeout);
    } catch (_) {
      // No secure-storage backend available (e.g. widget tests).
    }
  }

  static Future<Map<String, dynamic>?> load() async {
    try {
      final raw = await _storage.read(key: _key).timeout(_timeout);
      if (raw == null) return null;
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  static Future<void> clear() async {
    try {
      await _storage.delete(key: _key).timeout(_timeout);
    } catch (_) {
      // Best-effort.
    }
  }
}
