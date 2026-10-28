import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Info,
  ShieldAlert,
  User,
  X,
} from 'lucide-react'
import { getAttendanceRange } from '../admin/data/repository'

const PRESENT_STATUSES = new Set(['on time', 'late', 'half day', 'present'])

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?'
}

function iso(day) {
  const month = String(day.getMonth() + 1).padStart(2, '0')
  const date = String(day.getDate()).padStart(2, '0')
  return `${day.getFullYear()}-${month}-${date}`
}

function inRange(value, from, to) {
  if (!from || !to || !value) return false
  const v = String(value).slice(0, 10)
  const f = String(from).slice(0, 10)
  const t = String(to).slice(0, 10)
  return v >= f && v <= t
}

function getDayKind(date, personLeaves, personAttendance) {
  // 1. Check for approved leave
  const approved = personLeaves.find(
    (row) =>
      String(row.status || '').toLowerCase() === 'approved' &&
      inRange(date, row.from_date, row.to_date)
  )

  // 2. Check for pending leave
  const pending = personLeaves.find(
    (row) =>
      String(row.status || '').toLowerCase() === 'pending' &&
      inRange(date, row.from_date, row.to_date)
  )

  // 3. Check for attendance record
  const record = personAttendance.find(
    (row) => String(row.date || row.attendance_date || '').slice(0, 10) === date
  )

  // Overlap Conflict Check: Approved Leave + Attendance Log
  if (approved && record) {
    const isPresent =
      PRESENT_STATUSES.has(String(record.attendance_status || '').trim().toLowerCase()) ||
      Boolean(record.check_in_time && record.check_in_time !== '—') ||
      Boolean(record.fingerprint_in)

    if (isPresent) {
      return {
        type: 'conflict',
        bg: '#be123c', // Crimson base
        hasConflictDot: true,
        title: `Conflict: Approved ${approved.leave_type || 'Leave'} + Attendance Log (${record.attendance_status || 'Present'})`,
        leave: approved,
        attendance: record,
      }
    }
  }

  if (approved) {
    return {
      type: 'approved',
      bg: '#be123c', // Red / Rose
      color: '#ffffff',
      title: `${approved.leave_type || 'Approved Leave'} · Approved · Marked Absent`,
      leave: approved,
    }
  }

  if (pending) {
    return {
      type: 'pending',
      bg: '#d97706', // Amber
      color: '#ffffff',
      title: `${pending.leave_type || 'Pending Leave'} · Waiting for Postmaster Approval`,
      leave: pending,
    }
  }

  if (record) {
    const status = String(record.attendance_status || record.display_status || '').trim().toLowerCase()
    const hasCheckIn = Boolean(record.check_in_time && record.check_in_time !== '—') || Boolean(record.fingerprint_in)

    if (PRESENT_STATUSES.has(status) || hasCheckIn) {
      return {
        type: 'present',
        bg: '#0f766e', // Teal
        color: '#ffffff',
        title: `Present · ${record.attendance_status || 'On Time'} · Verified`,
        attendance: record,
      }
    }
    return {
      type: 'attendance_other',
      bg: '#64748b', // Slate
      color: '#ffffff',
      title: record.attendance_status || 'Attendance Logged',
      attendance: record,
    }
  }

  return null
}

