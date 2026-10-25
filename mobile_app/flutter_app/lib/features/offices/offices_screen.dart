// Offices and their reference zones (used to judge scan locations). A
// postmaster standing at the office can set its point from the phone's GPS;
// a provenance note is mandatory and audited.
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../l10n/l10n.dart';
import '../../theme/gov_theme.dart';
import '../../widgets/gov_widgets.dart';

class OfficesScreen extends StatefulWidget {
  const OfficesScreen({super.key});

  @override
  State<OfficesScreen> createState() => _OfficesScreenState();
}

class _OfficesScreenState extends State<OfficesScreen> {
  late final AppState _state = context.read<AppState>();
  List<Map>? _offices;
  Object? _error;
  String? _busy;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _state.api.get('/api/admin/offices') as List;
      if (mounted) {
        setState(() {
          _offices = res.cast<Map>();
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _setHere(Map office) async {
    final l = context.l10n;
    setState(() => _busy = '${office['_id']}');
    final fix = await _state.location.captureFix(timeout: const Duration(seconds: 25));
    if (!mounted) return;
    setState(() => _busy = null);
    if (fix['latitude'] == null) {
      showMessage(context, l.locUnavailable);
      return;
    }
    final accuracy = ((fix['accuracy_m'] as num?) ?? 0).round();
    final today = DateTime.now().toIso8601String().substring(0, 10);
    final provenance = TextEditingController(text: l.provenanceDefault(today, accuracy));
    final radius = TextEditingController(text: '${office['zone_radius_m'] ?? 150}');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l.setReferencePoint),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(l.setReferencePointBody('${office['name']}')),
              const SizedBox(height: 8),
              Text('${(fix['latitude'] as num).toStringAsFixed(6)}, ${(fix['longitude'] as num).toStringAsFixed(6)} (± $accuracy m)',
                  style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w700)),
              if (accuracy > 25) ...[
                const SizedBox(height: 8),
                GovNotice(tone: Tone.warning, message: l.poorAccuracy),
              ],
              const SizedBox(height: 12),
              GovTextField(label: l.zoneRadius, controller: radius, keyboardType: TextInputType.number),
              const SizedBox(height: 12),
              GovTextField(label: l.provenance, hint: l.provenanceHint, controller: provenance, maxLines: 3),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.cancel)),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(64, 48)),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l.save),
          ),
        ],
      ),
    );
    final body = {
      'latitude': fix['latitude'],
      'longitude': fix['longitude'],
      'zone_radius_m': double.tryParse(radius.text.trim()),
      'provenance': provenance.text.trim(),
    };
    provenance.dispose();
    radius.dispose();
    if (ok != true || !mounted) return;
    try {
      await _state.api.patch('/api/admin/offices/${office['_id']}', body: body);
      if (mounted) showMessage(context, l.officeUpdated);
      await _load();
    } on ApiException catch (e) {
      if (mounted) showMessage(context, describeError(context, e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final user = _state.user!;
    return Scaffold(
      appBar: GovAppBar(title: l.taskOffices),
      body: PageBody(
        onRefresh: _load,
        children: [
          Text(l.officesIntro, style: t.bodySmall),
          if (_error != null) ErrorState(error: _error!, onRetry: _load),
          if (_offices == null && _error == null) const LoadingView(),
          for (final o in _offices ?? const <Map>[])
            SectionCard(
              title: '${o['name']}',
              subtitle: '${o['_id']} · ${o['postcode'] ?? ''} ${o['city'] ?? ''}',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  KeyValueRow(l.referencePoint,
                      o['latitude'] == null ? null : '${(o['latitude'] as num).toStringAsFixed(5)}, ${(o['longitude'] as num).toStringAsFixed(5)}'),
                  KeyValueRow(l.zoneRadius, o['zone_radius_m'] == null ? null : '${o['zone_radius_m']} m'),
                  KeyValueRow(l.serviceRadius, o['service_radius_m'] == null ? null : '${o['service_radius_m']} m'),
                  KeyValueRow(l.provenance, o['provenance'] as String?),
                  if (user.role == Roles.admin || (user.role == Roles.postmaster && user.officeId == o['_id'])) ...[
                    const SizedBox(height: 10),
                    SecondaryButton(
                      label: l.useMyLocation,
                      icon: Icons.my_location,
                      busy: _busy == '${o['_id']}',
                      onPressed: _busy == null ? () => _setHere(o) : null,
                    ),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }
}
