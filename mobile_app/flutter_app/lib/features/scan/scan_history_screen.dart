import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/format.dart';
import '../../core/labels.dart';
import '../../data/scan_queue.dart';
import '../../l10n/l10n.dart';
import '../../theme/gov_theme.dart';
import '../../widgets/gov_widgets.dart';

/// Scans saved on this phone, with their upload state and the server's answer.
class ScanHistoryScreen extends StatefulWidget {
  const ScanHistoryScreen({super.key});

  @override
  State<ScanHistoryScreen> createState() => _ScanHistoryScreenState();
}

class _ScanHistoryScreenState extends State<ScanHistoryScreen> {
  List<QueuedScan>? _rows;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final rows = await context.read<AppState>().queue.recent(limit: 100);
    if (mounted) setState(() => _rows = rows);
  }

  Future<void> _upload() async {
    await context.read<AppState>().syncNow();
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final state = context.watch<AppState>();
    final locale = Localizations.localeOf(context).toLanguageTag();
    final rows = _rows;
    final me = state.user?.username;

    return Scaffold(
      appBar: GovAppBar(title: l.taskHistory),
      body: rows == null
          ? const LoadingView()
          : PageBody(
              onRefresh: _load,
              children: [
                GovNotice(tone: Tone.info, message: l.historyIntro),
                SecondaryButton(
                  label: state.syncing ? l.uploading : l.uploadNow,
                  icon: Icons.cloud_upload_outlined,
                  busy: state.syncing,
                  onPressed: state.counts.pending > 0 ? _upload : null,
                ),
                if (rows.isEmpty) EmptyState(title: l.noScansYet, icon: Icons.qr_code_2),
                for (final r in rows)
                  SectionCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(child: MonoText(r.itemId)),
                            StatusTag(decisionLabel(l, r.state == 'pending' ? 'pending' : r.state),
                                tone: decisionTone(r.state)),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text('${statusLabel(l, r.requestedStatus)} · ${formatDateTime(r.capturedAt, locale)}'),
                        if ((r.message ?? '').isNotEmpty)
                          Text(r.message!, style: Theme.of(context).textTheme.bodySmall),
                        if (r.state == 'pending' && r.username != me)
                          Text(l.waitingForUser(r.username),
                              style: const TextStyle(color: GovColors.warning, fontWeight: FontWeight.w600)),
                        if (r.state == 'pending' && r.lastError != null)
                          Text(l.retryPending(r.attempts),
                              style: const TextStyle(color: GovColors.warning, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
              ],
            ),
    );
  }
}
