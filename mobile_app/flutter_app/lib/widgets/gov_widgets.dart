// Shared building blocks so every screen looks and behaves the same:
// official header strip, cards, notices, labelled fields, buttons, tags.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/api_client.dart';
import '../core/labels.dart';
import '../l10n/l10n.dart';
import '../theme/gov_theme.dart';

// --------------------------------------------------------------------------- header
/// App bar with the official-use strip above it (like the "official website"
/// banner of government web services). [public] switches the strip text for
/// the public tracking page.
class GovAppBar extends StatelessWidget implements PreferredSizeWidget {
  const GovAppBar({super.key, required this.title, this.actions, this.bottom, this.public = false});

  final String title;
  final List<Widget>? actions;
  final PreferredSizeWidget? bottom;
  final bool public;

  static const stripHeight = 30.0;

  @override
  Size get preferredSize => Size.fromHeight(stripHeight + kToolbarHeight + (bottom?.preferredSize.height ?? 0));

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Material(
        color: GovColors.navy900,
        child: DecoratedBox(
          decoration: const BoxDecoration(gradient: GovColors.heroGradient),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: EdgeInsets.only(top: top),
                child: SizedBox(height: stripHeight, child: OfficialStrip(public: public)),
              ),
              AppBar(
                primary: false,
                backgroundColor: Colors.transparent,
                title: Text(title),
                actions: actions,
                bottom: bottom,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Large gradient header with rounded bottom corners for the sign-in and home
/// screens. It draws under the status bar and carries the official-use strip.
class HeroHeader extends StatelessWidget {
  const HeroHeader({super.key, required this.child, this.public = false, this.bottomPadding = 28});

  final Widget child;
  final bool public;
  final double bottomPadding;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Container(
        decoration: const BoxDecoration(
          gradient: GovColors.heroGradient,
          borderRadius: BorderRadius.vertical(bottom: Radius.circular(30)),
        ),
        child: Stack(
          children: [
            // Two soft circles for depth; purely decorative.
            Positioned(right: -40, top: -30, child: _Glow(size: 170, alpha: 0.08)),
            Positioned(left: -50, bottom: -60, child: _Glow(size: 150, alpha: 0.06)),
            Padding(
              padding: EdgeInsets.fromLTRB(0, top, 0, bottomPadding),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(height: GovAppBar.stripHeight, child: OfficialStrip(public: public)),
                  Padding(padding: const EdgeInsets.fromLTRB(20, 10, 20, 0), child: child),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Glow extends StatelessWidget {
  const _Glow({required this.size, required this.alpha});

  final double size;
  final double alpha;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(shape: BoxShape.circle, color: GovColors.white.withValues(alpha: alpha)),
        ),
      );
}

/// Rounded square with a tinted background and a coloured icon.
class IconBadge extends StatelessWidget {
  const IconBadge(this.icon, {super.key, this.hue = Hue.navy, this.size = 44, this.circle = false});

  final IconData icon;
  final Hue hue;
  final double size;
  final bool circle;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: hue.tint,
          shape: circle ? BoxShape.circle : BoxShape.rectangle,
          borderRadius: circle ? null : BorderRadius.circular(size * 0.3),
        ),
        child: Icon(icon, color: hue.fg, size: size * 0.52),
      );
}

class OfficialStrip extends StatelessWidget {
  const OfficialStrip({super.key, this.public = false});

  final bool public;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return MediaQuery.withClampedTextScaling(
      maxScaleFactor: 1.2,
      child: InkWell(
        onTap: () => showDialog<void>(
          context: context,
          builder: (_) => AlertDialog(
            title: Text(public ? l.publicServiceTitle : l.officialUseTitle),
            content: Text(public ? l.publicServiceBody : l.officialUseBody),
            actions: [TextButton(onPressed: () => Navigator.pop(context), child: Text(l.close))],
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              const Icon(Icons.shield_outlined, size: 15, color: GovColors.accent),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  public ? l.publicServiceStrip : l.officialUseStrip,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: GovColors.navy100, fontSize: 12, fontWeight: FontWeight.w600),
                ),
              ),
              const Icon(Icons.expand_more, size: 16, color: GovColors.navy200),
            ],
          ),
        ),
      ),
    );
  }
}

// --------------------------------------------------------------------------- layout
/// Scrollable page body with the standard 16 dp gutter and spacing.
class PageBody extends StatelessWidget {
  const PageBody({super.key, required this.children, this.onRefresh, this.padding, this.controller});

