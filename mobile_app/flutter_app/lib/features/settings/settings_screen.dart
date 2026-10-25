import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/labels.dart';
import '../../l10n/l10n.dart';
import '../../theme/gov_theme.dart';
import '../../widgets/gov_widgets.dart';
import '../../widgets/language_switcher.dart';
import 'about_screen.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final state = context.watch<AppState>();
    final user = state.user;
    final pending = state.counts.pending;
    return Scaffold(
      appBar: GovAppBar(title: l.settings),
      body: PageBody(children: [
        SectionCard(
          title: l.language,
          subtitle: l.languageHint,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const LanguageSwitcher(),
              const SizedBox(height: 6),
              TextButton(
                onPressed: state.locale == null ? null : () => state.setLocale(null),
                child: Text(l.usePhoneLanguage),
              ),
            ],
          ),
        ),
        if (user != null)
          SectionCard(
            title: l.account,
            child: Column(children: [
              KeyValueRow(l.name, user.fullName),
              KeyValueRow(l.username, user.username),
              KeyValueRow(l.role, roleLabel(l, user.role)),
              KeyValueRow(l.office, user.office),
            ]),
          ),
        SectionCard(
          title: l.connection,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KeyValueRow(l.serverAddress, state.server),
              KeyValueRow(l.thisDevice, state.deviceId),
              if (state.insecureConnection) ...[
                const SizedBox(height: 8),
                GovNotice(tone: Tone.warning, message: l.insecureConnectionWarning),
              ],
              const SizedBox(height: 6),
              Text(l.changeServerHint, style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        ),
        SectionCard(
          title: l.offlineData,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KeyValueRow(l.waitingToUpload, '$pending'),
              Text(l.offlineDataHint, style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 10),
              SecondaryButton(
                label: l.clearUploadedHistory,
                icon: Icons.cleaning_services_outlined,
                onPressed: () async {
                  final n = await state.clearUploadedHistory();
                  if (context.mounted) showMessage(context, l.historyCleared(n));
                },
              ),
            ],
          ),
        ),
        ListTile(
          tileColor: GovColors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8), side: const BorderSide(color: GovColors.line)),
          leading: const Icon(Icons.policy_outlined),
          title: Text(l.aboutAndPrivacy),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AboutScreen())),
        ),
        if (pending > 0) GovNotice(tone: Tone.warning, title: l.cannotSignOutTitle, message: l.cannotSignOutBody(pending)),
        SecondaryButton(
          label: l.signOut,
          icon: Icons.logout,
          danger: true,
          onPressed: pending > 0
              ? null
              : () async {
                  final ok = await confirmAction(context,
                      title: l.signOutTitle, message: l.signOutBody, confirmLabel: l.signOut, danger: true);
                  if (ok) await state.logout();
                },
        ),
      ]),
    );
  }
}
