// Record a new status for one registered letter (FR10-FR13).
//
// The scan is saved on the phone first (with its location read once, at the
// moment of saving) and then uploaded; without network it waits in the queue.
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';

import '../../core/api_client.dart';
import '../../core/app_state.dart';
import '../../core/labels.dart';
import '../../core/models.dart';
import '../../data/scan_queue.dart';
import '../../l10n/l10n.dart';
import '../../theme/gov_theme.dart';
import '../../widgets/gov_widgets.dart';
import '../../widgets/signature_pad.dart';
import '../../widgets/status_progress.dart';

/// Preset reasons for an attempted delivery or a return. The English text is
/// what the postmaster sees; the label is shown in the worker's language.
const attemptReasons = [
  'Recipient not available',
  'Premises closed',
  'Address not found',
  'Recipient refused',
  'Unsafe access',
];

String attemptReasonLabel(AppLocalizations l, String reason) => switch (reason) {
      'Recipient not available' => l.reasonNotAvailable,
      'Premises closed' => l.reasonClosed,
      'Address not found' => l.reasonAddressNotFound,
      'Recipient refused' => l.reasonRefused,
      'Unsafe access' => l.reasonUnsafe,
      _ => reason,
    };

class RecordScanScreen extends StatefulWidget {
  const RecordScanScreen({super.key, required this.trackingId});

  final String trackingId;

  @override
  State<RecordScanScreen> createState() => _RecordScanScreenState();
}

class _RecordScanScreenState extends State<RecordScanScreen> {
  late final AppState _state = context.read<AppState>();
  Map<String, dynamic>? _info;
  bool _loading = true;
  bool _offline = false;
  Object? _blocking; // 404 / 403: this worker cannot scan this item

  String _status = '';
  String _ackType = 'signature';
  final _recipientName = TextEditingController();
  final _relationship = TextEditingController();
  final _reference = TextEditingController();
  final _reason = TextEditingController();
  final _exception = TextEditingController();
  final _notes = TextEditingController();
  final _scroll = ScrollController();
  String _signature = '';
  bool _showException = false;

  String? _phase; // 'location' | 'saving'
  List<String> _errors = [];
  _Outcome? _outcome;

  @override
  void initState() {
    super.initState();
    _lookup();
  }

