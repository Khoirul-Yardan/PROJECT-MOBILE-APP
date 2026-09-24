import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ai_hub/main.dart';
import 'package:ai_hub/theme.dart';
import 'package:ai_hub/screens/bot_bpjs_screen.dart';

// Most of the app's UI now lives in the `web/` Docker container (see its
// README) and is rendered inside a WebView by WebShellScreen — that content
// isn't something a plain `flutter test` can exercise (no real WebView
// engine in the widget-test harness), so these tests focus on what's still
// genuinely native: the splash screen, the WebShellScreen's own chrome
// (bottom nav + bridge, minus network calls), and the fully-native Bot
// BPJS flow (microphone/wake-word/TTS stay off the web layer on purpose).
void main() {
  // flutter_secure_storage has no platform implementation in the plain
  // widget-test harness. Without a mock handler its method channel calls
  // never receive a reply (they neither resolve nor throw), so every screen
  // that reads/writes a saved key or VPN config would hang. Answering the
  // channel here keeps those calls fast and side-effect free for all tests.
  const secureStorageChannel = MethodChannel(
    'plugins.it_nomads.com/flutter_secure_storage',
  );
  TestWidgetsFlutterBinding.ensureInitialized();
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(secureStorageChannel, (call) async {
        switch (call.method) {
          case 'read':
            return null;
          case 'readAll':
            return <String, String>{};
          default:
            return null;
        }
      });

  testWidgets('Splash shows branding while its timer runs', (tester) async {
    // Doesn't advance past the splash timer: WebShellScreen constructs a
    // real WebViewController on navigation, which needs a platform
    // implementation the plain widget-test harness doesn't provide (no
    // WebViewPlatform.instance registered, unlike a real device/emulator
    // run). Bot BPJS below covers what's still genuinely native/testable.
    await tester.pumpWidget(const AiHubApp());
    expect(find.text('AI Hub'), findsOneWidget);
    expect(find.text('ONE HUB. INFINITE POSSIBILITIES.'), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 500));
    expect(tester.takeException(), isNull);
  });

  testWidgets('Bot BPJS preview runs the full session and review flow', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(theme: buildAppTheme(), home: const BotBpjsScreen()),
    );
    await tester.tap(find.text('Ucapkan "Halo Jarvis"'));
    await tester.pump(const Duration(milliseconds: 700));
    await tester.pump();
    expect(find.text('Hentikan Sesi'), findsOneWidget);
    await tester.tap(find.text('Hentikan Sesi'));
    // Avoid pumpAndSettle here: the processing spinner behind the sheet
    // animates indefinitely until a doctor is picked, so settle would hang.
    await tester.pump(const Duration(milliseconds: 900));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Kirim ke dokter siapa?'), findsOneWidget);
    await tester.tap(find.text('dr. Amma Haz'));
    await tester.pumpAndSettle();
    expect(find.text('Untuk: dr. Amma Haz'), findsOneWidget);
    expect(find.text('Draf AI — perlu verifikasi dokter'), findsOneWidget);
    await tester.tap(find.text('Tandai Sesuai'));
    await tester.pumpAndSettle();
    expect(
      find.textContaining('aplikasi ini tidak mencairkan dana'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });
}
