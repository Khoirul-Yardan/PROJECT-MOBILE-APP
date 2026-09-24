import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// A saved VPN/SSH server configuration (OpenVPN-style or an SSH tunnel like
/// Termius), stored on-device only.
class VpnConfig {
  const VpnConfig({
    required this.protocol,
    required this.host,
    required this.port,
    required this.username,
    required this.password,
  });

  final String protocol; // 'OpenVPN' | 'WireGuard' | 'SSH (Termius-style)'
  final String host;
  final String port;
  final String username;
  final String password;

  Map<String, String> toJson() => {
    'protocol': protocol,
    'host': host,
    'port': port,
    'username': username,
    'password': password,
  };

  factory VpnConfig.fromJson(Map<String, dynamic> json) => VpnConfig(
    protocol: json['protocol'] as String? ?? 'OpenVPN',
    host: json['host'] as String? ?? '',
    port: json['port'] as String? ?? '',
    username: json['username'] as String? ?? '',
    password: json['password'] as String? ?? '',
  );
}

/// Stores the user's real VPN/SSH server details in secure storage
/// (Keystore/Keychain) — never sent to the AI Hub backend.
///
/// Note: this only persists the connection *details*. Actually opening a
/// network tunnel (OpenVPN/WireGuard/SSH) needs a native platform plugin
/// (e.g. `openvpn_flutter`, `wireguard_flutter`, or an SSH client) wired
/// into the Android/iOS shell — that native integration is not included
/// here, so "Connect" reflects the saved config rather than a live tunnel.
class VpnConfigService {
  VpnConfigService._();

  static const _storage = FlutterSecureStorage();
  static const _key = 'vpn_config';
  // A platform with no secure-storage backend registered (e.g. the plain
  // widget-test harness) can leave the method channel call pending forever
  // instead of failing fast, so every call here is time-boxed.
  static const _timeout = Duration(seconds: 3);

  static Future<void> save(VpnConfig config) async {
    try {
      await _storage
          .write(key: _key, value: jsonEncode(config.toJson()))
          .timeout(_timeout);
    } catch (_) {
      // No secure-storage backend available (e.g. widget tests).
    }
  }

  static Future<VpnConfig?> load() async {
    try {
      final raw = await _storage.read(key: _key).timeout(_timeout);
      if (raw == null) return null;
      return VpnConfig.fromJson(jsonDecode(raw) as Map<String, dynamic>);
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
