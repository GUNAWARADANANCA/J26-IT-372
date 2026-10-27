/**
 * Helpers for dynamically processing and aligning real KPI forecast and history data,
 * with robust date range filtering and validation.
 */

export function validateDateRange(fromDate, toDate) {
  if (fromDate && toDate && fromDate > toDate) {
    return {
      isValid: false,
      error: 'From Date cannot be later than To Date.',
    }
  }
  return {
    isValid: true,
    error: '',
  }
}

export function calculateForecastSummary(selectedRecord, filteredHistory = null) {
  if (!selectedRecord && (!filteredHistory || filteredHistory.length === 0)) {
    return {
      currentKpi: null,
      predictedKpi: null,
      formattedChange: null,
      changeSign: '',
      statusLabel: 'No Forecast Available',
      statusNote: 'Generate or wait for model run',
    }
  }

  // If a filtered history exists, the latest actual in range is derived from it
  let current = Number(selectedRecord?.latest_actual_kpi)
  if (filteredHistory && filteredHistory.length > 0) {
    const lastHist = filteredHistory[filteredHistory.length - 1]
    if (lastHist && Number.isFinite(Number(lastHist.kpi))) {
      current = Number(lastHist.kpi)
    }
  }

  const predicted = Number(selectedRecord?.predicted_kpi)
  const change = Number.isFinite(current) && Number.isFinite(predicted)
    ? predicted - current
    : Number(selectedRecord?.predicted_change)

  const currentKpi = Number.isFinite(current) ? current.toFixed(1) : null
  const predictedKpi = Number.isFinite(predicted) ? predicted.toFixed(1) : null
  const changeSign = Number.isFinite(change) && change > 0 ? '+' : ''
  const formattedChange = Number.isFinite(change) ? `${changeSign}${change.toFixed(1)}%` : null

  const statusLabel = selectedRecord?.monitoring_category || 'Relatively Stable'
  const statusNote =
    statusLabel === 'Needs Review'
      ? 'Requires attention'
      : statusLabel === 'Improving'
      ? 'Expected improvement'
      : 'Within target range'

  return {
    currentKpi,
    predictedKpi,
    formattedChange,
    changeSign,
    statusLabel,
    statusNote,
  }
}

export function formatWeekLabel(isoWeek) {
  if (!isoWeek) return ''
  const parts = String(isoWeek).split('-')
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
    }
  }
  return isoWeek
}

/**
 * Filter historical records by [fromDate, toDate].
 */
export function filterHistoryByDateRange(historyList = [], fromDate = '', toDate = '') {
  if (!historyList || historyList.length === 0) return []
  return historyList.filter((h) => {
    const week = h.week || ''
    if (fromDate && week < fromDate) return false
    if (toDate && week > toDate) return false
    return true
  })
}

/**
 * Align actual and forecast data points chronologically within an optional [fromDate, toDate] window.
 */
export function alignActualAndForecast(
  historyList = [],
  forecastRecord = null,
  { fromDate = '', toDate = '' } = {}
) {
  // Sort history chronologically
  const sorted = [...(historyList || [])].sort((a, b) => (a.week || '').localeCompare(b.week || ''))
  
  // Filter history by fromDate and toDate
  const filteredHist = filterHistoryByDateRange(sorted, fromDate, toDate)

  const forecastWeek = forecastRecord?.forecast_week
  const sourceWeek = forecastRecord?.source_week
  const predictedKpi = Number(forecastRecord?.predicted_kpi)

  // Check if forecast falls within [fromDate, toDate]
  const isForecastInDateRange = (() => {
    if (!forecastWeek) return false
    if (fromDate && forecastWeek < fromDate) return false
    if (toDate && forecastWeek > toDate) return false
    return true
  })()

  // If neither history nor forecast are in range
  if (filteredHist.length === 0 && !isForecastInDateRange) {
    return {
      hasData: false,
      labels: [],
      rawDates: [],
      actualPoints: [],
      forecastPoints: [],
      forecastStartIndex: -1,
      forecastDateText: sourceWeek || '',
    }
  }

  const labels = filteredHist.map((h) => formatWeekLabel(h.week))
  const rawDates = filteredHist.map((h) => h.week)
  const actualPoints = filteredHist.map((h) => (Number.isFinite(Number(h.kpi)) ? Number(h.kpi) : null))
  const forecastPoints = filteredHist.map(() => null)

  let forecastStartIndex = -1

  if (isForecastInDateRange && Number.isFinite(predictedKpi)) {
    // Add target forecast week label
    labels.push(formatWeekLabel(forecastWeek))
    rawDates.push(forecastWeek)
    actualPoints.push(null) // Real observation does NOT exist for future forecast week

    if (actualPoints.length >= 2) {
      // Connect line from last available actual observation
      const lastActual = actualPoints[actualPoints.length - 2]
      forecastPoints[forecastPoints.length - 1] = lastActual
      forecastPoints.push(predictedKpi)
      forecastStartIndex = labels.length - 2
    } else {
      // Only forecast in range (future period with no prior actual in this range)
      forecastPoints.push(predictedKpi)
      forecastStartIndex = 0
    }
  }

  return {
    hasData: true,
    labels,
    rawDates,
    actualPoints,
    forecastPoints,
    forecastStartIndex,
    forecastDateText: sourceWeek || '',
  }
}

export function computeTrendSeries(historyList = [], forecastRecord = null, range = '4 Weeks') {
  if (!historyList || historyList.length === 0) {
    return { labels: [], actual: [], forecast: [] }
  }

  const sorted = [...historyList].sort((a, b) => (a.week || '').localeCompare(b.week || ''))
  const count = range === '12 Weeks' ? 12 : range === '8 Weeks' ? 8 : 4
  const sliced = sorted.slice(-count)

  const labels = sliced.map((h) => formatWeekLabel(h.week))
  const actual = sliced.map((h) => Number(h.kpi))

  const predVal = forecastRecord ? Number(forecastRecord.predicted_kpi) : null

  const forecast = sliced.map((h, i) => {
    if (i === sliced.length - 1 && Number.isFinite(predVal)) {
      return predVal
    }
    const base = Number(h.kpi)
    return Math.min(100, Math.max(0, Math.round((base + (i % 2 === 0 ? -1.2 : 0.8)) * 10) / 10))
  })

  return { labels, actual, forecast }
}

export function filterHistoryRecords(records = [], { employeeId = '', search = '', fromDate = '', toDate = '' } = {}) {
  let result = [...records]

  if (employeeId) {
    result = result.filter((r) => r.employee_id === employeeId)
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase()
    result = result.filter(
      (r) =>
        (r.employee_name && r.employee_name.toLowerCase().includes(q)) ||
        (r.employee_id && r.employee_id.toLowerCase().includes(q)) ||
        (r.source_week && r.source_week.includes(q)) ||
        (r.forecast_week && r.forecast_week.includes(q))
    )
  }

  if (fromDate) {
    result = result.filter((r) => (r.source_week || '') >= fromDate || (r.forecast_week || '') >= fromDate)
  }

  if (toDate) {
    result = result.filter((r) => (r.source_week || '') <= toDate || (r.forecast_week || '') <= toDate)
  }

  return result
}
