import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  getAttendanceSettings,
  getDoorToken,
  manageQrLocation,
  saveAttendanceSettings,
} from '../data/repository'
import { useAuth } from '../data/auth'
import PageHeader from '../ui/PageHeader'
import { GEOFENCE_RADIUS_METERS, OFFICE_TARGET_LOCATION } from '../../attendance/attendanceConfig'

const CONFIGURED_PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '')

function isLoopbackHost(host) {
  return !host || host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
}

function resolveDoorQrBaseUrl({
  customBaseUrl = '',
  envPublicUrl = CONFIGURED_PUBLIC_APP_URL,
  backendLanIp = '',
  backendPublicBaseUrl = '',
  browserLocation = typeof window !== 'undefined' ? window.location : { protocol: 'https:', hostname: 'localhost', port: '5173' },
} = {}) {
  const cleanCustom = String(customBaseUrl || '').trim().replace(/\/+$/, '')
  if (cleanCustom) {
    return cleanCustom.endsWith('/attendance-qr/token')
      ? cleanCustom
      : `${cleanCustom}/attendance-qr/token`
  }

  const cleanEnv = String(envPublicUrl || '').trim().replace(/\/+$/, '')
  if (cleanEnv) {
    return cleanEnv.endsWith('/attendance-qr/token')
      ? cleanEnv
      : `${cleanEnv}/attendance-qr/token`
  }

  const currentHost = browserLocation.hostname || 'localhost'
  const protocol = browserLocation.protocol || 'https:'
  const portPart = browserLocation.port ? `:${browserLocation.port}` : ''

  if (!isLoopbackHost(currentHost)) {
    return `${protocol}//${currentHost}${portPart}/attendance-qr/token`
  }

  if (backendLanIp && !isLoopbackHost(backendLanIp)) {
    return `${protocol}//${backendLanIp}${portPart}/attendance-qr/token`
  }

  if (backendPublicBaseUrl) {
    const cleanBackendBase = String(backendPublicBaseUrl).trim().replace(/\/+$/, '')
    return cleanBackendBase.endsWith('/attendance-qr/token')
      ? cleanBackendBase
      : `${cleanBackendBase}/attendance-qr/token`
  }

  return `${protocol}//${currentHost}${portPart}/attendance-qr/token`
}

function downloadQrImage(svg, officeName = 'PostOffice', locationId = 'QR') {
  if (!svg) return
  const xml = new XMLSerializer().serializeToString(svg)
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const image = new Image()
  image.onload = () => {
    const size = 720
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, size, size)
    context.drawImage(image, 0, 0, size, size)
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    const slug = `${officeName}-${locationId}`.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()
    link.download = `attendance-qr-${slug}.png`
    link.click()
    URL.revokeObjectURL(url)
  }
  image.src = url
}

