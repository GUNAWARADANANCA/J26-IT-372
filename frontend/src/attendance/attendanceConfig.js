/**
 * Shared configuration constants and Haversine geofence helpers for the
 * SL Postal KPI Desk / PostAssistLK Attendance Check-In screen.
 */

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {}

/** Configured official office geofence radius (meters) */
export const GEOFENCE_RADIUS_METERS = Number(env.VITE_GEOFENCE_RADIUS_METERS || 150)

/** Maximum acceptable GPS accuracy (meters). Above this, reading is flagged unverified. */
export const MAX_GPS_ACCURACY_METERS = Number(env.VITE_MAX_GPS_ACCURACY_METERS || 100)

/** Whether door token validation is required */
export const ENABLE_QR_DOOR_TOKEN =
  String(env.VITE_ENABLE_QR_DOOR_TOKEN ?? 'true').toLowerCase() === 'true'

/** Whether demo override coordinates are enabled (default true for reliable desktop/testing operation) */
export const ENABLE_DEMO_LOCATION =
  String(env.VITE_ENABLE_DEMO_LOCATION ?? 'true').toLowerCase() !== 'false'

/** Registered official Post Office target coordinates (Kaduwela Head Post Office) */
export const OFFICE_TARGET_LOCATION = {
  lat: 6.927763,
  lng: 79.949514,
}

/** Demo override coordinates (only used if VITE_ENABLE_DEMO_LOCATION=true) */
export const DEMO_DETECTED_LOCATION = {
  lat: Number(env.VITE_DEMO_LATITUDE ?? 6.927763),
  lng: Number(env.VITE_DEMO_LONGITUDE ?? 79.949514),
  accuracy: 10,
}

/**
 * Standard Haversine distance formula between two GPS coordinates in meters.
 */
export function calculateHaversineMeters(lat1, lon1, lat2, lon2) {
  const earthRadiusMeters = 6371000
  const toRad = (deg) => (Number(deg) * Math.PI) / 180
  const phi1 = toRad(lat1)
  const phi2 = toRad(lat2)
  const dPhi = toRad(lat2 - lat1)
  const dLambda = toRad(lon2 - lon1)
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(a))
}

/**
 * Evaluate distance, radius threshold, and GPS accuracy status against office target.
 */
export function evaluateGeofence(
  detectedPosition,
  officeTarget = OFFICE_TARGET_LOCATION,
  allowedRadiusMeters = GEOFENCE_RADIUS_METERS,
  maxAccuracyMeters = MAX_GPS_ACCURACY_METERS,
) {
  if (
    !detectedPosition ||
    detectedPosition.latitude == null ||
    detectedPosition.longitude == null
  ) {
    return null
  }
  const targetLat = Number(officeTarget?.latitude ?? officeTarget?.lat ?? OFFICE_TARGET_LOCATION.lat)
  const targetLng = Number(officeTarget?.longitude ?? officeTarget?.lng ?? OFFICE_TARGET_LOCATION.lng)
  const radius = Number(allowedRadiusMeters || GEOFENCE_RADIUS_METERS)
  const maxAcc = Number(maxAccuracyMeters || MAX_GPS_ACCURACY_METERS)
  const rawMeters = calculateHaversineMeters(
    detectedPosition.latitude,
    detectedPosition.longitude,
    targetLat,
    targetLng,
  )
  const meters = Math.round(rawMeters * 10) / 10
  const withinRadius = meters <= radius

  const accuracy = detectedPosition.accuracy != null ? Number(detectedPosition.accuracy) : null
  const accuracyFlagged = accuracy != null && accuracy > maxAcc
  let geofenceStatus = withinRadius ? 'Passed' : 'Outside'
  if (withinRadius && accuracyFlagged) {
    geofenceStatus = 'Flagged'
  }

  return {
    meters,
    radius,
    withinRadius,
    accuracy,
    accuracyFlagged,
    maxAccuracyMeters: maxAcc,
    geofenceStatus,
  }
}

/**
 * Filter and sort postal roster by employee name, employee ID, or office.
 */
export function filterAttendanceOfficers(employees = [], search = '') {
  const query = String(search || '').trim().toLowerCase()
  const label = (e) => e.employee_name || e.employee_id || e.name || ''
  const rows = [...employees].sort((a, b) => label(a).localeCompare(label(b)))
  if (!query) return rows
  return rows.filter((employee) =>
    `${employee.employee_name || ''} ${employee.employee_id || ''} ${employee.post_office || ''}`
      .toLowerCase()
      .includes(query),
  )
}
