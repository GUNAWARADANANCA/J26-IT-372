// Step 1: photograph the envelope (phone camera, gallery or the scale's
// ESP32-CAM) and let the server read the address (OCR / handwriting model),
// or type/paste the address and let the trained parser split it into fields.
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/labels.dart';
import '../../../l10n/l10n.dart';
import '../../../theme/gov_theme.dart';
import '../../../widgets/gov_widgets.dart';
import '../intake_controller.dart';

class PhotoStep extends StatefulWidget {
  const PhotoStep({super.key, required this.c});

  final IntakeController c;

  @override
  State<PhotoStep> createState() => _PhotoStepState();
}

class _PhotoStepState extends State<PhotoStep> {
  IntakeController get c => widget.c;
  final _typed = TextEditingController();
  int _rotate = 0;
  String _target = 'recipient';
  String _writing = 'auto';
  String _script = 'auto';
  String? _busy;
  Object? _error;
  Map? _quality;
  Map<String, dynamic>? _read;

  @override
  void dispose() {
    _typed.dispose();
    super.dispose();
  }

  Future<void> _run(String label, Future<void> Function() fn) async {
    setState(() {
      _busy = label;
      _error = null;
    });
    try {
      await fn();
    } catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _pick(ImageSource source) => _run('upload', () async {
        final x = await ImagePicker().pickImage(source: source, maxWidth: 2400, maxHeight: 2400, imageQuality: 90);
        if (x == null) return;
        final res = await c.uploadImage(x.path);
        if (mounted) {
          setState(() {
            _quality = res['quality'] as Map?;
            _rotate = 0;
            _read = null;
          });
        }
      });

  Future<void> _capture(String deviceId) => _run('capture', () async {
        final res = await c.captureFromScale(deviceId);
        if (mounted) {
          setState(() {
            _quality = res['quality'] as Map?;
            _rotate = 0;
            _read = null;
          });
        }
      });

  Future<void> _readAddress() => _run('ocr', () async {
        final res = await c.readAddress(target: _target, rotate: _rotate, writing: _writing, scriptHint: _script);
        if (mounted) setState(() => _read = res);
      });

  Future<void> _parseTyped() => _run('parse', () async {
        final text = _typed.text.trim();
        if (text.isEmpty) return;
        final res = await c.parseText(_target, text);
        if (mounted) setState(() => _read = {'text': text, 'parse': res, 'reader': 'typed'});
      });

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final imageId = c.draft?['current_image_id'] as String?;
    final deviceId = c.devices.isEmpty ? null : c.devices.first['device_id'] as String?;
    final busy = _busy != null;
    final issues = (_quality?['issues'] as List?)?.cast<Map>() ?? const <Map>[];

    return PageBody(children: [
      GovNotice(tone: Tone.info, title: l.stepPhotoTitle, message: l.nextPhoto),
      GovDropdown<String>(
        label: l.captureMode,
        hint: l.captureModeHint,
        value: c.experimentConfig,
        items: [
          DropdownMenuItem(value: 'P1', child: Text(l.modeP1)),
          DropdownMenuItem(value: 'B1', child: Text(l.modeB1)),
          DropdownMenuItem(value: 'B0', child: Text(l.modeB0)),
        ],
        onChanged: busy
            ? null
            : (v) {
                if (v != null) _run('mode', () => c.setExperimentConfig(v));
              },
      ),
      SectionCard(
        title: l.envelopePhoto,
        subtitle: c.experimentConfig == 'B0' ? l.photoOptionalB0 : l.envelopePhotoHint,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            PrimaryButton(
              label: l.takePhoto,
              icon: Icons.photo_camera_outlined,
              busy: _busy == 'upload',
              onPressed: busy ? null : () => _pick(ImageSource.camera),
            ),
            const SizedBox(height: 10),
            SecondaryButton(
              label: l.chooseFromGallery,
              icon: Icons.photo_library_outlined,
              onPressed: busy ? null : () => _pick(ImageSource.gallery),
            ),
            if (deviceId != null) ...[
              const SizedBox(height: 10),
              SecondaryButton(
                label: l.captureFromScale,
                icon: Icons.camera_outdoor_outlined,
                busy: _busy == 'capture',
                onPressed: busy ? null : () => _capture(deviceId),
              ),
            ],
            const SizedBox(height: 14),
            if (imageId == null)
              EmptyState(title: l.noPhotoYet, message: l.noPhotoYetHint, icon: Icons.photo_camera_outlined)
            else ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: Container(
                  color: GovColors.grey100,
                  constraints: const BoxConstraints(maxHeight: 320),
                  child: RotatedBox(
                    quarterTurns: _rotate ~/ 90,
                    child: Image.network(
                      c.api.uri('/api/intake/images/$imageId').toString(),
                      key: ValueKey(imageId),
                      headers: c.api.authHeaders,
                      fit: BoxFit.contain,
                      semanticLabel: l.envelopePhoto,
                      errorBuilder: (_, _, _) => Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(l.photoNotLoaded, textAlign: TextAlign.center),
                      ),
                    ),
                  ),
                ),
              ),
              Row(
                children: [
                  TextButton.icon(
                    onPressed: () => setState(() => _rotate = (_rotate + 270) % 360),
                    icon: const Icon(Icons.rotate_left),
                    label: Text(l.rotateLeft),
                  ),
                  TextButton.icon(
                    onPressed: () => setState(() => _rotate = (_rotate + 90) % 360),
                    icon: const Icon(Icons.rotate_right),
                    label: Text(l.rotateRight),
                  ),
                ],
              ),
            ],
            if (issues.isNotEmpty)
              GovNotice(
                tone: Tone.warning,
                title: l.photoQualityTitle,
                children: [for (final i in issues) Text('• ${qualityIssue(l, i)}')],
              ),
          ],
        ),
      ),
      if (_error != null) ErrorState(error: _error!),
      SectionCard(
        title: l.readAddressTitle,
        subtitle: l.readAddressHint,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            FieldLabel(l.readFor),
            SegmentedButton<String>(
              showSelectedIcon: false,
              segments: [
                ButtonSegment(value: 'recipient', label: Text(l.recipient)),
                ButtonSegment(value: 'sender', label: Text(l.sender)),
              ],
              selected: {_target},
              onSelectionChanged: (s) => setState(() => _target = s.first),
            ),
            const SizedBox(height: 12),
            FieldLabel(l.handwriting),
            SegmentedButton<String>(
              showSelectedIcon: false,
              segments: [
                ButtonSegment(value: 'auto', label: Text(l.writingAuto)),
                ButtonSegment(value: 'handwritten', label: Text(l.writingHand)),
                ButtonSegment(value: 'printed', label: Text(l.writingPrinted)),
              ],
              selected: {_writing},
              onSelectionChanged: (s) => setState(() => _writing = s.first),
            ),
            const SizedBox(height: 12),
            GovDropdown<String>(
              label: l.addressLanguage,
              value: _script,
              items: [
                DropdownMenuItem(value: 'auto', child: Text(l.detectAutomatically)),
                for (final code in ['si', 'ta', 'en']) DropdownMenuItem(value: code, child: Text(languageName(code))),
              ],
              onChanged: (v) => setState(() => _script = v ?? 'auto'),
            ),
            const SizedBox(height: 14),
            PrimaryButton(
              label: l.readAddress,
              icon: Icons.document_scanner_outlined,
              busy: _busy == 'ocr',
              onPressed: busy || imageId == null || c.experimentConfig == 'B0' ? null : _readAddress,
            ),
            const Divider(height: 32),
            GovTextField(
              label: l.typeOrPaste,
              hint: l.typeOrPasteHint,
              controller: _typed,
              maxLines: 5,
              minLines: 3,
            ),
            const SizedBox(height: 10),
            SecondaryButton(
              label: l.fillFromText,
              icon: Icons.auto_fix_high_outlined,
              busy: _busy == 'parse',
              onPressed: busy ? null : _parseTyped,
            ),
          ],
        ),
      ),
      if (_read != null) _ReadResult(result: _read!, target: _target),
    ]);
  }
}

