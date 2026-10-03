import 'package:flutter/material.dart';

/// Neutral surfaces and a solid blue accent shared with the WebView.
class AppColors {
  static const bg = Color(0xFFF7F8FA);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceSunken = Color(0xFFF0F2F5);

  static const ink = Color(0xFF182230);
  static const inkMuted = Color(0xFF52606D);
  static const inkFaint = Color(0xFF52606D);

  static const accent = Color(0xFF2457C5);
  static const accentInk = Color(0xFF1D469E);
  static const accentTint = Color(0xFFEEF3FC);

  static const ok = Color(0xFF176B45);
  static const warn = Color(0xFF805300);
  static const danger = Color(0xFFB42318);
  static const info = Color(0xFF2457C5);

  static const line = Color(0xFFDCE1E7);
  static const lineStrong = Color(0xFF7C8998);

  // Aliases so screens/widgets referencing the previous palette names
  // keep resolving without a mass find/replace across lib/.
  static const primary = accent;
  static const primaryDark = accentInk;
  static const accentBlue = info;
  static const accentCyan = ok;
  static const textDark = ink;
  static const textMuted = inkMuted;
  static const border = line;
  static const controlBorder = lineStrong;
  static const field = surfaceSunken;
  static const card = surface;
  static const onPrimary = surface;
  static const success = ok;
  static const warning = warn;

  static const gradient = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [accent, accent],
  );
  static const softGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [surface, surface],
  );
}

ThemeData buildAppTheme() {
  final base = ThemeData(
    useMaterial3: true,

    colorScheme: ColorScheme.fromSeed(
      brightness: Brightness.light,
      seedColor: AppColors.accent,
      primary: AppColors.accent,
      onPrimary: AppColors.surface,
      secondary: AppColors.accent,
      onSecondary: AppColors.surface,
      surface: AppColors.surface,
      onSurface: AppColors.ink,
      onSurfaceVariant: AppColors.inkMuted,
      error: AppColors.danger,
      onError: AppColors.surface,
      outline: AppColors.lineStrong,
      outlineVariant: AppColors.line,
    ),
    scaffoldBackgroundColor: AppColors.bg,
  );
  final border = OutlineInputBorder(
    borderRadius: BorderRadius.circular(12),
    borderSide: const BorderSide(color: AppColors.lineStrong),
  );
  return base.copyWith(
    textTheme: base.textTheme
        .apply(bodyColor: AppColors.ink, displayColor: AppColors.ink)
        .copyWith(
          headlineSmall: const TextStyle(
            fontSize: 24,
            height: 1.3,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.3,
            color: AppColors.ink,
          ),
          titleLarge: const TextStyle(
            fontSize: 21,
            height: 1.3,
            fontWeight: FontWeight.w700,
            color: AppColors.ink,
          ),
          titleMedium: const TextStyle(
            fontSize: 16,
            height: 1.5,
            fontWeight: FontWeight.w600,
            color: AppColors.ink,
          ),
          bodyLarge: const TextStyle(
            fontSize: 16,
            height: 1.6,
            color: AppColors.ink,
          ),
          bodyMedium: const TextStyle(
            fontSize: 15,
            height: 1.6,
            color: AppColors.ink,
          ),
          bodySmall: const TextStyle(
            fontSize: 14,
            height: 1.5,
            color: AppColors.inkMuted,
          ),
          labelLarge: const TextStyle(
            fontSize: 15,
            height: 1.5,
            fontWeight: FontWeight.w700,
            color: AppColors.ink,
          ),
          labelMedium: TextStyle(
            fontSize: 13,
            height: 1.5,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.3,
            color: AppColors.inkMuted,
          ),
        ),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.bg,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      foregroundColor: AppColors.ink,
      centerTitle: false,
      titleTextStyle: TextStyle(
        fontSize: 22,
        height: 1.3,
        fontWeight: FontWeight.w700,
        color: AppColors.ink,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surface,
      hintStyle: const TextStyle(color: AppColors.inkFaint, fontSize: 16),
      labelStyle: const TextStyle(color: AppColors.inkMuted, fontSize: 14),
      errorStyle: const TextStyle(color: AppColors.danger, fontSize: 14),
      prefixIconColor: AppColors.inkMuted,
      suffixIconColor: AppColors.inkMuted,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: border,
      enabledBorder: border,
      errorBorder: border.copyWith(
        borderSide: const BorderSide(color: AppColors.danger),
      ),
      focusedErrorBorder: border.copyWith(
        borderSide: const BorderSide(color: AppColors.danger, width: 2),
      ),
      focusedBorder: border.copyWith(
        borderSide: const BorderSide(color: AppColors.accent, width: 2),
      ),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? AppColors.accent
            : AppColors.ink,
      ),
      trackColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? AppColors.accentTint
            : AppColors.surface,
      ),
      trackOutlineColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? AppColors.accent
            : AppColors.ink,
      ),
    ),
    cardTheme: CardThemeData(
      color: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.line),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.accent,
        foregroundColor: AppColors.surface,
        minimumSize: const Size(48, 48),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: AppColors.ink),
        ),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
        animationDuration: const Duration(milliseconds: 150),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.ink,
        minimumSize: const Size(48, 48),
        side: const BorderSide(color: AppColors.lineStrong),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
        animationDuration: const Duration(milliseconds: 150),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.accentInk,
        minimumSize: const Size(48, 48),
        textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
      ),
    ),
    dividerTheme: const DividerThemeData(color: AppColors.line),
  );
}
