import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/app_state.dart';
import '../../core/format.dart';
import '../../l10n/l10n.dart';
import '../../theme/gov_theme.dart';
import '../../widgets/gov_widgets.dart';
import 'intake_progress.dart';
import 'intake_wizard_screen.dart';

/// Counter intake home: start a registration or continue an open draft (FR02).
class DraftsScreen extends StatefulWidget {
  const DraftsScreen({super.key});

  @override
  State<DraftsScreen> createState() => _DraftsScreenState();
}

class _DraftsScreenState extends State<DraftsScreen> {
  late final AppState _state = context.read<AppState>();
  List<Map<String, dynamic>>? _drafts;
  Map<String, dynamic>? _caps;
  Object? _error;
  bool _creating = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await _state.api.get('/api/intake/drafts') as List;
      if (!mounted) return;
      setState(() {
        _drafts = [for (final d in list) Map<String, dynamic>.from(d as Map)];
        _error = null;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    }
    try {
      final caps = await _state.api.get('/api/intake/capabilities') as Map;
      if (mounted) setState(() => _caps = Map<String, dynamic>.from(caps));
    } on ApiException {
      // Only used for a hint.
    }
  }

  Future<void> _open(String id) async {
    await Navigator.push(context, MaterialPageRoute(builder: (_) => IntakeWizardScreen(draftId: id)));
    await _load();
  }

  Future<void> _create() async {
    setState(() => _creating = true);
    try {
      final d = await _state.api.post('/api/intake/drafts') as Map;
      if (mounted) await _open(d['_id'] as String);
    } on ApiException catch (e) {
      if (mounted) showMessage(context, describeError(context, e));
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  Future<void> _cancel(Map draft) async {
    final l = context.l10n;
    final ok = await confirmAction(context,
        title: l.deleteDraftTitle, message: l.deleteDraftBody, confirmLabel: l.deleteDraft, danger: true);
    if (!ok || !mounted) return;
    try {
      await _state.api.post('/api/intake/drafts/${draft['_id']}/cancel');
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
    final ocrOk = (_caps?['ocr'] as Map?)?['available'] == true || (_caps?['handwriting_model'] as Map?)?['available'] == true;

    return Scaffold(
      appBar: GovAppBar(title: l.taskRegister),
      body: PageBody(
        onRefresh: _load,
        children: [
          Text(l.intakeIntro, style: t.bodyMedium),
          PrimaryButton(label: l.registerNewLetter, icon: Icons.post_add, busy: _creating, onPressed: _create),
          if (_caps != null && !ocrOk) GovNotice(tone: Tone.warning, title: l.ocrUnavailableTitle, message: l.ocrUnavailableBody),
          SectionHeading(l.draftsInProgress),
          if (_error != null) ErrorState(error: _error!, onRetry: _load),
          if (_drafts == null && _error == null) const LoadingView(),
          if (_drafts != null && _drafts!.isEmpty) EmptyState(title: l.noDrafts, message: l.noDraftsHint),
          for (final d in _drafts ?? const <Map<String, dynamic>>[])
            Builder(builder: (context) {
              final progress = intakeProgress(d);
              final done = progress.where((x) => x).length;
              final r = (d['recipient'] as Map?) ?? const {};
              final who = [r['name'], r['city']].where((x) => x != null && '$x'.isNotEmpty).join(', ');
              return SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(child: MonoText('${d['_id']}')),
                        StatusTag(l.stepsDone(done, 5), tone: done >= 4 ? Tone.success : Tone.info),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(who.isEmpty ? l.noAddressYet : who, style: t.bodyMedium),
                    Text(l.startedAt(formatDateTime(d['created_at'], locale)), style: t.bodySmall),
                    const SizedBox(height: 4),
                    LinearProgressIndicator(
                      value: done / 5,
                      minHeight: 6,
                      backgroundColor: GovColors.grey100,
                      borderRadius: BorderRadius.circular(3),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: FilledButton(onPressed: () => _open(d['_id'] as String), child: Text(l.continueDraft)),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton(
                            style: OutlinedButton.styleFrom(
                                foregroundColor: GovColors.error, side: const BorderSide(color: GovColors.error, width: 1.5)),
                            onPressed: () => _cancel(d),
                            child: Text(l.deleteDraft),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}
