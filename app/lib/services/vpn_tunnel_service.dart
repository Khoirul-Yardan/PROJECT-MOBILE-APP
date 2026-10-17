import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:openvpn_flutter/openvpn_flutter.dart';
import 'package:wireguard_flutter/wireguard_flutter.dart';

import 'ovpn_remote.dart';

/// Opens a real tunnel (Android's VpnService under the hood) — this is what
/// actually reroutes the device's traffic through the user's server, as
/// opposed to [VpnConfigService] which only persists the config fields.
/// WireGuard and OpenVPN both get a real tunnel; SSH stays config-only (it's
/// a port-forward, not a whole-device VPN — see the Terminal screen instead,
/// which opens an interactive SSH shell directly rather than a tunnel).
///
/// [config] must be the fields the same shape `views/vpn-config.js` collects
/// per protocol: WireGuard needs privateKey, publicKey (peer), endpoint
/// (host:port), allowedIPs, dns (optional), presharedKey (optional). OpenVPN
/// needs ovpnFileContent (the whole .ovpn file text) plus optional
/// username/password for configs using `auth-user-pass`.
class VpnTunnelService {
  VpnTunnelService._();

  static const _interfaceName = 'ai-hub-wg0';
  static bool _wgInitialized = false;

  static Future<void> _ensureWgInitialized() async {
    if (_wgInitialized) return;
    await WireGuardFlutter.instance.initialize(interfaceName: _interfaceName);
    _wgInitialized = true;
  }

  static OpenVPN? _openvpn;
  static VPNStage _ovpnStage = VPNStage.disconnected;
  // Every stage this attempt went through (with the engine's raw text), so a
  // failure can say *where* it stopped instead of a generic message.
  static final List<String> _stageTrail = [];

  static String get _trail => _stageTrail.isEmpty
      ? 'Tahapan: (tidak ada event dari mesin OpenVPN)'
      : 'Tahapan: ${_stageTrail.join(' > ')}';
  // Which tunnel is actually live right now — not just "has OpenVPN ever
  // been touched this process", since once _openvpn is lazily created it
  // stays non-null even after switching back to WireGuard.
  static String? _activeProtocol;

  static Future<OpenVPN> _ensureOvpnInitialized() async {
    final existing = _openvpn;
    if (existing != null) return existing;
    final instance = OpenVPN(
      // ics-openvpn's own detailed connection log doesn't reach Logcat at
      // all (it posts to an in-app LogListener, not android.util.Log) — this
      // debugPrint is the only visibility we get into which stage a stuck
      // connection attempt is actually in (TLS handshake vs. waiting on the
      // server vs. something else) from `adb logcat | grep flutter`.
      onVpnStageChanged: (stage, raw) {
        _ovpnStage = stage;
        final label = raw.isEmpty || raw == stage.name ? stage.name : '${stage.name}($raw)';
        if (_stageTrail.isEmpty || _stageTrail.last != label) _stageTrail.add(label);
        debugPrint('[VpnTunnelService] OpenVPN stage: $stage ($raw)');
      },
    );
    await instance.initialize(
      groupIdentifier: 'group.com.aihub.ai_hub',
      providerBundleIdentifier: 'com.aihub.ai_hub.OpenVPNTunnel',
      localizedDescription: 'AI Hub VPN',
      lastStage: (stage) => _ovpnStage = stage,
    );
    _openvpn = instance;
    return instance;
  }

  static bool supports(String protocol) =>
      protocol.toLowerCase() == 'wireguard' ||
      protocol.toLowerCase() == 'openvpn';

  /// Starts the tunnel for whichever protocol [config] is for. Throws if a
  /// required field is missing or (OpenVPN) if the user denies/the server
  /// rejects the connection within [openvpnConnectTimeout].
  static Future<void> connect(Map<String, dynamic> config) async {
    final protocol = (config['protocol'] as String?)?.toLowerCase();
    if (protocol == 'openvpn') {
      await _connectOpenVpn(config);
    } else {
      await _connectWireGuard(config);
    }
    _activeProtocol = protocol;
  }

