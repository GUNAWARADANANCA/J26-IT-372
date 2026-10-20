/**
 * Pure formatting and calculation helpers for Employee Entitlements.
 */

export function formatLkr(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return '—'
  return `LKR ${Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function calculateServicePeriod(appointmentDateStr, yearsOfExp = null, asOf = new Date()) {
  if (appointmentDateStr) {
    const appt = new Date(`${appointmentDateStr}T00:00:00`)
    if (!Number.isNaN(appt.getTime())) {
      let totalMonths =
        (asOf.getFullYear() - appt.getFullYear()) * 12 + (asOf.getMonth() - appt.getMonth())
      if (asOf.getDate() < appt.getDate()) {
        totalMonths -= 1
      }
      totalMonths = Math.max(0, totalMonths)
      const years = Math.floor(totalMonths / 12)
      const months = totalMonths % 12
      const parts = []
      if (years > 0) parts.push(`${years} year${years !== 1 ? 's' : ''}`)
      if (months > 0 || years === 0) parts.push(`${months} month${months !== 1 ? 's' : ''}`)
      return {
        isAvailable: true,
        years,
        months,
        totalMonths,
        formatted: parts.join(', '),
      }
    }
  }

  if (yearsOfExp != null && !Number.isNaN(Number(yearsOfExp))) {
    const y = Math.max(0, parseInt(yearsOfExp, 10))
    return {
      isAvailable: true,
      years: y,
      months: 0,
      totalMonths: y * 12,
      formatted: `${y} year${y !== 1 ? 's' : ''}`,
    }
  }

  return {
    isAvailable: false,
    years: 0,
    months: 0,
    totalMonths: 0,
    formatted: 'Not available',
  }
}

export function calculateMonthlyTotals(records = [], basicSalary = 0) {
  let monthlyAllowances = 0
  let monthlyDeductions = 0
  const activeRecords = records.filter(
    (r) => r.approval_status === 'Approved' || r.approval_status === 'Active',
  )

  for (const r of activeRecords) {
    if (r.frequency === 'One-time') continue

    let amt = Number(r.amount) || 0
    if (r.amount_type === 'percentage') {
      const pct = Number(r.percentage_value) || 0
      amt = (Number(basicSalary) || 0) * (pct / 100)
    }

    if (r.frequency === 'Annual') amt /= 12
    else if (r.frequency === 'Quarterly') amt /= 3

    if (r.category === 'allowance') {
      monthlyAllowances += amt
    } else if (r.category === 'deduction') {
      monthlyDeductions += amt
    }
  }

  return {
    monthlyAllowances: Math.round(monthlyAllowances * 100) / 100,
    monthlyDeductions: Math.round(monthlyDeductions * 100) / 100,
    netImpact: Math.round((monthlyAllowances - monthlyDeductions) * 100) / 100,
  }
}

export function filterEntitlementRecords(
  records = [],
  { search = '', category = 'all', status = 'all', employeeId = '' } = {},
) {
  const term = String(search || '').trim().toLowerCase()

  return records.filter((r) => {
    if (employeeId && r.employee_id !== employeeId) return false
    if (category && category !== 'all' && r.category !== category) return false
    if (status && status !== 'all' && r.approval_status !== status) return false

    if (term) {
      const haystack = [
        r.employee_name,
        r.employee_id,
        r.entitlement_name,
        r.category,
        r.designation,
        r.post_office,
        r.approval_status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(term)) return false
    }

    return true
  })
}

export function calculateOtPay(basicSalary = 48000, divisor = 240, multiplier = 1.5, hours = 4) {
  const salary = Number(basicSalary) || 0
  const d = Number(divisor) || 240
  const m = Number(multiplier) || 1.5
  const h = Number(hours) || 0
  const hourlyRate = Math.round((salary / d) * 100) / 100
  const otPay = Math.round(hourlyRate * m * h * 100) / 100
  return {
    hourlyRate,
    otPay,
    formula: `(${salary.toLocaleString()} ÷ ${d}) × ${m} × ${h}`,
  }
}

export function calculateEpfEtfBreakdown(basicSalary = 48000, epfEmpPct = 8, epfEmprPct = 12, etfEmprPct = 3) {
  const salary = Number(basicSalary) || 0
  const epfEmp = Math.round(salary * (epfEmpPct / 100) * 100) / 100
  const epfEmpr = Math.round(salary * (epfEmprPct / 100) * 100) / 100
  const etfEmpr = Math.round(salary * (etfEmprPct / 100) * 100) / 100
  const totalEmpr = Math.round((epfEmpr + etfEmpr) * 100) / 100
  return {
    basicSalary: salary,
    epfEmployee: epfEmp,
    epfEmployer: epfEmpr,
    etfEmployer: etfEmpr,
    totalEmployerContribution: totalEmpr,
  }
}

