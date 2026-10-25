// End-to-end contract test: drives the app's own API client, intake
// controller and offline sync service against a running PostAssist backend.
// Skipped unless a server is given:
//
//   flutter test test/backend_contract_test.dart
//     --dart-define=PA_SERVER=http://127.0.0.1:8001 --dart-define=PA_PASSWORD=<DEMO_PASSWORD>
//
// It registers real items, so point it at a separate test database
// (see Documents/Flutter_Mobile_App_Guide.md, "Contract test").
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:postassist_mobile/core/api_client.dart';
import 'package:postassist_mobile/core/tracking_id.dart';
import 'package:postassist_mobile/data/scan_queue.dart';
import 'package:postassist_mobile/data/sync_service.dart';
import 'package:postassist_mobile/features/intake/intake_controller.dart';
import 'package:uuid/uuid.dart';

const server = String.fromEnvironment('PA_SERVER');
const password = String.fromEnvironment('PA_PASSWORD');

/// The SQLite queue's behaviour, kept in memory.
class MemoryQueue extends ScanQueue {
  final rows = <String, Map<String, Object?>>{};

  @override
  Future<void> enqueue(Map<String, dynamic> event, {required String username}) async {
    rows[event['event_id'] as String] = {
      'event_id': event['event_id'],
      'item_id': event['item_id'],
      'requested_status': event['requested_status'],
      'username': username,
      'payload': jsonEncode(event),
      'captured_at': event['captured_at'],
      'state': 'pending',
      'attempts': 0,
    };
  }

  @override
  Future<List<QueuedScan>> pending({required String username, int limit = 50}) async => [
        for (final r in rows.values)
          if (r['state'] == 'pending' && r['username'] == username) QueuedScan.fromRow(r),
      ];

  @override
  Future<QueuedScan?> get(String eventId) async => rows[eventId] == null ? null : QueuedScan.fromRow(rows[eventId]!);

  @override
  Future<void> markResult(String eventId, {required String state, String? decision, String? message}) async {
    rows[eventId]!.addAll({'state': state, 'decision': decision, 'message': message});
  }

  @override
  Future<void> markAttemptFailed(List<String> eventIds, String error) async {
    for (final id in eventIds) {
      rows[id]!['last_error'] = error;
    }
  }
}

final _http = http.Client();

Future<ApiClient> signIn(String username) async {
  final res = await ApiClient(baseUrl: server, httpClient: _http)
      .post('/api/auth/login', body: {'username': username, 'password': password}) as Map;
  return ApiClient(baseUrl: server, token: res['token'] as String, httpClient: _http);
}

/// A scan event exactly as RecordScanScreen builds it.
Map<String, dynamic> scanEvent(String id, String status, {Map<String, dynamic>? ack, String reason = ''}) => {
      'event_id': const Uuid().v4(),
      'item_id': id,
      'requested_status': status,
      'captured_at': DateTime.now().toUtc().toIso8601String(),
      'expected_revision': null,
      'device_id': 'contract-test',
      'client_version': 'pa-mobile-test',
      'offline': false,
      // Malabe Post Office trial reference point (backend/app/seed.py), 8 m accuracy
      'location': {
        'latitude': 6.91470,
        'longitude': 79.97290,
        'accuracy_m': 8.0,
        'altitude_m': 10.0,
        'fix_age_s': 1.0,
        'mock': false,
        'permission': 'granted',
        'provider': 'contract-test',
      },
      'reason': reason,
      'exception_reason': '',
      'notes': '',
      'acknowledgement': ?ack,
    };

