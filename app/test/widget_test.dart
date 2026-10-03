import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ai_hub/main.dart';
import 'package:ai_hub/theme.dart';
import 'package:ai_hub/screens/bot_bpjs_screen.dart';
import 'package:ai_hub/services/bpjs_service.dart';

// Most of the app's UI now lives in the `web/` Docker container (see its
// README) and is rendered inside a WebView by WebShellScreen — that content
// isn't something a plain `flutter test` can exercise (no real WebView
// engine in the widget-test harness), so these tests focus on what's still
// genuinely native: the splash screen, the WebShellScreen's own chrome
// (bottom nav + bridge, minus network calls), and the fully-native Bot
// BPJS flow (microphone/wake-word/TTS stay off the web layer on purpose).
void main() {
  test(
    'Exports distinguish raw transcript from AI and unverified speakers',
    () {
      String export(String provider) => BpjsExport.plainText(
        dokterNama: 'Dokter Uji',
        pasienNama: 'Pasien Uji',
        createdAt: DateTime(2026, 10, 3),
        structured: {'ringkasan': 'Isi uji'},
        transcript: [
          {'speaker': 'perawat', 'text': 'Transkrip uji'},
        ],
        sessionReference: 'sesi-uji',
        providerLabel: provider,
      );
      expect(export(''), contains('Transkrip mentah - belum disusun AI'));
      expect(export(''), isNot(contains('Draf AI')));
      expect(
        export('Layanan Uji'),
        contains('Draf AI - perlu verifikasi dokter'),
      );
      expect(export('Layanan Uji'), contains('Penyusun: Layanan Uji'));
      expect(export(''), contains('Referensi: sesi-uji'));
      expect(
        export(''),
        contains('Pembicara belum diverifikasi: Transkrip uji'),
      );
      expect(export(''), isNot(contains('perawat: Transkrip uji')));
    },
  );

  testWidgets('Preparation validates identity and supports large text', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        home: const MediaQuery(
          data: MediaQueryData(
            size: Size(320, 640),
            textScaler: TextScaler.linear(2),
          ),
          child: BotBpjsScreen(),
        ),
      ),
    );
    await tester.ensureVisible(find.text('Mulai rekam'));
    await tester.tap(find.text('Mulai rekam'));
    await tester.pumpAndSettle();
    expect(find.text('Isi nama pasien'), findsOneWidget);
    expect(find.text('Isi nama dokter tujuan'), findsOneWidget);
    expect(find.text('Mikrofon aktif'), findsNothing);
    expect(tester.takeException(), isNull);
  });
  // flutter_secure_storage has no platform implementation in the plain
  // widget-test harness. Without a mock handler its method channel calls
  // never receive a reply (they neither resolve nor throw), so every screen
  // that reads/writes a saved key or VPN config would hang. Answering the
  // channel here keeps those calls fast and side-effect free for all tests.
  const secureStorageChannel = MethodChannel(
    'plugins.it_nomads.com/flutter_secure_storage',
  );
  // speech_to_text's platform channel has no implementation in the plain
  // widget-test harness either — without a mock, `initialize()` awaits a
  // method call that never replies and the test hangs. Replying 'false' to
  // `initialize` exercises exactly what the screen does on a real device
  // when the user denies the microphone permission, which is the behavior
  // the test below actually verifies.
  const speechChannel = MethodChannel('plugin.csdcorp.com/speech_to_text');
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
      .setMockMethodCallHandler(speechChannel, (call) async {
        switch (call.method) {
          case 'initialize':
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

  testWidgets(
    'Bot BPJS preview shows a clear error when speech recognition has no platform support',
    (tester) async {
      // speech_to_text has no platform channel implementation in the plain
      // widget-test harness (no real device/emulator), so
      // SpeechToText.initialize() resolves false — same as a real device
      // where the user denied the microphone permission. This test exercises
      // that the screen surfaces a clear reason instead of hanging or
      // crashing. The full record → transcribe → export flow needs a real
      // platform (mic + Supabase session) and is covered manually / by the
      // Playwright smoke test in web/tests instead.
      await tester.pumpWidget(
        MaterialApp(theme: buildAppTheme(), home: const BotBpjsScreen()),
      );
      expect(find.text('Nama pasien'), findsOneWidget);
      expect(find.text('Nama dokter tujuan'), findsOneWidget);
      await tester.enterText(find.byType(TextFormField).at(0), 'Pasien Uji');
      await tester.enterText(find.byType(TextFormField).at(1), 'Dokter Uji');
      await tester.ensureVisible(find.text('Mulai rekam'));
      await tester.tap(find.text('Mulai rekam'));
      await tester.pump(const Duration(milliseconds: 300));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('Mikrofon/STT error:', findRichText: true),
        findsNothing, // this path is the init-false branch, not onError
      );
      expect(find.text('Mulai rekam'), findsOneWidget);
      expect(find.text('Pasien Uji'), findsOneWidget);
      expect(find.text('Dokter Uji'), findsOneWidget);
      expect(find.textContaining('Izin mikrofon ditolak'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
