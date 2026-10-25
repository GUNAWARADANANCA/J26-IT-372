// Step 3: destination office and sender updates, then the officer confirms
// that the fields match the envelope (required before weighing and charging).
import 'package:flutter/material.dart';

import '../../../core/api_client.dart';
import '../../../core/labels.dart';
import '../../../l10n/l10n.dart';
import '../../../theme/gov_theme.dart';
import '../../../widgets/gov_widgets.dart';
import '../intake_controller.dart';
import '../intake_progress.dart';

class ConfirmStep extends StatefulWidget {
  const ConfirmStep({super.key, required this.c});

  final IntakeController c;

  @override
  State<ConfirmStep> createState() => _ConfirmStepState();
}

class _ConfirmStepState extends State<ConfirmStep> {
  IntakeController get c => widget.c;
  bool _busy = false;
  List<String> _errors = [];
  final _scroll = ScrollController();

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    if (c.destinationOfficeId == null) c.suggestOffice();
  }

  /// Same rules as the server (routers/intake.py required_problems), shown before sending.
  List<String> _check(AppLocalizations l) {
    final errors = <String>[];
    for (final (party, name) in [('recipient', l.recipient), ('sender', l.sender)]) {
      final p = c.party(party);
      if (p.value('name').isEmpty) errors.add(l.errPartyName(name));
      if (p.value('city').isEmpty) errors.add(l.errPartyCity(name));
      if (p.value('house_number').isEmpty && p.value('street').isEmpty && p.value('locality').isEmpty) {
        errors.add(l.errPartyAddress(name));
      }
    }
    if (c.destinationOfficeId == null) errors.add(l.errDestinationRequired);
    final contact = c.contact.text.trim();
    if (c.channel == 'email' && !validEmail(contact)) errors.add(l.errEmailInvalid);
    if (c.channel == 'sms' && !validSriLankaMobile(contact)) errors.add(l.errPhoneInvalid);
    return errors;
  }

  Future<void> _confirm() async {
    final l = context.l10n;
    final errors = _check(l);
    setState(() => _errors = errors);
    if (errors.isNotEmpty) return scrollToTop(_scroll);
    setState(() => _busy = true);
    try {
      await c.confirmDetails();
    } on ApiException catch (e) {
      if (mounted) setState(() => _errors = e.problems.isEmpty ? [describeError(context, e)] : e.problems);
      scrollToTop(_scroll);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final stats = c.draft?['review_stats'] as Map?;
    final officeIds = {for (final o in c.offices) o['_id'] as String};

    return PageBody(controller: _scroll, children: [
      GovNotice(tone: Tone.info, title: l.stepConfirmTitle, message: l.nextConfirm),
      ProblemSummary(errors: _errors),
      SectionCard(
        title: l.destinationOffice,
        subtitle: l.destinationOfficeHint,
        child: GovDropdown<String>(
          label: l.deliveryOffice,
          value: officeIds.contains(c.destinationOfficeId) ? c.destinationOfficeId : null,
          placeholder: l.choose,
          items: [
            for (final o in c.offices)
              DropdownMenuItem(value: o['_id'] as String, child: Text('${o['name']} (${o['postcode'] ?? ''})')),
          ],
          onChanged: c.open ? c.setDestination : null,
        ),
      ),
      SectionCard(
        title: l.senderUpdates,
        subtitle: l.senderUpdatesHint,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            GovDropdown<String>(
              label: l.sendUpdatesBy,
              value: c.channel,
              items: [
                for (final ch in ['none', 'email', 'sms']) DropdownMenuItem(value: ch, child: Text(channelLabel(l, ch))),
              ],
              onChanged: (v) => c.setNotification(channel: v),
            ),
            if (c.channel != 'none') ...[
              const SizedBox(height: 14),
              GovTextField(
                label: c.channel == 'email' ? l.senderEmail : l.senderMobile,
                hint: c.channel == 'sms' ? l.mobileFormat : null,
                controller: c.contact,
                keyboardType: c.channel == 'email' ? TextInputType.emailAddress : TextInputType.phone,
                autocorrect: false,
              ),
              const SizedBox(height: 14),
              GovDropdown<String>(
                label: l.messageLanguage,
                value: c.language,
                items: [
                  for (final code in ['si', 'ta', 'en']) DropdownMenuItem(value: code, child: Text(languageName(code))),
                ],
                onChanged: (v) => c.setNotification(language: v),
              ),
              const SizedBox(height: 14),
              GovDropdown<String>(
                label: l.whichUpdates,
                value: c.updates,
                items: [
                  DropdownMenuItem(value: 'key', child: Text(l.updatesKey)),
                  DropdownMenuItem(value: 'all', child: Text(l.updatesAll)),
                ],
                onChanged: (v) => c.setNotification(updates: v),
              ),
              if (c.channel == 'sms') ...[
                const SizedBox(height: 10),
                Text(l.smsGatewayNote, style: t.bodySmall),
              ],
            ],
          ],
        ),
      ),
      if (c.confirmed && !c.dirty)
        GovNotice(
          tone: Tone.success,
          title: l.detailsConfirmedBy('${c.draft?['confirmed_by'] ?? ''}'),
          message: stats == null
              ? null
              : l.reviewStats(stats['suggested'] as int? ?? 0, stats['accepted_unchanged'] as int? ?? 0,
                  stats['corrected'] as int? ?? 0, stats['added_manually'] as int? ?? 0),
        )
      else ...[
        if (c.confirmed && c.dirty) GovNotice(tone: Tone.warning, message: l.reconfirmNeeded),
        PrimaryButton(label: l.confirmDetails, icon: Icons.fact_check_outlined, busy: _busy, onPressed: _confirm),
        Text(l.confirmDetailsHint, style: t.bodySmall),
      ],
    ]);
  }
}
