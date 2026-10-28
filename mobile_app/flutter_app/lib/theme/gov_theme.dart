// Visual system for PostAssist LK, following the principles of the Sri Lanka
// Digital Design System (SLDDS, Ministry of Digital Economy, 2026 draft):
// a blue/grey palette on a 50-900 scale with a separate status set,
// accessibility by default (WCAG 2.2 AA contrast, 48 dp touch targets, text +
// colour - never colour alone), plain language and Sinhala/Tamil/English.
// The navy scale is the same as the counter web app (frontend/src/index.css).
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class GovColors {
  // Primary (navy) scale
  static const navy950 = Color(0xFF011A34);
  static const navy900 = Color(0xFF02264A);
  static const navy800 = Color(0xFF033160);
  static const navy700 = Color(0xFF063C77);
  static const navy600 = Color(0xFF0B4C93);
  static const navy500 = Color(0xFF1D5FA8);
  static const navy300 = Color(0xFF9DB9DA);
  static const navy200 = Color(0xFFC6D6EA);
  static const navy100 = Color(0xFFE3ECF6);
  static const navy50 = Color(0xFFF1F5FA);

  // Neutral (grey) scale
  static const grey900 = Color(0xFF1B2430);
  static const grey700 = Color(0xFF3E4C59);
  static const grey600 = Color(0xFF52606D);
  static const grey500 = Color(0xFF6B7785);
  static const grey300 = Color(0xFFC3CBD5);
  static const line = Color(0xFFD8E0EA);
  static const grey100 = Color(0xFFF0F3F7);
  static const page = Color(0xFFF3F6FB);
  static const white = Color(0xFFFFFFFF);

  // Accent: active navigation marker and keyboard focus ring (as on the web app)
  static const accent = Color(0xFFF5B819);

  /// Header gradient (navy to a brighter blue) used on the sign-in and home heroes and app bars.
  static const heroGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [navy950, navy700, navy500],
    stops: [0.0, 0.6, 1.0],
  );

  /// Soft shadow under cards and tiles (replaces the grey outlines of the first version).
  static List<BoxShadow> get softShadow => [
        BoxShadow(color: navy900.withValues(alpha: 0.07), blurRadius: 18, offset: const Offset(0, 6)),
        BoxShadow(color: navy900.withValues(alpha: 0.04), blurRadius: 3, offset: const Offset(0, 1)),
      ];

  // Status set (text colours reach >= 4.5:1 on their tint and on white)
  static const success = Color(0xFF1B6E35);
  static const successTint = Color(0xFFE6F4EA);
  static const warning = Color(0xFF8A4B00);
  static const warningTint = Color(0xFFFFF4E0);
  static const error = Color(0xFFB42318);
  static const errorTint = Color(0xFFFDECEA);
  static const info = navy600;
  static const infoTint = navy50;
}

/// A colour pair for icons and badges: [fg] reaches >= 4.5:1 on [tint] and on white,
/// so text in it stays readable. Each task and each mail status has its own hue,
/// always together with an icon and a word (never colour alone).
class Hue {
  const Hue(this.fg, this.tint);

  final Color fg;
  final Color tint;

  static const blue = Hue(Color(0xFF1D5FA8), Color(0xFFE3EEFB));
  static const teal = Hue(Color(0xFF0F6B63), Color(0xFFDDF3F0));
  static const orange = Hue(Color(0xFFA84A06), Color(0xFFFFEEDB));
  static const purple = Hue(Color(0xFF6531C9), Color(0xFFEFE8FC));
  static const green = Hue(Color(0xFF1B6E35), Color(0xFFE2F3E7));
  static const rose = Hue(Color(0xFFB42318), Color(0xFFFDE7E5));
  static const slate = Hue(Color(0xFF3E4C59), Color(0xFFECEFF4));
  static const navy = Hue(GovColors.navy700, GovColors.navy100);
}

enum Tone { info, success, warning, error, neutral }

extension ToneColors on Tone {
  Color get fg => switch (this) {
        Tone.info => GovColors.info,
        Tone.success => GovColors.success,
        Tone.warning => GovColors.warning,
        Tone.error => GovColors.error,
        Tone.neutral => GovColors.grey700,
      };