  @override
  void dispose() {
    for (final c in [_recipientName, _relationship, _reference, _reason, _exception, _notes]) {
      c.dispose();
    }
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _lookup() async {
    setState(() {
      _loading = true;
      _blocking = null;
    });
    try {
      final info = Map<String, dynamic>.from(await _state.api.get(
          '/api/scans/lookup/${Uri.encodeComponent(widget.trackingId)}',
          timeout: const Duration(seconds: 6)) as Map);
      if (!mounted) return;
      final allowed = (info['allowed_statuses'] as List? ?? const []);
      setState(() {
        _info = info;
        _offline = false;
        _status = allowed.length == 1 ? (allowed.first as Map)['status'] as String : '';
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.status == 404 || e.status == 403) {
        setState(() => _blocking = e);
      } else {
        setState(() => _offline = true); // the server will check the scan when it arrives
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<StatusOption> get _options {
    if (_info != null) {
      return [
        for (final s in _info!['allowed_statuses'] as List)
          StatusOption.fromJson(Map<String, dynamic>.from(s as Map)),
      ];
    }
    return _state.user?.statuses ?? const [];
  }

  bool get _needsAck => _status == 'delivered' && (_info?['requires_acknowledgement'] as bool? ?? true);
  bool get _needsReason => _status == 'delivery_attempted' || _status == 'return_started';
  bool get _usingException => _showException && _exception.text.trim().isNotEmpty;

  List<String> _validate(AppLocalizations l) {
    final errors = <String>[];
    if (_status.isEmpty) errors.add(l.errChooseStatus);
    if (_needsReason && _reason.text.trim().length < 3) errors.add(l.errReasonRequired);
    if (_needsAck) {
      if (_usingException) {
        if (_exception.text.trim().length < 5) errors.add(l.errExceptionTooShort);
      } else if (_ackType == 'signature') {
        if (_recipientName.text.trim().isEmpty) errors.add(l.errRecipientNameRequired);
        if (_signature.isEmpty) errors.add(l.errSignatureRequired);
      } else if (_ackType == 'recipient_name') {
        if (_recipientName.text.trim().isEmpty) errors.add(l.errRecipientNameRequired);
      } else if (_reference.text.trim().isEmpty) {
        errors.add(l.errSheetRequired);
      }
    }
    return errors;
  }

  Future<void> _save() async {
    final l = context.l10n;
    final errors = _validate(l);
    setState(() => _errors = errors);
    if (errors.isNotEmpty) return scrollToTop(_scroll);
    final user = _state.user!;

    setState(() => _phase = 'location');
    final location = await _state.location.captureFix();
    if (!mounted) return;
    setState(() => _phase = 'saving');

    final eventId = const Uuid().v4();
    final event = <String, dynamic>{
      'event_id': eventId,
      'item_id': _info?['tracking_id'] ?? widget.trackingId,
      'requested_status': _status,
      'captured_at': DateTime.now().toUtc().toIso8601String(),
      'expected_revision': _info?['revision'],
      'device_id': _state.deviceId,
      'client_version': AppState.clientVersion,
      'offline': _offline,
      'location': location,
      'reason': _needsReason ? _reason.text.trim() : '',
      'exception_reason': _needsAck && _usingException ? _exception.text.trim() : '',
      'notes': _notes.text.trim(),
      if (_needsAck && !_usingException)
        'acknowledgement': {
          'type': _ackType,
          'recipient_name': _ackType == 'paper_sheet' ? '' : _recipientName.text.trim(),
          'relationship': _relationship.text.trim(),
          'reference': _ackType == 'paper_sheet' ? _reference.text.trim() : '',
          'signature_svg': _ackType == 'signature' ? _signature : '',
        },
    };
    try {
      await _state.queue.enqueue(event, username: user.username); // durable first
      await _state.syncNow();
      final row = await _state.queue.get(eventId);
      if (mounted) setState(() => _outcome = _Outcome(event, row, location));
    } catch (e) {
      if (mounted) setState(() => _errors = [describeError(context, e)]);
    } finally {
      if (mounted) setState(() => _phase = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return PopScope(
      canPop: _phase == null,
      child: Scaffold(
        appBar: GovAppBar(title: _outcome == null ? l.recordStatus : l.scanSaved),
        body: _loading
            ? LoadingView(message: l.lookingUpItem)
            : _outcome != null
                ? _OutcomeView(outcome: _outcome!)
                : _blocking != null
                    ? _BlockedView(error: _blocking!, trackingId: widget.trackingId)
                    : _form(l),
      ),
    );
  }

  Widget _form(AppLocalizations l) {
    final t = Theme.of(context).textTheme;
    final info = _info;
    final options = _options;
    final recipient = info?['recipient'] as Map?;
    final busy = _phase != null;

    final current = info?['status'] as String?;
    return PageBody(controller: _scroll, children: [
      ProblemSummary(errors: _errors),
      SectionCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                IconBadge(_offline ? Icons.cloud_off_rounded : statusIcon(current),
                    hue: _offline ? Hue.orange : statusHue(current), size: 52),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      MonoText(info?['tracking_id'] as String? ?? widget.trackingId, size: 17, color: GovColors.navy900),
                      const SizedBox(height: 4),
                      if (!_offline && info != null) StatusPill(current),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (_offline)
              GovNotice(tone: Tone.warning, title: l.offlineModeTitle, message: l.offlineModeBody)
            else if (info != null) ...[
              StatusProgress(status: info['status'] as String, direction: info['direction'] as String? ?? 'forward'),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(color: GovColors.page, borderRadius: BorderRadius.circular(12)),
                child: Column(
                  children: [
                    KeyValueRow(l.destinationOffice, info['destination_office'] as String?),
                    KeyValueRow(l.destinationTown, info['destination_town'] as String?),
                    if (info['assigned_postman'] != null)
                      KeyValueRow(l.assignedPostman, info['assigned_postman'] as String?),
                  ],
                ),
              ),
            ],
            if (recipient != null) ...[
              const SizedBox(height: 14),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const IconBadge(Icons.home_outlined, hue: Hue.teal, size: 40, circle: true),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(l.deliverTo, style: t.labelSmall),
                        Text('${recipient['name'] ?? ''}', style: t.titleSmall),
                        Text([
                          recipient['house_number'],
                          recipient['street'],
                          recipient['locality'],
                          recipient['city'],
                          recipient['postcode'],
                        ].where((v) => v != null && '$v'.isNotEmpty).join(', ')),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
      if (options.isEmpty)
        GovNotice(tone: Tone.info, title: l.nothingToRecordTitle, message: l.nothingToRecordBody)
      else
        SectionCard(
          icon: Icons.touch_app_outlined,
          title: l.newStatus,
          subtitle: l.newStatusHint,
          child: Column(
            children: [
              for (final o in options) ...[
                ChoiceTile(
                  title: statusLabel(l, o.status),
                  icon: statusIcon(o.status),
                  hue: statusHue(o.status),
                  selected: _status == o.status,
                  onTap: busy ? null : () => setState(() => _status = o.status),
                ),
                const SizedBox(height: 10),
              ],
            ],
          ),
        ),
      if (_needsReason)
        SectionCard(
          icon: Icons.help_outline_rounded,
          hue: Hue.orange,
          title: l.reasonTitle,
          subtitle: l.reasonHint,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final r in attemptReasons)
                    ChoiceChip(
                      label: Text(attemptReasonLabel(l, r)),
                      selected: _reason.text == r,
                      onSelected: busy ? null : (_) => setState(() => _reason.text = r),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              GovTextField(label: l.otherReason, controller: _reason, onChanged: (_) => setState(() {})),
            ],
          ),
        ),
      if (_needsAck)
        SectionCard(
          icon: Icons.draw_outlined,
          hue: Hue.green,
          title: l.ackTitle,
          subtitle: l.ackHint,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SegmentedButton<String>(
                showSelectedIcon: false,
                segments: [
                  ButtonSegment(value: 'signature', label: Text(l.ackSignature)),
                  ButtonSegment(value: 'recipient_name', label: Text(l.ackNameOnly)),
                  ButtonSegment(value: 'paper_sheet', label: Text(l.ackSheet)),
                ],
                selected: {_ackType},
                onSelectionChanged: busy ? null : (s) => setState(() => _ackType = s.first),
              ),
              const SizedBox(height: 14),
              if (_ackType != 'paper_sheet') ...[
                GovTextField(label: l.receivedBy, controller: _recipientName, textCapitalization: TextCapitalization.words),
                const SizedBox(height: 12),
                GovTextField(label: l.relationship, hint: l.relationshipHint, controller: _relationship, optional: true),
                const SizedBox(height: 12),
              ],
              if (_ackType == 'paper_sheet') ...[
                GovTextField(label: l.sheetNumber, controller: _reference),
                const SizedBox(height: 12),
              ],
              if (_ackType == 'signature') ...[
                FieldLabel(l.signature, hint: l.signatureHint),
                SignaturePad(onChanged: (svg) => setState(() => _signature = svg)),
              ],
              const Divider(height: 24),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _showException,
                onChanged: busy ? null : (v) => setState(() => _showException = v),
                title: Text(l.noAckPossible),
                subtitle: Text(l.noAckPossibleHint),
              ),
              if (_showException)
                GovTextField(
                  label: l.exceptionReason,
                  controller: _exception,
                  maxLines: 3,
                  minLines: 2,
                  onChanged: (_) => setState(() {}),
                ),
            ],
          ),
        ),
      SectionCard(
        child: GovTextField(label: l.notes, controller: _notes, optional: true, maxLines: 3, minLines: 1),
      ),
      GovNotice(tone: Tone.info, message: l.locationNotice),
      PrimaryButton(
        label: switch (_phase) {
          'location' => l.readingLocation,
          'saving' => l.saving,
          _ => l.saveScan,
        },
        icon: Icons.save_outlined,
        busy: busy,
        onPressed: options.isEmpty ? null : _save,
      ),
      if (busy) Text(_phase == 'location' ? l.readingLocation : l.saving, textAlign: TextAlign.center),
      SecondaryButton(label: l.cancel, onPressed: busy ? null : () => Navigator.pop(context, false)),
    ]);
  }
}

class _Outcome {
  _Outcome(this.event, this.row, this.location);

  final Map<String, dynamic> event;
  final QueuedScan? row;
  final Map<String, dynamic> location;
}

class _OutcomeView extends StatelessWidget {
  const _OutcomeView({required this.outcome});

  final _Outcome outcome;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final state = outcome.row?.state ?? 'pending';
    final (Tone tone, String title, String body) = switch (state) {
      'accepted' => (Tone.success, l.outcomeAcceptedTitle, l.outcomeAcceptedBody),
      'duplicate' => (Tone.success, l.outcomeDuplicateTitle, l.outcomeDuplicateBody),
      'held' => (Tone.warning, l.outcomeHeldTitle, l.outcomeHeldBody),
      'rejected' => (Tone.error, l.outcomeRejectedTitle, l.outcomeRejectedBody),
      _ => (Tone.info, l.outcomePendingTitle, l.outcomePendingBody),
    };
    final loc = outcome.location;
    final String locText;
    if (loc['latitude'] != null) {
      locText = l.locationQuality(
          ((loc['accuracy_m'] as num?) ?? 0).round(), ((loc['fix_age_s'] as num?) ?? 0).round());
    } else {
      locText = switch (loc['permission']) {
        'denied' => l.locDenied,
        'timeout' => l.locTimeout,
        _ => l.locUnavailable,
      };
    }
    final t = Theme.of(context).textTheme;
    final icon = switch (state) {
      'accepted' || 'duplicate' => Icons.check_rounded,
      'held' => Icons.hourglass_top_rounded,
      'rejected' => Icons.close_rounded,
      _ => Icons.cloud_upload_outlined,
    };
    return PageBody(children: [
      Semantics(
        container: true,
        liveRegion: true,
        child: Card(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 28, 20, 22),
            child: Column(
              children: [
                TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0.6, end: 1),
                  duration: const Duration(milliseconds: 420),
                  curve: Curves.easeOutBack,
                  builder: (_, s, child) => Transform.scale(scale: s, child: child),
                  child: Container(
                    width: 92,
                    height: 92,
                    decoration: BoxDecoration(color: tone.tint, shape: BoxShape.circle),
                    alignment: Alignment.center,
                    child: Container(
                      width: 66,
                      height: 66,
                      decoration: BoxDecoration(color: tone.fg, shape: BoxShape.circle),
                      child: Icon(icon, color: GovColors.white, size: 38),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(title, style: t.titleLarge?.copyWith(color: tone.fg), textAlign: TextAlign.center),
                const SizedBox(height: 6),
                Text(body, style: t.bodyMedium, textAlign: TextAlign.center),
                if ((outcome.row?.message ?? '').isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(outcome.row!.message!,
                      style: const TextStyle(fontWeight: FontWeight.w600), textAlign: TextAlign.center),
                ],
                const SizedBox(height: 14),
                MonoText('${outcome.event['item_id']}', size: 16, color: GovColors.navy900),
              ],
            ),
          ),
        ),
      ),
      SectionCard(
        child: Column(
          children: [
            Align(alignment: Alignment.centerLeft, child: StatusPill(outcome.event['requested_status'] as String?, large: true)),
            const SizedBox(height: 8),
            KeyValueRow(l.statusRecorded, statusLabel(l, outcome.event['requested_status'] as String?)),
            KeyValueRow(l.locationEvidence, locText),
            if (loc['mock'] == true) KeyValueRow('', l.mockLocationWarning),
          ],
        ),
      ),
      PrimaryButton(label: l.scanNext, icon: Icons.qr_code_scanner, onPressed: () => Navigator.pop(context, true)),
      SecondaryButton(label: l.done, onPressed: () => Navigator.pop(context, false)),
    ]);
  }
}

class _BlockedView extends StatelessWidget {
  const _BlockedView({required this.error, required this.trackingId});

  final Object error;
  final String trackingId;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final notFound = error is ApiException && (error as ApiException).status == 404;
    return PageBody(children: [
      Row(
        children: [
          IconBadge(notFound ? Icons.search_off_rounded : Icons.block_rounded, hue: Hue.rose, size: 48),
          const SizedBox(width: 12),
          Expanded(child: MonoText(trackingId, size: 17, color: GovColors.navy900)),
        ],
      ),
      GovNotice(
        tone: Tone.error,
        title: notFound ? l.itemNotFoundTitle : l.notAllowedTitle,
        message: describeError(context, error),
      ),
      PrimaryButton(label: l.scanAnother, icon: Icons.qr_code_scanner, onPressed: () => Navigator.pop(context, true)),
      SecondaryButton(label: l.back, onPressed: () => Navigator.pop(context, false)),
    ]);
  }
}
