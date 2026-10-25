// Finger signature for a delivered scan, sent to the server as a small SVG
// (AcknowledgementIn.signature_svg, max 60 000 characters).
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import '../l10n/l10n.dart';
import '../theme/gov_theme.dart';

/// SVG of the strokes, scaled into a 320 x 160 view box. Empty when nothing was drawn.
String signatureSvg(List<List<Offset>> strokes, Size size) {
  final drawn = strokes.where((s) => s.isNotEmpty).toList();
  if (drawn.isEmpty || size.isEmpty) return '';
  final sx = 320 / size.width;
  final sy = 160 / size.height;
  String pt(Offset o) => '${(o.dx * sx).toStringAsFixed(1)},${(o.dy * sy).toStringAsFixed(1)}';
  final d = drawn.map((s) => 'M${pt(s.first)}${s.skip(1).map((o) => ' L${pt(o)}').join()}').join(' ');
  final svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160">'
      '<path d="$d" stroke="black" fill="none" stroke-width="2"/></svg>';
  if (svg.length <= 58000) return svg;
  // Too detailed for the server limit (60 000 characters): keep every other point.
  final thinned = [
    for (final s in drawn) [for (var i = 0; i < s.length; i++) if (i.isEven || i == s.length - 1) s[i]],
  ];
  int count(List<List<Offset>> x) => x.fold(0, (n, s) => n + s.length);
  return count(thinned) < count(drawn) ? signatureSvg(thinned, size) : svg;
}

class SignaturePad extends StatefulWidget {
  const SignaturePad({super.key, required this.onChanged, this.height = 170});

  final ValueChanged<String> onChanged;
  final double height;

  @override
  State<SignaturePad> createState() => _SignaturePadState();
}

class _SignaturePadState extends State<SignaturePad> {
  final List<List<Offset>> _strokes = [];
  Size _size = Size.zero;

  void _emit() => widget.onChanged(signatureSvg(_strokes, _size));

  void _start(DragStartDetails d) => setState(() => _strokes.add([d.localPosition]));

  void _update(DragUpdateDetails d) {
    // Skip points closer than 2 px: same line, smaller upload.
    if ((d.localPosition - _strokes.last.last).distance < 2) return;
    setState(() => _strokes.last.add(d.localPosition));
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          label: l.signatureArea,
          child: LayoutBuilder(builder: (context, constraints) {
            _size = Size(constraints.maxWidth, widget.height);
            return Container(
              height: widget.height,
              decoration: BoxDecoration(
                color: GovColors.white,
                border: Border.all(color: GovColors.grey600, width: 1.5),
                borderRadius: BorderRadius.circular(GovTheme.radius),
              ),
              child: ClipRect(
                child: RawGestureDetector(
                  // Claims the drag at once, so the page does not scroll while signing.
                  gestures: {
                    _ImmediatePanRecognizer: GestureRecognizerFactoryWithHandlers<_ImmediatePanRecognizer>(
                      _ImmediatePanRecognizer.new,
                      (r) => r
                        ..onStart = _start
                        ..onUpdate = _update
                        ..onEnd = (_) => _emit(),
                    ),
                  },
                  child: CustomPaint(
                    painter: _SignaturePainter(_strokes),
                    child: _strokes.isEmpty
                        ? Center(child: Text(l.signHere, style: const TextStyle(color: GovColors.grey500)))
                        : const SizedBox.expand(),
                  ),
                ),
              ),
            );
          }),
        ),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: _strokes.isEmpty
                ? null
                : () {
                    setState(_strokes.clear);
                    widget.onChanged('');
                  },
            icon: const Icon(Icons.clear),
            label: Text(l.clearSignature),
          ),
        ),
      ],
    );
  }
}

class _ImmediatePanRecognizer extends PanGestureRecognizer {
  @override
  void addAllowedPointer(PointerDownEvent event) {
    super.addAllowedPointer(event);
    resolve(GestureDisposition.accepted);
  }
}

class _SignaturePainter extends CustomPainter {
  _SignaturePainter(this.strokes);

  final List<List<Offset>> strokes;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.black
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;
    for (final s in strokes) {
      if (s.length == 1) {
        canvas.drawCircle(s.first, 1.5, paint..style = PaintingStyle.fill);
        paint.style = PaintingStyle.stroke;
        continue;
      }
      final path = Path()..moveTo(s.first.dx, s.first.dy);
      for (final o in s.skip(1)) {
        path.lineTo(o.dx, o.dy);
      }
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _SignaturePainter oldDelegate) => true;
}
