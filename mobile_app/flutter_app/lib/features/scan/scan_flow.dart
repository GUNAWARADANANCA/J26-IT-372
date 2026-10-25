import 'package:flutter/material.dart';

import '../../core/tracking_id.dart';
import 'record_scan_screen.dart';
import 'scanner_screen.dart';

/// Scan a label, record its new status, and offer the next scan - until the
/// worker chooses "Done".
Future<void> scanAndRecord(BuildContext context) async {
  final nav = Navigator.of(context);
  while (true) {
    final code = await nav.push<ScannedCode>(MaterialPageRoute(builder: (_) => const ScannerScreen()));
    if (code == null) return;
    final next = await nav.push<bool>(MaterialPageRoute(builder: (_) => RecordScanScreen(trackingId: code.trackingId)));
    if (next != true) return;
  }
}

/// Record a status for an item that is already known (from the item page).
Future<void> recordFor(BuildContext context, String trackingId) =>
    Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => RecordScanScreen(trackingId: trackingId)));