export default function LeaveCalendars({ employees = [], leaves = [], attendance = [] }) {
  const today = useMemo(() => new Date(), [])
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() })
  const [monthAttendance, setMonthAttendance] = useState([])
  const [selectedCell, setSelectedCell] = useState(null) // { employeeId, employeeName, date, kind }

  // Fetch month attendance dynamically whenever cursor month/year changes
  useEffect(() => {
    let active = true
    const start = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-01`
    const lastDay = new Date(cursor.year, cursor.month + 1, 0).getDate()
    const end = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    getAttendanceRange(start, end)
      .then((records) => {
        if (active && Array.isArray(records)) {
          setMonthAttendance(records)
        }
      })
      .catch(() => {
        // Graceful fallback to prop attendance
      })

    return () => {
      active = false
    }
  }, [cursor.year, cursor.month])

  // Combine parent-provided attendance with dynamic month attendance (deduplicated)
  const combinedAttendance = useMemo(() => {
    const map = new Map()
    for (const r of monthAttendance) {
      const key = `${r.employee_id || ''}-${String(r.date || '').slice(0, 10)}`
      map.set(key, r)
    }
    for (const r of attendance) {
      const key = `${r.employee_id || ''}-${String(r.date || '').slice(0, 10)}`
      if (!map.has(key)) map.set(key, r)
    }
    return Array.from(map.values())
  }, [monthAttendance, attendance])

  // Month grid layout calculations
  // Leading blank spaces for Monday-start week: Mon=0, Sun=6
  const leading = (new Date(cursor.year, cursor.month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
  const cells = useMemo(() => {
    return [
      ...Array.from({ length: leading }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) =>
        iso(new Date(cursor.year, cursor.month, index + 1))
      ),
    ]
  }, [cursor.year, cursor.month, leading, daysInMonth])

  const title = new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const sortedEmployees = useMemo(
    () =>
      [...employees].sort((a, b) =>
        String(a.employee_name || a.name || '').localeCompare(String(b.employee_name || b.name || ''))
      ),
    [employees]
  )

  function shiftMonth(amount) {
    setCursor((current) => {
      const next = new Date(current.year, current.month + amount, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  function jumpToToday() {
    setCursor({ year: today.getFullYear(), month: today.getMonth() })
  }

  return (
    <Box sx={{ mb: 2 }}>
      {/* ── Top Header Controls & Month Switcher ─────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
          pb: 1.5,
          borderBottom: '1px solid #e2e8f0',
          flexWrap: 'wrap',
          gap: 1.5,
        }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a' }}>
            Employee Leave & Attendance Calendars
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            {sortedEmployees.length} registered postal officers · Synchronized with live MongoDB records
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button
            size="small"
            variant="outlined"
            onClick={jumpToToday}
            sx={{
              textTransform: 'none',
              fontSize: 12,
              borderColor: '#cbd5e1',
              color: '#475569',
              '&:hover': { borderColor: '#1677D2', color: '#1677D2' },
            }}
          >
            Today
          </Button>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              bgcolor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: 2,
              p: 0.25,
            }}
          >
            <Button
              size="small"
              onClick={() => shiftMonth(-1)}
              sx={{ minWidth: 32, p: 0.5, color: '#334155' }}
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </Button>
            <Typography
              variant="body2"
              sx={{ minWidth: 130, textAlign: 'center', fontWeight: 700, color: '#1e293b' }}
            >
              {title}
            </Typography>
            <Button
              size="small"
              onClick={() => shiftMonth(1)}
              sx={{ minWidth: 32, p: 0.5, color: '#334155' }}
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </Button>
          </Box>
        </Box>
      </Box>

      {/* ── Accessible Color Legend ─────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mb: 2.5,
          p: 1.25,
          bgcolor: '#f8fafc',
          borderRadius: 2,
          border: '1px solid #e2e8f0',
          fontSize: 12,
          color: '#334155',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontWeight: 600, color: '#64748b' }}>Status Legend:</span>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ width: 12, height: 12, bgcolor: '#0f766e', borderRadius: '3px' }} />
          <span>Present (Verified Attendance)</span>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ width: 12, height: 12, bgcolor: '#be123c', borderRadius: '3px' }} />
          <span>Approved Leave (Marked Absent)</span>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ width: 12, height: 12, bgcolor: '#d97706', borderRadius: '3px' }} />
          <span>Pending Leave Request</span>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box
            sx={{
              width: 12,
              height: 12,
              bgcolor: '#be123c',
              border: '2px solid #0f766e',
              borderRadius: '3px',
            }}
          />
          <span>Overlap / Conflict</span>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box
            sx={{
              width: 12,
              height: 12,
              bgcolor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '3px',
            }}
          />
          <span>No Attendance / Leave</span>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box
            sx={{
              width: 12,
              height: 12,
              bgcolor: '#ffffff',
              border: '2px solid #1677D2',
              borderRadius: '3px',
            }}
          />
          <span>Selected Date</span>
        </Box>
      </Box>

      {/* ── Selected Date Details Banner ────────────────────────────── */}
      {selectedCell && (
        <Box
          sx={{
            mb: 2.5,
            p: 2,
            bgcolor: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: 2,
            position: 'relative',
          }}
        >
          <Button
            size="small"
            onClick={() => setSelectedCell(null)}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              minWidth: 'auto',
              p: 0.5,
              color: '#64748b',
            }}
            aria-label="Close details"
          >
            <X size={16} />
          </Button>

          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                bgcolor: '#1677D2',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              {initials(selectedCell.employeeName)}
            </Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                  {selectedCell.employeeName}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  ({selectedCell.employeeId})
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    px: 1,
                    py: 0.25,
                    bgcolor: '#e0f2fe',
                    color: '#0369a1',
                    borderRadius: 1,
                    fontWeight: 600,
                  }}
                >
                  {selectedCell.date}
                </Typography>
              </Box>

              {/* Status Breakdown */}
              {selectedCell.kind?.type === 'approved' && (
                <Box sx={{ fontSize: 13, color: '#9f1239' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#be123c' }}>
                    Approved Leave: {selectedCell.kind.leave?.leave_type || 'Leave'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#475569', display: 'block' }}>
                    Duration: {selectedCell.kind.leave?.from_date} to {selectedCell.kind.leave?.to_date} (
                    {selectedCell.kind.leave?.days || '1'} working day(s))
                  </Typography>
                  {selectedCell.kind.leave?.reason && (
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                      Reason: "{selectedCell.kind.leave.reason}"
                    </Typography>
                  )}
                  {selectedCell.kind.leave?.reviewed_by && (
                    <Typography variant="caption" sx={{ color: '#059669', display: 'block' }}>
                      Reviewed by: {selectedCell.kind.leave.reviewed_by}
                    </Typography>
                  )}
                </Box>
              )}

              {selectedCell.kind?.type === 'pending' && (
                <Box sx={{ fontSize: 13, color: '#b45309' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#d97706' }}>
                    Pending Leave Request: {selectedCell.kind.leave?.leave_type || 'Leave'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#475569', display: 'block' }}>
                    Requested: {selectedCell.kind.leave?.from_date} to {selectedCell.kind.leave?.to_date} (
                    {selectedCell.kind.leave?.days || '1'} day(s))
                  </Typography>
                  {selectedCell.kind.leave?.reason && (
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                      Reason: "{selectedCell.kind.leave.reason}"
                    </Typography>
                  )}
                  <Typography variant="caption" sx={{ color: '#d97706', display: 'block', fontWeight: 600 }}>
                    Awaiting Postmaster approval
                  </Typography>
                </Box>
              )}

              {selectedCell.kind?.type === 'present' && (
                <Box sx={{ fontSize: 13, color: '#065f46' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f766e' }}>
                    Verified Attendance: {selectedCell.kind.attendance?.attendance_status || 'Present'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#475569', display: 'block' }}>
                    Check-in: {selectedCell.kind.attendance?.check_in_time || 'Recorded'} · Check-out:{' '}
                    {selectedCell.kind.attendance?.check_out_time || '—'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                    Method: {selectedCell.kind.attendance?.verification_method || 'GPS Geofence + Door QR'}
                  </Typography>
                </Box>
              )}

              {selectedCell.kind?.type === 'conflict' && (
                <Box sx={{ fontSize: 13, color: '#be123c' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#be123c' }}>
                    Attendance & Approved Leave Overlap (Review Required)
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#475569', display: 'block' }}>
                    Leave: {selectedCell.kind.leave?.leave_type} ({selectedCell.kind.leave?.from_date} to{' '}
                    {selectedCell.kind.leave?.to_date})
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#0f766e', display: 'block' }}>
                    Attendance: Checked in at {selectedCell.kind.attendance?.check_in_time || 'recorded'} (
                    {selectedCell.kind.attendance?.attendance_status || 'Present'})
                  </Typography>
                </Box>
              )}

              {!selectedCell.kind && (
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  No attendance or official leave request recorded for this date.
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      )}

      {/* ── Employee Calendars Responsive Grid ──────────────────────── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
          gap: 2,
        }}
      >
        {sortedEmployees.map((person) => {
          const empId = String(person.employee_id || person.name || '').trim()
          const empName = person.employee_name || person.name || empId

          // Filter leaves matching employee ID strictly
          const personLeaves = leaves.filter((row) => {
            const rId = String(row.employee_id || '').trim()
            return rId === empId
          })

          // Filter attendance matching employee ID strictly
          const personAttendance = combinedAttendance.filter((row) => {
            const aId = String(row.employee_id || '').trim()
            return aId === empId
          })

          // Calculate monthly leave metrics for this employee
          const monthStart = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-01`
          const monthEnd = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

          const approvedInMonth = personLeaves.filter(
            (l) =>
              String(l.status || '').toLowerCase() === 'approved' &&
              l.from_date <= monthEnd &&
              l.to_date >= monthStart
          )
          const pendingInMonth = personLeaves.filter(
            (l) =>
              String(l.status || '').toLowerCase() === 'pending' &&
              l.from_date <= monthEnd &&
              l.to_date >= monthStart
          )

          return (
            <Box
              key={empId}
              sx={{
                bgcolor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 2.5,
                p: 1.75,
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                transition: 'box-shadow 0.2s',
                '&:hover': { boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)' },
              }}
            >
              {/* Employee Card Header */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 1.5,
                  gap: 1,
                  flexWrap: 'wrap',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      bgcolor: '#12315c',
                      color: '#ffffff',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {initials(empName)}
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                      {empName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                      {empId} · {person.designation || 'Officer'}
                    </Typography>
                  </Box>
                </Box>

                {/* Monthly Leave Summary Badges */}
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  {approvedInMonth.length > 0 && (
                    <Box
                      sx={{
                        px: 1,
                        py: 0.25,
                        bgcolor: '#ffe4e6',
                        color: '#be123c',
                        borderRadius: 1,
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      {approvedInMonth.length} Approved Leave
                    </Box>
                  )}
                  {pendingInMonth.length > 0 && (
                    <Box
                      sx={{
                        px: 1,
                        py: 0.25,
                        bgcolor: '#fef3c7',
                        color: '#b45309',
                        borderRadius: 1,
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      {pendingInMonth.length} Pending
                    </Box>
                  )}
                </Box>
              </Box>

              {/* 7-column Weekday Grid */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((label) => (
                  <Typography
                    key={label}
                    variant="caption"
                    sx={{ textAlign: 'center', color: '#94a3b8', fontWeight: 600, fontSize: 10 }}
                  >
                    {label}
                  </Typography>
                ))}

                {cells.map((date, index) => {
                  if (!date) {
                    return <Box key={`blank-${empId}-${index}`} />
                  }

                  const kind = getDayKind(date, personLeaves, personAttendance)
                  const isSelected = selectedCell?.employeeId === empId && selectedCell?.date === date

                  return (
                    <Tooltip key={date} title={kind?.title || `${date}: No record`} arrow placement="top">
                      <Box
                        onClick={() =>
                          setSelectedCell({
                            employeeId: empId,
                            employeeName: empName,
                            date,
                            kind,
                          })
                        }
                        sx={{
                          minHeight: 28,
                          borderRadius: 1,
                          bgcolor: kind?.bg || '#f8fafc',
                          color: kind?.color || '#334155',
                          fontSize: 11,
                          fontWeight: kind ? 600 : 400,
                          display: 'grid',
                          placeItems: 'center',
                          cursor: 'pointer',
                          position: 'relative',
                          border: kind?.hasConflictDot
                            ? '2px solid #0f766e'
                            : '1px solid ' + (kind ? 'transparent' : '#f1f5f9'),
                          outline: isSelected ? '2px solid #1677D2' : 'none',
                          outlineOffset: '-1px',
                          transition: 'transform 0.1s, box-shadow 0.1s',
                          '&:hover': {
                            transform: 'scale(1.08)',
                            zIndex: 2,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          },
                        }}
                      >
                        {Number(date.slice(8))}
                        {kind?.hasConflictDot && (
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 2,
                              right: 2,
                              width: 5,
                              height: 5,
                              borderRadius: '50%',
                              bgcolor: '#0f766e',
                            }}
                          />
                        )}
                      </Box>
                    </Tooltip>
                  )
                })}
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
