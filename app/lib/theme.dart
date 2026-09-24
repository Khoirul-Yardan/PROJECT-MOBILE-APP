import 'package:flutter/material.dart';

class AppColors {
  static const primary = Color(0xFF7954FF);
  static const primaryDark = Color(0xFF4730CC);
  static const accentBlue = Color(0xFF087CFF);
  static const accentCyan = Color(0xFF20D7E5);
  static const bg = Color(0xFFF9FCFF);
  static const card = Colors.white;
  static const textDark = Color(0xFF101D3D);
  static const textMuted = Color(0xFF59729A);
  static const success = Color(0xFF09AD59);
  static const danger = Color(0xFFFF4268);
  static const warning = Color(0xFFFFA32B);
  static const border = Color(0xFFE6EEFC);
  static const field = Color(0xFFF1F6FF);
  static const gradient = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [accentCyan, Color(0xFF6588FF), Color(0xFFC15AFF)],
  );
  static const softGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFE4F9FF), Color(0xFFE9EEFF), Color(0xFFD8C8FF)],
  );
}

ThemeData buildAppTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.accentBlue,
      primary: AppColors.accentBlue,
      secondary: AppColors.primary,
      surface: AppColors.bg,
    ),
    scaffoldBackgroundColor: AppColors.bg,
  );
  final border = OutlineInputBorder(
    borderRadius: BorderRadius.circular(14),
    borderSide: const BorderSide(color: AppColors.border),
  );
  return base.copyWith(
    textTheme: base.textTheme.apply(
      bodyColor: AppColors.textDark,
      displayColor: AppColors.textDark,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.bg,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      foregroundColor: AppColors.textDark,
      centerTitle: false,
      titleTextStyle: TextStyle(
        fontFamily: 'Roboto',
        fontSize: 19,
        fontWeight: FontWeight.w700,
        color: AppColors.textDark,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.field,
      hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
      prefixIconColor: AppColors.textMuted,
      suffixIconColor: AppColors.textMuted,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: border,
      enabledBorder: border,
      focusedBorder: border.copyWith(
        borderSide: const BorderSide(color: AppColors.accentBlue, width: 1.5),
      ),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? Colors.white
            : AppColors.textMuted,
      ),
      trackColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? AppColors.primary
            : AppColors.border,
      ),
      trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
    ),
    cardTheme: CardThemeData(
      color: AppColors.card,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: const BorderSide(color: AppColors.border),
      ),
    ),
    dividerTheme: const DividerThemeData(color: AppColors.border),
  );
}
