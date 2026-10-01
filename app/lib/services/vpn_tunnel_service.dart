import 'package:wireguard_flutter/wireguard_flutter.dart';

/// Opens a real WireGuard tunnel (Android's VpnService under the hood) —
/// this is what actually reroutes the device's traffic through the user's
/// server, as opposed to [VpnConfigService] which only persists the config
/// fields. Only WireGuard is wired to a real tunnel right now: it's the one
/// modern general-purpose VPN protocol with a maintained Flutter plugin that
/// doesn't need a bundled native binary (OpenVPN/SSH would each need their
/// own separate native client and are still config-only, same as before).
///
/// [config] must be the WireGuard fields the same shape `views/vpn-config.js`
/// collects: privateKey, publicKey (peer), endpoint (host:port), allowedIPs,
/// dns (optional), presharedKey (optional).
class VpnTunnelService {
  VpnTunnelService._();

  static const _interfaceName = 'ai-hub-wg0';
  static bool _initialized = false;

  static Future<void> _ensureInitialized() async {
    if (_initialized) return;
    await WireGuardFlutter.instance.initialize(interfaceName: _interfaceName);
    _initialized = true;
  }

  static bool supports(String protocol) => protocol.toLowerCase() == 'wireguard';

  /// Builds a standard wg-quick config text from the saved field map and
  /// starts the tunnel. Throws if a required field is missing.
  static Future<void> connect(Map<String, dynamic> config) async {
    await _ensureInitialized();

    final privateKey = (config['privateKey'] as String?)?.trim();
    final publicKey = (config['publicKey'] as String?)?.trim();
    final endpoint = (config['endpoint'] as String?)?.trim();
    final allowedIPs = (config['allowedIPs'] as String?)?.trim();
    if (privateKey == null || privateKey.isEmpty) {
      throw Exception('Private key WireGuard belum diisi.');
    }
    if (publicKey == null || publicKey.isEmpty) {
      throw Exception('Public key server belum diisi.');
    }
    if (endpoint == null || endpoint.isEmpty) {
      throw Exception('Endpoint server belum diisi.');
    }

    final dns = (config['dns'] as String?)?.trim();
    final presharedKey = (config['presharedKey'] as String?)?.trim();
    final address = (config['address'] as String?)?.trim() ?? '10.0.0.2/32';

    final wgQuickConfig = StringBuffer()
      ..writeln('[Interface]')
      ..writeln('PrivateKey = $privateKey')
      ..writeln('Address = $address');
    if (dns != null && dns.isNotEmpty) wgQuickConfig.writeln('DNS = $dns');
    wgQuickConfig
      ..writeln('[Peer]')
      ..writeln('PublicKey = $publicKey');
    if (presharedKey != null && presharedKey.isNotEmpty) {
      wgQuickConfig.writeln('PresharedKey = $presharedKey');
    }
    wgQuickConfig
      ..writeln('AllowedIPs = ${(allowedIPs == null || allowedIPs.isEmpty) ? '0.0.0.0/0, ::/0' : allowedIPs}')
      ..writeln('Endpoint = $endpoint')
      ..writeln('PersistentKeepalive = 25');

    await WireGuardFlutter.instance.startVpn(
      serverAddress: endpoint,
      wgQuickConfig: wgQuickConfig.toString(),
      providerBundleIdentifier: 'com.aihub.app.VpnService',
    );
  }

  static Future<void> disconnect() async {
    await _ensureInitialized();
    await WireGuardFlutter.instance.stopVpn();
  }

  static Future<bool> isConnected() async {
    await _ensureInitialized();
    return WireGuardFlutter.instance.isConnected();
  }
}
