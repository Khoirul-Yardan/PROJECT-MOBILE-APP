import 'package:ai_hub/services/vpn_tunnel_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('profil cipher CBC mendapat data-ciphers yang memuat CBC itu', () {
    const ovpn = 'client\nremote 192.0.2.1 1194 tcp\ncipher AES-128-CBC\nauth SHA512';
    final out = VpnTunnelService.withLegacyCipherCompat(ovpn);
    expect(out, startsWith(ovpn));
    expect(
      out,
      contains('\ndata-ciphers AES-128-CBC:AES-256-GCM:AES-128-GCM'),
    );
  });

  test('tidak menambah dua kali dan tidak menyentuh cipher AEAD', () {
    const already = 'client\ncipher AES-128-CBC\ndata-ciphers AES-128-CBC';
    expect(VpnTunnelService.withLegacyCipherCompat(already), already);
    const gcm = 'client\ncipher AES-256-GCM';
    expect(VpnTunnelService.withLegacyCipherCompat(gcm), gcm);
    const none = 'client\nremote 192.0.2.1 1194';
    expect(VpnTunnelService.withLegacyCipherCompat(none), none);
  });
}
