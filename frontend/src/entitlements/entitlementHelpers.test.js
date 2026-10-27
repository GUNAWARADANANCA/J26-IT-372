import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatLkr,
  calculateServicePeriod,
  calculateMonthlyTotals,
  filterEntitlementRecords,
  calculateOtPay,
  calculateEpfEtfBreakdown,
} from './entitlementHelpers.js'

test('formatLkr formats numbers correctly', () => {
  assert.equal(formatLkr(15000), 'LKR 15,000.00')
  assert.equal(formatLkr(0), 'LKR 0.00')
  assert.equal(formatLkr(null), '—')
})

test('calculateServicePeriod calculates service period accurately', () => {
  const asOf = new Date('2026-05-15T00:00:00')

  // 1. From appointment date 2018-03-01 to 2026-05-15 = 8 years, 2 months
  const p1 = calculateServicePeriod('2018-03-01', null, asOf)
  assert.equal(p1.isAvailable, true)
  assert.equal(p1.years, 8)
  assert.equal(p1.months, 2)
  assert.equal(p1.formatted, '8 years, 2 months')

  // 2. From years of experience
  const p2 = calculateServicePeriod(null, 5, asOf)
  assert.equal(p2.isAvailable, true)
  assert.equal(p2.years, 5)
  assert.equal(p2.formatted, '5 years')

  // 3. Missing info
  const p3 = calculateServicePeriod(null, null, asOf)
  assert.equal(p3.isAvailable, false)
  assert.equal(p3.formatted, 'Not available')
})

test('calculateMonthlyTotals aggregates active monthly allowances and deductions', () => {
  const records = [
    { category: 'allowance', amount: 15000, frequency: 'Monthly', approval_status: 'Approved' },
    { category: 'allowance', amount: 24000, frequency: 'Annual', approval_status: 'Approved' }, // 2000/mo
    { category: 'deduction', amount_type: 'percentage', percentage_value: 8, frequency: 'Monthly', approval_status: 'Approved' }, // 40000 * 8% = 3200
    { category: 'deduction', amount: 1200, frequency: 'Monthly', approval_status: 'Approved' },
    { category: 'allowance', amount: 5000, frequency: 'Monthly', approval_status: 'Pending' }, // Excluded (pending)
    { category: 'deduction', amount: 10000, frequency: 'One-time', approval_status: 'Approved' }, // Excluded (one-time)
  ]

  const totals = calculateMonthlyTotals(records, 40000)
  assert.equal(totals.monthlyAllowances, 17000) // 15000 + 2000
  assert.equal(totals.monthlyDeductions, 4400) // 3200 + 1200
  assert.equal(totals.netImpact, 12600) // 17000 - 4400
})

test('filterEntitlementRecords filters by search, category, and status', () => {
  const sample = [
    { employee_id: 'EMP1137', employee_name: 'Nuwan Fernando', category: 'allowance', approval_status: 'Approved' },
    { employee_id: 'EMP1138', employee_name: 'Sunil Perera', category: 'deduction', approval_status: 'Pending' },
    { employee_id: 'EMP1139', employee_name: 'Dinesh Silva', category: 'service_benefit', approval_status: 'Approved' },
  ]

  const byCat = filterEntitlementRecords(sample, { category: 'allowance' })
  assert.equal(byCat.length, 1)
  assert.equal(byCat[0].employee_id, 'EMP1137')

  const byStatus = filterEntitlementRecords(sample, { status: 'Pending' })
  assert.equal(byStatus.length, 1)
  assert.equal(byStatus[0].employee_id, 'EMP1138')

  const bySearch = filterEntitlementRecords(sample, { search: 'Dinesh' })
  assert.equal(bySearch.length, 1)
  assert.equal(bySearch[0].employee_id, 'EMP1139')
})

test('calculateOtPay computes hourly rate and statutory overtime pay', () => {
  // (48,000 / 240) = 200/hr, 200 * 1.5 * 4 = 1200
  const result = calculateOtPay(48000, 240, 1.5, 4)
  assert.equal(result.hourlyRate, 200)
  assert.equal(result.otPay, 1200)
  assert.equal(result.formula, '(48,000 ÷ 240) × 1.5 × 4')
})

test('calculateEpfEtfBreakdown calculates statutory 8%, 12%, 3% shares', () => {
  const result = calculateEpfEtfBreakdown(48000, 8, 12, 3)
  assert.equal(result.basicSalary, 48000)
  assert.equal(result.epfEmployee, 3840)
  assert.equal(result.epfEmployer, 5760)
  assert.equal(result.etfEmployer, 1440)
  assert.equal(result.totalEmployerContribution, 7200)
})

