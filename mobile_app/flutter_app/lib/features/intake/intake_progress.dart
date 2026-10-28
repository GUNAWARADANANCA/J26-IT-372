/// Which of the five registration stages are finished (same rule as the web
/// app's IntakeProgress.jsx). Manual entry (B0) needs no photo; the last stage
/// ends by accepting the letter.
List<bool> intakeProgress(Map draft) {
  final r = (draft['recipient'] as Map?) ?? const {};
  String v(String k) => '${r[k] ?? ''}'.trim();
  return [
    draft['current_image_id'] != null || draft['experiment_config'] == 'B0',
    v('name').isNotEmpty && (v('city').isNotEmpty || v('postcode').isNotEmpty),
    draft['fields_confirmed_at'] != null,
    draft['weight'] != null,
    false,
  ];
}

/// Address fields in form order (backend services/address/parser.py FIELDS).
const addressFields = ['name', 'house_number', 'street', 'locality', 'city', 'postcode', 'region'];

final _email = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
final _phone = RegExp(r'^(\+94|0)7\d{8}$');

bool validEmail(String v) => _email.hasMatch(v.trim());

bool validSriLankaMobile(String v) => _phone.hasMatch(v.replaceAll(RegExp(r'[\s-]'), ''));
