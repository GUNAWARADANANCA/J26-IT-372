import { useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Drawer from '@mui/material/Drawer'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { approveAllocation, confirmOvertime, getAllocation, list } from '../data/repository'

function iso(day) {
  const month = String(day.getMonth() + 1).padStart(2, '0')
  const date = String(day.getDate()).padStart(2, '0')
  return `${day.getFullYear()}-${month}-${date}`
}

function mondayOf(value) {
  const day = new Date(`${value}T00:00:00`)
  const weekday = day.getDay()
  const shift = weekday === 0 ? -6 : 1 - weekday
  day.setDate(day.getDate() + shift)
  return day
}

function addDays(day, count) {
  const next = new Date(day.getTime())
  next.setDate(next.getDate() + count)
  return next
}

function shortDay(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
}

function dayNumber(value) {
  return new Date(`${value}T00:00:00`).getDate()
}

function monthTitle(start) {
  return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function rangeLabel(days) {
  const first = new Date(`${days[0]}T00:00:00`)
  const last = new Date(`${days[6]}T00:00:00`)
  const left = first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const right = last.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${left} – ${right}`
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?'
}

function tone(category, designation) {
  const text = `${category} ${designation}`.toLowerCase()
  if (text.includes('deliver') || text.includes('postman')) return { bg: '#0f766e', fg: '#ffffff' }
  if (text.includes('supervis')) return { bg: '#15803d', fg: '#ffffff' }
  if (text.includes('office') || text.includes('counter') || text.includes('assistant')) return { bg: '#4338ca', fg: '#ffffff' }
  return { bg: '#ca8a04', fg: '#1c1917' }
}

export default function WorkAllocationPage() {
  const [monday, setMonday] = useState(() => mondayOf('2025-01-27'))
  const [selected, setSelected] = useState('2025-01-27')
  const [plans, setPlans] = useState([])
  const [employees, setEmployees] = useState([])
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [overtimeOpen, setOvertimeOpen] = useState(false)
  const [showAbsent, setShowAbsent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState('')

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => iso(addDays(monday, index))), [monday])

  async function load(start = monday) {
    const week = Array.from({ length: 7 }, (_, index) => iso(addDays(start, index)))
    setLoading(true)
    setError('')
    setSaved('')
    try {
      setPlans(await Promise.all(week.map((day) => getAllocation(day, []))))
    } catch (err) {
      setPlans([])
      setError(err.message || 'Could not load the allocation')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    list('employee')
      .then((rows) => {
        if (!cancelled) setEmployees(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setEmployees([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    load(monday)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monday])

  const board = useMemo(() => {
    const people = new Map()
    plans.forEach((plan) => {
      ;(plan.present || []).forEach((person) => {
        if (!people.has(person.employee_id)) {
          people.set(person.employee_id, {
            employee_id: person.employee_id,
            employee_name: person.employee_name,
            designation: person.designation,
            work_category: person.work_category,
            days: {},
          })
        }
      })
    })
    plans.forEach((plan) => {
      const day = plan.date
      ;(plan.present || []).forEach((person) => {
        const row = people.get(person.employee_id)
        if (!row) return
        row.days[day] = {
          present: true,
          chips: [{
            title: person.designation || 'On duty',
            detail: person.work_category || 'Present',
            tone: tone(person.work_category, person.designation),
          }],
        }
      })
      ;(plan.moves || []).forEach((move) => {
        const row = people.get(move.to_employee_id)
        if (!row || !row.days[day]) return
        row.days[day].chips.push({
          title: `${move.count} ${move.task || 'items'}`,
          detail: 'Assigned from attendance',
          tone: { bg: '#0369a1', fg: '#ffffff' },
          reason: move.reason,
        })
      })
    })
    const query = search.trim().toLowerCase()
    return [...people.values()]
      .filter((row) => !query || `${row.employee_name} ${row.employee_id} ${row.designation}`.toLowerCase().includes(query))
      .filter((row) => !role || row.designation === role)
      .sort((a, b) => a.employee_name.localeCompare(b.employee_name))
  }, [plans, search, role])

  const selectedPlan = plans.find((plan) => plan.date === selected) || null
  const roles = useMemo(() => {
    const values = new Set()
    plans.forEach((plan) => (plan.present || []).forEach((person) => {
      if (person.designation) values.add(person.designation)
    }))
    return [...values].sort()
  }, [plans])
  const sources = useMemo(() => {
    if (!selectedPlan) return []
    const present = new Set((selectedPlan.present || []).map((person) => person.employee_id))
    const groups = new Map()
    ;(selectedPlan.moves || []).forEach((move) => {
      const current = groups.get(move.from_employee_id) || {
        id: move.from_employee_id,
        name: move.from_employee_name,
        present: present.has(move.from_employee_id),
        moves: [],
      }
      current.moves.push(move)
      groups.set(move.from_employee_id, current)
    })
    return [...groups.values()]
  }, [selectedPlan])
  const focus = sources.find((item) => item.id === sourceId) || null
  const unmet = selectedPlan?.unmet || []
  const cards = [
    ['Present', selectedPlan?.present?.length || 0],
    ['Tasks offered', selectedPlan?.moves?.length || 0],
    ['Needs a matching role', unmet.length],
    ['Capacity notes', selectedPlan?.overtime?.length || 0],
  ]

  const absentOnSelected = useMemo(() => {
    const present = new Set((selectedPlan?.present || []).map((person) => person.employee_id))
    return employees
      .filter((person) => person.employee_id && !present.has(person.employee_id))
      .sort((a, b) => String(a.employee_name || '').localeCompare(String(b.employee_name || '')))
  }, [employees, selectedPlan])

  function downloadAbsenceReport() {
    const header = ['Employee name', 'Employee ID', 'Current role', 'Branch', 'Date', 'Record']
    const lines = [header.join(',')]
    absentOnSelected.forEach((person) => {
      const cells = [
        person.employee_name || '',
        person.employee_id || '',
        person.designation || '',
        person.post_office || '',
        selected,
        'Not recorded as present',
      ].map((value) => `"${String(value).replaceAll('"', '""')}"`)
      lines.push(cells.join(','))
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `not-recorded-present-${selected}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  async function confirmOt() {
    setLoading(true)
    setError('')
    try {
      const result = await confirmOvertime(selected, [])
      setSaved(`Overtime confirmed for ${selected}. Roles were not changed.`)
      setPlans((current) => current.map((plan) => (plan.date === selected ? result.plan : plan)))
    } catch (err) {
      setError(err.message || 'Could not confirm overtime')
    } finally {
      setLoading(false)
    }
  }

  async function approve() {
    setLoading(true)
    setError('')
    try {
      const result = await approveAllocation(selected, [])
      setSaved(`Allocation for ${selected} was saved. Existing roles were not changed.`)
      setPlans((current) => current.map((plan) => (plan.date === selected ? result.plan : plan)))
    } catch (err) {
      setError(err.message || 'Could not approve the allocation')
    } finally {
      setLoading(false)
    }
  }

  const allocationRows = useMemo(() => {
    return (selectedPlan?.present || []).slice(0, 5).map((person, idx) => {
      const load = idx === 0 ? 110 : idx === 1 ? 85 : idx === 2 ? 105 : idx === 3 ? 65 : 75
      const status = load > 100 ? 'Overloaded' : load < 70 ? 'Underutilized' : 'Balanced'
      const statusClass = load > 100 ? 'text-rose-700 bg-rose-50 border-rose-200' : load < 70 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'
      const action = load > 100 ? 'Rebalance' : load < 70 ? 'Assign Tasks' : 'Keep'
      return {
        name: person.employee_name || 'Staff Member',
        id: person.employee_id,
        role: person.designation || 'Postal Clerk',
        load: `${load}%`,
        target: '100%',
        avail: 'Available',
        status,
        statusClass,
        action,
      }
    })
  }, [selectedPlan])

  return (
    <div className="space-y-4">
      {/* ── Top Filter Bar (Mockup 8) ─────────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#DFE8F2] bg-white p-3.5 shadow-xs md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#172B4D]">
            <span className="text-[#64748B]">Post Office:</span>
            <select
              className="h-8 rounded-lg border border-[#DFE8F2] bg-slate-50 px-2.5 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
              defaultValue="Kaduwela"
            >
              <option value="Kaduwela">Kaduwela Post Office</option>
              <option value="Colombo">Colombo Central Mail Ex.</option>
              <option value="Gampaha">Gampaha Post Office</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#172B4D]">
            <span className="text-[#64748B]">Designation:</span>
            <select
              className="h-8 rounded-lg border border-[#DFE8F2] bg-slate-50 px-2.5 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="">All Designations</option>
              {roles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#172B4D]">
            <span className="text-[#64748B]">Week:</span>
            <input
              type="date"
              className="h-8 rounded-lg border border-[#DFE8F2] bg-slate-50 px-2 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-[#1677D2] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#1262ab]"
            onClick={() => load(monday)}
          >
            View
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {saved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="alert">
          {saved}
        </p>
      ) : null}

      {/* ── 4 Workload Summary KPI Cards (Mockup 8) ───────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Employees"
          value={employees.length || 16}
          note="Allocated on duty"
          tone="blue"
        />
        <KpiCard
          label="Overloaded"
          value={2}
          note="Load exceeding 100%"
          tone="down"
        />
        <KpiCard
          label="Underutilized"
          value={3}
          note="Available spare capacity"
          tone="warning"
        />
        <KpiCard
          label="Balanced"
          value={11}
          note="Within standard optimal range"
          tone="up"
        />
      </div>

      {/* ── Mid Row: Allocation Table with Load & Action (Mockup 8) ───────── */}
      <div className="rounded-xl border border-[#DFE8F2] bg-white p-4 shadow-xs">
        <div className="mb-3 flex items-center justify-between border-b border-[#DFE8F2] pb-2.5">
          <h2 className="text-sm font-bold text-[#172B4D]">Staff Allocation & Workload Plan</h2>
          <span className="text-[11px] text-[#64748B]">Showing monitored shift assignments for {selected}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#DFE8F2] bg-slate-50 text-[10px] font-semibold text-[#64748B] uppercase">
              <tr>
                <th className="py-2.5 px-3">Name</th>
                <th className="py-2.5 px-3">Designation</th>
                <th className="py-2.5 px-3">Current Load</th>
                <th className="py-2.5 px-3">Target</th>
                <th className="py-2.5 px-3">Availability</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Suggested Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DFE8F2]">
              {allocationRows.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-[#172B4D]">{row.name}</div>
                    <div className="text-[10px] text-[#64748B]">{row.id}</div>
                  </td>
                  <td className="py-2.5 px-3 text-[#64748B]">{row.role}</td>
                  <td className="py-2.5 px-3 font-bold text-[#172B4D]">{row.load}</td>
                  <td className="py-2.5 px-3 text-[#64748B]">{row.target}</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-medium">{row.avail}</td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${row.statusClass}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSaved(`Applied recommendation for ${row.name}: ${row.action}`)}
                      className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-[#1677D2] hover:bg-blue-100"
                    >
                      {row.action}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Bottom Row: Workload Distribution Donut + Recommendations ─────── */}
      <div className="grid gap-4 md:grid-cols-12">
        {/* Workload Distribution Donut (5 cols) */}
        <ChartCard
          title="Workload Distribution"
          note="Proportion of staff by operational capacity tier"
          className="md:col-span-5"
        >
          <Donut
            ariaLabel="Workload Distribution Donut"
            centerLabel="Staff"
            centerValue={16}
            slices={[
              { name: 'Balanced', value: 11, color: '#16A34A' },
              { name: 'Overloaded', value: 2, color: '#E53935' },
              { name: 'Underutilized', value: 3, color: '#F59E0B' },
            ]}
          />
        </ChartCard>

          {/* Rebalance Recommendations Card (7 cols) */}
        <div className="flex flex-col justify-between rounded-xl border border-[#DFE8F2] bg-white p-4 shadow-xs md:col-span-7">
          <div>
            <h3 className="text-sm font-bold text-[#172B4D]">Workload Rebalance Recommendations</h3>
            <p className="mt-0.5 text-xs text-[#64748B]">Operational optimization suggestions to balance branch volume</p>

            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-start gap-2 rounded-lg border border-rose-100 bg-rose-50/60 p-2.5 text-rose-900">
                <span className="font-bold">•</span>
                <span>Redistribute route parcel overflow for <strong>2 overloaded employees</strong> on Colombo central delivery route.</span>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50/60 p-2.5 text-amber-900">
                <span className="font-bold">•</span>
                <span>Assign additional counter sorting tasks to <strong>3 underutilized staff</strong> during peak afternoon hours.</span>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 p-2.5 text-emerald-900">
                <span className="font-bold">•</span>
                <span>Respect approved leave and verified roster availability across all shift allocations.</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-[#DFE8F2] pt-3">
            <button
              type="button"
              onClick={approve}
              className="rounded-lg bg-[#1677D2] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1262ab]"
            >
              Update Allocation Plan
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

