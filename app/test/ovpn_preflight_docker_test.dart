import 'dart:io';

import 'package:ai_hub/services/ovpn_remote.dart';
import 'package:flutter_test/flutter_test.dart';

// Needs the mock server from "TEST VPN/docker" (docker compose up, PUBLIC_HOST=127.0.0.1).
// Run: OVPN_FILE="../TEST VPN/docker/out/kp-la-test.ovpn" flutter test test/ovpn_preflight_docker_test.dart
void main() {
  final path = Platform.environment['OVPN_FILE'];
  final skip = path == null ? 'set OVPN_FILE to the mock profile' : null;

  test('mock OpenVPN server is reachable from the preflight probe', () async {
    final remotes = OvpnRemote.parse(File(path!).readAsStringSync());
    expect(remotes, isNotEmpty);
    expect(remotes.first.proto, 'tcp');
    expect(await remotes.first.probe(), isTrue);
  }, skip: skip);

  test('a closed port is reported unreachable', () async {
    expect(await const OvpnRemote('127.0.0.1', 1, 'tcp').probe(timeout: const Duration(seconds: 2)), isFalse);
    expect(await const OvpnRemote('127.0.0.1', 1, 'udp').probe(), isTrue); // udp: left to the engine
  });
}
