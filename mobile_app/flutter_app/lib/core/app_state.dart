// App-wide state: server address, signed-in staff member, language,
// connectivity and the offline scan queue with its automatic upload.
import 'dart:async';
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import '../data/location_service.dart';
import '../data/scan_queue.dart';
import '../data/sync_service.dart';
import 'api_client.dart';
import 'models.dart';

class AppState extends ChangeNotifier with WidgetsBindingObserver {
  AppState({
    required this._prefs,
    this._secure = const FlutterSecureStorage(),
    ScanQueue? queue,
    http.Client? httpClient,
    this.location = const LocationService(),
    Stream<List<ConnectivityResult>>? connectivity,
  })  : queue = queue ?? ScanQueue(),
        _http = httpClient ?? http.Client(),
        _connectivityChanges = connectivity;

  static const appVersion = '1.0.0';
  static const clientVersion = 'pa-mobile-$appVersion';
  static const defaultServer = 'http://192.168.1.10:8000';

  final SharedPreferences _prefs;
  final FlutterSecureStorage _secure;
  final http.Client _http;
  final ScanQueue queue;
  final LocationService location;
  final Stream<List<ConnectivityResult>>? _connectivityChanges; // injected in tests
  late final SyncService _sync = SyncService(queue);

  /// Root navigator, so a sign-out can close every open screen.
  final navigatorKey = GlobalKey<NavigatorState>();

  String server = defaultServer;
  String? _token;
  StaffUser? user;
  Locale? locale;
  String deviceId = '';

  bool online = true;
  bool syncing = false;
  bool sessionExpired = false;
  QueueCounts counts = QueueCounts.empty;
  SyncSummary? lastSync;

  StreamSubscription<List<ConnectivityResult>>? _connectivity;
  Timer? _timer;
  bool _observing = false;

  bool get isSignedIn => _token != null && user != null;

  /// Pre-fills the sign-in form (after a sign-out or an expired session).
  String get lastUsername => _prefs.getString('last_username') ?? '';

  /// Plain HTTP is accepted for a lab network only; the UI warns about it.
  bool get insecureConnection => server.trim().toLowerCase().startsWith('http://');

  ApiClient get api => ApiClient(baseUrl: server, token: _token, httpClient: _http, onUnauthorized: _expired);

  /// Client without a token, for the public tracking page and connection tests.
  ApiClient publicApi([String? baseUrl]) => ApiClient(baseUrl: baseUrl ?? server, httpClient: _http);

  static Future<AppState> create() async {
    final state = AppState(prefs: await SharedPreferences.getInstance());
    await state.load();
    return state;
  }

  Future<void> load() async {
    server = _prefs.getString('server') ?? defaultServer;
    final code = _prefs.getString('locale');
    locale = code == null ? null : Locale(code);
    deviceId = _prefs.getString('device_id') ?? '';
    if (deviceId.isEmpty) {
      deviceId = 'pa-mobile-${const Uuid().v4().substring(0, 8)}';
      await _prefs.setString('device_id', deviceId);
    }
    try {
      _token = await _secure.read(key: 'token');
      final raw = await _secure.read(key: 'user');
      user = raw == null ? null : StaffUser.fromJson(Map<String, dynamic>.from(jsonDecode(raw) as Map));
    } catch (_) {
      _token = null;
      user = null;
    }
    if (isSignedIn) {
      _startBackground();
      unawaited(refreshCounts());
      unawaited(refreshProfile());
    }
  }

  static String normalizeServer(String raw) {
    var s = raw.trim();
    if (s.isEmpty) return s;
    if (!s.contains('://')) s = 'http://$s';
    return s.replaceAll(RegExp(r'/+$'), '');
  }

  Future<void> setServer(String value) async {
    server = normalizeServer(value);
    await _prefs.setString('server', server);
    notifyListeners();
  }

  Future<void> setLocale(Locale? value) async {
    locale = value;
    if (value == null) {
      await _prefs.remove('locale');
    } else {
      await _prefs.setString('locale', value.languageCode);
    }
    notifyListeners();
  }

  /// Health check used by the sign-in screen's "Test connection" button.
  Future<bool> testConnection(String serverUrl) async {
    try {
      final res = await publicApi(normalizeServer(serverUrl)).get('/api/health', timeout: const Duration(seconds: 6));
      return res is Map && res['status'] == 'ok';
    } on ApiException {
      return false;
    }
  }

