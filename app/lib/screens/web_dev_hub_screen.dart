import 'package:flutter/material.dart';

import '../theme.dart';
import '../widgets/hub_ui.dart';
import '../services/open_url_stub.dart' if (dart.library.js_interop) '../services/open_url_web.dart';
import '../services/web_hub_config.dart';
import 'anamnesis_terpandu_screen.dart';
import 'bot_bpjs_screen.dart';

/// What `flutter run -d chrome` shows instead of [WebShellScreen].
///
/// `webview_flutter` has no web implementation (a browser can't embed
/// itself in a WebView), so building WebShellScreen there throws "A platform
/// implementation for `webview_flutter` has not been set". On the web the
/// web layer is simply a normal page, so this screen links to it and gives
/// direct access to the Flutter-only screens (mic/TTS) for testing them in
/// Chrome. The installed Android/iOS app is unaffected.
class WebDevHubScreen extends StatelessWidget {
  const WebDevHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final hub = WebHubConfig.baseUrl;
    return Scaffold(
      appBar: AppBar(title: const Text('AI Hub — mode browser')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            HubCard(
              fill: AppColors.butter,
              child: const Text(
                'Mode browser (Chrome): WebView tidak didukung di web, jadi layar web '
                'dibuka sebagai halaman biasa dan layar Flutter dibuka langsung di sini.',
                style: TextStyle(fontSize: 13, height: 1.5),
              ),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: () => openUrlInNewTab(hub),
              icon: const Icon(Icons.open_in_new),
              label: Text('Buka web hub ($hub)'),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const AnamnesisTerpanduScreen()),
              ),
              icon: const Icon(Icons.record_voice_over_outlined),
              label: const Text('Anamnesis Terpandu (Flutter)'),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const BotBpjsScreen()),
              ),
              icon: const Icon(Icons.smart_toy_outlined),
              label: const Text('Bot BPJS (Flutter)'),
            ),
            const SizedBox(height: 16),
            const Text(
              'Pastikan container web berjalan (docker compose up) agar tombol pertama bisa dibuka. '
              'Izinkan mikrofon di Chrome saat diminta.',
              style: TextStyle(fontSize: 12, color: AppColors.textMuted),
            ),
          ],
        ),
      ),
    );
  }
}
