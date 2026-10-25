import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/app_state.dart';
import '../../core/format.dart';
import '../../core/labels.dart';
import '../../core/models.dart';
import '../../l10n/l10n.dart';
import '../../theme/gov_theme.dart';
import '../../widgets/gov_widgets.dart';
import '../audit/audit_screen.dart';
import '../devices/devices_screen.dart';
import '../intake/drafts_screen.dart';
import '../items/items_screen.dart';
import '../notifications/notifications_screen.dart';
import '../offices/offices_screen.dart';
import '../review/review_screen.dart';
import '../scan/scan_flow.dart';
import '../scan/scan_history_screen.dart';
import '../settings/settings_screen.dart';
import '../summary/summary_screen.dart';
import '../tracking/public_track_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int? _heldForReview;
  int? _openDrafts;

  @override
  void initState() {
    super.initState();
    _loadCounts();
  }

  Future<void> _loadCounts() async {
    final state = context.read<AppState>();
    final user = state.user;
    if (user == null) return;
    try {
      if (user.can([Roles.postmaster])) {
        final s = await state.api.get('/api/reports/summary') as Map;
        if (mounted) setState(() => _heldForReview = s['held_events'] as int?);
      }
      if (user.can(Roles.intake)) {
        final d = await state.api.get('/api/intake/drafts') as List;
        if (mounted) setState(() => _openDrafts = d.length);
      }
    } on ApiException {
      // Counts are a convenience; the screens themselves show errors.
    }
  }

  Future<void> _refresh() async {
    final state = context.read<AppState>();
    await Future.wait([_loadCounts(), state.refreshProfile(), state.syncNow()]);
  }

  void _open(Widget screen) => Navigator.push(context, MaterialPageRoute(builder: (_) => screen)).then((_) => _loadCounts());

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final state = context.watch<AppState>();
    final user = state.user;
    if (user == null) return const SizedBox.shrink(); // signing out: the sign-in screen replaces this one
    final t = Theme.of(context).textTheme;
    final locale = Localizations.localeOf(context).toLanguageTag();
    final canScan = user.can(Roles.scanning);

    final daily = <_Task>[
      if (user.can(Roles.intake))
        _Task(Icons.post_add_rounded, l.taskRegister, l.taskRegisterHint, () => _open(const DraftsScreen()),
            hue: Hue.blue, badge: (_openDrafts ?? 0) > 0 ? '$_openDrafts' : null),
      if (canScan)
        _Task(Icons.qr_code_scanner_rounded, l.taskScan, l.taskScanHint, () => scanAndRecord(context), hue: Hue.orange),
      _Task(Icons.manage_search_rounded, l.taskItems, l.taskItemsHint, () => _open(const ItemsScreen()), hue: Hue.teal),
      if (canScan)
        _Task(Icons.history_rounded, l.taskHistory, l.taskHistoryHint, () => _open(const ScanHistoryScreen()),
            hue: Hue.purple, badge: state.counts.pending > 0 ? '${state.counts.pending}' : null),
    ];
    final supervision = <_Task>[
      if (user.can([Roles.postmaster]))
        _Task(Icons.fact_check_outlined, l.taskReview, l.taskReviewHint, () => _open(const ReviewScreen()),
            hue: Hue.rose, badge: (_heldForReview ?? 0) > 0 ? '$_heldForReview' : null),
      if (user.can([Roles.postmaster, Roles.counter]))
        _Task(Icons.mark_email_read_outlined, l.taskMessages, l.taskMessagesHint, () => _open(const NotificationsScreen()),
            hue: Hue.blue),
      if (user.can([Roles.postmaster]))
        _Task(Icons.insights_rounded, l.taskSummary, l.taskSummaryHint, () => _open(const SummaryScreen()),
            hue: Hue.green),
      if (user.can([Roles.postmaster]))
        _Task(Icons.policy_outlined, l.taskAudit, l.taskAuditHint, () => _open(const AuditScreen()), hue: Hue.slate),
    ];
    final setup = <_Task>[
      if (user.can(Roles.intake))
        _Task(Icons.scale_outlined, l.taskDevices, l.taskDevicesHint, () => _open(const DevicesScreen()),
            hue: Hue.purple),
      if (user.can([Roles.postmaster]))
        _Task(Icons.location_city_rounded, l.taskOffices, l.taskOfficesHint, () => _open(const OfficesScreen()),
            hue: Hue.teal),
      _Task(Icons.travel_explore_rounded, l.taskTrack, l.taskTrackHint, () => _open(const PublicTrackScreen()),
          hue: Hue.green),
    ];

    final content = <Widget>[
      if (canScan) _ScanHero(onTap: () => scanAndRecord(context)),
      if (canScan) _SyncCard(state: state),
      if ((_heldForReview ?? 0) > 0)
        GovNotice(
          tone: Tone.warning,
          title: l.reviewWaiting(_heldForReview!),
          action: TextButton(onPressed: () => _open(const ReviewScreen()), child: Text(l.openReviewQueue)),
        ),
      if (daily.isNotEmpty) ...[SectionHeading(l.groupDaily), _TaskGrid(tasks: daily)],
      if (supervision.isNotEmpty) ...[SectionHeading(l.groupSupervision), _TaskGrid(tasks: supervision)],
      SectionHeading(l.groupSetup),
      _TaskGrid(tasks: setup),
      Text(l.auditFooter, style: t.bodySmall, textAlign: TextAlign.center),
    ];

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          children: [
            // Who is signed in, where, and today's date.
            HeroHeader(
              bottomPadding: canScan ? 62 : 26,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _Avatar(name: user.fullName),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(l.welcome(user.fullName),
                            style: t.titleLarge?.copyWith(color: GovColors.white, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            _HeaderChip(icon: Icons.badge_outlined, text: roleLabel(l, user.role)),
                            _HeaderChip(icon: Icons.location_on_outlined, text: user.office),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(formatToday(locale), style: t.bodySmall?.copyWith(color: GovColors.navy100)),
                      ],
                    ),
                  ),
                  Material(
                    color: GovColors.white.withValues(alpha: 0.14),
                    shape: const CircleBorder(),
                    child: IconButton(
                      tooltip: l.settings,
                      color: GovColors.white,
                      icon: const Icon(Icons.settings_outlined),
                      onPressed: () => _open(const SettingsScreen()),
                    ),
                  ),
                ],
              ),
            ),
            Transform.translate(
              offset: Offset(0, canScan ? -44 : 0),
              child: Padding(
                padding: EdgeInsets.fromLTRB(16, canScan ? 0 : 16, 16, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (var i = 0; i < content.length; i++) ...[
                      if (i > 0) const SizedBox(height: 14),
                      content[i],
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    final words = name.split(RegExp(r'[\s()]+')).where((w) => w.isNotEmpty).toList();
    final initials = words.take(2).map((w) => w.characters.first.toUpperCase()).join();
    return ExcludeSemantics(
      child: Container(
        width: 54,
        height: 54,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: GovColors.accent,
          shape: BoxShape.circle,
          border: Border.all(color: GovColors.white.withValues(alpha: 0.7), width: 2.5),
        ),
        child: Text(initials.isEmpty ? '?' : initials,
            style: const TextStyle(color: GovColors.navy950, fontSize: 19, fontWeight: FontWeight.w800)),
      ),
    );
  }
}

class _HeaderChip extends StatelessWidget {
  const _HeaderChip({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: GovColors.white.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(40),
          border: Border.all(color: GovColors.white.withValues(alpha: 0.25)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: GovColors.navy100),
            const SizedBox(width: 5),
            Flexible(
              child: Text(text,
                  style: const TextStyle(color: GovColors.white, fontSize: 12.5, fontWeight: FontWeight.w600, height: 1.3)),
            ),
          ],
        ),
      );
}

