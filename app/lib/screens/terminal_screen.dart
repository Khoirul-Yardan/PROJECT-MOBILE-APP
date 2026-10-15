import 'dart:async';
import 'dart:convert';

import 'package:dartssh2/dartssh2.dart';
import 'package:flutter/material.dart';
import 'package:xterm/xterm.dart';

import '../theme.dart';
import '../widgets/hub_ui.dart';
import '../services/ssh_connection_service.dart';

enum _Stage { form, connecting, connected, failed }

/// A plain SSH terminal to the server reachable behind the VPN tunnel
/// (see VpnTunnelService) — for when Termius isn't installed, or the nurse
/// just wants everything in one app. Deliberately a dumb terminal: whatever
/// is typed here runs for real on that server exactly like any other SSH
/// client, nothing is intercepted or auto-run on the user's behalf.
class TerminalScreen extends StatefulWidget {
  const TerminalScreen({super.key});
  @override
  State<TerminalScreen> createState() => _TerminalScreenState();
}

class _TerminalScreenState extends State<TerminalScreen> {
  _Stage _stage = _Stage.form;
  String? _errorMessage;

  final _hostCtrl = TextEditingController();
  final _portCtrl = TextEditingController(text: '22');
  final _userCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _privateKeyCtrl = TextEditingController();
  final _passphraseCtrl = TextEditingController();
  bool _useKey = false;

  SSHClient? _client;
  SSHSession? _session;
  late final Terminal _terminal = Terminal(maxLines: 10000);
  final _terminalController = TerminalController();

  @override
  void initState() {
    super.initState();
    _loadSaved();
  }

  Future<void> _loadSaved() async {
    final saved = await SshConnectionService.load();
    if (saved == null || !mounted) return;
    setState(() {
      _hostCtrl.text = saved['host'] as String? ?? '';
      _portCtrl.text = saved['port'] as String? ?? '22';
      _userCtrl.text = saved['username'] as String? ?? '';
      _passwordCtrl.text = saved['password'] as String? ?? '';
      _privateKeyCtrl.text = saved['privateKey'] as String? ?? '';
      _useKey = (saved['privateKey'] as String? ?? '').isNotEmpty;
    });
  }

  @override
  void dispose() {
    _session?.close();
    _client?.close();
    _hostCtrl.dispose();
    _portCtrl.dispose();
    _userCtrl.dispose();
    _passwordCtrl.dispose();
    _privateKeyCtrl.dispose();
    _passphraseCtrl.dispose();
    super.dispose();
  }

