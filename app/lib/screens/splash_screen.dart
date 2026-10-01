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
    _timer = Timer(const Duration(milliseconds: 1200), () {
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
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            children: [
              const Spacer(flex: 3),
              const HubLogo(size: 108),
              const SizedBox(height: 20),
              const Text(
                'AI Hub',
                style: TextStyle(
                  fontSize: 40,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -1.2,
                  color: AppColors.ink,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Satu aplikasi untuk AI, agen,\nkolaborasi, dan akses aman.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  height: 1.6,
                  color: AppColors.inkMuted,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(flex: 4),
              Container(
                width: 56,
                height: 3,
                decoration: const BoxDecoration(gradient: AppColors.gradient),
              ),
              const SizedBox(height: 28),
            ],
          ),
        ),
      ),
    ),
  );
}
