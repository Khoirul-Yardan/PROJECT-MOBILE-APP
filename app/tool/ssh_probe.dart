// Uji koneksi terminal memakai library SAMA dengan TerminalScreen (dartssh2),
// terhadap server SSH di Docker (TEST VPN/wireguard, port 2222).
// Jalankan:  dart run tool/ssh_probe.dart [host] [port] [user] [pass]
import 'dart:convert';
import 'dart:io';

import 'package:dartssh2/dartssh2.dart';

Future<void> main(List<String> args) async {
  final host = args.isNotEmpty ? args[0] : '127.0.0.1';
  final port = args.length > 1 ? int.parse(args[1]) : 2222;
  final user = args.length > 2 ? args[2] : 'tester';
  final pass = args.length > 3 ? args[3] : 'tester123';

  Future<void> attempt(String label, String password) async {
    stdout.write('[$label] ');
    try {
      final socket = await SSHSocket.connect(host, port, timeout: const Duration(seconds: 8));
      final client = SSHClient(socket, username: user, onPasswordRequest: () => password);
      await client.authenticated;
      final session = await client.shell(pty: const SSHPtyConfig(width: 80, height: 24));
      session.stdin.add(utf8.encode('echo HALO_DARI_TERMINAL; whoami; pwd; exit\n'));
      final out = await session.stdout.cast<List<int>>().transform(utf8.decoder).join();
      print('login OK');
      print(out.trim().split('\n').map((l) => '    $l').join('\n'));
      client.close();
    } catch (e) {
      print('ditolak/gagal -> ${e.runtimeType}');
    }
  }

  await attempt('password benar', pass);
  await attempt('password salah', 'salah-total');
  exit(0);
}
