// Sender tracking (FR15): the receipt QR holds the tracking link
// .../track/<ID>#t=<code>. The access code is sent in the X-Tracking-Token
// header; a wrong code and an unknown ID give the same "not found" answer.
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/app_state.dart';
import '../../core/labels.dart';
import '../../core/tracking_id.dart';
import '../../l10n/l10n.dart';
import '../../theme/gov_theme.dart';
import '../../widgets/gov_widgets.dart';
import '../../widgets/status_progress.dart';
import '../../widgets/timeline.dart';
import '../scan/scanner_screen.dart';

class PublicTrackScreen extends StatefulWidget {
  const PublicTrackScreen({super.key});

  @override
  State<PublicTrackScreen> createState() => _PublicTrackScreenState();
}

class _PublicTrackScreenState extends State<PublicTrackScreen> {
  final _id = TextEditingController();
  final _code = TextEditingController();
  Map<String, dynamic>? _result;
  Object? _error;
  bool _notFound = false;
  bool _busy = false;
  Map<String, String> _fieldErrors = {};
  final _scroll = ScrollController();

  @override
  void dispose() {
    _id.dispose();
    _code.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _scan() async {
    final l = context.l10n;
    final code = await Navigator.push<ScannedCode>(
      context,
      MaterialPageRoute(builder: (_) => ScannerScreen(title: l.scanReceipt, instruction: l.scanReceiptInstruction)),
    );
    if (code == null) return;
    _id.text = code.trackingId;
    if (code.token != null) _code.text = code.token!;
    if (code.token != null) await _track();
  }

  Future<void> _track() async {
    final l = context.l10n;
    final errors = <String, String>{
      if (!isValidTrackingId(_id.text)) 'id': l.errTrackingIdInvalid,
      if (_code.text.trim().isEmpty) 'code': l.errAccessCodeRequired,
    };
    setState(() {
      _fieldErrors = errors;
      _error = null;
      _notFound = false;
    });
    if (errors.isNotEmpty) return scrollToTop(_scroll);
    setState(() => _busy = true);
    final id = normalizeTrackingId(_id.text);
    try {
      final res = await context.read<AppState>().publicApi().get('/api/public/track/${Uri.encodeComponent(id)}',
          headers: {'X-Tracking-Token': _code.text.trim()});
      if (mounted) setState(() => _result = Map<String, dynamic>.from(res as Map));
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _result = null;
          _notFound = e.status == 404;
          _error = e;
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final r = _result;
    return Scaffold(
      appBar: GovAppBar(title: l.trackALetter, public: true),
      body: PageBody(controller: _scroll, children: [
        Text(l.trackIntro, style: t.bodyMedium),
        ProblemSummary(errors: _fieldErrors.values.toList()),
        SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              PrimaryButton(label: l.scanReceiptQr, icon: Icons.qr_code_scanner, onPressed: _scan),
              const SizedBox(height: 16),
              Text(l.orTypeDetails, style: t.labelMedium),
              const SizedBox(height: 10),
              GovTextField(
                label: l.trackingId,
                hint: l.trackingIdHint,
                controller: _id,
                errorText: _fieldErrors['id'],
                textCapitalization: TextCapitalization.characters,
                autocorrect: false,
              ),
              const SizedBox(height: 12),
              GovTextField(
                label: l.accessCode,
                hint: l.accessCodeHint,
                controller: _code,
                errorText: _fieldErrors['code'],
                autocorrect: false,
              ),
              const SizedBox(height: 14),
              SecondaryButton(label: l.showStatus, icon: Icons.search, busy: _busy, onPressed: _track),
            ],
          ),
        ),
        if (_notFound)
          GovNotice(tone: Tone.error, title: l.trackNotFoundTitle, message: l.trackNotFoundBody)
        else if (_error != null)
          ErrorState(error: _error!, onRetry: _track),
        if (r != null) ...[
          SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                MonoText('${r['tracking_id']}', size: 18, color: GovColors.navy900),
                const SizedBox(height: 6),
                StatusTag(statusLabel(l, r['status'] as String?), tone: statusTone(r['status'] as String?)),
                const SizedBox(height: 14),
                StatusProgress(status: '${r['status']}'),
                const SizedBox(height: 12),
                KeyValueRow(l.acceptedOn, r['accepted_local'] as String?),
                KeyValueRow(l.fromOffice, r['origin_office'] as String?),
                KeyValueRow(l.destinationTown, r['destination_town'] as String?),
              ],
            ),
          ),
          SectionCard(
            title: l.history,
            child: Timeline(entries: [
              for (final e in (r['events'] as List? ?? const []).cast<Map>())
                TimelineEntry(
                  title: statusLabel(l, e['status'] as String?),
                  time: '${e['captured_local'] ?? ''}',
                  tone: statusTone(e['status'] as String?),
                  lines: [
                    if ('${e['place'] ?? ''}'.isNotEmpty) '${e['place']}',
                    if (e['synchronised_later'] == true) l.syncedLater('${e['received_local'] ?? ''}'),
                    if (e['history_only'] == true) l.historyOnly,
                  ],
                ),
            ]),
          ),
          GovNotice(tone: Tone.info, message: l.trackPrivacyNotice),
        ],
      ]),
    );
  }
}
