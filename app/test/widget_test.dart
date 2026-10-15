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
// BPJS flow (microphone recording stays off the web layer on purpose).
void main() {
  // flutter_secure_storage has no platform implementation in the plain
  // widget-test harness. Without a mock handler its method channel calls
  // never receive a reply (they neither resolve nor throw), so every screen
  // that reads/writes a saved key or VPN config would hang. Answering the
  // channel here keeps those calls fast and side-effect free for all tests.
  const secureStorageChannel = MethodChannel(
    'plugins.it_nomads.com/flutter_secure_storage',
  );
  // record's platform channel has no implementation in the plain
  // widget-test harness either — without a mock, `hasPermission()` awaits a
  // method call that never replies and the test hangs. Replying 'false'
  // exercises exactly what the screen does on a real device when the user
  // denies the microphone permission, which is the behavior the test below
  // actually verifies.
  const recordChannel = MethodChannel('com.llfbandit.record/messages');
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
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(recordChannel, (call) async {
        switch (call.method) {
          case 'hasPermission':
            return false;
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

  testWidgets('Bot BPJS preview shows a clear error when microphone permission has no platform support', (
    tester,
  ) async {
    // record's platform channel has no implementation in the plain
    // widget-test harness (no real device/emulator), so hasPermission()
    // resolves false — same as a real device where the user denied the
    // microphone permission. This test exercises that the screen surfaces
    // a clear reason instead of hanging or crashing. The full record →
    // AssemblyAI diarize → export flow needs a real platform (mic,
    // network, Supabase session) and is covered manually instead.
    await tester.pumpWidget(
      MaterialApp(theme: buildAppTheme(), home: const BotBpjsScreen()),
    );
    await tester.tap(find.byIcon(Icons.mic_none_rounded).first);
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    expect(find.text('Tekan untuk mulai merekam'), findsOneWidget);
    expect(
      find.textContaining('Izin mikrofon ditolak'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });
}