  final List<Widget> children;
  final Future<void> Function()? onRefresh;
  final EdgeInsets? padding;
  final ScrollController? controller;

  @override
  Widget build(BuildContext context) {
    final list = ListView(
      controller: controller,
      physics: const AlwaysScrollableScrollPhysics(),
      padding: padding ?? const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        for (var i = 0; i < children.length; i++) ...[
          if (i > 0) const SizedBox(height: 14),
          children[i],
        ],
      ],
    );
    return SafeArea(top: false, child: onRefresh == null ? list : RefreshIndicator(onRefresh: onRefresh!, child: list));
  }
}

class SectionCard extends StatelessWidget {
  const SectionCard({
    super.key,
    this.title,
    this.subtitle,
    required this.child,
    this.trailing,
    this.step,
    this.done = false,
    this.icon,
    this.hue = Hue.navy,
  });

  final String? title;
  final String? subtitle;
  final Widget child;
  final Widget? trailing;
  final int? step;
  final bool done;
  final IconData? icon;
  final Hue hue;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (title != null) ...[
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (step != null) ...[StepBadge(step: step!, done: done), const SizedBox(width: 10)],
                  if (step == null && icon != null) ...[IconBadge(icon!, hue: hue, size: 40), const SizedBox(width: 12)],
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Semantics(header: true, child: Text(title!, style: t.titleMedium)),
                        if (subtitle != null) Text(subtitle!, style: t.bodySmall),
                      ],
                    ),
                  ),
                  ?trailing,
                ],
              ),
              const SizedBox(height: 14),
            ],
            child,
          ],
        ),
      ),
    );
  }
}

class StepBadge extends StatelessWidget {
  const StepBadge({super.key, required this.step, this.done = false, this.current = false});

  final int step;
  final bool done;
  final bool current;

  @override
  Widget build(BuildContext context) {
    final bg = done ? GovColors.success : (current ? GovColors.navy700 : GovColors.white);
    final fg = done || current ? GovColors.white : GovColors.grey600;
    return Container(
      width: 28,
      height: 28,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: bg,
        shape: BoxShape.circle,
        border: Border.all(color: done ? GovColors.success : (current ? GovColors.navy700 : GovColors.grey500), width: 1.5),
      ),
      child: done
          ? const Icon(Icons.check, size: 16, color: GovColors.white)
          : Text('$step', style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 13)),
    );
  }
}

class SectionHeading extends StatelessWidget {
  const SectionHeading(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 10),
        child: Semantics(
          header: true,
          child: Row(
            children: [
              Container(
                width: 4,
                height: 18,
                decoration: BoxDecoration(color: GovColors.accent, borderRadius: BorderRadius.circular(2)),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(text,
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: GovColors.navy900)),
              ),
            ],
          ),
        ),
      );
}

// --------------------------------------------------------------------------- notices and tags
/// Coloured notice with icon and text (never colour alone).
class GovNotice extends StatelessWidget {
  const GovNotice({super.key, this.tone = Tone.info, this.title, this.message, this.children = const [], this.action});

  final Tone tone;
  final String? title;
  final String? message;
  final List<Widget> children;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Semantics(
      container: true,
      liveRegion: tone == Tone.error,
      child: Container(
        decoration: BoxDecoration(
          color: tone.tint,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: tone.fg.withValues(alpha: 0.28)),
        ),
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 34,
              height: 34,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: GovColors.white, shape: BoxShape.circle, boxShadow: GovColors.softShadow),
              child: Icon(tone.icon, color: tone.fg, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (title != null) Text(title!, style: t.titleSmall?.copyWith(color: tone.fg)),
                  if (message != null) Text(message!, style: t.bodyMedium),
                  ...children,
                  if (action != null) Padding(padding: const EdgeInsets.only(top: 6), child: action),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// "There is a problem" box listing what must be fixed before continuing.
class ProblemSummary extends StatelessWidget {
  const ProblemSummary({super.key, required this.errors, this.title});

  final List<String> errors;
  final String? title;

  @override
  Widget build(BuildContext context) {
    if (errors.isEmpty) return const SizedBox.shrink();
    final t = Theme.of(context).textTheme;
    return Semantics(
      liveRegion: true,
      container: true,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: GovColors.white,
          border: Border.all(color: GovColors.error, width: 2.5),
          borderRadius: BorderRadius.circular(16),
          boxShadow: GovColors.softShadow,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.error_outline_rounded, color: GovColors.error),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(title ?? context.l10n.thereIsAProblem,
                      style: t.titleMedium?.copyWith(color: GovColors.error)),
                ),
              ],
            ),
            const SizedBox(height: 6),
            for (final e in errors)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('•  ', style: TextStyle(color: GovColors.error, fontWeight: FontWeight.w700)),
                    Expanded(child: Text(e, style: t.bodyMedium?.copyWith(color: GovColors.error, fontWeight: FontWeight.w600))),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class StatusTag extends StatelessWidget {
  const StatusTag(this.text, {super.key, this.tone = Tone.neutral, this.icon});

  final String text;
  final Tone tone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => _Pill(text: text, fg: tone.fg, tint: tone.tint, icon: icon);
}

/// Mail status as a coloured pill with its own icon ("Out for delivery" with a scooter, ...).
class StatusPill extends StatelessWidget {
  const StatusPill(this.status, {super.key, this.large = false});

