import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/app_state.dart';
import '../l10n/l10n.dart';

/// සිංහල | தமிழ் | English - the three official languages, always visible on
/// the sign-in screen and in Settings. Each name is written in its own script.
class LanguageSwitcher extends StatelessWidget {
  const LanguageSwitcher({super.key});

  static const codes = ['si', 'ta', 'en'];
  static const names = {'si': 'සිංහල', 'ta': 'தமிழ்', 'en': 'English'};

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final current = state.locale?.languageCode ?? Localizations.localeOf(context).languageCode;
    return Semantics(
      label: context.l10n.language,
      container: true,
      child: SizedBox(
        width: double.infinity,
        child: SegmentedButton<String>(
          showSelectedIcon: false,
          segments: [
            for (final c in codes) ButtonSegment(value: c, label: Text(names[c]!, maxLines: 1)),
          ],
          selected: {codes.contains(current) ? current : 'en'},
          onSelectionChanged: (s) => state.setLocale(Locale(s.first)),
        ),
      ),
    );
  }
}
