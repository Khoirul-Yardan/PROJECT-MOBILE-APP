import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:http/http.dart' as http;
import 'package:webview_flutter/webview_flutter.dart';

import '../theme.dart';
import '../services/supabase_service.dart';
import '../services/vpn_config_service.dart';
import '../services/vpn_tunnel_service.dart';
import '../services/web_hub_config.dart';
import '../services/bpjs_service.dart';
import 'anamnesis_terpandu_screen.dart';
import 'bot_bpjs_screen.dart';
import 'terminal_screen.dart';

/// The entire native shell of the hybrid app — literally just a WebView and
/// a bridge. Every screen, **including navigation itself** (login, home,
/// chat, bot/agent hub, settings, profile, VPN status), is HTML/JS served
/// by the `web/` Docker container. Flutter draws nothing of its own: no app
/// bar, no bottom nav, nothing — so the same web layer can be opened
/// straight in a desktop browser (`http://localhost:8090`) for fast
/// iteration without touching a device at all, and this shell only matters
/// once a feature genuinely needs to be native.
///
/// Deliberately kept native instead (per NFR-12 and the product decision
/// behind this screen): VPN credentials, the VPN connection itself, and Bot
/// BPJS's microphone/wake-word/TTS — things a WebView cannot do reliably or
/// safely. AI provider/agent API keys used to live here too, but now sync
/// through the user's Supabase account instead (encrypted — see
/// `web/public/credentials.js`), so a key survives a reinstall or works
/// from another device instead of only living on the one that saved it.
class WebShellScreen extends StatefulWidget {
  const WebShellScreen({super.key});
  @override
  State<WebShellScreen> createState() => _WebShellScreenState();
}

enum _LoadState { loading, ready, failed }

