import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../theme.dart';
import '../services/ai_provider_service.dart';
import '../services/supabase_service.dart';
import '../services/vpn_config_service.dart';
import '../services/web_hub_config.dart';
import 'bot_bpjs_screen.dart';

/// The entire native shell of the hybrid app. Every screen (login, home,
/// chat, bot/agent hub, friends, settings, profile, VPN status) is HTML/JS
/// served by the `web/` Docker container and rendered here in a single
/// persistent WebView — the bottom nav below is the only "real" UI chrome
/// Flutter draws.
///
/// Deliberately kept native instead (per NFR-01/NFR-12 and the product
/// decision behind this screen): API keys, VPN credentials, the VPN
/// connection itself, and Bot BPJS's microphone/wake-word/TTS. Those are
/// exactly the things a WebView cannot do reliably or safely, so they never
/// cross into the web layer except as a request/response over the bridge
/// below — a secret is read from Keystore/Keychain, handed to the page for
/// one HTTPS call, and never stored in the page itself.
class WebShellScreen extends StatefulWidget {
  const WebShellScreen({super.key});
  @override
  State<WebShellScreen> createState() => _WebShellScreenState();
}

enum _LoadState { loading, ready, failed }

class _WebShellScreenState extends State<WebShellScreen> {
  late final WebViewController _controller;
  _LoadState _state = _LoadState.loading;
  // Empty until the web SPA's router reports in (see 'route_changed' below)
  // — treated the same as '/login' so the native bottom nav never flashes
  // on top of the login screen before we know better.
  String _activePath = '';

  static const _navItems = [
    (Icons.home_outlined, Icons.home_rounded, 'Home', '/home'),
    (Icons.chat_bubble_outline_rounded, Icons.chat_bubble_rounded, 'Chat', '/chat'),
    (Icons.smart_toy_outlined, Icons.smart_toy, 'Bot', '/bots'),
    (Icons.shield_outlined, Icons.shield, 'VPN', '/vpn'),
    (Icons.menu_rounded, Icons.menu_rounded, 'More', '/settings'),
  ];

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(AppColors.bg)
      ..addJavaScriptChannel('NativeBridge', onMessageReceived: _onBridgeMessage)
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
      case 'route_changed':
        final path = (payload['path'] as String?) ?? '/home';
        if (mounted) setState(() => _activePath = path);
        return;

      case 'session_changed':
        final refreshToken = payload['refresh_token'] as String?;
        if (refreshToken != null) {
          await SupabaseService.restoreSession(refreshToken);
        }
        return;

      case 'get_api_key':
        final provider = AiProviderX.fromId(payload['provider'] as String? ?? '');
        final key = provider == null ? null : await AiProviderService.getApiKey(provider);
        if (id != null) await _reply(id, {'key': key});
        return;

      case 'has_api_key':
        final provider = AiProviderX.fromId(payload['provider'] as String? ?? '');
        final has = provider != null && await AiProviderService.hasApiKey(provider);
        if (id != null) await _reply(id, {'has': has});
        return;

      case 'save_api_key':
        final provider = AiProviderX.fromId(payload['provider'] as String? ?? '');
        if (provider != null) {
          await AiProviderService.saveApiKey(provider, payload['key'] as String? ?? '');
        }
        if (id != null) await _reply(id, {});
        return;

      case 'get_vpn_config':
        final config = await VpnConfigService.load();
        if (id != null) {
          await _reply(id, config?.toJson());
        }
        return;

      case 'save_vpn_config':
        await VpnConfigService.save(
          VpnConfig(
            protocol: payload['protocol'] as String? ?? 'OpenVPN',
            host: payload['host'] as String? ?? '',
            port: payload['port'] as String? ?? '',
            username: payload['username'] as String? ?? '',
            password: payload['password'] as String? ?? '',
          ),
        );
        if (id != null) await _reply(id, {});
        return;

      case 'vpn_connect':
        if (id != null) await _reply(id, {'connected': true});
        return;

      case 'vpn_disconnect':
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

  void _goTo(String path) {
    _controller.runJavaScript("location.hash = '#$path';");
    setState(() => _activePath = path);
  }

  void _retry() {
    setState(() => _state = _LoadState.loading);
    _controller.reload();
  }

  int get _selectedIndex {
    for (var i = 0; i < _navItems.length; i++) {
      if (_activePath == _navItems[i].$4) return i;
    }
    // Sub-routes (e.g. /settings/profile, /vpn-config, /friends) still
    // highlight their closest top-level tab.
    if (_activePath.startsWith('/settings') || _activePath == '/friends') return 4;
    if (_activePath.startsWith('/vpn')) return 3;
    return 0;
  }

  bool get _showBottomNav => _activePath.isNotEmpty && _activePath != '/login';

  @override
  Widget build(BuildContext context) => Scaffold(
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
    bottomNavigationBar: _showBottomNav ? _bottomNav() : null,
  );

  Widget _bottomNav() => DecoratedBox(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 66,
          child: Row(
            children: List.generate(_navItems.length, (i) {
              final selected = i == _selectedIndex;
              final item = _navItems[i];
              return Expanded(
                child: Semantics(
                  selected: selected,
                  button: true,
                  child: InkWell(
                    onTap: () => _goTo(item.$4),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          selected ? item.$2 : item.$1,
                          color: selected ? AppColors.accentBlue : AppColors.textMuted,
                          size: 23,
                        ),
                        const SizedBox(height: 5),
                        Text(
                          item.$3,
                          style: TextStyle(
                            fontSize: 10,
                            color: selected ? AppColors.accentBlue : AppColors.textMuted,
                            fontWeight: selected ? FontWeight.w700 : FontWeight.w400,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }),
          ),
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
        const Icon(Icons.cloud_off_rounded, size: 40, color: AppColors.textMuted),
        const SizedBox(height: 12),
        const Text('Tidak bisa memuat AI Hub', style: TextStyle(fontWeight: FontWeight.w700)),
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
