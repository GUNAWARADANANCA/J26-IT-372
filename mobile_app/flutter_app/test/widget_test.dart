import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:postassist_mobile/app.dart';
import 'package:postassist_mobile/core/app_state.dart';
import 'package:postassist_mobile/data/scan_queue.dart';
import 'package:postassist_mobile/features/auth/login_screen.dart';
import 'package:postassist_mobile/features/home/home_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Queue without SQLite (no platform plugins in widget tests).
class _FakeQueue extends ScanQueue {
  @override
  Future<QueueCounts> counts({String? username}) async => const QueueCounts({'pending': 2});

  @override
  Future<List<QueuedScan>> pending({required String username, int limit = 50}) async => [];

  @override
  Future<int> pruneUploaded({int days = 14}) async => 0;
}

Future<AppState> _state({Map<String, String> secure = const {}, String? locale}) async {
  SharedPreferences.setMockInitialValues({'locale': ?locale});
  FlutterSecureStorage.setMockInitialValues(secure);
  final state = AppState(
    prefs: await SharedPreferences.getInstance(),
    queue: _FakeQueue(),
    httpClient: MockClient((_) async => http.Response('{"detail": "offline in tests"}', 503)),
    connectivity: const Stream.empty(),
  );
  await state.load();
  return state;
}

/// Unmounts the app and stops the state's background timer before the test ends.
Future<void> _finish(WidgetTester tester, AppState state) async {
  await tester.pumpWidget(const SizedBox());
  state.dispose();
}

Map<String, String> _signedIn(String role) => {
      'token': 'test-token',
      'user': jsonEncode({
        'username': 'u_$role',
        'full_name': 'Test $role',
        'role': role,
        'office_id': 'MLB-PO',
        'office_name': 'Malabe Post Office',
        'statuses': [],
      }),
    };

void main() {
  for (final locale in ['en', 'si', 'ta']) {
    testWidgets('sign-in screen renders in $locale without layout errors', (tester) async {
      final state = await _state(locale: locale);
      await tester.pumpWidget(PostAssistApp(state: state));
      await tester.pumpAndSettle();
      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.text('සිංහල'), findsOneWidget);
      expect(find.text('தமிழ்'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('sign-in shows an error summary for empty fields', (tester) async {
    final state = await _state(locale: 'en');
    await tester.pumpWidget(PostAssistApp(state: state));
    await tester.pumpAndSettle();
    final button = find.widgetWithText(FilledButton, 'Sign in');
    await tester.ensureVisible(button);
    await tester.pumpAndSettle();
    await tester.tap(button);
    await tester.pumpAndSettle();
    expect(find.text('There is a problem'), findsOneWidget);
    expect(find.text('Enter your password'), findsWidgets);
  });

  const roleTiles = {
    'counter_officer': ['Register a letter', 'Sender messages', 'Scale and camera'],
    'hub_officer': ['Scan a letter', 'My scans'],
    'postman': ['Scan a letter', 'My scans'],
    'postmaster': ['Review queue', 'Audit log', 'Offices and zones'],
  };
  roleTiles.forEach((role, tiles) {
    testWidgets('home screen for $role shows its tasks', (tester) async {
      // A tall phone screen, so every task tile is built without scrolling.
      tester.view.physicalSize = const Size(1080, 8000);
      tester.view.devicePixelRatio = 2.75;
      addTearDown(tester.view.reset);
      final state = await _state(secure: _signedIn(role), locale: 'en');
      await tester.pumpWidget(PostAssistApp(state: state));
      await tester.pumpAndSettle();
      expect(find.byType(HomeScreen), findsOneWidget);
      for (final t in tiles) {
        expect(find.text(t), findsWidgets, reason: '$role should see "$t"');
      }
      expect(tester.takeException(), isNull);
      await _finish(tester, state);
    });
  });

  testWidgets('postman does not see counter or supervision tasks', (tester) async {
    tester.view.physicalSize = const Size(1080, 8000);
    tester.view.devicePixelRatio = 2.75;
    addTearDown(tester.view.reset);
    final state = await _state(secure: _signedIn('postman'), locale: 'en');
    await tester.pumpWidget(PostAssistApp(state: state));
    await tester.pumpAndSettle();
    expect(find.text('Register a letter'), findsNothing);
    expect(find.text('Review queue'), findsNothing);
    await _finish(tester, state);
  });

  testWidgets('home screen fits at 200 % text size in Sinhala', (tester) async {
    tester.platformDispatcher.textScaleFactorTestValue = 2.0;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    final state = await _state(secure: _signedIn('postmaster'), locale: 'si');
    await tester.pumpWidget(PostAssistApp(state: state));
    await tester.pumpAndSettle();
    expect(find.byType(HomeScreen), findsOneWidget);
    expect(tester.takeException(), isNull);
    await _finish(tester, state);
  });
}
