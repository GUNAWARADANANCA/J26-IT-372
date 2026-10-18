import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../data/auth'
import { changePct, formatRange, reportingWeeks } from '../data/productivityMetrics'
import { getProductivity, list } from '../data/repository'
import ChartCard from '../ui/ChartCard'
import { ChartLegend, LineChart } from '../ui/charts'
import LoadingState from '../ui/LoadingState'
import CoachPanel from '../ui/CoachPanel'
import AIProductivityCoachDialog from '../ui/AIProductivityCoachDialog'

function shortWeek(value) {
  if (!value) return ''
  const day = new Date(`${value}T00:00:00`)
  if (Number.isNaN(day.getTime())) return value
  return day.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function shown(value, suffix = '') {
  if (value == null || value === '') return 'Not available'
  return `${value}${suffix}`
}

export default function ProductivityPage() {
  const { user } = useAuth()
  const [employees, setEmployees] = useState([])
  const [employeeId, setEmployeeId] = useState('')
  const [year, setYear] = useState('2025')
  // Default week starts empty so backend resolves to the employee's latest recorded week (2025-01-27)
  const [week, setWeek] = useState('')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [coachOpen, setCoachOpen] = useState(false)
  const [reviewedStatus, setReviewedStatus] = useState(false)

  const weeks = useMemo(() => reportingWeeks(new Date(), year), [year])
  const weeksByMonth = useMemo(() => {
    const groups = []
    for (const item of weeks) {
      const month = new Date(`${item.start}T00:00:00`).toLocaleDateString('en-US', { month: 'long' })
      const last = groups[groups.length - 1]
      if (!last || last.month !== month) groups.push({ month, items: [item] })
      else last.items.push(item)
    }
    return groups
  }, [weeks])

  // Load employees list and default to the first employee
  useEffect(() => {
    let cancelled = false
    list('employee')
      .then((rows) => {
        if (!cancelled) {
          const sorted = [...rows].sort((a, b) =>
            String(a.employee_name || '').localeCompare(String(b.employee_name || ''))
          )
          setEmployees(sorted)
          if (sorted.length > 0 && !employeeId) {
            setEmployeeId(sorted[0].employee_id || sorted[0]._id)
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Unable to load employees. Please try again.')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load productivity data for selected employee and week
  useEffect(() => {
    if (!employeeId) {
      setReport(null)
      return undefined
    }
    let cancelled = false
    setLoading(true)
    setError('')
    getProductivity(employeeId, week || undefined)
      .then((payload) => {
        if (cancelled) return
        setReport(payload)
        // If no week was explicitly chosen yet and backend resolved a valid week, sync the dropdown
        if (!week && payload?.week) {
          setWeek(payload.week)
          if (payload.week.slice(0, 4) !== year) {
            setYear(payload.week.slice(0, 4))
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setReport(null)
          setError(err.message || 'Unable to load data. Please try again.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, week, attempt])

  // Extract historical observations (always available if the employee has any logs in 2024-2025)
  const allHistory = useMemo(() => report?.history || [], [report])
  const filteredHistory = useMemo(() => {
    if (!report?.week) return allHistory
    return allHistory.filter((row) => row.week <= report.week)
  }, [allHistory, report])

  const hasCurrentWeekLogs = Boolean(report?.available)
  const hasHistoricalData = allHistory.length > 0

  const previous = filteredHistory.length > 1 ? filteredHistory[filteredHistory.length - 2] : null
  const measured = hasCurrentWeekLogs ? Number(report.measured_kpi) : null
  const latestHistoricalKpi = hasHistoricalData
    ? Number(allHistory[allHistory.length - 1].kpi)
    : null
  const forecast = report?.predicted_next_week_kpi != null ? Number(report.predicted_next_week_kpi) : null

  const delta = hasCurrentWeekLogs
    ? changePct(measured, previous ? Number(previous.kpi) : report?.previous_measured_kpi)
    : null

  // Build chart series from available history
  const activeHistoryForChart = hasCurrentWeekLogs ? filteredHistory : allHistory
  const labels = activeHistoryForChart
    .map((row) => shortWeek(row.week))
    .concat(forecast == null ? [] : ['Forecast'])
  const measuredSeries = activeHistoryForChart
    .map((row) => (row.kpi == null ? null : Number(row.kpi)))
    .concat(forecast == null ? [] : [null])
  const forecastSeries = activeHistoryForChart.map(() => null)
  if (forecast != null && activeHistoryForChart.length > 0) {
    const lastKpi = activeHistoryForChart[activeHistoryForChart.length - 1].kpi
    forecastSeries[activeHistoryForChart.length - 1] = lastKpi == null ? null : Number(lastKpi)
    forecastSeries.push(forecast)
  }

  // Sparkline helper for the middle Trend card
  function renderTrendSparkline(points) {
    const valid = (points || []).filter((p) => Number.isFinite(p))
    if (valid.length < 2) {
      return <p className="py-6 text-center text-xs text-[#64748B]">Insufficient points</p>
    }
    const min = Math.min(...valid) - 2
    const max = Math.max(...valid) + 2
    const range = max - min || 1
    const w = 240
    const h = 76
    const polyPoints = valid
      .map((val, idx) => {
        const x = 12 + (idx / (valid.length - 1)) * (w - 24)
        const y = h - 12 - ((val - min) / range) * (h - 24)
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')

    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="h-20 w-full overflow-visible" role="img" aria-label="KPI Sparkline Trend">
        <polyline
          fill="none"
          stroke="#1677D2"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polyPoints}
        />
        {valid.map((val, idx) => {
          const x = 12 + (idx / (valid.length - 1)) * (w - 24)
          const y = h - 12 - ((val - min) / range) * (h - 24)
          return (
            <circle key={idx} cx={x} cy={y} r="3.5" fill="#1677D2" stroke="#fff" strokeWidth="1.5">
              <title>{`${activeHistoryForChart[idx]?.week || ''}: ${val}%`}</title>
            </circle>
          )
        })}
      </svg>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Page Title & Subtitle (Matching Reference Image) ───────────────── */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[#172B4D] sm:text-2xl">
          AI Productivity Coach
        </h1>
        <p className="mt-0.5 text-xs text-[#64748B]">
          Smart suggestions for better performance based on recorded KPI history and model analysis
        </p>
      </div>

      {/* ── Employee Selector & Reporting Week Bar ─────────────────────────── */}
      <div className="rounded-2xl border border-[#DFE8F2] bg-white p-4 shadow-xs">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
          {/* Employee Dropdown */}
          <div className="md:col-span-5">
            <label htmlFor="prod-emp-select" className="block text-[11px] font-semibold text-[#64748B]">
              Employee
            </label>
            <select
              id="prod-emp-select"
              className="mt-1 h-10 w-full rounded-xl border border-[#DFE8F2] bg-white px-3 text-xs font-medium text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
              value={employeeId}
              onChange={(event) => {
                setEmployeeId(event.target.value)
                // Reset week so backend automatically loads the newly selected employee's latest recorded week
                setWeek('')
                setReviewedStatus(false)
              }}
            >
              <option value="">Select an employee to analyze…</option>
              {employees.map((row) => {
                const id = row.employee_id || row._id
                return (
                  <option key={id} value={id}>
                    {row.employee_name || id} ({row.designation || 'Staff'} · {row.post_office || 'General'})
                  </option>
                )
              })}
            </select>
          </div>

          {/* Year Filter */}
          <div className="md:col-span-2">
            <label htmlFor="prod-year-select" className="block text-[11px] font-semibold text-[#64748B]">
              Year
            </label>
            <select
              id="prod-year-select"
              className="mt-1 h-10 w-full rounded-xl border border-[#DFE8F2] bg-white px-3 text-xs font-medium text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
              value={year}
              onChange={(e) => {
                setYear(e.target.value)
              }}
            >
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>
          </div>

          {/* Reporting Week Selector */}
          <div className="md:col-span-3">
            <label htmlFor="prod-week-select" className="block text-[11px] font-semibold text-[#64748B]">
              Reporting Week
            </label>
            <select
              id="prod-week-select"
              className="mt-1 h-10 w-full rounded-xl border border-[#DFE8F2] bg-white px-3 text-xs font-medium text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
              value={week}
              onChange={(event) => setWeek(event.target.value)}
            >
              <option value="">Latest Available Week</option>
              {weeksByMonth.map((group) => (
                <optgroup key={group.month} label={`${group.month} ${year}`}>
                  {group.items.map((item) => (
                    <option key={item.start} value={item.start}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Analyze Button */}
          <div className="md:col-span-2">
            <button
              type="button"
              disabled={!employeeId}
              onClick={() => setCoachOpen(true)}
              className="h-10 w-full rounded-xl bg-[#1677D2] px-4 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#1262ab] disabled:opacity-50"
            >
              Analyze
            </button>
          </div>
        </div>

        {/* Quick Available Weeks Bar when employee has recorded history */}
        {report?.available_weeks?.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[#DFE8F2] pt-2.5 text-[11px]">
            <span className="font-semibold text-[#64748B]">Available Recorded Weeks:</span>
            {report.available_weeks.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => {
                  setYear(w.slice(0, 4))
                  setWeek(w)
                }}
                className={`rounded-md px-2 py-0.5 font-medium transition-colors ${
                  week === w
                    ? 'bg-[#1677D2] text-white'
                    : 'bg-slate-100 text-[#172B4D] hover:bg-blue-50 hover:text-[#1677D2]'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        )}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800" role="alert">
          {error}{' '}
          <button type="button" className="ml-2 font-semibold underline" onClick={() => setAttempt((v) => v + 1)}>
            Retry
          </button>
        </div>
      ) : null}

      {loading ? <LoadingState label="Loading employee productivity metrics..." /> : null}

      {!loading && !employeeId ? (
        <div className="rounded-2xl border border-dashed border-[#DFE8F2] bg-white p-12 text-center">
          <h3 className="text-sm font-bold text-[#172B4D]">Select an Employee to Begin Coaching</h3>
          <p className="mt-1 text-xs text-[#64748B]">
            Choose an employee from the dropdown above to load real performance history and personalized coaching recommendations.
          </p>
        </div>
      ) : null}

      {/* ── Improved Banner when Selected Week Has No Logs, but Historical Data Exists ── */}
      {!loading && employeeId && report && !hasCurrentWeekLogs && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-xs text-amber-900 shadow-xs">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h3 className="font-bold text-amber-950">
                No Measured KPI Logs for Selected Week ({report.requested_week || week})
              </h3>
              <p className="mt-1 text-amber-800">
                {report.message || 'No daily KPI logs were recorded for this employee during the selected week.'}
              </p>
              {report.earliest_available_week && report.latest_available_week && (
                <p className="mt-1 text-[11px] font-medium text-amber-900">
                  Historical records for <strong>{report.employee_name}</strong> are available from{' '}
                  <span className="underline">{report.earliest_available_week}</span> to{' '}
                  <span className="underline">{report.latest_available_week}</span>. Historical trends and analysis are shown below.
                </p>
              )}
            </div>
            {report.latest_available_week && (
              <button
                type="button"
                onClick={() => {
                  setYear(report.latest_available_week.slice(0, 4))
                  setWeek(report.latest_available_week)
                }}
                className="shrink-0 rounded-xl bg-[#1677D2] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1262ab]"
              >
                Jump to Latest Recorded Week ({report.latest_available_week})
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Main Content (Displayed for both active week AND historical fallback) ── */}
      {!loading && employeeId && (hasCurrentWeekLogs || hasHistoricalData) ? (
        <div className="space-y-5">
          {/* ── Top 3 Cards Row matching Reference Image ───────────────────────── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Card 1: Current KPI (4 cols) */}
            <div className="flex flex-col justify-between rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-xs lg:col-span-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#64748B]">
                    {hasCurrentWeekLogs ? `Selected Week KPI (${report.week})` : 'Selected Week KPI'}
                  </span>
                  {!hasCurrentWeekLogs && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      No Logs This Week
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-baseline gap-2.5">
                  <span className="text-3xl font-extrabold tracking-tight text-[#172B4D]">
                    {hasCurrentWeekLogs && measured != null
                      ? `${measured}%`
                      : 'Not available'}
                  </span>
                  {delta != null && (
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${
                        delta >= 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {delta > 0 ? '+' : ''}
                      {delta.toFixed(1)}%
                    </span>
                  )}
                </div>

                {/* Status Badge & Predicted Next Week */}
                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                  {hasCurrentWeekLogs ? (
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${
                        measured >= 85
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {measured >= 85 ? 'On Track' : 'Needs Attention'}
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#64748B]">
                      Latest historical KPI ({report?.latest_available_week}):{' '}
                      <strong className="text-[#172B4D]">{latestHistoricalKpi}%</strong>
                    </span>
                  )}

                  {forecast != null && (
                    <span className="text-[11px] font-semibold text-emerald-700">
                      Predicted next week: <strong>{forecast}%</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Sub-breakdown metrics when current week has logs */}
              {hasCurrentWeekLogs ? (
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#DFE8F2] pt-3 text-center">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <span className="block text-[10px] text-[#64748B]">Completion</span>
                    <span className="text-xs font-bold text-[#172B4D]">{shown(report?.completion, '%')}</span>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <span className="block text-[10px] text-[#64748B]">Accuracy</span>
                    <span className="text-xs font-bold text-emerald-700">{shown(report?.accuracy, '%')}</span>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <span className="block text-[10px] text-[#64748B]">Timeliness</span>
                    <span className="text-xs font-bold text-[#1677D2]">{shown(report?.timeliness, '%')}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 border-t border-[#DFE8F2] pt-3 text-[11px] text-[#64748B]">
                  Component breakdown requires daily logs for the selected week.
                </div>
              )}
            </div>

            {/* Card 2: Trend Line SparkCard (4 cols) */}
            <div className="flex flex-col justify-between rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-xs lg:col-span-4">
              <div>
                <h3 className="text-xs font-bold text-[#172B4D]">Trend</h3>
                <p className="text-[11px] text-[#64748B]">
                  Historical measured trajectory ({activeHistoryForChart.length} recorded weeks)
                </p>
              </div>
              <div className="my-2">
                {renderTrendSparkline(activeHistoryForChart.map((h) => Number(h.kpi)))}
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                <span>Start: {activeHistoryForChart[0]?.week || '—'}</span>
                <span>Latest: {activeHistoryForChart[activeHistoryForChart.length - 1]?.week || '—'}</span>
              </div>
            </div>

            {/* Card 3: Performance Trend Bar Chart (last 8 weeks) (4 cols) */}
            <div className="flex flex-col justify-between rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-xs lg:col-span-4">
              <div>
                <h3 className="text-xs font-bold text-[#172B4D]">Performance Trend (last 8 weeks)</h3>
                <p className="text-[11px] text-[#64748B]">Weekly measured KPI comparison</p>
              </div>
              <div className="mt-3 flex h-24 items-end justify-around gap-2 pt-4">
                {activeHistoryForChart.slice(-8).map((item, idx) => {
                  const val = Number(item.kpi) || 0
                  const heightPct = Math.max(15, Math.min(100, val))
                  return (
                    <div key={item.week || idx} className="flex flex-1 flex-col items-center gap-1">
                      <div className="w-full max-w-[28px] rounded-t-md bg-[#1677D2] transition-all hover:bg-[#125ea7]" style={{ height: `${(heightPct / 100) * 72}px` }} title={`${item.week}: ${val}%`} />
                      <span className="text-[9px] font-medium text-[#64748B]">{item.week?.slice(5) || ''}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── Bottom Section: AI Recommendations + Supporting Evidence ──────── */}
          <div className="grid gap-5 lg:grid-cols-12">
            {/* AI Recommendations List (7 cols) */}
            <div className="rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-xs lg:col-span-7">
              <div className="mb-3 flex items-center justify-between border-b border-[#DFE8F2] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#172B4D]">AI Recommendations</h3>
                  <p className="text-[11px] text-[#64748B]">
                    {hasCurrentWeekLogs
                      ? `Generated from measured records for week of ${report.week}`
                      : `Historical analysis based on recorded weeks (${report.earliest_available_week} to ${report.latest_available_week})`}
                  </p>
                </div>
                <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[10px] font-semibold text-[#1677D2]">
                  {hasCurrentWeekLogs ? 'Current Week Analysis' : 'Historical Mode'}
                </span>
              </div>

              {/* Real Coach recommendations component */}
              <CoachPanel
                employeeId={employeeId}
                week={hasCurrentWeekLogs ? report.week : week}
                onSelectWeek={(w) => {
                  setYear(w.slice(0, 4))
                  setWeek(w)
                }}
              />
            </div>

            {/* Supporting Evidence & Recommendation Status (5 cols) */}
            <div className="space-y-5 lg:col-span-5">
              <ChartCard
                title="Supporting Evidence"
                note="Recent KPI Records (Measured Historical Observations)"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#DFE8F2] bg-slate-50 text-[10px] font-semibold text-[#64748B] uppercase">
                      <tr>
                        <th className="py-2.5 px-2.5">Week</th>
                        <th className="py-2.5 px-2.5">KPI</th>
                        <th className="py-2.5 px-2.5">Timeliness</th>
                        <th className="py-2.5 px-2.5">Accuracy</th>
                        <th className="py-2.5 px-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DFE8F2]">
                      {allHistory.slice(-6).reverse().map((h) => {
                        const isSelected = h.week === report?.week
                        return (
                          <tr key={h.week} className={`hover:bg-slate-50 ${isSelected ? 'bg-blue-50/50' : ''}`}>
                            <td className="py-2.5 px-2.5 font-medium text-[#172B4D]">{h.week}</td>
                            <td className="py-2.5 px-2.5 font-bold text-[#172B4D]">{h.kpi != null ? `${h.kpi}%` : '—'}</td>
                            <td className="py-2.5 px-2.5 text-[#64748B]">{h.timeliness != null ? `${h.timeliness}%` : '—'}</td>
                            <td className="py-2.5 px-2.5 text-[#64748B]">{h.accuracy != null ? `${h.accuracy}%` : '—'}</td>
                            <td className="py-2.5 px-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setYear(h.week.slice(0, 4))
                                  setWeek(h.week)
                                }}
                                className="rounded px-2 py-0.5 text-[10px] font-semibold text-[#1677D2] hover:bg-blue-50"
                              >
                                {isSelected ? 'Viewing' : 'Inspect'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </ChartCard>

              {/* Recommendation Status Card */}
              <div className="rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-xs">
                <span className="text-xs font-bold text-[#172B4D]">Recommendation Status</span>
                <div className="mt-3">
                  <span
                    className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold ${
                      reviewedStatus
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-rose-200 bg-rose-50 text-rose-800'
                    }`}
                  >
                    {reviewedStatus ? 'Reviewed' : 'Not Reviewed'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewedStatus(true)}
                  className="mt-3 w-full rounded-xl bg-[#1677D2] py-2.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#1262ab]"
                >
                  {reviewedStatus ? '✓ Marked as Reviewed' : 'Mark as Reviewed'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <AIProductivityCoachDialog
        open={coachOpen}
        employeeId={employeeId}
        week={hasCurrentWeekLogs ? report?.week : report?.latest_available_week || week}
        onClose={() => setCoachOpen(false)}
      />
    </div>
  )
}
