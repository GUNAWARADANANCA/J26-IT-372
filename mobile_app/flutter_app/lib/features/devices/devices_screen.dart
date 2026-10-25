// IoT scale + camera (ESP32-CAM, HX711): status, live reading and the
// tare / calibrate / identify / test-photo commands (proposal 3.9).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/app_state.dart';
import '../../core/format.dart';
import '../../core/labels.dart';
import '../../l10n/l10n.dart';
import '../../theme/gov_theme.dart';
import '../../widgets/gov_widgets.dart';

class DevicesScreen extends StatefulWidget {
  const DevicesScreen({super.key});

  @override
  State<DevicesScreen> createState() => _DevicesScreenState();
}

class _DevicesScreenState extends State<DevicesScreen> {
  List<Map>? _devices;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await context.read<AppState>().api.get('/api/devices') as List;
      if (mounted) {
        setState(() {
          _devices = res.cast<Map>();
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    return Scaffold(
      appBar: GovAppBar(title: l.taskDevices),
      body: PageBody(
        onRefresh: _load,
        children: [
          Text(l.devicesIntro, style: t.bodySmall),
          if (_error != null) ErrorState(error: _error!, onRetry: _load),
          if (_devices == null && _error == null) const LoadingView(),
          if (_devices != null && _devices!.isEmpty) EmptyState(title: l.noDevices, icon: Icons.scale_outlined),
          for (final d in _devices ?? const <Map>[])
            Card(
              child: InkWell(
                borderRadius: BorderRadius.circular(8),
                onTap: () async {
                  await Navigator.push(
                      context, MaterialPageRoute(builder: (_) => DeviceDetailScreen(deviceId: '${d['device_id']}')));
                  _load();
                },
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Expanded(child: MonoText('${d['device_id']}')),
                        d['online'] == true
                            ? StatusTag(l.online, tone: Tone.success, icon: Icons.wifi)
                            : StatusTag(l.offline, tone: Tone.error, icon: Icons.wifi_off),
                      ]),
                      if ('${d['description'] ?? ''}'.isNotEmpty) Text('${d['description']}', style: t.bodySmall),
                      const SizedBox(height: 6),
                      Text(l.calibrationStatus('${(d['calibration'] as Map?)?['calibration_id'] ?? (d['calibration'] as Map?)?['status'] ?? '—'}'),
                          style: t.bodySmall),
                      Text('${l.firmware}: ${d['firmware'] ?? '—'} · IP ${d['ip'] ?? '—'}', style: t.bodySmall),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class DeviceDetailScreen extends StatefulWidget {
  const DeviceDetailScreen({super.key, required this.deviceId});

  final String deviceId;

  @override
  State<DeviceDetailScreen> createState() => _DeviceDetailScreenState();
}

class _DeviceDetailScreenState extends State<DeviceDetailScreen> {
  late final AppState _state = context.read<AppState>();
  Map<String, dynamic>? _live;
  Object? _error;
  Timer? _timer;
  bool _polling = false;
  String? _busy;

  @override
  void initState() {
    super.initState();
    _poll();
    _timer = Timer.periodic(const Duration(milliseconds: 1500), (_) => _poll());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _poll() async {
    if (_polling) return;
    _polling = true;
    try {
      final res = await _state.api.get('/api/devices/${widget.deviceId}/live', timeout: const Duration(seconds: 5));
      if (mounted) {
        setState(() {
          _live = Map<String, dynamic>.from(res as Map);
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      _polling = false;
    }
  }

  Future<void> _command(String type, [Map<String, dynamic> params = const {}]) async {
    final l = context.l10n;
    setState(() => _busy = type);
    try {
      await _state.api.post('/api/devices/${widget.deviceId}/commands', body: {'type': type, 'params': params});
      if (mounted) showMessage(context, l.commandSent);
      await _poll();
    } on ApiException catch (e) {
      if (mounted) showMessage(context, describeError(context, e));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _calibrate() async {
    final l = context.l10n;
    final c = TextEditingController(text: '100');
    final grams = await showDialog<double>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l.calibrateTitle),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l.calibrateBody),
            const SizedBox(height: 12),
            GovTextField(label: l.referenceMass, controller: c, keyboardType: const TextInputType.numberWithOptions(decimal: true)),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(l.cancel)),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(64, 48)),
            onPressed: () {
              final v = double.tryParse(c.text.trim());
              if (v != null && v >= 10 && v <= 1000) Navigator.pop(ctx, v);
            },
            child: Text(l.calibrate),
          ),
        ],
      ),
    );
    c.dispose();
    if (grams != null) await _command('calibrate', {'known_g': grams});
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final locale = Localizations.localeOf(context).toLanguageTag();
    final d = _live;
    final reading = d?['latest_reading'] as Map?;
    final problems = ((d?['pairing_problems'] as List?) ?? const []).cast<Map>();
    final cal = (d?['calibration'] as Map?) ?? const {};
    final busy = _busy != null;

    return Scaffold(
      appBar: GovAppBar(title: widget.deviceId),
      body: d == null
          ? (_error == null ? const LoadingView() : PageBody(children: [ErrorState(error: _error!, onRetry: _poll)]))
          : PageBody(children: [
              Wrap(spacing: 8, runSpacing: 6, children: [
                d['online'] == true
                    ? StatusTag(l.online, tone: Tone.success, icon: Icons.wifi)
                    : StatusTag(l.offline, tone: Tone.error, icon: Icons.wifi_off),
                if (d['camera_ok'] == true) StatusTag(l.cameraOk, tone: Tone.success, icon: Icons.photo_camera),
                if (d['camera_ok'] == false) StatusTag(l.cameraFault, tone: Tone.error, icon: Icons.no_photography),
              ]),
              Semantics(
                liveRegion: true,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 18),
                  decoration: BoxDecoration(
                    color: GovColors.white,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: GovColors.line, width: 1.5),
                  ),
                  child: Column(children: [
                    Text(l.currentReading, style: t.labelSmall),
                    Text(reading?['net_g'] == null ? '— g' : formatGrams(reading!['net_g']),
                        style: const TextStyle(fontSize: 40, fontWeight: FontWeight.w800, color: GovColors.navy900)),
                    Wrap(spacing: 6, children: [
                      if (reading?['stable'] == true) StatusTag(l.stable, tone: Tone.success),
                      if (reading?['loaded'] == true) StatusTag(l.loaded, tone: Tone.info),
                      if (reading?['needs_tare'] == true) StatusTag(l.needsTare, tone: Tone.warning),
                    ]),
                  ]),
                ),
              ),
              if (problems.isNotEmpty)
                GovNotice(
                  tone: Tone.warning,
                  title: l.notReadyToWeigh,
                  children: [for (final p in problems) Text('• ${weightProblem(l, p)}')],
                ),
              SectionCard(
                title: l.actions,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(l.tareHint, style: t.bodySmall),
                    const SizedBox(height: 8),
                    PrimaryButton(label: l.tare, icon: Icons.exposure_zero, busy: _busy == 'tare', onPressed: busy ? null : () => _command('tare')),
                    const SizedBox(height: 10),
                    SecondaryButton(label: l.calibrate, icon: Icons.tune, busy: _busy == 'calibrate', onPressed: busy ? null : _calibrate),
                    const SizedBox(height: 10),
                    SecondaryButton(
                        label: l.identify, icon: Icons.lightbulb_outline, busy: _busy == 'identify', onPressed: busy ? null : () => _command('identify')),
                    const SizedBox(height: 10),
                    SecondaryButton(
                        label: l.testPhoto, icon: Icons.photo_camera_outlined, busy: _busy == 'capture', onPressed: busy ? null : () => _command('capture')),
                  ],
                ),
              ),
              SectionCard(
                title: l.details,
                child: Column(children: [
                  KeyValueRow(l.office, d['office_id'] as String?),
                  KeyValueRow(l.firmware, d['firmware'] as String?),
                  KeyValueRow('IP', d['ip'] as String?),
                  KeyValueRow(l.wifiSignal, d['rssi'] == null ? null : '${d['rssi']} dBm'),
                  KeyValueRow(l.lastSeen, formatDateTime(d['last_seen'], locale)),
                  KeyValueRow(l.calibration, '${cal['calibration_id'] ?? cal['status'] ?? '—'}'),
                  KeyValueRow(l.uncertainty, cal['expanded_uncertainty_g'] == null ? null : '± ${cal['expanded_uncertainty_g']} g'),
                ]),
              ),
              SectionCard(
                title: l.recentCommands,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final c in ((d['recent_commands'] as List?) ?? const []).cast<Map>())
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(children: [
                          Expanded(child: Text('${_commandName(l, '${c['type']}')} · ${formatTime(c['created_at'], locale)}')),
                          StatusTag(_commandStatus(l, '${c['status']}'),
                              tone: c['status'] == 'done' ? Tone.success : (c['status'] == 'failed' ? Tone.error : Tone.neutral)),
                        ]),
                      ),
                    if (((d['recent_commands'] as List?) ?? const []).isEmpty) Text('—', style: t.bodySmall),
                  ],
                ),
              ),
            ]),
    );
  }
}

String _commandName(AppLocalizations l, String type) => switch (type) {
      'tare' => l.tare,
      'calibrate' => l.calibrate,
      'capture' => l.testPhoto,
      'identify' => l.identify,
      _ => type,
    };

String _commandStatus(AppLocalizations l, String status) => switch (status) {
      'queued' => l.cmdQueued,
      'sent' => l.cmdSent,
      'done' => l.cmdDone,
      'failed' => l.cmdFailed,
      'expired' => l.cmdExpired,
      _ => status,
    };
