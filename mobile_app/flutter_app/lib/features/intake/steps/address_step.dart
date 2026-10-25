// Step 2: the officer checks the recipient and sender fields against the
// envelope. Suggestions from the reader are shown beside each field (never
// merged silently); low-confidence fields are marked; town and postcode are
// checked against the gazetteer.
import 'dart:async';

import 'package:flutter/material.dart';

import '../../../l10n/l10n.dart';
import '../../../theme/gov_theme.dart';
import '../../../widgets/gov_widgets.dart';
import '../intake_controller.dart';
import '../intake_progress.dart';

String addressFieldLabel(AppLocalizations l, String f) => switch (f) {
      'name' => l.fName,
      'house_number' => l.fHouse,
      'street' => l.fStreet,
      'locality' => l.fLocality,
      'city' => l.fCity,
      'postcode' => l.fPostcode,
      'region' => l.fRegion,
      _ => f,
    };

class AddressStep extends StatelessWidget {
  const AddressStep({super.key, required this.c});

  final IntakeController c;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return PageBody(children: [
      GovNotice(tone: Tone.info, title: l.stepAddressesTitle, message: l.nextAddresses),
      _PartyCard(c: c, party: 'recipient', title: l.recipientTo, subtitle: l.recipientHint),
      _PartyCard(c: c, party: 'sender', title: l.senderFrom, subtitle: l.senderHint),
    ]);
  }
}

class _PartyCard extends StatefulWidget {
  const _PartyCard({required this.c, required this.party, required this.title, required this.subtitle});

  final IntakeController c;
  final String party;
  final String title;
  final String subtitle;

  @override
  State<_PartyCard> createState() => _PartyCardState();
}

class _PartyCardState extends State<_PartyCard> {
  PartyForm get form => widget.c.party(widget.party);
  Timer? _debounce;
  Map<String, dynamic>? _check;
  String _checkedFor = '';

  @override
  void initState() {
    super.initState();
    form['city'].addListener(_scheduleCheck);
    form['postcode'].addListener(_scheduleCheck);
    _scheduleCheck();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    form['city'].removeListener(_scheduleCheck);
    form['postcode'].removeListener(_scheduleCheck);
    super.dispose();
  }

  void _scheduleCheck() {
    final key = '${form.value('city')}|${form.value('postcode')}';
    if (key == _checkedFor) return;
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 600), () async {
      _checkedFor = key;
      try {
        final res = await widget.c.addressCheck(widget.party);
        if (mounted) setState(() => _check = res);
      } catch (_) {
        if (mounted) setState(() => _check = null);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final suggestion = ((widget.c.draft?['suggestions'] as Map?)?[widget.party] as Map?) ?? const {};
    final fields = (suggestion['fields'] as Map?) ?? const {};
    final conf = (suggestion['confidence'] as Map?) ?? const {};
    final review = {...((suggestion['needs_review'] as List?) ?? const [])};
    final derived = ((widget.c.lastParse[widget.party]?['derived'] as Map?)?['postcode'] as Map?);
    final status = (_check?['city_postcode'] as Map?)?['status'] as String?;
    final open = widget.c.open;

    return SectionCard(
      title: widget.title,
      subtitle: widget.subtitle,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (fields.values.any((v) => '$v'.trim().isNotEmpty)) ...[
            OutlinedButton.icon(
              onPressed: open ? () => setState(() => form.useAll(fields)) : null,
              icon: const Icon(Icons.done_all),
              label: Text(l.useAllSuggestions),
            ),
            const SizedBox(height: 4),
            Text(l.confidenceLegend, style: t.bodySmall),
            const SizedBox(height: 12),
          ],
          for (final f in addressFields) ...[
            _AddressField(
              label: addressFieldLabel(l, f),
              controller: form[f],
              suggested: '${fields[f] ?? ''}'.trim(),
              confidence: conf[f] is num ? (conf[f] as num).toDouble() : null,
              flagged: review.contains(f),
              enabled: open,
              keyboardType: f == 'postcode' ? TextInputType.number : TextInputType.text,
              onUse: () => setState(() => form[f].text = '${fields[f]}'),
            ),
            const SizedBox(height: 14),
          ],
          if (derived != null && form.value('postcode').isEmpty)
            GovNotice(
              tone: Tone.info,
              message: l.postcodeDerived('${derived['value']}'),
              action: TextButton(
                onPressed: () => setState(() => form['postcode'].text = '${derived['value']}'),
                child: Text(l.useIt),
              ),
            ),
          if (status == 'consistent')
            Row(children: [
              const Icon(Icons.check_circle, color: GovColors.success, size: 18),
              const SizedBox(width: 6),
              Expanded(child: Text(l.townPostcodeOk, style: const TextStyle(color: GovColors.success, fontWeight: FontWeight.w600))),
            ])
          else if (status != null && status != 'incomplete')
            GovNotice(
              tone: Tone.warning,
              title: l.townPostcodeCheck,
              message: switch (status) {
                'mismatch' => l.townPostcodeMismatch,
                'unknown_city' => l.townUnknown,
                'unknown_postcode' => l.postcodeUnknown,
                _ => '${(_check?['city_postcode'] as Map?)?['detail'] ?? status}',
              },
              children: [
                if (((_check?['city_postcode'] as Map?)?['candidates'] as List?)?.isNotEmpty == true)
                  Text(l.expectedValues(((_check!['city_postcode'] as Map)['candidates'] as List).join(', '))),
              ],
            ),
        ],
      ),
    );
  }
}

class _AddressField extends StatelessWidget {
  const _AddressField({
    required this.label,
    required this.controller,
    required this.suggested,
    required this.confidence,
    required this.flagged,
    required this.enabled,
    required this.onUse,
    this.keyboardType,
  });

  final String label;
  final TextEditingController controller;
  final String suggested;
  final double? confidence;
  final bool flagged;
  final bool enabled;
  final VoidCallback onUse;
  final TextInputType? keyboardType;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller,
      builder: (context, value, _) {
        final differs = suggested.isNotEmpty && suggested != value.text.trim();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Label and field are one node for screen readers.
            MergeSemantics(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
            Row(
              children: [
                Expanded(
                  child: Text(label, style: t.labelMedium?.copyWith(color: flagged ? GovColors.error : null)),
                ),
                if (confidence != null)
                  Semantics(
                    label: l.modelConfidence((confidence! * 100).round()),
                    excludeSemantics: true,
                    child: StatusTag('${(confidence! * 100).round()} %', tone: flagged ? Tone.error : Tone.info),
                  ),
              ],
            ),
            const SizedBox(height: 6),
            TextField(
              controller: controller,
              enabled: enabled,
              keyboardType: keyboardType,
              textCapitalization: TextCapitalization.words,
              decoration: InputDecoration(
                fillColor: flagged ? GovColors.errorTint : null,
                enabledBorder: flagged
                    ? OutlineInputBorder(
                        borderRadius: BorderRadius.circular(GovTheme.radius),
                        borderSide: const BorderSide(color: GovColors.error, width: 2),
                      )
                    : null,
                helperText: flagged ? l.lowConfidenceCheck : null,
                helperStyle: const TextStyle(color: GovColors.error, fontWeight: FontWeight.w600),
              ),
            ),
                ],
              ),
            ),
            if (differs)
              Row(
                children: [
                  Expanded(child: Text(l.suggestedValue(suggested), style: t.bodySmall)),
                  TextButton(onPressed: enabled ? onUse : null, child: Text(l.use)),
                ],
              ),
          ],
        );
      },
    );
  }
}
