import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  ArrowRight,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Info,
  Layers,
  LineChart as LineChartIcon,
  RefreshCw,
  TrendingUp,
  UserCheck,
  Users,
  UsersRound,
} from 'lucide-react'
import { useAuth } from '../data/auth'
import { list } from '../data/repository'
import ChartCard from '../ui/ChartCard'
import { Donut } from '../ui/charts'
import KpiCard from '../ui/KpiCard'

function todayIso() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function EmployeeOverviewPanel({ refreshKey = 0 }) {
  const { user } = useAuth()
  const isPostmaster = user?.role === 'postmaster'

  // ── Core State ──────────────────────────────────────────────────────────
  const [employees, setEmployees] = useState([])
  const [allLogs, setAllLogs] = useState([])
  const [allocations, setAllocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [reloading, setReloading] = useState(false)
  const [error, setError] = useState('')
  const [localRefreshKey, setLocalRefreshKey] = useState(0)

  // ── Filter State ────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState('2026-10-28')
  const [dateScope, setDateScope] = useState('date') // 'date' (Selected Date) or 'all' (Cumulative / All Dates)
  const [selectedOffice, setSelectedOffice] = useState('All')
  const [selectedDesignation, setSelectedDesignation] = useState('All')
  const [selectedEmployee, setSelectedEmployee] = useState('All')
  const [activityMode, setActivityMode] = useState('selected') // 'selected' or 'latest'

  // ── Load Real MongoDB Data ──────────────────────────────────────────────
  const loadDashboardData = useCallback(async (isFresh = false) => {
    if (isFresh) setReloading(true)
    else setLoading(true)
    setError('')
    try {
      const [empList, logList, allocList] = await Promise.all([
        list('employee', { fresh: isFresh }),
        list('daily_kpi_log', { fresh: isFresh }),
        list('work_allocation', { fresh: isFresh }).catch(() => []),
      ])
      const validEmps = Array.isArray(empList) ? empList : []
      const validLogs = Array.isArray(logList) ? logList : []
      setEmployees(validEmps)
      setAllLogs(validLogs)
      setAllocations(Array.isArray(allocList) ? allocList : [])

      // If logs have dates and selectedDate has no logs, pick the latest date present
      if (validLogs.length > 0) {
        const dates = validLogs
          .map((l) => String(l.date || '').slice(0, 10))
          .filter(Boolean)
          .sort()
        if (dates.length > 0 && !dates.includes(selectedDate)) {
          setSelectedDate(dates[dates.length - 1])
        }
      }
    } catch (err) {
      setError(err.message || 'Could not load employee overview records.')
    } finally {
      setLoading(false)
      setReloading(false)
    }
  }, [selectedDate])

  // Initial load and auto-refresh on prop / local mutation
  useEffect(() => {
    loadDashboardData(true)
  }, [refreshKey, localRefreshKey, loadDashboardData])

  // ── Filter Options ──────────────────────────────────────────────────────
  const officeOptions = useMemo(() => {
    const s = new Set(employees.map((e) => e.post_office).filter(Boolean))
    return ['All', ...Array.from(s).sort()]
  }, [employees])

  const designationOptions = useMemo(() => {
    const s = new Set(employees.map((e) => e.designation).filter(Boolean))
    return ['All', ...Array.from(s).sort()]
  }, [employees])

  const employeeOptions = useMemo(() => {
    return employees.filter((e) => {
      if (selectedOffice !== 'All' && e.post_office !== selectedOffice) return false
      if (selectedDesignation !== 'All' && e.designation !== selectedDesignation) return false
      return true
    })
  }, [employees, selectedOffice, selectedDesignation])

  // Auto-reset selectedEmployee if not in current office/designation scope
  useEffect(() => {
    if (
      selectedEmployee !== 'All' &&
      !employeeOptions.some((e) => String(e.employee_id || e._id || e.name) === selectedEmployee)
    ) {
      setSelectedEmployee('All')
    }
  }, [employeeOptions, selectedEmployee])

  // ── Unified Filtered Employees ──────────────────────────────────────────
  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (selectedOffice !== 'All' && e.post_office !== selectedOffice) return false
      if (selectedDesignation !== 'All' && e.designation !== selectedDesignation) return false
      const eid = String(e.employee_id || e._id || e.name || '')
      if (selectedEmployee !== 'All' && eid !== selectedEmployee) return false
      return true
    })
  }, [employees, selectedOffice, selectedDesignation, selectedEmployee])

  const allowedEmployeeIds = useMemo(() => {
    return new Set(filteredEmployees.map((e) => String(e.employee_id || e._id || e.name || '')))
  }, [filteredEmployees])

  // ── Scoped Daily KPI Logs ───────────────────────────────────────────────
  const logsOnSelectedDate = useMemo(() => {
    return allLogs.filter((l) => {
      const eid = String(l.employee_id || '')
      if (!allowedEmployeeIds.has(eid)) return false
      const d = String(l.date || '').slice(0, 10)
      return d === selectedDate
    })
  }, [allLogs, allowedEmployeeIds, selectedDate])

  const logsInScope = useMemo(() => {
    if (dateScope === 'date') return logsOnSelectedDate
    return allLogs.filter((l) => allowedEmployeeIds.has(String(l.employee_id || '')))
  }, [dateScope, logsOnSelectedDate, allLogs, allowedEmployeeIds])

  // ── Per-Employee Evaluated KPI Status & Workload ─────────────────────────
  const employeeKpiStatus = useMemo(() => {
    const logsByEmp = new Map()
    for (const l of logsInScope) {
      const eid = String(l.employee_id || '')
      if (!logsByEmp.has(eid)) logsByEmp.set(eid, [])
      logsByEmp.get(eid).push(l)
    }

    return filteredEmployees.map((emp) => {
      const eid = String(emp.employee_id || emp._id || emp.name || '')
      const empLogs = logsByEmp.get(eid) || []
      const hasLog = empLogs.length > 0

      // Only valid evaluated numbers are treated as KPI scores
      const validScores = empLogs
        .map((l) => (l.kpi_score !== null && l.kpi_score !== undefined && !Number.isNaN(Number(l.kpi_score)) ? Number(l.kpi_score) : null))
        .filter((s) => s !== null)

      const assigned = empLogs.reduce((s, l) => s + (Number(l.assigned_work_count) || 0), 0)
      const completed = empLogs.reduce((s, l) => s + (Number(l.completed_work_count) || 0), 0)
      const pending = empLogs.reduce(
        (s, l) =>
          s +
          (Number(l.uncompleted_work_count) ||
            Math.max(0, (Number(l.assigned_work_count) || 0) - (Number(l.completed_work_count) || 0))),
        0,
      )

      let score = null
      let isEvaluated = false

      if (validScores.length > 0) {
        score = Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 10) / 10
        isEvaluated = true
      }

      return {
        employee: emp,
        employee_id: eid,
        employee_name: emp.employee_name || eid,
        designation: emp.designation || 'Staff',
        post_office: emp.post_office || '',
        work_category: emp.work_category || '',
        has_log: hasLog,
        assigned_tasks: assigned,
        completed_tasks: completed,
        pending_tasks: pending,
        score,
        is_evaluated: isEvaluated,
        is_on_track: isEvaluated && score >= 80,
        is_need_support: isEvaluated && score < 80,
      }
    })
  }, [filteredEmployees, logsInScope])

  // ── Aggregated Dashboard Metrics ────────────────────────────────────────
  const totalEmployees = filteredEmployees.length
  const evaluatedStaff = useMemo(() => employeeKpiStatus.filter((e) => e.is_evaluated), [employeeKpiStatus])
  const unevaluatedStaff = useMemo(() => employeeKpiStatus.filter((e) => !e.is_evaluated), [employeeKpiStatus])
  const onTrackStaff = useMemo(() => evaluatedStaff.filter((e) => e.is_on_track), [evaluatedStaff])
  const needSupportStaff = useMemo(() => evaluatedStaff.filter((e) => e.is_need_support), [evaluatedStaff])

  const evaluatedCount = evaluatedStaff.length
  const unevaluatedCount = unevaluatedStaff.length
  const onTrackCount = onTrackStaff.length
  const needSupportCount = needSupportStaff.length

  const avgKpi = useMemo(() => {
    if (evaluatedCount === 0) return null
    const sum = evaluatedStaff.reduce((s, e) => s + e.score, 0)
    return Math.round((sum / evaluatedCount) * 10) / 10
  }, [evaluatedStaff, evaluatedCount])

  // Performance Tiers (calculated only across evaluated staff)
  const performanceTiers = useMemo(() => {
    const counts = { excellent: 0, good: 0, needsImprovement: 0, poor: 0 }
    for (const e of evaluatedStaff) {
      if (e.score >= 90) counts.excellent += 1
      else if (e.score >= 80) counts.good += 1
      else if (e.score >= 70) counts.needsImprovement += 1
      else counts.poor += 1
    }
    return counts
  }, [evaluatedStaff])

  const donutSlices = useMemo(() => {
    return [
      { name: `Excellent (90%+) · ${performanceTiers.excellent}`, value: performanceTiers.excellent, color: '#16A34A' },
      { name: `Good (80-89%) · ${performanceTiers.good}`, value: performanceTiers.good, color: '#1677D2' },
      { name: `Needs Imprv (70-79%) · ${performanceTiers.needsImprovement}`, value: performanceTiers.needsImprovement, color: '#F59E0B' },
      { name: `Poor (<70%) · ${performanceTiers.poor}`, value: performanceTiers.poor, color: '#E53935' },
    ].filter((s) => s.value > 0)
  }, [performanceTiers])

  const staffWithTasksCount = useMemo(() => {
    return employeeKpiStatus.filter((e) => e.assigned_tasks > 0).length
  }, [employeeKpiStatus])

  const totalAssignedTasks = useMemo(() => {
    return employeeKpiStatus.reduce((sum, e) => sum + e.assigned_tasks, 0)
  }, [employeeKpiStatus])

  // ── Recent KPI Activity Table Rows ──────────────────────────────────────
  const displayLogs = useMemo(() => {
    const sourceLogs =
      activityMode === 'selected'
        ? logsOnSelectedDate
        : allLogs.filter((l) => allowedEmployeeIds.has(String(l.employee_id || '')))

    const empMap = new Map(employees.map((e) => [String(e.employee_id || e._id || e.name), e]))

    return [...sourceLogs]
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b._id || '').localeCompare(String(a._id || '')))
      .slice(0, 10)
      .map((log) => {
        const eid = String(log.employee_id || '')
        const emp = empMap.get(eid)
        const name = emp?.employee_name || log.employee_name || eid
        const rawScore =
          log.kpi_score !== null && log.kpi_score !== undefined && !Number.isNaN(Number(log.kpi_score))
            ? Number(log.kpi_score)
            : null
        const assigned = Number(log.assigned_work_count) || 0
        const completed = Number(log.completed_work_count) || 0
        const pending = Number(log.uncompleted_work_count) || Math.max(0, assigned - completed)

        let kpiText = '—'
        let statusText = 'Pending Evaluation'
        let statusColor = 'text-blue-700 bg-blue-50 border-blue-200'

        if (rawScore !== null) {
          kpiText = `${rawScore.toFixed(1)}%`
          if (rawScore >= 80) {
            statusText = 'On Track'
            statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200'
          } else {
            statusText = 'Needs Support'
            statusColor = 'text-amber-700 bg-amber-50 border-amber-200'
          }
        } else if (completed > 0) {
          kpiText = `${completed}/${assigned} Done`
          statusText = 'Tasks Cleared'
          statusColor = 'text-teal-700 bg-teal-50 border-teal-200'
        } else if (assigned > 0) {
          kpiText = `${assigned} Allocated`
          statusText = 'Shift in Progress'
          statusColor = 'text-slate-700 bg-slate-100 border-slate-200'
        }

        return {
          id: log._id || `${eid}-${log.date}`,
          date: String(log.date || '').slice(0, 10),
          employee_id: eid,
          name,
          designation: emp?.designation || log.designation || 'Staff',
          task_type:
            log.primary_task_type ||
            (emp?.work_category === 'Delivery' ? 'Mail & Parcel Delivery' : 'Postal Operations'),
          route_id: log.route_id || '',
          assigned,
          completed,
          pending,
          kpiText,
          statusText,
          statusColor,
          has_score: rawScore !== null,
        }
      })
  }, [activityMode, logsOnSelectedDate, allLogs, allowedEmployeeIds, employees])

  return (
    <section className="mb-6 space-y-4">
      {/* ── Sub-header / Interactive Filter Bar ────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#DFE8F2] bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DFE8F2] pb-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-[#1677D2]">
              <Users className="size-4" />
            </span>
            <div>
              <h1 className="text-sm font-bold text-[#0B1F3A]">Employee Overview Dashboard</h1>
              <p className="text-[11px] text-[#64748B]">
                Real-time workforce performance, verified KPI scores, and shift workload monitoring
              </p>
            </div>
          </div>

          {/* Quick Refresh & Reporting Scope Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle: Selected Date vs All Dates */}
            <div className="inline-flex rounded-lg border border-[#DFE8F2] bg-slate-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setDateScope('date')}
                className={`rounded-md px-2.5 py-1 font-semibold transition ${
                  dateScope === 'date'
                    ? 'bg-white text-[#1677D2] shadow-2xs'
                    : 'text-[#64748B] hover:text-[#0B1F3A]'
                }`}
              >
                Date View
              </button>
              <button
                type="button"
                onClick={() => setDateScope('all')}
                className={`rounded-md px-2.5 py-1 font-semibold transition ${
                  dateScope === 'all'
                    ? 'bg-white text-[#1677D2] shadow-2xs'
                    : 'text-[#64748B] hover:text-[#0B1F3A]'
                }`}
              >
                All-Time Cumulative
              </button>
            </div>

            {/* Comprehensive KPI Dashboard Link */}
            <Link
              to="/kpi-dashboard"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#1677D2] bg-blue-50 px-3 text-xs font-semibold text-[#1677D2] hover:bg-blue-100"
              title="Open full KPI Dashboard with historical trends and workload"
            >
              <BarChart3 className="size-3.5" />
              <span>KPI Dashboard</span>
            </Link>

            {/* Refresh Action */}
            <button
              type="button"
              disabled={loading || reloading}
              onClick={() => {
                setLocalRefreshKey((k) => k + 1)
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#DFE8F2] bg-white px-3 text-xs font-semibold text-[#172B4D] hover:bg-slate-50 disabled:opacity-50"
              title="Refresh latest MongoDB data"
            >
              <RefreshCw className={`size-3.5 text-[#1677D2] ${reloading ? 'animate-spin' : ''}`} />
              <span>{reloading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Filters Controls Row */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-[#172B4D]">
            <Filter className="size-3.5 text-[#1677D2]" />
            <span>Filters:</span>
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="filter-date" className="text-xs font-medium text-[#64748B]">
              Reporting Date:
            </label>
            <input
              id="filter-date"
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value)
                setDateScope('date')
              }}
              className="h-8 rounded-lg border border-[#DFE8F2] bg-slate-50 px-2.5 text-xs font-semibold text-[#0B1F3A] focus:border-[#1677D2] focus:outline-none"
            />
          </div>

          {/* Post Office Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="filter-office" className="text-xs font-medium text-[#64748B]">
              Post Office:
            </label>
            <select
              id="filter-office"
              value={selectedOffice}
              onChange={(e) => setSelectedOffice(e.target.value)}
              className="h-8 rounded-lg border border-[#DFE8F2] bg-slate-50 px-2.5 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
            >
              {officeOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          {/* Designation Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="filter-desig" className="text-xs font-medium text-[#64748B]">
              Designation:
            </label>
            <select
              id="filter-desig"
              value={selectedDesignation}
              onChange={(e) => setSelectedDesignation(e.target.value)}
              className="h-8 rounded-lg border border-[#DFE8F2] bg-slate-50 px-2.5 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
            >
              {designationOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Employee Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="filter-emp" className="text-xs font-medium text-[#64748B]">
              Employee:
            </label>
            <select
              id="filter-emp"
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="h-8 max-w-[190px] truncate rounded-lg border border-[#DFE8F2] bg-slate-50 px-2.5 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
            >
              <option value="All">All Employees ({employeeOptions.length})</option>
              {employeeOptions.map((e) => {
                const eid = e.employee_id || e._id || e.name
                return (
                  <option key={eid} value={eid}>
                    {eid} — {e.employee_name || eid}
                  </option>
                )
              })}
            </select>
          </div>

          {/* Reset Filters Shortcut */}
          {(selectedOffice !== 'All' || selectedDesignation !== 'All' || selectedEmployee !== 'All') && (
            <button
              type="button"
              onClick={() => {
                setSelectedOffice('All')
                setSelectedDesignation('All')
                setSelectedEmployee('All')
              }}
              className="text-xs font-semibold text-[#1677D2] hover:underline"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {/* ── 4 Top Summary KPI Cards ────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Employees */}
        <KpiCard
          label="Total Employees"
          value={totalEmployees}
          note={
            totalEmployees === 0
              ? 'No staff match filters'
              : selectedOffice !== 'All'
              ? `${totalEmployees} active staff at ${selectedOffice}`
              : `${totalEmployees} active registered staff`
          }
          icon={Users}
          tone="blue"
        />

        {/* Average Overall KPI */}
        <KpiCard
          label="Avg. Overall KPI"
          value={avgKpi !== null ? `${avgKpi}%` : '—'}
          note={
            evaluatedCount > 0
              ? `${evaluatedCount} of ${totalEmployees} evaluated records`
              : totalEmployees > 0
              ? '0 evaluated records (awaiting clearance)'
              : 'No staff in scope'
          }
          icon={TrendingUp}
          tone={avgKpi !== null && avgKpi >= 80 ? 'up' : 'neutral'}
        />

        {/* On Track */}
        <KpiCard
          label="On Track"
          value={onTrackCount}
          note={
            evaluatedCount > 0
              ? `${onTrackCount} of ${evaluatedCount} meeting target (≥80%)`
              : 'No evaluated records yet'
          }
          icon={CheckCircle2}
          tone={onTrackCount > 0 ? 'up' : 'neutral'}
        />

        {/* Need Support */}
        <KpiCard
          label="Need Support"
          value={needSupportCount}
          note={
            needSupportCount > 0
              ? `${needSupportCount} below target (<80%)`
              : unevaluatedCount > 0
              ? `${unevaluatedCount} unevaluated staff`
              : 'All evaluated on track'
          }
          icon={AlertTriangle}
          tone={needSupportCount > 0 ? 'warning' : 'neutral'}
        />
      </div>

      {/* ── Mid Row: Donut Chart & Recent KPI Activity Table ─────────────────── */}
      <div className="grid gap-4 xl:grid-cols-12">
        {/* Performance Distribution Donut (5 cols) */}
        <ChartCard
          title="Employee Performance Distribution"
          note={
            evaluatedCount > 0
              ? `Performance breakdown across ${evaluatedCount} evaluated staff (${dateScope === 'date' ? selectedDate : 'Cumulative'})`
              : `Distribution across official postal scoring tiers (${selectedDate})`
          }
          className="xl:col-span-5"
        >
          {evaluatedCount > 0 ? (
            <div className="space-y-3">
              <Donut
                ariaLabel="Employee Performance Distribution"
                centerLabel="Evaluated"
                centerValue={evaluatedCount}
                slices={donutSlices}
              />
              <div className="grid grid-cols-2 gap-2 border-t border-[#DFE8F2] pt-2 text-xs">
                <div className="flex items-center gap-1.5 text-[11px] text-[#16A34A]">
                  <span className="size-2 rounded-full bg-[#16A34A]" />
                  <span>
                    Excellent: <strong>{performanceTiers.excellent}</strong> ({Math.round((performanceTiers.excellent / evaluatedCount) * 100)}%)
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#1677D2]">
                  <span className="size-2 rounded-full bg-[#1677D2]" />
                  <span>
                    Good: <strong>{performanceTiers.good}</strong> ({Math.round((performanceTiers.good / evaluatedCount) * 100)}%)
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#F59E0B]">
                  <span className="size-2 rounded-full bg-[#F59E0B]" />
                  <span>
                    Needs Imprv: <strong>{performanceTiers.needsImprovement}</strong> ({Math.round((performanceTiers.needsImprovement / evaluatedCount) * 100)}%)
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#E53935]">
                  <span className="size-2 rounded-full bg-[#E53935]" />
                  <span>
                    Poor: <strong>{performanceTiers.poor}</strong> ({Math.round((performanceTiers.poor / evaluatedCount) * 100)}%)
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#DFE8F2] bg-[#F8FAFC] p-6 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-blue-50 text-[#1677D2]">
                <Clock className="size-5" />
              </span>
              <h4 className="mt-2 text-xs font-bold text-[#0B1F3A]">
                No Evaluated KPI Scores for {selectedDate}
              </h4>
              <p className="mt-1 max-w-xs text-[11px] text-[#64748B]">
                {totalEmployees > 0
                  ? `All ${totalEmployees} staff in scope currently have shift assignments in progress or have not yet completed day-end KPI review.`
                  : 'No active staff match the selected filters.'}
              </p>
              {staffWithTasksCount > 0 && (
                <div className="mt-2.5 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-[11px] font-semibold text-[#1677D2]">
                  {staffWithTasksCount} staff with active allocations ({totalAssignedTasks} total task batches)
                </div>
              )}
              <div className="mt-3 flex items-center gap-2">
                <Link
                  to="/work-allocation"
                  className="rounded-lg bg-[#1677D2] px-3 py-1.5 text-[11px] font-bold text-white shadow-xs hover:bg-[#125ea7]"
                >
                  Manage Work Allocation
                </Link>
                {allLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDateScope('all')}
                    className="rounded-lg border border-[#DFE8F2] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#475569] hover:bg-slate-50"
                  >
                    View Cumulative History
                  </button>
                )}
              </div>
            </div>
          )}
        </ChartCard>

        {/* Recent KPI Activity Table (7 cols) */}
        <ChartCard
          title={
            activityMode === 'selected'
              ? `KPI Activity & Shift Clearance (${selectedDate})`
              : 'Recent KPI Activity (Latest Historical Records)'
          }
          note="Live operational performance logs, assigned workload batches, and evaluation status"
          className="xl:col-span-7"
        >
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-[11px] text-[#64748B]">
              Showing {displayLogs.length} record(s)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActivityMode('selected')}
                className={`rounded px-2 py-0.5 text-[11px] font-semibold transition ${
                  activityMode === 'selected'
                    ? 'bg-blue-50 text-[#1677D2] font-bold'
                    : 'text-[#64748B] hover:text-[#0B1F3A]'
                }`}
              >
                Date ({selectedDate})
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => setActivityMode('latest')}
                className={`rounded px-2 py-0.5 text-[11px] font-semibold transition ${
                  activityMode === 'latest'
                    ? 'bg-blue-50 text-[#1677D2] font-bold'
                    : 'text-[#64748B] hover:text-[#0B1F3A]'
                }`}
              >
                Latest All Dates
              </button>
            </div>
          </div>

          <div className="max-h-72 overflow-x-auto rounded-xl border border-[#DFE8F2]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#DFE8F2] bg-slate-50 text-[10px] font-bold text-[#64748B] uppercase sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Officer</th>
                  <th className="py-2.5 px-3">Assigned Duty / Route</th>
                  <th className="py-2.5 px-3 text-center">Workload (Done / Assigned)</th>
                  <th className="py-2.5 px-3 text-center">KPI Score</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFE8F2]">
                {displayLogs.length > 0 ? (
                  displayLogs.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 font-mono text-[11px] text-[#64748B] whitespace-nowrap">
                        {row.date}
                      </td>
                      <td className="py-2 px-3 font-medium text-[#172B4D]">
                        <div>{row.name}</div>
                        <span className="font-mono text-[10px] text-[#64748B]">{row.employee_id}</span>
                      </td>
                      <td className="py-2 px-3 text-[#475569]">
                        <div>{row.task_type}</div>
                        {row.route_id && (
                          <span className="font-mono text-[10px] text-[#1677D2]">
                            Route {row.route_id}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center text-[#172B4D]">
                        <span className="font-semibold text-emerald-700">{row.completed}</span>
                        {' / '}
                        <span className="font-semibold text-[#0B1F3A]">{row.assigned}</span>
                        {row.pending > 0 && (
                          <span className="ml-1 text-[10px] text-amber-700">({row.pending} pend)</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-[#0B1F3A]">
                        {row.kpiText}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${row.statusColor}`}
                        >
                          {row.statusText}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-[#64748B]">
                      <div className="space-y-1">
                        <p className="font-semibold text-[#0B1F3A]">
                          No KPI records recorded for {selectedDate}
                        </p>
                        <p className="text-[11px] text-[#64748B]">
                          Use the button above to view latest historical records, or allocate work for this date.
                        </p>
                        <button
                          type="button"
                          onClick={() => setActivityMode('latest')}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#1677D2] hover:underline"
                        >
                          Show Latest Historical Activity →
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      {/* ── Bottom Row: Team Insights & Quick Actions ───────────────────────── */}
      <div className="grid gap-4 md:grid-cols-12">
        {/* Team Insights & Performance Alerts (7 cols) */}
        <article className="rounded-xl border border-[#DFE8F2] bg-white p-4 shadow-xs md:col-span-7">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-[#1677D2]">
              <BrainCircuit className="size-4" />
            </div>
            <h2 className="text-sm font-bold text-[#172B4D]">Team Insights &amp; Performance Alerts</h2>
          </div>
          <div className="mt-3 space-y-2.5">
            {/* Performance target status */}
            {needSupportCount > 0 ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-xs text-amber-900">
                <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <span className="font-semibold">Performance Target Alert:</span>{' '}
                  {needSupportCount} evaluated officer(s) scored below the 80% KPI target on this cycle. Performance coaching review recommended.
                </div>
              </div>
            ) : evaluatedCount > 0 ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5 text-xs text-emerald-900">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                <div>
                  <span className="font-semibold">On-Target Operational Performance:</span>{' '}
                  All {evaluatedCount} evaluated postal officer(s) are meeting or exceeding the 80% KPI benchmark standard.
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 rounded-lg border border-blue-100 bg-blue-50/60 p-2.5 text-xs text-blue-900">
                <Clock className="size-4 shrink-0 text-[#1677D2] mt-0.5" />
                <div>
                  <span className="font-semibold">Shift In Progress ({selectedDate}):</span>{' '}
                  {staffWithTasksCount > 0
                    ? `Work is allocated across ${staffWithTasksCount} officers (${totalAssignedTasks} total task batches). KPI scores will evaluate upon task clearance.`
                    : `No task clearance logs recorded yet for ${selectedDate}. Review Work Allocation to assign daily duties.`}
                </div>
              </div>
            )}

            {/* Workload distribution status */}
            <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-[#F8FAFC] p-2.5 text-xs text-[#334155]">
              <UsersRound className="size-4 shrink-0 text-[#1677D2] mt-0.5" />
              <div>
                <span className="font-semibold">Workload Distribution:</span>{' '}
                {totalEmployees} active registered postal staff across{' '}
                {selectedOffice !== 'All' ? selectedOffice : `${officeOptions.length > 1 ? officeOptions.length - 1 : 1} post office station(s)`}.{' '}
                {staffWithTasksCount > 0 ? `${staffWithTasksCount} officers have active shift assignments.` : 'Awaiting daily duty allocation.'}
              </div>
            </div>

            {/* Attendance & Compliance */}
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-100 bg-emerald-50/60 p-2.5 text-xs text-emerald-900">
              <UserCheck className="size-4 shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <span className="font-semibold">Attendance &amp; Security Compliance:</span>{' '}
                Postmaster attendance verification policies and biometric door tokens are enforced across all {totalEmployees} active records.
              </div>
            </div>
          </div>
        </article>

        {/* Quick Actions (5 cols) */}
        <article className="rounded-xl border border-[#DFE8F2] bg-white p-4 shadow-xs md:col-span-5">
          <h2 className="text-sm font-bold text-[#172B4D]">Quick Actions</h2>
          <div className="mt-3 grid grid-cols-1 gap-2">
            <Link
              to="/work-allocation"
              className="flex items-center justify-between rounded-lg border border-[#DFE8F2] bg-slate-50/70 px-3.5 py-2.5 text-xs font-semibold text-[#172B4D] transition-colors hover:bg-blue-50 hover:text-[#1677D2] hover:border-blue-200"
            >
              <span className="flex items-center gap-2">
                <UsersRound className="size-4 text-[#1677D2]" />
                Manage Work Allocation
              </span>
              <ArrowRight className="size-3.5" />
            </Link>

            <Link
              to="/kpi-forecasts"
              className="flex items-center justify-between rounded-lg border border-[#DFE8F2] bg-slate-50/70 px-3.5 py-2.5 text-xs font-semibold text-[#172B4D] transition-colors hover:bg-blue-50 hover:text-[#1677D2] hover:border-blue-200"
            >
              <span className="flex items-center gap-2">
                <TrendingUp className="size-4 text-[#1677D2]" />
                Run Next-Week KPI Forecast
              </span>
              <ArrowRight className="size-3.5" />
            </Link>

            <Link
              to="/postal-kpi-dashboard"
              className="flex items-center justify-between rounded-lg border border-[#DFE8F2] bg-slate-50/70 px-3.5 py-2.5 text-xs font-semibold text-[#172B4D] transition-colors hover:bg-blue-50 hover:text-[#1677D2] hover:border-blue-200"
            >
              <span className="flex items-center gap-2">
                <LineChartIcon className="size-4 text-[#1677D2]" />
                View Administrative Reports
              </span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </article>
      </div>
    </section>
  )
}
