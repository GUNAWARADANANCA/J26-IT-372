/**
 * Helper functions for Post Office Daily Accounts Monitoring & Analytics.
 */

/**
 * Format numeric amount into standard Sri Lankan Rupee representation (e.g. "LKR 1,245,320" or "LKR -840").
 */
export function formatLkrCurrency(amount) {
  const num = Number(amount) || 0
  const isNegative = num < 0
  const absFormatted = Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
  return isNegative ? `LKR -${absFormatted}` : `LKR ${absFormatted}`
}

/**
 * Compute cash reconciliation balances and variance according to verified accounting formulas.
 * Expected Closing Cash = Opening Cash + Cash Inflows - Cash Outflows - Office Expenses
 * Variance = Counted Closing Cash - Expected Closing Cash
 */
export function calculateCashReconciliation(openingCash, inflows, outflows, expenses, countedCash) {
  const o = Number(openingCash) || 0
  const i = Number(inflows) || 0
  const out = Number(outflows) || 0
  const exp = Number(expenses) || 0
  const c = Number(countedCash) || 0

  const expectedClosing = Math.round((o + i - out - exp) * 100) / 100
  const variance = Math.round((c - expectedClosing) * 100) / 100
  const isBalanced = Math.abs(variance) < 0.01

  return {
    openingCash: o,
    inflows: i,
    outflows: out,
    expenses: exp,
    expectedClosing,
    countedClosing: c,
    variance,
    isBalanced,
    status: isBalanced ? 'Balanced' : 'Needs review',
  }
}

/**
 * Calculate completeness percentage from count and total transactions.
 */
export function calculateCompletenessPercent(completeCount, totalCount) {
  const total = Number(totalCount) || 0
  if (total <= 0) return 0
  const comp = Number(completeCount) || 0
  return Math.min(100, Math.max(0, Math.round((comp / total) * 100)))
}

/**
 * Filter validation issues by severity, resolution status, and text search.
 */
export function filterValidationIssues(issues, filters = {}) {
  if (!Array.isArray(issues)) return []
  const { severity, status, search } = filters
  const sTerm = (search || '').trim().toLowerCase()

  return issues.filter((item) => {
    if (severity && severity !== 'all' && item.severity?.toLowerCase() !== severity.toLowerCase()) {
      return false
    }
    if (status && status !== 'all' && item.status?.toLowerCase() !== status.toLowerCase()) {
      return false
    }
    if (sTerm) {
      const matchMsg = (item.message || '').toLowerCase().includes(sTerm)
      const matchCol = (item.column_name || '').toLowerCase().includes(sTerm)
      const matchFile = (item.file_name || '').toLowerCase().includes(sTerm)
      const matchId = (item.id || '').toLowerCase().includes(sTerm)
      if (!matchMsg && !matchCol && !matchFile && !matchId) return false
    }
    return true
  })
}

/**
 * Ensure revenue breakdown slices have accurate percentage distribution.
 */
export function computeSlicePercentages(slices) {
  if (!Array.isArray(slices) || slices.length === 0) return []
  const total = slices.reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
  if (total <= 0) return slices.map((s) => ({ ...s, percent: 0 }))

  return slices.map((s) => {
    const amt = Number(s.amount) || 0
    const pct = Math.round((amt / total) * 1000) / 10
    return {
      ...s,
      percent: pct,
    }
  })
}

/**
 * Validate that essential canonical columns are mapped for daily accounts ingestion.
 */
export function validateColumnMapping(mapping) {
  if (!mapping || typeof mapping !== 'object') {
    return { isValid: false, missing: ['date', 'category', 'amount'] }
  }
  const required = ['date', 'category', 'amount']
  const missing = required.filter((col) => !mapping[col] || !String(mapping[col]).trim())
  return {
    isValid: missing.length === 0,
    missing,
  }
}

/**
 * Format bytes into human-readable file size (KB / MB).
 */
