import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Filter,
  Percent,
  Plus,
  RotateCcw,
  Save,
  Search,
  Target,
  TrendingUp,
} from 'lucide-react'
import ListView from '../components/ListView'
import dailyKpiLogDoctype from '../doctypes/dailyKpiLog.doctype'
import { computeDailyKpiFields } from '../data/computeKpi'
import { create, list } from '../data/repository'
import ChartCard from '../ui/ChartCard'
import KpiCard from '../ui/KpiCard'

function mean(rows, key) {
  const values = rows.map((row) => Number(row[key])).filter((value) => Number.isFinite(value))
  if (!values.length) return null
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
}

export default function DailyKpiList({ refreshKey }) {
  const [rows, setRows] = useState([])
  const [employees, setEmployees] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  // Filters from Mockup 2
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [filterOffice, setFilterOffice] = useState('All')
  const [filterEmployee, setFilterEmployee] = useState('All')

  // Quick KPI Record Form (Embedded as in Mockup 2)
  const [formEmployeeId, setFormEmployeeId] = useState('')
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [formTasksCompleted, setFormTasksCompleted] = useState('85')
  const [formTasksAssigned, setFormTasksAssigned] = useState('100')
  const [formCorrect, setFormCorrect] = useState('80')
  const [formOnTime, setFormOnTime] = useState('75')
  const [formRemarks, setFormRemarks] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)

  // Auto-calculated rates based on actual fields
  const calculated = useMemo(() => {
    const assigned = Number(formTasksAssigned) || 0
    const completed = Number(formTasksCompleted) || 0
    const correct = Number(formCorrect) || completed
    const onTime = Number(formOnTime) || completed

    const completion = assigned > 0 ? Math.round((completed / assigned) * 100) : 0
    const accuracy = completed > 0 ? Math.round((correct / completed) * 100) : 0
    const timeliness = completed > 0 ? Math.round((onTime / completed) * 100) : 0
    const overall = Math.round((completion + accuracy + timeliness) / 3)

    return { completion, accuracy, timeliness, overall }
  }, [formTasksAssigned, formTasksCompleted, formCorrect, formOnTime])

  function loadData() {
    let cancelled = false
    setLoading(true)
    Promise.all([list('daily_kpi_log'), list('employee')])
      .then(([logs, people]) => {
        if (!cancelled) {
          setRows(Array.isArray(logs) ? logs : [])
          const empList = Array.isArray(people) ? people : []
          setEmployees(empList)
          if (empList.length > 0 && !formEmployeeId) {
            setFormEmployeeId(empList[0].employee_id || empList[0].name)
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not summarize daily logs')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }

  useEffect(() => {
    return loadData()
  }, [refreshKey])

  // Post Offices options
  const officeOptions = useMemo(() => {
    const set = new Set(employees.map((e) => e.post_office).filter(Boolean))
    return ['All', ...Array.from(set).sort()]
  }, [employees])

  // Selected employee profile
  const selectedEmpObj = useMemo(() => {
    return employees.find((e) => (e.employee_id || e.name) === formEmployeeId) || null
  }, [employees, formEmployeeId])

  async function handleQuickSave(e) {
    e.preventDefault()
    if (!formEmployeeId || !formDate) {
      setError('Please select an employee and date')
      return
    }
    setFormSubmitting(true)
    setFormSuccess('')
    setError('')
    try {
      const doc = {
        employee_id: formEmployeeId,
        date: formDate,
        assigned_work_count: Number(formTasksAssigned) || 100,
        completed_work_count: Number(formTasksCompleted) || 85,
        correct_work_count: Number(formCorrect) || Number(formTasksCompleted) || 85,
        on_time_work_count: Number(formOnTime) || Number(formTasksCompleted) || 85,
        remarks: formRemarks,
        primary_task_type: selectedEmpObj?.designation?.includes('Delivery') ? 'Mail & Parcel Delivery' : 'Postal Clerk Duties',
      }
      const prepared = computeDailyKpiFields(doc)
      prepared.name = `${formEmployeeId}-${formDate}`
      await create('daily_kpi_log', prepared)
      setFormSuccess('KPI record saved successfully.')
      loadData()
      setTimeout(() => setFormSuccess(''), 4000)
    } catch (err) {
      setError(err.message || 'Failed to save KPI record')
    } finally {
      setFormSubmitting(false)
    }
  }

  // Filtered rows for recent KPI table
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (filterEmployee !== 'All' && r.employee_id !== filterEmployee) return false
      return true
    })
  }, [rows, filterEmployee])

  const recent = useMemo(() => {
    return [...filteredRows].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 6)
  }, [filteredRows])

  return (
    <div className="space-y-4">
      {/* ── Top Filter Bar (Mockup 2) ─────────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#DFE8F2] bg-white p-3.5 shadow-xs md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#172B4D]">
            <Filter className="size-3.5 text-[#1677D2]" />
            <span>Filters:</span>
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="filter-kpi-date" className="text-xs text-[#64748B]">Date</label>
            <input
              id="filter-kpi-date"
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="h-8 rounded-lg border border-[#DFE8F2] bg-slate-50 px-2.5 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="filter-kpi-office" className="text-xs text-[#64748B]">Post Office</label>
            <select
              id="filter-kpi-office"
              value={filterOffice}
              onChange={(e) => setFilterOffice(e.target.value)}
              className="h-8 rounded-lg border border-[#DFE8F2] bg-slate-50 px-2.5 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
            >
              {officeOptions.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="filter-kpi-emp" className="text-xs text-[#64748B]">Employee</label>
            <select
              id="filter-kpi-emp"
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="h-8 max-w-[160px] truncate rounded-lg border border-[#DFE8F2] bg-slate-50 px-2.5 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
            >
              <option value="All">All Employees</option>
              {employees.map((e) => (
                <option key={e.employee_id || e.name} value={e.employee_id || e.name}>
                  {e.employee_name || e.employee_id}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/daily-kpi-log/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1677D2] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#1262ab]"
          >
            <Plus className="size-3.5" />
            Add Detailed Form
          </Link>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {formSuccess ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="alert">
          {formSuccess}
        </p>
      ) : null}

      {/* ── 4 Summary Cards (Daily Logs) ─────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Logs"
          value={rows.length}
          note="Historical entries recorded"
          icon={ClipboardList}
          tone="blue"
        />
        <KpiCard
          label="Mean Completion"
          value={mean(rows, 'completion_rate') ? `${mean(rows, 'completion_rate')}%` : '—'}
          note="Assigned task fulfillment"
          icon={Percent}
          tone="up"
        />
        <KpiCard
          label="Mean Accuracy"
          value={mean(rows, 'accuracy_rate') ? `${mean(rows, 'accuracy_rate')}%` : '—'}
          note="Correct processing rate"
          icon={CheckCircle2}
          tone="up"
        />
        <KpiCard
          label="Average KPI"
          value={mean(rows, 'kpi_score') ? `${mean(rows, 'kpi_score')}%` : '—'}
          note="Composite performance score"
          icon={TrendingUp}
          tone="blue"
        />
      </div>

      {/* ── Add / Update KPI Record Form (Mockup 2) ──────────────────────── */}
      <div className="rounded-xl border border-[#DFE8F2] bg-white p-4 shadow-xs">
        <div className="mb-3 flex items-center justify-between border-b border-[#DFE8F2] pb-2.5">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-[#1677D2]">
              <ClipboardCheck className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#172B4D]">Add / Update KPI Record</h2>
              <p className="text-[11px] text-[#64748B]">Enter daily operational performance metrics for postal staff</p>
            </div>
          </div>
          <span className="text-[11px] font-medium text-[#64748B]">
            Automated KPI: <strong className="text-[#1677D2]">{calculated.overall}%</strong>
          </span>
        </div>

        <form onSubmit={handleQuickSave} className="space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Employee ID */}
            <div>
              <label htmlFor="form-emp-id" className="block text-[11px] font-semibold text-[#172B4D] uppercase">
                Employee <span className="text-red-500">*</span>
              </label>
              <select
                id="form-emp-id"
                value={formEmployeeId}
                onChange={(e) => setFormEmployeeId(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-[#DFE8F2] bg-slate-50 px-2.5 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
                required
              >
                {employees.map((e) => (
                  <option key={e.employee_id || e.name} value={e.employee_id || e.name}>
                    {e.employee_name || e.employee_id} ({e.employee_id || e.name})
                  </option>
                ))}
              </select>
            </div>

            {/* Post Office (Auto) */}
            <div>
              <label htmlFor="form-emp-office" className="block text-[11px] font-semibold text-[#64748B] uppercase">
                Post Office
              </label>
              <input
                id="form-emp-office"
                type="text"
                readOnly
                value={selectedEmpObj?.post_office || 'General Post Office'}
                className="mt-1 h-9 w-full rounded-lg border border-[#DFE8F2] bg-slate-100 px-2.5 text-xs text-[#64748B] cursor-not-allowed"
              />
            </div>

            {/* KPI Date */}
            <div>
              <label htmlFor="form-kpi-date" className="block text-[11px] font-semibold text-[#172B4D] uppercase">
                KPI Date <span className="text-red-500">*</span>
              </label>
              <input
                id="form-kpi-date"
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-[#DFE8F2] bg-slate-50 px-2.5 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Metric inputs and live calculated percentages */}
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label htmlFor="form-tasks-completed" className="block text-[11px] font-semibold text-[#172B4D]">
                Tasks Completed (of {formTasksAssigned})
              </label>
              <input
                id="form-tasks-completed"
                type="number"
                min="0"
                value={formTasksCompleted}
                onChange={(e) => setFormTasksCompleted(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-[#DFE8F2] bg-slate-50 px-2.5 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="form-completion-rate" className="block text-[11px] font-semibold text-[#64748B]">
                Completion % (Calculated)
              </label>
              <div id="form-completion-rate" className="mt-1 flex h-9 items-center rounded-lg border border-[#DFE8F2] bg-blue-50/50 px-2.5 text-xs font-bold text-[#1677D2]">
                {calculated.completion}%
              </div>
            </div>

            <div>
              <label htmlFor="form-accuracy-rate" className="block text-[11px] font-semibold text-[#64748B]">
                Accuracy % (Calculated)
              </label>
              <div id="form-accuracy-rate" className="mt-1 flex h-9 items-center rounded-lg border border-[#DFE8F2] bg-emerald-50/50 px-2.5 text-xs font-bold text-emerald-700">
                {calculated.accuracy}%
              </div>
            </div>

            <div>
              <label htmlFor="form-timeliness-rate" className="block text-[11px] font-semibold text-[#64748B]">
                Timeliness % (Calculated)
              </label>
              <div id="form-timeliness-rate" className="mt-1 flex h-9 items-center rounded-lg border border-[#DFE8F2] bg-indigo-50/50 px-2.5 text-xs font-bold text-indigo-700">
                {calculated.timeliness}%
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label htmlFor="form-remarks" className="block text-[11px] font-semibold text-[#172B4D]">
              Remarks
            </label>
            <input
              id="form-remarks"
              type="text"
              placeholder="e.g. Standard parcel delivery run completed within schedule"
              value={formRemarks}
              onChange={(e) => setFormRemarks(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-[#DFE8F2] bg-slate-50 px-2.5 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={formSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1677D2] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1262ab] disabled:opacity-50"
            >
              <Save className="size-3.5" />
              {formSubmitting ? 'Saving…' : 'Save KPI'}
            </button>
            <button
              type="button"
              onClick={() => {
                setFormTasksCompleted('85')
                setFormRemarks('')
                setError('')
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#DFE8F2] bg-white px-3 py-2 text-xs font-medium text-[#64748B] hover:bg-slate-50"
            >
              <RotateCcw className="size-3.5" />
              Clear
            </button>
          </div>
        </form>
      </div>

      {/* ── Recent KPI Records Table (Mockup 2 bottom table) ─────────────── */}
      <ChartCard
        title="KPI Records"
        note="Showing latest daily KPI evaluation rows with composite scores"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#DFE8F2] bg-slate-50 text-[11px] font-semibold text-[#64748B] uppercase">
              <tr>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Employee</th>
                <th className="py-2.5 px-3">Completion</th>
                <th className="py-2.5 px-3">Accuracy</th>
                <th className="py-2.5 px-3">Timeliness</th>
                <th className="py-2.5 px-3">Overall KPI</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DFE8F2]">
              {recent.length > 0 ? (
                recent.map((row) => {
                  const score = Number(row.kpi_score)
                  const isTrack = Number.isFinite(score) && score >= 80
                  return (
                    <tr key={row.name || `${row.employee_id}-${row.date}`} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 text-[#64748B]">{row.date}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-[#172B4D]">{row.employee_name || row.employee_id}</div>
                        <div className="text-[10px] text-[#64748B]">{row.employee_id}</div>
                      </td>
                      <td className="py-2.5 px-3 text-[#172B4D]">{row.completion_rate ? `${row.completion_rate}%` : '—'}</td>
                      <td className="py-2.5 px-3 text-[#172B4D]">{row.accuracy_rate ? `${row.accuracy_rate}%` : '—'}</td>
                      <td className="py-2.5 px-3 text-[#172B4D]">{row.timeliness_rate ? `${row.timeliness_rate}%` : '—'}</td>
                      <td className="py-2.5 px-3 font-bold text-[#1677D2]">{row.kpi_score ? `${row.kpi_score}%` : '—'}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${isTrack ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200'}`}>
                          {isTrack ? 'On Track' : 'Needs Attention'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-xs text-[#64748B]">
                    No KPI records found matching the filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {/* ── Full Paginated History List ──────────────────────────────────── */}
      <ListView
        meta={dailyKpiLogDoctype}
        basePath="/daily-kpi-log"
        refreshKey={refreshKey}
      />
    </div>
  )
}