  static Future<void> _connectWireGuard(Map<String, dynamic> config) async {
    await _ensureWgInitialized();

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
      ..writeln(
        'AllowedIPs = ${(allowedIPs == null || allowedIPs.isEmpty) ? '0.0.0.0/0, ::/0' : allowedIPs}',
      )
      ..writeln('Endpoint = $endpoint')
      ..writeln('PersistentKeepalive = 25');

    await WireGuardFlutter.instance.startVpn(
      serverAddress: endpoint,
      wgQuickConfig: wgQuickConfig.toString(),
      providerBundleIdentifier: 'com.aihub.app.VpnService',
    );
  }

  // How long "Connect" waits for a definite yes/no before giving up and
  // reporting failure — openvpn_flutter's connect() itself only triggers the
  // permission dialog + background connection attempt and returns almost
  // immediately, so the real answer has to be polled from stage(). Widened
  // from 25s: a real TLS handshake over a slow/congested link legitimately
  // took longer than that in testing, with no error — just still
  // negotiating. Keep bridge.js's vpnConnect/vpnDisconnect timeout (in the
  // native shell) comfortably above this.
  static const _openvpnConnectTimeout = Duration(seconds: 50);

  /// Before handing off to the OpenVPN engine, check that at least one TCP
  /// `remote` accepts a connection from *this device's current network*.
  /// A server that only answers from certain networks (campus/LAN, IP
  /// allow-list) otherwise looks like a stuck handshake or a bad login.
  /// UDP remotes can't be probed this way and are left to the engine.
  static Future<void> _preflightReachable(String ovpn) async {
    final tcp = OvpnRemote.parse(ovpn).where((r) => r.proto == 'tcp').toList();
    if (tcp.isEmpty) return;
    for (final r in tcp) {
      try {
        final s = await Socket.connect(r.host, r.port, timeout: const Duration(seconds: 6));
        s.destroy();
        return;
      } catch (_) {
        // try the next remote
      }
    }
    throw Exception(
      'Server VPN tidak terjangkau dari jaringan perangkat ini (${tcp.join(', ')}). '
      'Ini bukan masalah username/password: server mungkin hanya bisa diakses dari '
      'jaringan tertentu (mis. kampus/LAN) atau port diblokir. Coba dari jaringan yang '
      'sama dengan laptop yang berhasil memakai OpenVPN.',
    );
  }

