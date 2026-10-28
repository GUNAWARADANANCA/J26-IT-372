import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/app_state.dart';
import '../../core/format.dart';
import '../../core/labels.dart';
import '../../core/tracking_id.dart';
import '../../l10n/l10n.dart';
import '../../theme/gov_theme.dart';
import '../../widgets/gov_widgets.dart';
import '../scan/scanner_screen.dart';
import 'item_detail_screen.dart';

const itemStatuses = [
  'accepted',
  'dispatched',
  'in_transit',
  'at_destination_office',
  'out_for_delivery',
  'delivery_attempted',
  'delivered',
  'return_started',
  'returned_to_sender',
];

/// Registered items handled by the user's office (hubs and admin see all).
class ItemsScreen extends StatefulWidget {
  const ItemsScreen({super.key});

  @override
  State<ItemsScreen> createState() => _ItemsScreenState();
}

class _ItemsScreenState extends State<ItemsScreen> {
  final _q = TextEditingController();
  String _status = '';
  List<Map<String, dynamic>>? _rows;
  Object? _error;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final rows = await context.read<AppState>().api.get('/api/items', query: {
        'q': _q.text.trim(),
        'status': _status,
        'limit': '100',
      }) as List;
      if (mounted) {
        setState(() {
          _rows = [for (final r in rows) Map<String, dynamic>.from(r as Map)];
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _scan() async {
    final code = await Navigator.push<ScannedCode>(context, MaterialPageRoute(builder: (_) => const ScannerScreen()));
    if (code == null || !mounted) return;
    await Navigator.push(context, MaterialPageRoute(builder: (_) => ItemDetailScreen(trackingId: code.trackingId)));
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final locale = Localizations.localeOf(context).toLanguageTag();
    return Scaffold(
      appBar: GovAppBar(title: l.taskItems),
      body: PageBody(
        onRefresh: _load,
        children: [
          SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                GovTextField(
                  label: l.findItem,
                  hint: l.findItemHint,
                  controller: _q,
                  textCapitalization: TextCapitalization.characters,
                  autocorrect: false,
                  textInputAction: TextInputAction.search,
                  onSubmitted: (_) => _load(),
                  suffix: IconButton(tooltip: l.search, icon: const Icon(Icons.search), onPressed: _load),
                ),
                const SizedBox(height: 12),
                GovDropdown<String>(
                  label: l.status,
                  value: _status,
                  items: [
                    DropdownMenuItem(value: '', child: Text(l.allStatuses)),
                    for (final s in itemStatuses) DropdownMenuItem(value: s, child: Text(statusLabel(l, s))),
                  ],
                  onChanged: (v) {
                    setState(() => _status = v ?? '');
                    _load();
                  },
                ),
                const SizedBox(height: 12),
                SecondaryButton(label: l.scanToFind, icon: Icons.qr_code_scanner, onPressed: _scan),
              ],
            ),
          ),
          if (_error != null) ErrorState(error: _error!, onRetry: _load),
          if (_rows == null && _error == null) const LoadingView(),
          if (_loading && _rows != null) const LinearProgressIndicator(),
          if (_rows != null && _rows!.isEmpty) EmptyState(title: l.noItemsFound, icon: Icons.search_off),
          if (_rows != null && _rows!.isNotEmpty) Text(l.itemsShown(_rows!.length), style: t.bodySmall),
          for (final r in _rows ?? const <Map<String, dynamic>>[])
            Card(
              child: InkWell(
                onTap: () async {
                  await Navigator.push(context,
                      MaterialPageRoute(builder: (_) => ItemDetailScreen(trackingId: r['tracking_id'] as String)));
                  _load();
                },
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      IconBadge(statusIcon(r['status'] as String?), hue: statusHue(r['status'] as String?), size: 46),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            MonoText('${r['tracking_id']}', size: 14.5, color: GovColors.navy900),
                            const SizedBox(height: 4),
                            Text(
                              [
                                (r['recipient'] as Map?)?['name'],
                                (r['recipient'] as Map?)?['city'],
                              ].where((x) => x != null && '$x'.isNotEmpty).join(', '),
                              style: t.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                            ),
                            Text(l.acceptedAt(formatDateTime(r['accepted_at'], locale)), style: t.bodySmall),
                            const SizedBox(height: 8),
                            StatusPill(r['status'] as String?),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right_rounded, color: GovColors.grey500),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
