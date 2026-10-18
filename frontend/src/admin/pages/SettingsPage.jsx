import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  getAttendanceSettings,
  getDoorToken,
  saveAttendanceSettings,
} from '../data/repository'
import { useAuth } from '../data/auth'
import PageHeader from '../ui/PageHeader'

function localNetworkAddress() {
  return new Promise((resolve) => {
    const peer = new RTCPeerConnection({ iceServers: [] })
    peer.createDataChannel('')
    peer.createOffer().then((offer) => peer.setLocalDescription(offer))
    peer.onicecandidate = (event) => {
      const candidate = event.candidate?.candidate || ''
      const match = candidate.match(/(\d{1,3}(?:\.\d{1,3}){3})/)
      if (match && !match[1].startsWith('127.')) {
        resolve(match[1])
        peer.close()
      }
    }
    setTimeout(() => {
      peer.close()
      resolve('')
    }, 1200)
  })
}

function attendanceUrl(host) {
  const { protocol, port } = window.location
  const resolvedPort = port || (protocol === 'https:' ? '443' : '80')
  return `${protocol}//${host}:${resolvedPort}/attendance-qr/token`
}

function downloadQrImage(svg) {
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
    link.download = 'attendance-qr.png'
    link.click()
    URL.revokeObjectURL(url)
  }
  image.src = url
}

function useDoorQrUrl() {
  const [url, setUrl] = useState(() => attendanceUrl(window.location.hostname))

  useEffect(() => {
    const host = window.location.hostname
    if (host !== 'localhost' && host !== '127.0.0.1') {
      setUrl(attendanceUrl(host))
      return undefined
    }
    let cancelled = false
    localNetworkAddress().then((address) => {
      if (!cancelled && address) setUrl(attendanceUrl(address))
    })
    return () => {
      cancelled = true
    }
  }, [])

  return url
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
    latitude: String(settings.latitude ?? 6.9271),
    longitude: String(settings.longitude ?? 79.8612),
    radius_meters: String(settings.radius_meters ?? 100),
    on_time_start: settings.on_time_start || '07:30',
    on_time_end: settings.on_time_end || '08:30',
    late_start: settings.late_start || '08:31',
    late_end: settings.late_end || '09:30',
    half_day_start: settings.half_day_start || '09:31',
    half_day_end: settings.half_day_end || '12:00',
    checkout_start: settings.checkout_start || '16:00',
    checkout_end: settings.checkout_end || '18:00',
    open_days: settings.open_days || [0, 1, 2, 3, 4, 5],
    epf_employee_percent: String(settings.epf_employee_percent ?? 8),
    epf_employer_percent: String(settings.epf_employer_percent ?? 12),
    etf_percent: String(settings.etf_percent ?? 3),
    late_deduction_lkr: String(settings.late_deduction_lkr ?? 250),
    ot_rate_lkr: String(settings.ot_rate_lkr ?? 350),
  }
}

export default function SettingsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('Profile')
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const qrRef = useRef(null)
  const doorPage = useDoorQrUrl()
  const [doorToken, setDoorToken] = useState('')
  const [doorExpires, setDoorExpires] = useState(null)
  const [doorError, setDoorError] = useState('')

  // User Profile Form State
  const [profileName, setProfileName] = useState(user?.name || 'K. A. Jayasuriya')
  const [postmasterId, setPostmasterId] = useState(user?.username || 'PM-COL-001')
  const [profileEmail, setProfileEmail] = useState(`${user?.username || 'postmaster'}@slpost.lk`)
  const [profilePhone, setProfilePhone] = useState('+94 11 232 6161')
  const [postalLocation, setPostalLocation] = useState('Central Mail Exchange, Colombo 01')

  // Password state for mockup display
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  function loadDoorToken() {
    getDoorToken()
      .then((result) => {
        setDoorToken(result.token || '')
        setDoorExpires(result.expires_at ? new Date(result.expires_at * 1000) : null)
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
      })
      setForm(formFromSettings(saved))
      setNotice('Operational attendance & payroll settings successfully saved.')
    } catch (err) {
      setError(err.message || 'Could not save settings')
    } finally {
      setSaving(false)
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
          <div className="rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-sm">
            <div className="mb-3 border-b border-[#DFE8F2] pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#1677D2]">BIOMETRIC DOOR TERMINAL</span>
              <h3 className="text-sm font-bold text-[#172B4D]">Live Door QR Code</h3>
              <p className="text-xs text-[#64748B]">Staff scan this QR code with their mobile device to record attendance</p>
            </div>

            {doorError && (
              <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                {doorError}
              </div>
            )}

            {doorToken ? (
              <div ref={qrRef} className="flex flex-col items-center justify-center rounded-xl border border-[#DFE8F2] bg-white p-3">
                <QRCodeSVG
                  value={`${doorPage}?code=${encodeURIComponent(doorToken)}`}
                  size={200}
                  level="M"
                  includeMargin
                  marginSize={3}
                />
                <div className="mt-2 text-center">
                  <div className="text-[11px] font-bold text-[#172B4D]">{doorToken}</div>
                  <div className="text-[10px] text-[#64748B]">
                    {doorExpires ? `Expires: ${doorExpires.toLocaleTimeString()}` : 'Rotating token active'}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={loadDoorToken}
                className="w-full rounded-lg border border-[#DFE8F2] bg-[#F4F8FC] py-1.5 text-xs font-semibold text-[#172B4D] hover:bg-[#e2edf8]"
              >
                Refresh Door Code
              </button>
              <button
                type="button"
                disabled={!doorToken}
                onClick={() => downloadQrImage(qrRef.current?.querySelector('svg'))}
                className="w-full rounded-lg border border-[#1677D2] bg-white py-1.5 text-xs font-semibold text-[#1677D2] hover:bg-blue-50 disabled:opacity-50"
              >
                Download QR Code
              </button>
            </div>

            <div className="mt-3 text-[10px] leading-relaxed text-[#64748B]">
              Displays at the physical post office entrance. When scanned, staff log their on-time check-in through geofenced verification.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
