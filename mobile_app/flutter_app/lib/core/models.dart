// Small typed views of the API objects the app keeps between screens.
// Screens that only display server data read the JSON maps directly.

class StatusOption {
  const StatusOption(this.status, this.label);

  final String status;
  final String label;

  factory StatusOption.fromJson(Map<String, dynamic> j) => StatusOption(j['status'] as String, j['label'] as String? ?? '');

  Map<String, dynamic> toJson() => {'status': status, 'label': label};
}

class Roles {
  static const admin = 'admin';
  static const postmaster = 'postmaster';
  static const counter = 'counter_officer';
  static const hub = 'hub_officer';
  static const postman = 'postman';

  /// Roles allowed to record field scans (backend: routers/scans.py field_roles).
  static const scanning = [postmaster, counter, hub, postman];
  static const intake = [counter, postmaster];
}

class StaffUser {
  const StaffUser({
    required this.username,
    required this.fullName,
    required this.role,
    required this.officeId,
    this.officeName,
    this.beatPostcodes = const [],
    this.statuses = const [],
  });

  final String username;
  final String fullName;
  final String role;
  final String officeId;
  final String? officeName;
  final List<String> beatPostcodes;

  /// Statuses this role may record; used to offer choices when offline.
  final List<StatusOption> statuses;

  String get office => officeName ?? officeId;

  /// Admin may do everything (backend: security.require_roles).
  bool can(List<String> roles) => role == Roles.admin || roles.contains(role);

  StaffUser copyWith({String? officeName, List<StatusOption>? statuses}) => StaffUser(
        username: username,
        fullName: fullName,
        role: role,
        officeId: officeId,
        officeName: officeName ?? this.officeName,
        beatPostcodes: beatPostcodes,
        statuses: statuses ?? this.statuses,
      );

  factory StaffUser.fromJson(Map<String, dynamic> j) => StaffUser(
        username: j['username'] as String,
        fullName: j['full_name'] as String? ?? j['username'] as String,
        role: j['role'] as String,
        officeId: j['office_id'] as String? ?? '',
        officeName: j['office_name'] as String?,
        beatPostcodes: [for (final p in (j['beat_postcodes'] as List? ?? const [])) '$p'],
        statuses: [
          for (final s in (j['statuses'] as List? ?? const [])) StatusOption.fromJson(Map<String, dynamic>.from(s as Map)),
        ],
      );

  Map<String, dynamic> toJson() => {
        'username': username,
        'full_name': fullName,
        'role': role,
        'office_id': officeId,
        'office_name': officeName,
        'beat_postcodes': beatPostcodes,
        'statuses': [for (final s in statuses) s.toJson()],
      };
}