/// The one action most staff need: a large, unmistakable "scan" card.
class _ScanHero extends StatelessWidget {
  const _ScanHero({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    return Semantics(
      button: true,
      child: Card(
        elevation: 6,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Row(
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [Color(0xFFF7C948), Color(0xFFE59A00)],
                    ),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(color: const Color(0xFFE59A00).withValues(alpha: 0.35), blurRadius: 14, offset: const Offset(0, 6)),
                    ],
                  ),
                  child: const Icon(Icons.qr_code_scanner_rounded, color: GovColors.navy950, size: 34),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(l.scanALetter, style: t.titleMedium?.copyWith(fontWeight: FontWeight.w800, color: GovColors.navy900)),
                      const SizedBox(height: 2),
                      Text(l.taskScanHint, style: t.bodySmall),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  width: 38,
                  height: 38,
                  decoration: const BoxDecoration(color: GovColors.navy700, shape: BoxShape.circle),
                  child: const Icon(Icons.arrow_forward_rounded, color: GovColors.white, size: 22),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SyncCard extends StatelessWidget {
  const _SyncCard({required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final c = state.counts;
    final last = state.lastSync;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                IconBadge(state.online ? Icons.wifi_rounded : Icons.wifi_off_rounded,
                    hue: state.online ? Hue.green : Hue.orange, size: 42, circle: true),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(l.offlineScansTitle, style: t.titleSmall),
                      const SizedBox(height: 4),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          state.online
                              ? StatusTag(l.networkAvailable, tone: Tone.success)
                              : StatusTag(l.networkOffline, tone: Tone.warning),
                          StatusTag(l.pendingCount(c.pending),
                              tone: c.pending > 0 ? Tone.warning : Tone.neutral, icon: Icons.cloud_upload_outlined),
                          if (c.held > 0) StatusTag(l.heldCount(c.held), tone: Tone.warning),
                          if (c.rejected > 0) StatusTag(l.rejectedCount(c.rejected), tone: Tone.error),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (last?.error != null && c.pending > 0) ...[
              const SizedBox(height: 8),
              Text(last!.networkError ? l.lastUploadFailedNetwork : l.lastUploadFailed(last.error!),
                  style: const TextStyle(color: GovColors.error, fontWeight: FontWeight.w600)),
            ],
            if (c.pending > 0 || state.syncing) ...[
              const SizedBox(height: 12),
              SecondaryButton(
                label: state.syncing ? l.uploading : l.uploadNow,
                icon: Icons.cloud_upload_outlined,
                busy: state.syncing,
                onPressed: state.syncNow,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Task {
  const _Task(this.icon, this.title, this.hint, this.onTap, {this.badge, this.hue = Hue.navy});

  final IconData icon;
  final String title;
  final String hint;
  final VoidCallback onTap;
  final String? badge;
  final Hue hue;
}

class _TaskGrid extends StatelessWidget {
  const _TaskGrid({required this.tasks});

  final List<_Task> tasks;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, c) {
      final columns = c.maxWidth >= 560 ? 3 : 2;
      final width = (c.maxWidth - (columns - 1) * 12) / columns;
      return Wrap(
        spacing: 12,
        runSpacing: 12,
        children: [for (final task in tasks) SizedBox(width: width, child: _TaskTile(task: task))],
      );
    });
  }
}

class _TaskTile extends StatelessWidget {
  const _TaskTile({required this.task});

  final _Task task;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Semantics(
      button: true,
      label: task.badge == null ? null : '${task.title}, ${task.badge}',
      child: Card(
        child: InkWell(
          onTap: task.onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 132),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      IconBadge(task.icon, hue: task.hue, size: 48),
                      const Spacer(),
                      if (task.badge != null)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                          decoration: BoxDecoration(color: GovColors.error, borderRadius: BorderRadius.circular(20)),
                          child: Text(task.badge!,
                              style: const TextStyle(color: GovColors.white, fontWeight: FontWeight.w800, fontSize: 12.5)),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(task.title, style: t.titleSmall?.copyWith(fontWeight: FontWeight.w800, color: GovColors.navy900)),
                  const SizedBox(height: 3),
                  Text(task.hint, style: t.bodySmall, maxLines: 3, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
