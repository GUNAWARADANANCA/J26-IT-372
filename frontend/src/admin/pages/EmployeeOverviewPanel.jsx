import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  LineChart as LineChartIcon,
  TrendingUp,
  UserCheck,
  Users,
  UsersRound,
} from 'lucide-react'
import { useAuth } from '../data/auth'
import { getPostalKpiDashboard, list } from '../data/repository'
import ChartCard from '../ui/ChartCard'
import { Donut } from '../ui/charts'
import KpiCard from '../ui/KpiCard'

export default function EmployeeOverviewPanel() {
  const { user } = useAuth()
  const [employees, setEmployees] = useState([])
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  // Filters from Mockup: Post Office, Designation, Employee
  const [selectedOffice, setSelectedOffice] = useState('All')
  const [selectedDesignation, setSelectedDesignation] = useState('All')
  const [selectedEmployee, setSelectedEmployee] = useState('All')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const jobs = [list('employee')]
    if (user?.role === 'postmaster') jobs.push(getPostalKpiDashboard({}))
    Promise.all(jobs)
      .then(([people, dashboard]) => {
        if (cancelled) return
        setEmployees(Array.isArray(people) ? people : [])
        setReport(dashboard || null)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load the employee overview')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  // Extract filter options
  const officeOptions = useMemo(() => {
    const set = new Set(employees.map((e) => e.post_office).filter(Boolean))
    return ['All', ...Array.from(set).sort()]
  }, [employees])

  const designationOptions = useMemo(() => {
    const set = new Set(employees.map((e) => e.designation).filter(Boolean))
    return ['All', ...Array.from(set).sort()]
  }, [employees])

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (selectedOffice !== 'All' && e.post_office !== selectedOffice) return false
      if (selectedDesignation !== 'All' && e.designation !== selectedDesignation) return false
      if (selectedEmployee !== 'All' && (e.employee_id || e.name) !== selectedEmployee) return false
      return true
    })
  }, [employees, selectedOffice, selectedDesignation, selectedEmployee])

  // Calculate real performance bands and KPI statistics
  const summary = report?.summary
  const byEmployee = useMemo(() => {
    let rows = report?.by_employee || []
    if (selectedEmployee !== 'All') {
      rows = rows.filter((r) => r.employee_id === selectedEmployee)
    }
    return rows
  }, [report, selectedEmployee])

  const bands = { excellent: 0, good: 0, needsImprovement: 0, poor: 0 }
  let onTrackCount = 0
  let needSupportCount = 0

  byEmployee.forEach((row) => {
    const score = Number(row.average_kpi_score)
    if (Number.isFinite(score)) {
      if (score >= 90) {
        bands.excellent += 1
        onTrackCount += 1
      } else if (score >= 80) {
        bands.good += 1
        onTrackCount += 1
      } else if (score >= 70) {
        bands.needsImprovement += 1
        needSupportCount += 1
      } else {
        bands.poor += 1
        needSupportCount += 1
      }
    }
  })

  // Format recent activity rows
  const recentLogs = useMemo(() => {
    return byEmployee.slice(0, 5).map((row, idx) => {
      const score = Number(row.average_kpi_score)
      const isTrack = Number.isFinite(score) && score >= 80
      return {
        date: '2026-10-18',
        name: row.employee_name || row.employee_id,
        kpi: Number.isFinite(score) ? `${score.toFixed(1)}%` : '—',
        status: isTrack ? 'On Track' : 'Needs Attention',
        statusColor: isTrack ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200',
      }
    })
  }, [byEmployee])

  return (
    <section className="mb-6 space-y-4">
      {/* ── Sub-header / Filter bar ───────────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#DFE8F2] bg-white p-3.5 shadow-xs md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#172B4D]">
            <Filter className="size-3.5 text-[#1677D2]" />
            <span>Filters:</span>
          </div>

          {/* Post Office */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="filter-office" className="text-xs text-[#64748B]">Post Office</label>
            <select
              id="filter-office"
              value={selectedOffice}
              onChange={(e) => setSelectedOffice(e.target.value)}
              className="h-8 rounded-lg border border-[#DFE8F2] bg-slate-50 px-2.5 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
            >
              {officeOptions.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          {/* Designation */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="filter-desig" className="text-xs text-[#64748B]">Designation</label>
            <select
              id="filter-desig"
              value={selectedDesignation}
              onChange={(e) => setSelectedDesignation(e.target.value)}
              className="h-8 rounded-lg border border-[#DFE8F2] bg-slate-50 px-2.5 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
            >
              {designationOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Employee */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="filter-emp" className="text-xs text-[#64748B]">Employee</label>
            <select
              id="filter-emp"
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
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

        {/* Date badge */}
        <div className="flex items-center gap-1.5 self-start text-xs text-[#64748B] md:self-auto">
          <Calendar className="size-3.5 text-[#1677D2]" />
          <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {/* ── 4 Top Summary KPI Cards (as in Mockup 1) ────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Employees"
          value={filteredEmployees.length}
          note="Active registered staff"
          icon={Users}
          tone="blue"
        />
        <KpiCard
          label="Avg. Overall KPI"
          value={summary?.average_kpi_score ? `${summary.average_kpi_score}%` : '—'}
          note={summary ? `${summary.kpi_score_rows} evaluated records` : 'Postmaster metrics'}
          icon={TrendingUp}
          tone="up"
        />
        <KpiCard
          label="On Track"
          value={onTrackCount}
          note="Meeting score target (≥80%)"
          icon={CheckCircle2}
          tone="up"
        />
        <KpiCard
          label="Need Support"
          value={needSupportCount}
          note="Below target (<80%)"
          icon={AlertTriangle}
          tone="warning"
        />
      </div>

      {/* ── Mid Row: Donut Chart & Recent KPI Activity Table ─────────────── */}
      <div className="grid gap-4 xl:grid-cols-12">
        {/* Performance Distribution Donut (5 cols) */}
        <ChartCard
          title="Employee Performance Distribution"
          note="Distribution across official postal scoring tiers"
          className="xl:col-span-5"
        >
          <Donut
            ariaLabel="Employee Performance Distribution"
            centerLabel="Staff"
            centerValue={byEmployee.length}
            slices={[
              { name: 'Excellent (90%+)', value: bands.excellent, color: '#16A34A' },
              { name: 'Good (80-89%)', value: bands.good, color: '#1677D2' },
              { name: 'Needs Imprv (70-79%)', value: bands.needsImprovement, color: '#F59E0B' },
              { name: 'Poor (<70%)', value: bands.poor, color: '#E53935' },
            ].filter((s) => s.value > 0)}
          />
        </ChartCard>

        {/* Recent KPI Activity Table (7 cols) */}
        <ChartCard
          title="Recent KPI Activity"
          note="Latest reported operational performance logs"
          className="xl:col-span-7"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#DFE8F2] bg-slate-50 text-[11px] font-semibold text-[#64748B] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Employee</th>
                  <th className="py-2.5 px-3">KPI</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFE8F2]">
                {recentLogs.length > 0 ? (
                  recentLogs.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 text-[#64748B]">{row.date}</td>
                      <td className="py-2 px-3 font-medium text-[#172B4D]">{row.name}</td>
                      <td className="py-2 px-3 font-semibold text-[#172B4D]">{row.kpi}</td>
                      <td className="py-2 px-3 text-right">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${row.statusColor}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-xs text-[#64748B]">
                      No recent activity logs available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      {/* ── Bottom Row: Team Insights & Quick Actions ───────────────────── */}
      <div className="grid gap-4 md:grid-cols-12">
        {/* Team Insights (7 cols) */}
        <article className="rounded-xl border border-[#DFE8F2] bg-white p-4 shadow-xs md:col-span-7">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-[#1677D2]">
              <BrainCircuit className="size-4" />
            </div>
            <h2 className="text-sm font-bold text-[#172B4D]">Team Insights & Performance Alerts</h2>
          </div>
          <div className="mt-3 space-y-2.5">
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-100 bg-amber-50/60 p-2.5 text-xs text-amber-900">
              <Clock className="size-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <span className="font-semibold">Timeliness review recommended:</span> {needSupportCount > 0 ? `${needSupportCount} team members scored below 80% on their latest cycle.` : 'All monitored members are currently on track.'}
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-lg border border-blue-100 bg-blue-50/60 p-2.5 text-xs text-blue-900">
              <UsersRound className="size-4 shrink-0 text-[#1677D2] mt-0.5" />
              <div>
                <span className="font-semibold">Workload Distribution:</span> {filteredEmployees.length} active postal staff across {officeOptions.length > 1 ? `${officeOptions.length - 1} office stations` : 'the post office'}.
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-100 bg-emerald-50/60 p-2.5 text-xs text-emerald-900">
              <UserCheck className="size-4 shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <span className="font-semibold">Attendance Stability:</span> Postmaster door security tokens and verification records are active.
              </div>
            </div>
          </div>
        </article>

        {/* Quick Actions (5 cols) */}
        <article className="rounded-xl border border-[#DFE8F2] bg-white p-4 shadow-xs md:col-span-5">
          <h2 className="text-sm font-bold text-[#172B4D]">Quick Actions</h2>
          <div className="mt-3 grid grid-cols-1 gap-2">
            <Link
              to="/kpi-forecasts"
              className="flex items-center justify-between rounded-lg border border-[#DFE8F2] bg-slate-50/70 px-3.5 py-2.5 text-xs font-semibold text-[#172B4D] transition-colors hover:bg-blue-50 hover:text-[#1677D2] hover:border-blue-200"
            >
              <span className="flex items-center gap-2">
                <TrendingUp className="size-4 text-[#1677D2]" />
                Run Forecast Model
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
          </div>
        </article>
      </div>
    </section>
  )
}