  static Future<void> _connectOpenVpn(Map<String, dynamic> config) async {
    final content = (config['ovpnFileContent'] as String?)?.trim();
    if (content == null || content.isEmpty) {
      throw Exception('Isi file .ovpn belum diisi.');
    }
    await _preflightReachable(content);
    final username = (config['username'] as String?)?.trim();
    final password = config['password'] as String?;
    // Some servers hand out an encrypted private key (a *second*, separate
    // password from auth-user-pass login, for decrypting the <key> block
    // itself). OpenVPN's own `askpass <file>` config directive is the usual
    // way to answer that, but the ics-openvpn fork this plugin wraps
    // explicitly strips `askpass` while parsing an inline config — so
    // instead this goes straight to a patched build of the plugin/library
    // (see third_party/openvpn_flutter and android/openvpn_library) that
    // wires it to VpnProfile.mKeyPassword directly, upstream never did.
    final keyPassword = config['keyPassword'] as String?;

    final openvpn = await _ensureOvpnInitialized();
    // A tunnel left up from an earlier attempt (or from before the app
    // process restarted) emits no new stage events when "connected" again,
    // which made the poll below time out even though the VPN was fine. Tear
    // it down first so this attempt starts from a known state.
    if (await openvpn.stage() == VPNStage.connected) {
      openvpn.disconnect();
      for (
        var i = 0;
        i < 15 && await openvpn.stage() == VPNStage.connected;
        i++
      ) {
        await Future.delayed(const Duration(milliseconds: 400));
      }
    }
    _ovpnStage = VPNStage.disconnected;
    _stageTrail.clear();
    // NOT awaited on purpose: this plugin's Android "connect" handler never
    // calls result.success (it just starts the service), so the returned
    // Future never completes — awaiting it hung this whole method forever
    // even after the tunnel was up, and the web UI sat on "Menghubungkan…"
    // until its own timeout. The real answer is polled from _ovpnStage below;
    // only an immediate PlatformException is captured here.
    Object? connectError;
    openvpn
        .connect(
          content,
          'AI Hub VPN',
          username: (username != null && username.isNotEmpty) ? username : null,
          password: (password != null && password.isNotEmpty) ? password : null,
          keyPassword: (keyPassword != null && keyPassword.isNotEmpty)
              ? keyPassword
              : null,
          // Our target configs embed <cert>/<key> inline rather than relying on
          // the plugin's own "client-cert-not-required" default.
          certIsRequired: true,
        )
        .then<void>((_) {}, onError: (Object e) => connectError = e);

    // ics-openvpn auto-reconnects on its own (driven by the config's
    // connect-retry) rather than surfacing a clean denied/error stage when
    // the server rejects auth-user-pass — stage just cycles back through
    // tcp_connect/wait_connection and tries again every few seconds. Left
    // alone, that silently hammers the server with the same bad login over
    // and over for the whole _openvpnConnectTimeout window, which risks
    // tripping a server-side brute-force lockout even once the real
    // password is fixed. So: once we've reached "authenticating", seeing
    // the stage regress back to an earlier one is treated as a hard
    // failure — stop immediately instead of letting the engine keep
    // retrying on our behalf.
    var reachedAuthenticating = false;
    final deadline = DateTime.now().add(_openvpnConnectTimeout);
    while (DateTime.now().isBefore(deadline)) {
      // Events can be missed (e.g. the stage stream was re-listened after a
      // screen change); the engine's own stage() is the source of truth.
      if (_ovpnStage != VPNStage.connected &&
          await openvpn.stage() == VPNStage.connected) {
        _ovpnStage = VPNStage.connected;
      }
      final stage = _ovpnStage;
      if (connectError != null) {
        throw Exception('OpenVPN gagal dimulai: $connectError. $_trail');
      }
      if (stage == VPNStage.authenticating) reachedAuthenticating = true;
      switch (stage) {
        case VPNStage.connected:
          return;
        case VPNStage.denied:
          throw Exception('Izin VPN ditolak.');
        case VPNStage.error:
          throw Exception('OpenVPN gagal terhubung ke server. $_trail');
        case VPNStage.tcp_connect:
        case VPNStage.wait_connection:
          if (reachedAuthenticating) {
            openvpn.disconnect();
            throw Exception(
              'Server menolak login (username/password) dan mencoba ulang otomatis — dihentikan agar tidak memicu pemblokiran. Cek lagi kredensial, atau tunggu sebentar sebelum coba lagi kalau sempat berkali-kali gagal. $_trail',
            );
          }
          await Future.delayed(const Duration(milliseconds: 400));
        default:
          await Future.delayed(const Duration(milliseconds: 400));
      }
    }
    throw Exception('OpenVPN tidak merespons (timeout 50 dtk) — cek server/jaringan. $_trail');
  }

  static Future<void> disconnect() async {
    if (_activeProtocol == 'openvpn') {
      _openvpn?.disconnect();
    } else {
      await _ensureWgInitialized();
      await WireGuardFlutter.instance.stopVpn();
    }
    _activeProtocol = null;
  }

  static Future<bool> isConnected() async {
    // Ask the engine directly: after an app restart or a page reload the
    // tunnel may be up while this process has no memory of starting it.
    try {
      final openvpn = await _ensureOvpnInitialized();
      if (await openvpn.stage() == VPNStage.connected) {
        _activeProtocol = 'openvpn';
        return true;
      }
    } catch (_) {
      // fall through to the WireGuard check
    }
    if (_activeProtocol == 'openvpn') return false;
    await _ensureWgInitialized();
    return WireGuardFlutter.instance.isConnected();
  }
}
