import 'package:flutter/material.dart';

import '../theme/gov_theme.dart';

class TimelineEntry {
  const TimelineEntry({required this.title, required this.time, this.lines = const [], this.tags = const [], this.tone = Tone.info});

  final String title;
  final String time;
  final List<String> lines;
  final List<Widget> tags;
  final Tone tone;
}

/// Vertical list of events, newest last, each with a dot, title, time and details.
class Timeline extends StatelessWidget {
  const Timeline({super.key, required this.entries});

  final List<TimelineEntry> entries;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Column(
      children: [
        for (var i = 0; i < entries.length; i++)
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  width: 24,
                  child: Column(
                    children: [
                      const SizedBox(height: 4),
                      Container(
                        width: 14,
                        height: 14,
                        decoration: BoxDecoration(
                          color: entries[i].tone.fg,
                          shape: BoxShape.circle,
                          border: Border.all(color: GovColors.white, width: 2),
                        ),
                      ),
                      if (i < entries.length - 1) Expanded(child: Container(width: 2, color: GovColors.line)),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: MergeSemantics(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(entries[i].title, style: t.titleSmall),
                          Text(entries[i].time, style: t.bodySmall),
                          for (final line in entries[i].lines) Text(line, style: t.bodyMedium),
                          if (entries[i].tags.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Wrap(spacing: 6, runSpacing: 6, children: entries[i].tags),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
