// State of one counter registration (draft) while the officer moves through
// the five steps. The draft lives on the server; this keeps the editable
// form fields and saves them back (PATCH) before anything that depends on them.
import 'dart:async';

import 'package:flutter/widgets.dart';

import '../../core/api_client.dart';
import 'intake_progress.dart';

class PartyForm {
  PartyForm(VoidCallback onEdit) : fields = {for (final f in addressFields) f: TextEditingController()} {
    for (final c in fields.values) {
      c.addListener(onEdit);
    }
  }

  final Map<String, TextEditingController> fields;

  TextEditingController operator [](String f) => fields[f]!;

  void load(Map? values) {
    for (final f in addressFields) {
      final v = '${values?[f] ?? ''}';
      if (fields[f]!.text != v) fields[f]!.text = v;
    }
  }

  /// Suggestions only fill empty fields; what the officer typed is never overwritten.
  void fillEmpty(Map suggestion) {
    for (final f in addressFields) {
      final v = '${suggestion[f] ?? ''}'.trim();
      if (v.isNotEmpty && fields[f]!.text.trim().isEmpty) fields[f]!.text = v;
    }
  }

  void useAll(Map suggestion) {
    for (final f in addressFields) {
      final v = '${suggestion[f] ?? ''}'.trim();
      if (v.isNotEmpty) fields[f]!.text = v;
    }
  }

  void clear() {
    for (final c in fields.values) {
      c.clear();
    }
  }

  Map<String, String> toJson() => {for (final f in addressFields) f: fields[f]!.text.trim()};

  String value(String f) => fields[f]!.text.trim();

  void dispose() {
    for (final c in fields.values) {
      c.dispose();
    }
  }
}

class IntakeController extends ChangeNotifier {
  IntakeController(this.api, this.draftId) {
    contact.addListener(_edited);
  }

  final ApiClient api;
  final String draftId;

  Map<String, dynamic>? draft;
  List<Map<String, dynamic>> offices = [];
  List<Map<String, dynamic>> devices = [];
  Object? loadError;

  late final sender = PartyForm(_edited);
  late final recipient = PartyForm(_edited);
  final contact = TextEditingController();
  String channel = 'none';
  String language = 'en';
  String updates = 'key';
  String? destinationOfficeId;
  String experimentConfig = 'P1';

  /// Last OCR / parse result per party (fields, confidence, needs_review, derived).
  final Map<String, Map<String, dynamic>> lastParse = {};
  Map<String, dynamic>? quote;

  bool _applying = false;
  bool _dirty = false;
  bool saving = false;
  bool _disposed = false;

  bool get dirty => _dirty;
  bool get open => draft?['status'] == 'draft';
  bool get confirmed => draft?['fields_confirmed_at'] != null;
  Map<String, dynamic>? get weight => draft?['weight'] == null ? null : Map<String, dynamic>.from(draft!['weight'] as Map);
  List<bool> get progress => draft == null ? List.filled(5, false) : intakeProgress({...draft!, 'recipient': recipient.toJson()});

  PartyForm party(String name) => name == 'sender' ? sender : recipient;

