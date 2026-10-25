import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/app_state.dart';
import 'features/auth/login_screen.dart';
import 'features/home/home_screen.dart';
import 'l10n/l10n.dart';
import 'theme/gov_theme.dart';

class PostAssistApp extends StatelessWidget {
  const PostAssistApp({super.key, required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) => ChangeNotifierProvider.value(value: state, child: const _App());
}

class _App extends StatelessWidget {
  const _App();

  @override
  Widget build(BuildContext context) {
    final state = context.read<AppState>();
    final locale = context.select<AppState, Locale?>((s) => s.locale);
    final signedIn = context.select<AppState, bool>((s) => s.isSignedIn);
    return MaterialApp(
      navigatorKey: state.navigatorKey,
      debugShowCheckedModeBanner: false,
      onGenerateTitle: (c) => c.l10n.appName,
      theme: GovTheme.light(),
      locale: locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      // Respect the phone's text size setting, up to 200 %.
      builder: (context, child) => MediaQuery.withClampedTextScaling(maxScaleFactor: 2.0, child: child!),
      home: signedIn ? const HomeScreen() : const LoginScreen(),
    );
  }
}
