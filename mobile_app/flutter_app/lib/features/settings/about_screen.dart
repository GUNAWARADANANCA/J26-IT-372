import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../l10n/l10n.dart';
import '../../theme/gov_theme.dart';
import '../../widgets/gov_widgets.dart';

/// About, privacy notice and accessibility statement - available before sign-in.
class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    Widget para(String text) => Text(text, style: t.bodyMedium);
    Widget bullet(String text) => Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('•  ', style: TextStyle(fontWeight: FontWeight.w700)),
            Expanded(child: para(text)),
          ]),
        );
    return Scaffold(
      appBar: GovAppBar(title: l.aboutAndPrivacy),
      body: PageBody(children: [
        GovNotice(tone: Tone.warning, title: l.prototypeTitle, message: l.prototypeBody),
        SectionCard(
          title: l.aboutTitle,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            para(l.aboutBody),
            const SizedBox(height: 8),
            Text(l.version(AppState.appVersion), style: t.bodySmall),
          ]),
        ),
        SectionCard(
          title: l.privacyTitle,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            para(l.privacyIntro),
            bullet(l.privacyLocation),
            bullet(l.privacyCamera),
            bullet(l.privacyStorage),
            bullet(l.privacyServer),
            bullet(l.privacyAudit),
          ]),
        ),
        SectionCard(
          title: l.accessibilityTitle,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            para(l.accessibilityBody),
            bullet(l.a11yLanguages),
            bullet(l.a11yText),
            bullet(l.a11yContrast),
            bullet(l.a11yTargets),
            bullet(l.a11yScreenReader),
          ]),
        ),
        SectionCard(
          title: l.standardsTitle,
          child: para(l.standardsBody),
        ),
      ]),
    );
  }
}