function printQrPoster(svg, form, doorToken) {
  if (!svg) return
  const xml = new XMLSerializer().serializeToString(svg)
  const win = window.open('', '_blank', 'width=760,height=920')
  if (!win) return
  win.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>SL Postal KPI Desk — QR Attendance Poster (${form.office_name})</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 36px; background: #f8fafc; color: #0f172a; text-align: center; }
          .poster { max-width: 520px; margin: 0 auto; background: #fff; border: 2px solid #1677D2; border-radius: 20px; padding: 32px; box-shadow: 0 12px 30px rgba(15,23,42,0.08); }
          .badge { display: inline-block; background: #eff6ff; color: #1677D2; border: 1px solid #bfdbfe; border-radius: 999px; padding: 4px 14px; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
          h1 { margin: 12px 0 4px; font-size: 24px; color: #0b1f3a; }
          .sub { margin: 0 0 20px; font-size: 13px; color: #475569; }
          .qr-box { display: inline-block; padding: 16px; border: 2px dashed #cbd5e1; border-radius: 16px; background: #fff; }
          .meta { margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; text-align: left; background: #f8fafc; padding: 14px; border-radius: 12px; border: 1px solid #e2e8f0; font-size: 12px; }
          .meta strong { display: block; color: #0b1f3a; font-size: 13px; }
          .steps { margin-top: 18px; text-align: left; font-size: 12px; color: #334155; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="poster">
          <span class="badge">Department of Posts — Sri Lanka</span>
          <h1>${form.office_name || 'Kaduwela Head Post Office'}</h1>
          <p class="sub">PostAssistLK — Employee QR & Geofenced GPS Attendance Terminal</p>
          <div class="qr-box">${xml}</div>
          <div class="meta">
            <div><span>Office ID</span><strong>${form.office_id || 'PO-KADUWELA'}</strong></div>
            <div><span>QR Location ID</span><strong>${form.qr_location_id || 'LOC-KADUWELA-01'}</strong></div>
            <div><span>Geofence Radius</span><strong>Within ${form.radius_meters || GEOFENCE_RADIUS_METERS} meters</strong></div>
            <div><span>Door Token</span><strong>${doorToken ? doorToken.slice(0, 18) + '…' : 'Active'}</strong></div>
          </div>
          <div class="steps">
            <strong>How to Record Attendance:</strong>
            <ol>
              <li>Scan this QR code using your mobile phone camera.</li>
              <li>Grant browser GPS Location permission when prompted.</li>
              <li>Ensure you are standing within ${form.radius_meters || GEOFENCE_RADIUS_METERS}m of the post office entrance.</li>
              <li>Select your officer profile and tap <strong>Check-In</strong> or <strong>Check-Out</strong>.</li>
            </ol>
          </div>
        </div>
        <script>window.onload = () => { window.print(); }</script>
      </body>
    </html>
  `)
  win.document.close()
}

const DAYS = [
  { value: 0, label: 'Mon' },
  { value: 1, label: 'Tue' },
  { value: 2, label: 'Wed' },
  { value: 3, label: 'Thu' },
  { value: 4, label: 'Fri' },
  { value: 5, label: 'Sat' },
  { value: 6, label: 'Sun' },
]

const TIME_FIELDS = [
  ['on_time_start', 'on_time_end', 'On-time check-in'],
  ['late_start', 'late_end', 'Late check-in'],
  ['half_day_start', 'half_day_end', 'Half day limit'],
  ['checkout_start', 'checkout_end', 'Evening check-out'],
]

const TABS = ['Profile', 'Preferences', 'Notifications', 'Display', 'Security']

function formFromSettings(settings) {
  return {
    office_id: settings.office_id || 'PO-KADUWELA',
    office_name: settings.office_name || 'Kaduwela Head Post Office',
    qr_location_id: settings.qr_location_id || 'LOC-KADUWELA-01',
    qr_active: settings.qr_active ?? true,
    max_accuracy_meters: String(settings.max_accuracy_meters ?? 100),
    latitude: String(settings.latitude ?? OFFICE_TARGET_LOCATION.lat),
    longitude: String(settings.longitude ?? OFFICE_TARGET_LOCATION.lng),
    radius_meters: String(settings.radius_meters ?? GEOFENCE_RADIUS_METERS),
    on_time_start: settings.on_time_start || '06:00',
    on_time_end: settings.on_time_end || '08:40',
    late_start: settings.late_start || '08:40',
    late_end: settings.late_end || '11:00',
    half_day_start: settings.half_day_start || '12:00',
    half_day_end: settings.half_day_end || '14:00',
    checkout_start: settings.checkout_start || '16:00',
    checkout_end: settings.checkout_end || '22:00',
    open_days: settings.open_days || [0, 1, 2, 3, 4, 5],
    epf_employee_percent: String(settings.epf_employee_percent ?? 8),
    epf_employer_percent: String(settings.epf_employer_percent ?? 12),
    etf_percent: String(settings.etf_percent ?? 3),
    late_deduction_lkr: String(settings.late_deduction_lkr ?? 1000),
    ot_rate_lkr: String(settings.ot_rate_lkr ?? 1000),
  }
}

export default function SettingsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('Profile')
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [qrManaging, setQrManaging] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const qrRef = useRef(null)
  const [doorToken, setDoorToken] = useState('')
  const [doorExpires, setDoorExpires] = useState(null)
  const [doorError, setDoorError] = useState('')
  const [backendLanIp, setBackendLanIp] = useState('')
  const [backendPublicBaseUrl, setBackendPublicBaseUrl] = useState('')
  const [customBaseUrl, setCustomBaseUrl] = useState('')
  const [copiedUrl, setCopiedUrl] = useState(false)

  // User Profile Form State
  const [profileName, setProfileName] = useState(user?.name || 'K. A. Jayasuriya')
  const postmasterId = user?.username || 'PM-COL-001'
  const [profileEmail, setProfileEmail] = useState(`${user?.username || 'postmaster'}@slpost.lk`)
  const [profilePhone, setProfilePhone] = useState('+94 11 232 6161')
  const [postalLocation, setPostalLocation] = useState('Kaduwela Head Post Office, Colombo District')

  // Password state for mockup display
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  function loadDoorToken() {
    getDoorToken({ port: window.location.port })
      .then((result) => {
        setDoorToken(result.token || '')
        setDoorExpires(result.expires_at ? new Date(result.expires_at * 1000) : null)
        if (result.lan_ip) setBackendLanIp(result.lan_ip)
        if (result.public_base_url) setBackendPublicBaseUrl(result.public_base_url)
        setDoorError('')
      })
      .catch((err) => {
        setDoorToken('')
        setDoorExpires(null)
        setDoorError(err.message || 'The door code could not be created.')
      })
  }

  useEffect(() => {
    loadDoorToken()
    const timer = setInterval(loadDoorToken, 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    getAttendanceSettings()
      .then((settings) => {
        if (cancelled) return
        setForm(formFromSettings(settings))
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load settings')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleSaveSettings(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const saved = await saveAttendanceSettings({
        ...form,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        radius_meters: Number(form.radius_meters),
        max_accuracy_meters: Number(form.max_accuracy_meters || 250),
      })
      setForm(formFromSettings(saved))
      setNotice('Operational attendance & payroll settings successfully saved.')
    } catch (err) {
      setError(err.message || 'Could not save settings')
    } finally {
      setSaving(false)
    }
  }

  async function handleManageQr(action) {
    if (!form) return
    setQrManaging(true)
    setError('')
    setNotice('')
    try {
      const updated = await manageQrLocation({
        action,
        officeName: form.office_name,
        officeId: form.office_id,
      })
      setForm(formFromSettings(updated))
      if (updated.door_token?.token) {
        setDoorToken(updated.door_token.token)
        setDoorExpires(updated.door_token.expires_at ? new Date(updated.door_token.expires_at * 1000) : null)
      }
      const actionText =
        action === 'regenerate'
          ? `Regenerated QR location ID (${updated.qr_location_id}) and door token.`
          : action === 'deactivate'
          ? 'Deactivated post office QR attendance terminal.'
          : 'Activated post office QR attendance terminal.'
      setNotice(actionText)
    } catch (err) {
      setError(err.message || 'Could not update QR code status')
    } finally {
      setQrManaging(false)
    }
  }

  if (loading || !form) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1677D2] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        badge="DEPARTMENT OF POSTS SRI LANKA"
        title="Settings"
        subtitle="Manage your postmaster account profile, regional postal office coordinates, work hours, and biometric QR door token."
        action={
          <button
            type="button"
            onClick={() => {
              setNotice('Profile changes saved to session.')
              setTimeout(() => setNotice(''), 4000)
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1677D2] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#125ea7]"
          >
            Save All Changes
          </button>
        }
      />

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#DFE8F2] pb-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-t-lg px-4 py-2.5 text-xs font-semibold transition-all ${
                isActive
                  ? 'border-b-2 border-[#1677D2] bg-white text-[#1677D2] shadow-sm'
                  : 'text-[#64748B] hover:bg-white/60 hover:text-[#172B4D]'
              }`}
            >
              {tab}
            </button>
          )
        })}
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
          ✓ {notice}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
          ✕ {error}
        </div>
      )}

      {/* Main 2-Column Layout matching Panel 10 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left Column: Profile Details & Office Hours / Location */}
        <div className="space-y-5 lg:col-span-2">
          {/* Profile Details Card */}
          <div className="rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-sm">
            <div className="mb-4 border-b border-[#DFE8F2] pb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#1677D2]">USER IDENTIFICATION</span>
              <h3 className="text-sm font-bold text-[#172B4D]">Profile Details</h3>
              <p className="text-xs text-[#64748B]">Personal and postal departmental information for the signed-in postmaster</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-[#172B4D]">Full Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#DFE8F2] px-3 py-2 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#172B4D]">Postmaster / Staff ID</label>
                <input
                  type="text"
                  value={postmasterId}
                  readOnly
                  className="mt-1 w-full rounded-lg border border-[#DFE8F2] bg-slate-50 px-3 py-2 text-xs font-medium text-[#64748B]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#172B4D]">Official Email</label>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#DFE8F2] px-3 py-2 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#172B4D]">Contact Telephone</label>
                <input
                  type="tel"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#DFE8F2] px-3 py-2 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#172B4D]">Assigned Post Office Location</label>
                <input
                  type="text"
                  value={postalLocation}
                  onChange={(e) => setPostalLocation(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#DFE8F2] px-3 py-2 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Operational Attendance & Geofencing Parameters */}
          <form onSubmit={handleSaveSettings} className="rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-sm">
            <div className="mb-4 border-b border-[#DFE8F2] pb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#1677D2]">ATTENDANCE & LOCATION RULES</span>
              <h3 className="text-sm font-bold text-[#172B4D]">Post Office Geofencing & Operating Hours</h3>
              <p className="text-xs text-[#64748B]">GPS radius boundary for staff check-in and attendance shift cutoffs</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-[#172B4D]">Registered Post Office Name</label>
                  <input
                    type="text"
                    required
                    value={form.office_name}
                    onChange={(e) => setField('office_name', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#DFE8F2] px-3 py-2 text-xs text-[#172B4D]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#172B4D]">Post Office ID</label>
                  <input
                    type="text"
                    required
                    value={form.office_id}
                    onChange={(e) => setField('office_id', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#DFE8F2] px-3 py-2 text-xs text-[#172B4D]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#172B4D]">QR Location Identifier</label>
                  <input
                    type="text"
                    readOnly
                    value={form.qr_location_id}
                    className="mt-1 w-full rounded-lg border border-[#DFE8F2] bg-slate-50 px-3 py-2 text-xs font-semibold text-[#1677D2]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#172B4D]">Geofence Target Coordinates & Radius</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!navigator.geolocation) {
                        setError('Browser geolocation is not available on this device.')
                        return
                      }
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          setField('latitude', String(Number(pos.coords.latitude.toFixed(6))))
                          setField('longitude', String(Number(pos.coords.longitude.toFixed(6))))
                          setNotice(
                            `Detected your current GPS coordinates (${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}). Click "Update Operational Settings" to save.`,
                          )
                        },
                        (err) => {
                          setError(err.message || 'Could not detect current GPS coordinates. Ensure browser location permission is allowed.')
                        },
                        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
                      )
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#1677D2] bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-[#1677D2] hover:bg-blue-100"
                  >
                    📍 Use My Current GPS Location
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-[#172B4D]">Office Latitude</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={form.latitude}
                      onChange={(e) => setField('latitude', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#DFE8F2] px-3 py-2 text-xs text-[#172B4D]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#172B4D]">Office Longitude</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={form.longitude}
                      onChange={(e) => setField('longitude', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#DFE8F2] px-3 py-2 text-xs text-[#172B4D]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#172B4D]">Allowed Radius (Meters)</label>
                    <input
                      type="number"
                      min="20"
                      max="1000"
                      required
                      value={form.radius_meters}
                      onChange={(e) => setField('radius_meters', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#DFE8F2] px-3 py-2 text-xs text-[#172B4D]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-[#172B4D]">Attendance Hours Configuration</span>
                <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {TIME_FIELDS.map(([start, end, label]) => (
                    <div key={label} className="rounded-xl border border-[#DFE8F2] bg-[#F8FAFC] p-2.5">
                      <span className="block text-[11px] font-semibold text-[#172B4D]">{label}</span>
                      <div className="mt-1.5 flex items-center gap-2">
                        <input
                          type="time"
                          required
                          value={form[start]}
                          onChange={(e) => setField(start, e.target.value)}
                          className="w-full rounded border border-[#DFE8F2] bg-white px-2 py-1 text-xs"
                        />
                        <span className="text-xs text-[#64748B]">to</span>
                        <input
                          type="time"
                          required
                          value={form[end]}
                          onChange={(e) => setField(end, e.target.value)}
                          className="w-full rounded border border-[#DFE8F2] bg-white px-2 py-1 text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-[#172B4D]">Operational Open Days</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DAYS.map((day) => {
                    const isChecked = form.open_days.includes(day.value)
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => {
                          const open_days = isChecked
                            ? form.open_days.filter((v) => v !== day.value)
                            : [...form.open_days, day.value]
                          setField('open_days', open_days)
                        }}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                          isChecked
                            ? 'bg-[#1677D2] text-white shadow-xs'
                            : 'border border-[#DFE8F2] bg-white text-[#64748B] hover:bg-slate-50'
                        }`}
                      >
                        {day.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="border-t border-[#DFE8F2] pt-3">
                <span className="block text-xs font-semibold text-[#172B4D]">Payroll & Overtime Parameters</span>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <div>
                    <label className="block text-[10px] text-[#64748B]">EPF Staff %</label>
                    <input
                      type="number"
                      value={form.epf_employee_percent}
                      onChange={(e) => setField('epf_employee_percent', e.target.value)}
                      className="mt-0.5 w-full rounded border border-[#DFE8F2] px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#64748B]">EPF Dept %</label>
                    <input
                      type="number"
                      value={form.epf_employer_percent}
                      onChange={(e) => setField('epf_employer_percent', e.target.value)}
                      className="mt-0.5 w-full rounded border border-[#DFE8F2] px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#64748B]">ETF %</label>
                    <input
                      type="number"
                      value={form.etf_percent}
                      onChange={(e) => setField('etf_percent', e.target.value)}
                      className="mt-0.5 w-full rounded border border-[#DFE8F2] px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#64748B]">Late Cut (LKR)</label>
                    <input
                      type="number"
                      value={form.late_deduction_lkr}
                      onChange={(e) => setField('late_deduction_lkr', e.target.value)}
                      className="mt-0.5 w-full rounded border border-[#DFE8F2] px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#64748B]">OT Rate (LKR/h)</label>
                    <input
                      type="number"
                      value={form.ot_rate_lkr}
                      onChange={(e) => setField('ot_rate_lkr', e.target.value)}
                      className="mt-0.5 w-full rounded border border-[#DFE8F2] px-2 py-1 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#1677D2] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#125ea7] disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Update Operational Settings'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Right Column: Password Change & Door QR Token (Mockup Panel 10 Right Stack) */}
        <div className="space-y-5">
          {/* Change Password Card */}
          <div className="rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-sm">
            <div className="mb-3 border-b border-[#DFE8F2] pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#1677D2]">AUTHENTICATION</span>
              <h3 className="text-sm font-bold text-[#172B4D]">Change Password</h3>
              <p className="text-xs text-[#64748B]">Ensure your account is protected with a strong password</p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                setNotice('Password update request sent to directory authority.')
                setOldPassword('')
                setNewPassword('')
                setConfirmPassword('')
                setTimeout(() => setNotice(''), 4000)
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-medium text-[#172B4D]">Current Password</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 w-full rounded-lg border border-[#DFE8F2] px-3 py-1.5 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#172B4D]">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 w-full rounded-lg border border-[#DFE8F2] px-3 py-1.5 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#172B4D]">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 w-full rounded-lg border border-[#DFE8F2] px-3 py-1.5 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
                />
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  className="w-full rounded-lg bg-[#0B1F3A] py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#12315c]"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>

          {/* Door QR Token Card */}
          {(() => {
            const doorPage = resolveDoorQrBaseUrl({
              customBaseUrl,
              backendLanIp,
              backendPublicBaseUrl,
            })
            const fullQrUrl = doorToken
              ? `${doorPage}?location=${encodeURIComponent(form.qr_location_id)}&code=${encodeURIComponent(doorToken)}`
              : ''
            const usesLocalhost = /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(doorPage)
            return (
              <div className="rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-start justify-between border-b border-[#DFE8F2] pb-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#1677D2]">BIOMETRIC DOOR TERMINAL</span>
                    <h3 className="text-sm font-bold text-[#172B4D]">Post Office QR Attendance</h3>
                    <p className="text-xs text-[#64748B]">Geofenced GPS check-in & check-out QR terminal</p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                      form.qr_active
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-rose-200 bg-rose-50 text-rose-700'
                    }`}
                  >
                    {form.qr_active ? 'ACTIVE' : 'DEACTIVATED'}
                  </span>
                </div>

                {doorError && (
                  <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                    {doorError}
                  </div>
                )}

                {usesLocalhost && (
                  <div className="mb-2.5 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
                    <strong>Warning:</strong> Base URL is currently using <code>localhost</code>. Set <code>VITE_PUBLIC_APP_URL</code> or enter your LAN IP below so mobile phones can reach the attendance page.
                  </div>
                )}

                <div className="mb-2.5 rounded-lg border border-[#DFE8F2] bg-[#F8FAFC] p-2.5 text-[11px] text-[#172B4D]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Office:</span>
                    <span className="font-bold">{form.office_name}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[#64748B]">Location ID:</span>
                    <span className="font-mono font-semibold text-[#1677D2]">{form.qr_location_id}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[#64748B]">Geofence Radius:</span>
                    <span className="font-semibold">{form.radius_meters}m ({Number(form.latitude).toFixed(4)}, {Number(form.longitude).toFixed(4)})</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[#64748B]">Detected LAN IP:</span>
                    <span className="font-mono font-semibold text-emerald-700">{backendLanIp || 'Auto'}</span>
                  </div>
                </div>

                {/* Configurable Reachable Base URL Override */}
                <div className="mb-2.5">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                    Reachable Mobile Base URL (LAN HTTPS or Production Domain)
                  </label>
                  <input
                    type="url"
                    value={customBaseUrl}
                    onChange={(e) => setCustomBaseUrl(e.target.value)}
                    placeholder={doorPage.replace(/\/attendance-qr\/token$/, '')}
                    className="mt-1 w-full rounded-lg border border-[#DFE8F2] bg-white px-2.5 py-1.5 font-mono text-[11px] text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
                  />
                </div>

                {doorToken && form.qr_active ? (
                  <div ref={qrRef} className="flex flex-col items-center justify-center rounded-xl border border-[#DFE8F2] bg-white p-3">
                    <QRCodeSVG
                      value={fullQrUrl}
                      size={200}
                      level="M"
                      includeMargin
                      marginSize={3}
                    />
                    <div className="mt-2 w-full text-center">
                      <div className="text-[10px] font-semibold text-[#64748B]">
                        {doorExpires ? `Token Expires: ${doorExpires.toLocaleTimeString()}` : 'Rotating token active'}
                      </div>
                      <div
                        title={fullQrUrl}
                        className="mt-1.5 break-all rounded-lg border border-[#DFE8F2] bg-[#F8FAFC] p-2 font-mono text-[10px] text-[#172B4D]"
                      >
                        {fullQrUrl}
                      </div>
                    </div>
                  </div>
                ) : !form.qr_active ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 text-center text-xs text-rose-800">
                    This post office QR code is currently deactivated. Staff scans will be rejected until reactivated.
                  </div>
                ) : null}

                {/* Test & Copy URL Controls */}
                {fullQrUrl && form.qr_active && (
                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(fullQrUrl)
                        setCopiedUrl(true)
                        setTimeout(() => setCopiedUrl(false), 2500)
                      }}
                      className="rounded-lg border border-[#DFE8F2] bg-white py-1.5 text-xs font-semibold text-[#172B4D] hover:bg-slate-50"
                    >
                      {copiedUrl ? '✓ Copied QR URL' : 'Copy QR URL'}
                    </button>
                    <a
                      href={fullQrUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                    >
                      Test QR URL ↗
                    </a>
                  </div>
                )}

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={loadDoorToken}
                    className="rounded-lg border border-[#DFE8F2] bg-[#F4F8FC] py-1.5 text-xs font-semibold text-[#172B4D] hover:bg-[#e2edf8]"
                  >
                    Refresh Door Token
                  </button>
                  <button
                    type="button"
                    disabled={qrManaging}
                    onClick={() => handleManageQr('regenerate')}
                    className="rounded-lg border border-[#1677D2] bg-blue-50 py-1.5 text-xs font-semibold text-[#1677D2] hover:bg-blue-100 disabled:opacity-50"
                  >
                    Regenerate QR ID
                  </button>
                  <button
                    type="button"
                    disabled={!doorToken || !form.qr_active}
                    onClick={() => downloadQrImage(qrRef.current?.querySelector('svg'), form.office_name, form.qr_location_id)}
                    className="rounded-lg border border-[#1677D2] bg-white py-1.5 text-xs font-semibold text-[#1677D2] hover:bg-blue-50 disabled:opacity-50"
                  >
                    Download QR PNG
                  </button>
                  <button
                    type="button"
                    disabled={!doorToken || !form.qr_active}
                    onClick={() => printQrPoster(qrRef.current?.querySelector('svg'), form, doorToken)}
                    className="rounded-lg bg-[#1677D2] py-1.5 text-xs font-semibold text-white hover:bg-[#125ea7] disabled:opacity-50"
                  >
                    Print Office Poster
                  </button>
                </div>

                <div className="mt-2">
                  <button
                    type="button"
                    disabled={qrManaging}
                    onClick={() => handleManageQr(form.qr_active ? 'deactivate' : 'activate')}
                    className={`w-full rounded-lg border py-1.5 text-xs font-semibold transition-colors ${
                      form.qr_active
                        ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    {form.qr_active ? 'Deactivate QR Terminal' : 'Activate QR Terminal'}
                  </button>
                </div>

                <div className="mt-3 text-[10px] leading-relaxed text-[#64748B]">
                  Displays at the physical post office entrance. When scanned on a mobile phone on the same Wi-Fi network (or production HTTPS domain), staff log their check-in or check-out through automatic browser GPS and Haversine geofence verification.
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
