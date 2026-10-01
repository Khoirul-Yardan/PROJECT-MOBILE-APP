import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../theme.dart';
import '../services/supabase_service.dart';
import '../services/vpn_config_service.dart';
import '../services/vpn_tunnel_service.dart';
import '../services/web_hub_config.dart';
import 'bot_bpjs_screen.dart';

/// The entire native shell of the hybrid app — literally just a WebView and
/// a bridge. Every screen, **including navigation itself** (login, home,
/// chat, bot/agent hub, friends, settings, profile, VPN status), is HTML/JS
/// served by the `web/` Docker container. Flutter draws nothing of its own:
/// no app bar, no bottom nav, nothing — so the same web layer can be opened
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
                    'Tunnel nyata baru tersedia untuk WireGuard. OpenVPN/SSH masih tersimpan sebagai konfigurasi saja.',
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

      case 'vpn_disconnect':
        try {
          await VpnTunnelService.disconnect();
        } catch (_) {
          // Best-effort — still report disconnected so the UI doesn't get stuck.
        }
        if (id != null) await _reply(id, {'connected': false});
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
