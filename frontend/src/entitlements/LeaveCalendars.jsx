import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

const PRESENT = new Set(['on time', 'late', 'half day'])

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
  return value >= String(from).slice(0, 10) && value <= String(to).slice(0, 10)
}

function dayKind(date, personLeaves, personAttendance) {
  const approved = personLeaves.find((row) => String(row.status || '').toLowerCase() === 'approved' && inRange(date, row.from_date, row.to_date))
  if (approved) return { bg: '#9f1239', title: `${approved.leave_type || 'Leave'} · approved · marked absent` }
  const pending = personLeaves.find((row) => String(row.status || '').toLowerCase() === 'pending' && inRange(date, row.from_date, row.to_date))
  if (pending) return { bg: '#b45309', title: `${pending.leave_type || 'Leave'} · waiting for approval` }
  const record = personAttendance.find((row) => String(row.date || '').slice(0, 10) === date)
  if (!record) return null
  const status = String(record.attendance_status || '').trim().toLowerCase()
  if (PRESENT.has(status) || record.fingerprint_in || record.fingerprint_out) {
    return { bg: '#0f766e', title: record.attendance_status || 'Present' }
  }
  return { bg: '#475569', title: record.attendance_status || 'Attendance recorded' }
}

export default function LeaveCalendars({ employees, leaves, attendance }) {
  const today = new Date()
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() })

  useEffect(() => {
    const dated = leaves.map((row) => String(row.from_date || '').slice(0, 10)).filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)).sort()
    if (!dated.length) return
    const first = new Date(`${dated[0]}T00:00:00`)
    setCursor({ year: first.getFullYear(), month: first.getMonth() })
  }, [leaves])
  const leading = (new Date(cursor.year, cursor.month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
  const cells = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => iso(new Date(cursor.year, cursor.month, index + 1))),
  ]
  const title = new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const people = useMemo(
    () => [...employees].sort((a, b) => String(a.employee_name || '').localeCompare(String(b.employee_name || ''))),
    [employees],
  )

  function shift(amount) {
    setCursor((current) => {
      const next = new Date(current.year, current.month + amount, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Leave and attendance</Typography>
        <Typography variant="body2" sx={{ color: '#64748b' }}>{people.length} employees</Typography>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <Button size="small" variant="outlined" onClick={() => shift(-1)}>Prev</Button>
          <Typography variant="body2" sx={{ minWidth: 140, textAlign: 'center' }}>{title}</Typography>
          <Button size="small" variant="outlined" onClick={() => shift(1)}>Next</Button>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 1.5, mb: 1, fontSize: 12, color: '#475569', flexWrap: 'wrap' }}>
        <span><Box component="span" sx={{ display: 'inline-block', width: 10, height: 10, bgcolor: '#0f766e', borderRadius: 0.5, mr: 0.5 }} />Present</span>
        <span><Box component="span" sx={{ display: 'inline-block', width: 10, height: 10, bgcolor: '#9f1239', borderRadius: 0.5, mr: 0.5 }} />Approved leave, marked absent</span>
        <span><Box component="span" sx={{ display: 'inline-block', width: 10, height: 10, bgcolor: '#b45309', borderRadius: 0.5, mr: 0.5 }} />Pending leave</span>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 1.5 }}>
        {people.map((person) => {
          const keys = new Set([person.name, person.employee_id].filter(Boolean))
          const personLeaves = leaves.filter((row) => keys.has(row.employee_id))
          const personAttendance = attendance.filter((row) => keys.has(row.employee_id))
          return (
            <Box key={person.name || person.employee_id} sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 2, p: 1.25 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: '#12315c', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>
                  {initials(person.employee_name)}
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{person.employee_name}</Typography>
                  <Typography variant="caption" color="text.secondary">{person.employee_id} · {person.designation || 'Position not recorded'}</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.4 }}>
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((label) => (
                  <Typography key={label} variant="caption" sx={{ textAlign: 'center', color: '#94a3b8' }}>{label}</Typography>
                ))}
                {cells.map((date, index) => {
                  if (!date) return <Box key={`empty-${person.employee_id}-${index}`} />
                  const kind = dayKind(date, personLeaves, personAttendance)
                  return (
                    <Box
                      key={date}
                      title={kind ? `${date}: ${kind.title}` : date}
                      sx={{
                        minHeight: 28,
                        borderRadius: 1,
                        bgcolor: kind?.bg || '#f8fafc',
                        color: kind ? '#fff' : '#334155',
                        fontSize: 11,
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      {Number(date.slice(8))}
                    </Box>
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
