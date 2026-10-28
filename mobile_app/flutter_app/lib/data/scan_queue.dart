// Durable local queue of scan events (proposal 3.11, FR13, test T11).
//
// An event is written here *before* any upload is attempted, with an
// event_id generated once. Uploads always reuse that id, so a retry after a
// timeout or an app restart can never create a second event on the server.
// An event leaves 'pending' only when the server returns a durable answer
// (accepted, duplicate, held or rejected); network failures keep it pending.
//
// Each row also stores the worker who captured it: the server takes the
// worker's identity from the sign-in token, so a scan is only ever uploaded
// while the same person is signed in.
import 'dart:convert';

import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

class QueuedScan {
  QueuedScan.fromRow(Map<String, Object?> r)
      : eventId = r['event_id'] as String,
        itemId = r['item_id'] as String,
        requestedStatus = r['requested_status'] as String,
        username = r['username'] as String? ?? '',
        capturedAt = DateTime.parse(r['captured_at'] as String),
        state = r['state'] as String,
        decision = r['decision'] as String?,
        message = r['message'] as String?,
        attempts = r['attempts'] as int? ?? 0,
        lastError = r['last_error'] as String?,
        payload = r['payload'] == null ? const {} : Map<String, dynamic>.from(jsonDecode(r['payload'] as String) as Map);

  final String eventId;
  final String itemId;
  final String requestedStatus;
  final String username;
  final DateTime capturedAt;

  /// pending | accepted | duplicate | held | rejected
  final String state;
  final String? decision;
  final String? message;
  final int attempts;
  final String? lastError;
  final Map<String, dynamic> payload;
}

class QueueCounts {
  const QueueCounts(this.byState);

  static const empty = QueueCounts({});

  final Map<String, int> byState;

  int get pending => byState['pending'] ?? 0;
  int get held => byState['held'] ?? 0;
  int get rejected => byState['rejected'] ?? 0;
}

class ScanQueue {
  ScanQueue({this.fileName = 'postassist_field.db'});

  final String fileName;
  Future<Database>? _db;

  Future<Database> get db => _db ??= _open();

  Future<Database> _open() async {
    final dir = await getDatabasesPath();
    return openDatabase(
      p.join(dir, fileName),
      version: 1,
      onCreate: (db, _) async {
        await db.execute('''
          CREATE TABLE scan_queue (
            event_id TEXT PRIMARY KEY NOT NULL,
            item_id TEXT NOT NULL,
            requested_status TEXT NOT NULL,
            username TEXT NOT NULL,
            payload TEXT NOT NULL,
            captured_at TEXT NOT NULL,
            state TEXT NOT NULL DEFAULT 'pending',
            decision TEXT,
            message TEXT,
            attempts INTEGER NOT NULL DEFAULT 0,
            last_error TEXT,
            synced_at TEXT
          )''');
        await db.execute('CREATE INDEX scan_queue_state ON scan_queue(state, captured_at)');
      },
    );
  }

  Future<void> enqueue(Map<String, dynamic> event, {required String username}) async {
    await (await db).insert('scan_queue', {
      'event_id': event['event_id'],
      'item_id': event['item_id'],
      'requested_status': event['requested_status'],
      'username': username,
      'payload': jsonEncode(event),
      'captured_at': event['captured_at'],
    });
  }

  Future<List<QueuedScan>> pending({required String username, int limit = 50}) async {
    final rows = await (await db).query('scan_queue',
        where: "state = 'pending' AND username = ?", whereArgs: [username], orderBy: 'captured_at', limit: limit);
    return rows.map(QueuedScan.fromRow).toList();
  }

  Future<QueuedScan?> get(String eventId) async {
    final rows = await (await db).query('scan_queue', where: 'event_id = ?', whereArgs: [eventId], limit: 1);
    return rows.isEmpty ? null : QueuedScan.fromRow(rows.first);
  }

  Future<void> markResult(String eventId, {required String state, String? decision, String? message}) async {
    await (await db).rawUpdate(
      'UPDATE scan_queue SET state = ?, decision = ?, message = ?, synced_at = ?, attempts = attempts + 1, '
      'last_error = NULL WHERE event_id = ?',
      [state, decision, message, DateTime.now().toUtc().toIso8601String(), eventId],
    );
  }

  Future<void> markAttemptFailed(List<String> eventIds, String error) async {
    final d = await db;
    final text = error.length > 200 ? error.substring(0, 200) : error;
    for (final id in eventIds) {
      await d.rawUpdate('UPDATE scan_queue SET attempts = attempts + 1, last_error = ? WHERE event_id = ?', [text, id]);
    }
  }

  Future<List<QueuedScan>> recent({int limit = 50}) async {
    final rows = await (await db).query('scan_queue', orderBy: 'captured_at DESC', limit: limit);
    return rows.map(QueuedScan.fromRow).toList();
  }

  Future<QueueCounts> counts({String? username}) async {
    final rows = await (await db).rawQuery(
      'SELECT state, COUNT(*) AS n FROM scan_queue ${username == null ? '' : 'WHERE username = ?'} GROUP BY state',
      [?username],
    );
    return QueueCounts({for (final r in rows) r['state'] as String: r['n'] as int});
  }

  /// Uploaded history older than [days] is removed; pending scans are never deleted.
  Future<int> pruneUploaded({int days = 14}) async {
    final cutoff = DateTime.now().toUtc().subtract(Duration(days: days)).toIso8601String();
    return (await db).delete('scan_queue', where: "state != 'pending' AND captured_at < ?", whereArgs: [cutoff]);
  }
}
