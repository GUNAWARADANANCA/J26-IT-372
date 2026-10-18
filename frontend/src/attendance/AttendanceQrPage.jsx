import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  KeyRound,
  LogIn,
  LogOut,
  Navigation,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react'
import {
  currentUser,
  getAttendanceLocationInfo,
  getAttendanceRoster,
  login,
  scanAttendance,
  validateAttendanceLocation,
  verifyAttendanceToken,
} from '../admin/data/repository'
import {
  DEMO_DETECTED_LOCATION,
  ENABLE_DEMO_LOCATION,
  ENABLE_QR_DOOR_TOKEN,
  GEOFENCE_RADIUS_METERS,
  MAX_GPS_ACCURACY_METERS,
  OFFICE_TARGET_LOCATION,
  evaluateGeofence,
  filterAttendanceOfficers,
} from './attendanceConfig'


const LOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 5000,
}

const DOOR_CODE_KEY = 'postassist-door-code'
const QR_LOCATION_KEY = 'postassist-qr-location'

function requestLocation() {
  return new Promise((resolve, reject) => {
    if (
      !window.isSecureContext &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      reject(new Error('Open the attendance page over HTTPS, then allow browser GPS location access.'))
      return
    }
    if (!navigator.geolocation) {
      reject(new Error('This mobile browser does not support GPS geolocation.'))
      return
    }

    let settled = false
    let watchId = null
    const finish = (ok, value) => {
      if (settled) return
      settled = true
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
      if (ok) resolve(value)
      else reject(value)
    }

    const onSuccess = (position) => finish(true, position)
    const onError = (error) => {
      if (error.code === error.PERMISSION_DENIED) {
        finish(
          false,
          new Error(
            'GPS Location Permission Denied: Please allow location access in your mobile browser settings and tap Refresh Location.',
          ),
        )
        return
      }
      if (error.code === error.TIMEOUT) {
        finish(
          false,
          new Error(
            'GPS signal timed out. Step outdoors or near an open doorway with clear sky visibility and tap Refresh Location.',
          ),
        )
        return
      }
      finish(
        false,
        new Error('Unable to detect mobile GPS coordinates. Ensure device Location / High Accuracy mode is enabled.'),
      )
    }

    watchId = navigator.geolocation.watchPosition(onSuccess, onError, LOCATION_OPTIONS)
    navigator.geolocation.getCurrentPosition(onSuccess, onError, LOCATION_OPTIONS)
  })
}

function employeeLabel(employee) {
  return employee.employee_name || employee.employee_id || employee.name
}

