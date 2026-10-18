import assert from 'node:assert/strict'
import test from 'node:test'
import {
  alignActualAndForecast,
  filterHistoryRecords,
  filterHistoryByDateRange,
  computeTrendSeries,
  calculateForecastSummary,
  validateDateRange,
} from './forecastDataHelpers.js'

test('validateDateRange detects when From Date is later than To Date', () => {
  const invalid = validateDateRange('2025-02-01', '2025-01-01')
  assert.equal(invalid.isValid, false)
  assert.equal(invalid.error, 'From Date cannot be later than To Date.')

  const valid = validateDateRange('2025-01-01', '2025-02-01')
  assert.equal(valid.isValid, true)
  assert.equal(valid.error, '')
})

test('calculateForecastSummary calculates metrics for selected employee record', () => {
  const record = {
    employee_id: 'EMP1137',
    employee_name: 'Nuwan Priyantha Fernando',
    latest_actual_kpi: 94.65,
    predicted_kpi: 91.36,
    predicted_change: -3.29,
    monitoring_category: 'Needs Review',
  }

  const summary = calculateForecastSummary(record)
  assert.equal(summary.currentKpi, '94.7')
  assert.equal(summary.predictedKpi, '91.4')
  assert.equal(summary.formattedChange, '-3.3%')
  assert.equal(summary.statusLabel, 'Needs Review')
})

test('calculateForecastSummary adjusts latest actual when filtered by historical date range', () => {
  const record = {
    employee_id: 'EMP1137',
    latest_actual_kpi: 94.65,
    predicted_kpi: 91.36,
  }
  const filteredHistory = [
    { week: '2025-01-06', kpi: 90.46 },
    { week: '2025-01-13', kpi: 94.08 },
  ]

  const summary = calculateForecastSummary(record, filteredHistory)
  assert.equal(summary.currentKpi, '94.1') // Uses latest in filtered range
  assert.equal(summary.predictedKpi, '91.4')
})

test('filterHistoryByDateRange filters history precisely', () => {
  const history = [
    { week: '2024-12-30', kpi: 90.88 },
    { week: '2025-01-06', kpi: 90.46 },
    { week: '2025-01-13', kpi: 94.08 },
    { week: '2025-01-20', kpi: 90.95 },
    { week: '2025-01-27', kpi: 94.65 },
  ]

  const filtered = filterHistoryByDateRange(history, '2025-01-01', '2025-01-15')
  assert.equal(filtered.length, 2)
  assert.equal(filtered[0].week, '2025-01-06')
  assert.equal(filtered[1].week, '2025-01-13')
})

test('alignActualAndForecast respects date filters and keeps actual vs prediction separated', () => {
  const history = [
    { week: '2024-12-30', kpi: 90.88 },
    { week: '2025-01-06', kpi: 90.46 },
    { week: '2025-01-13', kpi: 94.08 },
    { week: '2025-01-20', kpi: 90.95 },
    { week: '2025-01-27', kpi: 94.65 },
  ]
  const forecastRecord = {
    employee_id: 'EMP1137',
    source_week: '2025-01-27',
    forecast_week: '2025-02-03',
    latest_actual_kpi: 94.65,
    predicted_kpi: 91.36,
  }

  // Range covering all history and forecast
  const timelineAll = alignActualAndForecast(history, forecastRecord, { fromDate: '2024-12-01', toDate: '2025-02-15' })
  assert.equal(timelineAll.hasData, true)
  assert.equal(timelineAll.labels.length, 6)
  assert.equal(timelineAll.actualPoints[5], null) // Target forecast week has no actual
  assert.equal(timelineAll.forecastPoints[5], 91.36)

  // Range covering only 2024
  const timeline2024 = alignActualAndForecast(history, forecastRecord, { fromDate: '2024-01-01', toDate: '2024-12-31' })
  assert.equal(timeline2024.hasData, true)
  assert.equal(timeline2024.labels.length, 1)
  assert.equal(timeline2024.actualPoints[0], 90.88)
  assert.equal(timeline2024.forecastPoints[0], null) // Forecast week 2025-02-03 is outside 2024 range

  // Range with no data
  const timelineEmpty = alignActualAndForecast(history, forecastRecord, { fromDate: '2026-01-01', toDate: '2026-06-01' })
  assert.equal(timelineEmpty.hasData, false)
  assert.equal(timelineEmpty.labels.length, 0)
})

test('computeTrendSeries slices historical records according to 4, 8, or 12 weeks', () => {
  const history = [
    { week: '2024-12-30', kpi: 90.88 },
    { week: '2025-01-06', kpi: 90.46 },
    { week: '2025-01-13', kpi: 94.08 },
    { week: '2025-01-20', kpi: 90.95 },
    { week: '2025-01-27', kpi: 94.65 },
  ]
  const forecastRecord = {
    source_week: '2025-01-27',
    predicted_kpi: 91.36,
  }

  const trend4 = computeTrendSeries(history, forecastRecord, '4 Weeks')
  assert.equal(trend4.labels.length, 4)
  assert.equal(trend4.actual.length, 4)
  assert.equal(trend4.actual[3], 94.65)
})

test('filterHistoryRecords filters accurately by selected employee, search, and date range', () => {
  const records = [
    { employee_id: 'EMP1137', employee_name: 'Nuwan Priyantha Fernando', source_week: '2025-01-27', forecast_week: '2025-02-03', predicted_kpi: 91.36 },
    { employee_id: 'EMP1138', employee_name: 'Sunil Chaminda Perera', source_week: '2025-01-27', forecast_week: '2025-02-03', predicted_kpi: 85.16 },
  ]

  const forEmp1137 = filterHistoryRecords(records, { employeeId: 'EMP1137' })
  assert.equal(forEmp1137.length, 1)

  const dateFiltered = filterHistoryRecords(records, { fromDate: '2025-01-25', toDate: '2025-01-30' })
  assert.equal(dateFiltered.length, 2)
})
