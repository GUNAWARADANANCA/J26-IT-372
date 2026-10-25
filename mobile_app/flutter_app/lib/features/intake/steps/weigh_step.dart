// Step 4: pair a fresh, stable reading from the IoT scale (each placement can
// be used once), or enter an audited manual weight from an approved scale.
import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/api_client.dart';
import '../../../core/format.dart';
import '../../../core/labels.dart';
import '../../../l10n/l10n.dart';
import '../../../theme/gov_theme.dart';
import '../../../widgets/gov_widgets.dart';
import '../intake_controller.dart';

class WeighStep extends StatefulWidget {
  const WeighStep({super.key, required this.c});

  final IntakeController c;

  @override
  State<WeighStep> createState() => _WeighStepState();
}

class _WeighStepState extends State<WeighStep> {
  IntakeController get c => widget.c;
  String? _deviceId;
  Map<String, dynamic>? _live;
  Object? _liveError;
  Timer? _timer;
  bool _polling = false;
  String? _busy;
  Object? _error;

  final _grams = TextEditingController();
  final _instrument = TextEditingController();
  final _reason = TextEditingController();
  List<String> _manualErrors = [];

  @override
  void initState() {
    super.initState();
    _deviceId = c.devices.isEmpty ? null : c.devices.first['device_id'] as String?;
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _poll());
    _poll();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _grams.dispose();
    _instrument.dispose();
    _reason.dispose();
    super.dispose();
  }

  Future<void> _poll() async {
    final id = _deviceId;
    if (id == null || _polling || !mounted) return;
    _polling = true;
    try {
      final live = await c.liveWeight(id);
      if (mounted) {
        setState(() {
          _live = live;
          _liveError = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _liveError = e);
    } finally {
      _polling = false;
    }
  }

  Future<void> _run(String label, Future<void> Function() fn) async {
    setState(() {
      _busy = label;
      _error = null;
    });
    try {
      await fn();
    } catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  void _manual() {
    final l = context.l10n;
    final grams = double.tryParse(_grams.text.trim().replaceAll(',', '.'));
    final errors = [
      if (grams == null || grams <= 0 || grams > 5000) l.errGrams,
      if (_instrument.text.trim().length < 2) l.errInstrument,
      if (_reason.text.trim().length < 5) l.errManualReason,
    ];
    setState(() => _manualErrors = errors);
    if (errors.isNotEmpty) return;
    _run('manual', () => c.manualWeight(grams!, _instrument.text.trim(), _reason.text.trim()));
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final w = c.weight;
    final reading = _live?['reading'] as Map?;
    final ready = _live?['ready'] == true;
    final problems = ((_live?['problems'] as List?) ?? const []).cast<Map>();
    final net = reading?['net_g'];

    return PageBody(children: [
      GovNotice(tone: Tone.info, title: l.stepWeighTitle, message: l.nextWeigh),
      if (w != null)
        GovNotice(
          tone: Tone.success,
          title: l.weightRecorded(formatGrams(w['grams'])),
          message: w['source'] == 'device'
              ? l.weightFromScale('${w['device_id']}', '${w['uncertainty_g'] ?? '—'}')
              : l.weightManual('${(w['manual'] as Map?)?['instrument'] ?? ''}'),
        ),
      if (_error != null) ErrorState(error: _error!),
      SectionCard(
        title: l.iotScale,
        subtitle: l.iotScaleHint,
        child: _deviceId == null
            ? Text(l.noScaleForOffice)
            : Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (c.devices.length > 1) ...[
                    GovDropdown<String>(
                      label: l.scale,
                      value: _deviceId,
                      items: [
                        for (final d in c.devices)
                          DropdownMenuItem(value: d['device_id'] as String, child: Text('${d['device_id']}')),
                      ],
                      onChanged: (v) => setState(() {
                        _deviceId = v;
                        _live = null;
                      }),
                    ),
                    const SizedBox(height: 12),
                  ],
                  Semantics(
                    liveRegion: true,
                    label: net == null ? l.noReading : '${l.currentReading}: ${formatGrams(net)}',
                    excludeSemantics: true,
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 18),
                      decoration: BoxDecoration(
                        color: ready ? GovColors.successTint : GovColors.grey100,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: ready ? GovColors.success : GovColors.line, width: 2),
                      ),
                      child: Column(
                        children: [
                          Text(l.currentReading, style: t.labelSmall),
                          Text(net == null ? '— g' : formatGrams(net),
                              style: const TextStyle(fontSize: 40, fontWeight: FontWeight.w800, color: GovColors.navy900)),
                          const SizedBox(height: 6),
                          Wrap(spacing: 6, runSpacing: 6, alignment: WrapAlignment.center, children: [
                            if (ready) StatusTag(l.stableReady, tone: Tone.success, icon: Icons.check),
                            if (!ready && reading?['loaded'] == true && reading?['stable'] != true)
                              StatusTag(l.settling, tone: Tone.warning),
                            if (reading?['spread_g'] != null) StatusTag(l.spread('${reading!['spread_g']}'), tone: Tone.neutral),
                          ]),
                        ],
                      ),
                    ),
                  ),
                  if (_liveError != null) ...[
                    const SizedBox(height: 8),
                    Text(_liveError is ApiException && (_liveError as ApiException).isNetwork
                        ? l.errorNetwork
                        : describeError(context, _liveError!),
                        style: const TextStyle(color: GovColors.error)),
                  ],
                  if (problems.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    for (final p in problems)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          const Icon(Icons.info_outline, size: 18, color: GovColors.warning),
                          const SizedBox(width: 6),
                          Expanded(child: Text(weightProblem(l, p))),
                        ]),
                      ),
                  ],
                  const SizedBox(height: 12),
                  PrimaryButton(
                    label: l.useThisWeight,
                    icon: Icons.scale,
                    busy: _busy == 'pair',
                    onPressed: ready && _busy == null ? () => _run('pair', () => c.pairWeight(_deviceId!)) : null,
                  ),
                ],
              ),
      ),
      Card(
        child: ExpansionTile(
          shape: const Border(),
          title: Text(l.manualWeightTitle, style: t.titleSmall),
          subtitle: Text(l.manualWeightHint, style: t.bodySmall),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          children: [
            ProblemSummary(errors: _manualErrors),
            if (_manualErrors.isNotEmpty) const SizedBox(height: 12),
            GovTextField(label: l.weightGrams, controller: _grams, keyboardType: const TextInputType.numberWithOptions(decimal: true)),
            const SizedBox(height: 12),
            GovTextField(label: l.instrument, hint: l.instrumentHint, controller: _instrument),
            const SizedBox(height: 12),
            GovTextField(label: l.reason, hint: l.manualReasonHint, controller: _reason, maxLines: 2),
            const SizedBox(height: 12),
            SecondaryButton(label: l.recordManualWeight, busy: _busy == 'manual', onPressed: _busy == null ? _manual : null),
          ],
        ),
      ),
    ]);
  }
}