  final String? status;
  final bool large;

  @override
  Widget build(BuildContext context) {
    final hue = statusHue(status);
    return _Pill(
        text: statusLabel(context.l10n, status), fg: hue.fg, tint: hue.tint, icon: statusIcon(status), large: large);
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.text, required this.fg, required this.tint, this.icon, this.large = false});

  final String text;
  final Color fg;
  final Color tint;
  final IconData? icon;
  final bool large;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: large ? 14 : 10, vertical: large ? 7 : 4),
      decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(40)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[Icon(icon, size: large ? 18 : 15, color: fg), SizedBox(width: large ? 6 : 5)],
          Flexible(
            child: Text(text,
                style: TextStyle(color: fg, fontSize: large ? 14.5 : 12.5, fontWeight: FontWeight.w700, height: 1.3)),
          ),
        ],
      ),
    );
  }
}

/// Tracking IDs in a fixed-width face so look-alike characters stay distinct.
class MonoText extends StatelessWidget {
  const MonoText(this.text, {super.key, this.size = 15, this.color});

  final String text;
  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) => Text(text,
      style: TextStyle(
          fontFamily: 'monospace', fontSize: size, fontWeight: FontWeight.w700, letterSpacing: 0.5, color: color));
}

// --------------------------------------------------------------------------- form fields
class FieldLabel extends StatelessWidget {
  const FieldLabel(this.label, {super.key, this.hint, this.optional = false});

  final String label;
  final String? hint;
  final bool optional;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text.rich(TextSpan(text: label, style: t.labelMedium, children: [
          if (optional) TextSpan(text: ' (${context.l10n.optional})', style: t.bodySmall),
        ])),
        if (hint != null) Text(hint!, style: t.bodySmall),
        const SizedBox(height: 6),
      ],
    );
  }
}

/// Text field with its label and hint above it (labels never disappear while typing).
class GovTextField extends StatelessWidget {
  const GovTextField({
    super.key,
    required this.label,
    this.controller,
    this.hint,
    this.placeholder,
    this.errorText,
    this.optional = false,
    this.keyboardType,
    this.obscureText = false,
    this.maxLines = 1,
    this.minLines,
    this.enabled = true,
    this.onChanged,
    this.onSubmitted,
    this.textInputAction,
    this.textCapitalization = TextCapitalization.none,
    this.autofillHints,
    this.suffix,
    this.inputFormatters,
    this.autocorrect = true,
    this.decorationColor,
  });

  final String label;
  final TextEditingController? controller;
  final String? hint;
  final String? placeholder;
  final String? errorText;
  final bool optional;
  final TextInputType? keyboardType;
  final bool obscureText;
  final int maxLines;
  final int? minLines;
  final bool enabled;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final TextInputAction? textInputAction;
  final TextCapitalization textCapitalization;
  final Iterable<String>? autofillHints;
  final Widget? suffix;
  final List<TextInputFormatter>? inputFormatters;
  final bool autocorrect;
  final Color? decorationColor;

  @override
  Widget build(BuildContext context) {
    return MergeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          FieldLabel(label, hint: hint, optional: optional),
          TextField(
            controller: controller,
            keyboardType: keyboardType,
            obscureText: obscureText,
            maxLines: obscureText ? 1 : maxLines,
            minLines: minLines,
            enabled: enabled,
            onChanged: onChanged,
            onSubmitted: onSubmitted,
            textInputAction: textInputAction,
            textCapitalization: textCapitalization,
            autofillHints: autofillHints,
            inputFormatters: inputFormatters,
            autocorrect: autocorrect && !obscureText,
            enableSuggestions: !obscureText,
            decoration: InputDecoration(
              hintText: placeholder,
              errorText: errorText,
              suffixIcon: suffix,
              fillColor: decorationColor,
            ),
          ),
        ],
      ),
    );
  }
}

