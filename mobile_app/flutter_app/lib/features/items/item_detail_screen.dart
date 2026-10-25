import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/app_state.dart';
import '../../core/format.dart';
import '../../core/labels.dart';
import '../../core/models.dart';
import '../../l10n/l10n.dart';
import '../../theme/gov_theme.dart';
import '../../widgets/gov_widgets.dart';
import '../../widgets/status_progress.dart';
import '../../widgets/timeline.dart';
import '../intake/receipt_screen.dart';
import '../scan/scan_flow.dart';

/// Staff view of one registered item: journey, addresses, every scan event
/// with its decision and location result, and the sender messages.
class ItemDetailScreen extends StatefulWidget {
  const ItemDetailScreen({super.key, required this.trackingId});

  final String trackingId;

  @override
  State<ItemDetailScreen> createState() => _ItemDetailScreenState();
}

class _ItemDetailScreenState extends State<ItemDetailScreen> {
  late final AppState _state = context.read<AppState>();
  Map<String, dynamic>? _item;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _state.api.get('/api/items/${Uri.encodeComponent(widget.trackingId)}');
      if (mounted) {
        setState(() {
          _item = Map<String, dynamic>.from(res as Map);
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _assign() async {
    final l = context.l10n;
    List<Map> postmen;
    try {
      final users = await _state.api.get('/api/admin/users') as List;
      postmen = users
          .cast<Map>()
          .where((u) => u['role'] == 'postman' && u['office_id'] == _item!['destination_office_id'] && u['active'] != false)
          .toList();
    } on ApiException catch (e) {
      if (mounted) showMessage(context, describeError(context, e));
      return;
    }
    if (!mounted) return;
    if (postmen.isEmpty) {
      showMessage(context, l.noPostmenAtOffice);
      return;
    }
    final chosen = await showDialog<String>(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: Text(l.assignPostman),
        children: [
          for (final p in postmen)
            SimpleDialogOption(
              onPressed: () => Navigator.pop(ctx, p['username'] as String),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text('${p['full_name']} (${p['username']})', style: const TextStyle(fontSize: 16)),
              ),
            ),
        ],
      ),
    );
    if (chosen == null) return;
    try {
      await _state.api.post('/api/items/${widget.trackingId}/assign', body: {'postman_username': chosen});
      await _load();
      if (mounted) showMessage(context, l.assignedTo(chosen));
    } on ApiException catch (e) {
      if (mounted) showMessage(context, describeError(context, e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final locale = Localizations.localeOf(context).toLanguageTag();
    final user = _state.user!;
    final item = _item;

    return Scaffold(
      appBar: GovAppBar(title: l.itemDetails),
      body: item == null
          ? (_error == null ? const LoadingView() : PageBody(children: [ErrorState(error: _error!, onRetry: _load)]))
          : PageBody(onRefresh: _load, children: [
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        IconBadge(statusIcon(item['status'] as String?), hue: statusHue(item['status'] as String?), size: 52),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              MonoText('${item['tracking_id']}', size: 17, color: GovColors.navy900),
                              const SizedBox(height: 4),
                              StatusPill(item['status'] as String?),
                            ],
                          ),
                        ),
                        IconButton(
                          tooltip: l.copyId,
                          icon: const Icon(Icons.copy_rounded),
                          onPressed: () {
                            Clipboard.setData(ClipboardData(text: '${item['tracking_id']}'));
                            showMessage(context, l.idCopied);
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    StatusProgress(status: '${item['status']}', direction: item['direction'] as String? ?? 'forward'),
                  ],
                ),
              ),
              if (user.can(Roles.scanning) && (item['allowed_next'] as List? ?? const []).isNotEmpty)
                PrimaryButton(
                  label: l.recordAScan,
                  icon: Icons.edit_location_alt_outlined,
                  onPressed: () async {
                    await recordFor(context, '${item['tracking_id']}');
                    _load();
                  },
                ),
              if (user.can(Roles.intake))
                SecondaryButton(
                  label: l.labelAndReceipt,
                  icon: Icons.receipt_long,
                  onPressed: () => Navigator.push(context,
                      MaterialPageRoute(builder: (_) => ReceiptScreen(trackingId: '${item['tracking_id']}'))),
                ),
              if (user.can([Roles.postmaster]))
                SecondaryButton(label: l.assignPostman, icon: Icons.person_pin_circle_outlined, onPressed: _assign),
              SectionCard(
                icon: Icons.info_outline_rounded,
                title: l.details,
                child: Column(
                  children: [
                    KeyValueRow(l.fromOffice, item['origin_office_id'] as String?),
                    KeyValueRow(l.destinationOffice, item['destination_office_id'] as String?),
                    KeyValueRow(l.acceptedOn, formatDateTime(item['accepted_at'], locale)),
                    KeyValueRow(l.acceptedBy, item['accepted_by'] as String?),
                    KeyValueRow(l.weight, formatGrams((item['weight'] as Map?)?['grams'])),
                    KeyValueRow(l.total, formatMoney((item['quote'] as Map?)?['total_lkr'])),
                    KeyValueRow(l.tariff, item['tariff_version'] as String?),
                    KeyValueRow(l.assignedPostman, item['assigned_postman'] as String?),
                  ],
                ),
              ),
              if (item['recipient'] != null) _PartyView(title: l.recipientTo, party: item['recipient'] as Map),
              if (item['sender'] != null) _PartyView(title: l.senderFrom, party: item['sender'] as Map),
              SectionCard(
                icon: Icons.timeline_rounded,
                hue: Hue.purple,
                title: l.history,
                child: Timeline(entries: [
                  for (final e in (item['events'] as List? ?? const []).cast<Map>()) _entry(l, e, locale),
                ]),
              ),
              if ((item['outbox'] as List? ?? const []).isNotEmpty)
                SectionCard(
                  title: l.taskMessages,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (final o in (item['outbox'] as List).cast<Map>())
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                    '${statusLabel(l, o['status_code'] as String?)} · ${channelLabel(l, o['channel'] as String?)} · ${languageName('${o['language']}')}',
                                    style: t.bodyMedium),
                              ),
                              StatusTag(outboxLabel(l, o['status'] as String?), tone: outboxTone(o['status'] as String?)),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
            ]),
    );
  }

  TimelineEntry _entry(AppLocalizations l, Map e, String locale) {
    final a = (e['assessment'] as Map?) ?? const {};
    final loc = (e['location'] as Map?) ?? const {};
    final reasons = [for (final r in (e['decision_reasons'] as List? ?? const []).cast<Map>()) '${r['message']}'];
    final ack = e['acknowledgement'] as Map?;
    return TimelineEntry(
      title: statusLabel(l, e['requested_status'] as String?),
      time: formatDateTime(e['captured_at'], locale),
      tone: decisionTone(e['decision'] as String?),
      lines: [
        l.byWorker('${e['worker']}', roleLabel(l, '${e['worker_role']}')),
        if (loc['accuracy_m'] != null) l.locationAccuracy((loc['accuracy_m'] as num).round()),
        if (a['distance_m'] != null) l.distanceFromZone((a['distance_m'] as num).round()),
        if (e['offline'] == true) l.savedOffline(((e['sync_delay_s'] as num?) ?? 0).round()),
        if ('${e['reason'] ?? ''}'.isNotEmpty) '${l.reason}: ${e['reason']}',
        if (ack != null) l.ackLine(ackTypeLabel(l, ack['type'] as String?), '${ack['recipient_name'] ?? ack['reference'] ?? ''}'),
        ...reasons,
        if (e['review'] is Map && (e['review'] as Map)['reason'] != null)
          l.reviewNote('${(e['review'] as Map)['by']}', '${(e['review'] as Map)['reason']}'),
      ],
      tags: [
        StatusTag(decisionLabel(l, e['decision'] as String?), tone: decisionTone(e['decision'] as String?)),
        if (a['result'] != null) StatusTag(locationLabel(l, a['result'] as String?), tone: locationTone(a['result'] as String?)),
        if (e['flagged'] == true) StatusTag(l.flagged, tone: Tone.warning),
        if (e['late'] == true) StatusTag(l.historyOnly, tone: Tone.neutral),
      ],
    );
  }
}

class _PartyView extends StatelessWidget {
  const _PartyView({required this.title, required this.party});

  final String title;
  final Map party;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final lines = [
      party['name'],
      [party['house_number'], party['street']].where((x) => x != null && '$x'.isNotEmpty).join(', '),
      party['locality'],
      [party['city'], party['postcode']].where((x) => x != null && '$x'.isNotEmpty).join(' '),
      party['region'],
    ].where((x) => x != null && '$x'.trim().isNotEmpty).join('\n');
    return SectionCard(title: title, child: Text(lines.isEmpty ? '—' : lines, style: t.bodyLarge));
  }
}
