import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'theme.dart';
import 'screens/splash_screen.dart';
import 'screens/web_shell_screen.dart';
import 'services/supabase_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Immersive sticky: actually hide Android's on-screen nav bar (not just
  // draw transparently behind it, which still leaves it visible) — a swipe
  // from the screen edge reveals it briefly, then it auto-hides again,
  // which is the standard immersive-video/game behavior. The WebView's own
  // CSS already reserves bottom space via `env(safe-area-inset-bottom)` in
  // style.css for when the bar is swiped back in.
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
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

class AiHubApp extends StatefulWidget {
  const AiHubApp({super.key});

  @override
  State<AiHubApp> createState() => _AiHubAppState();
}

// Android resets to showing the system nav bar on its own after things like
// resuming from background or the keyboard closing — a single startup call
// to immersiveSticky doesn't stick through those, so it has to be
// reapplied every time the app resumes.
class _AiHubAppState extends State<AiHubApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    }
  }

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
