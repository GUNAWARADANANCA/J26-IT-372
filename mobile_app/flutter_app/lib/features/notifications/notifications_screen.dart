// Sender messages (FR14): the outbox of e-mail/SMS status updates, with
// failed or unclear deliveries retried or resolved by hand (with a reason).
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/app_state.dart';
import '../../core/format.dart';
import '../../core/labels.dart';
import '../../l10n/l10n.dart';
import '../../theme/gov_theme.dart';
import '../../widgets/gov_widgets.dart';

const _outboxStates = ['queued', 'retry', 'sending', 'provider_accepted', 'ambiguous', 'failed_permanent', 'resolved_manually'];

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  late final AppState _state = context.read<AppState>();
  String _status = '';
  Map<String, dynamic>? _data;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _state.api.get('/api/notifications', query: {'status': _status});
      if (mounted) {
        setState(() {
          _data = Map<String, dynamic>.from(res as Map);
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _preview(Map row) async {
    final l = context.l10n;
    final entry = row['entry'] as Map;
    try {
      final p = await _state.api.get('/api/notifications/${row['tracking_id']}/${entry['key']}/preview') as Map;
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text('${p['subject'] ?? l.messagePreview}'),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('${l.to}: ${p['to']} (${channelLabel(l, p['channel'] as String?)})',
                    style: Theme.of(ctx).textTheme.bodySmall),
                const SizedBox(height: 10),
                SelectableText('${p['body']}'),
              ],
            ),
          ),
          actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: Text(l.close))],
        ),
      );
    } on ApiException catch (e) {
      if (mounted) showMessage(context, describeError(context, e));
    }
  }

  Future<void> _act(Map row, String action) async {
    final l = context.l10n;
    final entry = row['entry'] as Map;
    final reason = await askReason(context,
        title: action == 'retry' ? l.retryMessageTitle : l.resolveMessageTitle,
        message: action == 'retry' ? l.retryMessageBody : l.resolveMessageBody,
        confirmLabel: action == 'retry' ? l.retry : l.markResolved);
    if (reason == null || !mounted) return;
    try {
      await _state.api.post('/api/notifications/${row['tracking_id']}/${entry['key']}/$action', body: {'reason': reason});
      await _load();
    } on ApiException catch (e) {
      if (mounted) showMessage(context, describeError(context, e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final locale = Localizations.localeOf(context).toLanguageTag();
    final counts = Map<String, dynamic>.from((_data?['counts'] as Map?) ?? const {});
    final rows = ((_data?['entries'] as List?) ?? const []).cast<Map>();

    return Scaffold(
      appBar: GovAppBar(title: l.taskMessages),
      body: PageBody(
        onRefresh: _load,
        children: [
          Text(l.messagesIntro, style: t.bodySmall),
          GovDropdown<String>(
            label: l.status,
            value: _status,
            items: [
              DropdownMenuItem(value: '', child: Text(l.allStatuses)),
              for (final s in _outboxStates)
                DropdownMenuItem(value: s, child: Text('${outboxLabel(l, s)}${counts[s] != null ? ' (${counts[s]})' : ''}')),
            ],
            onChanged: (v) {
              setState(() => _status = v ?? '');
              _load();
            },
          ),
          if (_error != null) ErrorState(error: _error!, onRetry: _load),
          if (_data == null && _error == null) const LoadingView(),
          if (_data != null && rows.isEmpty) EmptyState(title: l.noMessages, icon: Icons.mark_email_read_outlined),
          for (final row in rows)
            Builder(builder: (context) {
              final e = row['entry'] as Map;
              final status = e['status'] as String?;
              final canRetry = status == 'failed_permanent' || status == 'ambiguous';
              final canResolve = status != 'provider_accepted' && status != 'resolved_manually';
              return SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(children: [
                      Expanded(child: MonoText('${row['tracking_id']}')),
                      StatusTag(outboxLabel(l, status), tone: outboxTone(status)),
                    ]),
                    const SizedBox(height: 6),
                    Text('${statusLabel(l, e['status_code'] as String?)} · ${channelLabel(l, e['channel'] as String?)} · ${languageName('${e['language']}')}'),
                    Text(l.attemptsAndTime(e['attempts'] as int? ?? 0, formatDateTime(e['created_at'], locale)),
                        style: t.bodySmall),
                    if ((e['history'] as List? ?? const []).isNotEmpty)
                      Text('${((e['history'] as List).last as Map)['detail'] ?? ((e['history'] as List).last as Map)['outcome']}',
                          style: t.bodySmall?.copyWith(color: GovColors.grey700)),
                    const SizedBox(height: 8),
                    Wrap(spacing: 4, runSpacing: 4, children: [
                      TextButton.icon(onPressed: () => _preview(row), icon: const Icon(Icons.visibility_outlined), label: Text(l.preview)),
                      if (canRetry) TextButton.icon(onPressed: () => _act(row, 'retry'), icon: const Icon(Icons.replay), label: Text(l.retry)),
                      if (canResolve)
                        TextButton.icon(
                            onPressed: () => _act(row, 'resolve'), icon: const Icon(Icons.task_alt), label: Text(l.markResolved)),
                    ]),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}