class _WebShellScreenState extends State<WebShellScreen> {
  late final WebViewController _controller;
  _LoadState _state = _LoadState.loading;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(AppColors.bg)
      ..addJavaScriptChannel(
        'NativeBridge',
        onMessageReceived: _onBridgeMessage,
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) {
            if (mounted) setState(() => _state = _LoadState.ready);
          },
          onWebResourceError: (_) {
            if (mounted) setState(() => _state = _LoadState.failed);
          },
        ),
      )
      ..loadRequest(Uri.parse(WebHubConfig.baseUrl));
  }

  FlutterTts? _tts;

  Future<void> _reply(String id, Object? result) async {
    final json = jsonEncode(result ?? {});
    await _controller.runJavaScript(
      "window.__nativeReply && window.__nativeReply('$id', ${jsonEncode(json)});",
    );
  }

  void _onBridgeMessage(JavaScriptMessage message) async {
    Map<String, dynamic> data;
    try {
      data = jsonDecode(message.message) as Map<String, dynamic>;
    } catch (_) {
      return;
    }
    final id = data['id'] as String?;
    final type = data['type'] as String?;
    final payload = (data['payload'] as Map?)?.cast<String, dynamic>() ?? {};

    switch (type) {
      case 'session_changed':
        final refreshToken = payload['refresh_token'] as String?;
        if (refreshToken != null) {
          await SupabaseService.restoreSession(refreshToken);
        }
        return;

      case 'get_vpn_config':
        final config = await VpnConfigService.load();
        if (id != null) {
          await _reply(id, config);
        }
        return;

      case 'save_vpn_config':
        await VpnConfigService.save(payload);
        if (id != null) await _reply(id, {});
        return;

      case 'vpn_connect':
        try {
          final config = await VpnConfigService.load();
          final protocol = config?['protocol'] as String?;
          if (config == null || !VpnTunnelService.supports(protocol ?? '')) {
            if (id != null) {
              await _reply(id, {
                'connected': false,
                'message':
                    'Tunnel nyata baru tersedia untuk WireGuard/OpenVPN. SSH masih tersimpan sebagai konfigurasi saja — pakai Terminal untuk akses SSH langsung.',
              });
            }
            return;
          }
          await VpnTunnelService.connect(config);
          if (id != null) await _reply(id, {'connected': true});
        } catch (e) {
          if (id != null) await _reply(id, {'connected': false, 'message': e.toString()});
        }
        return;

      case 'vpn_state':
        // Real tunnel state, so the web page doesn't have to assume
        // "disconnected" every time it (re)loads.
        var connectedNow = false;
        try {
          connectedNow = await VpnTunnelService.isConnected();
        } catch (_) {}
        if (id != null) await _reply(id, {'connected': connectedNow});
        return;

      case 'vpn_disconnect':
        try {
          await VpnTunnelService.disconnect();
        } catch (_) {
          // Best-effort — still report disconnected so the UI doesn't get stuck.
        }
        if (id != null) await _reply(id, {'connected': false});
        return;

      case 'http_relay':
        try {
          final url = Uri.parse(payload['url'] as String);
          final method = (payload['method'] as String?)?.toUpperCase() ?? 'POST';
          final rawHeaders = (payload['headers'] as Map?) ?? {};
          final headers = rawHeaders.map((k, v) => MapEntry(k.toString(), v.toString()));
          final body = payload['body'] as String?;
          final http.Response resp = method == 'GET'
              ? await http.get(url, headers: headers)
              : await http.post(url, headers: headers, body: body);
          if (id != null) {
            await _reply(id, {'status': resp.statusCode, 'body': resp.body});
          }
        } catch (e) {
          // 'message' on purpose, not 'error' — bridge.js's __nativeReply
          // treats a result.error as a hard rejection (resolves to null,
          // losing the detail); ai.js needs the actual failure reason to
          // show the user, same pattern as vpn_connect's failure reply.
          if (id != null) {
            await _reply(id, {'status': 0, 'body': '', 'message': e.toString()});
          }
        }
        return;

      case 'export_bpjs':
        // Lets the web Riwayat page (bpjs-review.js) produce the same
        // PDF/DOCX file the native Bot BPJS screen already builds right
        // after recording — one export implementation (BpjsExport),
        // reused from both call sites instead of a second one in JS.
        try {
          final format = payload['format'] as String? ?? 'pdf';
          final dokterNama = payload['dokterNama'] as String? ?? 'Dokter';
          final dokterInstansi = payload['dokterInstansi'] as String?;
          final pasienNama = payload['pasienNama'] as String? ?? 'Pasien';
          final createdAt = DateTime.tryParse(payload['createdAt'] as String? ?? '') ?? DateTime.now();
          final structured = Map<String, dynamic>.from(payload['structured'] as Map? ?? {});
          final transcript = ((payload['transcript'] as List?) ?? [])
              .map((e) => Map<String, dynamic>.from(e as Map))
              .map((e) => {'speaker': '${e['speaker']}', 'text': '${e['text']}'})
              .toList();
          final comparison = payload['comparison'] is Map
              ? Map<String, dynamic>.from(payload['comparison'] as Map)
              : null;
          final bytes = format == 'docx'
              ? await BpjsExport.buildDocx(
                  dokterNama: dokterNama,
                  dokterInstansi: dokterInstansi,
                  pasienNama: pasienNama,
                  createdAt: createdAt,
                  structured: structured,
                  transcript: transcript,
                  comparison: comparison,
                )
              : await BpjsExport.buildPdf(
                  dokterNama: dokterNama,
                  dokterInstansi: dokterInstansi,
                  pasienNama: pasienNama,
                  createdAt: createdAt,
                  structured: structured,
                  transcript: transcript,
                  comparison: comparison,
                );
          final safeName = pasienNama.replaceAll(RegExp(r'[^a-zA-Z0-9]+'), '_');
          await BpjsExport.shareFile(
            bytes: bytes,
            filename: 'dokumentasi_bpjs_$safeName.$format',
            mimeSubject: 'Dokumentasi BPJS — $pasienNama',
          );
          if (id != null) await _reply(id, {'ok': true});
        } catch (e) {
          if (id != null) await _reply(id, {'ok': false, 'message': e.toString()});
        }
        return;

      case 'save_image':
        // Chat's lightbox "Download" button — a WebView has no built-in
        // "Save As" for a data: URI or a cross-origin image (unlike a
        // desktop browser), so this hands the bytes to the OS share sheet
        // instead, same mechanism BpjsExport.shareFile already uses for
        // PDFs/DOCX — "Save to Downloads"/Photos/Drive are just other
        // targets in that same sheet.
        try {
          final filename = payload['filename'] as String? ?? 'image.png';
          final dataUrl = payload['dataUrl'] as String?;
          Uint8List bytes;
          if (dataUrl != null && dataUrl.startsWith('data:')) {
            final base64Part = dataUrl.substring(dataUrl.indexOf(',') + 1);
            bytes = base64Decode(base64Part);
          } else {
            final url = payload['url'] as String?;
            if (url == null) throw Exception('Tidak ada data gambar.');
            final resp = await http.get(Uri.parse(url));
            if (resp.statusCode != 200) throw Exception('Gagal mengambil gambar (${resp.statusCode}).');
            bytes = resp.bodyBytes;
          }
          await BpjsExport.shareFile(bytes: bytes, filename: filename, mimeSubject: 'Gambar dari chat');
          if (id != null) await _reply(id, {'ok': true});
        } catch (e) {
          if (id != null) await _reply(id, {'ok': false, 'message': e.toString()});
        }
        return;

      case 'pick_text_file':
        // <input type="file"> does nothing in webview_flutter on Android, so file
        // import (e.g. .ovpn in the VPN screen) goes through MainActivity's
        // native picker (see its aihub/file_picker channel) and hands the
        // text back.
        try {
          const channel = MethodChannel('aihub/file_picker');
          final r = await channel.invokeMapMethod<String, dynamic>('pickTextFile');
          if (id != null) await _reply(id, Map<String, dynamic>.from(r ?? {'ok': false, 'cancelled': true}));
        } catch (e) {
          if (id != null) await _reply(id, {'ok': false, 'message': e.toString()});
        }
        return;

      case 'speak':
        // WebView speechSynthesis is silent on many Android devices (no
        // voice bound to the WebView), so the web page asks the native TTS
        // engine instead — same engine the guided anamnesis already uses.
        // Rate 0.95 (near-normal pace): Papan Komunikasi needs a quick,
        // punchy "Saya nyeri" the instant a button is tapped, not a slow
        // drawn-out read — 0.45 made every word sound stretched/robotic.
        try {
          final tts = _tts ??= FlutterTts();
          await tts.setLanguage('id-ID');
          await tts.setSpeechRate(0.95);
          await tts.stop();
          await tts.speak((payload['text'] as String?) ?? '');
          if (id != null) await _reply(id, {'ok': true});
        } catch (e) {
          if (id != null) await _reply(id, {'ok': false, 'message': e.toString()});
        }
        return;

      case 'open_bot_bpjs':
        if (id != null) await _reply(id, {});
        if (mounted) {
          await Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const BotBpjsScreen()),
          );
        }
        return;

      case 'open_anamnesis_terpandu':
        if (id != null) await _reply(id, {});
        if (mounted) {
          await Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const AnamnesisTerpanduScreen()),
          );
        }
        return;

      case 'open_terminal':
        if (id != null) await _reply(id, {});
        if (mounted) {
          await Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const TerminalScreen()),
          );
        }
        return;

      case 'sign_out':
        await SupabaseService.signOut();
        if (id != null) await _reply(id, {});
        return;
    }
  }

  void _retry() {
    setState(() => _state = _LoadState.loading);
    _controller.reload();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    // Top only: the status bar still needs Flutter to reserve space for it,
    // but the bottom edge is intentionally left un-padded here — the page
    // is edge-to-edge (see main.dart) and its own CSS (`env(safe-area-
    // inset-bottom)` in style.css, already used by .web-nav) reserves
    // exactly the system gesture/button nav's real height. Padding for it
    // a second time at the Flutter level would double that space and make
    // the bottom nav look unnecessarily tall.
    body: SafeArea(
      bottom: false,
      child: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_state == _LoadState.loading)
            const Center(child: CircularProgressIndicator()),
          if (_state == _LoadState.failed) _offlineFallback(),
        ],
      ),
    ),
  );

  Widget _offlineFallback() => Container(
    color: AppColors.bg,
    alignment: Alignment.center,
    padding: const EdgeInsets.all(24),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(
          Icons.cloud_off_rounded,
          size: 40,
          color: AppColors.textMuted,
        ),
        const SizedBox(height: 12),
        const Text(
          'Tidak bisa memuat AI Hub',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 6),
        Text(
          'Pastikan kontainer web (web/) berjalan di ${WebHubConfig.baseUrl}.',
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
        ),
        const SizedBox(height: 16),
        FilledButton(onPressed: _retry, child: const Text('Coba lagi')),
      ],
    ),
  );
}
