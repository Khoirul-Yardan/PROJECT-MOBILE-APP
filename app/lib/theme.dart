import 'package:flutter/material.dart';

class AppColors {
  static const primary = Color(0xFF6446D9);
  static const primaryDark = Color(0xFF5035B8);
  static const accentBlue = Color(0xFF2463C5);
  static const accentCyan = Color(0xFF147985);
  static const bg = Color(0xFFF6F7FB);
  static const card = Color(0xFFFAFBFC);
  static const textDark = Color(0xFF202B43);
  static const textMuted = Color(0xFF58657A);
  static const success = Color(0xFF22734C);
  static const danger = Color(0xFFB52F4D);
  static const warning = Color(0xFF8A570D);
  static const border = Color(0xFFDCE1EB);
  static const field = Color(0xFFEFF2F7);
  static const onPrimary = Color(0xFFFAFBFF);
  static const primarySoft = Color(0xFFEEE9FB);
  static const controlBorder = Color(0xFF8994A7);
  static const gradient = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [primary, Color(0xFF4C58C5)],
  );
  static const softGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFEFEBFA), Color(0xFFEDF2FB)],
  );
}

ThemeData buildAppTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      brightness: Brightness.light,
      seedColor: AppColors.primary,
      primary: AppColors.primary,
      onPrimary: AppColors.onPrimary,
      secondary: AppColors.accentBlue,
      onSecondary: AppColors.onPrimary,
      surface: AppColors.card,
      onSurface: AppColors.textDark,
      onSurfaceVariant: AppColors.textMuted,
      error: AppColors.danger,
      onError: AppColors.onPrimary,
      outline: AppColors.controlBorder,
      outlineVariant: AppColors.border,
    ),
    scaffoldBackgroundColor: AppColors.bg,
  );
  final border = OutlineInputBorder(
    borderRadius: BorderRadius.circular(12),
    borderSide: const BorderSide(color: AppColors.controlBorder),
  );
  return base.copyWith(
    textTheme: base.textTheme
        .apply(bodyColor: AppColors.textDark, displayColor: AppColors.textDark)
        .copyWith(
          headlineSmall: const TextStyle(
            fontSize: 26,
            height: 1.3,
            fontWeight: FontWeight.w700,
            color: AppColors.textDark,
          ),
          titleLarge: const TextStyle(
            fontSize: 22,
            height: 1.3,
            fontWeight: FontWeight.w700,
            color: AppColors.textDark,
          ),
          titleMedium: const TextStyle(
            fontSize: 16,
            height: 1.5,
            fontWeight: FontWeight.w600,
            color: AppColors.textDark,
          ),
          bodyLarge: const TextStyle(
            fontSize: 16,
            height: 1.6,
            color: AppColors.textDark,
          ),
          bodyMedium: const TextStyle(
            fontSize: 15,
            height: 1.6,
            color: AppColors.textDark,
          ),
          bodySmall: const TextStyle(
            fontSize: 14,
            height: 1.5,
            color: AppColors.textMuted,
          ),
          labelLarge: const TextStyle(
            fontSize: 15,
            height: 1.5,
            fontWeight: FontWeight.w600,
            color: AppColors.textDark,
          ),
          labelMedium: const TextStyle(
            fontSize: 14,
            height: 1.5,
            fontWeight: FontWeight.w600,
            color: AppColors.textMuted,
          ),
        ),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.bg,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      foregroundColor: AppColors.textDark,
      centerTitle: false,
      titleTextStyle: TextStyle(
        fontFamily: 'Roboto',
        fontSize: 24,
        height: 1.3,
        fontWeight: FontWeight.w700,
        color: AppColors.textDark,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.card,
      hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 16),
      labelStyle: const TextStyle(color: AppColors.textMuted, fontSize: 14),
      errorStyle: const TextStyle(color: AppColors.danger, fontSize: 14),
      prefixIconColor: AppColors.textMuted,
      suffixIconColor: AppColors.textMuted,
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
        borderSide: const BorderSide(color: AppColors.primary, width: 2),
      ),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? AppColors.card
            : AppColors.textMuted,
      ),
      trackColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? AppColors.primary
            : AppColors.field,
      ),
      trackOutlineColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? AppColors.primary
            : AppColors.controlBorder,
      ),
    ),
    cardTheme: CardThemeData(
      color: AppColors.card,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.border),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.onPrimary,
        minimumSize: const Size(48, 48),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        animationDuration: const Duration(milliseconds: 180),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.primaryDark,
        minimumSize: const Size(48, 48),
        side: const BorderSide(color: AppColors.controlBorder),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        animationDuration: const Duration(milliseconds: 180),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.primaryDark,
        minimumSize: const Size(44, 44),
        textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
      ),
    ),
    dividerTheme: const DividerThemeData(color: AppColors.border),
  );
}
