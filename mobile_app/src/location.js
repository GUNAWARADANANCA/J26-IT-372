// Foreground location for a scan. Records the fix *and* its quality: reported
// accuracy (Android: 68 % radius), fix age, permission state and the Android
// mock-location flag. A missing or stale fix is sent as such - never invented.
import * as Location from 'expo-location'

export async function captureFix(timeoutMs = 15000) {
  const perm = await Location.requestForegroundPermissionsAsync()
  if (perm.status !== 'granted') return { permission: 'denied' }
  try {
    const fix = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, mayShowUserSettingsDialog: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ])
    return {
      latitude: fix.coords.latitude,
      longitude: fix.coords.longitude,
      accuracy_m: fix.coords.accuracy ?? null,
      altitude_m: fix.coords.altitude ?? null,
      fix_age_s: Math.max(0, (Date.now() - fix.timestamp) / 1000),
      mock: typeof fix.mocked === 'boolean' ? fix.mocked : null,
      permission: 'granted',
      provider: 'expo-location',
    }
  } catch (err) {
    return { permission: err.message === 'timeout' ? 'timeout' : 'unavailable' }
  }
}
