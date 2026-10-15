import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Stores the Terminal screen's own SSH target (host/port/username +
/// password-or-key) on-device only.
///
/// Deliberately separate from [VpnConfigService]'s "SSH" protocol slot: that
/// one is a single config slot shared with WireGuard/OpenVPN (only one VPN
/// server can be "the" active one at a time), while a VPN tunnel and the
/// server you SSH into behind it are normally two different things — connect
/// WireGuard/OpenVPN first to reach the private network, then SSH into
/// whichever box on it you actually want a shell on.
class SshConnectionService {
  SshConnectionService._();

  static const _storage = FlutterSecureStorage();
  static const _key = 'ssh_terminal_connection';
  static const _timeout = Duration(seconds: 3);

  static Future<void> save(Map<String, dynamic> connection) async {
    try {
      await _storage.write(key: _key, value: jsonEncode(connection)).timeout(_timeout);
    } catch (_) {
      // Best-effort — same as VpnConfigService.
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
}
