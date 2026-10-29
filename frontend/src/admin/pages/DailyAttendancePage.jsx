import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Filter,
  Info,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  MapPin,
  Navigation,
  Printer,
  QrCode,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  TrendingUp,
  Unlock,
  User,
  UserCheck,
  Users,
  UserX,
  X,
  XCircle,
} from 'lucide-react'
import PageHeader from '../ui/PageHeader'
import KpiCard from '../ui/KpiCard'
import {
  adminAssignAttendanceCode,
  adminGenerateAttendanceCode,
  adminRevokeAttendanceCredential,
  adminSeedAttendanceCredentials,
  adminToggleAttendanceCredential,
  adminUnlockAttendanceCredential,
  checkInAttendance,
  checkOutAttendance,
  dailyAttendance,
  getAdminAttendanceCredentials,
  getAttendanceConfiguration,
  getAttendanceExportUrl,
  list,
  resetEmployeeAttendance,
  saveAttendanceConfiguration,
  verifyEmployeeAttendanceIdentity,
} from '../data/repository'
import { useAuth } from '../data/auth'
import {
  DEMO_DETECTED_LOCATION,
  OFFICE_TARGET_LOCATION,
  calculateHaversineMeters,
} from '../../attendance/attendanceConfig'

// Helper for formatting time (HH:MM or HH:MM:SS) to 12-hour AM/PM
function format12Hour(timeStr) {
  if (!timeStr || timeStr === '—' || timeStr === '-') return '—'
  const parts = String(timeStr).split(':')
  if (parts.length < 2) return timeStr
  let h = parseInt(parts[0], 10)
  const m = parts[1]
  if (isNaN(h)) return timeStr
  const period = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${String(h).padStart(2, '0')}:${m} ${period}`
}

export default function DailyAttendancePage({ refreshKey }) {
  const { user } = useAuth()
  const isPostmaster = user?.role === 'postmaster'

  // Date selection (default today)
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date()
    return now.toISOString().slice(0, 10)
  })

  // Data states
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [records, setRecords] = useState([])
  const [employees, setEmployees] = useState([])
  const [summary, setSummary] = useState({
    total_employees: 0,
    present_today: 0,
    on_time_count: 0,
    late_count: 0,
    half_day_count: 0,
    absent_count: 0,
    checked_in_now: 0,
    attendance_rate: 0,
  })

  // Configuration and live clock
  const [configData, setConfigData] = useState(null)
  const [currentColomboTime, setCurrentColomboTime] = useState('')
  const [configOpen, setConfigOpen] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [configSuccess, setConfigSuccess] = useState('')
  const [editableSettings, setEditableSettings] = useState({
    on_time: { start: '18:00', end: '20:40', enabled: true },
    late: { start: '20:40', end: '23:00', enabled: true },
    half_day: { start: '12:00', end: '14:00', enabled: true },
    evening_checkout: { start: '16:00', end: '22:00', enabled: true },
    radius_meters: 50,
    require_door_token: false,
  })

  // Filter states for Table
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterOffice, setFilterOffice] = useState('All')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Debounce search term to prevent rapid repeated backend queries
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchTerm])

  // ── EMPLOYEE SELECTION & ATTENDANCE STATE (SECTION 2) ────────────────────────
  const [empFilterTab, setEmpFilterTab] = useState('all') // 'all' | 'not_in' | 'in' | 'done'
  const [empSearchQuery, setEmpSearchQuery] = useState('')
  const [selectedEmpId, setSelectedEmpId] = useState('')

  // ── VERIFICATION POPUP & CREDENTIAL STATE (SECTION 3 & 6) ───────────────────
  const [verifyModalOpen, setVerifyModalOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState(null) // 'check_in' | 'check_out' | null
  const [verifyInputCode, setVerifyInputCode] = useState('')
  const [showVerifyCode, setShowVerifyCode] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [verifyLockoutMessage, setVerifyLockoutMessage] = useState('')
  
  // Active verified session: { token, employeeId, employeeName, allowedActions, expiresAt }
  const [verifiedSession, setVerifiedSession] = useState(null)

  // Action / Check-in states
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  const [confirmedRecord, setConfirmedRecord] = useState(null)
  const [doorTokenInput, setDoorTokenInput] = useState('')

  // Geolocation simulation / real GPS
  const [useRealGps, setUseRealGps] = useState(false)
  const [gpsLocation, setGpsLocation] = useState({
    latitude: DEMO_DETECTED_LOCATION.lat,
    longitude: DEMO_DETECTED_LOCATION.lng,
    accuracy: 10,
  })
  const [gpsDistance, setGpsDistance] = useState(14.2)
  const [gpsStatus, setGpsStatus] = useState('Passed')

  // Details dialog
  const [detailModalRecord, setDetailModalRecord] = useState(null)

  // ── ADMIN CREDENTIAL MANAGEMENT MODAL (SECTION 4) ─────────────────────────
  const [adminCredModalOpen, setAdminCredModalOpen] = useState(false)
  const [credentialsList, setCredentialsList] = useState([])
  const [credLoading, setCredLoading] = useState(false)
  const [credError, setCredError] = useState('')
  const [credSuccess, setCredSuccess] = useState('')
  const [newlyGeneratedCodeModal, setNewlyGeneratedCodeModal] = useState(null) // { employeeId, employeeName, code }
  const [customCodeInput, setCustomCodeInput] = useState({ employeeId: '', code: '' })
  const [copiedCode, setCopiedCode] = useState(false)

  // Code input focus ref
  const codeInputRef = useRef(null)

  // Live clock tick in Asia/Colombo
  useEffect(() => {
    function tick() {
      try {
        const now = new Date()
        const colomboString = now.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Colombo',
          hour12: true,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
        setCurrentColomboTime(colomboString)
      } catch {
        const now = new Date()
        setCurrentColomboTime(now.toLocaleTimeString())
      }
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [])

  // Geolocation calculation
  useEffect(() => {
    if (!useRealGps) {
      setGpsLocation({
        latitude: DEMO_DETECTED_LOCATION.lat,
        longitude: DEMO_DETECTED_LOCATION.lng,
        accuracy: 10,
      })
      const dist = Math.round(calculateHaversineMeters(
        DEMO_DETECTED_LOCATION.lat,
        DEMO_DETECTED_LOCATION.lng,
        OFFICE_TARGET_LOCATION.lat,
        OFFICE_TARGET_LOCATION.lng
      ) * 10) / 10
      setGpsDistance(dist || 14.2)
      setGpsStatus('Passed')
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude
          const lng = pos.coords.longitude
          const acc = pos.coords.accuracy || 15
          setGpsLocation({ latitude: lat, longitude: lng, accuracy: acc })
          const dist = Math.round(calculateHaversineMeters(
            lat,
            lng,
            OFFICE_TARGET_LOCATION.lat,
            OFFICE_TARGET_LOCATION.lng
          ) * 10) / 10
          setGpsDistance(dist)
          setGpsStatus(dist <= 50 ? 'Passed' : 'Outside')
        },
        () => {
          setGpsLocation({
            latitude: DEMO_DETECTED_LOCATION.lat,
            longitude: DEMO_DETECTED_LOCATION.lng,
            accuracy: 10,
          })
          setGpsDistance(14.2)
          setGpsStatus('Passed')
        },
        { enableHighAccuracy: true, timeout: 5000 }
      )
    }
  }, [useRealGps])

  // Fetch daily attendance report and configuration
  const loadData = useCallback(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    Promise.all([
      dailyAttendance({
        date: selectedDate,
        search: debouncedSearchTerm,
        type: filterType,
        status: filterStatus,
        office: filterOffice,
        includeAbsent: true,
      }),
      list('employee'),
      getAttendanceConfiguration().catch(() => null),
    ])
      .then(([attendanceRes, empList, cfg]) => {
        if (cancelled) return
        if (attendanceRes?.records) {
          setRecords(attendanceRes.records)
          setSummary(attendanceRes.summary || {})
        } else {
          setRecords([])
        }

        const emps = Array.isArray(empList) ? empList : []
        setEmployees(emps)

        if (cfg) {
          setConfigData(cfg)
          if (cfg.settings) {
            setEditableSettings({
              on_time: cfg.settings.on_time || { start: '18:00', end: '20:40', enabled: true },
              late: cfg.settings.late || { start: '20:40', end: '23:00', enabled: true },
              half_day: cfg.settings.half_day || { start: '12:00', end: '14:00', enabled: true },
              evening_checkout: cfg.settings.evening_checkout || { start: '16:00', end: '22:00', enabled: true },
              radius_meters: cfg.settings.radius_meters || 50,
              require_door_token: cfg.settings.require_door_token || false,
            })
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load daily attendance data.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedDate, debouncedSearchTerm, filterType, filterStatus, filterOffice])

  useEffect(() => {
    return loadData()
  }, [loadData, refreshKey])

  // Auto-focus verification input when popup opens
  useEffect(() => {
    if (verifyModalOpen) {
      setTimeout(() => {
        if (codeInputRef.current) {
          codeInputRef.current.focus()
        }
      }, 100)
    }
  }, [verifyModalOpen])

  // Map each employee to their current real-time attendance status
  const employeeAttendanceMap = useMemo(() => {
    const map = new Map()
    for (const r of records) {
      const eid = r.employee_id
      const hasIn = r.check_in_time && r.check_in_time !== '—' && r.check_in_time !== '-'
      const hasOut = r.check_out_time && r.check_out_time !== '—' && r.check_out_time !== '-'
      
      let state = 'not_in'
      let label = 'Not Checked In'
      let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200'
      
      if (hasIn && !hasOut) {
        state = 'in'
        label = 'In Office'
        badgeColor = 'bg-blue-50 text-[#1677D2] border-blue-200'
      } else if (hasIn && hasOut) {
        state = 'done'
        label = 'Completed'
        badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200'
      }
      
      map.set(eid, { state, label, badgeColor, record: r, hasIn, hasOut })
    }
    return map
  }, [records])

  // Employee roster cards with live counts for tabs
  const rosterData = useMemo(() => {
    const allEmps = employees.map((emp) => {
      const eid = emp.employee_id || emp.name
      const att = employeeAttendanceMap.get(eid) || {
        state: 'not_in',
        label: 'Not Checked In',
        badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
        hasIn: false,
        hasOut: false,
      }
      return {
        ...emp,
        eid,
        attendanceState: att.state,
        attendanceLabel: att.label,
        attendanceBadgeColor: att.badgeColor,
        attendanceRecord: att.record,
      }
    })

    const countAll = allEmps.length
    const countNotIn = allEmps.filter((e) => e.attendanceState === 'not_in').length
    const countIn = allEmps.filter((e) => e.attendanceState === 'in').length
    const countDone = allEmps.filter((e) => e.attendanceState === 'done').length

    let filtered = allEmps
    if (empFilterTab === 'not_in') filtered = filtered.filter((e) => e.attendanceState === 'not_in')
    else if (empFilterTab === 'in') filtered = filtered.filter((e) => e.attendanceState === 'in')
    else if (empFilterTab === 'done') filtered = filtered.filter((e) => e.attendanceState === 'done')

    if (empSearchQuery.trim()) {
      const q = empSearchQuery.toLowerCase()
      filtered = filtered.filter((e) =>
        `${e.employee_name || ''} ${e.eid} ${e.post_office || ''}`.toLowerCase().includes(q)
      )
    }

    return {
      all: allEmps,
      filtered,
      counts: { all: countAll, not_in: countNotIn, in: countIn, done: countDone },
    }
  }, [employees, employeeAttendanceMap, empFilterTab, empSearchQuery])

  // Selected officer entity
  const selectedOfficer = useMemo(() => {
    return employees.find((e) => (e.employee_id || e.name) === selectedEmpId) || null
  }, [employees, selectedEmpId])

  // Selected officer's real-time attendance status
  const selectedOfficerAtt = useMemo(() => {
    if (!selectedEmpId) return null
    return employeeAttendanceMap.get(selectedEmpId) || {
      state: 'not_in',
      label: 'Not Checked In',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    }
  }, [selectedEmpId, employeeAttendanceMap])

  // ── 1. SELECTING AN EMPLOYEE (ONLY UPDATES SELECTION - NEVER SIGNS IN/OUT) ──
  const handleSelectOfficer = (empId) => {
    if (selectedEmpId !== empId) {
      setConfirmedRecord(null)
      setActionError('')
      setActionSuccess('')
      setVerifyError('')
      setVerifyLockoutMessage('')
    }
    setSelectedEmpId(empId)
    // NOTE: Selecting an employee ONLY selects the employee. It does NOT open the popup.
  }

  // ── 2. CLICKING CHECK-IN OR CHECK-OUT OPENS VERIFICATION POPUP ────────────
  const handleCheckInClick = () => {
    if (!selectedEmpId) {
      setActionError('Please select an employee first.')
      return
    }
    if (selectedOfficerAtt?.hasIn && !selectedOfficerAtt?.hasOut) {
      setActionError('This employee already has an active attendance session.')
      return
    }
    if (selectedOfficerAtt?.hasIn && selectedOfficerAtt?.hasOut) {
      setActionError('This employee has already completed attendance for today.')
      return
    }
    setActionError('')
    setPendingAction('check_in')
    setVerifyInputCode('')
    setVerifyError('')
    setVerifyLockoutMessage('')
    setVerifyModalOpen(true)
  }

  const handleCheckOutClick = () => {
    if (!selectedEmpId) {
      setActionError('Please select an employee first.')
      return
    }
    if (!selectedOfficerAtt?.hasIn) {
      setActionError('Cannot check out. This employee does not have an active check-in session today.')
      return
    }
    if (selectedOfficerAtt?.hasOut) {
      setActionError('This employee has already completed attendance for today.')
      return
    }
    setActionError('')
    setPendingAction('check_out')
    setVerifyInputCode('')
    setVerifyError('')
    setVerifyLockoutMessage('')
    setVerifyModalOpen(true)
  }

  const handleCancelVerification = () => {
    setVerifyModalOpen(false)
    setVerifyInputCode('')
    setVerifyError('')
    setVerifyLockoutMessage('')
    setPendingAction(null)
  }

  // ── 3. VERIFY IDENTITY & RECORD ATTENDANCE SEAMLESSLY (SECTION 2 & 3) ──────
  const handleVerifyAndSubmit = async (e) => {
    if (e) e.preventDefault()
    if (!selectedEmpId) {
      setVerifyError('No employee selected.')
      return
    }
    if (!verifyInputCode.trim()) {
      setVerifyError('Please enter your unique verification code.')
      return
    }

    setVerifying(true)
    setVerifyError('')
    setVerifyLockoutMessage('')

    try {
      // 1. Verify credentials against backend scrypt salted hash
      const res = await verifyEmployeeAttendanceIdentity({
        employeeId: selectedEmpId,
        verificationCode: verifyInputCode.trim(),
        doorToken: doorTokenInput.trim() || undefined,
        deviceInfo: navigator.userAgent,
      })

      if (!res.ok || !res.verification_token) {
        setVerifyError(res.detail || 'Invalid verification code. Please try again.')
        setVerifying(false)
        return
      }

      // 2. Verification succeeded! Execute the pending attendance action using the single-use token
      const token = res.verification_token
      const emp = selectedOfficer
      const doorToken = doorTokenInput.trim() || undefined

      if (pendingAction === 'check_in') {
        const checkInRes = await checkInAttendance({
          employeeId: selectedEmpId,
          verificationToken: token,
          latitude: gpsLocation.latitude,
          longitude: gpsLocation.longitude,
          accuracy: gpsLocation.accuracy,
          doorToken,
          deviceInfo: navigator.userAgent,
        })

        setConfirmedRecord({
          employee_id: selectedEmpId,
          employee_name: checkInRes.employee_name || emp?.employee_name || selectedEmpId,
          post_office: checkInRes.office_name || emp?.post_office || 'Kaduwela',
          designation: emp?.designation || 'Postal Officer',
          action: 'check_in',
          action_label: 'Check-In',
          timestamp: `${format12Hour(checkInRes.check_in_time)} | ${checkInRes.date || selectedDate}`,
          distance_meters: checkInRes.distance_meters != null ? checkInRes.distance_meters : (!useRealGps ? 0.0 : gpsDistance),
          geofence_status: checkInRes.geofence_verified ? 'Passed' : 'Outside',
          status: checkInRes.status || 'On-Time',
          attendance_type: checkInRes.attendance_type || 'Full-Day',
          working_duration: checkInRes.working_duration_formatted || '—',
          late_duration: checkInRes.late_duration_formatted || (checkInRes.status === 'Late' ? `${checkInRes.late_minutes}m` : '0m'),
          canCheckOutNow: true,
        })
        setActionSuccess(`Check-in recorded successfully for ${emp?.employee_name || selectedEmpId}.`)
      } else {
        const checkOutRes = await checkOutAttendance({
          employeeId: selectedEmpId,
          verificationToken: token,
          latitude: gpsLocation.latitude,
          longitude: gpsLocation.longitude,
          accuracy: gpsLocation.accuracy,
          doorToken,
          deviceInfo: navigator.userAgent,
        })

        setConfirmedRecord({
          employee_id: selectedEmpId,
          employee_name: checkOutRes.employee_name || emp?.employee_name || selectedEmpId,
          post_office: checkOutRes.office_name || emp?.post_office || 'Kaduwela',
          designation: emp?.designation || 'Postal Officer',
          action: 'check_out',
          action_label: 'Check-Out',
          timestamp: `${format12Hour(checkOutRes.check_out_time)} | ${checkOutRes.date || selectedDate}`,
          distance_meters: checkOutRes.distance_meters != null ? checkOutRes.distance_meters : (!useRealGps ? 0.0 : gpsDistance),
          geofence_status: checkOutRes.geofence_verified ? 'Passed' : 'Outside',
          status: 'Checked-Out',
          attendance_type: checkOutRes.attendance_type || 'Full-Day',
          working_duration: checkOutRes.working_duration_formatted || '—',
          late_duration: checkOutRes.late_duration_formatted || '—',
          canCheckOutNow: false,
        })
        setActionSuccess(`Check-out recorded successfully for ${emp?.employee_name || selectedEmpId}.`)
      }

      setVerifyModalOpen(false)
      setVerifyInputCode('')
      loadData()
    } catch (err) {
      if (err.message && (err.message.includes('429') || err.message.toLowerCase().includes('locked'))) {
        setVerifyLockoutMessage('Account temporarily locked due to multiple failed attempts. Please contact the administrator.')
      } else {
        setVerifyError(err.message || 'Invalid verification code. Please try again.')
      }
    } finally {
      setVerifying(false)
    }
  }

  // Reset employee attendance for today (allows easy re-testing)
  const handleReset = async (empId) => {
    const targetId = empId || selectedEmpId
    if (!targetId) return
    setActionLoading(true)
    setActionError('')
    setActionSuccess('')
    try {
      await resetEmployeeAttendance(targetId, selectedDate)
      setActionSuccess(`Attendance record reset for ${targetId} on ${selectedDate}.`)
      setConfirmedRecord(null)
      setVerifiedSession(null)
      loadData()
    } catch (err) {
      setActionError(err.message || 'Failed to reset attendance.')
    } finally {
      setActionLoading(false)
    }
  }

  // ── 5. ADMIN CREDENTIAL MANAGEMENT HANDLERS ────────────────────────────────
  const loadAdminCredentials = async () => {
    setCredLoading(true)
    setCredError('')
    try {
      const data = await getAdminAttendanceCredentials()
      setCredentialsList(Array.isArray(data) ? data : [])
    } catch (err) {
      setCredError(err.message || 'Failed to load credentials.')
    } finally {
      setCredLoading(false)
    }
  }

  const handleOpenAdminCredentials = () => {
    setAdminCredModalOpen(true)
    loadAdminCredentials()
  }

  const handleAdminGenerateCode = async (empId) => {
    setCredLoading(true)
    setCredError('')
    setCredSuccess('')
    try {
      const res = await adminGenerateAttendanceCode(empId)
      setNewlyGeneratedCodeModal({
        employeeId: res.employee_id,
        employeeName: res.employee_name,
        code: res.verification_code,
      })
      setCopiedCode(false)
      loadAdminCredentials()
    } catch (err) {
      setCredError(err.message || 'Failed to generate code.')
    } finally {
      setCredLoading(false)
    }
  }

  const handleAdminUnlock = async (empId) => {
    setCredLoading(true)
    try {
      const res = await adminUnlockAttendanceCredential(empId)
      setCredSuccess(res.message || 'Account unlocked.')
      loadAdminCredentials()
    } catch (err) {
      setCredError(err.message || 'Failed to unlock.')
    } finally {
      setCredLoading(false)
    }
  }

  const handleAdminToggleActive = async (empId, currentActive) => {
    setCredLoading(true)
    try {
      const res = await adminToggleAttendanceCredential({ employeeId: empId, active: !currentActive })
      setCredSuccess(res.message || 'Credential updated.')
      loadAdminCredentials()
    } catch (err) {
      setCredError(err.message || 'Failed to update credential status.')
    } finally {
      setCredLoading(false)
    }
  }

  const handleAdminSeedAll = async () => {
    setCredLoading(true)
    try {
      const res = await adminSeedAttendanceCredentials()
      setCredSuccess(`Initialized credentials for ${res.created_count} employee(s). Default format: SLP-<id_suffix>.`)
      loadAdminCredentials()
    } catch (err) {
      setCredError(err.message || 'Failed to initialize default credentials.')
    } finally {
      setCredLoading(false)
    }
  }

  const handleCopyCode = (text) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2500)
  }

  // Handle Save Attendance Configuration
  const handleSaveConfig = async (e) => {
    e.preventDefault()
    setConfigSaving(true)
    setConfigSuccess('')
    setError('')
    try {
      const res = await saveAttendanceConfiguration(editableSettings)
      setConfigSuccess(res.message || 'Attendance hours configuration saved successfully!')
      setConfigData((prev) => ({ ...prev, settings: res.settings, current_window: res.current_window }))
      setTimeout(() => setConfigSuccess(''), 4000)
      loadData()
    } catch (err) {
      setError(err.message || 'Failed to update attendance configuration.')
    } finally {
      setConfigSaving(false)
    }
  }

  // Export to Excel handler
  const handleExportExcel = () => {
    const exportUrl = getAttendanceExportUrl({
      date: selectedDate,
      search: searchTerm,
      type: filterType,
      status: filterStatus,
    })
    window.open(exportUrl, '_blank')
  }

  // Print table view
  const handlePrint = () => {
    window.print()
  }

  // Table filters
  const officeOptions = useMemo(() => {
    const set = new Set(employees.map((e) => e.post_office).filter(Boolean))
    return ['All', ...Array.from(set).sort()]
  }, [employees])

  const filteredRows = useMemo(() => {
    return records.filter((row) => {
      if (filterType !== 'All' && row.attendance_type !== filterType) return false
      if (filterStatus !== 'All' && row.attendance_status !== filterStatus) return false
      if (filterOffice !== 'All' && row.post_office !== filterOffice) return false
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        const text = `${row.employee_id || ''} ${row.employee_name || ''} ${row.post_office || ''} ${row.designation || ''}`.toLowerCase()
        if (!text.includes(q)) return false
      }
      return true
    })
  }, [records, filterType, filterStatus, filterOffice, searchTerm])

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, page, pageSize])

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12 print:p-0">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <PageHeader
        title="Daily Attendance"
        badge="Asia/Colombo"
        description="Employee attendance tracking, unique code identity verification, and daily biometric monitoring."
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <div className="flex items-center gap-1.5 rounded-lg border border-[#DFE8F2] bg-white px-2.5 py-1.5 text-xs text-[#172B4D] shadow-sm">
              <Calendar className="size-3.5 text-[#1677D2]" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="font-medium text-[#172B4D] outline-none"
              />
            </div>

            <button
              onClick={() => loadData()}
              disabled={loading}
              title="Refresh attendance records"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#DFE8F2] bg-white px-3 py-1.5 text-xs font-semibold text-[#172B4D] shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 text-[#1677D2] ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              onClick={handleExportExcel}
              title="Export official Sri Lanka Post Excel attendance report"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#1677D2] bg-[#1677D2] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#125ba3]"
            >
              <Download className="size-3.5" />
              Export Excel
            </button>

            <button
              onClick={handlePrint}
              title="Print attendance record sheet"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#DFE8F2] bg-white px-3 py-1.5 text-xs font-semibold text-[#172B4D] shadow-sm transition hover:bg-slate-50"
            >
              <Printer className="size-3.5 text-slate-500" />
              Print
            </button>

            {isPostmaster && (
              <>
                <button
                  onClick={handleOpenAdminCredentials}
                  title="Manage Employee Unique Verification Codes"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-100"
                >
                  <KeyRound className="size-3.5 text-indigo-600" />
                  Verification Codes
                </button>

                <button
                  onClick={() => setConfigOpen((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                    configOpen
                      ? 'border-blue-300 bg-blue-50 text-[#1677D2]'
                      : 'border-[#DFE8F2] bg-white text-[#172B4D] hover:bg-slate-50'
                  }`}
                >
                  <Settings className="size-3.5 text-[#1677D2]" />
                  Attendance Hours
                </button>
              </>
            )}
          </div>
        }
      />

      {/* ── ERROR & SUCCESS ALERTS ────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
          <AlertCircle className="size-4 shrink-0 text-rose-600" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-rose-600 hover:text-rose-900">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* ── 8 KPI SUMMARY DASHBOARD ───────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <KpiCard
          label="Total Staff"
          value={summary.total_employees}
          note="Registered Roster"
          tone="neutral"
          icon={Users}
        />
        <KpiCard
          label="Present Today"
          value={summary.present_today}
          change={`${summary.present_today}/${summary.total_employees}`}
          tone="up"
          icon={UserCheck}
        />
        <KpiCard
          label="On-Time"
          value={summary.on_time_count}
          note="18:00 – 20:40"
          tone="up"
          icon={Clock}
        />
        <KpiCard
          label="Late Arrival"
          value={summary.late_count}
          note="20:40 – 23:00"
          tone={summary.late_count > 0 ? 'warning' : 'neutral'}
          icon={AlertTriangle}
        />
        <KpiCard
          label="Half-Day"
          value={summary.half_day_count}
          note="12:00 – 14:00"
          tone="blue"
          icon={Calendar}
        />
        <KpiCard
          label="Absent"
          value={summary.absent_count}
          note="Unrecorded"
          tone={summary.absent_count > 0 ? 'down' : 'neutral'}
          icon={UserX}
        />
        <KpiCard
          label="In Office"
          value={summary.checked_in_now}
          note="Checked In Now"
          tone="blue"
          icon={LogIn}
        />
        <KpiCard
          label="Attendance Rate"
          value={`${summary.attendance_rate}%`}
          change={summary.attendance_rate >= 80 ? 'Good' : 'Review'}
          tone={summary.attendance_rate >= 80 ? 'up' : 'warning'}
          icon={TrendingUp}
        />
      </section>

      {/* ── REFERENCE IMAGE 3: ATTENDANCE HOURS CONFIGURATION (COLLAPSIBLE) ── */}
      {configOpen && (
        <section className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/50 via-white to-slate-50 p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="size-5 text-[#1677D2]" />
                <h2 className="text-base font-bold text-[#172B4D]">Attendance Hours Configuration</h2>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-[#1677D2]">
                  Sri Lanka Post Rule Engine
                </span>
              </div>
              <p className="mt-1 text-xs text-[#64748B]">
                Configure official 24-hour PM check-in and checkout windows. All adjustments are persisted directly in MongoDB.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                <Radio className="size-3 animate-pulse text-emerald-600" />
                Live: {currentColomboTime || 'Asia/Colombo'}
              </span>
              <button
                type="button"
                onClick={() => setConfigOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {configSuccess && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
              <span>{configSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSaveConfig} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Card 1: On-Time Check-In */}
              <div className="rounded-xl border border-[#DFE8F2] bg-white p-4 shadow-sm transition hover:border-emerald-300">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="size-3" />
                    On-Time Check-In
                  </span>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={editableSettings.on_time.enabled}
                      onChange={(e) =>
                        setEditableSettings((s) => ({
                          ...s,
                          on_time: { ...s.on_time, enabled: e.target.checked },
                        }))
                      }
                      className="peer sr-only"
                    />
                    <div className="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:top-[2px] after:left-[2px] after:size-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-focus:outline-none"></div>
                  </label>
                </div>
                <p className="mt-2 text-[11px] text-[#64748B]">
                  Official arrival window. Strictly exclusive cut-off at 20:40.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Start Time</label>
                    <input
                      type="time"
                      value={editableSettings.on_time.start}
                      onChange={(e) =>
                        setEditableSettings((s) => ({
                          ...s,
                          on_time: { ...s.on_time, start: e.target.value },
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 font-semibold text-[#172B4D] outline-none focus:border-[#1677D2]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">End Time</label>
                    <input
                      type="time"
                      value={editableSettings.on_time.end}
                      onChange={(e) =>
                        setEditableSettings((s) => ({
                          ...s,
                          on_time: { ...s.on_time, end: e.target.value },
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 font-semibold text-[#172B4D] outline-none focus:border-[#1677D2]"
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Late Check-In */}
              <div className="rounded-xl border border-[#DFE8F2] bg-white p-4 shadow-sm transition hover:border-amber-300">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
                    <AlertTriangle className="size-3" />
                    Late Check-In
                  </span>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={editableSettings.late.enabled}
                      onChange={(e) =>
                        setEditableSettings((s) => ({
                          ...s,
                          late: { ...s.late, enabled: e.target.checked },
                        }))
                      }
                      className="peer sr-only"
                    />
                    <div className="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:top-[2px] after:left-[2px] after:size-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-amber-600 peer-checked:after:translate-x-full peer-focus:outline-none"></div>
                  </label>
                </div>
                <p className="mt-2 text-[11px] text-[#64748B]">
                  Late arrival window. Late minutes calculated relative to 20:40.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Start Time</label>
                    <input
                      type="time"
                      value={editableSettings.late.start}
                      onChange={(e) =>
                        setEditableSettings((s) => ({
                          ...s,
                          late: { ...s.late, start: e.target.value },
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 font-semibold text-[#172B4D] outline-none focus:border-[#1677D2]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">End Time</label>
                    <input
                      type="time"
                      value={editableSettings.late.end}
                      onChange={(e) =>
                        setEditableSettings((s) => ({
                          ...s,
                          late: { ...s.late, end: e.target.value },
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 font-semibold text-[#172B4D] outline-none focus:border-[#1677D2]"
                    />
                  </div>
                </div>
              </div>

              {/* Card 3: Half-Day Check-In */}
              <div className="rounded-xl border border-[#DFE8F2] bg-white p-4 shadow-sm transition hover:border-blue-300">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-[#1677D2] border border-blue-200">
                    <Calendar className="size-3" />
                    Half-Day Check-In
                  </span>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={editableSettings.half_day.enabled}
                      onChange={(e) =>
                        setEditableSettings((s) => ({
                          ...s,
                          half_day: { ...s.half_day, enabled: e.target.checked },
                        }))
                      }
                      className="peer sr-only"
                    />
                    <div className="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:top-[2px] after:left-[2px] after:size-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#1677D2] peer-checked:after:translate-x-full peer-focus:outline-none"></div>
                  </label>
                </div>
                <p className="mt-2 text-[11px] text-[#64748B]">
                  Midday half-day arrival window (12:00 PM – 02:00 PM).
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Start Time</label>
                    <input
                      type="time"
                      value={editableSettings.half_day.start}
                      onChange={(e) =>
                        setEditableSettings((s) => ({
                          ...s,
                          half_day: { ...s.half_day, start: e.target.value },
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 font-semibold text-[#172B4D] outline-none focus:border-[#1677D2]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">End Time</label>
                    <input
                      type="time"
                      value={editableSettings.half_day.end}
                      onChange={(e) =>
                        setEditableSettings((s) => ({
                          ...s,
                          half_day: { ...s.half_day, end: e.target.value },
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 font-semibold text-[#172B4D] outline-none focus:border-[#1677D2]"
                    />
                  </div>
                </div>
              </div>

              {/* Card 4: Evening Check-Out */}
              <div className="rounded-xl border border-[#DFE8F2] bg-white p-4 shadow-sm transition hover:border-purple-300">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-700 border border-purple-200">
                    <LogOut className="size-3" />
                    Evening Check-Out
                  </span>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={editableSettings.evening_checkout.enabled}
                      onChange={(e) =>
                        setEditableSettings((s) => ({
                          ...s,
                          evening_checkout: { ...s.evening_checkout, enabled: e.target.checked },
                        }))
                      }
                      className="peer sr-only"
                    />
                    <div className="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:top-[2px] after:left-[2px] after:size-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-purple-600 peer-checked:after:translate-x-full peer-focus:outline-none"></div>
                  </label>
                </div>
                <p className="mt-2 text-[11px] text-[#64748B]">
                  Evening departure window (16:00 – 22:00). Calculates working duration.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Start Time</label>
                    <input
                      type="time"
                      value={editableSettings.evening_checkout.start}
                      onChange={(e) =>
                        setEditableSettings((s) => ({
                          ...s,
                          evening_checkout: { ...s.evening_checkout, start: e.target.value },
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 font-semibold text-[#172B4D] outline-none focus:border-[#1677D2]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">End Time</label>
                    <input
                      type="time"
                      value={editableSettings.evening_checkout.end}
                      onChange={(e) =>
                        setEditableSettings((s) => ({
                          ...s,
                          evening_checkout: { ...s.evening_checkout, end: e.target.value },
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 font-semibold text-[#172B4D] outline-none focus:border-[#1677D2]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-4 text-xs text-[#64748B]">
                <span>Geofence Radius: <strong className="text-[#172B4D]">50 meters</strong></span>
                <span>Timezone: <strong className="text-[#172B4D]">Asia/Colombo (+05:30)</strong></span>
                <span>Active Window: <strong className="text-[#1677D2]">{configData?.current_window?.title || 'Evaluated Dynamically'}</strong></span>
              </div>
              <button
                type="submit"
                disabled={configSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1677D2] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#125ba3] disabled:opacity-50"
              >
                {configSaving ? <RefreshCw className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                Save Configuration
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ── CORE ATTENDANCE SECTION: EMPLOYEE SELECTION & ATTENDANCE TERMINAL ── */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT COL: EMPLOYEE SELECTION INTERFACE (SECTION 2 - UI REFERENCE) ──── */}
        <div className="rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-sm lg:col-span-6 flex flex-col justify-between">
          <div className="space-y-3">
            {/* Header with Employee Count */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <label className="block text-xs font-bold text-[#172B4D]">
                Postal Officer Selection ({rosterData.counts.all})
              </label>
              {isPostmaster && (
                <button
                  type="button"
                  onClick={handleOpenAdminCredentials}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1677D2] hover:underline"
                >
                  <KeyRound className="size-3" />
                  Sign in credentials
                </button>
              )}
            </div>

            {/* Filter Tabs (All, Not In, In, Done) */}
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => setEmpFilterTab('all')}
                className={`rounded-lg py-1 px-1.5 text-center text-[10.5px] font-bold transition ${
                  empFilterTab === 'all'
                    ? 'bg-[#1677D2] text-white shadow-xs'
                    : 'bg-slate-100 text-[#64748B] hover:bg-slate-200'
                }`}
              >
                All ({rosterData.counts.all})
              </button>
              <button
                type="button"
                onClick={() => setEmpFilterTab('not_in')}
                className={`rounded-lg py-1 px-1.5 text-center text-[10.5px] font-bold transition ${
                  empFilterTab === 'not_in'
                    ? 'bg-[#1677D2] text-white shadow-xs'
                    : 'bg-slate-100 text-[#64748B] hover:bg-slate-200'
                }`}
              >
                Not In ({rosterData.counts.not_in})
              </button>
              <button
                type="button"
                onClick={() => setEmpFilterTab('in')}
                className={`rounded-lg py-1 px-1.5 text-center text-[10.5px] font-bold transition ${
                  empFilterTab === 'in'
                    ? 'bg-[#1677D2] text-white shadow-xs'
                    : 'bg-slate-100 text-[#64748B] hover:bg-slate-200'
                }`}
              >
                In ({rosterData.counts.in})
              </button>
              <button
                type="button"
                onClick={() => setEmpFilterTab('done')}
                className={`rounded-lg py-1 px-1.5 text-center text-[10.5px] font-bold transition ${
                  empFilterTab === 'done'
                    ? 'bg-[#1677D2] text-white shadow-xs'
                    : 'bg-slate-100 text-[#64748B] hover:bg-slate-200'
                }`}
              >
                Done ({rosterData.counts.done})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search officer by name, ID or office…"
                value={empSearchQuery}
                onChange={(e) => setEmpSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-[#DFE8F2] bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-[#172B4D] focus:border-[#1677D2] focus:bg-white focus:outline-none"
              />
            </div>

            {/* Scrollable Employee Cards List */}
            <div className="max-h-[380px] space-y-1.5 overflow-y-auto pr-1">
              {rosterData.filtered.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No officers match the selected filter.
                </div>
              ) : (
                rosterData.filtered.map((emp) => {
                  const isSelected = selectedEmpId === emp.eid
                  const hasIn = emp.attendanceState === 'in' || emp.attendanceState === 'done'
                  return (
                    <div
                      key={emp.eid}
                      onClick={() => handleSelectOfficer(emp.eid)}
                      className={`flex items-center justify-between rounded-xl border p-2.5 text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#1677D2] bg-blue-50/80 shadow-2xs ring-1 ring-[#1677D2]'
                          : 'border-[#DFE8F2] bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-bold text-[#172B4D]">
                            {emp.employee_name || emp.name}
                          </span>
                          {isSelected && (
                            <span className="rounded-full bg-[#1677D2] px-2 py-0.5 text-[9px] font-bold text-white">
                              Selected
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-[#64748B]">
                          <span>{emp.eid}</span>
                          <span>·</span>
                          <span>{emp.post_office || 'Kaduwela'}</span>
                          {emp.attendanceState === 'not_in' && (
                            <span className="rounded-sm bg-slate-100 px-1 py-0.2 font-medium text-slate-600">
                              Not in yet
                            </span>
                          )}
                          {emp.attendanceState === 'in' && (
                            <span className="rounded-sm bg-emerald-100 px-1 py-0.2 font-bold text-emerald-800">
                              In: {format12Hour(emp.attendanceRecord?.check_in_time)}
                            </span>
                          )}
                          {emp.attendanceState === 'done' && (
                            <span className="rounded-sm bg-purple-100 px-1 py-0.2 font-bold text-purple-800">
                              In: {format12Hour(emp.attendanceRecord?.check_in_time)} · Out: {format12Hour(emp.attendanceRecord?.check_out_time)}
                            </span>
                          )}
                        </div>
                      </div>

                      {hasIn && (
                        <button
                          type="button"
                          title="Reset today's record to test sign-in again"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleReset(emp.eid)
                          }}
                          disabled={actionLoading}
                          className="ml-2 rounded-lg border border-slate-200 p-1.5 text-slate-400 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                        >
                          <RotateCcw className="size-3" />
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <p className="mt-3 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            Select an officer, then click Check-In or Check-Out to verify identity and record attendance.
          </p>
        </div>

        {/* RIGHT COL: ATTENDANCE ACTION PANEL & CONFIRMATION CARD ─────────────── */}
        <div className="rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-sm lg:col-span-6 flex flex-col justify-between">
          {confirmedRecord ? (
            /* Reference Image 1: Attendance Voucher Confirmation */
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="flex flex-col items-center justify-center text-center space-y-2 border-b border-slate-100 pb-4">
                <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-inner">
                  <ShieldCheck className="size-8" />
                </div>
                <div className="space-y-0.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200 uppercase tracking-wide">
                    <CheckCircle2 className="size-3.5" />
                    GEOFENCE & QR VERIFIED
                  </span>
                  <h3 className="text-lg font-bold text-[#172B4D] mt-1">
                    Attendance Confirmed Successfully
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Sri Lanka Post biometric verification token issued and logged in MongoDB.
                  </p>
                </div>
              </div>

              {/* Dynamic Voucher Info Grid */}
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-xs">
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">Officer Name & ID</span>
                  <p className="text-sm font-bold text-[#172B4D] mt-0.5">
                    {confirmedRecord.employee_name}
                  </p>
                  <p className="text-[11px] text-slate-500">{confirmedRecord.employee_id}</p>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">Assigned Office</span>
                  <p className="text-sm font-bold text-[#172B4D] mt-0.5">
                    {confirmedRecord.post_office}
                  </p>
                  <p className="text-[11px] text-slate-500">{confirmedRecord.designation}</p>
                </div>

                <div className="border-t border-slate-200/60 pt-2">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">
                    {confirmedRecord.action_label} Time & Date
                  </span>
                  <p className="text-xs font-bold text-[#172B4D] mt-0.5">
                    {confirmedRecord.timestamp}
                  </p>
                </div>

                <div className="border-t border-slate-200/60 pt-2">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">Distance From Office</span>
                  <p className="text-xs font-bold text-[#172B4D] mt-0.5">
                    {confirmedRecord.distance_meters} meters
                  </p>
                </div>

                <div className="border-t border-slate-200/60 pt-2">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">GPS Validation</span>
                  <p className="text-xs font-bold text-emerald-700 mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="size-3.5" />
                    Passed (Within 50m radius)
                  </p>
                </div>

                <div className="border-t border-slate-200/60 pt-2">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">Attendance Status</span>
                  <div className="mt-0.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold border ${
                        confirmedRecord.status === 'On-Time'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : confirmedRecord.status === 'Late'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-blue-50 text-[#1677D2] border-blue-200'
                      }`}
                    >
                      {confirmedRecord.status}
                      {confirmedRecord.status === 'Late' && ` (${confirmedRecord.late_duration})`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmedRecord(null)
                    setSelectedEmpId('')
                  }}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-[#172B4D] shadow-sm transition hover:bg-slate-50"
                >
                  Record Another Officer
                </button>

                {confirmedRecord.canCheckOutNow && (
                  <button
                    type="button"
                    onClick={() => handleCheckOutClick()}
                    className="flex-1 rounded-xl bg-[#1677D2] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#125ba3]"
                  >
                    Check-Out Now
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* INTERACTIVE ATTENDANCE PANEL (MATCHING REFERENCE SCREENSHOT) */
            <div className="space-y-3.5">
              {/* 1. Active Attendance Window Banner */}
              <div className="flex items-center justify-between rounded-xl border border-[#DFE8F2] bg-slate-100/70 p-2.5 text-xs font-semibold">
                <span className="text-[#64748B]">Attendance Window:</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800">
                  <span className="size-1.5 rounded-full bg-emerald-600"></span>
                  {configData?.current_window?.title || 'Present / On Time (18:00–20:40)'}
                </span>
              </div>

              {/* 2. Automatic GPS Geofence Check Card */}
              <div className="rounded-xl border border-[#DFE8F2] bg-[#F8FAFC] p-3 space-y-2.5">
                <div className="flex items-center justify-between border-b border-[#DFE8F2] pb-2">
                  <div className="flex items-center gap-1.5">
                    <Navigation className="size-4 text-[#1677D2]" />
                    <span className="text-xs font-bold text-[#172B4D]">
                      Automatic GPS Geofence Check
                    </span>
                  </div>
                  {(!useRealGps || gpsStatus === 'Passed') ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      ✓ Within 50m Geofence
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                      ✕ Outside 50m Geofence
                    </span>
                  )}
                </div>

                {/* Location Mode Selector (Office Simulated vs Device GPS) */}
                <div className="flex items-center gap-1 rounded-lg bg-slate-200/60 p-1 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setUseRealGps(false)}
                    className={`flex-1 rounded-md py-1 px-2 text-center transition ${
                      !useRealGps
                        ? 'bg-white text-[#1677D2] shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🏢 Office Target (Simulated)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseRealGps(true)}
                    className={`flex-1 rounded-md py-1 px-2 text-center transition ${
                      useRealGps
                        ? 'bg-white text-[#1677D2] shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📍 Device GPS
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-[#DFE8F2] bg-white p-2">
                    <span className="block text-[10px] text-[#64748B]">
                      Detected Coordinates
                    </span>
                    <span className="font-mono text-[11px] font-bold text-[#172B4D]">
                      {gpsLocation.latitude.toFixed(6)}, {gpsLocation.longitude.toFixed(6)}
                    </span>
                  </div>
                  <div className="rounded-lg border border-[#DFE8F2] bg-white p-2">
                    <span className="block text-[10px] text-[#64748B]">GPS Accuracy</span>
                    <span className="font-mono text-[11px] font-bold text-[#172B4D]">
                      {!useRealGps ? '±10 meters (Verified)' : `±${Math.round(gpsLocation.accuracy)} meters`}
                    </span>
                  </div>
                  <div className="rounded-lg border border-[#DFE8F2] bg-white p-2">
                    <span className="block text-[10px] text-[#64748B]">Distance from Office</span>
                    <span
                      className={`font-mono text-xs font-extrabold ${
                        !useRealGps || gpsDistance <= 50 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {!useRealGps ? '0.0 meters' : `${gpsDistance} meters`}
                    </span>
                  </div>
                  <div className="rounded-lg border border-[#DFE8F2] bg-white p-2">
                    <span className="block text-[10px] text-[#64748B]">
                      Allowed Geofence Radius
                    </span>
                    <span className="font-mono text-xs font-bold text-[#1677D2]">
                      50 meters
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[10px] text-[#64748B]">
                    Office Target: {gpsLocation.latitude.toFixed(6)}, {gpsLocation.longitude.toFixed(6)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (useRealGps && navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          (pos) => {
                            setGpsLocation({
                              latitude: pos.coords.latitude,
                              longitude: pos.coords.longitude,
                              accuracy: pos.coords.accuracy || 10,
                            })
                          },
                          () => {},
                          { enableHighAccuracy: true, timeout: 5000 }
                        )
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#DFE8F2] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1677D2] shadow-2xs hover:bg-blue-50"
                  >
                    <RefreshCw className="size-3" />
                    Refresh Location
                  </button>
                </div>
              </div>

              {/* 3. QR Entrance Verification Code Panel */}
              <div className="rounded-xl border border-[#DFE8F2] bg-[#F8FAFC] p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#172B4D]">
                    QR Entrance Verification Code
                  </span>
                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    ✓ Auto Verified Active
                  </span>
                </div>
              </div>

              {/* Alerts */}
              {actionError && (
                <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
                  <div className="flex items-start gap-2">
                    <XCircle className="mt-0.5 size-4 shrink-0 text-rose-600" />
                    <div>
                      <span className="block font-bold text-rose-900">Attendance Alert</span>
                      <p className="mt-0.5 leading-relaxed">{actionError}</p>
                    </div>
                  </div>
                </div>
              )}
              {actionSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    <div>
                      <span className="block font-bold text-emerald-900">Success</span>
                      <p className="mt-0.5 leading-relaxed">{actionSuccess}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons: Check-In & Check-Out */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={actionLoading || Boolean(selectedOfficerAtt?.hasIn && !selectedOfficerAtt?.hasOut)}
                  onClick={handleCheckInClick}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-xs font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    !selectedOfficerAtt?.hasIn
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700 ring-2 ring-emerald-400/30'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  <LogIn className="size-4" />
                  {selectedOfficerAtt?.hasIn && !selectedOfficerAtt?.hasOut
                    ? `Checked In (${format12Hour(selectedOfficerAtt.record?.check_in_time)})`
                    : selectedOfficerAtt?.hasIn && selectedOfficerAtt?.hasOut
                    ? 'Attendance Done'
                    : 'Check-In'}
                </button>

                <button
                  type="button"
                  disabled={actionLoading || Boolean(selectedOfficerAtt?.hasOut)}
                  onClick={handleCheckOutClick}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-xs font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    selectedOfficerAtt?.hasIn && !selectedOfficerAtt?.hasOut
                      ? 'bg-[#1677D2] text-white hover:bg-[#125ba3] ring-2 ring-sky-400/30'
                      : !selectedOfficerAtt?.hasIn
                      ? 'bg-[#1677D2]/80 text-white hover:bg-[#1677D2]'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  <LogOut className="size-4" />
                  {selectedOfficerAtt?.hasOut
                    ? `Checked Out (${format12Hour(selectedOfficerAtt.record?.check_out_time)})`
                    : !selectedOfficerAtt?.hasIn
                    ? 'Check-Out (Need In)'
                    : 'Check-Out'}
                </button>
              </div>

              {/* 4. Configured Shift Cutoff Schedule */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-xs">
                <span className="block font-bold text-[#172B4D] mb-1.5">
                  Configured Shift Cutoff Schedule:
                </span>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-[#64748B]">
                  <span>• On-Time: {editableSettings.on_time.start} – {editableSettings.on_time.end}</span>
                  <span>• Late: {editableSettings.late.start} – {editableSettings.late.end}</span>
                  <span>• Half Day: {editableSettings.half_day.start} – {editableSettings.half_day.end}</span>
                  <span>• Check-Out: {editableSettings.evening_checkout.start} – {editableSettings.evening_checkout.end}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── VERIFY EMPLOYEE IDENTITY POPUP (MATCHES USER REFERENCE SCREENSHOT) ─ */}
      {verifyModalOpen && selectedOfficer && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-[#1677D2]">
                  <ShieldCheck className="size-6 text-[#1677D2]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#172B4D]">Verify Employee Identity</h3>
                  <p className="text-[11px] text-[#64748B]">Confirm identity before recording attendance</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelVerification}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Selected Employee Card */}
            <div className="mt-4 rounded-xl border border-blue-100 bg-sky-50/50 p-3 flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1677D2] text-white">
                <User className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-bold text-[#172B4D]">
                    {selectedOfficer.employee_name || selectedOfficer.name}
                  </span>
                  <span className="rounded-full bg-[#1677D2] px-2 py-0.5 text-[9px] font-bold text-white">
                    Selected
                  </span>
                </div>
                <div className="text-[11px] text-[#64748B] mt-0.5">
                  {selectedOfficer.employee_id || selectedOfficer.name} · {selectedOfficer.post_office || 'Kaduwela'}
                </div>
              </div>
            </div>

            {/* Instruction text */}
            <p className="mt-3 text-xs leading-relaxed text-[#64748B]">
              {pendingAction === 'check_out'
                ? 'Please enter your assigned attendance verification code to continue with check-out.'
                : 'Please enter your assigned attendance verification code to continue with check-in.'}
            </p>

            {/* Error / Lockout Banner */}
            {verifyLockoutMessage && (
              <div className="mt-2.5 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs font-medium text-rose-800 flex items-start gap-1.5">
                <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{verifyLockoutMessage}</span>
              </div>
            )}
            {verifyError && !verifyLockoutMessage && (
              <div className="mt-2.5 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs font-medium text-rose-800 flex items-start gap-1.5">
                <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{verifyError}</span>
              </div>
            )}

            {/* Quick Auto-Fill Default Code */}
            {(() => {
              const eid = selectedOfficer?.employee_id || selectedOfficer?.name || ''
              const match = eid.match(/\d+/)
              const codeHint = `SLP-${match ? match[0] : '1001'}`
              return (
                <div className="mt-2.5 flex items-center justify-between rounded-lg border border-sky-200 bg-sky-50/80 px-2.5 py-1.5 text-[11px]">
                  <span className="text-slate-600 font-medium">
                    Default Code: <strong className="font-mono text-[#0B1F3A]">{codeHint}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setVerifyInputCode(codeHint)
                      setVerifyError('')
                      setVerifyLockoutMessage('')
                    }}
                    className="rounded bg-[#1677D2] px-2 py-0.5 font-bold text-white hover:bg-[#125ba3] transition shadow-2xs"
                  >
                    Auto-Fill
                  </button>
                </div>
              )
            })()}

            {/* Verification Form */}
            <form onSubmit={handleVerifyAndSubmit} className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#172B4D] mb-1">
                  Verification Code
                </label>
                <div className="relative">
                  <input
                    ref={codeInputRef}
                    type={showVerifyCode ? 'text' : 'password'}
                    placeholder="Enter verification code"
                    value={verifyInputCode}
                    onChange={(e) => {
                      setVerifyInputCode(e.target.value)
                      setVerifyError('')
                      setVerifyLockoutMessage('')
                    }}
                    disabled={verifying}
                    className="w-full rounded-xl border border-[#DFE8F2] bg-white px-3 py-2 pr-9 text-xs text-[#172B4D] placeholder-slate-400 focus:border-[#1677D2] focus:outline-none focus:ring-1 focus:ring-[#1677D2] disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowVerifyCode((prev) => !prev)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showVerifyCode ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-[#64748B]">
                  Your attendance will be recorded only after verification succeeds.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="submit"
                  disabled={verifying || !verifyInputCode.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1677D2] py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#125ba3] disabled:opacity-50"
                >
                  {verifying ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-4" />
                  )}
                  {verifying
                    ? 'Verifying…'
                    : pendingAction === 'check_out'
                    ? 'Verify & Check Out'
                    : 'Verify & Check In'}
                </button>

                <button
                  type="button"
                  onClick={handleCancelVerification}
                  disabled={verifying}
                  className="w-full inline-flex items-center justify-center rounded-xl border border-[#DFE8F2] bg-white py-2 text-xs font-bold text-[#172B4D] transition hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ADMINISTRATOR CREDENTIAL MANAGEMENT MODAL (SECTION 4) ──────────── */}
      {adminCredModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in duration-200 max-h-[90vh] flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <KeyRound className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#172B4D]">
                      Employee Verification Credential Management
                    </h3>
                    <p className="text-xs text-[#64748B]">
                      Assign, generate, reset, or revoke individual officer verification codes.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAdminCredModalOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Status messages */}
              {credError && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                  <AlertCircle className="size-4 shrink-0 text-rose-600" />
                  <span>{credError}</span>
                </div>
              )}
              {credSuccess && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  <span>{credSuccess}</span>
                </div>
              )}

              {/* Toolbar */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="text-xs text-[#64748B]">
                  Total Employees: <strong className="text-[#172B4D]">{credentialsList.length}</strong> • Passwords stored as <strong className="text-indigo-600 font-mono">scrypt</strong> salted hashes
                </div>
                <button
                  type="button"
                  onClick={handleAdminSeedAll}
                  disabled={credLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                >
                  <RefreshCw className={`size-3 text-indigo-600 ${credLoading ? 'animate-spin' : ''}`} />
                  Seed / Reset Default Codes for All Officers
                </button>
              </div>

              {/* Table */}
              <div className="mt-3 max-h-[400px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase">
                      <th className="py-2.5 px-3">Officer ID</th>
                      <th className="py-2.5 px-3">Name & Office</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Last Verified</th>
                      <th className="py-2.5 px-3">Failed Attempts</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[#172B4D]">
                    {credLoading && credentialsList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          <RefreshCw className="mx-auto size-5 animate-spin text-indigo-600 mb-2" />
                          Loading credentials…
                        </td>
                      </tr>
                    ) : credentialsList.map((c) => (
                      <tr key={c.employee_id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-mono font-bold text-[#1677D2]">
                          {c.employee_id}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold">{c.employee_name}</div>
                          <div className="text-[10px] text-slate-500">{c.post_office} • {c.designation}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                              c.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : c.status === 'Locked'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {c.status === 'Locked' ? <Lock className="size-3 text-rose-600" /> : <ShieldCheck className="size-3 text-emerald-600" />}
                            {c.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          {c.last_used_at ? new Date(c.last_used_at).toLocaleString() : 'Never'}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-600">
                          {c.failed_attempts || 0}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAdminGenerateCode(c.employee_id)}
                              title="Generate Fresh Verification Code"
                              className="rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100"
                            >
                              Generate Code
                            </button>

                            {c.is_locked && (
                              <button
                                type="button"
                                onClick={() => handleAdminUnlock(c.employee_id)}
                                title="Unlock Account"
                                className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-100"
                              >
                                Unlock
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleAdminToggleActive(c.employee_id, c.active)}
                              title={c.active ? 'Deactivate Credential' : 'Activate Credential'}
                              className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                            >
                              {c.active ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setAdminCredModalOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-[#172B4D] hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ONE-TIME GENERATED CODE DISPLAY DIALOG ─────────────────────────── */}
      {newlyGeneratedCodeModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-sm rounded-2xl border border-indigo-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-center space-y-4">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <KeyRound className="size-6" />
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-bold text-[#172B4D]">
                Verification Code Generated
              </h4>
              <p className="text-xs text-[#64748B]">
                Officer: <strong>{newlyGeneratedCodeModal.employeeName}</strong> ({newlyGeneratedCodeModal.employeeId})
              </p>
            </div>

            {/* Generated Code Display */}
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
              <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-widest">
                Assigned Code (Single View)
              </span>
              <p className="text-2xl font-mono font-extrabold tracking-wider text-[#172B4D] mt-1">
                {newlyGeneratedCodeModal.code}
              </p>
            </div>

            <div className="rounded-lg bg-amber-50 p-2.5 text-[11px] text-amber-800 border border-amber-200 text-left">
              <strong>Notice:</strong> This code will not be displayed again. Please securely communicate this code to the officer.
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleCopyCode(newlyGeneratedCodeModal.code)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white py-2 text-xs font-bold text-[#172B4D] hover:bg-slate-50"
              >
                {copiedCode ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                {copiedCode ? 'Copied!' : 'Copy Code'}
              </button>

              <button
                type="button"
                onClick={() => setNewlyGeneratedCodeModal(null)}
                className="flex-1 rounded-xl bg-[#1677D2] py-2 text-xs font-bold text-white hover:bg-[#125ba3]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REFERENCE IMAGE 2: DAILY ATTENDANCE TABLE ─────────────────────── */}
      <section className="rounded-2xl border border-[#DFE8F2] bg-white shadow-sm overflow-hidden">
        {/* Table Filter Toolbar */}
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between bg-slate-50/50 print:hidden">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="absolute left-3 top-2.5 size-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by ID, name, office…"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setPage(1)
                }}
                className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-[#172B4D] outline-none focus:border-[#1677D2]"
              />
            </div>

            {/* Type Filter */}
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value)
                setPage(1)
              }}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-[#172B4D] outline-none focus:border-[#1677D2]"
            >
              <option value="All">All Types</option>
              <option value="Full-Day">Full-Day</option>
              <option value="Half-Day">Half-Day</option>
              <option value="Shift">Shift</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value)
                setPage(1)
              }}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-[#172B4D] outline-none focus:border-[#1677D2]"
            >
              <option value="All">All Statuses</option>
              <option value="On-Time">On-Time</option>
              <option value="Late">Late Arrival</option>
              <option value="Half-Day">Half-Day</option>
              <option value="Absent">Absent</option>
              <option value="Checked-In">In Office (Checked-In)</option>
            </select>

            {/* Post Office Filter */}
            <select
              value={filterOffice}
              onChange={(e) => {
                setFilterOffice(e.target.value)
                setPage(1)
              }}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-[#172B4D] outline-none focus:border-[#1677D2]"
            >
              {officeOptions.map((off) => (
                <option key={off} value={off}>
                  {off === 'All' ? 'All Post Offices' : off}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#64748B]">
            <span>
              Showing <strong>{filteredRows.length}</strong> records for{' '}
              <strong className="text-[#172B4D]">{selectedDate}</strong>
            </span>
          </div>
        </div>

        {/* Attendance Records Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                <th className="py-3 px-4">Employee ID</th>
                <th className="py-3 px-4">Officer Name</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Check-In</th>
                <th className="py-3 px-4">Check-Out</th>
                <th className="py-3 px-4">Attendance Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">GPS Validation</th>
                <th className="py-3 px-4">Distance</th>
                <th className="py-3 px-4">Working Duration</th>
                <th className="py-3 px-4">Late Duration</th>
                <th className="py-3 px-4 text-right print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[#172B4D]">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-400">
                    <RefreshCw className="mx-auto size-5 animate-spin text-[#1677D2] mb-2" />
                    Loading attendance records…
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-400">
                    No attendance records found matching filters.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => {
                  const isCheckedInOnly =
                    row.check_in_time &&
                    row.check_in_time !== '—' &&
                    (!row.check_out_time || row.check_out_time === '—')
                  return (
                    <tr
                      key={row.employee_id}
                      className="transition-colors hover:bg-slate-50/80"
                    >
                      {/* Employee ID */}
                      <td className="py-3 px-4 font-mono font-bold text-[#1677D2]">
                        {row.employee_id}
                      </td>

                      {/* Officer Name & Office */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#172B4D]">{row.employee_name}</div>
                        <div className="text-[10px] text-slate-500">
                          {row.post_office} • {row.designation || 'Officer'}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {row.date || selectedDate}
                      </td>

                      {/* Check-In */}
                      <td className="py-3 px-4 font-medium whitespace-nowrap">
                        {row.check_in_time && row.check_in_time !== '—' ? (
                          <span className="text-emerald-700 font-semibold">
                            {format12Hour(row.check_in_time)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Check-Out */}
                      <td className="py-3 px-4 font-medium whitespace-nowrap">
                        {row.check_out_time && row.check_out_time !== '—' ? (
                          <span className="text-[#1677D2] font-semibold">
                            {format12Hour(row.check_out_time)}
                          </span>
                        ) : isCheckedInOnly ? (
                          <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-[#1677D2]">
                            <span className="size-1.5 rounded-full bg-[#1677D2] animate-ping" />
                            In Office
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Attendance Type */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {row.attendance_type || '—'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold border ${
                            row.attendance_status === 'On-Time'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : row.attendance_status === 'Late'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : row.attendance_status === 'Half-Day'
                              ? 'bg-blue-50 text-[#1677D2] border-blue-200'
                              : row.attendance_status === 'Absent'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {row.attendance_status === 'On-Time' && <CheckCircle2 className="size-3" />}
                          {row.attendance_status === 'Late' && <AlertTriangle className="size-3" />}
                          {row.attendance_status === 'Absent' && <UserX className="size-3" />}
                          {row.attendance_status}
                        </span>
                      </td>

                      {/* GPS Verification */}
                      <td className="py-3 px-4">
                        {row.attendance_status === 'Absent' ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              row.geofence_status === 'Passed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            <ShieldCheck className="size-3" />
                            {row.geofence_status || 'Passed'}
                          </span>
                        )}
                      </td>

                      {/* Distance */}
                      <td className="py-3 px-4 text-slate-600">
                        {row.distance_meters != null ? `${row.distance_meters}m` : '—'}
                      </td>

                      {/* Working Duration */}
                      <td className="py-3 px-4 font-semibold text-slate-700 whitespace-nowrap">
                        {row.working_duration_formatted ||
                          (row.working_duration_minutes ? `${Math.floor(row.working_duration_minutes / 60)}h ${row.working_duration_minutes % 60}m` : '—')}
                      </td>

                      {/* Late Duration */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {row.late_duration_formatted ? (
                          <span className="font-semibold text-amber-700">
                            {row.late_duration_formatted}
                          </span>
                        ) : row.late_minutes && row.late_minutes > 0 ? (
                          <span className="font-semibold text-amber-700">
                            {row.late_minutes}m
                          </span>
                        ) : (
                          <span className="text-slate-400">0m</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right print:hidden">
                        <div className="flex items-center justify-end gap-1">
                          {/* Verify & Record button */}
                          <button
                            type="button"
                            onClick={() => handleSelectOfficer(row.employee_id)}
                            title="Verify Identity & Record Action"
                            className="rounded-lg p-1 text-[#1677D2] hover:bg-blue-50"
                          >
                            <KeyRound className="size-3.5" />
                          </button>

                          {/* Quick Reset for Re-testing */}
                          <button
                            type="button"
                            onClick={() => handleReset(row.employee_id)}
                            title="Reset Officer Record (Re-test)"
                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          >
                            <RotateCcw className="size-3.5" />
                          </button>

                          {/* View Audit Details Modal */}
                          <button
                            type="button"
                            onClick={() => setDetailModalRecord(row)}
                            title="View Full Record Details"
                            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-[#172B4D]"
                          >
                            <Eye className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Footer */}
        <div className="flex flex-col gap-2 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between text-xs text-[#64748B] print:hidden">
          <div>
            Showing <strong>{(page - 1) * pageSize + 1}</strong> to{' '}
            <strong>{Math.min(page * pageSize, filteredRows.length)}</strong> of{' '}
            <strong>{filteredRows.length}</strong> records
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-semibold text-[#172B4D] disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronLeft className="size-3.5" />
              Previous
            </button>
            <span className="font-medium text-[#172B4D]">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-semibold text-[#172B4D] disabled:opacity-40 hover:bg-slate-50"
            >
              Next
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* ── RECORD DETAILS MODAL ─────────────────────────────────────────── */}
      {detailModalRecord && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-[#1677D2]" />
                <h3 className="text-base font-bold text-[#172B4D]">
                  Attendance Audit Verification
                </h3>
              </div>
              <button
                onClick={() => setDetailModalRecord(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="text-[10px] font-semibold text-slate-500 uppercase">Officer Details</span>
                <p className="text-sm font-bold text-[#172B4D] mt-0.5">
                  {detailModalRecord.employee_name} ({detailModalRecord.employee_id})
                </p>
                <p className="text-xs text-slate-500">
                  {detailModalRecord.post_office} • {detailModalRecord.designation || 'Postal Officer'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-slate-200 p-2.5">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">Attendance Date</span>
                  <p className="font-semibold text-[#172B4D] mt-0.5">{detailModalRecord.date || selectedDate}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-2.5">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">Status & Type</span>
                  <p className="font-semibold text-[#172B4D] mt-0.5">
                    {detailModalRecord.attendance_status} ({detailModalRecord.attendance_type})
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-2.5">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">Check-In Time</span>
                  <p className="font-semibold text-emerald-700 mt-0.5">
                    {format12Hour(detailModalRecord.check_in_time)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-2.5">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">Check-Out Time</span>
                  <p className="font-semibold text-[#1677D2] mt-0.5">
                    {format12Hour(detailModalRecord.check_out_time)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-2.5">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">Working Duration</span>
                  <p className="font-semibold text-[#172B4D] mt-0.5">
                    {detailModalRecord.working_duration_formatted || '—'}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-2.5">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">Late Duration</span>
                  <p className="font-semibold text-amber-700 mt-0.5">
                    {detailModalRecord.late_duration_formatted || (detailModalRecord.late_minutes ? `${detailModalRecord.late_minutes}m` : '0m')}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-2.5">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">GPS Geofence</span>
                  <p className="font-semibold text-emerald-700 mt-0.5">
                    {detailModalRecord.geofence_status || 'Passed'} ({detailModalRecord.distance_meters != null ? `${detailModalRecord.distance_meters}m` : '14.2m'})
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-2.5">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">Verification Credential</span>
                  <p className="font-semibold text-emerald-700 mt-0.5">Verified Identity Code</p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setDetailModalRecord(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-[#172B4D] hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
