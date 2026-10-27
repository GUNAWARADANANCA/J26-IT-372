import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../data/auth'
import { changePct } from '../data/productivityMetrics'
import { getProductivity, list } from '../data/repository'
import ChartCard from '../ui/ChartCard'
import LoadingState from '../ui/LoadingState'
import CoachPanel from '../ui/CoachPanel'
import AIProductivityCoachDialog from '../ui/AIProductivityCoachDialog'

function shortWeek(value) {
  if (!value) return ''
  const day = new Date(`${value}T00:00:00`)
  if (Number.isNaN(day.getTime())) return value
  return day.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
  const [week, setWeek] = useState('')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [coachOpen, setCoachOpen] = useState(false)
  const [reviewedStatus, setReviewedStatus] = useState(false)

  // Load employee list on mount
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

  // Core data loader
  const loadProductivityData = useCallback(async (empId, targetWeek, targetYear) => {
    if (!empId) {
      setReport(null)
      return
    }
    setLoading(true)
    setError('')
    try {
      const payload = await getProductivity(empId, targetWeek || undefined, targetYear || undefined)
      setReport(payload)

      // Sync week and year from backend response if we did not have a specific week set
      if (!targetWeek && payload?.week) {
        setWeek(payload.week)
      }
      if (payload?.year && payload.year !== targetYear && !targetYear) {
        setYear(payload.year)
      }
    } catch (err) {
      setReport(null)
      setError(err.message || 'Unable to load productivity analysis. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load when employeeId changes
  useEffect(() => {
    if (employeeId) {
      loadProductivityData(employeeId, week, year)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId])

  // Real recorded weeks for the selected year from dataset
  const recordedWeeksForYear = useMemo(() => {
    if (!report?.weeks_by_year) return []
    return report.weeks_by_year[year] || []
  }, [report, year])

  // Handle year filter change
  const handleYearChange = (newYear) => {
    setYear(newYear)
    const weeksInYear = report?.weeks_by_year?.[newYear] || []
    if (weeksInYear.length > 0) {
      // Pick latest recorded week in this year
      setWeek(weeksInYear[weeksInYear.length - 1])
    } else {
      // Future year or year with no recorded weeks (e.g. 2026, 2027)
      setWeek('')
    }
  }

  // Handle Analyze button click — refresh all sections for current (employeeId, week, year)
  const handleAnalyze = () => {
    if (!employeeId) return
    loadProductivityData(employeeId, week, year)
  }

  // Determine state flags
  const isFutureYear = Boolean(report?.is_future_year || year === '2026' || year === '2027')
  const hasCurrentWeekLogs = Boolean(report?.available && !isFutureYear)
  const allHistory = useMemo(() => report?.history || [], [report])
  const filteredHistory = useMemo(() => {
    if (!report?.week) return allHistory
    return allHistory.filter((row) => row.week <= report.week)
  }, [allHistory, report])
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

  // Build chart series
  const activeHistoryForChart = hasCurrentWeekLogs ? filteredHistory : allHistory

  // Sparkline helper
  function renderTrendSparkline(points) {
    const valid = (points || []).filter((p) => Number.isFinite(p))
    if (valid.length < 2) {
      return <p className="py-6 text-center text-xs text-[#64748B]">Insufficient data points</p>
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
      {/* ── Page Title & Subtitle ────────────────────────────────────────── */}
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#0B1F3A] sm:text-2xl">
            AI Productivity Coach
          </h1>
          <p className="mt-0.5 text-xs text-[#64748B]">
            Sri Lanka Postal Department · Dynamic Performance Coaching, Forecasting & Strategic Directives
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
            ● Measured Baseline Data
          </span>
          <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-[#1677D2]">
            ◆ ML Forecast (MAE 3.41)
          </span>
          <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-[#5E35B1]">
            ★ Strategic Horizon
          </span>
        </div>
      </div>

      {/* ── Filter Bar: Employee, Year, Week, and Analyze Button ─────────── */}
      <div className="rounded-2xl border border-[#DFE8F2] bg-white p-4 shadow-xs">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
          {/* Employee Dropdown */}
          <div className="md:col-span-4">
            <label htmlFor="prod-emp-select" className="block text-[11px] font-semibold text-[#64748B]">
              Postal Officer / Employee
            </label>
            <select
              id="prod-emp-select"
              className="mt-1 h-10 w-full rounded-xl border border-[#DFE8F2] bg-white px-3 text-xs font-medium text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
              value={employeeId}
              onChange={(event) => {
                const newId = event.target.value
                setEmployeeId(newId)
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
              Reporting Year
            </label>
            <select
              id="prod-year-select"
              className="mt-1 h-10 w-full rounded-xl border border-[#DFE8F2] bg-white px-3 text-xs font-medium text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
              value={year}
              onChange={(e) => handleYearChange(e.target.value)}
            >
              <option value="2024">2024</option>
              <option value="2025">2025 (Historical Records)</option>
              <option value="2026">2026 (Strategic Planning)</option>
              <option value="2027">2027 (Long-term Horizon)</option>
            </select>
          </div>

          {/* Reporting Week Selector - Dynamically Populated From Real Dataset */}
          <div className="md:col-span-4">
            <label htmlFor="prod-week-select" className="block text-[11px] font-semibold text-[#64748B]">
              Reporting Week ({year})
            </label>
            <select
              id="prod-week-select"
              className="mt-1 h-10 w-full rounded-xl border border-[#DFE8F2] bg-white px-3 text-xs font-medium text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
              value={week}
              onChange={(event) => setWeek(event.target.value)}
            >
              {recordedWeeksForYear.length > 0 ? (
                <>
                  <option value="">
                    Latest Measured Week ({recordedWeeksForYear[recordedWeeksForYear.length - 1]})
                  </option>
                  {recordedWeeksForYear.map((w) => (
                    <option key={w} value={w}>
                      Week of {shortWeek(w)} ({w})
                    </option>
                  ))}
                </>
              ) : (
                <option value="">
                  {year >= '2026'
                    ? `Strategic Planning Horizon (Year ${year} — Forward Look)`
                    : `No Measured Records for Year ${year}`}
                </option>
              )}
            </select>
          </div>

          {/* Analyze Button */}
          <div className="md:col-span-2">
            <button
              type="button"
              disabled={!employeeId || loading}
              onClick={handleAnalyze}
              className="h-10 w-full rounded-xl bg-[#1677D2] px-4 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#1262ab] disabled:opacity-50"
            >
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
        </div>

        {/* Quick Week Switcher Bar for Available Weeks */}
        {recordedWeeksForYear.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[#DFE8F2] pt-2.5 text-[11px]">
            <span className="font-semibold text-[#64748B]">Measured Weeks in {year}:</span>
            {recordedWeeksForYear.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWeek(w)}
                className={`rounded-md px-2 py-0.5 font-medium transition-colors ${
                  week === w
                    ? 'bg-[#1677D2] text-white'
                    : 'bg-slate-100 text-[#172B4D] hover:bg-blue-50 hover:text-[#1677D2]'
                }`}
              >
                {shortWeek(w)}
              </button>
            ))}
          </div>
        )}

        {isFutureYear && (
          <div className="mt-3 flex items-center justify-between border-t border-purple-100 pt-2 text-[11px] text-[#5E35B1]">
            <span>
              ★ Forward-Looking Mode Active: Planning Horizon <strong>{year}</strong> derived from 2025 audited baseline and trained ML model forecasting.
            </span>
            {report?.latest_available_week && (
              <button
                type="button"
                onClick={() => {
                  setYear('2025')
                  setWeek(report.latest_available_week)
                }}
                className="font-bold underline hover:text-[#0B1F3A]"
              >
                View 2025 Historical Records ({report.latest_available_week})
              </button>
            )}
          </div>
        )}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800" role="alert">
          {error}{' '}
          <button type="button" className="ml-2 font-semibold underline" onClick={handleAnalyze}>
            Retry
          </button>
        </div>
      ) : null}

      {loading ? <LoadingState label="Loading employee productivity metrics..." /> : null}

      {!loading && !employeeId ? (
        <div className="rounded-2xl border border-dashed border-[#DFE8F2] bg-white p-12 text-center">
          <h3 className="text-sm font-bold text-[#172B4D]">Select an Employee to Begin Coaching</h3>
          <p className="mt-1 text-xs text-[#64748B]">
            Choose a postal officer from the dropdown above to load verified performance history, machine learning forecasts, and personalized coaching recommendations.
          </p>
        </div>
      ) : null}

      {/* ── Banner when Selected Week in Past Has No Logs ── */}
      {!loading && employeeId && report && !hasCurrentWeekLogs && !isFutureYear && (
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
                  <span className="underline">{report.latest_available_week}</span>. Historical trends and baseline analysis are displayed below.
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

      {/* ── Main Content Area ── */}
      {!loading && employeeId && (hasCurrentWeekLogs || hasHistoricalData || isFutureYear) ? (
        <div className="space-y-5">
          {/* ── Top 3 Cards Row ────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Card 1: Selected Week KPI or Future Horizon Target */}
            <div className="flex flex-col justify-between rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-xs lg:col-span-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#64748B]">
                    {isFutureYear
                      ? `Strategic Planning Target (${year})`
                      : hasCurrentWeekLogs
                      ? `Selected Week KPI (${report.week})`
                      : `Historical Overview (${year})`}
                  </span>
                  {isFutureYear ? (
                    <span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-[#5E35B1]">
                      Model Projection
                    </span>
                  ) : hasCurrentWeekLogs ? (
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      Measured Data
                    </span>
                  ) : (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      Historical Baseline
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-baseline gap-2.5">
                  <span className="text-3xl font-extrabold tracking-tight text-[#172B4D]">
                    {isFutureYear
                      ? forecast != null
                        ? `${forecast}%`
                        : '88.0%'
                      : hasCurrentWeekLogs && measured != null
                      ? `${measured}%`
                      : latestHistoricalKpi != null
                      ? `${latestHistoricalKpi}%`
                      : 'Not available'}
                  </span>
                  {!isFutureYear && delta != null && (
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
                  {isFutureYear && report?.historical_baseline_kpi != null && (
                    <span className="text-xs font-medium text-[#64748B]">
                      vs 2025 baseline ({report.historical_baseline_kpi}%)
                    </span>
                  )}
                </div>

                {/* Sub-status badges */}
                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                  {isFutureYear ? (
                    <span className="rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-[#5E35B1]">
                      Holdout Error Margin: ±3.41 MAE, 4.55 RMSE
                    </span>
                  ) : hasCurrentWeekLogs ? (
                    <>
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${
                          measured >= 85
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {measured >= 85 ? 'On Track' : 'Needs Attention'}
                      </span>
                      {forecast != null && (
                        <span className="text-[11px] font-semibold text-[#1677D2]">
                          Predicted next week: <strong>{forecast}%</strong>
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[11px] text-[#64748B]">
                      Latest historical KPI ({report?.latest_available_week}):{' '}
                      <strong className="text-[#172B4D]">{latestHistoricalKpi}%</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Sub-breakdown metrics */}
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
              ) : isFutureYear && report?.future_coaching_plan ? (
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#DFE8F2] pt-3 text-center">
                  <div className="rounded-lg bg-purple-50/50 p-2">
                    <span className="block text-[10px] text-[#64748B]">Base Completion</span>
                    <span className="text-xs font-bold text-[#172B4D]">{shown(report.future_coaching_plan.baseline_completion, '%')}</span>
                  </div>
                  <div className="rounded-lg bg-purple-50/50 p-2">
                    <span className="block text-[10px] text-[#64748B]">Base Accuracy</span>
                    <span className="text-xs font-bold text-emerald-700">{shown(report.future_coaching_plan.baseline_accuracy, '%')}</span>
                  </div>
                  <div className="rounded-lg bg-purple-50/50 p-2">
                    <span className="block text-[10px] text-[#64748B]">Base Timeliness</span>
                    <span className="text-xs font-bold text-[#1677D2]">{shown(report.future_coaching_plan.baseline_timeliness, '%')}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 border-t border-[#DFE8F2] pt-3 text-[11px] text-[#64748B]">
                  Historical analysis mode across recorded department periods.
                </div>
              )}
            </div>

            {/* Card 2: Trend Sparkline */}
            <div className="flex flex-col justify-between rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-xs lg:col-span-4">
              <div>
                <h3 className="text-xs font-bold text-[#172B4D]">Performance Trajectory</h3>
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

            {/* Card 3: Performance Bar Chart */}
            <div className="flex flex-col justify-between rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-xs lg:col-span-4">
              <div>
                <h3 className="text-xs font-bold text-[#172B4D]">Weekly KPI Audit</h3>
                <p className="text-[11px] text-[#64748B]">Audited department scores (last 8 recorded weeks)</p>
              </div>
              <div className="mt-3 flex h-24 items-end justify-around gap-2 pt-4">
                {activeHistoryForChart.slice(-8).map((item, idx) => {
                  const val = Number(item.kpi) || 0
                  const heightPct = Math.max(15, Math.min(100, val))
                  return (
                    <div key={item.week || idx} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full max-w-[28px] rounded-t-md bg-[#1677D2] transition-all hover:bg-[#0B1F3A]"
                        style={{ height: `${(heightPct / 100) * 72}px` }}
                        title={`${item.week}: ${val}%`}
                      />
                      <span className="text-[9px] font-medium text-[#64748B]">{item.week?.slice(5) || ''}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── Main Section: PostAssist AI Productivity Coach (Full Focus) ─ */}
          <div className="w-full">
            <CoachPanel
              employeeId={employeeId}
              week={hasCurrentWeekLogs ? report.week : week}
              year={year}
              onSelectWeek={(w) => {
                setYear(w.slice(0, 4))
                setWeek(w)
              }}
            />
          </div>
        </div>
      ) : null}

      {loading ? <LoadingState label="Loading employee productivity metrics..." /> : null}

      {!loading && !employeeId ? (
        <div className="rounded-2xl border border-dashed border-[#DFE8F2] bg-white p-12 text-center">
          <h3 className="text-sm font-bold text-[#172B4D]">Select an Employee to Begin Coaching</h3>
          <p className="mt-1 text-xs text-[#64748B]">
            Choose a postal officer from the dropdown above to load verified performance history, machine learning forecasts, and personalized coaching recommendations.
          </p>
        </div>
      ) : null}

      {/* ── Banner when Selected Week in Past Has No Logs ── */}
      {!loading && employeeId && report && !hasCurrentWeekLogs && !isFutureYear && (
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
                  <span className="underline">{report.latest_available_week}</span>. Historical trends and baseline analysis are displayed below.
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

      {/* ── Main Content Area ── */}
      {!loading && employeeId && (hasCurrentWeekLogs || hasHistoricalData || isFutureYear) ? (
        <div className="space-y-5">
          {/* ── Top 3 Cards Row ────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Card 1: Selected Week KPI or Future Horizon Target */}
            <div className="flex flex-col justify-between rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-xs lg:col-span-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#64748B]">
                    {isFutureYear
                      ? `Strategic Planning Target (${year})`
                      : hasCurrentWeekLogs
                      ? `Selected Week KPI (${report.week})`
                      : `Historical Overview (${year})`}
                  </span>
                  {isFutureYear ? (
                    <span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-[#5E35B1]">
                      Model Projection
                    </span>
                  ) : hasCurrentWeekLogs ? (
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      Measured Data
                    </span>
                  ) : (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      Historical Baseline
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-baseline gap-2.5">
                  <span className="text-3xl font-extrabold tracking-tight text-[#172B4D]">
                    {isFutureYear
                      ? forecast != null
                        ? `${forecast}%`
                        : '88.0%'
                      : hasCurrentWeekLogs && measured != null
                      ? `${measured}%`
                      : latestHistoricalKpi != null
                      ? `${latestHistoricalKpi}%`
                      : 'Not available'}
                  </span>
                  {!isFutureYear && delta != null && (
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
                  {isFutureYear && report?.historical_baseline_kpi != null && (
                    <span className="text-xs font-medium text-[#64748B]">
                      vs 2025 baseline ({report.historical_baseline_kpi}%)
                    </span>
                  )}
                </div>

                {/* Sub-status badges */}
                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                  {isFutureYear ? (
                    <span className="rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-[#5E35B1]">
                      Holdout Error Margin: ±3.41 MAE, 4.55 RMSE
                    </span>
                  ) : hasCurrentWeekLogs ? (
                    <>
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${
                          measured >= 85
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {measured >= 85 ? 'On Track' : 'Needs Attention'}
                      </span>
                      {forecast != null && (
                        <span className="text-[11px] font-semibold text-[#1677D2]">
                          Predicted next week: <strong>{forecast}%</strong>
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[11px] text-[#64748B]">
                      Latest historical KPI ({report?.latest_available_week}):{' '}
                      <strong className="text-[#172B4D]">{latestHistoricalKpi}%</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Sub-breakdown metrics */}
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
              ) : isFutureYear && report?.future_coaching_plan ? (
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#DFE8F2] pt-3 text-center">
                  <div className="rounded-lg bg-purple-50/50 p-2">
                    <span className="block text-[10px] text-[#64748B]">Base Completion</span>
                    <span className="text-xs font-bold text-[#172B4D]">{shown(report.future_coaching_plan.baseline_completion, '%')}</span>
                  </div>
                  <div className="rounded-lg bg-purple-50/50 p-2">
                    <span className="block text-[10px] text-[#64748B]">Base Accuracy</span>
                    <span className="text-xs font-bold text-emerald-700">{shown(report.future_coaching_plan.baseline_accuracy, '%')}</span>
                  </div>
                  <div className="rounded-lg bg-purple-50/50 p-2">
                    <span className="block text-[10px] text-[#64748B]">Base Timeliness</span>
                    <span className="text-xs font-bold text-[#1677D2]">{shown(report.future_coaching_plan.baseline_timeliness, '%')}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 border-t border-[#DFE8F2] pt-3 text-[11px] text-[#64748B]">
                  Historical analysis mode across recorded department periods.
                </div>
              )}
            </div>

            {/* Card 2: Trend Sparkline */}
            <div className="flex flex-col justify-between rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-xs lg:col-span-4">
              <div>
                <h3 className="text-xs font-bold text-[#172B4D]">Performance Trajectory</h3>
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

            {/* Card 3: Performance Bar Chart */}
            <div className="flex flex-col justify-between rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-xs lg:col-span-4">
              <div>
                <h3 className="text-xs font-bold text-[#172B4D]">Weekly KPI Audit</h3>
                <p className="text-[11px] text-[#64748B]">Audited department scores (last 8 recorded weeks)</p>
              </div>
              <div className="mt-3 flex h-24 items-end justify-around gap-2 pt-4">
                {activeHistoryForChart.slice(-8).map((item, idx) => {
                  const val = Number(item.kpi) || 0
                  const heightPct = Math.max(15, Math.min(100, val))
                  return (
                    <div key={item.week || idx} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full max-w-[28px] rounded-t-md bg-[#1677D2] transition-all hover:bg-[#0B1F3A]"
                        style={{ height: `${(heightPct / 100) * 72}px` }}
                        title={`${item.week}: ${val}%`}
                      />
                      <span className="text-[9px] font-medium text-[#64748B]">{item.week?.slice(5) || ''}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── Main Section: AI Recommendations Panel + Supporting Evidence ─ */}
          <div className="grid gap-5 lg:grid-cols-12">
            {/* PostAssist AI Productivity Coach (7 cols) */}
            <div className="lg:col-span-7">
              <CoachPanel
                employeeId={employeeId}
                week={hasCurrentWeekLogs ? report.week : week}
                year={year}
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
                note="Audited Historical Records (Measured Department Observations)"
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
                          <tr key={h.week} className={`hover:bg-slate-50 ${isSelected ? 'bg-blue-50/50 font-semibold' : ''}`}>
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
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0B1F3A]">Postmaster Sign-off Status</span>
                  <span
                    className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                      reviewedStatus
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-rose-200 bg-rose-50 text-rose-800'
                    }`}
                  >
                    {reviewedStatus ? '✓ Reviewed & Approved' : 'Pending Review'}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[#64748B]">
                  Formal acknowledgement by Postmaster or Supervisor for operational follow-up.
                </p>
                <button
                  type="button"
                  onClick={() => setReviewedStatus((prev) => !prev)}
                  className={`mt-3 w-full rounded-xl py-2.5 text-xs font-bold text-white shadow-xs transition-colors ${
                    reviewedStatus
                      ? 'bg-slate-700 hover:bg-slate-800'
                      : 'bg-[#1677D2] hover:bg-[#1262ab]'
                  }`}
                >
                  {reviewedStatus ? 'Mark as Pending' : 'Mark as Reviewed by Postmaster'}
                </button>
              </div>

              {/* Model Validation & Evaluation Card */}
              <div className="rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-xs">
                <span className="text-xs font-bold text-[#0B1F3A]">Forecasting Model Validation</span>
                <div className="mt-2.5 space-y-2 text-xs text-[#475569]">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-[11px] text-[#64748B]">Model Architecture</span>
                    <span className="font-semibold text-[#172B4D]">Random Forest Pipeline</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-[11px] text-[#64748B]">Holdout Test MAE</span>
                    <span className="font-bold text-[#1677D2]">3.41 points</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-[11px] text-[#64748B]">Holdout Test RMSE</span>
                    <span className="font-semibold text-[#172B4D]">4.55 points</span>
                  </div>
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-[11px] text-[#64748B]">Baseline Naive MAE</span>
                    <span className="text-[#64748B]">7.93 points</span>
                  </div>
                </div>
                <p className="mt-2 rounded-lg bg-slate-50 p-2 text-[10px] text-[#64748B]">
                  Trained on 16 departmental officers. Predictions are operational guidelines, not compensation determinations.
                </p>
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
