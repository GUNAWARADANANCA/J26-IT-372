import assert from 'node:assert/strict'
import test from 'node:test'
import {
  baselineForecast,
  changePct,
  confidenceFromSigma,
  defaultWeekForYear,
  errorMetrics,
  filterByYear,
  monthlyMeans,
  reportingWeeks,
  statusLabel,
} from './productivityMetrics.js'

test('weeks for 2024-2026 are Monday to Sunday, newest first, with no gaps', () => {
  const weeks = reportingWeeks(new Date(2026, 9, 15))
  assert.equal(weeks[0].start, '2026-12-28')
  assert.equal(weeks[0].label, 'Dec 28, 2026 - Jan 3, 2027')
  assert.equal(weeks.at(-1).start, '2024-01-01')
  const starts = weeks.map((week) => week.start)
  assert.equal(new Set(starts).size, starts.length)
  for (let index = 1; index < starts.length; index += 1) {
    const newer = new Date(`${starts[index - 1]}T00:00:00`)
    const older = new Date(`${starts[index]}T00:00:00`)
    assert.equal((newer - older) / 86400000, 7)
  }
  const year2024 = reportingWeeks(new Date(2026, 9, 15), '2024')
  assert.ok(year2024.every((week) => week.year === '2024'))
  assert.equal(year2024[0].start, '2024-12-30')
  assert.equal(year2024[0].label, 'Dec 30, 2024 - Jan 5, 2025')
  assert.equal(reportingWeeks(new Date(2026, 9, 15), '2025').find((week) => week.start === '2025-12-29').label, 'Dec 29, 2025 - Jan 4, 2026')
  const leap = reportingWeeks(new Date(2026, 9, 15), '2024').find((week) => week.start === '2024-02-26')
  assert.equal(leap.label, 'Feb 26, 2024 - Mar 3, 2024')
  assert.equal(defaultWeekForYear('2026', new Date(2026, 9, 15)), '2026-10-12')
  assert.equal(defaultWeekForYear('2025', new Date(2026, 9, 15)), '2025-12-29')
})

test('change percent is one shared value', () => {
  assert.equal(changePct(80, 70), (80 - 70) / 70 * 100)
  assert.equal(changePct(80, 0), null)
})

test('baseline forecast is capped', () => {
  assert.equal(baselineForecast(100, 100, 100), 99.9)
  assert.equal(baselineForecast(70, 60, 50), 0.5 * 70 + 0.3 * 60 + 0.2 * 50 + 0.3 * (70 - 60))
})

test('error metrics use only paired rows', () => {
  const metrics = errorMetrics([
    { actual: 80, predicted: 82 },
    { actual: 70, predicted: 70 },
    { actual: null, predicted: 90 },
  ])
  assert.equal(metrics.mae, 1)
  assert.equal(metrics.rmse, Math.round(Math.sqrt(2) * 10) / 10)
})

test('status thresholds', () => {
  assert.equal(statusLabel(99), 'Excellent')
  assert.equal(statusLabel(97.4), 'Good')
  assert.equal(statusLabel(72), 'Needs attention')
})

test('year filter keeps only that year and monthly means use actual days', () => {
  const rows = [
    { week: '2024-01-01', kpi: 70 },
    { week: '2025-01-06', kpi: 80 },
    { week: '2026-10-12', kpi: 75 },
  ]
  assert.deepEqual(filterByYear(rows, '2025').map((row) => row.week), ['2025-01-06'])
  assert.equal(filterByYear(rows, 'all').length, 3)
  const months = monthlyMeans([
    { date: '2026-10-12', kpi: 70 },
    { date: '2026-10-13', kpi: 80 },
    { date: '2026-11-02', kpi: 90 },
  ])
  assert.equal(months[0].month, '2026-10')
  assert.equal(months[0].kpi, 75)
  assert.equal(months[0].record_type, 'actual')
})

test('confidence uses sigma and stays inside 50 to 95', () => {
  const narrow = confidenceFromSigma(0.1)
  assert.equal(narrow.sigma, 0.4)
  assert.ok(narrow.percent <= 95)
  const wide = confidenceFromSigma(3)
  assert.ok(wide.percent >= 50)
  assert.equal(wide.label, 'Low Confidence')
})
