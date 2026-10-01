import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'theme.dart';
import 'screens/splash_screen.dart';
import 'screens/web_shell_screen.dart';
import 'services/supabase_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Edge-to-edge: let the app draw behind Android's own status/navigation
  // bars instead of reserving separate black bands for them (the "double
  // nav bar, too tall" look). The WebView's CSS already reserves the right
  // amount of space via `env(safe-area-inset-bottom)` in style.css, so this
  // alone makes the on-screen system nav overlay transparently instead of
  // stacking below our own bottom nav.
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      systemNavigationBarColor: Colors.transparent,
      systemNavigationBarDividerColor: Colors.transparent,
      statusBarColor: Colors.transparent,
    ),
  );
  try {
    await SupabaseService.init();
  } catch (_) {
    // The web layer (WebView) owns the real session and works standalone;
    // this native mirror is only needed for Bot BPJS's activity_log writes,
    // so a failed/offline init here must not block the app from launching.
  }
  runApp(const AiHubApp());
}

class AiHubApp extends StatelessWidget {
  const AiHubApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AI Hub',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      initialRoute: '/',
      routes: {
        '/': (_) => const SplashScreen(),
        '/shell': (_) => const WebShellScreen(),
      },
    );
  }
}
