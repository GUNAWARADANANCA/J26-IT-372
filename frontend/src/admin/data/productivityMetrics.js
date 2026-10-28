/** Week and forecast helpers for the Productivity page. Numbers stay deterministic. */

export function mondayOf(value) {
  const day = value instanceof Date ? new Date(value.getTime()) : new Date(`${value}T00:00:00`)
  if (Number.isNaN(day.getTime())) return null
  const weekday = day.getDay()
  const shift = weekday === 0 ? -6 : 1 - weekday
  day.setDate(day.getDate() + shift)
  day.setHours(0, 0, 0, 0)
  return day
}

export function isoDate(day) {
  const month = String(day.getMonth() + 1).padStart(2, '0')
  const date = String(day.getDate()).padStart(2, '0')
  return `${day.getFullYear()}-${month}-${date}`
}

export function addDays(day, count) {
  const next = new Date(day.getTime())
  next.setDate(next.getDate() + count)
  return next
}

export function formatRange(startIso) {
  const start = new Date(`${startIso}T00:00:00`)
  const end = addDays(start, 6)
  const options = { month: 'short', day: 'numeric', year: 'numeric' }
  const left = start.toLocaleDateString('en-US', options)
  const right = end.toLocaleDateString('en-US', options)
  return `${left} - ${right}`
}

/** Monday-Sunday weeks for 2024-2026, newest first. A week belongs to the year of its Monday. */
export function reportingWeeks(now = new Date(), year = null) {
  const first = new Date(2024, 0, 1)
  const last = new Date(2026, 11, 28)
  const current = mondayOf(now)
  if (!current) return []
  const weeks = []
  for (let cursor = new Date(last.getTime()); cursor >= first; cursor = addDays(cursor, -7)) {
    const start = isoDate(cursor)
    const startYear = String(cursor.getFullYear())
    if (year && startYear !== String(year)) continue
    weeks.push({
      start,
      label: formatRange(start),
      current: start === isoDate(current),
      year: startYear,
    })
  }
  return weeks
}

export function defaultWeekForYear(year, now = new Date()) {
  const weeks = reportingWeeks(now, year)
  if (String(year) === '2026') {
    const current = weeks.find((week) => week.current)
    if (current) return current.start
  }
  return weeks[0]?.start || ''
}

export function changePct(current, previous) {
  if (current == null || previous == null || Number(previous) === 0) return null
  return ((Number(current) - Number(previous)) / Number(previous)) * 100
}

export function baselineForecast(latest, previous, older) {
  if (latest == null || previous == null || older == null) return null
  const raw = 0.5 * latest + 0.3 * previous + 0.2 * older + 0.3 * (latest - previous)
  return Math.min(99.9, Math.round(raw * 10) / 10)
}

export function errorMetrics(pairs) {
  const usable = pairs.filter((row) => row.actual != null && row.predicted != null)
  if (!usable.length) return { mae: null, rmse: null, mape: null, accuracy: null }
  const errors = usable.map((row) => Number(row.predicted) - Number(row.actual))
  const mae = errors.reduce((sum, error) => sum + Math.abs(error), 0) / errors.length
  const rmse = Math.sqrt(errors.reduce((sum, error) => sum + error * error, 0) / errors.length)
  const mape = usable.reduce((sum, row) => sum + Math.abs(row.predicted - row.actual) / Math.abs(row.actual), 0) / usable.length * 100
  return {
    mae: round1(mae),
    rmse: round1(rmse),
    mape: round1(mape),
    accuracy: round1(100 - mape),
  }
}

export function statusLabel(score) {
  if (score == null || Number.isNaN(Number(score))) return 'Needs attention'
  if (Number(score) >= 98.5) return 'Excellent'
  if (Number(score) >= 97) return 'Good'
  return 'Needs attention'
}

export function confidenceFromSigma(sigma) {
  const width = Math.max(0.4, Number(sigma) || 0.4)
  const percent = Math.min(95, Math.max(50, 92 - 22 * width))
  const label = percent >= 75 ? 'High Confidence' : percent >= 60 ? 'Moderate Confidence' : 'Low Confidence'
  return { sigma: round1(width), percent: round1(percent), label }
}

export function remarkFor(score, previousScore) {
  if (score == null) return 'Not yet logged'
  if (Number(score) < 97) return 'Slight delay'
  if (previousScore != null && Number(previousScore) - Number(score) > 0.5) return 'Slight delay'
  return 'On track'
}

function round1(value) {
  return Math.round(value * 10) / 10
}

function hashString(text) {
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function filterByYear(rows, year, dateKey = 'week') {
  if (!year || year === 'all') return rows
  return rows.filter((row) => String(row[dateKey] || '').startsWith(String(year)))
}

export function monthlyMeans(dailyRows) {
  const groups = new Map()
  for (const row of dailyRows) {
    const month = String(row.date || '').slice(0, 7)
    if (!month) continue
    const bucket = groups.get(month) || []
    bucket.push(Number(row.kpi))
    groups.set(month, bucket)
  }
  return [...groups.entries()].map(([month, scores]) => ({
    month,
    kpi: Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10,
    days: scores.length,
    record_type: 'actual',
  }))
}

export function archetype(employeeId, history) {
  const scores = (history || []).map((row) => Number(row.kpi)).filter((value) => !Number.isNaN(value))
  if (scores.length >= 3) {
    const first = scores[0]
    const last = scores[scores.length - 1]
    const swing = Math.max(...scores) - Math.min(...scores)
    if (last - first >= 3) return 'Rising Star'
    if (last - first <= -3) return 'Burnout Risk'
    if (swing >= 8) return 'Seasonal Peaker'
    if (swing <= 2) return 'Steady Performer'
    return 'Late-Week Fader'
  }
  const names = ['Steady Performer', 'Rising Star', 'Burnout Risk', 'Late-Week Fader', 'Seasonal Peaker']
  return names[hashString(String(employeeId)) % names.length]
}
