/**
 * Pure helper functions for the KPI Simulator.
 */

export const SCENARIO_PRESETS = [
  {
    id: 'workload-20',
    label: 'Increase Workload by 20%',
    workloadAdj: 20,
    extraHours: 0,
    absenceRate: 0,
  },
  {
    id: 'workload-10',
    label: 'Increase Workload by 10%',
    workloadAdj: 10,
    extraHours: 0,
    absenceRate: 0,
  },
  {
    id: 'workload-minus-10',
    label: 'Decrease Workload by 10%',
    workloadAdj: -10,
    extraHours: 0,
    absenceRate: 0,
  },
  {
    id: 'prod-5',
    label: 'Improve Productivity by 5%',
    workloadAdj: 0,
    extraHours: 0,
    absenceRate: 0,
  },
  {
    id: 'prod-10',
    label: 'Improve Productivity by 10%',
    workloadAdj: 0,
    extraHours: 0,
    absenceRate: 0,
  },
  {
    id: 'extra-hours',
    label: 'Increase Working Hours',
    workloadAdj: 0,
    extraHours: 5,
    absenceRate: 0,
  },
  {
    id: 'absence-plus',
    label: 'Increase Absence Rate',
    workloadAdj: 0,
    extraHours: 0,
    absenceRate: 15,
  },
  {
    id: 'absence-minus',
    label: 'Reduce Absence Rate',
    workloadAdj: 0,
    extraHours: 0,
    absenceRate: 0,
  },
  {
    id: 'custom',
    label: 'Custom Scenario',
    workloadAdj: 20,
    extraHours: 5,
    absenceRate: 0,
  },
]

export const PERIOD_OPTIONS = [
  { value: 1, label: 'Next 1 week' },
  { value: 2, label: 'Next 2 weeks' },
  { value: 4, label: 'Next 4 weeks' },
  { value: 8, label: 'Next 8 weeks' },
]

export function formatSignedPercent(value) {
  if (value == null || Number.isNaN(Number(value))) return '0%'
  const num = Number(value)
  if (num > 0) return `+${num}%`
  return `${num}%`
}

export function formatSignedHours(value) {
  if (value == null || Number.isNaN(Number(value))) return '0 hours'
  const num = Number(value)
  if (num > 0) return `+${num} hours`
  return `${num} hours`
}

export function formatChangeBadge(diff) {
  const num = Number(diff) || 0
  if (num > 0) {
    return {
      text: `+${num.toFixed(1)}%`,
      symbol: '▲',
      direction: 'positive',
      bgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    }
  }
  if (num < 0) {
    return {
      text: `${num.toFixed(1)}%`,
      symbol: '▼',
      direction: 'negative',
      bgClass: 'bg-rose-50 text-rose-700 border-rose-200',
    }
  }
  return {
    text: '0.0%',
    symbol: '•',
    direction: 'neutral',
    bgClass: 'bg-slate-100 text-slate-700 border-slate-200',
  }
}

export function validateSimulationParameters({
  employeeId,
  workloadAdj,
  extraHours,
  absenceRate,
}) {
  const errors = []
  if (!employeeId) {
    errors.push('Please select an employee to simulate.')
  }
  const w = Number(workloadAdj)
  if (Number.isNaN(w) || w < -50 || w > 50) {
    errors.push('Workload adjustment must be between -50% and +50%.')
  }
  const h = Number(extraHours)
  if (Number.isNaN(h) || h < 0 || h > 20) {
    errors.push('Extra working hours must be between 0 and 20 hours/week.')
  }
  const a = Number(absenceRate)
  if (Number.isNaN(a) || a < 0 || a > 50) {
    errors.push('Absence rate must be between 0% and 50%.')
  }
  return {
    isValid: errors.length === 0,
    errors,
  }
}
