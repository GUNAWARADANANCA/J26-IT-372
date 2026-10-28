// Postmaster review (FR16): scans held because of location, mock location,
// clock or missing acknowledgement are approved or rejected with a reason.
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/app_state.dart';
import '../../core/format.dart';
import '../../core/labels.dart';
import '../../l10n/l10n.dart';
import '../../theme/gov_theme.dart';
import '../../widgets/gov_widgets.dart';
import '../items/item_detail_screen.dart';

class ReviewScreen extends StatefulWidget {
  const ReviewScreen({super.key});

  @override
  State<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends State<ReviewScreen> {
  late final AppState _state = context.read<AppState>();
  List<Map>? _held;
  List<Map>? _flagged;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await Future.wait([_state.api.get('/api/review/held'), _state.api.get('/api/review/flagged')]);
      if (mounted) {
        setState(() {
          _held = (r[0] as List).cast<Map>();
          _flagged = (r[1] as List).cast<Map>();
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _decide(Map row, String action) async {
    final l = context.l10n;
    final reason = await askReason(
      context,
      title: action == 'approve' ? l.approveScanTitle : l.rejectScanTitle,
      message: action == 'approve' ? l.approveScanBody : l.rejectScanBody,
      confirmLabel: action == 'approve' ? l.approve : l.reject,
    );
    if (reason == null || !mounted) return;
    try {
      await _state.api.post('/api/review/${row['tracking_id']}/${(row['event'] as Map)['event_id']}',
          body: {'action': action, 'reason': reason});
      if (mounted) showMessage(context, action == 'approve' ? l.scanApproved : l.scanRejected);
      await _load();
    } on ApiException catch (e) {
      if (mounted) showMessage(context, describeError(context, e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: GovAppBar(
          title: l.taskReview,
          bottom: TabBar(tabs: [
            Tab(text: l.heldTab(_held?.length ?? 0)),
            Tab(text: l.flaggedTab(_flagged?.length ?? 0)),
          ]),
        ),
        body: _error != null
            ? PageBody(children: [ErrorState(error: _error!, onRetry: _load)])
            : _held == null
                ? const LoadingView()
                : TabBarView(children: [
                    _list(_held!, actions: true, empty: l.noHeldScans),
                    _list(_flagged!, actions: false, empty: l.noFlaggedScans),
                  ]),
      ),
    );
  }

  Widget _list(List<Map> rows, {required bool actions, required String empty}) {
    final l = context.l10n;
    return PageBody(
      onRefresh: _load,
      children: [
        Text(actions ? l.heldIntro : l.flaggedIntro, style: Theme.of(context).textTheme.bodySmall),
        if (rows.isEmpty) EmptyState(title: empty, icon: Icons.task_alt),
        for (final row in rows) _EventCard(row: row, onDecide: actions ? (a) => _decide(row, a) : null),
      ],
    );
  }
}

class _EventCard extends StatelessWidget {
  const _EventCard({required this.row, this.onDecide});

  final Map row;
  final void Function(String action)? onDecide;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final locale = Localizations.localeOf(context).toLanguageTag();
    final e = (row['event'] as Map?) ?? const {};
    final a = (e['assessment'] as Map?) ?? const {};
    final loc = (e['location'] as Map?) ?? const {};
    final ack = e['acknowledgement'] as Map?;
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: () => Navigator.push(
                context, MaterialPageRoute(builder: (_) => ItemDetailScreen(trackingId: '${row['tracking_id']}'))),
            child: Row(children: [
              Expanded(child: MonoText('${row['tracking_id']}')),
              const Icon(Icons.chevron_right, color: GovColors.grey500),
            ]),
          ),
          const SizedBox(height: 6),
          Text(l.requestedStatus(statusLabel(l, e['requested_status'] as String?)), style: t.titleSmall),
          Text(l.byWorker('${e['worker']}', roleLabel(l, '${e['worker_role']}')), style: t.bodySmall),
          Text(formatDateTime(e['captured_at'], locale), style: t.bodySmall),
          const SizedBox(height: 8),
          Wrap(spacing: 6, runSpacing: 6, children: [
            StatusTag(locationLabel(l, a['result'] as String?), tone: locationTone(a['result'] as String?)),
            if (loc['mock'] == true) StatusTag(l.mockLocation, tone: Tone.error),
            if (e['offline'] == true) StatusTag(l.offlineScan, tone: Tone.neutral),
          ]),
          const SizedBox(height: 8),
          for (final r in (e['decision_reasons'] as List? ?? const []).cast<Map>()) Text('• ${r['message']}'),
          if (loc['accuracy_m'] != null) Text(l.locationAccuracy((loc['accuracy_m'] as num).round()), style: t.bodySmall),
          if (a['distance_m'] != null) Text(l.distanceFromZone((a['distance_m'] as num).round()), style: t.bodySmall),
          if (ack != null)
            Text(l.ackLine(ackTypeLabel(l, ack['type'] as String?), '${ack['recipient_name'] ?? ''}'), style: t.bodySmall),
          if ('${e['exception_reason'] ?? ''}'.isNotEmpty) Text('${l.exceptionReason}: ${e['exception_reason']}'),
          if (onDecide != null) ...[
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: FilledButton(onPressed: () => onDecide!('approve'), child: Text(l.approve))),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                      foregroundColor: GovColors.error, side: const BorderSide(color: GovColors.error, width: 1.5)),
                  onPressed: () => onDecide!('reject'),
                  child: Text(l.reject),
                ),
              ),
            ]),
          ],
        ],
      ),
    );
  }
}
