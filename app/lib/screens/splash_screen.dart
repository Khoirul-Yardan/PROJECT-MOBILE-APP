import 'dart:async';

import 'package:flutter/material.dart';

import '../theme.dart';
import '../widgets/hub_ui.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  late final Timer _timer;
  @override
  void initState() {
    super.initState();
    // Login/session state is decided inside the web layer (it owns the
    // Supabase session) — the native shell always opens the same way and
    // the SPA's own router shows Login or Home as appropriate.
    _timer = Timer(const Duration(milliseconds: 1400), () {
      if (mounted) Navigator.of(context).pushReplacementNamed('/shell');
    });
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: AuroraBackdrop(
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            children: [
              const Spacer(flex: 3),
              const HubLogo(size: 128),
              const SizedBox(height: 18),
              ShaderMask(
                shaderCallback: (bounds) => const LinearGradient(
                  colors: [
                    AppColors.accentBlue,
                    AppColors.primaryDark,
                    AppColors.primary,
                  ],
                ).createShader(bounds),
                child: const Text(
                  'AI Hub',
                  style: TextStyle(
                    fontSize: 46,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -1.6,
                    color: Colors.white,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'ONE HUB. INFINITE POSSIBILITIES.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 10,
                  letterSpacing: 1.8,
                  color: AppColors.textMuted,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(flex: 4),
              const Text(
                'A SMARTER TOMORROW\nSTARTS HERE',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 10,
                  height: 1.8,
                  letterSpacing: 2,
                  color: AppColors.textMuted,
                ),
              ),
              const SizedBox(height: 30),
              Container(
                width: 160,
                height: 4,
                decoration: BoxDecoration(
                  gradient: AppColors.gradient,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    ),
  );
}
