// Step 5: versioned tariff quote, payment, acceptance. The total charged must
// equal the quote; the server refuses anything else.
import 'package:flutter/material.dart';

import '../../../core/api_client.dart';
import '../../../core/format.dart';
import '../../../l10n/l10n.dart';
import '../../../theme/gov_theme.dart';
import '../../../widgets/gov_widgets.dart';
import '../intake_controller.dart';

class PaymentStep extends StatefulWidget {
  const PaymentStep({super.key, required this.c, required this.onAccepted});

  final IntakeController c;
  final Future<void> Function(String trackingId) onAccepted;

  @override
  State<PaymentStep> createState() => _PaymentStepState();
}

class _PaymentStepState extends State<PaymentStep> {
  IntakeController get c => widget.c;
  bool _aod = false;
  final _insured = TextEditingController();
  String _method = 'cash';
  final _reference = TextEditingController();
  String? _busy;
  List<String> _errors = [];
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    final service = (c.draft?['service'] as Map?) ?? const {};
    _aod = service['advice_of_delivery'] == true;
    final insured = service['insured_value_lkr'];
    if (insured != null) _insured.text = '$insured';
  }

  @override
  void dispose() {
    _insured.dispose();
    _reference.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _run(String label, Future<void> Function() fn) async {
    setState(() {
      _busy = label;
      _errors = [];
    });
    try {
      await fn();
    } on ApiException catch (e) {
      if (mounted) setState(() => _errors = e.problems.isEmpty ? [describeError(context, e)] : e.problems);
      scrollToTop(_scroll);
    } catch (e) {
      if (mounted) setState(() => _errors = [describeError(context, e)]);
      scrollToTop(_scroll);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  void _quote() {
    final text = _insured.text.trim();
    final insured = text.isEmpty ? null : double.tryParse(text);
    if (text.isNotEmpty && (insured == null || insured <= 0)) {
      setState(() => _errors = [context.l10n.errInsuredValue]);
      return;
    }
    _run('quote', () => c.requestQuote(adviceOfDelivery: _aod, insuredValue: insured));
  }

  Future<void> _accept() async {
    final l = context.l10n;
    final q = c.quote!;
    final ok = await confirmAction(context,
        title: l.acceptLetterTitle,
        message: l.acceptLetterBody(formatMoney(q['total_lkr'])),
        confirmLabel: l.acceptLetter);
    if (!ok) return;
    await _run('accept', () async {
      final id = await c.accept(method: _method, reference: _reference.text.trim());
      await widget.onAccepted(id);
    });
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final q = c.quote;
    final quoteOk = q?['status'] == 'ok';
    final hasWeight = c.weight != null;

    return PageBody(controller: _scroll, children: [
      GovNotice(tone: Tone.info, title: l.stepPayTitle, message: l.nextPay),
      ProblemSummary(errors: _errors),
      SectionCard(
        title: l.extraServices,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: _aod,
              onChanged: (v) => setState(() => _aod = v),
              title: Text(l.adviceOfDelivery),
              subtitle: Text(l.adviceOfDeliveryHint),
            ),
            const SizedBox(height: 8),
            GovTextField(
              label: l.insuredValue,
              hint: l.insuredValueHint,
              controller: _insured,
              optional: true,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
            ),
            const SizedBox(height: 14),
            SecondaryButton(
              label: l.calculateCharge,
              icon: Icons.calculate_outlined,
              busy: _busy == 'quote',
              onPressed: hasWeight && _busy == null ? _quote : null,
            ),
            if (!hasWeight) ...[
              const SizedBox(height: 6),
              Text(l.weighFirst, style: t.bodySmall),
            ],
          ],
        ),
      ),
      if (q != null && !quoteOk)
        GovNotice(
          tone: Tone.warning,
          title: q['status'] == 'reweigh_required' ? l.reweighRequired : l.cannotQuote,
          children: [for (final r in (q['reasons'] as List? ?? const [])) Text('• ${(r as Map)['message']}')],
        ),
      if (quoteOk) _QuoteTable(quote: q!),
      SectionCard(
        title: l.beforeAccepting,
        child: Column(
          children: [
            _Check(label: l.checkConfirmed, ok: c.confirmed && !c.dirty),
            _Check(label: l.checkWeight, ok: hasWeight),
            _Check(label: l.checkCharge, ok: quoteOk),
          ],
        ),
      ),
      if (quoteOk)
        SectionCard(
          title: l.payment,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              FieldLabel(l.paymentMethod),
              SegmentedButton<String>(
                showSelectedIcon: false,
                segments: [
                  ButtonSegment(value: 'cash', label: Text(l.payCash)),
                  ButtonSegment(value: 'card', label: Text(l.payCard)),
                  ButtonSegment(value: 'other', label: Text(l.payOther)),
                ],
                selected: {_method},
                onSelectionChanged: (s) => setState(() => _method = s.first),
              ),
              const SizedBox(height: 14),
              GovTextField(label: l.receiptReference, controller: _reference, optional: true),
              const SizedBox(height: 16),
              PrimaryButton(
                label: l.receivedAndAccept(formatMoney(q!['total_lkr'])),
                icon: Icons.verified_outlined,
                busy: _busy == 'accept',
                onPressed: c.confirmed && !c.dirty && _busy == null ? _accept : null,
              ),
              if (!c.confirmed || c.dirty) ...[
                const SizedBox(height: 6),
                Text(l.confirmFirst, style: const TextStyle(color: GovColors.warning, fontWeight: FontWeight.w600)),
              ],
            ],
          ),
        ),
    ]);
  }
}

class _Check extends StatelessWidget {
  const _Check({required this.label, required this.ok});

  final String label;
  final bool ok;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Semantics(
      label: '$label: ${ok ? l.complete : l.notComplete}',
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Icon(ok ? Icons.check_circle : Icons.radio_button_unchecked, color: ok ? GovColors.success : GovColors.grey500),
            const SizedBox(width: 10),
            Expanded(child: Text(label, style: TextStyle(color: ok ? GovColors.success : GovColors.grey700))),
          ],
        ),
      ),
    );
  }
}

class _QuoteTable extends StatelessWidget {
  const _QuoteTable({required this.quote});

  final Map<String, dynamic> quote;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final band = (quote['band'] as Map?)?['label'] as String?;
    String lineLabel(Map line) => switch (line['code']) {
          'postage' => '${l.qPostage}${band == null ? '' : ' ($band)'}',
          'registration' => l.qRegistration,
          'advice_of_delivery' => l.adviceOfDelivery,
          'insurance' => l.qInsurance,
          _ => '${line['label']}',
        };
    return SectionCard(
      title: l.charge,
      subtitle: l.tariffLine('${quote['tariff_version']}', '${quote['weight_g']}', '${quote['uncertainty_g']}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (quote['approval_status'] != 'approved')
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: StatusTag(l.tariffNotApproved, tone: Tone.warning),
              ),
            ),
          for (final line in (quote['lines'] as List).cast<Map>())
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: Text(lineLabel(line), style: t.bodyMedium)),
                  Text(formatMoney(line['amount_lkr']), style: t.bodyMedium),
                ],
              ),
            ),
          const Divider(height: 16, thickness: 2, color: GovColors.navy200),
          Row(
            children: [
              Expanded(child: Text(l.total, style: t.titleMedium)),
              Text(formatMoney(quote['total_lkr']), style: t.titleMedium?.copyWith(color: GovColors.navy900)),
            ],
          ),
        ],
      ),
    );
  }
}