class GovDropdown<T> extends StatelessWidget {
  const GovDropdown({
    super.key,
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
    this.hint,
    this.placeholder,
    this.optional = false,
  });

  final String label;
  final T? value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?>? onChanged;
  final String? hint;
  final String? placeholder;
  final bool optional;

  @override
  Widget build(BuildContext context) {
    return MergeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          FieldLabel(label, hint: hint, optional: optional),
          DropdownButtonFormField<T>(
            key: ValueKey(value),
            initialValue: value,
            items: items,
            onChanged: onChanged,
            isExpanded: true,
            hint: placeholder == null ? null : Text(placeholder!),
          ),
        ],
      ),
    );
  }
}

/// A large selectable row for one-of-many choices (status to record, etc.).
class ChoiceTile extends StatelessWidget {
  const ChoiceTile({
    super.key,
    required this.title,
    this.subtitle,
    required this.selected,
    required this.onTap,
    this.icon,
    this.hue = Hue.navy,
  });

  final String title;
  final String? subtitle;
  final bool selected;
  final VoidCallback? onTap;

  /// With an icon the tile becomes a large picture card in [hue]; without one it is a radio row.
  final IconData? icon;
  final Hue hue;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final accent = icon == null ? GovColors.navy700 : hue.fg;
    return Semantics(
      inMutuallyExclusiveGroup: true,
      checked: selected,
      button: true,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          boxShadow: selected ? GovColors.softShadow : null,
        ),
        child: Material(
          color: selected ? (icon == null ? GovColors.navy50 : hue.tint) : GovColors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(color: selected ? accent : GovColors.grey500, width: selected ? 2.5 : 1.2),
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: onTap,
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: icon == null ? 56 : 72),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: Row(
                  children: [
                    if (icon != null) ...[
                      IconBadge(icon!, hue: selected ? Hue(GovColors.white, hue.fg) : hue, size: 46),
                      const SizedBox(width: 14),
                    ] else ...[
                      Icon(selected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                          color: selected ? GovColors.navy700 : GovColors.grey600),
                      const SizedBox(width: 12),
                    ],
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(title,
                              style: (icon == null ? t.bodyLarge : t.titleMedium)
                                  ?.copyWith(fontWeight: selected ? FontWeight.w800 : FontWeight.w600)),
                          if (subtitle != null) Text(subtitle!, style: t.bodySmall),
                        ],
                      ),
                    ),
                    if (icon != null)
                      Icon(selected ? Icons.check_circle_rounded : Icons.circle_outlined,
                          color: selected ? accent : GovColors.grey500, size: 26),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// --------------------------------------------------------------------------- buttons
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({super.key, required this.label, required this.onPressed, this.icon, this.busy = false});

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final child = busy
        ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: GovColors.white))
        : Text(label, textAlign: TextAlign.center);
    return SizedBox(
      width: double.infinity,
      child: icon == null || busy
          ? FilledButton(onPressed: busy ? null : onPressed, child: child)
          : FilledButton.icon(onPressed: onPressed, icon: Icon(icon), label: child),
    );
  }
}

class SecondaryButton extends StatelessWidget {
  const SecondaryButton({super.key, required this.label, required this.onPressed, this.icon, this.busy = false, this.danger = false});

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool busy;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final style = danger
        ? OutlinedButton.styleFrom(
            foregroundColor: GovColors.error, side: const BorderSide(color: GovColors.error, width: 1.5))
        : null;
    final child = busy
        ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5))
        : Text(label, textAlign: TextAlign.center);
    return SizedBox(
      width: double.infinity,
      child: icon == null || busy
          ? OutlinedButton(style: style, onPressed: busy ? null : onPressed, child: child)
          : OutlinedButton.icon(style: style, onPressed: onPressed, icon: Icon(icon), label: child),
    );
  }
}

// --------------------------------------------------------------------------- data display
class KeyValueRow extends StatelessWidget {
  const KeyValueRow(this.label, this.value, {super.key, this.mono = false});

