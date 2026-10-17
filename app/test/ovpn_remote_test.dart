import 'package:ai_hub/services/ovpn_remote.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('reads tcp remotes with port and global proto', () {
    const ovpn = '''
client
dev tun
proto tcp
remote vpn.example.test 1194
remote 203.0.113.9 443 udp
''';
    final r = OvpnRemote.parse(ovpn);
    expect(r.length, 2);
    expect(r[0].toString(), 'vpn.example.test:1194/tcp');
    expect(r[1].toString(), '203.0.113.9:443/udp');
  });

  test('defaults to udp/1194 and ignores comments and key blocks', () {
    const ovpn = '''
# remote ignored.example 1
remote only.example
<key>
remote inside.block 9
</key>
''';
    final r = OvpnRemote.parse(ovpn);
    expect(r.length, 1);
    expect(r.single.toString(), 'only.example:1194/udp');
  });

  test('tcp-client is normalised to tcp', () {
    final r = OvpnRemote.parse('proto tcp-client\nremote h 1194');
    expect(r.single.proto, 'tcp');
  });
}
