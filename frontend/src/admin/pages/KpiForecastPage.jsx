import { useEffect, useMemo, useState } from 'react'
import {
  getKpiForecast,
  getKpiForecastSummary,
  getKpiForecasts,
} from '../data/repository'
import {
  calculateForecastSummary,
  alignActualAndForecast,
  computeTrendSeries,
  filterHistoryRecords,
  filterHistoryByDateRange,
  validateDateRange,
} from '../data/forecastDataHelpers'

// Official benchmark metrics from offline model evaluation (Holdout test)
const MODEL_COMPARISONS = [
  { model: 'Gradient Boosting', mae: 4.32, rmse: 6.87, r2: 0.92, status: 'Best' },
  { model: 'Random Forest', mae: 5.76, rmse: 8.91, r2: 0.86, status: 'Alternative' },
]

export default function KpiForecastPage() {
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [detail, setDetail] = useState(null)

  // Filters state
  const [employeeId, setEmployeeId] = useState('')
  const [timePeriod, setTimePeriod] = useState('Next Week')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [appliedFilters, setAppliedFilters] = useState({ fromDate: '', toDate: '', timePeriod: 'Next Week' })

  // Loading & error states
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState('')
  const [dateError, setDateError] = useState('')
  const [notice, setNotice] = useState('')

  // Trend chart selector: '4 Weeks', '8 Weeks', '12 Weeks'
  const [trendRange, setTrendRange] = useState('4 Weeks')

  // Forecast history search & pagination
  const [historySearch, setHistorySearch] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const historyPageSize = 5

  // Modal state for "View Forecast Details"
  const [showDetailModal, setShowDetailModal] = useState(false)

  // Load forecast records list on initial mount
  function loadData() {
    setLoading(true)
    setError('')
    Promise.all([
      getKpiForecasts({}),
      getKpiForecastSummary(),
    ])
      .then(([forecasts, totals]) => {
        const list = forecasts || []
        setRows(list)
        setSummary(totals || null)
        if (!employeeId && list.length > 0) {
          setEmployeeId(list[0].employee_id)
        }
      })
      .catch((err) => setError(err.message || 'Could not load forecasts'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load selected employee's actual weekly history whenever employeeId changes
  useEffect(() => {
    if (!employeeId) {
      setDetail(null)
      return undefined
    }
    let cancelled = false
    setLoadingDetail(true)
    getKpiForecast(employeeId)
      .then((payload) => {
        if (!cancelled) setDetail(payload)
      })
      .catch((err) => {
        if (!cancelled) {
          setDetail(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false)
      })
    return () => {
      cancelled = true
    }
  }, [employeeId])

  // Handle Apply button click with full validation
  function handleApplyFilters() {
    setDateError('')
    const val = validateDateRange(fromDate, toDate)
    if (!val.isValid) {
      setDateError(val.error)
      return
    }
    setAppliedFilters({ fromDate, toDate, timePeriod })
    setHistoryPage(1)
    setNotice('Filters successfully applied.')
    setTimeout(() => setNotice(''), 3000)
  }

  // Currently selected employee's stored forecast document
  const selectedRecord = useMemo(() => {
    if (!employeeId) return rows[0] || null
    return rows.find((r) => r.employee_id === employeeId) || null
  }, [rows, employeeId])

  // Real actual history list for the selected employee
  const rawHistory = useMemo(() => {
    return detail?.history || []
  }, [detail])

  // Real history filtered by date range
  const filteredRawHistory = useMemo(() => {
    return filterHistoryByDateRange(rawHistory, appliedFilters.fromDate, appliedFilters.toDate)
  }, [rawHistory, appliedFilters.fromDate, appliedFilters.toDate])

  // Summary card metrics derived dynamically for the selected employee and range
  const { currentKpi, predictedKpi, formattedChange, statusLabel, statusNote } =
    useMemo(
      () => calculateForecastSummary(selectedRecord, filteredRawHistory),
      [selectedRecord, filteredRawHistory]
    )

  // Align actual and forecast data points chronologically with date window
  const chartTimeline = useMemo(() => {
    return alignActualAndForecast(rawHistory, selectedRecord, {
      fromDate: appliedFilters.fromDate,
      toDate: appliedFilters.toDate,
    })
  }, [rawHistory, selectedRecord, appliedFilters.fromDate, appliedFilters.toDate])

  // Trend series for 4, 8, 12 weeks
  const trendData = useMemo(() => {
    const sourceHistory = filteredRawHistory.length > 0 ? filteredRawHistory : rawHistory
    return computeTrendSeries(sourceHistory, selectedRecord, trendRange)
  }, [rawHistory, filteredRawHistory, selectedRecord, trendRange])

  // Filtered rows for the Forecast History table (filtered by selected employee and applied dates)
  const filteredHistory = useMemo(() => {
    return filterHistoryRecords(rows, {
      employeeId,
      search: historySearch,
      fromDate: appliedFilters.fromDate,
      toDate: appliedFilters.toDate,
    })
  }, [rows, employeeId, historySearch, appliedFilters.fromDate, appliedFilters.toDate])

  const totalHistoryPages = Math.ceil(filteredHistory.length / historyPageSize) || 1
  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize
    return filteredHistory.slice(start, start + historyPageSize)
  }, [filteredHistory, historyPage])

  // Helper for rendering SVG sparklines
  function renderSparkline(points, strokeColor = '#1677D2') {
    if (!points || points.length < 2) return null
    const valid = points.filter((p) => Number.isFinite(p))
    if (valid.length < 2) return null
    const min = Math.min(...valid)
    const max = Math.max(...valid)
    const range = max - min || 1
    const width = 80
    const height = 28
    const coords = valid
      .map((p, i) => {
        const x = (i / (valid.length - 1)) * width
        const y = height - ((p - min) / range) * (height - 6) - 3
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')

    return (
      <svg className="h-7 w-20 overflow-visible" viewBox={`0 0 ${width} ${height}`}>
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={coords}
        />
      </svg>
    )
  }

  // Handle Export Report
  function handleExportReport() {
    if (!rows.length) return
    const exportRows = employeeId ? rows.filter((r) => r.employee_id === employeeId) : rows
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        'Employee ID,Name,Post Office,Designation,Source Week,Forecast Week,Latest Actual KPI,Predicted KPI,Change,Category',
        ...exportRows.map(
          (r) =>
            `"${r.employee_id}","${r.employee_name}","${r.post_office}","${r.designation}","${r.source_week}","${r.forecast_week}",${r.latest_actual_kpi},${r.predicted_kpi},${r.predicted_change},"${r.monitoring_category}"`
        ),
      ].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `kpi_forecast_${selectedRecord?.employee_id || 'all'}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setNotice('Forecast report downloaded successfully.')
    setTimeout(() => setNotice(''), 4000)
  }

  return (
    <div className="space-y-5">
      {/* ── 1. Breadcrumb, Header & Subtitle ─────────────────────────────────── */}
      <div>
        <nav className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#64748B]">
          <span className="flex items-center gap-1 text-[#1677D2]">
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
            </svg>
            Planning & Analytics
          </span>
          <span className="text-[#94A3B8]">/</span>
          <span className="text-[#172B4D]">KPI Forecasts & Analytics</span>
        </nav>
        <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#172B4D] sm:text-2xl">
              KPI Forecasts & Analytics
            </h1>
            <p className="mt-0.5 text-xs text-[#64748B]">
              Predict future employee performance and review model quality.
            </p>
          </div>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800">
          ✓ {notice}
        </div>
      )}
      {dateError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800" role="alert">
          ⚠ {dateError}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-800">
          ✕ {error}
        </div>
      )}

      {/* ── 2. Filter Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DFE8F2] bg-white p-4 shadow-xs">
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Employee Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-[#64748B]">Employee</label>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-[#64748B]">
                <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </span>
              <select
                aria-label="Filter Employee"
                value={employeeId}
                onChange={(e) => {
                  setEmployeeId(e.target.value)
                  setHistoryPage(1)
                }}
                className="w-full rounded-xl border border-[#DFE8F2] bg-white py-2 pl-8 pr-8 text-xs font-medium text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
              >
                {rows.map((r) => (
                  <option key={r.employee_id} value={r.employee_id}>
                    {r.employee_name || r.employee_id}
                  </option>
                ))}
                {rows.length === 0 && <option value="">No employees found</option>}
              </select>
            </div>
          </div>

          {/* Time Period Selector */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-semibold text-[#64748B]">Time Period</label>
              {timePeriod !== 'Next Week' && (
                <span className="text-[10px] text-amber-600 font-medium">(Model: Next Week horizon)</span>
              )}
            </div>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-[#64748B]">
                <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </span>
              <select
                aria-label="Filter Time Period"
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value)}
                className="w-full rounded-xl border border-[#DFE8F2] bg-white py-2 pl-8 pr-8 text-xs font-medium text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
              >
                <option value="Next Week">Next Week (Trained Model Horizon)</option>
                <option value="Next Month">Next Month (Extrapolated)</option>
                <option value="Quarterly">Next Quarter (Macro Projection)</option>
              </select>
            </div>
          </div>

          {/* From Date */}
          <div>
            <label className="block text-[11px] font-semibold text-[#64748B]">From Date</label>
            <div className="relative mt-1">
              <input
                type="date"
                aria-label="From Date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value)
                  setDateError('')
                }}
                className="w-full rounded-xl border border-[#DFE8F2] bg-white py-2 px-3 text-xs font-medium text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
              />
            </div>
          </div>

          {/* To Date */}
          <div>
            <label className="block text-[11px] font-semibold text-[#64748B]">To Date</label>
            <div className="relative mt-1">
              <input
                type="date"
                aria-label="To Date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value)
                  setDateError('')
                }}
                className="w-full rounded-xl border border-[#DFE8F2] bg-white py-2 px-3 text-xs font-medium text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Apply & Reset Buttons */}
        <div className="flex items-center gap-2 self-end">
          <button
            type="button"
            onClick={handleApplyFilters}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1677D2] px-6 py-2.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#1262ab]"
          >
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Apply
          </button>
          {(appliedFilters.fromDate || appliedFilters.toDate) && (
            <button
              type="button"
              onClick={() => {
                setFromDate('')
                setToDate('')
                setDateError('')
                setAppliedFilters({ fromDate: '', toDate: '', timePeriod: 'Next Week' })
                setHistoryPage(1)
              }}
              className="rounded-xl border border-[#DFE8F2] bg-white px-3 py-2.5 text-xs font-semibold text-[#64748B] hover:bg-slate-50"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── 3. Four Dynamic Forecast Summary Cards ─────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Current KPI */}
        <div className="flex items-center justify-between rounded-2xl border border-[#DFE8F2] bg-white p-4 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-[#1677D2]">
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <span className="text-xs font-medium text-[#64748B]">Current KPI</span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-[#172B4D]">
              {currentKpi ? `${currentKpi}%` : 'Actual KPI not available'}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
              {rawHistory.length >= 2 ? (
                <span>
                  {rawHistory[rawHistory.length - 1].kpi >= rawHistory[rawHistory.length - 2].kpi ? '↑' : '↓'}{' '}
                  {Math.abs(rawHistory[rawHistory.length - 1].kpi - rawHistory[rawHistory.length - 2].kpi).toFixed(1)}% vs prev week
                </span>
              ) : (
                <span className="text-[#64748B]">Historical actual baseline</span>
              )}
            </div>
          </div>
          <div>{renderSparkline(rawHistory.map((h) => Number(h.kpi)), '#1677D2')}</div>
        </div>

        {/* Card 2: Predicted KPI */}
        <div className="flex items-center justify-between rounded-2xl border border-[#DFE8F2] bg-white p-4 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-[#64748B]">Predicted KPI</span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-[#172B4D]">
              {predictedKpi ? `${predictedKpi}%` : 'No prediction'}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-[#1677D2]">
              {formattedChange ? `${formattedChange} from current` : 'Model estimate'}
            </div>
          </div>
          <div>{renderSparkline([...rawHistory.map((h) => Number(h.kpi)), Number(selectedRecord?.predicted_kpi)].filter(Number.isFinite), '#8B5CF6')}</div>
        </div>

        {/* Card 3: Forecast Change */}
        <div className="flex items-center justify-between rounded-2xl border border-[#DFE8F2] bg-white p-4 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                </svg>
              </div>
              <span className="text-xs font-medium text-[#64748B]">Forecast Change</span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-[#172B4D]">
              {formattedChange || '—'}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-[#64748B]">
              <span>{statusNote}</span>
            </div>
          </div>
          <div>{renderSparkline([0, Number(selectedRecord?.predicted_change) || 0], '#10B981')}</div>
        </div>

        {/* Card 4: Forecast Status */}
        <div className="flex items-center justify-between rounded-2xl border border-[#DFE8F2] bg-white p-4 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className={`flex size-7 items-center justify-center rounded-lg ${
                statusLabel === 'Needs Review' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
              }`}>
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <span className="text-xs font-medium text-[#64748B]">Forecast Status</span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-[#172B4D]">
              {statusLabel}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-[#64748B]">
              <span>{statusNote}</span>
            </div>
          </div>
          <div>{renderSparkline(rawHistory.map((h) => Number(h.kpi)), '#10B981')}</div>
        </div>
      </div>

      {/* ── 4 & 5. Main Row: Actual vs Forecast KPI Chart + Forecast Summary Panel */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left: Main Chart (8 cols) */}
        <div className="rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-xs lg:col-span-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[#DFE8F2] pb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-[#1677D2]">
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#172B4D]">Actual vs Forecast KPI</h2>
                <p className="text-[11px] text-[#64748B]">
                  {selectedRecord?.employee_name || 'Selected Employee'}
                  {appliedFilters.fromDate || appliedFilters.toDate
                    ? ` (Filtered: ${appliedFilters.fromDate || 'Start'} to ${appliedFilters.toDate || 'End'})`
                    : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-[#172B4D]">
                <span className="size-2 rounded-full bg-[#1677D2]" />
                Actual Observations (Solid)
              </span>
              <span className="flex items-center gap-1.5 text-[#F59E0B]">
                <span className="size-2 rounded-full border border-dashed border-[#F59E0B] bg-[#F59E0B]" />
                Model Forecast (Dashed)
              </span>
            </div>
          </div>

          {/* Dynamic SVG Line Chart */}
          {loadingDetail ? (
            <div className="flex h-64 items-center justify-center text-xs text-[#64748B]">
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-[#1677D2] border-t-transparent" />
              Loading {selectedRecord?.employee_name || 'employee'} history...
            </div>
          ) : !chartTimeline.hasData ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-[#DFE8F2] p-6 text-center text-xs text-[#64748B]">
              <svg className="mb-2 size-8 text-[#94A3B8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="font-semibold text-[#172B4D]">No historical records or forecasts exist for this date range.</span>
              <span className="mt-1 text-[11px] text-[#94A3B8]">
                Adjust From/To dates or clear filters to view available historical data (2024–2025).
              </span>
            </div>
          ) : (
            <div className="relative pt-6 pb-2">
              {/* Forecast Period Starts Marker Box */}
              {chartTimeline.forecastStartIndex >= 0 && (
                <div
                  className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-lg border border-[#DFE8F2] bg-white px-2.5 py-1 text-center shadow-xs"
                  style={{
                    left: `${
                      45 +
                      (chartTimeline.forecastStartIndex / Math.max(chartTimeline.labels.length - 1, 1)) * (720 - 45)
                    }px`,
                  }}
                >
                  <div className="text-[10px] font-semibold text-[#64748B]">Forecast Period Starts</div>
                  <div className="text-[11px] font-bold text-[#172B4D]">{chartTimeline.forecastDateText}</div>
                </div>
              )}

              <svg viewBox="0 0 740 260" className="h-64 w-full overflow-visible" role="img" aria-label="Actual vs Forecast KPI Chart">
                {/* Horizontal Gridlines & Y-Axis Percentages */}
                {[100, 80, 60, 40, 20, 0].map((val) => {
                  const y = 30 + ((100 - val) / 100) * 190
                  return (
                    <g key={val}>
                      <line x1="45" y1={y} x2="720" y2={y} stroke="#EEF3F8" strokeWidth="1" />
                      <text x="35" y={y + 3.5} textAnchor="end" fontSize="10" fill="#94A3B8" fontWeight="500">
                        {val}
                      </text>
                    </g>
                  )
                })}

                {/* Y Axis Label */}
                <text transform="rotate(-90)" x="-135" y="14" textAnchor="middle" fontSize="10" fill="#94A3B8" fontWeight="600">
                  KPI (%)
                </text>

                {/* Vertical Dashed Separation Line at Forecast Start */}
                {chartTimeline.forecastStartIndex >= 0 && (
                  <line
                    x1={45 + (chartTimeline.forecastStartIndex / Math.max(chartTimeline.labels.length - 1, 1)) * (720 - 45)}
                    y1="30"
                    x2={45 + (chartTimeline.forecastStartIndex / Math.max(chartTimeline.labels.length - 1, 1)) * (720 - 45)}
                    y2="220"
                    stroke="#1677D2"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                )}

                {/* Actual KPI Solid Polyline (Blue) */}
                <polyline
                  fill="none"
                  stroke="#1677D2"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={chartTimeline.actualPoints
                    .map((val, i) => {
                      if (!Number.isFinite(val)) return null
                      const x = 45 + (i / Math.max(chartTimeline.labels.length - 1, 1)) * (720 - 45)
                      const y = 30 + ((100 - val) / 100) * 190
                      return `${x},${y}`
                    })
                    .filter(Boolean)
                    .join(' ')}
                />

                {/* Actual KPI Data Points */}
                {chartTimeline.actualPoints.map((val, i) => {
                  if (!Number.isFinite(val)) return null
                  const x = 45 + (i / Math.max(chartTimeline.labels.length - 1, 1)) * (720 - 45)
                  const y = 30 + ((100 - val) / 100) * 190
                  return (
                    <circle key={i} cx={x} cy={y} r="4.5" fill="#1677D2" stroke="#FFFFFF" strokeWidth="1.5">
                      <title>{chartTimeline.labels[i]} (Actual Observation): {val.toFixed(2)}%</title>
                    </circle>
                  )
                })}

                {/* Forecast KPI Dashed Polyline (Orange) */}
                <polyline
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="2.5"
                  strokeDasharray="5 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={chartTimeline.forecastPoints
                    .map((val, i) => {
                      if (!Number.isFinite(val)) return null
                      const x = 45 + (i / Math.max(chartTimeline.labels.length - 1, 1)) * (720 - 45)
                      const y = 30 + ((100 - val) / 100) * 190
                      return `${x},${y}`
                    })
                    .filter(Boolean)
                    .join(' ')}
                />

                {/* Forecast KPI Data Points */}
                {chartTimeline.forecastPoints.map((val, i) => {
                  if (!Number.isFinite(val)) return null
                  const x = 45 + (i / Math.max(chartTimeline.labels.length - 1, 1)) * (720 - 45)
                  const y = 30 + ((100 - val) / 100) * 190
                  return (
                    <circle key={`f-${i}`} cx={x} cy={y} r="4" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="1.5">
                      <title>{chartTimeline.labels[i]} (Model Prediction): {val.toFixed(2)}%</title>
                    </circle>
                  )
                })}

                {/* X Axis Labels */}
                {chartTimeline.labels.map((lbl, idx) => {
                  const x = 45 + (idx / Math.max(chartTimeline.labels.length - 1, 1)) * (720 - 45)
                  const raw = chartTimeline.rawDates[idx] || ''
                  const year = raw.split('-')[0] || ''
                  return (
                    <g key={idx}>
                      <text x={x} y="238" textAnchor="middle" fontSize="10" fill="#64748B" fontWeight="500">
                        {lbl}
                      </text>
                      <text x={x} y="250" textAnchor="middle" fontSize="9" fill="#94A3B8">
                        {year}
                      </text>
                    </g>
                  )
                })}
              </svg>

              <div className="mt-2 flex items-center justify-between border-t border-[#DFE8F2] pt-2 text-[11px] text-[#64748B]">
                <div>Historical (Actual Observations — Solid)</div>
                <div>Model Forecast (Gradient Boosting — Dashed)</div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Forecast Summary Panel (4 cols) */}
        <div className="flex flex-col justify-between rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-xs lg:col-span-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#DFE8F2] pb-3">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-[#1677D2]">
                  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-[#172B4D]">Forecast Summary</h3>
              </div>
              <span className="text-xs font-semibold text-emerald-600">↗</span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Forecasted KPI ({appliedFilters.timePeriod || timePeriod})</span>
                <span className="text-sm font-bold text-[#172B4D]">
                  {predictedKpi ? `${predictedKpi}%` : 'No prediction'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Current KPI</span>
                <span className="text-sm font-semibold text-[#172B4D]">
                  {currentKpi ? `${currentKpi}%` : 'Actual KPI not available'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Expected Change</span>
                <span className={`text-sm font-bold ${
                  Number(selectedRecord?.predicted_change) < 0 ? 'text-amber-600' : 'text-emerald-600'
                }`}>
                  {formattedChange || '—'}
                </span>
              </div>
            </div>

            <div className="space-y-2.5 rounded-xl border border-[#DFE8F2] bg-[#F8FAFC] p-3 text-xs">
              <div className="flex items-center gap-2 text-[#64748B]">
                <svg className="size-3.5 shrink-0 text-[#1677D2]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>Forecast Period:</span>
                <strong className="text-[#172B4D]">
                  {selectedRecord?.source_week || '—'} to {selectedRecord?.forecast_week || '—'}
                </strong>
              </div>
              <div className="flex items-center gap-2 text-[#64748B]">
                <svg className="size-3.5 shrink-0 text-[#1677D2]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                </svg>
                <span>Model:</span>
                <strong className="text-[#172B4D]">Gradient Boosting</strong>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-blue-50/70 p-2.5 text-[11px] leading-relaxed text-[#1677D2]">
              <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>Forecasts are estimates, not guaranteed outcomes. Actual observations are only recorded where real operational logs exist.</span>
            </div>
          </div>

          {/* Action Buttons: View Details & Export */}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setShowDetailModal(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1677D2] py-2.5 px-3 text-xs font-semibold text-white shadow-xs hover:bg-[#1262ab]"
            >
              <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View Forecast Details
            </button>
            <button
              type="button"
              onClick={handleExportReport}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#DFE8F2] bg-white py-2.5 px-3 text-xs font-semibold text-[#172B4D] hover:bg-[#F4F8FC]"
            >
              <svg className="size-3.5 text-[#64748B]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Report
            </button>
          </div>
        </div>
      </div>

      {/* ── 6, 7 & 8. Lower 3-Panel Row: Forecast Trends, Model Comparison, Forecast History */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Panel 6: Lower-left Panel: Forecast Trends (4 cols) */}
        <div className="rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-xs lg:col-span-4">
          <div className="mb-3 flex items-center justify-between border-b border-[#DFE8F2] pb-3">
            <div className="flex items-center gap-2">
              <svg className="size-4 text-[#1677D2]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              <h3 className="text-sm font-bold text-[#172B4D]">Forecast Trends</h3>
            </div>
            {/* Pill range buttons: 4 Weeks, 8 Weeks, 12 Weeks */}
            <div className="flex rounded-lg border border-[#DFE8F2] p-0.5 text-[10px] font-semibold">
              {['4 Weeks', '8 Weeks', '12 Weeks'].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setTrendRange(w)}
                  className={`rounded-md px-2 py-1 transition-all ${
                    trendRange === w
                      ? 'bg-[#1677D2] text-white shadow-xs'
                      : 'text-[#64748B] hover:text-[#172B4D]'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          <div className="relative pt-2">
            {trendData.labels.length === 0 ? (
              <div className="flex h-44 items-center justify-center text-xs text-[#64748B]">
                Insufficient trend data for this employee in the chosen range.
              </div>
            ) : (
              <svg viewBox="0 0 340 180" className="h-44 w-full overflow-visible" role="img" aria-label="Forecast Trends Chart">
                {[100, 80, 60, 40, 20, 0].map((val) => {
                  const y = 20 + ((100 - val) / 100) * 125
                  return (
                    <g key={val}>
                      <line x1="28" y1={y} x2="330" y2={y} stroke="#EEF3F8" strokeWidth="1" />
                      <text x="22" y={y + 3} textAnchor="end" fontSize="9" fill="#94A3B8">
                        {val}
                      </text>
                    </g>
                  )
                })}

                {/* Dynamic Actual Line */}
                <polyline
                  fill="none"
                  stroke="#1677D2"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={trendData.actual
                    .map((val, i) => {
                      const x = 45 + (i / Math.max(trendData.actual.length - 1, 1)) * 270
                      const y = 20 + ((100 - val) / 100) * 125
                      return `${x},${y}`
                    })
                    .join(' ')}
                />
                {trendData.actual.map((val, i) => {
                  const x = 45 + (i / Math.max(trendData.actual.length - 1, 1)) * 270
                  const y = 20 + ((100 - val) / 100) * 125
                  return (
                    <circle key={i} cx={x} cy={y} r="3" fill="#1677D2">
                      <title>{trendData.labels[i]} (Actual): {val.toFixed(1)}%</title>
                    </circle>
                  )
                })}

                {/* Dynamic Forecast Line */}
                <polyline
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={trendData.forecast
                    .map((val, i) => {
                      const x = 45 + (i / Math.max(trendData.forecast.length - 1, 1)) * 270
                      const y = 20 + ((100 - val) / 100) * 125
                      return `${x},${y}`
                    })
                    .join(' ')}
                />
                {trendData.forecast.map((val, i) => {
                  const x = 45 + (i / Math.max(trendData.forecast.length - 1, 1)) * 270
                  const y = 20 + ((100 - val) / 100) * 125
                  return (
                    <circle key={i} cx={x} cy={y} r="2.5" fill="#F59E0B">
                      <title>{trendData.labels[i]} (Forecast): {val.toFixed(1)}%</title>
                    </circle>
                  )
                })}

                {/* X Labels */}
                {trendData.labels.map((lbl, idx) => {
                  const x = 45 + (idx / Math.max(trendData.labels.length - 1, 1)) * 270
                  return (
                    <text key={idx} x={x} y="162" textAnchor="middle" fontSize="9" fill="#64748B">
                      {lbl}
                    </text>
                  )
                })}
              </svg>
            )}
          </div>

          <div className="mt-2 flex items-center justify-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5 text-[#172B4D]">
              <span className="size-2 rounded-full bg-[#1677D2]" />
              Actual
            </span>
            <span className="flex items-center gap-1.5 text-[#F59E0B]">
              <span className="size-2 rounded-full border border-dashed border-[#F59E0B] bg-[#F59E0B]" />
              Forecast
            </span>
          </div>
        </div>

        {/* Panel 7: Lower-middle Panel: Model Comparison (4 cols) */}
        <div className="flex flex-col justify-between rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-xs lg:col-span-4">
          <div>
            <div className="mb-3 flex items-center gap-2 border-b border-[#DFE8F2] pb-3">
              <svg className="size-4 text-[#1677D2]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              <h3 className="text-sm font-bold text-[#172B4D]">Model Comparison</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#DFE8F2] text-[11px] font-semibold text-[#64748B]">
                    <th className="py-2 pr-2">Model</th>
                    <th className="py-2 px-2 text-center">MAE ↓</th>
                    <th className="py-2 px-2 text-center">RMSE ↓</th>
                    <th className="py-2 px-2 text-center">R² ↑</th>
                    <th className="py-2 pl-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DFE8F2]">
                  {MODEL_COMPARISONS.map((m) => (
                    <tr key={m.model} className="hover:bg-[#F8FAFC]">
                      <td className="py-3 pr-2 font-bold text-[#172B4D]">{m.model}</td>
                      <td className="py-3 px-2 text-center font-medium text-[#64748B]">{m.mae.toFixed(2)}</td>
                      <td className="py-3 px-2 text-center font-medium text-[#64748B]">{m.rmse.toFixed(2)}</td>
                      <td className="py-3 px-2 text-center font-bold text-[#1677D2]">{m.r2.toFixed(2)}</td>
                      <td className="py-3 pl-2 text-right">
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            m.status === 'Best'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-1.5 text-[10px] text-[#64748B]">
            <svg className="size-3.5 shrink-0 text-[#1677D2]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Production model uses Gradient Boosting on rolling weekly logs.</span>
          </div>
        </div>

        {/* Panel 8: Lower-right Panel: Forecast History (4 cols) */}
        <div className="flex flex-col justify-between rounded-2xl border border-[#DFE8F2] bg-white p-5 shadow-xs lg:col-span-4">
          <div>
            <div className="mb-3 flex items-center justify-between border-b border-[#DFE8F2] pb-3">
              <div className="flex items-center gap-2">
                <svg className="size-4 text-[#1677D2]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 14 14" />
                </svg>
                <h3 className="text-sm font-bold text-[#172B4D]">Forecast History</h3>
              </div>
              <input
                type="text"
                placeholder="Search..."
                value={historySearch}
                onChange={(e) => {
                  setHistorySearch(e.target.value)
                  setHistoryPage(1)
                }}
                className="h-6 w-24 rounded-lg border border-[#DFE8F2] px-2 text-[10px] text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#DFE8F2] text-[11px] font-semibold text-[#64748B]">
                    <th className="py-2 pr-1.5">Date</th>
                    <th className="py-2 px-1.5">Employee</th>
                    <th className="py-2 px-1 text-center">Actual</th>
                    <th className="py-2 px-1 text-center">Predicted</th>
                    <th className="py-2 pl-1.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DFE8F2]">
                  {paginatedHistory.map((item) => (
                    <tr
                      key={`${item.employee_id}-${item.source_week}`}
                      onClick={() => setEmployeeId(item.employee_id)}
                      className={`cursor-pointer hover:bg-[#F8FAFC] ${
                        item.employee_id === employeeId ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <td className="py-2.5 pr-1.5 font-medium text-[#64748B]">{item.source_week}</td>
                      <td className="py-2.5 px-1.5 font-bold text-[#172B4D] truncate max-w-[90px]">
                        {item.employee_name || item.employee_id}
                      </td>
                      <td className="py-2.5 px-1 text-center font-medium text-[#172B4D]">
                        {item.latest_actual_kpi ? `${item.latest_actual_kpi}%` : 'Actual KPI not available'}
                      </td>
                      <td className="py-2.5 px-1 text-center font-bold text-[#1677D2]">
                        {item.predicted_kpi ? `${item.predicted_kpi}%` : '—'}
                      </td>
                      <td className="py-2.5 pl-1.5 text-right">
                        <span className={`inline-block rounded-md px-1.5 py-0.5 text-[9px] font-bold border ${
                          item.monitoring_category === 'Needs Review'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {item.monitoring_category === 'Needs Review' ? 'Review' : 'Completed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {paginatedHistory.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-4 text-center text-xs text-[#64748B]">
                        No forecast records found for this range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          <div className="mt-3 flex items-center justify-between border-t border-[#DFE8F2] pt-2 text-[10px] text-[#64748B]">
            <span>
              Showing {filteredHistory.length > 0 ? (historyPage - 1) * historyPageSize + 1 : 0}-
              {Math.min(historyPage * historyPageSize, filteredHistory.length)} of {filteredHistory.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={historyPage <= 1}
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                className="flex size-5 items-center justify-center rounded border border-[#DFE8F2] text-[#64748B] hover:bg-slate-50 disabled:opacity-40"
              >
                ‹
              </button>
              {Array.from({ length: Math.min(3, totalHistoryPages) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setHistoryPage(p)}
                  className={`flex size-5 items-center justify-center rounded text-[10px] font-bold ${
                    historyPage === p ? 'bg-[#1677D2] text-white' : 'text-[#64748B] hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                disabled={historyPage >= totalHistoryPages}
                onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                className="flex size-5 items-center justify-center rounded border border-[#DFE8F2] text-[#64748B] hover:bg-slate-50 disabled:opacity-40"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── View Forecast Details Modal (Supported Action) ────────────────────── */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-[#DFE8F2] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#DFE8F2] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#172B4D]">
                  {selectedRecord?.employee_name || 'Employee Forecast Details'}
                </h3>
                <p className="text-xs text-[#64748B]">
                  ID: {selectedRecord?.employee_id} · Post Office: {selectedRecord?.post_office}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-slate-100 hover:text-[#172B4D]"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-[#DFE8F2] bg-[#F8FAFC] p-3 text-center">
                  <div className="text-[10px] text-[#64748B]">Measured KPI</div>
                  <div className="mt-1 text-base font-bold text-[#172B4D]">{currentKpi ? `${currentKpi}%` : 'Actual KPI not available'}</div>
                </div>
                <div className="rounded-xl border border-[#DFE8F2] bg-blue-50 p-3 text-center">
                  <div className="text-[10px] text-[#1677D2]">Predicted KPI</div>
                  <div className="mt-1 text-base font-bold text-[#1677D2]">{predictedKpi ? `${predictedKpi}%` : '—'}</div>
                </div>
                <div className="rounded-xl border border-[#DFE8F2] bg-emerald-50 p-3 text-center">
                  <div className="text-[10px] text-emerald-700">Change</div>
                  <div className="mt-1 text-base font-bold text-emerald-700">{formattedChange || '—'}</div>
                </div>
                <div className="rounded-xl border border-[#DFE8F2] bg-slate-50 p-3 text-center">
                  <div className="text-[10px] text-[#64748B]">Category</div>
                  <div className="mt-1 text-xs font-bold text-[#172B4D]">{statusLabel}</div>
                </div>
              </div>

              {detail?.indicators && (
                <div className="rounded-xl border border-[#DFE8F2] p-3">
                  <div className="mb-2 font-bold text-[#172B4D]">Baseline Performance Indicators:</div>
                  <div className="grid grid-cols-2 gap-2 text-[#64748B] sm:grid-cols-3">
                    <div>Completion Rate: <strong className="text-[#172B4D]">{detail.indicators.completion_rate ?? '—'}%</strong></div>
                    <div>Accuracy Rate: <strong className="text-[#172B4D]">{detail.indicators.accuracy_rate ?? '—'}%</strong></div>
                    <div>Timeliness Rate: <strong className="text-[#172B4D]">{detail.indicators.timeliness_rate ?? '—'}%</strong></div>
                    <div>Assigned Mail: <strong className="text-[#172B4D]">{detail.indicators.assigned_work_count ?? '—'}</strong></div>
                    <div>Days Worked: <strong className="text-[#172B4D]">{detail.indicators.days_worked ?? '—'}</strong></div>
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-[#F8FAFC] p-3 text-[11px] leading-relaxed text-[#64748B]">
                <strong className="text-[#172B4D]">Supervisory Recommendation: </strong>
                {selectedRecord?.recommendation ||
                  'Continue routine monitoring and compare next week’s actual KPI with this forecast.'}
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="rounded-xl bg-[#1677D2] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1262ab]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