function extractUrlParams() {
  const params = new URLSearchParams(window.location.search)
  let code = (params.get('code') || '').trim()
  let locationId = (params.get('location') || params.get('location_id') || '').trim()

  if (!code) {
    const raw = window.location.hash.replace(/^#/, '')
    if (raw) {
      try {
        code = decodeURIComponent(raw).trim()
      } catch {
        code = raw.trim()
      }
    }
  }
  const hashAt = code.lastIndexOf('#')
  if (hashAt >= 0) code = code.slice(hashAt + 1).trim()

  if (code) {
    sessionStorage.setItem(DOOR_CODE_KEY, code)
  } else {
    code = sessionStorage.getItem(DOOR_CODE_KEY) || ''
  }

  if (locationId) {
    sessionStorage.setItem(QR_LOCATION_KEY, locationId)
  } else {
    locationId = sessionStorage.getItem(QR_LOCATION_KEY) || ''
  }

  return { code, locationId }
}

export default function AttendanceQrPage() {
  const initialParams = useMemo(() => extractUrlParams(), [])
  const [doorToken] = useState(initialParams.code)
  const [qrLocationId, setQrLocationId] = useState(initialParams.locationId)
  const [officeConfig, setOfficeConfig] = useState(null)
  const [authUser, setAuthUser] = useState(null)

  const [step, setStep] = useState('locating') // 'locating' | 'ready' | 'blocked' | 'done'
  const [position, setPosition] = useState(() =>
    ENABLE_DEMO_LOCATION
      ? {
          latitude: DEMO_DETECTED_LOCATION.lat,
          longitude: DEMO_DETECTED_LOCATION.lng,
          accuracy: DEMO_DETECTED_LOCATION.accuracy,
          isDemo: true,
        }
      : null,
  )
  const [validation, setValidation] = useState(null)
  const [tokenStatus, setTokenStatus] = useState(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [employees, setEmployees] = useState([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [savingAction, setSavingAction] = useState('')
  const [result, setResult] = useState(null)
  const [liveClock, setLiveClock] = useState(() => new Date())
  const errorRef = useRef(null)

  // In-page authentication modal/form state
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authUsername, setAuthUsername] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authSubmitting, setAuthSubmitting] = useState(false)

  // Clean token from URL bar while preserving sessionStorage
  useEffect(() => {
    if (!window.location.hash && !new URLSearchParams(window.location.search).get('code')) return
    window.history.replaceState(null, '', window.location.pathname)
  }, [])

  // Live Colombo clock ticker
  useEffect(() => {
    const timer = setInterval(() => setLiveClock(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [error])

  const colomboDateString = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Colombo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(liveClock)
    } catch {
      return liveClock.toISOString().slice(0, 10)
    }
  }, [liveClock])

  const colomboTimeString = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Colombo',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(liveClock)
    } catch {
      return liveClock.toLocaleTimeString()
    }
  }, [liveClock])

  const matches = useMemo(() => {
    return filterAttendanceOfficers(employees, search)
  }, [employees, search])

  const selectedEmployee = useMemo(() => {
    return employees.find((e) => (e.name || e.employee_id) === selectedEmployeeId) || null
  }, [employees, selectedEmployeeId])

  // Official Office Target Coordinates and Configured Geofence Radius
  const officeTarget = useMemo(() => {
    return {
      latitude: officeConfig?.latitude ?? OFFICE_TARGET_LOCATION.lat,
      longitude: officeConfig?.longitude ?? OFFICE_TARGET_LOCATION.lng,
    }
  }, [officeConfig])

  const radiusThreshold = useMemo(() => {
    return officeConfig?.radius_meters || GEOFENCE_RADIUS_METERS
  }, [officeConfig])

  const accuracyThreshold = useMemo(() => {
    return officeConfig?.max_accuracy_meters || MAX_GPS_ACCURACY_METERS
  }, [officeConfig])

  // Client-side Haversine distance, radius, and accuracy verification
  const distanceInfo = useMemo(() => {
    if (!position) return null
    return evaluateGeofence(position, officeTarget, radiusThreshold, accuracyThreshold)
  }, [position, officeTarget, radiusThreshold, accuracyThreshold])

  async function checkTokenValidity(tokenToCheck = doorToken, locId = qrLocationId) {
    if (!ENABLE_QR_DOOR_TOKEN) {
      setTokenStatus({ valid: true, expiresIn: null })
      return true
    }
    if (!tokenToCheck) {
      setTokenStatus({
        valid: false,
        message: 'No QR door token found. Please scan the Post Office entrance QR code.',
      })
      return false
    }
    try {
      const verified = await verifyAttendanceToken({
        doorToken: tokenToCheck,
        qrLocationId: locId || undefined,
      })
      setTokenStatus({
        valid: true,
        expiresIn: verified.expires_in_seconds,
      })
      return true
    } catch (err) {
      setTokenStatus({
        valid: false,
        message: err.message || 'The QR door code has expired or is invalid. Please scan the entrance terminal.',
      })
      return false
    }
  }

  async function detectAndValidateGps(locId = qrLocationId) {
    setError('')
    setStep('locating')
    try {
      // Load session user (if signed in), office config, and employee roster in parallel
      const [configRes, rosterRes, userRes] = await Promise.allSettled([
        getAttendanceLocationInfo(locId),
        getAttendanceRoster(),
        currentUser(),
      ])

      // Populate roster with live today status
      if (rosterRes.status === 'fulfilled' && Array.isArray(rosterRes.value)) {
        setEmployees(rosterRes.value)
        if (!selectedEmployeeId && rosterRes.value.length > 0) {
          setSelectedEmployeeId(rosterRes.value[0].name || rosterRes.value[0].employee_id)
        }
      }

      // Check authenticated user
      let loggedInUser = null
      if (userRes.status === 'fulfilled' && userRes.value) {
        loggedInUser = userRes.value
        setAuthUser(loggedInUser)
      }

      let config = {
        office_id: 'PO-KADUWELA',
        office_name: 'Kaduwela Head Post Office',
        qr_location_id: locId || 'LOC-KADUWELA-01',
        latitude: OFFICE_TARGET_LOCATION.lat,
        longitude: OFFICE_TARGET_LOCATION.lng,
        radius_meters: GEOFENCE_RADIUS_METERS,
        max_accuracy_meters: MAX_GPS_ACCURACY_METERS,
        on_time_start: '06:00',
        on_time_end: '08:40',
        late_start: '08:40',
        late_end: '11:00',
        half_day_start: '12:00',
        half_day_end: '14:00',
        checkout_start: '16:00',
        checkout_end: '22:00',
      }
      if (configRes.status === 'fulfilled' && configRes.value) {
        config = configRes.value
      } else if (configRes.status === 'rejected') {
        const msg = configRes.reason?.message || ''
        if (/deactivated|unrecognized/i.test(msg)) {
          throw configRes.reason
        }
      }
      setOfficeConfig(config)
      const resolvedLoc = locId || config.qr_location_id
      if (!locId && config.qr_location_id) {
        setQrLocationId(config.qr_location_id)
      }

      // Check door token validity
      if (ENABLE_QR_DOOR_TOKEN) {
        await checkTokenValidity(doorToken, resolvedLoc)
      }

      // Request fresh GPS location using device browser Geolocation
      let latitude
      let longitude
      let accuracy
      if (ENABLE_DEMO_LOCATION) {
        latitude = DEMO_DETECTED_LOCATION.lat
        longitude = DEMO_DETECTED_LOCATION.lng
        accuracy = DEMO_DETECTED_LOCATION.accuracy
        setPosition({ latitude, longitude, accuracy, isDemo: true })
      } else {
        const reading = await requestLocation()
        latitude = reading.coords.latitude
        longitude = reading.coords.longitude
        accuracy = reading.coords.accuracy
        setPosition({ latitude, longitude, accuracy, isDemo: false })
      }

      const localEval = evaluateGeofence(
        { latitude, longitude, accuracy },
        { latitude: config.latitude, longitude: config.longitude },
        config.radius_meters || GEOFENCE_RADIUS_METERS,
        config.max_accuracy_meters || MAX_GPS_ACCURACY_METERS,
      )

      try {
        const check = await validateAttendanceLocation({
          latitude,
          longitude,
          accuracy,
          qrLocationId: resolvedLoc,
        })
        setValidation({
          ...check,
          distance_meters: localEval.meters,
          radius_meters: config.radius_meters || GEOFENCE_RADIUS_METERS,
          within_radius: localEval.withinRadius,
          accuracy_flagged: localEval.accuracyFlagged,
        })
      } catch {
        setValidation({
          distance_meters: localEval.meters,
          radius_meters: config.radius_meters || GEOFENCE_RADIUS_METERS,
          within_radius: localEval.withinRadius,
          accuracy_flagged: localEval.accuracyFlagged,
          geofence_status: localEval.geofenceStatus,
        })
      }

      if (!localEval.withinRadius) {
        setError(
          `You are outside the permitted office attendance area (${localEval.meters}m away). Please move within ${config.radius_meters || GEOFENCE_RADIUS_METERS} meters of ${config.office_name} and tap Refresh Location.`,
        )
        setStep('blocked')
        return
      }

      setStep('ready')
    } catch (err) {
      setError(err.message || 'Location verification failed.')
      setStep('blocked')
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    detectAndValidateGps(qrLocationId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLoginSubmit(e) {
    e.preventDefault()
    if (!authUsername.trim() || !authPassword.trim()) {
      setAuthError('Enter your username and password.')
      return
    }
    setAuthSubmitting(true)
    setAuthError('')
    try {
      const logged = await login(authUsername.trim(), authPassword.trim())
      setAuthUser(logged)
      setShowAuthModal(false)
      // If logged in username matches an employee, select it
      const match = employees.find(
        (emp) =>
          (emp.employee_id || '').toLowerCase() === logged.username.toLowerCase() ||
          (emp.name || '').toLowerCase() === logged.username.toLowerCase(),
      )
      if (match) {
        setSelectedEmployeeId(match.name || match.employee_id)
      }
    } catch (err) {
      setAuthError(err.message || 'Sign in failed. Check your credentials.')
    } finally {
      setAuthSubmitting(false)
    }
  }

  async function handleAttendanceAction(actionType) {
    if (!position || !selectedEmployee || savingAction) return

    // 1. Check geofence radius boundary
    if (distanceInfo && !distanceInfo.withinRadius) {
      setError(
        `You are outside the permitted office attendance area (${distanceInfo.meters}m away). Please move within ${radiusThreshold} meters of the registered post office and try again.`,
      )
      return
    }

    // 2. Check GPS accuracy threshold (Do not accept ±212m without warning)
    if (distanceInfo && distanceInfo.accuracyFlagged) {
      setError(
        `GPS Accuracy Warning: Detected accuracy is ±${Math.round(position.accuracy)}m, exceeding the maximum allowed threshold (±${accuracyThreshold}m). A low-accuracy reading cannot be confidently verified inside the ${radiusThreshold}m geofence. Please move outdoors or near an open doorway and tap Refresh Location.`,
      )
      return
    }

    // 3. Check door token if required
    if (ENABLE_QR_DOOR_TOKEN && tokenStatus && !tokenStatus.valid) {
      setError(
        tokenStatus.message ||
          'A valid entrance QR code verification token is required. Please scan the QR terminal at the post office entrance.',
      )
      return
    }

    // 4. Duplicate prevention checks
    if (actionType === 'in' && selectedEmployee.today_check_in) {
      setError(
        `This employee has already checked in today at ${selectedEmployee.today_check_in}. Duplicate check-in is not permitted.`,
      )
      return
    }

    if (actionType === 'out' && selectedEmployee.today_check_out) {
      setError(
        `This employee has already checked out today at ${selectedEmployee.today_check_out}. Duplicate check-out is not permitted.`,
      )
      return
    }

    const id = selectedEmployee.name || selectedEmployee.employee_id
    setSavingAction(actionType)
    setError('')
    try {
      const saved = await scanAttendance({
        employeeId: id,
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        doorToken: ENABLE_QR_DOOR_TOKEN ? doorToken : 'QR_TOKEN_DISABLED',
        qrLocationId: qrLocationId || officeConfig?.qr_location_id,
        action: actionType,
        deviceInfo: navigator.userAgent,
      })
      setResult({
        ...saved,
        employee_name: saved.employee_name || employeeLabel(selectedEmployee),
      })
      // Refresh roster to update live status badges
      getAttendanceRoster()
        .then((rows) => {
          if (Array.isArray(rows)) setEmployees(rows)
        })
        .catch(() => {})
      setStep('done')
    } catch (err) {
      setError(err.message || 'Could not record attendance.')
    } finally {
      setSavingAction('')
    }
  }

  // Automatic smart action recommendation:
  // If no check-in today: Check-In. If checked in but not checked out: Check-Out.
  const recommendedAction = useMemo(() => {
    if (!selectedEmployee) return 'in'
    if (!selectedEmployee.today_check_in) return 'in'
    if (selectedEmployee.today_check_in && !selectedEmployee.today_check_out) return 'out'
    return 'done'
  }, [selectedEmployee])

  const eligibility = validation?.eligibility || officeConfig?.eligibility || {
    window: 'on_time',
    label: 'Active Attendance Window',
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0B1F3A] via-[#102A4C] to-[#F4F7FB] px-3 py-4 sm:px-4 sm:py-6">
      <div className="mx-auto max-w-md space-y-3">
        {/* Top SL Postal KPI Desk Branding Banner */}
        <div className="rounded-2xl border border-white/15 bg-[#0B1F3A]/90 p-3.5 text-white shadow-lg backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-[#1677D2] text-white shadow-inner">
                <QrCode className="size-4.5" />
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-widest text-sky-300">
                  SL POSTAL KPI DESK · POSTASSIST LK
                </span>
                <h1 className="text-base font-extrabold tracking-tight text-white">
                  Employee QR Attendance
                </h1>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
              <ShieldCheck className="size-3.5" /> GPS Geofenced
            </span>
          </div>

          {/* Office & Live Time Bar */}
          <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/5 p-2 text-xs">
            <div className="flex items-start gap-2">
              <Building2 className="mt-0.5 size-4 shrink-0 text-sky-300" />
              <div>
                <span className="block text-[10px] text-slate-300">Post Office Location</span>
                <span className="font-bold text-white">
                  {officeConfig?.office_name || 'Kaduwela Head Post Office'}
                </span>
                <span className="block font-mono text-[10px] text-sky-300">
                  ID: {qrLocationId || officeConfig?.qr_location_id || 'LOC-KADUWELA-01'}
                </span>
              </div>
            </div>
            <div className="flex items-start gap-2 border-l border-white/10 pl-2.5">
              <Clock className="mt-0.5 size-4 shrink-0 text-amber-300" />
              <div>
                <span className="block text-[10px] text-slate-300">Colombo Date & Time</span>
                <span className="font-bold text-white">{colomboTimeString}</span>
                <span className="block text-[10px] text-slate-300">{colomboDateString}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Mobile Card */}
        <div className="rounded-2xl border border-[#DFE8F2] bg-white p-3.5 shadow-xl sm:p-4">
          {/* Current Time Window Eligibility Pill */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#DFE8F2] bg-[#F8FAFC] px-3 py-1.5">
            <span className="text-[11px] font-semibold text-[#64748B]">Attendance Window:</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                eligibility.window === 'on_time'
                  ? 'bg-emerald-100 text-emerald-800'
                  : eligibility.window === 'late'
                  ? 'bg-amber-100 text-amber-800'
                  : eligibility.window === 'half_day'
                  ? 'bg-blue-100 text-blue-800'
                  : eligibility.window === 'checkout'
                  ? 'bg-indigo-100 text-indigo-800'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {eligibility.label}
            </span>
          </div>

          {/* Confirmation Screen when Attendance is Recorded */}
          {step === 'done' && result && !error ? (
            <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    GEOFENCE & QR VERIFIED
                  </span>
                  <h2 className="text-base font-extrabold text-emerald-950">
                    Attendance Recorded Successfully
                  </h2>
                </div>
              </div>

              <div className="space-y-1.5 rounded-xl border border-emerald-200 bg-white p-3 text-xs">
                <div className="flex justify-between py-0.5">
                  <span className="text-[#64748B]">Employee:</span>
                  <span className="font-bold text-[#172B4D]">
                    {result.employee_name} ({result.employee_id})
                  </span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-[#64748B]">Location:</span>
                  <span className="font-semibold text-[#172B4D]">
                    {result.post_office || officeConfig?.office_name || 'Kaduwela Post Office'}
                  </span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-[#64748B]">Action & Time:</span>
                  <span className="font-bold text-[#1677D2]">
                    {result.action === 'in' ? 'Check-In' : 'Check-Out'} at {result.time} ({result.date})
                  </span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-[#64748B]">Distance from Office:</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {result.distance_meters} meters
                  </span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-[#64748B]">GPS Validation:</span>
                  <span className="font-bold text-emerald-700">
                    {result.geofence_status || 'Passed'} (Within {result.radius_meters || radiusThreshold}m)
                  </span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-[#64748B]">Attendance Status:</span>
                  <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                    {result.status === 'On time' ? 'Present / On Time' : result.status || 'Recorded'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setResult(null)
                  setError('')
                  setStep('ready')
                }}
                className="w-full rounded-xl bg-[#1677D2] py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#125ea7]"
              >
                Record Another Officer
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* 1. Officer Selection & Authentication Status */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-[#172B4D]">
                    Postal Officer Identity ({employees.length})
                  </label>
                  {authUser ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      <UserCheck className="size-3" /> Signed in: {authUser.username}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowAuthModal(!showAuthModal)}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-[#1677D2] hover:underline"
                    >
                      <KeyRound className="size-3" /> Sign in with credentials
                    </button>
                  )}
                </div>

                {/* In-page authentication modal/panel */}
                {showAuthModal && !authUser && (
                  <form
                    onSubmit={handleLoginSubmit}
                    className="mt-2 rounded-xl border border-sky-200 bg-sky-50/60 p-3 text-xs"
                  >
                    <div className="font-bold text-[#0B1F3A]">Postal Account Sign-In</div>
                    <p className="mt-0.5 text-[10px] text-[#64748B]">
                      Sign in with your postal officer credentials to securely verify your identity.
                    </p>
                    {authError && (
                      <div className="mt-1.5 rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-[10px] text-rose-800">
                        {authError}
                      </div>
                    )}
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Username / Officer ID"
                        value={authUsername}
                        onChange={(e) => setAuthUsername(e.target.value)}
                        className="rounded-lg border border-[#DFE8F2] bg-white px-2 py-1 text-xs"
                      />
                      <input
                        type="password"
                        placeholder="Password"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        className="rounded-lg border border-[#DFE8F2] bg-white px-2 py-1 text-xs"
                      />
                    </div>
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAuthModal(false)}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={authSubmitting}
                        className="rounded-lg bg-[#1677D2] px-3 py-1 text-[11px] font-bold text-white hover:bg-[#125ea7] disabled:opacity-50"
                      >
                        {authSubmitting ? 'Verifying…' : 'Authenticate'}
                      </button>
                    </div>
                  </form>
                )}

                <div className="relative mt-1.5">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter by officer name or ID…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE8F2] bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-[#172B4D] focus:border-[#1677D2] focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="mt-1.5 max-h-36 space-y-1 overflow-y-auto pr-1">
                  {matches.length === 0 ? (
                    <p className="py-3 text-center text-xs text-[#64748B]">
                      No matching employee found in roster.
                    </p>
                  ) : (
                    matches.map((emp) => {
                      const id = emp.name || emp.employee_id
                      const isSelected = id === selectedEmployeeId
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setSelectedEmployeeId(id)
                            setError('')
                          }}
                          className={`flex w-full items-center justify-between rounded-xl border px-3 py-1.5 text-left transition-all ${
                            isSelected
                              ? 'border-[#1677D2] bg-blue-50/80 shadow-2xs'
                              : 'border-[#DFE8F2] bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold text-[#172B4D]">
                              {employeeLabel(emp)}
                            </div>
                            <div className="text-[10px] text-[#64748B]">
                              {emp.employee_id} · {emp.post_office || 'Kaduwela'}
                              {emp.today_check_in && (
                                <span className="ml-1.5 font-semibold text-emerald-700">
                                  • In: {emp.today_check_in}
                                </span>
                              )}
                              {emp.today_check_out && (
                                <span className="ml-1.5 font-semibold text-[#1677D2]">
                                  • Out: {emp.today_check_out}
                                </span>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <span className="rounded-full bg-[#1677D2] px-2 py-0.5 text-[10px] font-bold text-white">
                              Selected
                            </span>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>

              {/* 2. Automatic GPS Geofence Check Card */}
              <div className="rounded-xl border border-[#DFE8F2] bg-[#F8FAFC] p-3">
                <div className="flex items-center justify-between border-b border-[#DFE8F2] pb-2">
                  <div className="flex items-center gap-1.5">
                    <Navigation className="size-4 text-[#1677D2]" />
                    <span className="text-xs font-bold text-[#172B4D]">
                      Automatic GPS Geofence Check
                    </span>
                  </div>
                  {step === 'locating' && !position ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-[#1677D2]">
                      Detecting GPS…
                    </span>
                  ) : distanceInfo?.accuracyFlagged ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      ⚠ Low Accuracy (±{Math.round(position.accuracy)}m)
                    </span>
                  ) : distanceInfo?.withinRadius ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      ✓ Within {radiusThreshold}m Geofence
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                      ✕ Outside {radiusThreshold}m Geofence
                    </span>
                  )}
                </div>

                {step === 'locating' && !position ? (
                  <div className="flex flex-col items-center justify-center py-4 text-center">
                    <div className="size-7 animate-spin rounded-full border-3 border-[#1677D2] border-t-transparent" />
                    <p className="mt-2 text-xs font-bold text-[#172B4D]">
                      Requesting High-Accuracy Mobile GPS Location…
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#64748B]">
                      Please tap &ldquo;Allow&rdquo; when your browser prompts for location access.
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border border-[#DFE8F2] bg-white p-2">
                        <span className="block text-[10px] text-[#64748B]">
                          Detected Coordinates
                        </span>
                        <span className="font-mono text-[11px] font-bold text-[#172B4D]">
                          {position
                            ? `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`
                            : 'Unavailable'}
                        </span>
                      </div>
                      <div className="rounded-lg border border-[#DFE8F2] bg-white p-2">
                        <span className="block text-[10px] text-[#64748B]">GPS Accuracy</span>
                        <span
                          className={`font-mono text-[11px] font-bold ${
                            distanceInfo?.accuracyFlagged ? 'text-amber-700' : 'text-[#172B4D]'
                          }`}
                        >
                          {position?.accuracy != null ? `±${Math.round(position.accuracy)} meters` : '—'}
                        </span>
                      </div>
                      <div className="rounded-lg border border-[#DFE8F2] bg-white p-2">
                        <span className="block text-[10px] text-[#64748B]">Distance from Office</span>
                        <span
                          className={`font-mono text-xs font-extrabold ${
                            distanceInfo?.withinRadius ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {distanceInfo ? `${distanceInfo.meters} meters` : '—'}
                        </span>
                      </div>
                      <div className="rounded-lg border border-[#DFE8F2] bg-white p-2">
                        <span className="block text-[10px] text-[#64748B]">
                          Allowed Geofence Radius
                        </span>
                        <span className="font-mono text-xs font-bold text-[#1677D2]">
                          {radiusThreshold} meters
                        </span>
                      </div>
                    </div>

                    {/* Low GPS Accuracy Warning Alert (e.g. ±212m exceeds threshold) */}
                    {distanceInfo?.accuracyFlagged && (
                      <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                        <div className="flex items-start gap-1.5">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-700" />
                          <div>
                            <strong>Low GPS Accuracy (±{Math.round(position.accuracy)}m):</strong>{' '}
                            Your browser GPS accuracy exceeds the verified threshold (±{accuracyThreshold}m). A reading of ±{Math.round(position.accuracy)}m cannot be confidently verified inside the {radiusThreshold}m office geofence. Please move outdoors or near an open entrance and tap <strong>Refresh Location</strong>.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-[#64748B]">
                    Office Target: {officeTarget.latitude.toFixed(6)}, {officeTarget.longitude.toFixed(6)}
                  </span>
                  <button
                    type="button"
                    onClick={() => detectAndValidateGps(qrLocationId)}
                    disabled={step === 'locating'}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#DFE8F2] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1677D2] shadow-2xs hover:bg-blue-50 disabled:opacity-50"
                  >
                    <RefreshCw className={`size-3 ${step === 'locating' ? 'animate-spin' : ''}`} />
                    Refresh Location
                  </button>
                </div>
              </div>

              {/* 3. QR Door Verification Token Status */}
              {ENABLE_QR_DOOR_TOKEN && (
                <div className="rounded-xl border border-[#DFE8F2] bg-[#F8FAFC] p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#172B4D]">
                      QR Entrance Verification Code
                    </span>
                    {tokenStatus && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          tokenStatus.valid
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {tokenStatus.valid
                          ? `✓ Valid Code (${tokenStatus.expiresIn ?? 'Active'}s)`
                          : '✕ Token Expired / Missing'}
                      </span>
                    )}
                  </div>
                  {tokenStatus && !tokenStatus.valid && (
                    <div className="mt-1.5 rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-900">
                      <p>{tokenStatus.message}</p>
                      <button
                        type="button"
                        onClick={() => checkTokenValidity(doorToken, qrLocationId)}
                        className="mt-1.5 inline-flex items-center gap-1 rounded border border-rose-300 bg-white px-2 py-0.5 text-[10px] font-bold text-rose-800 hover:bg-rose-100"
                      >
                        <RefreshCw className="size-2.5" /> Re-verify Code
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Geofence Rejection / Error Banner */}
              {error && (
                <div
                  ref={errorRef}
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900"
                >
                  <div className="flex items-start gap-2">
                    <XCircle className="mt-0.5 size-4 shrink-0 text-rose-600" />
                    <div>
                      <span className="block font-bold text-rose-900">
                        Attendance Verification Blocked
                      </span>
                      <p className="mt-0.5 leading-relaxed">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons: Check-In & Check-Out */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={
                    (step === 'locating' && !position) ||
                    Boolean(savingAction) ||
                    !selectedEmployee ||
                    Boolean(selectedEmployee?.today_check_in) ||
                    (distanceInfo && !distanceInfo.withinRadius) ||
                    (distanceInfo && distanceInfo.accuracyFlagged)
                  }
                  onClick={() => handleAttendanceAction('in')}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    recommendedAction === 'in'
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700 ring-2 ring-emerald-400/50'
                      : 'bg-emerald-700 text-white hover:bg-emerald-800'
                  }`}
                >
                  <LogIn className="size-4" />
                  {savingAction === 'in'
                    ? 'Recording…'
                    : selectedEmployee?.today_check_in
                    ? `Checked In (${selectedEmployee.today_check_in})`
                    : 'Check-In'}
                </button>

                <button
                  type="button"
                  disabled={
                    (step === 'locating' && !position) ||
                    Boolean(savingAction) ||
                    !selectedEmployee ||
                    !selectedEmployee?.today_check_in ||
                    Boolean(selectedEmployee?.today_check_out) ||
                    (distanceInfo && !distanceInfo.withinRadius) ||
                    (distanceInfo && distanceInfo.accuracyFlagged)
                  }
                  onClick={() => handleAttendanceAction('out')}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    recommendedAction === 'out'
                      ? 'bg-[#1677D2] text-white hover:bg-[#125ea7] ring-2 ring-sky-400/50'
                      : 'bg-[#1677D2] text-white hover:bg-[#125ea7]'
                  }`}
                >
                  <LogOut className="size-4" />
                  {savingAction === 'out'
                    ? 'Recording…'
                    : selectedEmployee?.today_check_out
                    ? `Checked Out (${selectedEmployee.today_check_out})`
                    : 'Check-Out'}
                </button>
              </div>

              {/* Operating Hours Schedule Footnote */}
              <div className="rounded-xl border border-[#DFE8F2] bg-[#F8FAFC] p-2.5 text-[10px] text-[#64748B]">
                <div className="font-semibold text-[#172B4D]">
                  Configured Shift Cutoff Schedule:
                </div>
                <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
                  <span>
                    • On-Time: {officeConfig?.on_time_start || '06:00'} –{' '}
                    {officeConfig?.on_time_end || '08:40'}
                  </span>
                  <span>
                    • Late: {officeConfig?.late_start || '08:40'} –{' '}
                    {officeConfig?.late_end || '11:00'}
                  </span>
                  <span>
                    • Half Day: {officeConfig?.half_day_start || '12:00'} –{' '}
                    {officeConfig?.half_day_end || '14:00'}
                  </span>
                  <span>
                    • Check-Out: {officeConfig?.checkout_start || '16:00'} –{' '}
                    {officeConfig?.checkout_end || '22:00'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
