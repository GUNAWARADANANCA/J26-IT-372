// Label and sender receipt for an accepted letter (FR08, FR09). The barcode
// and QR on the label hold only the tracking ID; the receipt QR holds the
// sender's tracking link. The officer verifies the printed label by scanning it.
import 'package:barcode_widget/barcode_widget.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/app_state.dart';
import '../../core/format.dart';
import '../../core/labels.dart';
import '../../core/tracking_id.dart';
import '../../l10n/l10n.dart';
import '../../theme/gov_theme.dart';
import '../../widgets/gov_widgets.dart';
import '../items/item_detail_screen.dart';
import '../scan/scanner_screen.dart';

class ReceiptScreen extends StatefulWidget {
  const ReceiptScreen({super.key, required this.trackingId, this.justAccepted = false});

  final String trackingId;
  final bool justAccepted;

  @override
  State<ReceiptScreen> createState() => _ReceiptScreenState();
}

class _ReceiptScreenState extends State<ReceiptScreen> {
  late final AppState _state = context.read<AppState>();
  Map<String, dynamic>? _label;
  Object? _error;
  String? _busy;
  bool? _verified;
  String? _verifyMessage;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _state.api.get('/api/items/${Uri.encodeComponent(widget.trackingId)}/label');
      if (mounted) setState(() => _label = Map<String, dynamic>.from(res as Map));
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _printed() async {
    final l = context.l10n;
    final prints = ((_label?['label'] as Map?)?['prints'] as int?) ?? 0;
    String? reason;
    if (prints > 0) {
      reason = await askReason(context, title: l.reprintTitle, message: l.reprintBody, confirmLabel: l.recordReprint);
      if (reason == null) return;
    }
    setState(() => _busy = 'print');
    try {
      await _state.api.post('/api/items/${widget.trackingId}/label/printed', body: reason == null ? null : {'reason': reason});
      await _load();
      if (mounted) showMessage(context, prints > 0 ? l.reprintRecorded : l.printRecorded);
    } on ApiException catch (e) {
      if (mounted) showMessage(context, describeError(context, e));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _verify() async {
    final l = context.l10n;
    final code = await Navigator.push<ScannedCode>(context,
        MaterialPageRoute(builder: (_) => ScannerScreen(title: l.verifyLabel, instruction: l.verifyLabelInstruction)));
    if (code == null || !mounted) return;
    setState(() => _busy = 'verify');
    try {
      await _state.api.post('/api/items/${widget.trackingId}/label/verify', body: {'scanned_value': code.trackingId});
      if (mounted) {
        setState(() {
          _verified = true;
          _verifyMessage = l.labelVerified;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _verified = false;
          _verifyMessage = e.code == 'LABEL_MISMATCH' ? l.labelMismatch(code.trackingId) : describeError(context, e);
        });
      }
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final d = _label;
    return Scaffold(
      appBar: GovAppBar(title: l.labelAndReceipt),
      body: d == null
          ? (_error == null ? const LoadingView() : PageBody(children: [ErrorState(error: _error!, onRetry: _load)]))
          : PageBody(onRefresh: _load, children: [
              if (widget.justAccepted)
                GovNotice(tone: Tone.success, title: l.letterAccepted, message: l.letterAcceptedBody),
              // The label as it is printed and stuck on the envelope.
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      Text(l.registeredLetter.toUpperCase(),
                          style: t.labelSmall?.copyWith(letterSpacing: 1.2, color: GovColors.grey700)),
                      const SizedBox(height: 10),
                      Container(
                        color: GovColors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        child: BarcodeWidget(
                          barcode: Barcode.code128(),
                          data: '${d['tracking_id']}',
                          height: 72,
                          drawText: false,
                        ),
                      ),
                      const SizedBox(height: 8),
                      MonoText('${d['tracking_id']}', size: 20, color: GovColors.navy900),
                      const SizedBox(height: 12),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          BarcodeWidget(barcode: Barcode.qrCode(), data: '${d['tracking_id']}', width: 96, height: 96),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(l.to, style: t.labelSmall),
                                Text(_recipient(d['recipient'] as Map?), style: t.bodyMedium),
                                const SizedBox(height: 6),
                                Text('${l.fromOffice}: ${d['origin_office'] ?? ''}', style: t.bodySmall),
                                Text('${l.destinationOffice}: ${d['destination_office'] ?? ''}', style: t.bodySmall),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              SectionCard(
                title: l.receiptDetails,
                child: Column(
                  children: [
                    KeyValueRow(l.acceptedOn, d['accepted_local'] as String?),
                    KeyValueRow(l.acceptedBy, d['accepted_by'] as String?),
                    KeyValueRow(l.senderName, d['sender_name'] as String?),
                    KeyValueRow(l.weight, formatGrams((d['weight'] as Map?)?['grams'])),
                    KeyValueRow(l.total, formatMoney((d['quote'] as Map?)?['total_lkr'])),
                    KeyValueRow(l.paidBy, paymentLabel(l, (d['payment'] as Map?)?['method'] as String?)),
                    KeyValueRow(l.tariff, d['tariff_version'] as String?),
                    KeyValueRow(l.labelPrints, '${(d['label'] as Map?)?['prints'] ?? 0}'),
                  ],
                ),
              ),
              SectionCard(
                title: l.senderTracking,
                subtitle: l.senderTrackingHint,
                child: Column(
                  children: [
                    BarcodeWidget(barcode: Barcode.qrCode(), data: '${d['tracking_link']}', width: 150, height: 150),
                    const SizedBox(height: 8),
                    SelectableText('${d['tracking_link']}', textAlign: TextAlign.center, style: t.bodySmall),
                    TextButton.icon(
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: '${d['tracking_link']}'));
                        showMessage(context, l.linkCopied);
                      },
                      icon: const Icon(Icons.copy),
                      label: Text(l.copyLink),
                    ),
                  ],
                ),
              ),
              if (_verified != null)
                GovNotice(tone: _verified! ? Tone.success : Tone.error, message: _verifyMessage),
              PrimaryButton(
                label: l.verifyLabel,
                icon: Icons.qr_code_scanner,
                busy: _busy == 'verify',
                onPressed: _busy == null ? _verify : null,
              ),
              SecondaryButton(
                label: (((d['label'] as Map?)?['prints'] as int?) ?? 0) > 0 ? l.recordReprint : l.markPrinted,
                icon: Icons.print_outlined,
                busy: _busy == 'print',
                onPressed: _busy == null ? _printed : null,
              ),
              Text(l.printNote, style: t.bodySmall),
              SecondaryButton(
                label: l.openItem,
                icon: Icons.open_in_new,
                onPressed: () => Navigator.push(
                    context, MaterialPageRoute(builder: (_) => ItemDetailScreen(trackingId: widget.trackingId))),
              ),
              if (widget.justAccepted)
                SecondaryButton(label: l.registerAnother, icon: Icons.post_add, onPressed: () => Navigator.pop(context)),
            ]),
    );
  }

  String _recipient(Map? r) {
    if (r == null) return '';
    final lines = [
      r['name'],
      [r['house_number'], r['street']].where((x) => x != null && '$x'.isNotEmpty).join(', '),
      r['locality'],
      [r['city'], r['postcode']].where((x) => x != null && '$x'.isNotEmpty).join(' '),
    ];
    return lines.where((x) => x != null && '$x'.isNotEmpty).join('\n');
  }
}