class _ReadResult extends StatelessWidget {
  const _ReadResult({required this.result, required this.target});

  final Map<String, dynamic> result;
  final String target;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final parse = (result['parse'] as Map?) ?? const {};
    final conf = ((parse['confidence'] as Map?) ?? const {}).values.whereType<num>().toList();
    final mean = conf.isEmpty ? null : (100 * conf.reduce((a, b) => a + b) / conf.length).round();
    final review = (parse['needs_review'] as List?) ?? const [];
    final reader = result['reader'] as String?;
    return SectionCard(
      title: l.readResultTitle,
      subtitle: target == 'sender' ? l.sender : l.recipient,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(spacing: 8, runSpacing: 6, children: [
            if (mean != null) StatusTag(l.fieldConfidence(mean), tone: Tone.info),
            review.isEmpty
                ? StatusTag(l.noFlags, tone: Tone.success)
                : StatusTag(l.fieldsToCheck(review.length), tone: Tone.warning),
            if (reader == 'handwriting') StatusTag(l.handwritingModel, tone: Tone.neutral),
            if (reader == 'tesseract') StatusTag(l.printedTextReader, tone: Tone.neutral),
          ]),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: GovColors.grey100, borderRadius: BorderRadius.circular(6)),
            child: Text('${result['text'] ?? ''}', style: const TextStyle(fontSize: 15, height: 1.5)),
          ),
          const SizedBox(height: 8),
          Text(l.readResultNext, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}