  Future<void> login(String serverUrl, String username, String password) async {
    final base = normalizeServer(serverUrl);
    final res = Map<String, dynamic>.from(await publicApi(base).post('/api/auth/login',
        body: {'username': username.trim().toLowerCase(), 'password': password}) as Map);
    final token = res['token'] as String;
    final authed = ApiClient(baseUrl: base, token: token, httpClient: _http);
    var u = StaffUser.fromJson(Map<String, dynamic>.from(res['user'] as Map));
    try {
      final me = await authed.get('/api/auth/me') as Map;
      u = u.copyWith(officeName: me['office_name'] as String?);
    } on ApiException {
      // The office name is only cosmetic.
    }
    try {
      final st = await authed.get('/api/scans/statuses') as Map;
      u = u.copyWith(statuses: [
        for (final s in st['statuses'] as List) StatusOption.fromJson(Map<String, dynamic>.from(s as Map)),
      ]);
    } on ApiException {
      // Offline choices fall back to an empty list.
    }
    server = base;
    _token = token;
    user = u;
    sessionExpired = false;
    await _prefs.setString('server', server);
    await _prefs.setString('last_username', u.username);
    await _secure.write(key: 'token', value: token);
    await _secure.write(key: 'user', value: jsonEncode(u.toJson()));
    _startBackground();
    await refreshCounts();
    notifyListeners();
    unawaited(syncNow());
  }

  /// Sign-out is refused while this worker still has scans waiting to upload,
  /// because they can only be uploaded with this worker's own sign-in.
  Future<void> logout() async {
    _token = null;
    user = null;
    lastSync = null;
    _stopBackground();
    await _secure.delete(key: 'token');
    await _secure.delete(key: 'user');
    navigatorKey.currentState?.popUntil((r) => r.isFirst);
    notifyListeners();
  }

  void _expired() {
    if (_token == null) return;
    // Keep the user's name for the sign-in form; pending scans stay on the phone.
    _token = null;
    sessionExpired = true;
    _stopBackground();
    unawaited(_secure.delete(key: 'token'));
    navigatorKey.currentState?.popUntil((r) => r.isFirst);
    user = null;
    notifyListeners();
  }

  Future<void> refreshProfile() async {
    if (!isSignedIn) return;
    try {
      final me = await api.get('/api/auth/me', timeout: const Duration(seconds: 8)) as Map;
      user = user!.copyWith(officeName: me['office_name'] as String?);
      await _secure.write(key: 'user', value: jsonEncode(user!.toJson()));
      notifyListeners();
    } on ApiException {
      // Offline: keep the cached profile so scanning still works.
    }
  }

  Future<void> refreshCounts() async {
    if (user == null) return;
    counts = await queue.counts(username: user!.username);
    notifyListeners();
  }

  Future<SyncSummary?> syncNow() async {
    if (!isSignedIn) return null;
    syncing = true;
    notifyListeners();
    try {
      lastSync = await _sync.syncNow(api, user!.username);
      return lastSync;
    } finally {
      syncing = false;
      await refreshCounts();
    }
  }

  Future<int> clearUploadedHistory() async {
    final n = await queue.pruneUploaded(days: 0);
    await refreshCounts();
    return n;
  }

  void _startBackground() {
    _connectivity ??= (_connectivityChanges ?? Connectivity().onConnectivityChanged).listen((results) {
      final now = results.any((r) => r != ConnectivityResult.none);
      final cameBack = now && !online;
      online = now;
      notifyListeners();
      if (cameBack) unawaited(syncNow());
    });
    _timer ??= Timer.periodic(const Duration(seconds: 45), (_) {
      if (online && counts.pending > 0 && !syncing) unawaited(syncNow());
    });
    if (!_observing) {
      WidgetsBinding.instance.addObserver(this);
      _observing = true;
    }
    unawaited(queue.pruneUploaded());
  }

  void _stopBackground() {
    _connectivity?.cancel();
    _connectivity = null;
    _timer?.cancel();
    _timer = null;
    if (_observing) {
      WidgetsBinding.instance.removeObserver(this);
      _observing = false;
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && isSignedIn) {
      unawaited(syncNow());
      unawaited(refreshProfile());
    }
  }

  @override
  void dispose() {
    _stopBackground();
    _http.close();
    super.dispose();
  }
}
