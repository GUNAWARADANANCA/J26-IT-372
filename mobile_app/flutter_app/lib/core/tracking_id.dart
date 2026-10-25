// Registered-item identifiers, e.g. PA-DEMO-7K3M9Q2XRH4.
//
// Mirror of backend/app/services/tracking_id.py: 10 Crockford base-32
// characters plus one check character (value mod 37), so a mistyped ID is
// caught on the phone before it is sent.

const _alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const _checkAlphabet = '$_alphabet*~\$=U';

/// Uppercase, strip spaces, map look-alike characters (O->0, I/L->1) after the last dash.
String normalizeTrackingId(String raw) {
  final text = raw.replaceAll(RegExp(r'\s+'), '').toUpperCase();
  final dash = text.lastIndexOf('-');
  if (dash < 0) return text;
  final tail = text.substring(dash + 1).replaceAll('O', '0').replaceAll('I', '1').replaceAll('L', '1');
  return '${text.substring(0, dash)}-$tail';
}

String? _checkChar(String body) {
  var value = 0;
  for (final ch in body.split('')) {
    final i = _alphabet.indexOf(ch);
    if (i < 0) return null;
    value = (value * 32 + i) % 37;
  }
  return _checkAlphabet[value];
}

/// True when the ID has 10 body characters and a matching check character.
bool isValidTrackingId(String raw) {
  final id = normalizeTrackingId(raw);
  final dash = id.lastIndexOf('-');
  if (dash <= 0) return false;
  final tail = id.substring(dash + 1);
  if (tail.length != 11) return false;
  return _checkChar(tail.substring(0, 10)) == tail[10];
}

/// What a label or receipt code holds: the tracking ID, and on the sender's
/// receipt QR also the access token of the public tracking link
/// (`https://host/track/<ID>#t=<token>`).
class ScannedCode {
  const ScannedCode(this.trackingId, [this.token]);

  final String trackingId;
  final String? token;
}

final _linkPattern = RegExp(r'/track/([^/?#\s]+)[^#\s]*(?:#t=([^&\s]+))?');

ScannedCode parseScannedCode(String raw) {
  final text = raw.trim();
  final m = _linkPattern.firstMatch(text);
  if (m != null) {
    return ScannedCode(normalizeTrackingId(Uri.decodeComponent(m.group(1)!)), m.group(2));
  }
  return ScannedCode(normalizeTrackingId(text));
}
