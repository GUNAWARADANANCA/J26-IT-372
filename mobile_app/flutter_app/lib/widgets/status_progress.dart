import 'package:flutter/material.dart';

import '../core/labels.dart';
import '../l10n/l10n.dart';
import '../theme/gov_theme.dart';

const _forward = ['accepted', 'dispatched', 'in_transit', 'at_destination_office', 'out_for_delivery', 'delivered'];
const _return = ['accepted', 'return_started', 'returned_to_sender'];

/// Where the letter is on its journey: finished steps ticked, current one highlighted.
class StatusProgress extends StatelessWidget {
  const StatusProgress({super.key, required this.status, this.direction = 'forward'});

  final String status;
  final String direction;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final returning = direction == 'return' || status == 'return_started' || status == 'returned_to_sender';
    final steps = returning ? _return : _forward;
    final at = status == 'delivery_attempted' ? steps.indexOf('out_for_delivery') : steps.indexOf(status).clamp(0, 99);
    final finished = status == 'delivered' || status == 'returned_to_sender';
    final warn = status == 'delivery_attempted' || status == 'return_started';

    return Semantics(
      label: '${l.progress}: ${statusLabel(l, status)}',
      excludeSemantics: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < steps.length; i++)
            Expanded(
              child: Column(
                children: [
                  SizedBox(
                    height: 26,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        Row(children: [
                          Expanded(child: Container(height: 2, color: i == 0 ? Colors.transparent : _lineColor(i <= at))),
                          Expanded(
                              child: Container(
                                  height: 2, color: i == steps.length - 1 ? Colors.transparent : _lineColor(i < at))),
                        ]),
                        _dot(i, at, finished, warn, statusHue(status)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    i == at && status == 'delivery_attempted' ? l.stDeliveryAttempted : statusLabel(l, steps[i]),
                    textAlign: TextAlign.center,
                    maxLines: 3,
                    style: TextStyle(
                      fontSize: 11,
                      height: 1.25,
                      fontWeight: i == at ? FontWeight.w700 : FontWeight.w400,
                      color: i <= at ? GovColors.grey900 : GovColors.grey500,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Color _lineColor(bool done) => done ? GovColors.navy600 : GovColors.grey300;

  Widget _dot(int i, int at, bool finished, bool warn, Hue hue) {
    final done = i < at || (finished && i == at);
    final current = i == at && !finished;
    final Color bg;
    final Color border;
    if (done) {
      bg = finished ? GovColors.success : GovColors.navy700;
      border = bg;
    } else if (current) {
      bg = warn ? GovColors.warning : hue.tint;
      border = warn ? GovColors.warning : hue.fg;
    } else {
      bg = GovColors.white;
      border = GovColors.grey300;
    }
    return Container(
      width: current ? 26 : 24,
      height: current ? 26 : 24,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: bg, shape: BoxShape.circle, border: Border.all(color: border, width: current ? 3 : 1.5)),
      child: done
          ? const Icon(Icons.check, size: 14, color: GovColors.white)
          : Text('${i + 1}',
              style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: current ? (warn ? GovColors.white : hue.fg) : GovColors.grey500)),
    );
  }
}
