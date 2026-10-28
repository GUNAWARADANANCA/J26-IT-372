// Camera scanner for the Code 128 barcode or QR code on the label (both hold
// only the tracking ID), or the receipt QR (tracking link). A damaged label
// can be typed; the check character catches typing mistakes.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../core/tracking_id.dart';
import '../../l10n/l10n.dart';
import '../../theme/gov_theme.dart';
import '../../widgets/gov_widgets.dart';

class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key, this.title, this.instruction});

  final String? title;
  final String? instruction;

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final _controller = MobileScannerController(
    formats: const [BarcodeFormat.code128, BarcodeFormat.qrCode],
    detectionSpeed: DetectionSpeed.noDuplicates,
  );
  final _manual = TextEditingController();
  String? _manualError;
  String? _lastRejected;
  bool _done = false;

  @override
  void dispose() {
    _controller.dispose();
    _manual.dispose();
    super.dispose();
  }

  void _finish(ScannedCode code) {
    if (_done) return;
    _done = true;
    HapticFeedback.mediumImpact();
    Navigator.pop(context, code);
  }

  void _onDetect(BarcodeCapture capture) {
    for (final b in capture.barcodes) {
      final raw = b.rawValue;
      if (raw == null || raw.trim().isEmpty) continue;
      final code = parseScannedCode(raw);
      if (isValidTrackingId(code.trackingId)) {
        _finish(code);
        return;
      }
      if (_lastRejected != raw) {
        _lastRejected = raw;
        showMessage(context, context.l10n.notAPostAssistCode);
      }
    }
  }

  void _useTyped() {
    final code = parseScannedCode(_manual.text);
    if (!isValidTrackingId(code.trackingId)) {
      setState(() => _manualError = context.l10n.errTrackingIdInvalid);
      return;
    }
    _finish(code);
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Scaffold(
      appBar: GovAppBar(
        title: widget.title ?? l.scanLabel,
        actions: [
          IconButton(
            tooltip: l.torch,
            icon: const Icon(Icons.flashlight_on_outlined),
            onPressed: () => _controller.toggleTorch(),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: Stack(
              fit: StackFit.expand,
              children: [
                MobileScanner(
                  controller: _controller,
                  onDetect: _onDetect,
                  errorBuilder: (context, error) => Container(
                    color: GovColors.navy950,
                    padding: const EdgeInsets.all(24),
                    alignment: Alignment.center,
                    child: Text(
                      error.errorCode == MobileScannerErrorCode.permissionDenied ? l.cameraPermissionNeeded : l.cameraUnavailable,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: GovColors.white, fontSize: 16),
                    ),
                  ),
                ),
                IgnorePointer(
                  child: Center(
                    child: Container(
                      width: 280,
                      height: 170,
                      decoration: BoxDecoration(
                        border: Border.all(color: GovColors.accent, width: 3),
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: 16,
                  right: 16,
                  top: 16,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: GovColors.navy950.withValues(alpha: 0.8),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      widget.instruction ?? l.scanInstruction,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: GovColors.white, fontSize: 15, height: 1.4),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Material(
            color: GovColors.white,
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    GovTextField(
                      label: l.typeTrackingId,
                      hint: l.typeTrackingIdHint,
                      placeholder: 'PA-DEMO-XXXXXXXXXXX',
                      controller: _manual,
                      errorText: _manualError,
                      autocorrect: false,
                      textCapitalization: TextCapitalization.characters,
                      textInputAction: TextInputAction.done,
                      onChanged: (_) => setState(() => _manualError = null),
                      onSubmitted: (_) => _useTyped(),
                    ),
                    const SizedBox(height: 10),
                    PrimaryButton(label: l.useTypedId, icon: Icons.keyboard, onPressed: _useTyped),
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
