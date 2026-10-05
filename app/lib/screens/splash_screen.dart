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
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            // mainAxisSize.min + the outer Center is what actually centers
            // this block horizontally: a Column with the default max main
            // axis size still only sizes its CROSS axis (width here) to fit
            // its widest child, then sits at its parent's origin — without
            // Center wrapping it, that left-aligned-looking result is
            // exactly the "logo/text too far left" bug this replaced.
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(28),
                  decoration: BoxDecoration(
                    color: AppColors.mint,
                    borderRadius: BorderRadius.circular(28),
                    border: Border.all(color: AppColors.lineStrong, width: 1.5),
                    boxShadow: const [
                      BoxShadow(color: AppColors.lineStrong, offset: Offset(0, 4)),
                    ],
                  ),
                  child: const HubLogo(size: 108),
                ),
                const SizedBox(height: 20),
                const Text(
                  'AI Hub',
                  textAlign: TextAlign.center,
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
                const SizedBox(height: 48),
                Container(
                  width: 56,
                  height: 3,
                  decoration: const BoxDecoration(gradient: AppColors.gradient),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
