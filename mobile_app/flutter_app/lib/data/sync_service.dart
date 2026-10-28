// Uploads pending scans in capture order to POST /api/scans/batch.
// Idempotent: the same event_id is sent on every retry, so the server can
// never store a scan twice (backend: services/scan_events.py, test T12).
import '../core/api_client.dart';
import 'scan_queue.dart';

class SyncSummary {
  int sent = 0;
  int accepted = 0;
  int held = 0;
  int rejected = 0;
  int duplicate = 0;
  int failed = 0;
  String? error;
  bool networkError = false;
}

class SyncService {
  SyncService(this.queue);

  final ScanQueue queue;
  Future<SyncSummary>? _running;

  static const batchSize = 50;

  /// One upload at a time; a second caller waits for the running one.
  Future<SyncSummary> syncNow(ApiClient api, String username) {
    return _running ??= _sync(api, username).whenComplete(() => _running = null);
  }

  Future<SyncSummary> _sync(ApiClient api, String username) async {
    final summary = SyncSummary();
    while (true) {
      final batch = await queue.pending(username: username, limit: batchSize);
      if (batch.isEmpty) return summary;
      Map<String, dynamic> res;
      try {
        res = Map<String, dynamic>.from(await api.post('/api/scans/batch',
            body: {'events': [for (final b in batch) b.payload]}, timeout: const Duration(seconds: 40)) as Map);
      } on ApiException catch (e) {
        // Network or server failure: nothing is lost, the events stay pending.
        await queue.markAttemptFailed([for (final b in batch) b.eventId], e.message);
        summary
          ..failed += batch.length
          ..error = e.message
          ..networkError = e.isNetwork;
        return summary;
      }
      var progressed = false;
      for (final raw in (res['results'] as List? ?? const [])) {
        final r = Map<String, dynamic>.from(raw as Map);
        summary.sent++;
        final reasons = ApiException.problemTexts(r['reasons']);
        final code = (r['reasons'] as List?)?.isNotEmpty == true ? (r['reasons'] as List).first['code'] : null;
        if ((r['http_status'] as int? ?? 200) >= 500 || code == 'CONFLICT') {
          // Not a durable answer (server error or concurrent update): retry later.
          summary.failed++;
          await queue.markAttemptFailed([r['event_id'] as String], reasons.join('; '));
          continue;
        }
        final decision = r['decision'] as String? ?? 'rejected';
        final state = decision == 'held_for_review' ? 'held' : decision;
        switch (state) {
          case 'accepted':
            summary.accepted++;
          case 'held':
            summary.held++;
          case 'duplicate':
            summary.duplicate++;
          default:
            summary.rejected++;
        }
        await queue.markResult(r['event_id'] as String, state: state, decision: decision, message: reasons.join('; '));
        progressed = true;
      }
      if (batch.length < batchSize || !progressed) return summary;
    }
  }
}
