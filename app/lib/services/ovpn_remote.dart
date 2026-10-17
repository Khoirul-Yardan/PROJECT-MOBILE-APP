/// One `remote` target found in a .ovpn file.
class OvpnRemote {
  const OvpnRemote(this.host, this.port, this.proto);
  final String host;
  final int port;

  /// 'tcp' or 'udp' (normalised; `tcp-client` etc. become 'tcp').
  final String proto;

  @override
  String toString() => '$host:$port/$proto';

  /// Reads `remote HOST [PORT] [PROTO]` lines plus the global `proto`
  /// directive (a per-remote proto wins). Defaults follow OpenVPN: port
  /// 1194, proto udp. Inline ca/cert/key blocks are skipped so key
  /// material is never touched.
  static List<OvpnRemote> parse(String ovpn) {
    var globalProto = 'udp';
    final raw = <List<String>>[];
    var inBlock = false;
    for (final line in ovpn.split(RegExp(r'\r?\n'))) {
      final t = line.trim();
      if (t.isEmpty || t.startsWith('#') || t.startsWith(';')) continue;
      if (t.startsWith('</')) {
        inBlock = false;
        continue;
      }
      if (t.startsWith('<')) {
        inBlock = true;
        continue;
      }
      if (inBlock) continue;
      final parts = t.split(RegExp(r'\s+'));
      if (parts.first == 'proto' && parts.length > 1) {
        globalProto = _norm(parts[1]);
      } else if (parts.first == 'remote' && parts.length > 1) {
        raw.add(parts);
      }
    }
    return [
      for (final p in raw)
        OvpnRemote(
          p[1],
          p.length > 2 ? int.tryParse(p[2]) ?? 1194 : 1194,
          p.length > 3 ? _norm(p[3]) : globalProto,
        ),
    ];
  }

  static String _norm(String p) => p.toLowerCase().startsWith('tcp') ? 'tcp' : 'udp';
}