void main() {
  final skip = server.isEmpty || password.isEmpty ? 'set PA_SERVER and PA_PASSWORD to run' : null;
  late String trackingId;
  late String trackingLink;

  test('counter officer registers a letter through the intake controller', () async {
    final api = await signIn('counter2');
    final draft = await api.post('/api/intake/drafts') as Map;
    final c = IntakeController(api, draft['_id'] as String);
    await c.load();
    expect(c.open, isTrue);
    expect(c.offices, isNotEmpty);

    await c.parseText('recipient', 'A. B. Perera\n12 Temple Road\nMalabe 10115');
    await c.parseText('sender', 'K. Silva\n45 Main Street\nKaduwela 10640');
    expect(c.recipient.value('name'), isNotEmpty, reason: 'parser should fill the recipient name');
    // The officer corrects / completes whatever the parser left out.
    if (c.recipient.value('city').isEmpty) c.recipient['city'].text = 'Malabe';
    if (c.recipient.value('street').isEmpty) c.recipient['street'].text = 'Temple Road';
    if (c.sender.value('name').isEmpty) c.sender['name'].text = 'K. Silva';
    if (c.sender.value('city').isEmpty) c.sender['city'].text = 'Kaduwela';
    if (c.sender.value('street').isEmpty) c.sender['street'].text = 'Main Street';
    c.setDestination('MLB-PO');
    c.contact.text = 'sender@example.test';
    c.setNotification(channel: 'email', language: 'si', updates: 'key');

    await c.confirmDetails();
    expect(c.confirmed, isTrue);

    await c.manualWeight(12.0, 'approved counter scale no. 2', 'contract test - IoT scale not used');
    expect(c.weight?['grams'], 12.0);

    await c.requestQuote(adviceOfDelivery: true);
    expect(c.quote?['status'], 'ok', reason: '${c.quote}');
    trackingId = await c.accept(method: 'cash', reference: 'CT-1');
    expect(isValidTrackingId(trackingId), isTrue);
    c.dispose();

    final label = await api.get('/api/items/$trackingId/label') as Map;
    trackingLink = label['tracking_link'] as String;
    await api.post('/api/items/$trackingId/label/printed');
    final verify = await api.post('/api/items/$trackingId/label/verify', body: {'scanned_value': trackingId}) as Map;
    expect(verify['ok'], isTrue);
  }, skip: skip);

  test('the sender tracks the letter from the receipt QR', () async {
    final code = parseScannedCode(trackingLink);
    expect(code.trackingId, trackingId);
    expect(code.token, isNotNull);
    final res = await ApiClient(baseUrl: server, httpClient: _http).get('/api/public/track/${code.trackingId}',
        headers: {'X-Tracking-Token': code.token!}) as Map;
    expect(res['status'], 'accepted');
    // A wrong access code gives the same "not found" as an unknown ID.
    await expectLater(
      ApiClient(baseUrl: server, httpClient: _http)
          .get('/api/public/track/${code.trackingId}', headers: {'X-Tracking-Token': 'wrong'}),
      throwsA(isA<ApiException>().having((e) => e.status, 'status', 404)),
    );
  }, skip: skip);

  test('hub and postman scans upload through the offline queue, once', () async {
    final queue = MemoryQueue();
    final sync = SyncService(queue);

    final hub = await signIn('hub2');
    final lookup = await hub.get('/api/scans/lookup/$trackingId') as Map;
    expect([for (final s in lookup['allowed_statuses'] as List) s['status']], contains('dispatched'));

    for (final status in ['dispatched', 'at_destination_office']) {
      final e = scanEvent(trackingId, status);
      await queue.enqueue(e, username: 'hubdemo');
      final summary = await sync.syncNow(hub, 'hubdemo');
      expect(summary.error, isNull);
      final row = await queue.get(e['event_id'] as String);
      expect(row!.state, anyOf('accepted', 'held'), reason: '$status: ${row.message}');
    }

    final postman = await signIn('postman2');
    final out = scanEvent(trackingId, 'out_for_delivery');
    await queue.enqueue(out, username: 'postman2');
    await sync.syncNow(postman, 'postman2');
    expect((await queue.get(out['event_id'] as String))!.state, 'accepted');

    final delivered = scanEvent(trackingId, 'delivered', ack: {
      'type': 'signature',
      'recipient_name': 'A. B. Perera',
      'relationship': 'self',
      'reference': '',
      'signature_svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160"><path d="M10,10 L300,150"/></svg>',
    });
    await queue.enqueue(delivered, username: 'postman2');
    await sync.syncNow(postman, 'postman2');
    expect((await queue.get(delivered['event_id'] as String))!.state, anyOf('accepted', 'held'));

    // Replaying the same event (e.g. after a lost response) must not create a second one.
    queue.rows[out['event_id']]!['state'] = 'pending';
    await sync.syncNow(postman, 'postman2');
    expect((await queue.get(out['event_id'] as String))!.state, 'duplicate');

    // A scan for the wrong role is a durable rejection, not a retry.
    final wrong = scanEvent(trackingId, 'dispatched');
    await queue.enqueue(wrong, username: 'postman2');
    await sync.syncNow(postman, 'postman2');
    expect((await queue.get(wrong['event_id'] as String))!.state, 'rejected');
  }, skip: skip);

  test('postmaster screens read their data', () async {
    final pm = await signIn('pm2');
    final item = await pm.get('/api/items/$trackingId') as Map;
    expect((item['events'] as List).length, greaterThanOrEqualTo(4));
    expect(await pm.get('/api/reports/summary'), contains('items_by_status'));
    expect(await pm.get('/api/review/held'), isA<List>());
    expect(await pm.get('/api/review/flagged'), isA<List>());
    expect(await pm.get('/api/notifications'), contains('entries'));
    expect(await pm.get('/api/review/audit', query: {'target': trackingId}), isNotEmpty);
    expect(await pm.get('/api/admin/offices'), isNotEmpty);
    expect(await pm.get('/api/devices'), isA<List>());
    final users = await pm.get('/api/admin/users') as List;
    expect(users.where((u) => u['role'] == 'postman'), isNotEmpty);
  }, skip: skip);
}
