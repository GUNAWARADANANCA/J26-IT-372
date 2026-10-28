import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/app_state.dart';
import '../../core/labels.dart';
import '../../l10n/l10n.dart';
import '../../theme/gov_theme.dart';
import '../../widgets/gov_widgets.dart';
import '../items/items_screen.dart' show itemStatuses;

/// Postmaster overview: items by status, scans waiting for review, sender
/// messages by state and open counter drafts (GET /api/reports/summary).
class SummaryScreen extends StatefulWidget {
  const SummaryScreen({super.key});

  @override
  State<SummaryScreen> createState() => _SummaryScreenState();
}

class _SummaryScreenState extends State<SummaryScreen> {
  Map<String, dynamic>? _s;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await context.read<AppState>().api.get('/api/reports/summary');
      if (mounted) {
        setState(() {
          _s = Map<String, dynamic>.from(res as Map);
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final s = _s;
    final byStatus = Map<String, dynamic>.from((s?['items_by_status'] as Map?) ?? const {});
    final outbox = Map<String, dynamic>.from((s?['outbox_by_status'] as Map?) ?? const {});
    final total = byStatus.values.fold<int>(0, (a, b) => a + (b as int));
    return Scaffold(
      appBar: GovAppBar(title: l.taskSummary),
      body: s == null
          ? (_error == null ? const LoadingView() : PageBody(children: [ErrorState(error: _error!, onRetry: _load)]))
          : PageBody(onRefresh: _load, children: [
              Row(children: [
                Expanded(child: _Stat(label: l.registeredItems, value: '$total')),
                const SizedBox(width: 10),
                Expanded(child: _Stat(label: l.waitingReview, value: '${s['held_events'] ?? 0}', warn: (s['held_events'] ?? 0) > 0)),
                const SizedBox(width: 10),
                Expanded(child: _Stat(label: l.openDrafts, value: '${s['open_drafts'] ?? 0}')),
              ]),
              SectionCard(
                title: l.itemsByStatus,
                child: Column(children: [
                  for (final st in itemStatuses)
                    _Bar(label: statusLabel(l, st), value: (byStatus[st] as int?) ?? 0, max: total, tone: statusTone(st)),
                ]),
              ),
              SectionCard(
                title: l.messagesByState,
                child: outbox.isEmpty
                    ? Text('—', style: Theme.of(context).textTheme.bodySmall)
                    : Column(children: [
                        for (final e in outbox.entries)
                          _Bar(
                            label: outboxLabel(l, e.key),
                            value: e.value as int,
                            max: outbox.values.fold<int>(0, (a, b) => a + (b as int)),
                            tone: outboxTone(e.key),
                          ),
                      ]),
              ),
              Text(l.reportsOnWeb, style: Theme.of(context).textTheme.bodySmall),
            ]),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, this.warn = false});

  final String label;
  final String value;
  final bool warn;

  @override
  Widget build(BuildContext context) {
    return MergeSemantics(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: GovColors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: warn ? GovColors.warning : GovColors.line, width: warn ? 2 : 1),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(value, style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: warn ? GovColors.warning : GovColors.navy900)),
          Text(label, style: Theme.of(context).textTheme.bodySmall, maxLines: 2),
        ]),
      ),
    );
  }
}

class _Bar extends StatelessWidget {
  const _Bar({required this.label, required this.value, required this.max, required this.tone});

  final String label;
  final int value;
  final int max;
  final Tone tone;

  @override
  Widget build(BuildContext context) {
    return MergeSemantics(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Expanded(child: Text(label)),
            Text('$value', style: const TextStyle(fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: LinearProgressIndicator(
              value: max == 0 ? 0 : value / max,
              minHeight: 8,
              color: tone == Tone.neutral ? GovColors.grey600 : tone.fg,
              backgroundColor: GovColors.grey100,
            ),
          ),
        ]),
      ),
    );
  }
}
