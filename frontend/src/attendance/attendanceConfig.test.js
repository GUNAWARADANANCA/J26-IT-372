import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEMO_DETECTED_LOCATION,
  ENABLE_DEMO_LOCATION,
  ENABLE_QR_DOOR_TOKEN,
  GEOFENCE_RADIUS_METERS,
  MAX_GPS_ACCURACY_METERS,
  OFFICE_TARGET_LOCATION,
  calculateHaversineMeters,
  evaluateGeofence,
  filterAttendanceOfficers,
} from './attendanceConfig.js'

test('shared attendance configuration defaults match requirements', () => {
  assert.equal(GEOFENCE_RADIUS_METERS, 150)
  assert.equal(MAX_GPS_ACCURACY_METERS, 100)
  assert.equal(ENABLE_QR_DOOR_TOKEN, true)
  assert.equal(ENABLE_DEMO_LOCATION, false)
  assert.deepEqual(OFFICE_TARGET_LOCATION, {
    lat: 6.927763,
    lng: 79.949514,
  })
})

test('Haversine distance and 150m geofence evaluation pass at target and reject > 150m', () => {
  const zeroDistance = calculateHaversineMeters(
    OFFICE_TARGET_LOCATION.lat,
    OFFICE_TARGET_LOCATION.lng,
    OFFICE_TARGET_LOCATION.lat,
    OFFICE_TARGET_LOCATION.lng,
  )
  assert.equal(zeroDistance, 0)

  const withinResult = evaluateGeofence(
    { latitude: OFFICE_TARGET_LOCATION.lat, longitude: OFFICE_TARGET_LOCATION.lng, accuracy: 12 },
    OFFICE_TARGET_LOCATION,
    GEOFENCE_RADIUS_METERS,
  )
  assert.equal(withinResult.meters, 0)
  assert.equal(withinResult.radius, 150)
  assert.equal(withinResult.withinRadius, true)
  assert.equal(withinResult.accuracyFlagged, false)
  assert.equal(withinResult.geofenceStatus, 'Passed')

  // Distance ~127.5m with low accuracy ±212m -> flagged as unverified
  const flaggedResult = evaluateGeofence(
    { latitude: 6.928850, longitude: 79.949514, accuracy: 212 },
    OFFICE_TARGET_LOCATION,
    GEOFENCE_RADIUS_METERS,
  )
  assert.equal(flaggedResult.withinRadius, true)
  assert.equal(flaggedResult.accuracyFlagged, true)
  assert.equal(flaggedResult.geofenceStatus, 'Flagged')

  // > 150 meters away -> Outside
  const outsideResult = evaluateGeofence(
    { latitude: 6.930200, longitude: 79.949573, accuracy: 15 },
    OFFICE_TARGET_LOCATION,
    GEOFENCE_RADIUS_METERS,
  )
  assert.ok(outsideResult.meters > 150)
  assert.equal(outsideResult.withinRadius, false)
  assert.equal(outsideResult.geofenceStatus, 'Outside')
})

test('filterAttendanceOfficers filters by officer name and employee ID', () => {
  const sampleRoster = [
    { name: 'EMP-002', employee_id: 'EMP-002', employee_name: 'Nimal Perera', post_office: 'Kaduwela' },
    { name: 'EMP-001', employee_id: 'EMP-001', employee_name: 'Amal Silva', post_office: 'Kaduwela' },
    { name: 'EMP-003', employee_id: 'EMP-003', employee_name: 'Sunil Fernando', post_office: 'Kaduwela' },
  ]

  const allSorted = filterAttendanceOfficers(sampleRoster, '')
  assert.equal(allSorted.length, 3)
  assert.equal(allSorted[0].employee_name, 'Amal Silva')

  const byName = filterAttendanceOfficers(sampleRoster, 'nimal')
  assert.equal(byName.length, 1)
  assert.equal(byName[0].employee_id, 'EMP-002')

  const byId = filterAttendanceOfficers(sampleRoster, 'EMP-003')
  assert.equal(byId.length, 1)
  assert.equal(byId[0].employee_name, 'Sunil Fernando')
})