  void _edited() {
    if (_applying) return;
    _dirty = true;
    _notify();
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  Future<void> load() async {
    try {
      final results = await Future.wait([
        api.get('/api/intake/drafts/$draftId'),
        api.get('/api/admin/offices').catchError((_) => <dynamic>[]),
        api.get('/api/devices').catchError((_) => <dynamic>[]),
      ]);
      offices = [for (final o in results[1] as List) Map<String, dynamic>.from(o as Map)];
      devices = [for (final d in results[2] as List) Map<String, dynamic>.from(d as Map)];
      applyDraft(Map<String, dynamic>.from(results[0] as Map), forms: true);
      loadError = null;
    } catch (e) {
      loadError = e;
    }
    _notify();
  }

  void applyDraft(Map<String, dynamic> d, {bool forms = false}) {
    draft = d;
    if (d['quote'] != null) quote = Map<String, dynamic>.from(d['quote'] as Map);
    experimentConfig = d['experiment_config'] as String? ?? 'P1';
    if (forms || !_dirty) {
      _applying = true;
      sender.load(d['sender'] as Map?);
      recipient.load(d['recipient'] as Map?);
      final n = (d['notification'] as Map?) ?? const {};
      channel = n['channel'] as String? ?? 'none';
      contact.text = '${n['contact'] ?? ''}';
      language = n['language'] as String? ?? 'en';
      updates = n['updates'] as String? ?? 'key';
      final dest = d['destination_office_id'] as String?;
      destinationOfficeId = (dest == null || dest.isEmpty) ? null : dest;
      _applying = false;
      _dirty = false;
    }
    _notify();
  }

  Future<void> reload() async {
    applyDraft(Map<String, dynamic>.from(await api.get('/api/intake/drafts/$draftId') as Map));
  }

  void setNotification({String? channel, String? language, String? updates}) {
    if (channel != null) this.channel = channel;
    if (language != null) this.language = language;
    if (updates != null) this.updates = updates;
    _edited();
  }

  void setDestination(String? officeId) {
    destinationOfficeId = officeId;
    _edited();
  }

  Map<String, dynamic> get formBody => {
        'sender': sender.toJson(),
        'recipient': recipient.toJson(),
        'notification': {'channel': channel, 'contact': contact.text.trim(), 'language': language, 'updates': updates},
        'destination_office_id': destinationOfficeId ?? '',
      };

  /// Saves the editable fields when they changed. Editing after confirmation
  /// makes the server ask for confirmation again.
  Future<void> save() async {
    if (!_dirty || !open) return;
    saving = true;
    _notify();
    try {
      final d = await api.patch('/api/intake/drafts/$draftId', body: formBody);
      _dirty = false;
      applyDraft(Map<String, dynamic>.from(d as Map));
    } finally {
      saving = false;
      _notify();
    }
  }

  Future<void> setExperimentConfig(String config) async {
    final d = await api.patch('/api/intake/drafts/$draftId', body: {'experiment_config': config});
    applyDraft(Map<String, dynamic>.from(d as Map));
  }

  // ------------------------------------------------------------------ envelope image and reading
  Future<Map<String, dynamic>> uploadImage(String path) async {
    final res = Map<String, dynamic>.from(await api.uploadFile('/api/intake/drafts/$draftId/image', path) as Map);
    await reload();
    return res;
  }

  /// Asks the scale's camera for a photo and waits for it (up to ~28 s).
  Future<Map<String, dynamic>> captureFromScale(String deviceId) async {
    final req = await api.post('/api/intake/drafts/$draftId/capture', body: {'device_id': deviceId, 'flash': false}) as Map;
    final id = req['capture_id'] as String;
    for (var i = 0; i < 40; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 700));
      final s = Map<String, dynamic>.from(await api.get('/api/intake/captures/$id') as Map);
      if (s['status'] == 'received') {
        await reload();
        return s;
      }
      if (s['status'] == 'failed' || s['status'] == 'expired') {
        throw ApiException(409, 'capture ${s['status']}${s['error'] != null ? ': ${s['error']}' : ''}', code: 'CAPTURE_FAILED');
      }
    }
    throw ApiException(408, 'capture timed out', code: 'CAPTURE_TIMEOUT');
  }

  Future<Map<String, dynamic>> readAddress(
      {required String target, required int rotate, required String writing, required String scriptHint}) async {
    final res = Map<String, dynamic>.from(await api.post('/api/intake/drafts/$draftId/ocr',
        body: {
          'mode': experimentConfig == 'B1' ? 'B1' : 'P1',
          'target': target,
          'rotate': rotate,
          'writing': writing,
          'script_hint': scriptHint,
        },
        timeout: const Duration(seconds: 90)) as Map);
    await _applySuggestion(target, Map<String, dynamic>.from(res['parse'] as Map));
    return res;
  }

  Future<Map<String, dynamic>> parseText(String target, String text) async {
    final res = Map<String, dynamic>.from(
        await api.post('/api/intake/drafts/$draftId/parse/$target', body: {'text': text}) as Map);
    await _applySuggestion(target, res);
    return res;
  }

  Future<void> _applySuggestion(String target, Map<String, dynamic> parse) async {
    lastParse[target] = parse;
    await reload(); // the draft now holds the suggestion
    party(target).fillEmpty((parse['fields'] as Map?) ?? const {});
    if (target == 'recipient' && destinationOfficeId == null) await suggestOffice();
    _notify();
  }

  /// Picks the destination office when the postcode/town leads to exactly one.
  Future<void> suggestOffice() async {
    final pc = recipient.value('postcode');
    final city = recipient.value('city');
    if (pc.isEmpty && city.isEmpty) return;
    try {
      final list = await api.get('/api/intake/offices/suggest', query: {'postcode': pc, 'city': city}) as List;
      if (list.length == 1) setDestination((list.first as Map)['_id'] as String);
    } on ApiException {
      // The officer can still choose the office by hand.
    }
  }

  Future<Map<String, dynamic>?> addressCheck(String target) async {
    final p = party(target);
    if (p.value('city').isEmpty && p.value('postcode').isEmpty) return null;
    final res = await api.get('/api/intake/address-check', query: {'city': p.value('city'), 'postcode': p.value('postcode')});
    return Map<String, dynamic>.from(res as Map);
  }

  // ------------------------------------------------------------------ confirmation
  Future<void> confirmDetails() async {
    _dirty = true; // always send the visible values before confirming
    await save();
    await api.post('/api/intake/drafts/$draftId/confirm-fields',
        body: {'confirmed_fields': ['sender', 'recipient', 'notification']});
    await reload();
  }

  // ------------------------------------------------------------------ weight
  Future<Map<String, dynamic>> liveWeight(String deviceId) async =>
      Map<String, dynamic>.from(await api.get('/api/intake/drafts/$draftId/weight/live',
          query: {'device_id': deviceId}, timeout: const Duration(seconds: 5)) as Map);

  Future<void> pairWeight(String deviceId) async {
    await api.post('/api/intake/drafts/$draftId/weight/pair', body: {'device_id': deviceId});
    quote = null;
    await reload();
  }

  Future<void> manualWeight(double grams, String instrument, String reason) async {
    await api.post('/api/intake/drafts/$draftId/weight/manual',
        body: {'grams': grams, 'instrument': instrument, 'reason': reason});
    quote = null;
    await reload();
  }

  // ------------------------------------------------------------------ charge and acceptance
  Future<void> requestQuote({required bool adviceOfDelivery, double? insuredValue}) async {
    quote = Map<String, dynamic>.from(await api.post('/api/intake/drafts/$draftId/quote',
        body: {'advice_of_delivery': adviceOfDelivery, 'insured_value_lkr': insuredValue}) as Map);
    _notify();
  }

  /// Returns the new tracking ID.
  Future<String> accept({required String method, required String reference}) async {
    final res = await api.post('/api/intake/drafts/$draftId/accept', body: {
      'quote_id': quote!['quote_id'],
      'payment': {'method': method, 'amount_lkr': quote!['total_lkr'], 'reference': reference},
    }) as Map;
    return (res['item'] as Map)['tracking_id'] as String;
  }

  Future<void> cancel() => api.post('/api/intake/drafts/$draftId/cancel');

  void clearForm() {
    sender.clear();
    recipient.clear();
    destinationOfficeId = null;
    contact.clear();
    quote = null;
    _edited();
  }

  @override
  void dispose() {
    _disposed = true;
    sender.dispose();
    recipient.dispose();
    contact.dispose();
    super.dispose();
  }
}
