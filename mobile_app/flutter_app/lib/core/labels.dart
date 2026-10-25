// Plain-language, translated names for the codes the API returns
// (mail status, scan decision, location result, message state, roles...).
// Unknown codes fall back to the code itself with underscores removed.
import 'package:flutter/material.dart';

import '../l10n/l10n.dart';
import '../theme/gov_theme.dart';

String _plain(String code) => code.replaceAll('_', ' ');

String statusLabel(AppLocalizations l, String? code) => switch (code) {
      'accepted' => l.stAccepted,
      'dispatched' => l.stDispatched,
      'in_transit' => l.stInTransit,
      'at_destination_office' => l.stAtDestination,
      'out_for_delivery' => l.stOutForDelivery,
      'delivery_attempted' => l.stDeliveryAttempted,
      'delivered' => l.stDelivered,
      'return_started' => l.stReturnStarted,
      'returned_to_sender' => l.stReturnedToSender,
      null => '—',
      _ => _plain(code),
    };

Tone statusTone(String? code) => switch (code) {
      'delivered' => Tone.success,
      'out_for_delivery' || 'delivery_attempted' => Tone.warning,
      'return_started' => Tone.error,
      'returned_to_sender' => Tone.neutral,
      _ => Tone.info,
    };

/// Picture for each stage of the journey, shown next to its name.
IconData statusIcon(String? code) => switch (code) {
      'accepted' => Icons.inventory_2_outlined,
      'dispatched' => Icons.local_shipping_outlined,
      'in_transit' => Icons.swap_horiz_rounded,
      'at_destination_office' => Icons.storefront_outlined,
      'out_for_delivery' => Icons.delivery_dining_outlined,
      'delivery_attempted' => Icons.schedule_rounded,
      'delivered' => Icons.check_circle_outline_rounded,
      'return_started' => Icons.undo_rounded,
      'returned_to_sender' => Icons.assignment_return_outlined,
      _ => Icons.mail_outline_rounded,
    };

Hue statusHue(String? code) => switch (code) {
      'accepted' => Hue.slate,
      'dispatched' => Hue.blue,
      'in_transit' => Hue.purple,
      'at_destination_office' => Hue.teal,
      'out_for_delivery' => Hue.orange,
      'delivery_attempted' => Hue.orange,
      'delivered' => Hue.green,
      'return_started' || 'returned_to_sender' => Hue.rose,
      _ => Hue.navy,
    };

String roleLabel(AppLocalizations l, String role) => switch (role) {
      'admin' => l.roleAdmin,
      'postmaster' => l.rolePostmaster,
      'counter_officer' => l.roleCounter,
      'hub_officer' => l.roleHub,
      'postman' => l.rolePostman,
      _ => _plain(role),
    };

String decisionLabel(AppLocalizations l, String? code) => switch (code) {
      'accepted' => l.decAccepted,
      'accepted_after_review' => l.decAcceptedAfterReview,
      'held_for_review' || 'held' => l.decHeld,
      'rejected_after_review' => l.decRejectedAfterReview,
      'rejected' => l.decRejected,
      'duplicate' => l.decDuplicate,
      'pending' => l.decPending,
      null => '—',
      _ => _plain(code),
    };

Tone decisionTone(String? code) => switch (code) {
      'accepted' || 'accepted_after_review' || 'duplicate' => Tone.success,
      'held_for_review' || 'held' || 'pending' => Tone.warning,
      'rejected' || 'rejected_after_review' => Tone.error,
      _ => Tone.neutral,
    };

String locationLabel(AppLocalizations l, String? code) => switch (code) {
      'consistent' => l.locConsistent,
      'uncertain' => l.locUncertain,
      'mismatch' => l.locMismatch,
      'unlocated' => l.locUnlocated,
      'not_assessed' => l.locNotAssessed,
      null => '—',
      _ => _plain(code),
    };

Tone locationTone(String? code) => switch (code) {
      'consistent' => Tone.success,
      'uncertain' => Tone.warning,
      'mismatch' => Tone.error,
      _ => Tone.neutral,
    };

String outboxLabel(AppLocalizations l, String? code) => switch (code) {
      'queued' => l.obQueued,
      'retry' => l.obRetry,
      'sending' => l.obSending,
      'provider_accepted' => l.obSent,
      'ambiguous' => l.obAmbiguous,
      'failed_permanent' => l.obFailed,
      'resolved_manually' => l.obResolved,
      null => '—',
      _ => _plain(code),
    };

Tone outboxTone(String? code) => switch (code) {
      'provider_accepted' => Tone.success,
      'retry' => Tone.warning,
      'ambiguous' || 'failed_permanent' => Tone.error,
      'sending' => Tone.info,
      _ => Tone.neutral,
    };

String channelLabel(AppLocalizations l, String? code) => switch (code) {
      'email' => l.channelEmail,
      'sms' => l.channelSms,
      'none' => l.channelNone,
      _ => _plain(code ?? ''),
    };

String languageName(String code) => switch (code) {
      'si' => 'සිංහල',
      'ta' => 'தமிழ்',
      'en' => 'English',
      _ => code,
    };

/// Image-quality issues from the server's quality gate (services/ocr/quality.py).
String qualityIssue(AppLocalizations l, Map issue) => switch (issue['code']) {
      'LOW_RESOLUTION' => l.qLowResolution,
      'BLURRY' => l.qBlurry,
      'TOO_DARK' => l.qTooDark,
      'TOO_BRIGHT' => l.qTooBright,
      'LOW_CONTRAST' => l.qLowContrast,
      'GLARE' => l.qGlare,
      _ => '${issue['message'] ?? issue['code']}',
    };

/// Why a scale reading cannot be used yet (services/weighing.py).
String weightProblem(AppLocalizations l, Map problem) => switch (problem['code']) {
      'NO_READING' => l.wpNoReading,
      'STALE_READING' => l.wpStale,
      'SENSOR_FAULT' => l.wpSensorFault,
      'NEEDS_TARE' => l.wpNeedsTare,
      'UNCALIBRATED' => l.wpUncalibrated,
      'PLATFORM_EMPTY' => l.wpEmpty,
      'UNSTABLE' => l.wpUnstable,
      'NEGATIVE' => l.wpNegative,
      _ => '${problem['message'] ?? problem['code']}',
    };

String severityLabel(AppLocalizations l, String? code) => switch (code) {
      'info' => l.sevInfo,
      'warning' => l.sevWarning,
      'security' => l.sevSecurity,
      _ => _plain(code ?? ''),
    };

Tone severityTone(String? code) => switch (code) {
      'warning' => Tone.warning,
      'security' => Tone.error,
      _ => Tone.neutral,
    };

String paymentLabel(AppLocalizations l, String? code) => switch (code) {
      'cash' => l.payCash,
      'card' => l.payCard,
      'other' => l.payOther,
      _ => _plain(code ?? ''),
    };

String ackTypeLabel(AppLocalizations l, String? code) => switch (code) {
      'signature' => l.ackSignature,
      'recipient_name' => l.ackNameOnly,
      'paper_sheet' => l.ackSheet,
      _ => _plain(code ?? ''),
    };
