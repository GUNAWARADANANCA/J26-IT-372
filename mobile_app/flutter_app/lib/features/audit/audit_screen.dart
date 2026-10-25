import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/app_state.dart';
import '../../core/format.dart';
import '../../core/labels.dart';
import '../../l10n/l10n.dart';
import '../../widgets/gov_widgets.dart';

/// Append-only audit log (who did what to which record), newest first.
class AuditScreen extends StatefulWidget {
  const AuditScreen({super.key});

  @override
  State<AuditScreen> createState() => _AuditScreenState();
}

class _AuditScreenState extends State<AuditScreen> {
  final _target = TextEditingController();
  String _severity = '';
  List<Map>? _rows;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _target.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final res = await context.read<AppState>().api.get('/api/review/audit', query: {
        'target': _target.text.trim(),
        'severity': _severity,
        'limit': '150',
      }) as List;
      if (mounted) {
        setState(() {
          _rows = res.cast<Map>();
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
    final t = Theme.of(context).textTheme;
    final locale = Localizations.localeOf(context).toLanguageTag();
    return Scaffold(
      appBar: GovAppBar(title: l.taskAudit),
      body: PageBody(
        onRefresh: _load,
        children: [
          SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                GovTextField(
                  label: l.auditTarget,
                  hint: l.auditTargetHint,
                  controller: _target,
                  optional: true,
                  autocorrect: false,
                  textInputAction: TextInputAction.search,
                  onSubmitted: (_) => _load(),
                ),
                const SizedBox(height: 12),
                GovDropdown<String>(
                  label: l.severity,
                  value: _severity,
                  items: [
                    DropdownMenuItem(value: '', child: Text(l.allSeverities)),
                    for (final s in ['info', 'warning', 'security']) DropdownMenuItem(value: s, child: Text(severityLabel(l, s))),
                  ],
                  onChanged: (v) {
                    setState(() => _severity = v ?? '');
                    _load();
                  },
                ),
                const SizedBox(height: 12),
                SecondaryButton(label: l.search, icon: Icons.search, onPressed: _load),
              ],
            ),
          ),
          if (_error != null) ErrorState(error: _error!, onRetry: _load),
          if (_rows == null && _error == null) const LoadingView(),
          if (_rows != null && _rows!.isEmpty) EmptyState(title: l.noAuditEntries),
          for (final r in _rows ?? const <Map>[])
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Expanded(child: Text('${r['action']}', style: t.titleSmall)),
                      StatusTag(severityLabel(l, r['severity'] as String?), tone: severityTone(r['severity'] as String?)),
                    ]),
                    Text('${r['actor']} → ${r['target']}', style: t.bodyMedium),
                    Text(formatDateTime(r['at'], locale), style: t.bodySmall),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