  Future<void> _connect() async {
    final host = _hostCtrl.text.trim();
    final port = int.tryParse(_portCtrl.text.trim()) ?? 22;
    final username = _userCtrl.text.trim();
    if (host.isEmpty || username.isEmpty) {
      setState(() => _errorMessage = 'Host dan username wajib diisi.');
      return;
    }

    setState(() {
      _stage = _Stage.connecting;
      _errorMessage = null;
    });

    await SshConnectionService.save({
      'host': host,
      'port': port.toString(),
      'username': username,
      'password': _useKey ? '' : _passwordCtrl.text,
      'privateKey': _useKey ? _privateKeyCtrl.text.trim() : '',
    });

    try {
      final socket = await SSHSocket.connect(host, port, timeout: const Duration(seconds: 15));
      final client = SSHClient(
        socket,
        username: username,
        identities: _useKey && _privateKeyCtrl.text.trim().isNotEmpty
            ? SSHKeyPair.fromPem(
                _privateKeyCtrl.text.trim(),
                _passphraseCtrl.text.isEmpty ? null : _passphraseCtrl.text,
              )
            : null,
        onPasswordRequest: _useKey ? null : () => _passwordCtrl.text,
      );
      final session = await client.shell(
        pty: const SSHPtyConfig(width: 80, height: 24, type: 'xterm-256color'),
      );
      _client = client;
      _session = session;

      session.stdout.listen((data) => _terminal.write(utf8.decode(data, allowMalformed: true)));
      session.stderr.listen((data) => _terminal.write(utf8.decode(data, allowMalformed: true)));
      _terminal.onOutput = (data) => session.write(utf8.encode(data));
      _terminal.onResize = (width, height, pixelWidth, pixelHeight) {
        session.resizeTerminal(width, height, pixelWidth, pixelHeight);
      };
      unawaited(session.done.then((_) {
        if (!mounted) return;
        setState(() {
          _stage = _Stage.failed;
          _errorMessage = 'Koneksi SSH ditutup oleh server.';
        });
      }));

      if (!mounted) return;
      setState(() => _stage = _Stage.connected);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _stage = _Stage.failed;
        _errorMessage = 'Gagal konek: $e';
      });
    }
  }

  void _disconnect() {
    _session?.close();
    _client?.close();
    _session = null;
    _client = null;
    setState(() => _stage = _Stage.form);
  }

  @override
  Widget build(BuildContext context) {
    if (_stage == _Stage.connected) return _terminalView();
    return Scaffold(
      appBar: AppBar(title: const Text('Terminal')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              HubCard(
                accentBar: AppColors.warn,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Icon(Icons.warning_amber_rounded, color: AppColors.warn),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Apa pun yang kamu jalankan di sini benar-benar dieksekusi di server tujuan — hati-hati, bukan simulasi.',
                        style: TextStyle(color: AppColors.inkMuted, fontSize: 13, height: 1.4),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              HubCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text('Koneksi SSH', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                    const SizedBox(height: 4),
                    const Text(
                      'Biasanya ini server yang sama yang kamu tuju lewat tunnel VPN.',
                      style: TextStyle(color: AppColors.inkMuted, fontSize: 13),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          flex: 3,
                          child: TextField(
                            controller: _hostCtrl,
                            decoration: const InputDecoration(labelText: 'Host', hintText: '10.8.0.1'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: _portCtrl,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(labelText: 'Port'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _userCtrl,
                      decoration: const InputDecoration(labelText: 'Username'),
                    ),
                    const SizedBox(height: 10),
                    SegmentedButton<bool>(
                      segments: const [
                        ButtonSegment(value: false, label: Text('Password')),
                        ButtonSegment(value: true, label: Text('Private key')),
                      ],
                      selected: {_useKey},
                      onSelectionChanged: (s) => setState(() => _useKey = s.first),
                    ),
                    const SizedBox(height: 10),
                    if (!_useKey)
                      TextField(
                        controller: _passwordCtrl,
                        obscureText: true,
                        decoration: const InputDecoration(labelText: 'Password'),
                      )
                    else ...[
                      TextField(
                        controller: _privateKeyCtrl,
                        maxLines: 4,
                        decoration: const InputDecoration(
                          labelText: 'Private key (OpenSSH/PEM)',
                          hintText: '-----BEGIN OPENSSH PRIVATE KEY-----',
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _passphraseCtrl,
                        obscureText: true,
                        decoration: const InputDecoration(labelText: 'Passphrase (opsional)'),
                      ),
                    ],
                    const SizedBox(height: 16),
                    if (_errorMessage != null) ...[
                      Text(_errorMessage!, style: const TextStyle(color: AppColors.danger, fontSize: 13)),
                      const SizedBox(height: 10),
                    ],
                    FilledButton(
                      onPressed: _stage == _Stage.connecting ? null : _connect,
                      child: _stage == _Stage.connecting
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.surface),
                            )
                          : const Text('Hubungkan'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _terminalView() => Scaffold(
    backgroundColor: Colors.black,
    appBar: AppBar(
      backgroundColor: Colors.black,
      foregroundColor: Colors.white,
      title: Text('${_userCtrl.text}@${_hostCtrl.text}'),
      actions: [
        IconButton(
          icon: const Icon(Icons.close),
          tooltip: 'Putuskan',
          onPressed: _disconnect,
        ),
      ],
    ),
    body: SafeArea(
      child: TerminalView(
        _terminal,
        controller: _terminalController,
        autofocus: true,
        backgroundOpacity: 1,
      ),
    ),
  );
}
