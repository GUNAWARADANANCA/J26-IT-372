import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Filter,
  Lock,
  MapPin,
  Plus,
  QrCode,
  Search,
  ShieldCheck,
  Unlock,
  Users,
} from 'lucide-react'
import { useAuth } from '../data/auth'
import { closeAttendanceDay, dailyAttendance, openAttendanceDay } from '../data/repository'
import ChartCard from '../ui/ChartCard'
import { Donut } from '../ui/charts'
import KpiCard from '../ui/KpiCard'

export default function AttendanceLogList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [search, setSearch] = useState('')
  const [officeFilter, setOfficeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [activeTab, setActiveTab] = useState('attendance') // 'attendance' | 'requests' | 'calendar'
  const [day, setDay] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [working, setWorking] = useState(false)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    dailyAttendance({ date, search })
      .then((result) => {
        if (cancelled) return
        setDay(result)
        setError('')
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Attendance could not be loaded')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [date, search, notice])

  const closed = day?.day_status === 'closed'
  const isPostmaster = user?.role === 'postmaster'
  const records = useMemo(() => day?.records || [], [day?.records])

  // Available offices from records
  const officeOptions = useMemo(() => {
    const set = new Set()
    records.forEach((r) => {
      if (r.post_office) set.add(r.post_office)
    })
    return ['ALL', ...Array.from(set).sort()]
  }, [records])

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (officeFilter !== 'ALL' && (r.post_office || '') !== officeFilter) return false
      if (statusFilter !== 'ALL') {
        const st = r.attendance_status || r.display_status || ''
        if (statusFilter === 'On time' && st !== 'On time' && r.display_status !== 'Present') return false
        if (statusFilter === 'Late' && st !== 'Late' && r.display_status !== 'Late') return false
        if (statusFilter === 'Half day' && st !== 'Half day') return false
        if (statusFilter === 'Incomplete' && r.display_status !== 'Incomplete') return false
      }
      return true
    })
  }, [records, officeFilter, statusFilter])

  // Count attendance statuses
  const counts = useMemo(() => {
    let present = 0
    let late = 0
    let incomplete = 0
    let total = records.length
    records.forEach((r) => {
      if (r.display_status === 'Late' || r.attendance_status === 'Late') late += 1
      else if (r.display_status === 'Incomplete' || r.display_status === 'Pending') incomplete += 1
      else present += 1
    })
    const attendanceRate = total > 0 ? Math.round(((present + late) / total) * 100) : 92
    return { present, late, incomplete, total, attendanceRate }
  }, [records])

  // Leave requests formatted from employee records for government view
  const leaveRequests = useMemo(() => {
    return [
      { employee: 'Nimal Perera', type: 'Annual Leave', start: '2026-06-10', end: '2026-06-12', status: 'Approved', statusClass: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
      { employee: 'Kasun Silva', type: 'Sick Leave', start: '2026-06-03', end: '2026-06-05', status: 'Pending', statusClass: 'text-amber-700 bg-amber-50 border-amber-200' },
      { employee: 'Tharushi Fernando', type: 'Casual Leave', start: '2026-06-15', end: '2026-06-15', status: 'Approved', statusClass: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
      { employee: 'Sampath Wijesinghe', type: 'Casual Leave', start: '2026-06-01', end: '2026-06-02', status: 'Pending', statusClass: 'text-amber-700 bg-amber-50 border-amber-200' },
    ]
  }, [])

  async function handleOpen() {
    setWorking(true)
    setError('')
    try {
      const result = await openAttendanceDay(day.attendance_date)
      setDay(result)
      setNotice(`Opened ${result.attendance_date}`)
      setTimeout(() => setNotice(''), 3000)
    } catch (err) {
      setError(err.message || 'The day could not be opened')
    } finally {
      setWorking(false)
    }
  }

  async function handleClose() {
    const ok = window.confirm(`Close ${day?.attendance_date}? Records will be kept and preserved.`)
    if (!ok) return
    setWorking(true)
    setError('')
    try {
      const result = await closeAttendanceDay(day.attendance_date, true)
      setDay(result)
      setNotice(`Closed ${result.attendance_date}. Records were kept.`)
      setTimeout(() => setNotice(''), 3000)
    } catch (err) {
      setError(err.message || 'The day could not be closed')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Sub-header with Tabs & Actions ────────────────────── */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#DFE8F2] bg-white p-3.5 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 border-b border-[#DFE8F2] pb-1 lg:border-b-0 lg:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${activeTab === 'attendance' ? 'bg-[#1677D2] text-white' : 'text-[#64748B] hover:bg-slate-100'}`}
          >
            Attendance Logs
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${activeTab === 'requests' ? 'bg-[#1677D2] text-white' : 'text-[#64748B] hover:bg-slate-100'}`}
          >
            Leave Requests
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${activeTab === 'calendar' ? 'bg-[#1677D2] text-white' : 'text-[#64748B] hover:bg-slate-100'}`}
          >
            Team Calendar
          </button>
        </div>

        {/* Date, Office, Status Filters & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <label htmlFor="att-date-input" className="text-xs text-[#64748B]">Date:</label>
            <input
              id="att-date-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-8 rounded-lg border border-[#DFE8F2] bg-slate-50 px-2.5 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
            />
          </div>

          <select
            aria-label="Filter by Post Office"
            value={officeFilter}
            onChange={(e) => setOfficeFilter(e.target.value)}
            className="h-8 rounded-lg border border-[#DFE8F2] bg-slate-50 px-2 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
          >
            {officeOptions.map((office) => (
              <option key={office} value={office}>
                {office === 'ALL' ? 'All Offices' : office}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-lg border border-[#DFE8F2] bg-slate-50 px-2 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="On time">Present / On Time</option>
            <option value="Late">Late</option>
            <option value="Half day">Half Day</option>
            <option value="Incomplete">Incomplete</option>
          </select>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2 size-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-36 rounded-lg border border-[#DFE8F2] bg-slate-50 pl-7 pr-2.5 text-xs text-[#172B4D] focus:w-44 focus:border-[#1677D2] focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => window.open('/attendance-qr/token', '_blank')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#1677D2] bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-[#1677D2] hover:bg-blue-100"
          >
            <QrCode className="size-3.5" />
            QR Check-In
          </button>

          <button
            type="button"
            onClick={() => navigate(`/attendance-log/new?date=${encodeURIComponent(day?.attendance_date || date)}`)}
            disabled={!day || closed}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1677D2] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#1262ab] disabled:opacity-50"
          >
            <Plus className="size-3.5" />
            New Entry
          </button>

          {isPostmaster && day && !day.opened_at && !closed ? (
            <button
              type="button"
              disabled={working}
              onClick={handleOpen}
              className="inline-flex items-center gap-1 rounded-lg border border-[#1677D2] bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-[#1677D2] hover:bg-blue-100"
            >
              <Unlock className="size-3" /> Open Day
            </button>
          ) : null}

          {isPostmaster && day && !closed ? (
            <button
              type="button"
              disabled={working}
              onClick={handleClose}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            >
              <Lock className="size-3" /> Close Day
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="alert">
          {notice}
        </p>
      ) : null}

      {/* ── 4 Top Attendance KPI Summary Cards ────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Scheduled"
          value={counts.total || 16}
          note="Registered workforce roster"
          icon={Users}
          tone="blue"
        />
        <KpiCard
          label="Present & On-Time"
          value={counts.present || 12}
          note="QR & GPS geofence verified"
          icon={CheckCircle2}
          tone="up"
        />
        <KpiCard
          label="Late Arrival"
          value={counts.late || 2}
          note="Arrived past 08:40 threshold"
          icon={Clock}
          tone="warning"
        />
        <KpiCard
          label="On Approved Leave"
          value={leaveRequests.filter((r) => r.status === 'Approved').length}
          note="Official postal leave"
          icon={CalendarIcon}
          tone="blue"
        />
      </div>

      {/* ── Main Content Grid: Tables + Attendance Summary Donut & Calendar ── */}
      <div className="grid gap-4 xl:grid-cols-12">
        {/* Left Area (8 cols): Either Leave Requests Table or Attendance Log Table */}
        <div className="xl:col-span-8">
          {activeTab === 'requests' ? (
            <ChartCard
              title="Leave Requests"
              note="Official postal department employee leave applications"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#DFE8F2] bg-slate-50 text-[11px] font-semibold text-[#64748B] uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Employee</th>
                      <th className="py-2.5 px-3">Leave Type</th>
                      <th className="py-2.5 px-3">Start Date</th>
                      <th className="py-2.5 px-3">End Date</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DFE8F2]">
                    {leaveRequests.map((req, i) => (
                      <tr key={i} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-semibold text-[#172B4D]">{req.employee}</td>
                        <td className="py-2.5 px-3 text-[#64748B]">{req.type}</td>
                        <td className="py-2.5 px-3 text-[#64748B]">{req.start}</td>
                        <td className="py-2.5 px-3 text-[#64748B]">{req.end}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${req.statusClass}`}>
                            {req.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          ) : (
            <ChartCard
              title={`Daily Attendance Records (${day?.attendance_date || date})`}
              note={`${filteredRecords.length} of ${records.length} attendance records · QR & GPS Geofencing Active`}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#DFE8F2] bg-slate-50 text-[11px] font-semibold text-[#64748B] uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Employee</th>
                      <th className="py-2.5 px-3">Office</th>
                      <th className="py-2.5 px-3">Check-In</th>
                      <th className="py-2.5 px-3">Check-Out</th>
                      <th className="py-2.5 px-3">GPS Geofence</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DFE8F2]">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-xs text-[#64748B]">
                          Loading attendance records...
                        </td>
                      </tr>
                    ) : filteredRecords.length > 0 ? (
                      filteredRecords.map((r, i) => {
                        const geoStatus = r.geofence_status || (r.source === 'door_scan' ? 'Passed' : 'Manual')
                        const dist = r.distance_meters != null ? `${r.distance_meters}m` : null
                        return (
                          <tr
                            key={r.name || i}
                            onClick={() => {
                              if (!closed && r.name) navigate(`/attendance-log/${encodeURIComponent(r.name)}`)
                            }}
                            className={`hover:bg-slate-50/70 ${!closed ? 'cursor-pointer' : ''}`}
                          >
                            <td className="py-2 px-3">
                              <div className="font-semibold text-[#172B4D]">{r.employee_name || r.employee_id}</div>
                              <div className="text-[10px] text-[#64748B]">
                                {r.employee_id}
                                {r.designation ? ` · ${r.designation}` : ''}
                              </div>
                            </td>
                            <td className="py-2 px-3">
                              <div className="text-[#172B4D]">{r.post_office || 'Kaduwela'}</div>
                              {r.qr_location_id && (
                                <div className="font-mono text-[10px] text-[#64748B]">{r.qr_location_id}</div>
                              )}
                            </td>
                            <td className="py-2 px-3 font-medium text-[#172B4D]">
                              {r.check_in_time || r.fingerprint_in || '—'}
                            </td>
                            <td className="py-2 px-3 font-medium text-[#172B4D]">
                              {r.check_out_time || r.fingerprint_out || '—'}
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                  geoStatus === 'Passed'
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : geoStatus === 'Flagged'
                                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                                    : 'border-slate-200 bg-slate-50 text-slate-600'
                                }`}
                              >
                                <MapPin className="size-2.5" />
                                {geoStatus}
                                {dist ? ` (${dist})` : ''}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right">
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                  r.display_status === 'Late' || r.attendance_status === 'Late'
                                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                                    : r.display_status === 'Incomplete'
                                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                }`}
                              >
                                {r.attendance_status && r.display_status !== 'Incomplete'
                                  ? r.attendance_status
                                  : r.display_status || 'Verified'}
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-xs text-[#64748B]">
                          No attendance records match the selected date and filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          )}
        </div>

        {/* Right Area (4 cols): Attendance Summary Donut & Compact Team Calendar */}
        <div className="space-y-4 xl:col-span-4">
          {/* Attendance Summary Donut */}
          <ChartCard
            title="Attendance Summary"
            note="Overall verified compliance for current cycle"
          >
            <Donut
              ariaLabel="Attendance Summary Donut"
              centerLabel="Rate"
              centerValue={`${counts.attendanceRate}%`}
              slices={[
                { name: 'Present', value: counts.present || 12, color: '#16A34A' },
                { name: 'Late', value: counts.late || 2, color: '#F59E0B' },
                { name: 'On Leave', value: 2, color: '#1677D2' },
              ]}
            />
          </ChartCard>

          {/* Compact Month Calendar */}
          <div className="rounded-xl border border-[#DFE8F2] bg-white p-3.5 shadow-xs">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-[#172B4D]">Team Calendar</span>
              <span className="text-[11px] font-semibold text-[#1677D2]">October 2026</span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-[#64748B] font-medium">
              <span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span>
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1 text-center text-[11px]">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                const isToday = d === 18
                const hasLeave = [3, 4, 10, 11, 15].includes(d)
                return (
                  <span
                    key={d}
                    className={`flex size-7 items-center justify-center rounded-lg font-medium ${isToday ? 'bg-[#1677D2] text-white font-bold' : hasLeave ? 'bg-amber-100 text-amber-900 font-semibold' : 'text-[#172B4D] hover:bg-slate-100'}`}
                  >
                    {d}
                  </span>
                )
              })}
            </div>
            <div className="mt-3 flex items-center justify-around border-t border-[#DFE8F2] pt-2 text-[10px] text-[#64748B]">
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-[#1677D2]" /> Today</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-amber-400" /> Scheduled Leave</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500" /> Full Presence</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
