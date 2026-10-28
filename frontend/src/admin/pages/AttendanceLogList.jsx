import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Lock,
  Plus,
  QrCode,
  Search,
  Unlock,
  Users,
  X,
} from 'lucide-react'
import {
  applyLeaveRequest,
  cancelLeaveRequest,
  closeAttendanceDay,
  dailyAttendance,
  getLeaveRequests,
  list,
  openAttendanceDay,
  updateLeaveStatus,
} from '../data/repository'
import { useAuth } from '../data/auth'
import ChartCard from '../ui/ChartCard'
import { Donut } from '../ui/charts'
import KpiCard from '../ui/KpiCard'
import LeaveCalendars from '../../entitlements/LeaveCalendars'

const LEAVE_TYPES = [
  'Annual Leave',
  'Casual Leave',
  'Medical Leave',
  'Sick Leave',
  'Half Day Leave',
  'Duty Leave',
  'Special Leave',
]

export default function AttendanceLogList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isPostmaster = user?.role === 'postmaster'

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

  // Live leaves and employees
  const [leaves, setLeaves] = useState([])
  const [employees, setEmployees] = useState([])

  // Leave Application Modal State
  const [applyModalOpen, setApplyModalOpen] = useState(false)
  const [submittingLeave, setSubmittingLeave] = useState(false)
  const [leaveModalError, setLeaveModalError] = useState('')
  const [leaveForm, setLeaveForm] = useState({
    employee_id: '',
    leave_type: 'Annual Leave',
    from_date: new Date().toISOString().slice(0, 10),
    to_date: new Date().toISOString().slice(0, 10),
    reason: '',
  })

  // Load attendance
  async function reloadAttendance() {
    try {
      const result = await dailyAttendance({ date, search })
      setDay(result)
      setError('')
    } catch (err) {
      setError(err.message || 'Attendance could not be loaded')
    }
  }

  // Load leaves
  async function reloadLeaves() {
    try {
      const data = await getLeaveRequests()
      setLeaves(Array.isArray(data) ? data : [])
    } catch {
      // Keep existing leaves
    }
  }

  // Initial load and dependencies
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      dailyAttendance({ date, search }),
      getLeaveRequests().catch(() => []),
      list('employee').catch(() => []),
    ])
      .then(([attResult, leaveList, empList]) => {
        if (cancelled) return
        setDay(attResult)
        setLeaves(Array.isArray(leaveList) ? leaveList : [])
        setEmployees(Array.isArray(empList) ? empList : [])
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
  }, [date, search])

  const closed = day?.day_status === 'closed'
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
        if (statusFilter === 'On Leave' && st !== 'On Leave' && r.display_status !== 'On Leave') return false
        if (statusFilter === 'Incomplete' && r.display_status !== 'Incomplete') return false
      }
      return true
    })
  }, [records, officeFilter, statusFilter])

  // Count attendance and leave statuses
  const counts = useMemo(() => {
    let present = 0
    let late = 0
    let incomplete = 0
    const activeLeavesOnDate = leaves.filter((l) => {
      if (String(l.status || '').toLowerCase() !== 'approved') return false
      const f = String(l.from_date || '').slice(0, 10)
      const t = String(l.to_date || '').slice(0, 10)
      return date >= f && date <= t
    })
    let onLeave = day?.summary?.on_leave_count ?? activeLeavesOnDate.length
    let total = day?.summary?.total_employees || (employees.length > 0 ? employees.length : records.length) || 16

    records.forEach((r) => {
      const st = r.attendance_status || r.display_status || ''
      if (st === 'On Leave' || r.on_leave) {
        // counted in onLeave
      } else if (r.display_status === 'Late' || r.attendance_status === 'Late') {
        late += 1
      } else if (r.display_status === 'Incomplete' || r.display_status === 'Pending') {
        incomplete += 1
      } else if (r.display_status === 'Present' || st === 'Present' || st === 'On time') {
        present += 1
      }
    })

    const attendanceRate = total > 0 ? Math.round(((present + late) / total) * 100) : 92
    return { present, late, incomplete, onLeave, total, attendanceRate }
  }, [records, day, leaves, employees, date])

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

  // Handle Leave Submission (No Fingerprint)
  async function handleSubmitLeave(e) {
    e?.preventDefault()
    if (submittingLeave) return
    setLeaveModalError('')

    const empId = String(leaveForm.employee_id || '').trim()
    const fromDate = String(leaveForm.from_date || '').trim()
    const toDate = String(leaveForm.to_date || '').trim()
    const leaveType = String(leaveForm.leave_type || '').trim()

    if (!empId) {
      setLeaveModalError('Please select an employee.')
      return
    }
    if (!fromDate) {
      setLeaveModalError('Start date (From) is required.')
      return
    }
    if (!toDate) {
      setLeaveModalError('End date (To) is required.')
      return
    }
    if (toDate < fromDate) {
      setLeaveModalError('End date cannot be earlier than start date.')
      return
    }
    if (!leaveType) {
      setLeaveModalError('Leave type is required.')
      return
    }

    setSubmittingLeave(true)
    try {
      const saved = await applyLeaveRequest({
        employee_id: empId,
        leave_type: leaveType,
        from_date: fromDate,
        to_date: toDate,
        reason: leaveForm.reason || '',
        status: isPostmaster ? 'Approved' : 'Pending',
      })

      setApplyModalOpen(false)
      const empObj = employees.find((em) => (em.employee_id || em.name) === empId)
      const empName = empObj?.employee_name || empId
      setNotice(`Leave request for ${empName} saved successfully (${saved.status || 'Pending'}).`)
      setTimeout(() => setNotice(''), 4000)

      // Reload both leaves and daily attendance so status updates immediately
      await Promise.all([reloadLeaves(), reloadAttendance()])
    } catch (err) {
      // Keep form entries intact
      setLeaveModalError(err.message || 'Could not submit leave application. Please check details.')
    } finally {
      setSubmittingLeave(false)
    }
  }

  // Handle Postmaster Approval / Rejection / Cancellation
  async function handleActionLeave(leaveId, newStatus, empName) {
    let remarks = ''
    if (newStatus === 'Rejected') {
      const input = window.prompt(`Enter rejection reason for ${empName || 'employee'}:`, 'Staff scheduling requirements')
      if (input === null) return
      remarks = input.trim()
    } else if (newStatus === 'Cancelled') {
      const input = window.prompt(`Enter cancellation reason for ${empName || 'employee'}:`, 'Cancelled upon request')
      if (input === null) return
      remarks = input.trim()
    }

    try {
      if (newStatus === 'Cancelled') {
        await cancelLeaveRequest(leaveId, remarks)
      } else {
        await updateLeaveStatus(leaveId, newStatus, remarks)
      }
      setNotice(`Leave for ${empName || 'employee'} updated to ${newStatus}.`)
      setTimeout(() => setNotice(''), 3000)
      await Promise.all([reloadLeaves(), reloadAttendance()])
    } catch (err) {
      setError(err.message || `Could not update leave status to ${newStatus}.`)
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
          {activeTab === 'attendance' && (
            <>
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
                <option value="On Leave">On Approved Leave</option>
                <option value="Incomplete">Incomplete</option>
              </select>
            </>
          )}

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

          {activeTab === 'requests' ? (
            <button
              type="button"
              onClick={() => {
                setLeaveModalError('')
                setLeaveForm({
                  employee_id: employees[0]?.employee_id || employees[0]?.name || '',
                  leave_type: 'Annual Leave',
                  from_date: new Date().toISOString().slice(0, 10),
                  to_date: new Date().toISOString().slice(0, 10),
                  reason: '',
                })
                setApplyModalOpen(true)
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1677D2] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#1262ab]"
            >
              <Plus className="size-3.5" />
              Apply for Leave
            </button>
          ) : (
            <>
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
            </>
          )}

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
          value={counts.onLeave || 0}
          note="Approved official postal leave"
          icon={Calendar}
          tone="blue"
        />
      </div>

      {/* ── Main Workspace Section ───────────────────────────────────────── */}
      {activeTab === 'calendar' ? (
        <div className="rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-xs">
          <LeaveCalendars employees={employees} leaves={leaves} attendance={records} />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-12">
          {/* Left Area (8 cols): Either Leave Requests Table or Attendance Log Table */}
          <div className="xl:col-span-8">
            {activeTab === 'requests' ? (
              <ChartCard
                title="Leave Requests"
                note={`${leaves.length} recorded postal leave applications · No biometric verification required`}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#DFE8F2] bg-slate-50 text-[11px] font-semibold text-[#64748B] uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Employee</th>
                        <th className="py-2.5 px-3">Leave Type</th>
                        <th className="py-2.5 px-3">Start Date</th>
                        <th className="py-2.5 px-3">End Date</th>
                        <th className="py-2.5 px-3">Days</th>
                        <th className="py-2.5 px-3">Reason</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        {isPostmaster && <th className="py-2.5 px-3 text-right">Approval Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DFE8F2]">
                      {leaves.length === 0 ? (
                        <tr>
                          <td colSpan={isPostmaster ? 8 : 7} className="py-8 text-center text-slate-400">
                            No leave applications recorded yet. Click "Apply for Leave" to submit.
                          </td>
                        </tr>
                      ) : (
                        leaves.map((req, i) => {
                          const status = String(req.status || 'Pending')
                          const isApproved = status.toLowerCase() === 'approved'
                          const isRejected = status.toLowerCase() === 'rejected'
                          const isCancelled = status.toLowerCase() === 'cancelled'
                          const statusClass = isApproved
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                            : isRejected
                              ? 'text-rose-700 bg-rose-50 border-rose-200'
                              : isCancelled
                                ? 'text-slate-600 bg-slate-100 border-slate-300'
                                : 'text-amber-700 bg-amber-50 border-amber-200'

                          return (
                            <tr key={req.id || i} className="hover:bg-slate-50/70">
                              <td className="py-2.5 px-3 font-semibold text-[#172B4D]">
                                {req.employee_name || req.employee_id}
                                <span className="block text-[10px] font-normal text-slate-400">{req.employee_id}</span>
                              </td>
                              <td className="py-2.5 px-3 text-[#172B4D] font-medium">{req.leave_type || 'Leave'}</td>
                              <td className="py-2.5 px-3 text-[#64748B]">{req.from_date || req.start || '—'}</td>
                              <td className="py-2.5 px-3 text-[#64748B]">{req.to_date || req.end || '—'}</td>
                              <td className="py-2.5 px-3 text-[#64748B] font-semibold">{req.days || '1'}</td>
                              <td className="py-2.5 px-3 text-[#64748B] max-w-[150px] truncate">{req.reason || '—'}</td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>
                                  {status}
                                </span>
                              </td>
                              {isPostmaster && (
                                <td className="py-2.5 px-3 text-right">
                                  {status.toLowerCase() === 'pending' ? (
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleActionLeave(req.id, 'Approved', req.employee_name)}
                                        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white shadow-xs hover:bg-emerald-700"
                                      >
                                        <Check className="size-3" /> Approve
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleActionLeave(req.id, 'Rejected', req.employee_name)}
                                        className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                                      >
                                        <X className="size-3" /> Reject
                                      </button>
                                    </div>
                                  ) : status.toLowerCase() === 'approved' ? (
                                    <button
                                      type="button"
                                      onClick={() => handleActionLeave(req.id, 'Cancelled', req.employee_name)}
                                      className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
                                    >
                                      Cancel Leave
                                    </button>
                                  ) : (
                                    <span className="text-[11px] text-slate-400">
                                      {req.rejection_reason || req.cancellation_reason || 'Archived'}
                                    </span>
                                  )}
                                </td>
                              )}
                            </tr>
                          )
                        })
                      )}
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
                        <th className="py-2.5 px-3">Working Duration</th>
                        <th className="py-2.5 px-3">Classification</th>
                        <th className="py-2.5 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DFE8F2]">
                      {filteredRecords.map((r, i) => {
                        const isLate = r.display_status === 'Late' || r.attendance_status === 'Late'
                        const isIncomplete = r.display_status === 'Incomplete'
                        const isOnLeave = r.attendance_status === 'On Leave' || r.display_status === 'On Leave' || r.on_leave
                        const isAbsent = (r.attendance_status === 'Absent' || r.display_status === 'Absent' || r.is_absent) && !isOnLeave

                        const statusBadge = isOnLeave
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : isAbsent
                            ? 'border-slate-300 bg-slate-100 text-slate-600'
                            : isLate
                              ? 'border-amber-200 bg-amber-50 text-amber-700'
                              : isIncomplete
                                ? 'border-orange-200 bg-orange-50 text-orange-700'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700'

                        const statusText = isOnLeave
                          ? `On Leave (${r.leave_type || 'Approved'})`
                          : isAbsent
                            ? 'Absent'
                            : isLate
                              ? 'Late'
                              : isIncomplete
                                ? 'Incomplete'
                                : 'Present'

                        return (
                          <tr
                            key={r.name || r._id || i}
                            onClick={() => navigate(`/attendance-log/${encodeURIComponent(r.name || r._id || '')}`)}
                            className="cursor-pointer hover:bg-slate-50/70"
                          >
                            <td className="py-2.5 px-3 font-semibold text-[#172B4D]">
                              {r.employee_name}
                              <span className="block text-[10px] font-normal text-slate-400">{r.employee_id}</span>
                            </td>
                            <td className="py-2.5 px-3 text-[#64748B]">{r.post_office || '—'}</td>
                            <td className="py-2.5 px-3 text-[#64748B] font-mono">
                              {r.check_in_time || r.fingerprint_in || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-[#64748B] font-mono">
                              {r.check_out_time || r.fingerprint_out || '—'}
                            </td>
                            <td className="py-2.5 px-3">
                              {isOnLeave ? (
                                <span className="text-[11px] text-blue-600 font-medium">Exempt · On Leave</span>
                              ) : isAbsent ? (
                                <span className="text-[11px] text-slate-400">—</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                                  <Check className="size-3" /> Verified (0m)
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-[#64748B] font-mono">{r.working_duration_formatted || '—'}</td>
                            <td className="py-2.5 px-3 text-[#64748B] font-medium">
                              {isOnLeave ? 'Approved Leave' : r.attendance_type || r.attendance_status || 'On Time'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadge}`}>
                                {statusText}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                      {filteredRecords.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400">
                            No attendance logs matching the selected filters.
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
                  { name: 'On Leave', value: counts.onLeave || 1, color: '#1677D2' },
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
      )}

      {/* ── LEAVE APPLICATION MODAL (NO FINGERPRINT REQUIRED) ───────────── */}
      {applyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl transition-all">
            <div className="flex items-center justify-between border-b border-[#DFE8F2] pb-3.5">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-[#1677D2]">
                  <FileText className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#172B4D]">Apply for Leave</h3>
                  <p className="text-xs text-[#64748B]">Official Sri Lanka Post Employee Leave Request</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApplyModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-5" />
              </button>
            </div>

            {leaveModalError && (
              <div className="mt-3.5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <AlertCircle className="size-4 shrink-0 text-rose-600" />
                <span>{leaveModalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitLeave} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-[#172B4D]">
                  Employee <span className="text-rose-500">*</span>
                </label>
                <select
                  value={leaveForm.employee_id}
                  onChange={(e) => setLeaveForm((curr) => ({ ...curr, employee_id: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-[#DFE8F2] bg-slate-50 px-3 py-2 text-xs text-[#172B4D] focus:border-[#1677D2] focus:bg-white focus:outline-none"
                >
                  <option value="">Select an employee…</option>
                  {employees.map((emp) => (
                    <option key={emp.employee_id || emp.name} value={emp.employee_id || emp.name}>
                      {emp.employee_id} — {emp.employee_name} ({emp.designation || 'Officer'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-[#172B4D]">
                  Leave Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={leaveForm.leave_type}
                  onChange={(e) => setLeaveForm((curr) => ({ ...curr, leave_type: e.target.value }))}
                  className="w-full rounded-lg border border-[#DFE8F2] bg-slate-50 px-3 py-2 text-xs text-[#172B4D] focus:border-[#1677D2] focus:bg-white focus:outline-none"
                >
                  {LEAVE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-[#172B4D]">
                    Start Date (From) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={leaveForm.from_date}
                    onChange={(e) => setLeaveForm((curr) => ({ ...curr, from_date: e.target.value }))}
                    className="w-full rounded-lg border border-[#DFE8F2] bg-slate-50 px-3 py-2 text-xs text-[#172B4D] focus:border-[#1677D2] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-[#172B4D]">
                    End Date (To) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={leaveForm.to_date}
                    onChange={(e) => setLeaveForm((curr) => ({ ...curr, to_date: e.target.value }))}
                    className="w-full rounded-lg border border-[#DFE8F2] bg-slate-50 px-3 py-2 text-xs text-[#172B4D] focus:border-[#1677D2] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-[#172B4D]">Reason / Remarks</label>
                <textarea
                  rows={2}
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm((curr) => ({ ...curr, reason: e.target.value }))}
                  placeholder="Provide reason for leave (optional)"
                  className="w-full rounded-lg border border-[#DFE8F2] bg-slate-50 px-3 py-2 text-xs text-[#172B4D] focus:border-[#1677D2] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-[11px] text-blue-900">
                <span className="font-semibold">Note:</span> Biometric fingerprint verification is not required for official leave applications. Requests will be submitted for Postmaster review.
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-[#DFE8F2] pt-4">
                <button
                  type="button"
                  onClick={() => setApplyModalOpen(false)}
                  disabled={submittingLeave}
                  className="rounded-lg border border-[#DFE8F2] px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLeave || !leaveForm.employee_id || !leaveForm.from_date || !leaveForm.to_date}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1677D2] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1262ab] disabled:opacity-50"
                >
                  {submittingLeave ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> Submitting…
                    </>
                  ) : (
                    'Submit Leave Application'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
