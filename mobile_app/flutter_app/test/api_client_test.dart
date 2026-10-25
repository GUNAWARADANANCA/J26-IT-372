import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:postassist_mobile/core/api_client.dart';

ApiClient _client(int status, Object body, {void Function()? onUnauthorized}) => ApiClient(
      baseUrl: 'http://server:8000/',
      token: 't0k3n',
      onUnauthorized: onUnauthorized,
      httpClient: MockClient((req) async {
        expect(req.headers['Authorization'], 'Bearer t0k3n');
        return http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json'});
      }),
    );

void main() {
  test('builds URLs without a double slash and drops empty filters', () {
    final c = ApiClient(baseUrl: 'http://server:8000/');
    expect(c.uri('/api/items', {'q': 'PA-1', 'status': ''}).toString(), 'http://server:8000/api/items?q=PA-1');
    expect(c.uri('/api/items', {'status': ''}).toString(), 'http://server:8000/api/items');
  });

  test('decodes JSON on success', () async {
    final res = await _client(200, {'status': 'ok'}).get('/api/health');
    expect(res, {'status': 'ok'});
  });

  test('turns {detail: {code, message, problems}} into ApiException', () async {
    final c = _client(422, {
      'detail': {
        'code': 'FIELDS_INCOMPLETE',
        'message': 'cannot confirm the draft yet',
        'problems': ['recipient name is required', {'code': 'X', 'message': 'scale offline'}],
      },
    });
    final e = await c.post('/api/x').then<ApiException?>((_) => null, onError: (Object e) => e as ApiException);
    expect(e!.status, 422);
    expect(e.code, 'FIELDS_INCOMPLETE');
    expect(e.problems, ['recipient name is required', 'scale offline']);
  });

  test('reads scan decisions with reasons', () async {
    final c = _client(409, {
      'decision': 'rejected',
      'reasons': [
        {'code': 'INVALID_TRANSITION', 'message': "cannot move from 'accepted' to 'delivered'"},
      ],
    });
    final e = await c.post('/api/scans').then<ApiException?>((_) => null, onError: (Object e) => e as ApiException);
    expect(e!.code, 'INVALID_TRANSITION');
    expect(e.message, contains('cannot move'));
  });

  test('reports an expired session once', () async {
    var calls = 0;
    final c = _client(401, {'detail': 'invalid or expired token'}, onUnauthorized: () => calls++);
    await expectLater(c.get('/api/auth/me'), throwsA(isA<ApiException>().having((e) => e.isUnauthorized, '401', true)));
    expect(calls, 1);
  });

  test('marks unreachable servers as network errors', () async {
    final c = ApiClient(
      baseUrl: 'http://server:8000',
      httpClient: MockClient((_) => throw http.ClientException('Connection refused')),
    );
    await expectLater(c.get('/api/health'), throwsA(isA<ApiException>().having((e) => e.isNetwork, 'network', true)));
  });
}
