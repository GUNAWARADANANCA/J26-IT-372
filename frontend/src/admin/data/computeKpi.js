/** KPI helpers — rates/scores computed on save so forms match Excel shape. */

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

function pct(num, den) {
  if (!den || den <= 0) return 0
  return Math.round((num / den) * 10000) / 100
}

export function dayOfWeekFromDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return DAY_NAMES[d.getDay()]
}

/**
 * Average of completion / accuracy / timeliness rates.
 * Categories mirror the Excel Performance_Category bands.
 */
export function performanceCategory(score) {
  if (score == null || Number.isNaN(score)) return null
  if (score >= 95) return 'Outstanding'
  if (score >= 85) return 'High Performing'
  if (score >= 70) return 'Satisfactory'
  if (score >= 50) return 'Needs Improvement'
  return 'Underperforming'
}

export function computeDailyKpiFields(doc) {
  const assigned = Number(doc.assigned_work_count) || 0
  const completed = Number(doc.completed_work_count) || 0
  const correct = Number(doc.correct_work_count) || 0
  const incorrect = Number(doc.incorrect_work_count) || 0
  const onTime = Number(doc.on_time_work_count) || 0
  const late = Number(doc.late_work_count) || 0

  const uncompleted = Math.max(assigned - completed, 0)
  const completion_rate = pct(completed, assigned)
  const accuracy_rate = pct(correct, completed || correct + incorrect)
  const timeliness_rate = pct(onTime, completed || onTime + late)

  const kpi_score =
    Math.round(((completion_rate + accuracy_rate + timeliness_rate) / 3) * 100) /
    100

  return {
    ...doc,
    day_of_week: dayOfWeekFromDate(doc.date) ?? doc.day_of_week ?? null,
    uncompleted_work_count: uncompleted,
    completion_rate,
    accuracy_rate,
    timeliness_rate,
    kpi_score,
    performance_category: performanceCategory(kpi_score),
  }
}

export function monthsSince(dateStr, asOf = new Date()) {
  if (!dateStr) return null
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const months =
    (asOf.getFullYear() - d.getFullYear()) * 12 +
    (asOf.getMonth() - d.getMonth()) +
    (asOf.getDate() - d.getDate()) / 30
  return Math.round(months * 10) / 10
}

export function computeEmployeeFields(doc) {
  return {
    ...doc,
    months_since_last_promotion: monthsSince(doc.last_promotion_date),
  }
}
