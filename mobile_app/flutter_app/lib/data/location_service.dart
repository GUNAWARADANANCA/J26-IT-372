// Foreground location for one scan. Records the fix *and* its quality:
// reported accuracy (Android: 68 % radius), fix age, permission state and
// the Android mock-location flag. A missing or stale fix is sent as such -
// never invented (backend: services/location.py).
import 'dart:async';

import 'package:geolocator/geolocator.dart';

class LocationService {
  const LocationService();

  /// Returns the `location` object of a scan event (backend schema LocationIn).
  Future<Map<String, dynamic>> captureFix({Duration timeout = const Duration(seconds: 15)}) async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return {'permission': 'unavailable'};
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        return {'permission': 'denied'};
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: LocationSettings(accuracy: LocationAccuracy.high, timeLimit: timeout),
      );
      final age = DateTime.now().difference(pos.timestamp).inMilliseconds / 1000;
      return {
        'latitude': pos.latitude,
        'longitude': pos.longitude,
        'accuracy_m': pos.accuracy,
        'altitude_m': pos.altitude,
        'fix_age_s': age < 0 ? 0 : age,
        'mock': pos.isMocked,
        'permission': 'granted',
        'provider': 'flutter-geolocator',
      };
    } on TimeoutException {
      return {'permission': 'timeout'};
    } catch (_) {
      return {'permission': 'unavailable'};
    }
  }
}