export function formatFileSize(bytes) {
  const b = Number(bytes) || 0
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * Generate CSV text for download from validation issues list.
 */
export function generateValidationReportCsv(issues = []) {
  const header = 'Row Number,Column Name,Severity,Original Value,Validation Message,Suggested Fix,Status'
  const rows = issues.map((iss) => {
    const rowNum = iss.row_number ?? ''
    const colName = `"${String(iss.column_name || '').replace(/"/g, '""')}"`
    const sev = iss.severity || 'Warning'
    const origVal = `"${String(iss.original_value ?? '').replace(/"/g, '""')}"`
    const msg = `"${String(iss.message || '').replace(/"/g, '""')}"`
    const fix = `"${String(iss.suggested_fix || '').replace(/"/g, '""')}"`
    const st = iss.status || 'Pending'
    return `${rowNum},${colName},${sev},${origVal},${msg},${fix},${st}`
  })
  return [header, ...rows].join('\n')
}

/**
 * Smart automatic column header detection for Sri Lanka Post accounting spreadsheets.
 * Evaluates header strings and optional sample row values against canonical accounting fields.
 */
export function autoDetectColumnMapping(headers = [], sampleRows = []) {
  const mapping = {
    date: '',
    category: '',
    count: '',
    amount: '',
    reference_no: '',
    provider: '',
    commission: '',
    recipient: '',
    remitter: '',
    office_id: '',
    payment_method: '',
    description: '',
  }

  if (!Array.isArray(headers) || headers.length === 0) return mapping

  const cleanedHeaders = headers.map((h) => String(h || '').trim()).filter(Boolean)
  if (cleanedHeaders.length === 0) return mapping

  const rules = [
    {
      field: 'date',
      exact: [
        'date',
        'trans date',
        'trans_date',
        'transaction date',
        'transaction_date',
        'entry date',
        'posting date',
        'value date',
        'tx date',
        'txn date',
        'day',
        'billing date',
        'date of issue',
        'collection date',
        'trans_dt',
      ],
      keywords: ['date', 'day'],
      exclude: ['updated', 'created', 'birth', 'maturity'],
    },
    {
      field: 'amount',
      exact: [
        'amount',
        'amount (lkr)',
        'amount lkr',
        'lkr amount',
        'total',
        'total (lkr)',
        'total lkr',
        'net amount',
        'value (lkr)',
        'value lkr',
        'collection amount',
        'total amount',
        'credit',
        'debit',
        'receipts',
        'payments',
        'cash amount',
        'amount_lkr',
        'trans_amount',
      ],
      keywords: ['amount', 'amt', 'lkr', 'total', 'value', 'credit', 'debit', 'sum'],
      exclude: ['count', 'bills', 'qty', 'volume', 'commission', 'fee', 'charge', 'rate'],
    },
    {
      field: 'category',
      exact: [
        'category',
        'service',
        'particulars',
        'description',
        'service category',
        'service type',
        'transaction type',
        'trans type',
        'account description',
        'account name',
        'account head',
        'head of account',
        'item description',
        'item',
        'narration',
        'nature of transaction',
        'ledger head',
        'sub head',
        'details',
      ],
      keywords: ['category', 'service', 'particular', 'desc', 'head', 'narrat'],
      exclude: ['sub total', 'grand total', 'biller', 'date'],
    },
    {
      field: 'count',
      exact: [
        'count',
        'qty',
        'quantity',
        'volume',
        'bills',
        'no of bills',
        'num of bills',
        'number of bills',
        'no of transactions',
        'no of items',
        'items count',
        'total count',
        'vouchers count',
        'units',
        'no of txns',
        'volume / count',
      ],
      keywords: ['count', 'qty', 'quantity', 'volume', 'bills', 'items'],
      exclude: ['amount', 'lkr', 'value', 'fee'],
    },
    {
      field: 'reference_no',
      exact: [
        'reference',
        'reference no',
        'reference number',
        'ref no',
        'ref #',
        'voucher',
        'voucher no',
        'voucher number',
        'voucher id',
        'ticket no',
        'ticket',
        'pmt no',
        'emo no',
        'receipt no',
        'receipt number',
        'serial no',
        'sl no',
        'transaction id',
        'tx id',
        'txn id',
        'doc no',
        'cheque no',
        'bill no',
        'reference_no',
        'voucher_no',
      ],
      keywords: ['voucher', 'reference', 'ticket', 'pmt', 'emo', 'receipt no', 'txn id', 'tx id', 'doc no'],
      exclude: ['no of bills', 'no of items', 'no of transactions', 'count'],
    },
    {
      field: 'provider',
      exact: [
        'provider',
        'biller',
        'utility',
        'utility provider',
        'agency',
        'biller name',
        'institution',
        'company',
        'ceb',
        'leco',
        'water board',
        'nwsdb',
        'slt',
        'dialog',
        'mobitel',
      ],
      keywords: ['provider', 'biller', 'utility', 'agency'],
      exclude: ['amount', 'fee', 'charge'],
    },
    {
      field: 'commission',
      exact: [
        'commission',
        'comm',
        'postal fee',
        'fee',
        'charges',
        'service charge',
        'commission lkr',
        'commission (lkr)',
        'postage',
        'postal charge',
        'fees',
      ],
      keywords: ['commission', 'comm', 'fee', 'charge', 'postage'],
      exclude: ['amount lkr', 'total lkr'],
    },
    {
      field: 'recipient',
      exact: ['recipient', 'payee', 'beneficiary', 'receiver', 'to', 'pay to', 'credit to'],
      keywords: ['recipient', 'payee', 'beneficiary', 'receiver'],
      exclude: ['remitter', 'sender'],
    },
    {
      field: 'remitter',
      exact: ['remitter', 'sender', 'customer', 'customer name', 'depositor', 'payer', 'from', 'issued by'],
      keywords: ['remitter', 'sender', 'depositor', 'payer', 'customer'],
      exclude: ['recipient', 'payee'],
    },
    {
      field: 'office_id',
      exact: [
        'office',
        'post office',
        'branch',
        'office id',
        'branch id',
        'sub office',
        'location',
        'station',
        'depot',
      ],
      keywords: ['office', 'branch', 'station'],
      exclude: ['officer'],
    },
    {
      field: 'payment_method',
      exact: [
        'payment method',
        'payment mode',
        'mode',
        'pay method',
        'pay mode',
        'cash/cheque',
        'payment type',
        'pay type',
      ],
      keywords: ['payment', 'method', 'mode'],
      exclude: ['biller', 'amount'],
    },
  ]

  const assignedHeaders = new Set()

  // Pass 1: Check exact normalized matches
  for (const rule of rules) {
    for (const h of cleanedHeaders) {
      if (assignedHeaders.has(h)) continue
      const norm = h.toLowerCase().trim()
      if (rule.exact.includes(norm)) {
        mapping[rule.field] = h
        assignedHeaders.add(h)
        break
      }
    }
  }

  // Pass 2: Check keyword / regex matches with exclusions
  for (const rule of rules) {
    if (mapping[rule.field]) continue
    for (const h of cleanedHeaders) {
      if (assignedHeaders.has(h)) continue
      const norm = h.toLowerCase().trim()
      const isExcluded = rule.exclude && rule.exclude.some((ex) => norm.includes(ex))
      if (isExcluded) continue

      const matchesKeyword = rule.keywords.some((kw) => {
        if (norm === kw) return true
        const regex = new RegExp(`(^|[^a-z0-9])${kw}([^a-z0-9]|$)`, 'i')
        return regex.test(norm)
      })

      if (matchesKeyword) {
        mapping[rule.field] = h
        assignedHeaders.add(h)
        break
      }
    }
  }

  return mapping
}