  Color get tint => switch (this) {
        Tone.info => GovColors.infoTint,
        Tone.success => GovColors.successTint,
        Tone.warning => GovColors.warningTint,
        Tone.error => GovColors.errorTint,
        Tone.neutral => GovColors.grey100,
      };

  IconData get icon => switch (this) {
        Tone.info => Icons.info_outline,
        Tone.success => Icons.check_circle_outline,
        Tone.warning => Icons.warning_amber_rounded,
        Tone.error => Icons.error_outline,
        Tone.neutral => Icons.circle_outlined,
      };
}

class GovTheme {
  static const radius = 12.0;
  static const cardRadius = 18.0;
  static const buttonRadius = 14.0;

  /// Sinhala and Tamil need more line height than Latin text.
  static const _height = 1.45;

  static ThemeData light() {
    const scheme = ColorScheme(
      brightness: Brightness.light,
      primary: GovColors.navy700,
      onPrimary: GovColors.white,
      primaryContainer: GovColors.navy100,
      onPrimaryContainer: GovColors.navy900,
      secondary: GovColors.navy600,
      onSecondary: GovColors.white,
      secondaryContainer: GovColors.navy50,
      onSecondaryContainer: GovColors.navy900,
      tertiary: GovColors.accent,
      onTertiary: GovColors.grey900,
      error: GovColors.error,
      onError: GovColors.white,
      errorContainer: GovColors.errorTint,
      onErrorContainer: GovColors.error,
      surface: GovColors.white,
      onSurface: GovColors.grey900,
      onSurfaceVariant: GovColors.grey600,
      surfaceContainerLowest: GovColors.white,
      surfaceContainerLow: GovColors.page,
      surfaceContainer: GovColors.grey100,
      surfaceContainerHigh: GovColors.navy50,
      surfaceContainerHighest: GovColors.navy100,
      outline: GovColors.grey500,
      outlineVariant: GovColors.line,
      shadow: Colors.black,
      inverseSurface: GovColors.navy900,
      onInverseSurface: GovColors.white,
    );

    const text = TextTheme(
      headlineSmall: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, height: 1.3, color: GovColors.navy900),
      titleLarge: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, height: 1.35, color: GovColors.navy900),
      titleMedium: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, height: 1.35, color: GovColors.grey900),
      titleSmall: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, height: 1.35, color: GovColors.grey900),
      bodyLarge: TextStyle(fontSize: 16, height: _height, color: GovColors.grey900),
      bodyMedium: TextStyle(fontSize: 15, height: _height, color: GovColors.grey900),
      bodySmall: TextStyle(fontSize: 13.5, height: _height, color: GovColors.grey600),
      labelLarge: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, height: 1.3),
      labelMedium: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, height: 1.3, color: GovColors.grey900),
      labelSmall: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, height: 1.3, color: GovColors.grey700),
    );

    final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(buttonRadius));
    const minButton = Size(64, 54);

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      textTheme: text,
      scaffoldBackgroundColor: GovColors.page,
      fontFamilyFallback: const ['Noto Sans Sinhala', 'Noto Sans Tamil', 'Iskoola Pota', 'Latha', 'Nirmala UI'],
      materialTapTargetSize: MaterialTapTargetSize.padded,
      visualDensity: VisualDensity.standard,
      focusColor: GovColors.accent.withValues(alpha: 0.35),
      appBarTheme: const AppBarTheme(
        backgroundColor: GovColors.navy900,
        foregroundColor: GovColors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        systemOverlayStyle: SystemUiOverlayStyle.light,
        titleTextStyle: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: GovColors.white, height: 1.3),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: GovColors.navy700,
          foregroundColor: GovColors.white,
          disabledBackgroundColor: GovColors.grey300,
          disabledForegroundColor: GovColors.grey700,
          minimumSize: minButton,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          textStyle: text.labelLarge,
          shape: shape,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: GovColors.navy800,
          minimumSize: minButton,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          side: const BorderSide(color: GovColors.navy700, width: 1.5),
          textStyle: text.labelLarge,
          shape: shape,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: GovColors.navy600,
          minimumSize: const Size(48, 48),
          textStyle: text.labelMedium?.copyWith(decoration: TextDecoration.underline),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: GovColors.white,
        isDense: false,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        hintStyle: const TextStyle(color: GovColors.grey500),
        // grey500 keeps the field outline at >= 3:1 against white (WCAG 1.4.11).
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radius),
          borderSide: const BorderSide(color: GovColors.grey500, width: 1.2),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radius),
          borderSide: const BorderSide(color: GovColors.grey500, width: 1.2),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radius),
          borderSide: const BorderSide(color: GovColors.navy700, width: 2.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radius),
          borderSide: const BorderSide(color: GovColors.error, width: 2),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radius),
          borderSide: const BorderSide(color: GovColors.error, width: 2.5),
        ),
        disabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radius),
          borderSide: const BorderSide(color: GovColors.line, width: 1.5),
        ),
        errorStyle: const TextStyle(color: GovColors.error, fontWeight: FontWeight.w600, fontSize: 13.5),
        errorMaxLines: 3,
        helperMaxLines: 3,
      ),
      cardTheme: CardThemeData(
        color: GovColors.white,
        elevation: 2.5,
        shadowColor: GovColors.navy900.withValues(alpha: 0.22),
        surfaceTintColor: Colors.transparent,
        margin: EdgeInsets.zero,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(cardRadius)),
      ),
      dividerTheme: const DividerThemeData(color: GovColors.line, thickness: 1, space: 1),
      listTileTheme: const ListTileThemeData(
        minVerticalPadding: 10,
        iconColor: GovColors.navy700,
        titleTextStyle: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: GovColors.grey900, height: 1.35),
        subtitleTextStyle: TextStyle(fontSize: 13.5, color: GovColors.grey600, height: 1.4),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: GovColors.white,
        selectedColor: GovColors.navy100,
        side: const BorderSide(color: GovColors.grey500),
        labelStyle: text.labelMedium,
        shape: const StadiumBorder(),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: ButtonStyle(
          minimumSize: const WidgetStatePropertyAll(Size(48, 48)),
          side: const WidgetStatePropertyAll(BorderSide(color: GovColors.navy700)),
          backgroundColor: WidgetStateProperty.resolveWith(
              (s) => s.contains(WidgetState.selected) ? GovColors.navy700 : GovColors.white),
          foregroundColor: WidgetStateProperty.resolveWith(
              (s) => s.contains(WidgetState.selected) ? GovColors.white : GovColors.navy800),
          textStyle: WidgetStatePropertyAll(text.labelMedium),
          shape: const WidgetStatePropertyAll(StadiumBorder()),
        ),
      ),
      radioTheme: RadioThemeData(fillColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? GovColors.navy700 : GovColors.grey600)),
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith(
            (s) => s.contains(WidgetState.selected) ? GovColors.navy700 : GovColors.white),
        side: const BorderSide(color: GovColors.grey600, width: 2),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
            (s) => s.contains(WidgetState.selected) ? GovColors.white : GovColors.grey600),
        trackColor: WidgetStateProperty.resolveWith(
            (s) => s.contains(WidgetState.selected) ? GovColors.navy700 : GovColors.grey100),
      ),
      tabBarTheme: const TabBarThemeData(
        labelColor: GovColors.white,
        unselectedLabelColor: GovColors.navy200,
        indicatorColor: GovColors.accent,
        indicatorSize: TabBarIndicatorSize.tab,
        labelStyle: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
        unselectedLabelStyle: TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: GovColors.navy900,
        contentTextStyle: const TextStyle(color: GovColors.white, fontSize: 15, height: 1.4),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(radius)),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: GovColors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        titleTextStyle: text.titleLarge,
        contentTextStyle: text.bodyMedium,
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: GovColors.navy700),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: GovColors.white,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      ),
      pageTransitionsTheme: const PageTransitionsTheme(builders: {
        TargetPlatform.android: FadeForwardsPageTransitionsBuilder(),
      }),
    );
  }
}
