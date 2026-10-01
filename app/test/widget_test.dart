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
    expect(
      find.text('Satu aplikasi untuk AI, agen,\nkolaborasi, dan akses aman.'),
      findsOneWidget,
    );
    await tester.pump(const Duration(milliseconds: 500));
    expect(tester.takeException(), isNull);
  });

  testWidgets('Bot BPJS preview stops at the record step and warns when no doctor is connected', (
    tester,
  ) async {
    // SupabaseService.init() never runs in this plain widget-test harness,
    // so fetchAcceptedDoctors() takes its documented best-effort empty-list
    // path (same as "signed out" or "offline") — this test exercises that
    // real safety behavior: a nurse with no accepted doctor friendship
    // must be told why, not shown a fake placeholder name to pick from.
    // The full picker → review → verdict flow needs a signed-in Supabase
    // session with an accepted friendship and is covered by the Playwright
    // smoke test in web/tests instead, where that's actually reachable.
    await tester.pumpWidget(
      MaterialApp(theme: buildAppTheme(), home: const BotBpjsScreen()),
    );
    await tester.tap(find.text('Ucapkan "Halo Jarvis"'));
    await tester.pump(const Duration(milliseconds: 700));
    await tester.pump();
    expect(find.text('Hentikan Sesi'), findsOneWidget);
    await tester.tap(find.text('Hentikan Sesi'));
    // Avoid pumpAndSettle here: the processing spinner runs for a fixed
    // delay before the doctor lookup resolves, so settle would hang on it.
    await tester.pump(const Duration(milliseconds: 900));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Belum ada dokter terhubung'), findsOneWidget);
    await tester.tap(find.text('Mengerti'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Ucapkan "Halo Jarvis"'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
