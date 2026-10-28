// Register a letter at the counter in five steps (proposal 4.4, FR02-FR08):
// photo -> addresses -> confirm -> weigh -> charge & accept.
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../l10n/l10n.dart';
import '../../theme/gov_theme.dart';
import '../../widgets/gov_widgets.dart';
import 'intake_controller.dart';
import 'receipt_screen.dart';
import 'steps/address_step.dart';
import 'steps/confirm_step.dart';
import 'steps/payment_step.dart';
import 'steps/photo_step.dart';
import 'steps/weigh_step.dart';

class IntakeWizardScreen extends StatefulWidget {
  const IntakeWizardScreen({super.key, required this.draftId});

  final String draftId;

  @override
  State<IntakeWizardScreen> createState() => _IntakeWizardScreenState();
}

class _IntakeWizardScreenState extends State<IntakeWizardScreen> {
  late final IntakeController _c = IntakeController(context.read<AppState>().api, widget.draftId);
  int _step = 0;
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _init();
  }

  /// Opens the draft at its first unfinished step.
  Future<void> _init() async {
    await _c.load();
    if (!mounted || _c.draft == null) return;
    final first = _c.progress.indexWhere((done) => !done);
    setState(() {
      _step = first < 0 ? 4 : first;
      _ready = true;
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  Future<bool> _saveOrReport() async {
    try {
      await _c.save();
      return true;
    } catch (e) {
      if (mounted) showMessage(context, describeError(context, e));
      return false;
    }
  }

  Future<void> _goTo(int step) async {
    if (step == _step) return;
    if (!await _saveOrReport()) return;
    if (mounted) setState(() => _step = step.clamp(0, 4));
  }

  Future<void> _accepted(String trackingId) async {
    await Navigator.pushReplacement(
        context, MaterialPageRoute(builder: (_) => ReceiptScreen(trackingId: trackingId, justAccepted: true)));
  }

  Future<void> _menu(String action) async {
    final l = context.l10n;
    if (action == 'clear') {
      final ok = await confirmAction(context, title: l.clearFormTitle, message: l.clearFormBody, confirmLabel: l.clearForm);
      if (ok) _c.clearForm();
    } else if (action == 'cancel') {
      final ok = await confirmAction(context,
          title: l.deleteDraftTitle, message: l.deleteDraftBody, confirmLabel: l.deleteDraft, danger: true);
      if (!ok || !mounted) return;
      try {
        await _c.cancel();
        if (mounted) Navigator.pop(context);
      } catch (e) {
        if (mounted) showMessage(context, describeError(context, e));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return ListenableBuilder(
      listenable: _c,
      builder: (context, _) {
        final draft = _c.draft;
        final open = _c.open;
        return PopScope(
          canPop: !_c.dirty,
          onPopInvokedWithResult: (didPop, _) async {
            if (didPop) return;
            if (await _saveOrReport() && context.mounted) Navigator.pop(context);
          },
          child: Scaffold(
            appBar: GovAppBar(
              title: l.registerALetter,
              actions: [
                if (open)
                  PopupMenuButton<String>(
                    tooltip: l.moreActions,
                    onSelected: _menu,
                    itemBuilder: (_) => [
                      PopupMenuItem(value: 'clear', child: Text(l.clearForm)),
                      PopupMenuItem(value: 'cancel', child: Text(l.deleteDraft)),
                    ],
                  ),
              ],
            ),
            body: !_ready
                ? (_c.loadError != null
                    ? PageBody(children: [ErrorState(error: _c.loadError!, onRetry: _init)])
                    : LoadingView(message: l.openingDraft))
                : draft == null
                    ? const SizedBox.shrink()
                    : !open
                        ? _ClosedDraft(draft: draft)
                        : Column(
                            children: [
                              _StepBar(progress: _c.progress, current: _step, onTap: _goTo),
                              _DraftLine(id: widget.draftId, saving: _c.saving, dirty: _c.dirty),
                              Expanded(child: _body()),
                            ],
                          ),
            bottomNavigationBar: _ready && open
                ? _NavBar(
                    step: _step,
                    onBack: _step > 0 ? () => _goTo(_step - 1) : null,
                    onNext: _step < 4 ? () => _goTo(_step + 1) : null,
                  )
                : null,
          ),
        );
      },
    );
  }

  Widget _body() => switch (_step) {
        0 => PhotoStep(c: _c),
        1 => AddressStep(c: _c),
        2 => ConfirmStep(c: _c),
        3 => WeighStep(c: _c),
        _ => PaymentStep(c: _c, onAccepted: _accepted),
      };
}

class _StepBar extends StatelessWidget {
  const _StepBar({required this.progress, required this.current, required this.onTap});

  final List<bool> progress;
  final int current;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final labels = [l.stepPhoto, l.stepAddresses, l.stepConfirm, l.stepWeigh, l.stepPay];
    return Material(
      color: GovColors.white,
      child: Container(
        decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: GovColors.line))),
        padding: const EdgeInsets.fromLTRB(8, 10, 8, 8),
        child: Row(
          children: [
            for (var i = 0; i < 5; i++)
              Expanded(
                child: Semantics(
                  button: true,
                  selected: i == current,
                  label: '${l.stepOf(i + 1, 5)}: ${labels[i]}, ${progress[i] ? l.complete : l.notComplete}',
                  excludeSemantics: true,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(6),
                    onTap: () => onTap(i),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Column(
                        children: [
                          StepBadge(step: i + 1, done: progress[i], current: i == current),
                          const SizedBox(height: 4),
                          Text(
                            labels[i],
                            textAlign: TextAlign.center,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11.5,
                              height: 1.2,
                              fontWeight: i == current ? FontWeight.w700 : FontWeight.w500,
                              color: i == current ? GovColors.navy900 : GovColors.grey600,
                            ),
                          ),
                          if (i == current)
                            Container(margin: const EdgeInsets.only(top: 4), height: 3, width: 28, color: GovColors.accent),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _DraftLine extends StatelessWidget {
  const _DraftLine({required this.id, required this.saving, required this.dirty});

  final String id;
  final bool saving;
  final bool dirty;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Container(
      color: GovColors.navy50,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Row(
        children: [
          Text('${l.draft} ', style: Theme.of(context).textTheme.bodySmall),
          MonoText(id, size: 13),
          const Spacer(),
          Text(
            saving ? l.saving : (dirty ? l.unsavedChanges : l.allChangesSaved),
            style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: dirty ? GovColors.warning : GovColors.success),
          ),
        ],
      ),
    );
  }
}

class _NavBar extends StatelessWidget {
  const _NavBar({required this.step, this.onBack, this.onNext});

  final int step;
  final VoidCallback? onBack;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Material(
      color: GovColors.white,
      elevation: 8,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(onPressed: onBack, icon: const Icon(Icons.arrow_back), label: Text(l.back)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  onPressed: onNext,
                  icon: const Icon(Icons.arrow_forward),
                  label: Text(l.next),
                  iconAlignment: IconAlignment.end,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ClosedDraft extends StatelessWidget {
  const _ClosedDraft({required this.draft});

  final Map<String, dynamic> draft;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final itemId = draft['item_id'] as String?;
    return PageBody(children: [
      if (draft['status'] == 'committed' && itemId != null) ...[
        GovNotice(tone: Tone.success, title: l.alreadyAcceptedTitle, message: l.alreadyAcceptedBody(itemId)),
        PrimaryButton(
          label: l.openReceipt,
          icon: Icons.receipt_long,
          onPressed: () => Navigator.pushReplacement(
              context, MaterialPageRoute(builder: (_) => ReceiptScreen(trackingId: itemId))),
        ),
      ] else
        GovNotice(tone: Tone.neutral, title: l.draftClosedTitle, message: l.draftClosedBody),
    ]);
  }
}