  final String label;
  final String? value;
  final bool mono;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final v = (value == null || value!.isEmpty) ? '—' : value!;
    return MergeSemantics(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(width: 130, child: Text(label, style: t.bodySmall?.copyWith(fontWeight: FontWeight.w600))),
            const SizedBox(width: 8),
            Expanded(child: mono ? MonoText(v, size: 14) : Text(v, style: t.bodyMedium)),
          ],
        ),
      ),
    );
  }
}

class LoadingView extends StatelessWidget {
  const LoadingView({super.key, this.message});

  final String? message;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(width: 40, height: 40, child: CircularProgressIndicator(strokeWidth: 3.5, strokeCap: StrokeCap.round)),
              const SizedBox(height: 14),
              Text(message ?? context.l10n.loading, textAlign: TextAlign.center),
            ],
          ),
        ),
      );
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.title, this.message, this.icon = Icons.inbox_outlined});

  final String title;
  final String? message;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(GovTheme.cardRadius),
        color: GovColors.white,
        boxShadow: GovColors.softShadow,
      ),
      child: Column(
        children: [
          IconBadge(icon, hue: Hue.navy, size: 64, circle: true),
          const SizedBox(height: 12),
          Text(title, style: t.titleSmall, textAlign: TextAlign.center),
          if (message != null) ...[
            const SizedBox(height: 4),
            Text(message!, style: t.bodySmall, textAlign: TextAlign.center),
          ],
        ],
      ),
    );
  }
}

/// Human message for an error, in the user's language where the cause is known.
String describeError(BuildContext context, Object error) {
  final l = context.l10n;
  if (error is ApiException) {
    if (error.isNetwork) return l.errorNetwork;
    if (error.status == 401) return l.errorSessionExpired;
    if (error.status == 403) return '${l.errorForbidden} ${error.message}';
    final extra = error.problems.where((p) => p != error.message).toList();
    return extra.isEmpty ? error.message : '${error.message}\n• ${extra.join('\n• ')}';
  }
  return error.toString();
}

class ErrorState extends StatelessWidget {
  const ErrorState({super.key, required this.error, this.onRetry});

  final Object error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return GovNotice(
      tone: Tone.error,
      title: l.somethingWentWrong,
      message: describeError(context, error),
      action: onRetry == null
          ? null
          : TextButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: Text(l.tryAgain)),
    );
  }
}

// --------------------------------------------------------------------------- dialogs
Future<bool> confirmAction(BuildContext context,
    {required String title, required String message, required String confirmLabel, bool danger = false}) async {
  final l = context.l10n;
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.cancel)),
        FilledButton(
          style: danger ? FilledButton.styleFrom(backgroundColor: GovColors.error, minimumSize: const Size(64, 48)) : null,
          onPressed: () => Navigator.pop(ctx, true),
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return ok ?? false;
}

/// Asks for a reason (audited actions). Returns null when cancelled.
Future<String?> askReason(BuildContext context,
    {required String title, String? message, required String confirmLabel, int minLength = 3, String initial = ''}) {
  return showDialog<String>(
    context: context,
    builder: (ctx) => _ReasonDialog(
        title: title, message: message, confirmLabel: confirmLabel, minLength: minLength, initial: initial),
  );
}

class _ReasonDialog extends StatefulWidget {
  const _ReasonDialog(
      {required this.title, this.message, required this.confirmLabel, required this.minLength, required this.initial});

  final String title;
  final String? message;
  final String confirmLabel;
  final int minLength;
  final String initial;

  @override
  State<_ReasonDialog> createState() => _ReasonDialogState();
}

class _ReasonDialogState extends State<_ReasonDialog> {
  late final _c = TextEditingController(text: widget.initial);
  String? _error;

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return AlertDialog(
      title: Text(widget.title),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (widget.message != null) ...[Text(widget.message!), const SizedBox(height: 12)],
            GovTextField(label: l.reason, controller: _c, errorText: _error, maxLines: 3, minLines: 2),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: Text(l.cancel)),
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size(64, 48)),
          onPressed: () {
            final text = _c.text.trim();
            if (text.length < widget.minLength) {
              setState(() => _error = l.reasonTooShort(widget.minLength));
              return;
            }
            Navigator.pop(context, text);
          },
          child: Text(widget.confirmLabel),
        ),
      ],
    );
  }
}

/// Brings an error summary at the top of a form into view (after a failed submit).
void scrollToTop(ScrollController controller) {
  if (!controller.hasClients) return;
  controller.animateTo(0, duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
}

void showMessage(BuildContext context, String text) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(text)));
}
