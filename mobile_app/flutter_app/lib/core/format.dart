// Dates, money and weights in Sri Lankan conventions.
import 'package:intl/intl.dart';

DateTime? parseTime(Object? value) {
  if (value == null) return null;
  if (value is DateTime) return value;
  final text = '$value';
  if (text.isEmpty) return null;
  // The API sends naive UTC ("2026-10-19T08:00:00") or offset timestamps.
  final hasZone = text.endsWith('Z') || RegExp(r'[+-]\d\d:?\d\d$').hasMatch(text);
  return DateTime.tryParse(hasZone ? text : '${text}Z');
}

String _format(String pattern, String locale, DateTime t) {
  try {
    return DateFormat(pattern, locale).format(t);
  } catch (_) {
    return DateFormat(pattern, 'en').format(t); // date symbols for the locale not loaded
  }
}

/// Local date and time, e.g. "19 Oct 2026, 14:05".
String formatDateTime(Object? value, String locale) {
  final t = parseTime(value);
  return t == null ? '—' : _format('d MMM y, HH:mm', locale, t.toLocal());
}

String formatTime(Object? value, String locale) {
  final t = parseTime(value);
  return t == null ? '—' : _format('HH:mm', locale, t.toLocal());
}

String formatToday(String locale) => _format('EEEE, d MMMM y', locale, DateTime.now());

/// "Rs. 1,250.00" (amounts arrive as decimal strings, e.g. "150.00").
String formatMoney(Object? amount) {
  final v = double.tryParse('${amount ?? ''}');
  if (v == null) return '—';
  return 'Rs. ${NumberFormat('#,##0.00', 'en').format(v)}';
}

String formatGrams(Object? grams) {
  final v = double.tryParse('${grams ?? ''}');
  if (v == null) return '—';
  return '${v.toStringAsFixed(1)} g';
}
