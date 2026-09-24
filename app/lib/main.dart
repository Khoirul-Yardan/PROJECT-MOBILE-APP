import 'package:flutter/material.dart';

import 'theme.dart';
import 'screens/splash_screen.dart';
import 'screens/web_shell_screen.dart';
import 'services/supabase_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SupabaseService.init();
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
