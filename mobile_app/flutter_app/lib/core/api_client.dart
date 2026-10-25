// HTTP client for the PostAssist FastAPI backend.
//
// Adds the bearer token, decodes JSON and turns the backend's error shapes
// ({detail: "text"}, {detail: {code, message, problems}}, scan decisions
// {decision, reasons} and FastAPI validation lists) into one ApiException.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

class ApiException implements Exception {
  ApiException(this.status, this.message, {this.code, this.problems = const []});

  /// HTTP status, or 0 when the server could not be reached.
  final int status;
  final String message;
  final String? code;
  final List<String> problems;

  bool get isNetwork => status == 0;
  bool get isUnauthorized => status == 401;

  factory ApiException.network(Object error) => ApiException(0, error.toString(), code: 'NETWORK');

  factory ApiException.fromBody(int status, Object? data) {
    if (data is Map) {
      final detail = data['detail'];
      if (detail is String) return ApiException(status, detail);
      if (detail is Map) {
        return ApiException(status, '${detail['message'] ?? 'HTTP $status'}',
            code: detail['code'] as String?, problems: problemTexts(detail['problems']));
      }
      if (detail is List) {
        // FastAPI validation error: [{loc: [...], msg: "..."}]
        final msgs = [
          for (final e in detail) e is Map ? '${(e['loc'] as List?)?.last ?? ''}: ${e['msg']}' : '$e',
        ];
        return ApiException(status, msgs.join('; '), code: 'VALIDATION', problems: msgs);
      }
      final reasons = data['reasons'];
      if (reasons is List && reasons.isNotEmpty) {
        return ApiException(status, problemTexts(reasons).join('; '),
            code: (reasons.first as Map)['code'] as String?);
      }
    }
    return ApiException(status, 'HTTP $status');
  }

  /// Problems arrive either as strings or as {code, message} objects.
  static List<String> problemTexts(Object? raw) {
    if (raw is! List) return const [];
    return raw.map((p) => p is Map ? '${p['message'] ?? p['code']}' : '$p').toList();
  }

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({required this.baseUrl, this.token, http.Client? httpClient, this.onUnauthorized})
      : _http = httpClient ?? http.Client();

  final String baseUrl;
  final String? token;
  final http.Client _http;
  final void Function()? onUnauthorized;

  static const defaultTimeout = Duration(seconds: 20);

  Map<String, String> get authHeaders => {if (token != null) 'Authorization': 'Bearer $token'};

  Uri uri(String path, [Map<String, String>? query]) {
    final base = baseUrl.trim().replaceAll(RegExp(r'/+$'), '');
    final u = Uri.parse('$base$path');
    // Empty filters are left out, as the web app does.
    final q = {...u.queryParameters, ...?query}..removeWhere((_, v) => v.isEmpty);
    return q.isEmpty ? u : u.replace(queryParameters: q);
  }

  Future<dynamic> get(String path, {Map<String, String>? query, Map<String, String>? headers, Duration? timeout}) =>
      _send('GET', uri(path, query), headers: headers, timeout: timeout);

  Future<dynamic> post(String path, {Object? body, Duration? timeout}) =>
      _send('POST', uri(path), body: body, timeout: timeout);

  Future<dynamic> patch(String path, {Object? body, Duration? timeout}) =>
      _send('PATCH', uri(path), body: body, timeout: timeout);

  /// Multipart upload of an image file (field name `file`, as the backend expects).
  Future<dynamic> uploadFile(String path, String filePath, {Duration timeout = const Duration(seconds: 60)}) async {
    final req = http.MultipartRequest('POST', uri(path))
      ..headers.addAll(authHeaders)
      ..files.add(await http.MultipartFile.fromPath('file', filePath, filename: 'envelope.jpg'));
    try {
      final streamed = await _http.send(req).timeout(timeout);
      final res = await http.Response.fromStream(streamed);
      return _decode(res);
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException.network(e);
    }
  }

  Future<dynamic> _send(String method, Uri url,
      {Object? body, Map<String, String>? headers, Duration? timeout}) async {
    final h = {
      'Accept': 'application/json',
      ...authHeaders,
      if (body != null) 'Content-Type': 'application/json',
      ...?headers,
    };
    final req = http.Request(method, url)..headers.addAll(h);
    if (body != null) req.body = jsonEncode(body);
    try {
      final streamed = await _http.send(req).timeout(timeout ?? defaultTimeout);
      final res = await http.Response.fromStream(streamed);
      return _decode(res);
    } on ApiException {
      rethrow;
    } on SocketException catch (e) {
      throw ApiException.network(e);
    } on TimeoutException catch (e) {
      throw ApiException.network(e);
    } on http.ClientException catch (e) {
      throw ApiException.network(e);
    } on HandshakeException catch (e) {
      throw ApiException.network(e);
    }
  }

  dynamic _decode(http.Response res) {
    final text = utf8.decode(res.bodyBytes);
    Object? data;
    if (text.isNotEmpty) {
      try {
        data = jsonDecode(text);
      } on FormatException {
        data = text;
      }
    }
    if (res.statusCode == 401 && token != null) onUnauthorized?.call();
    if (res.statusCode < 200 || res.statusCode >= 300) throw ApiException.fromBody(res.statusCode, data);
    return data;
  }
}
