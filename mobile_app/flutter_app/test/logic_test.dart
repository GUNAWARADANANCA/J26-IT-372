import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:postassist_mobile/core/format.dart';
import 'package:postassist_mobile/features/intake/intake_progress.dart';
import 'package:postassist_mobile/widgets/signature_pad.dart';

void main() {
  group('intakeProgress', () {
    test('a new draft has nothing done', () {
      expect(intakeProgress({'recipient': {}}), [false, false, false, false, false]);
    });

    test('manual entry (B0) needs no photo; name + town completes the addresses', () {
      final p = intakeProgress({
        'experiment_config': 'B0',
        'recipient': {'name': 'A. Perera', 'city': 'Malabe'},
        'fields_confirmed_at': '2026-10-19T08:00:00',
        'weight': {'grams': 11.4},
      });
      expect(p, [true, true, true, true, false]);
    });
  });

  group('contact checks', () {
    test('Sri Lankan mobile numbers', () {
      expect(validSriLankaMobile('0771234567'), isTrue);
      expect(validSriLankaMobile('+94 77 123 4567'), isTrue);
      expect(validSriLankaMobile('0112345678'), isFalse);
    });

    test('e-mail', () {
      expect(validEmail('name@example.com'), isTrue);
      expect(validEmail('name@'), isFalse);
    });
  });

  group('format', () {
    test('money and grams', () {
      expect(formatMoney('1250.5'), 'Rs. 1,250.50');
      expect(formatMoney(null), '—');
      expect(formatGrams(11.44), '11.4 g');
    });

    test('naive API timestamps are read as UTC', () {
      expect(parseTime('2026-10-19T08:00:00')!.isUtc, isTrue);
      expect(parseTime('2026-10-19T08:00:00+05:30')!.toUtc().hour, 2);
    });
  });

  group('signatureSvg', () {
    test('is empty without strokes', () {
      expect(signatureSvg([], const Size(320, 160)), '');
    });

    test('scales strokes into the 320 x 160 view box', () {
      final svg = signatureSvg([
        [const Offset(0, 0), const Offset(640, 320)],
      ], const Size(640, 320));
      expect(svg, contains('M0.0,0.0 L320.0,160.0'));
    });

    test('stays under the server limit for very long signatures', () {
      final stroke = [for (var i = 0; i < 20000; i++) Offset(i % 300 + 0.5, i % 150 + 0.5)];
      expect(signatureSvg([stroke], const Size(320, 160)).length, lessThanOrEqualTo(60000));
    });
  });
}
