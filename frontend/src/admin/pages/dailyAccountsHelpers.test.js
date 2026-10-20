import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  autoDetectColumnMapping,
  calculateCashReconciliation,
  calculateCompletenessPercent,
  computeSlicePercentages,
  filterValidationIssues,
  formatLkrCurrency,
  validateColumnMapping,
} from './dailyAccountsHelpers.js'

describe('dailyAccountsHelpers', () => {
  it('formats positive and negative amounts correctly as Sri Lankan Rupees', () => {
    assert.equal(formatLkrCurrency(1245320), 'LKR 1,245,320')
    assert.equal(formatLkrCurrency(523680), 'LKR 523,680')
    assert.equal(formatLkrCurrency(-840), 'LKR -840')
    assert.equal(formatLkrCurrency(0), 'LKR 0')
  })

  it('calculates cash reconciliation and detects drawer variance accurately', () => {
    // Exact figures from screenshot
    const result = calculateCashReconciliation(125000, 645320, 432780, 98450, 238250)
    assert.equal(result.openingCash, 125000)
    assert.equal(result.expectedClosing, 239090)
    assert.equal(result.countedClosing, 238250)
    assert.equal(result.variance, -840)
    assert.equal(result.isBalanced, false)
    assert.equal(result.status, 'Needs review')

    // Balanced case
    const balanced = calculateCashReconciliation(100000, 50000, 30000, 10000, 110000)
    assert.equal(balanced.expectedClosing, 110000)
    assert.equal(balanced.variance, 0)
    assert.equal(balanced.isBalanced, true)
    assert.equal(balanced.status, 'Balanced')
  })

  it('calculates completeness percentage correctly', () => {
    assert.equal(calculateCompletenessPercent(1152, 1254), 92)
    assert.equal(calculateCompletenessPercent(0, 100), 0)
    assert.equal(calculateCompletenessPercent(100, 100), 100)
    assert.equal(calculateCompletenessPercent(50, 0), 0)
  })

  it('filters validation issues by severity, status, and search query', () => {
    const issues = [
      { id: 'ISS-1', severity: 'Error', status: 'Pending', message: 'Missing amount', column_name: 'Amount' },
      { id: 'ISS-2', severity: 'Warning', status: 'Resolved', message: 'Duplicate reference', column_name: 'Ref' },
      { id: 'ISS-3', severity: 'Error', status: 'Resolved', message: 'Missing date', column_name: 'Date' },
    ]

    const errorsOnly = filterValidationIssues(issues, { severity: 'Error' })
    assert.equal(errorsOnly.length, 2)

    const pendingOnly = filterValidationIssues(issues, { status: 'Pending' })
    assert.equal(pendingOnly.length, 1)
    assert.equal(pendingOnly[0].id, 'ISS-1')

    const searchRef = filterValidationIssues(issues, { search: 'duplicate' })
    assert.equal(searchRef.length, 1)
    assert.equal(searchRef[0].id, 'ISS-2')
  })

  it('computes accurate percentage distribution for revenue slices', () => {
    const slices = [
      { name: 'CEB', amount: 200 },
      { name: 'LECO', amount: 300 },
      { name: 'Water', amount: 500 },
    ]
    const computed = computeSlicePercentages(slices)
    assert.equal(computed[0].percent, 20.0)
    assert.equal(computed[1].percent, 30.0)
    assert.equal(computed[2].percent, 50.0)
  })

  it('validates column mapping requirements for date, category, and amount', () => {
    // Valid complete mapping
    const valid = validateColumnMapping({
      date: 'Transaction Date',
      category: 'Service Head',
      amount: 'Net LKR',
      reference_no: 'Receipt No',
    })
    assert.equal(valid.isValid, true)
    assert.equal(valid.missing.length, 0)

    // Missing amount
    const missingAmount = validateColumnMapping({
      date: 'Transaction Date',
      category: 'Service Head',
    })
    assert.equal(missingAmount.isValid, false)
    assert.deepEqual(missingAmount.missing, ['amount'])

    // Null or invalid mapping
    const nullMapping = validateColumnMapping(null)
    assert.equal(nullMapping.isValid, false)
    assert.equal(nullMapping.missing.length, 3)
  })

  it('auto-detects canonical accounting columns from realistic spreadsheet headers', () => {
    const headers = ['Trans Date', 'Particulars', 'Amount (LKR)', 'No of Bills', 'Voucher ID', 'Biller Name', 'Postal Fee', 'Payee Name', 'Sender Name', 'Post Office', 'Payment Mode']
    const detected = autoDetectColumnMapping(headers)

    assert.equal(detected.date, 'Trans Date')
    assert.equal(detected.category, 'Particulars')
    assert.equal(detected.amount, 'Amount (LKR)')
    assert.equal(detected.count, 'No of Bills')
    assert.equal(detected.reference_no, 'Voucher ID')
    assert.equal(detected.provider, 'Biller Name')
    assert.equal(detected.commission, 'Postal Fee')
    assert.equal(detected.recipient, 'Payee Name')
    assert.equal(detected.remitter, 'Sender Name')
    assert.equal(detected.office_id, 'Post Office')
    assert.equal(detected.payment_method, 'Payment Mode')
  })
})

