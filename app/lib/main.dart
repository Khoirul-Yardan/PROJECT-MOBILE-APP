import 'package:flutter/material.dart';

import 'theme.dart';
import 'screens/splash_screen.dart';
import 'screens/web_shell_screen.dart';
import 'services/supabase_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
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
