import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  Bell,
  Building2,
  Calendar,
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  Download,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Home,
  Info,
  Layers,
  LayoutDashboard,
  Mail,
  MapPin,
  PieChart,
  Plus,
  Printer,
  FileDown,
  RefreshCw,
  Search,
  ShieldCheck,
  Sliders,
  Sparkles,
  Stamp,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  User,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react'
import {
  approveDailyAccountsGlPrediction,
  confirmDailyAccountsImport,
  confirmDailyAccountsUpload,
  createDailyAccountTransaction,
  deleteDailyAccountsBatch,
  downloadConsolidatedDailyExcel,
  downloadDailyAccountCategoryExcel,
  downloadDailyAccountsReportExcel,
  getDailyAccountTransactions,
  getDailyAccountsAuditHistory,
  getDailyAccountsCashReconciliation,
  getDailyAccountsCategoryRecords,
  getDailyAccountsGlPredictions,
  getDailyAccountsImports,
  getDailyAccountsOffices,
  getDailyAccountsRecentSheets,
  getDailyAccountsReports,
  getDailyAccountsRevenueBreakdown,
  getDailyAccountsSummary,
  getDailyAccountsTrends,
  getDailyAccountsValidationIssues,
  getDailyAccountsValidationReport,
  getDailyMoneyOrdersChart,
  inspectDailyAccountsFile,
  previewDailyAccountsUpload,
  resetDailyAccountsDemo,
  resolveDailyAccountsIssue,
  updateDailyAccountTransactionStatus,
  uploadDailyAccountsFile,
} from '../data/repository'
import { useAuth } from '../data/auth'
import {
  autoDetectColumnMapping,
  calculateCashReconciliation,
  calculateCompletenessPercent,
  filterValidationIssues,
  formatFileSize,
  formatLkrCurrency,
  generateValidationReportCsv,
  validateColumnMapping,
} from './dailyAccountsHelpers'

// Upload and Ingestion Stage Descriptions for explicit progress tracking
const STAGE_LABELS = {
  reading_workbook: {
    title: 'Reading Workbook...',
    desc: 'Reading binary spreadsheet content, inspecting sheet metadata and structures.',
    badge: 'Reading File',
  },
  detecting_columns: {
    title: 'Detecting Columns...',
    desc: 'Scanning column headers, identifying date, reference, category, and monetary fields.',
    badge: 'Detecting Headers',
  },
  mapping_columns: {
    title: 'Mapping Columns...',
    desc: 'Applying smart column mapping aligned with Sri Lanka Post accounting standards.',
    badge: 'Mapping Fields',
  },
  validating_records: {
    title: 'Validating Records...',
    desc: 'Parsing transaction rows, enforcing mandatory date/amount constraints, and predicting GL codes.',
    badge: 'Validating Rows',
  },
  checking_duplicates: {
    title: 'Checking Duplicates...',
    desc: 'Cross-referencing office and date business keys against database transactions and within-file rows.',
    badge: 'Checking Duplicates',
  },
  preparing_summary: {
    title: 'Preparing Ingestion Summary...',
    desc: 'Computing net revenue impact, category volumes, and live preview tables.',
    badge: 'Preparing Summary',
  },
  saving_records: {
    title: 'Saving Records to MongoDB...',
    desc: 'Executing high-speed chunked bulk writes and updating audit logs in MongoDB Atlas.',
    badge: 'Saving Records',
  },
  refreshing_dashboard: {
    title: 'Refreshing Dashboard...',
    desc: 'Re-querying verified transactions, recalculating cash reconciliations and live KPI summaries.',
    badge: 'Refreshing Views',
  },
  completed: {
    title: 'Completed',
    desc: 'Transactions successfully integrated into MongoDB live reporting.',
    badge: 'Completed',
  },
}

// SVG Donut Chart Component
function RevenueDonutChart({ slices, totalFormatted }) {
  const size = 200
  const center = size / 2
  const strokeWidth = 32
  const radius = center - strokeWidth / 2
  const circumference = 2 * Math.PI * radius

  const total = useMemo(() => {
    return slices.reduce((sum, s) => sum + (s.amount || 0), 0) || 1
  }, [slices])

  let accumulatedPercent = 0
  const segments = slices.map((slice) => {
    const fraction = (slice.amount || 0) / total
    const strokeDasharray = `${fraction * circumference} ${circumference}`
    const strokeDashoffset = -accumulatedPercent * circumference
    accumulatedPercent += fraction
    return {
      ...slice,
      strokeDasharray,
      strokeDashoffset,
    }
  })

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#F1F5F9" strokeWidth={strokeWidth} />
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={seg.strokeDasharray}
            strokeDashoffset={seg.strokeDashoffset}
            className="transition-all duration-300 hover:opacity-80"
          />
        ))}
      </svg>
      {/* Center Text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
        <span className="text-[13px] font-bold text-slate-800 leading-tight">
          {totalFormatted || 'LKR 0'}
        </span>
        <span className="text-[11px] font-medium text-slate-500">Total Revenue</span>
      </div>
    </div>
  )
}

// Completeness Donut Gauge Component
function CompletenessGauge({ percent = 100 }) {
  const size = 110
  const center = size / 2
  const strokeWidth = 12
  const radius = center - strokeWidth / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percent / 100) * circumference

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#E2E8F0" strokeWidth={strokeWidth} />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#0D9488"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
        <span className="text-lg font-bold text-slate-800 leading-tight">{percent}%</span>
        <span className="text-[10px] text-slate-500 font-medium">Complete</span>
      </div>
    </div>
  )
}

export default function DailyAccountsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Navigation tab in Daily Accounts module
  const [activeTab, setActiveTab] = useState('Overview')

  // Data mode: "auto" uses real data if uploaded, else demo. Or user can toggle explicitly.
  const [dataMode, setDataMode] = useState('auto')

  // Top header states
  const [offices, setOffices] = useState([])
  const [selectedOffice, setSelectedOffice] = useState('PO-COLOMBO-CENTRAL')
  const [selectedOfficeName, setSelectedOfficeName] = useState('Colombo Central Post Office')
  const [startDate, setStartDate] = useState('2026-07-01')
  const [endDate, setEndDate] = useState('2026-09-01')
  const [dateRange, setDateRange] = useState('01 Jul 2026 - 01 Sep 2026')
  const [showOfficeMenu, setShowOfficeMenu] = useState(false)
  const [showDateMenu, setShowDateMenu] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  // Data states
  const [summary, setSummary] = useState(null)
  const [trends, setTrends] = useState(null)
  const [trendMode, setTrendMode] = useState('Week')
  const [selectedWeek, setSelectedWeek] = useState('Week 3 (14 Jul - 20 Jul 2026)')
  const [dualChart, setDualChart] = useState(null)
  const [revenueBreakdown, setRevenueBreakdown] = useState(null)
  const [cashRecon, setCashRecon] = useState(null)
  const [recentSheets, setRecentSheets] = useState([])
  const [validationIssues, setValidationIssues] = useState([])
  const [glPredictions, setGlPredictions] = useState([])
  const [auditHistory, setAuditHistory] = useState([])
  const [categoryData, setCategoryData] = useState(null)
  const [loading, setLoading] = useState(true)

  // Upload wizard & preview modal states
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [modalStep, setModalStep] = useState(1) // 1: Mapping, 2: Live Preview, 3: Ingestion Options
  const [importMode, setImportMode] = useState('append') // 'append' | 'replace'
  const [previewPage, setPreviewPage] = useState(1)
  const [previewPageSize, setPreviewPageSize] = useState(15)
  const [previewFilter, setPreviewFilter] = useState('all') // 'all' | 'valid' | 'issues' | 'duplicates'
  const [previewSearch, setPreviewSearch] = useState('')
  const [importBatches, setImportBatches] = useState([])
  const [uploadFile, setUploadFile] = useState(null)
  const [inspectData, setInspectData] = useState(null)
  const [selectedSheet, setSelectedSheet] = useState('')
  const [columnMapping, setColumnMapping] = useState({
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
    denomination: '',
    opening_qty: '',
    receipts_qty: '',
    issued_qty: '',
    damaged_qty: '',
    closing_qty: '',
    closing_value: '',
    verified_by: '',
  })
  const [excludeSummaryRows, setExcludeSummaryRows] = useState(true)
  const [uploadCategory, setUploadCategory] = useState('auto')
  const [uploading, setUploading] = useState(false)
  const [uploadStage, setUploadStage] = useState('')
  const [uploadPreview, setUploadPreview] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const fileInputRef = useRef(null)

  // Issue resolution modal
  const [selectedIssue, setSelectedIssue] = useState(null)
  const [correctionInput, setCorrectionInput] = useState('')

  // Sri Lankan local today string
  const getTodaySLString = () => {
    const d = new Date()
    const utc = d.getTime() + d.getTimezoneOffset() * 60000
    const sl = new Date(utc + 5.5 * 3600000)
    return sl.toISOString().split('T')[0]
  }

  // Clerk Transaction Entry state
  const [isAddTxModalOpen, setIsAddTxModalOpen] = useState(false)
  const [txFormCategory, setTxFormCategory] = useState('Money Orders')
  const [txFormData, setTxFormData] = useState({
    date: getTodaySLString(),
    reference_no: '',
    remitter: '',
    remitter_phone: '',
    remitter_address: '',
    recipient: '',
    recipient_phone: '',
    recipient_address: '',
    amount: '',
    service_fee: '0',
    total_collected: '',
    service_type: 'Registered Post',
    count: '1',
    unit_charge: '',
    provider: 'CEB',
    customer_ref: '',
    bills_count: '1',
    commission: '0',
    transaction_type: 'Civil Pension',
    beneficiary_ref: '',
    payment_status: 'Paid',
    entry_type: 'Closing Balance',
    stock_type: 'Postage Stamp',
    denomination: '25',
    opening_qty: '0',
    receipts_qty: '0',
    issued_qty: '0',
    damaged_qty: '0',
    closing_qty: '0',
    closing_value: '0',
    payment_method: 'Cash',
    remarks: '',
    status: 'Submitted',
  })
  const [txSubmitting, setTxSubmitting] = useState(false)
  const [txFormError, setTxFormError] = useState('')
  const [txFormSuccess, setTxFormSuccess] = useState('')

  // Category view live filters & records
  const [categoryTransactions, setCategoryTransactions] = useState([])
  const [categoryTxLoading, setCategoryTxLoading] = useState(false)
  const [categorySearch, setCategorySearch] = useState('')
  const [categoryStatusFilter, setCategoryStatusFilter] = useState('all')

  // Reports state
  const [reportsData, setReportsData] = useState(null)
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportsSubTab, setReportsSubTab] = useState('daily_collections')
  const [reportsFilterCategory, setReportsFilterCategory] = useState('')
  const [reportsFilterClerk, setReportsFilterClerk] = useState('')
  const [reportsFilterStatus, setReportsFilterStatus] = useState('')

  // Load initial data
  const loadData = async () => {
    try {
      setLoading(true)
      const [
        officesRes,
        summaryRes,
        trendsRes,
        dualRes,
        revRes,
        reconRes,
        sheetsRes,
        issuesRes,
      ] = await Promise.all([
        getDailyAccountsOffices().catch(() => []),
        getDailyAccountsSummary(selectedOffice, startDate, endDate, dataMode),
        getDailyAccountsTrends(trendMode, selectedWeek, dataMode),
        getDailyMoneyOrdersChart(selectedWeek, dataMode),
        getDailyAccountsRevenueBreakdown(dataMode),
        getDailyAccountsCashReconciliation(selectedOffice, endDate, dataMode),
        getDailyAccountsRecentSheets(selectedOffice, dataMode),
        getDailyAccountsValidationIssues('', '', dataMode),
      ])

      setOffices(officesRes || [])
      setSummary(summaryRes)
      setTrends(trendsRes)
      setDualChart(dualRes)
      setRevenueBreakdown(revRes)
      setCashRecon(reconRes)
      setRecentSheets(sheetsRes || [])
      setValidationIssues(issuesRes || [])
    } catch (err) {
      console.error('Failed to load daily accounts data', err)
    } finally {
      setLoading(false)
    }
  }

  const loadCategoryTransactions = async () => {
    if (!['Money Orders', 'Postal Services', 'Utility Collections', 'Pension & Welfare', 'Cash & Stamp Stock', 'Expenses & Imprest'].includes(activeTab)) return
    setCategoryTxLoading(true)
    try {
      const [catRes, txRes] = await Promise.all([
        getDailyAccountsCategoryRecords(activeTab, selectedOffice, startDate, endDate, dataMode),
        getDailyAccountTransactions({
          category: activeTab,
          office_id: selectedOffice,
          start_date: startDate,
          end_date: endDate,
          status: categoryStatusFilter !== 'all' ? categoryStatusFilter : '',
          search: categorySearch,
          data_mode: dataMode,
          limit: 100,
        }),
      ])
      setCategoryData(catRes)
      setCategoryTransactions(txRes?.records || [])
    } catch (err) {
      console.error('Failed to load category records', err)
    } finally {
      setCategoryTxLoading(false)
    }
  }

  const loadReportsData = async () => {
    setReportsLoading(true)
    try {
      const res = await getDailyAccountsReports({
        office_id: selectedOffice,
        start_date: startDate,
        end_date: endDate,
        category: reportsFilterCategory,
        clerk_id: reportsFilterClerk,
        status: reportsFilterStatus,
      })
      setReportsData(res)
    } catch (err) {
      console.error('Failed to load reports', err)
    } finally {
      setReportsLoading(false)
    }
  }

  const openAddTxModal = (category) => {
    const cat = category || (['Money Orders', 'Postal Services', 'Utility Collections', 'Pension & Welfare', 'Cash & Stamp Stock', 'Expenses & Imprest'].includes(activeTab) ? activeTab : 'Money Orders')
    setTxFormCategory(cat)
    const prefix = cat === 'Money Orders' ? 'MO' : cat === 'Postal Services' ? 'PS' : cat === 'Utility Collections' ? 'UC' : cat === 'Pension & Welfare' ? 'PW' : cat === 'Expenses & Imprest' ? 'EXP' : 'ST'
    const randomSuffix = Math.floor(1000 + Math.random() * 9000)
    const todayStr = getTodaySLString()
    setTxFormData({
      date: todayStr,
      reference_no: `${prefix}-${todayStr.replace(/-/g, '')}-${randomSuffix}`,
      remitter: '',
      remitter_phone: '',
      remitter_address: '',
      recipient: '',
      recipient_phone: '',
      recipient_address: '',
      amount: '',
      service_fee: '0',
      total_collected: '',
      service_type: 'Registered Post',
      count: '1',
      unit_charge: '',
      provider: 'CEB',
      customer_ref: '',
      bills_count: '1',
      commission: '0',
      transaction_type: 'Civil Pension',
      beneficiary_ref: '',
      payment_status: 'Paid',
      entry_type: 'Closing Balance',
      stock_type: 'Postage Stamp',
      denomination: '25',
      opening_qty: '0',
      receipts_qty: '0',
      issued_qty: '0',
      damaged_qty: '0',
      closing_qty: '0',
      closing_value: '0',
      expense_category: 'Post Office Contingencies',
      payee: '',
      payment_method: cat === 'Expenses & Imprest' ? 'Cash from Imprest' : 'Cash',
      remarks: '',
      status: 'Submitted',
    })
    setTxFormError('')
    setTxFormSuccess('')
    setIsAddTxModalOpen(true)
  }

  const handleSubmitTransaction = async (overrideStatus = null) => {
    setTxFormError('')
    setTxFormSuccess('')

    const st = overrideStatus || txFormData.status || 'Submitted'
    const payload = {
      ...txFormData,
      status: st,
      office_id: selectedOffice,
      category: txFormCategory === 'Cash & Stamp Stock' ? 'Stamp Stock Ledger' : txFormCategory,
    }

    // Validation
    if (txFormCategory === 'Money Orders') {
      if (!payload.remitter?.trim()) {
        setTxFormError('Sender / Remitter full name is required.')
        return
      }
      if (!payload.recipient?.trim()) {
        setTxFormError('Recipient / Payee full name is required.')
        return
      }
      const amt = Number(payload.amount)
      if (isNaN(amt) || amt <= 0) {
        setTxFormError('Money Order principal amount must be greater than zero.')
        return
      }
    } else if (txFormCategory === 'Postal Services') {
      const amt = Number(payload.amount || (Number(payload.count || 1) * Number(payload.unit_charge || 0)))
      if (isNaN(amt) || amt < 0) {
        setTxFormError('Postal Service amount cannot be negative.')
        return
      }
      payload.amount = amt
    } else if (txFormCategory === 'Utility Collections') {
      const amt = Number(payload.amount)
      if (isNaN(amt) || amt <= 0) {
        setTxFormError('Utility Collection amount must be greater than zero.')
        return
      }
    } else if (txFormCategory === 'Pension & Welfare') {
      if (!payload.beneficiary_ref?.trim()) {
        setTxFormError('Beneficiary / Approved Reference is required.')
        return
      }
      const amt = Number(payload.amount)
      if (isNaN(amt) || amt <= 0) {
        setTxFormError('Pension disbursement amount must be greater than zero.')
        return
      }
    } else if (txFormCategory === 'Cash & Stamp Stock') {
      const op = Number(payload.opening_qty || 0)
      const rec = Number(payload.receipts_qty || 0)
      const iss = Number(payload.issued_qty || 0)
      const dam = Number(payload.damaged_qty || 0)
      const clos = Number(payload.closing_qty || 0)
      const expected = op + rec - iss - dam
      if ((op > 0 || rec > 0 || iss > 0 || dam > 0) && clos !== expected) {
        setTxFormError(`Stock balance equation error: Opening (${op}) + Receipts (${rec}) - Issues (${iss}) - Damaged (${dam}) = ${expected}, but Closing is ${clos}.`)
        return
      }
      payload.closing_value = clos * Number(payload.denomination || 0)
      payload.amount = payload.closing_value
    } else if (txFormCategory === 'Expenses & Imprest') {
      if (!payload.payee?.trim()) {
        setTxFormError('Payee / vendor or expense description is required.')
        return
      }
      const amt = Number(payload.amount)
      if (isNaN(amt) || amt <= 0) {
        setTxFormError('Expense amount must be greater than zero.')
        return
      }
      if (amt > 50000 && st === 'Approved') {
        setTxFormError('Expenses above LKR 50,000 exceed the single petty imprest limit and require Postmaster review.')
        return
      }
    }

    setTxSubmitting(true)
    try {
      await createDailyAccountTransaction(payload)
      setTxFormSuccess(`Transaction ${payload.reference_no || ''} ${st === 'Draft' ? 'saved as draft' : 'submitted successfully'}.`)
      setIsAddTxModalOpen(false)
      if (payload.date > endDate) {
        setEndDate(payload.date)
        setDateRange(`${startDate} - ${payload.date}`)
      }
      loadCategoryTransactions()
      loadData()
      setDataMode('real')
    } catch (err) {
      setTxFormError(err.message || 'Transaction submission failed')
    } finally {
      setTxSubmitting(false)
    }
  }

  const handleUpdateRecordStatus = async (recordId, newStatus) => {
    try {
      await updateDailyAccountTransactionStatus(recordId, newStatus)
      loadCategoryTransactions()
      loadData()
    } catch (err) {
      alert(err.message || 'Status update failed')
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedOffice, startDate, endDate, trendMode, selectedWeek, dataMode])

  // Load sub-view data when activeTab changes
  useEffect(() => {
    if (activeTab === 'GL Prediction') {
      getDailyAccountsGlPredictions(dataMode).then(setGlPredictions).catch(console.error)
    } else if (activeTab === 'Audit History') {
      getDailyAccountsAuditHistory().then(setAuditHistory).catch(console.error)
    } else if (activeTab === 'Validation Issues') {
      getDailyAccountsValidationIssues('', '', dataMode).then(setValidationIssues).catch(console.error)
    } else if (activeTab === 'Daily Account Upload') {
      getDailyAccountsImports(selectedOffice).then(setImportBatches).catch(console.error)
    } else if (activeTab === 'Reports') {
      loadReportsData()
    } else if (
      [
        'Money Orders',
        'Postal Services',
        'Utility Collections',
        'Pension & Welfare',
        'Cash & Stamp Stock',
        'Expenses & Imprest',
      ].includes(activeTab)
    ) {
      loadCategoryTransactions()
    }
  }, [activeTab, dataMode, selectedOffice, startDate, endDate, categoryStatusFilter, categorySearch, reportsFilterCategory, reportsFilterClerk, reportsFilterStatus])

  // Stage 1: Inspect File on Drop or Picker Selection
  const processSelectedFile = async (file) => {
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setUploadError('Unsupported file format. Please upload an Excel (.xlsx, .xls) or .csv file.')
      setIsUploadModalOpen(true)
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size exceeds the maximum limit of 10 MB.')
      setIsUploadModalOpen(true)
      return
    }

    setUploadFile(file)
    setUploadError('')
    setUploadSuccess('')
    setUploadPreview(null)
    setInspectData(null)
    setUploading(true)
    setUploadStage('reading_workbook')
    setIsUploadModalOpen(true)
    setModalStep(1)

    try {
      const formData = new FormData()
      formData.append('file', file)
      setUploadStage('detecting_columns')
      const inspectRes = await inspectDailyAccountsFile(formData)
      setInspectData(inspectRes)
      setSelectedSheet(inspectRes.selected_sheet || (inspectRes.sheet_names && inspectRes.sheet_names[0]) || 'Sheet1')

      // Populate column mapping from smart suggestions
      setUploadStage('mapping_columns')
      const sm = inspectRes.suggested_mapping || {}
      const clientMap = autoDetectColumnMapping(inspectRes.detected_headers || [], inspectRes.sample_rows || [])
      setColumnMapping({
        date: sm.date || clientMap.date || '',
        category: sm.category || clientMap.category || '',
        count: sm.count || clientMap.count || '',
        amount: sm.amount || clientMap.amount || '',
        reference_no: sm.reference_no || clientMap.reference_no || '',
        provider: sm.provider || clientMap.provider || '',
        commission: sm.commission || clientMap.commission || '',
        recipient: sm.recipient || clientMap.recipient || '',
        remitter: sm.remitter || clientMap.remitter || '',
        office_id: sm.office_id || clientMap.office_id || '',
        payment_method: sm.payment_method || clientMap.payment_method || '',
        description: sm.description || clientMap.description || '',
        denomination: sm.denomination || '',
        opening_qty: sm.opening_qty || '',
        receipts_qty: sm.receipts_qty || '',
        issued_qty: sm.issued_qty || '',
        damaged_qty: sm.damaged_qty || '',
        closing_qty: sm.closing_qty || '',
        closing_value: sm.closing_value || '',
        verified_by: sm.verified_by || '',
      })
      if (inspectRes.detected_category) {
        setUploadCategory(inspectRes.detected_category)
      }
    } catch (err) {
      setUploadError(err.message || 'File inspection failed')
    } finally {
      setUploading(false)
      setUploadStage('')
    }
  }

  const handleFileDrop = (e) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0])
    }
  }

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0])
    }
  }

  const handleAutoDetectAllColumns = (overrideHeaders = null, overrideRows = null) => {
    const hdrs = overrideHeaders || inspectData?.detected_headers || []
    const sRows = overrideRows || inspectData?.sample_rows || []
    const sm = inspectData?.suggested_mapping || {}
    const clientMap = autoDetectColumnMapping(hdrs, sRows)
    const resolved = {
      date: clientMap.date || sm.date || '',
      category: clientMap.category || sm.category || '',
      count: clientMap.count || sm.count || '',
      amount: clientMap.amount || sm.amount || '',
      reference_no: clientMap.reference_no || sm.reference_no || '',
      provider: clientMap.provider || sm.provider || '',
      commission: clientMap.commission || sm.commission || '',
      recipient: clientMap.recipient || sm.recipient || '',
      remitter: clientMap.remitter || sm.remitter || '',
      office_id: clientMap.office_id || sm.office_id || '',
      payment_method: clientMap.payment_method || sm.payment_method || '',
      description: clientMap.description || sm.description || '',
      denomination: clientMap.denomination || sm.denomination || '',
      opening_qty: clientMap.opening_qty || sm.opening_qty || '',
      receipts_qty: clientMap.receipts_qty || sm.receipts_qty || '',
      issued_qty: clientMap.issued_qty || sm.issued_qty || '',
      damaged_qty: clientMap.damaged_qty || sm.damaged_qty || '',
      closing_qty: clientMap.closing_qty || sm.closing_qty || '',
      closing_value: clientMap.closing_value || sm.closing_value || '',
      verified_by: clientMap.verified_by || sm.verified_by || '',
    }
    setColumnMapping(resolved)
    return resolved
  }

  const handleWorksheetChange = (newSheet) => {
    setSelectedSheet(newSheet)
    if (inspectData?.sheets_data && inspectData.sheets_data[newSheet]) {
      const sData = inspectData.sheets_data[newSheet]
      setInspectData((prev) => ({
        ...prev,
        selected_sheet: newSheet,
        detected_headers: sData.detected_headers || [],
        sample_rows: sData.sample_rows || [],
        suggested_mapping: sData.suggested_mapping || {},
        total_sheet_rows: sData.total_sheet_rows || 0,
      }))
      const sm = sData.suggested_mapping || {}
      const clientMap = autoDetectColumnMapping(sData.detected_headers || [], sData.sample_rows || [])
      setColumnMapping({
        date: sm.date || clientMap.date || '',
        category: sm.category || clientMap.category || '',
        count: sm.count || clientMap.count || '',
        amount: sm.amount || clientMap.amount || '',
        reference_no: sm.reference_no || clientMap.reference_no || '',
        provider: sm.provider || clientMap.provider || '',
        commission: sm.commission || clientMap.commission || '',
        recipient: sm.recipient || clientMap.recipient || '',
        remitter: sm.remitter || clientMap.remitter || '',
        office_id: sm.office_id || clientMap.office_id || '',
        payment_method: sm.payment_method || clientMap.payment_method || '',
        description: sm.description || clientMap.description || '',
        denomination: sm.denomination || clientMap.denomination || '',
        opening_qty: sm.opening_qty || clientMap.opening_qty || '',
        receipts_qty: sm.receipts_qty || clientMap.receipts_qty || '',
        issued_qty: sm.issued_qty || clientMap.issued_qty || '',
        damaged_qty: sm.damaged_qty || clientMap.damaged_qty || '',
        closing_qty: sm.closing_qty || clientMap.closing_qty || '',
        closing_value: sm.closing_value || clientMap.closing_value || '',
        verified_by: sm.verified_by || clientMap.verified_by || '',
      })
    }
  }

  const mappedColumnCount = useMemo(() => {
    return Object.values(columnMapping).filter(Boolean).length
  }, [columnMapping])

  // Stage 2: Validate Sheet with selected mapping and jump to Live Preview
  const handleValidateSheet = async () => {
    if (!uploadFile) return
    setUploading(true)
    setUploadStage('validating_records')
    setUploadError('')
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('sheet_name', selectedSheet)
      formData.append('office_id', selectedOffice)
      formData.append('reporting_period', dateRange)
      formData.append('exclude_summary_rows', String(excludeSummaryRows))
      formData.append('column_mapping', JSON.stringify(columnMapping))
      formData.append('dataset_category', uploadCategory)

      const res = await uploadDailyAccountsFile(formData)
      setUploadStage('preparing_summary')
      setUploadPreview(res)
      setPreviewPage(1)
      setModalStep(2) // Jump directly to Live Preview screen
    } catch (err) {
      setUploadError(err.message || 'Validation failed')
    } finally {
      setUploading(false)
      setUploadStage('')
    }
  }

  // Download Validation Report as CSV
  const handleDownloadValidationReport = () => {
    if (!uploadPreview) return
    const csvContent = generateValidationReportCsv(uploadPreview.issues || [])
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Validation_Report_${uploadPreview.batch_meta?.batch_id || 'batch'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Filtered and paginated preview records for Step 2
  const filteredPreviewRecords = useMemo(() => {
    if (!uploadPreview?.records) return []
    let list = uploadPreview.records
    if (previewFilter === 'valid') {
      list = list.filter((r) => r.is_valid && !r.is_duplicate)
    } else if (previewFilter === 'issues') {
      list = list.filter((r) => !r.is_valid || (r.row_errors && r.row_errors.length > 0) || (r.row_warnings && r.row_warnings.length > 0))
    } else if (previewFilter === 'duplicates') {
      list = list.filter((r) => r.is_duplicate)
    }
    if (previewSearch.trim()) {
      const q = previewSearch.toLowerCase()
      list = list.filter(
        (r) =>
          (r.category && r.category.toLowerCase().includes(q)) ||
          (r.reference_no && r.reference_no.toLowerCase().includes(q)) ||
          (r.provider && r.provider.toLowerCase().includes(q)) ||
          (r.date && r.date.toLowerCase().includes(q)) ||
          (r.gl_code && r.gl_code.toLowerCase().includes(q))
      )
    }
    return list
  }, [uploadPreview, previewFilter, previewSearch])

  const totalPreviewPages = Math.max(1, Math.ceil(filteredPreviewRecords.length / previewPageSize))
  const paginatedPreviewRecords = useMemo(() => {
    const start = (previewPage - 1) * previewPageSize
    return filteredPreviewRecords.slice(start, start + previewPageSize)
  }, [filteredPreviewRecords, previewPage, previewPageSize])

  // Download past batch validation report CSV
  const handleDownloadBatchValidationReport = async (batchId) => {
    try {
      const csvStr = res.csv || res.csv_content
      if (csvStr) {
        const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `Validation_Report_${batchId}.csv`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        alert('No validation issues recorded for this batch.')
      }
    } catch (err) {
      alert(err.message || 'Failed to download report')
    }
  }

  // Stage 3: Confirm Import with Append or Replace mode and refresh dashboard
  const handleConfirmImport = async () => {
    if (!uploadPreview) return
    setUploading(true)
    setUploadStage('saving_records')
    setUploadError('')
    try {
      const res = await confirmDailyAccountsImport({
        batch_id: uploadPreview.batch_meta?.batch_id,
        batch_meta: uploadPreview.batch_meta,
        records: (uploadPreview.records && uploadPreview.records.length <= 500) ? uploadPreview.records : undefined,
        issues: (uploadPreview.issues && uploadPreview.issues.length <= 500) ? uploadPreview.issues : undefined,
        import_mode: importMode,
        dataset_category: uploadCategory !== 'auto' ? uploadCategory : (uploadPreview.batch_meta?.dataset_category || 'multi_category'),
      })
      const inserted = res.inserted ?? uploadPreview.batch_meta?.valid_rows ?? uploadPreview.total_records
      const skipped = res.skipped ?? uploadPreview.batch_meta?.duplicate_count ?? 0
      const rejected = res.rejected ?? uploadPreview.batch_meta?.rejected_count ?? 0

      setUploadStage('refreshing_dashboard')
      setDataMode('real')
      setActiveTab('Overview')
      await loadData()
      getDailyAccountsImports(selectedOffice).then(setImportBatches).catch(console.error)

      setUploadStage('completed')
      setUploadSuccess(
        importMode === 'replace'
          ? `Period Dataset Replaced Successfully! Replaced active period transactions with ${inserted} verified records in MongoDB (${skipped} within-file duplicates skipped, ${rejected} rejected). Live dashboard updated.`
          : `Import Completed Successfully! Ingested ${inserted} transactions into MongoDB (${skipped} duplicate rows skipped, ${rejected} rejected). Live dashboard updated.`
      )
      setIsUploadModalOpen(false)
      setUploadPreview(null)
      setInspectData(null)
      setUploadFile(null)
    } catch (err) {
      setUploadError(err.message || 'Import confirmation failed')
    } finally {
      setUploading(false)
      setUploadStage('')
    }
  }

  // Resolve validation issue
  const handleResolveIssue = async () => {
    if (!selectedIssue) return
    try {
      await resolveDailyAccountsIssue(selectedIssue.id, correctionInput)
      setSelectedIssue(null)
      setCorrectionInput('')
      getDailyAccountsValidationIssues('', '', dataMode).then(setValidationIssues)
      getDailyAccountsSummary(selectedOffice, startDate, endDate, dataMode).then(setSummary)
    } catch (err) {
      alert(err.message || 'Failed to resolve issue')
    }
  }

  // Approve GL classification
  const handleApproveGl = async (recordId, code) => {
    try {
      await approveDailyAccountsGlPrediction(recordId, code)
      getDailyAccountsGlPredictions(dataMode).then(setGlPredictions)
    } catch (err) {
      alert(err.message || 'Failed to approve GL code')
    }
  }

  // Export Report to CSV
  const handleExportCsv = () => {
    const records = recentSheets || []
    let csv = 'Date,Category,Count,Amount,Status\n'
    records.forEach((r) => {
      csv += `"${r.date}","${r.category}",${r.count},${r.amount},"${r.status}"\n`
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Daily_Accounts_${selectedOffice}_${startDate}_to_${endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Download Sample Template
  const handleDownloadTemplate = () => {
    const csvContent =
      'Date,Category,Count,Amount,Reference No,Flow Type,Provider\n' +
      '2026-08-15,Money Orders,24,58000,MO-2026-0815,inflow,Sri Lanka Post\n' +
      '2026-08-15,CEB Collections,42,86400,CEB-2026-0815,collection,CEB\n' +
      '2026-08-15,Postage Stamps & Philatelic,110,24500,STAMP-2026-0815,revenue,Counter Till\n' +
      '2026-08-15,Water Board Collections,18,34200,NWSDB-2026-0815,collection,Water Board\n' +
      '2026-08-15,Pension & Welfare,32,46000,PEN-2026-0815,disbursement,Treasury\n' +
      '2026-08-16,Money Orders,18,42000,MO-2026-0816,inflow,Sri Lanka Post\n' +
      '2026-08-16,LECO Collections,28,54000,LECO-2026-0816,collection,LECO\n' +
      '2026-08-16,Office Expenses & Imprest,1,12500,EXP-2026-0816,expense,Fuel & Stationery\n'
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'Sample_Daily_Accounts_Template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const isRealData = summary?.is_real_data || false

  const kpis = summary?.kpi_cards || {
    money_orders: { formatted_value: 'No Data', formatted_amount: 'No Data', has_data: false, trend: 'No records imported', trend_positive: true, badge: 'NO DATA', status_label: 'Upload a Money Orders dataset to begin' },
    utility_collections: { formatted_value: 'No Data', formatted_amount: 'No Data', has_data: false, trend: 'No records imported', trend_positive: true, badge: 'NO DATA', status_label: 'Upload a Utility Collections dataset to begin' },
    postal_revenue: { formatted_value: 'No Data', formatted_amount: 'No Data', has_data: false, trend: 'No records imported', trend_positive: true, badge: 'NO DATA', status_label: 'Upload a Postal Services dataset to begin' },
    stamps_revenue: { formatted_value: 'No Data', formatted_amount: 'No Data', has_data: false, trend: 'No records imported', trend_positive: true, badge: 'NO DATA', status_label: 'Upload a Stamps Counter dataset to begin' },
    pension_welfare: { formatted_value: 'No Data', formatted_amount: 'No Data', has_data: false, trend: 'No records imported', trend_positive: true, badge: 'NO DATA', status_label: 'No pension disbursement records' },
    stamp_stock: { formatted_value: 'No Data', formatted_amount: 'No Data', has_data: false, trend: 'Physical ledger verified', trend_positive: true, badge: 'ASSET LEDGER', status_label: 'Asset Valuation (GL-1201)', closing_qty: 0, is_revenue: false },
    validation_issues: { formatted_value: '0', trend: '0 pending', trend_positive: true },
  }

  const navItems = [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Daily Account Upload', icon: Upload },
    { label: 'Money Orders', icon: Mail },
    { label: 'Postal Services', icon: Layers },
    { label: 'Utility Collections', icon: Zap },
    { label: 'Pension & Welfare', icon: Users },
    { label: 'Cash & Stamp Stock', icon: Banknote },
    { label: 'Expenses & Imprest', icon: Wallet },
    { label: 'Validation Issues', icon: AlertTriangle, badge: validationIssues.length },
    { label: 'Reports', icon: FileSpreadsheet },
    { label: 'GL Prediction', icon: ShieldCheck },
    { label: 'Audit History', icon: History },
  ]

  return (
    <div className="min-h-screen bg-[#F0F4F8] flex flex-col font-sans text-slate-800 antialiased selection:bg-blue-100">
      {/* Top Application Bar */}
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-40 shadow-xs">
        {/* Left Office Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowOfficeMenu(!showOfficeMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[13px] font-semibold text-slate-700 transition-colors shadow-2xs"
          >
            <MapPin className="size-4 text-blue-600 shrink-0" />
            <span>{selectedOfficeName}</span>
            <ChevronDown className="size-3.5 text-slate-400 ml-1" />
          </button>
          {showOfficeMenu && (
            <div className="absolute left-0 mt-1.5 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
              <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Select Post Office
              </div>
              {(offices.length > 0 ? offices : [
                { id: 'PO-COLOMBO-CENTRAL', name: 'Colombo Central Post Office' },
                { id: 'PO-KADUWELA', name: 'Kaduwela Head Post Office' },
                { id: 'PO-GAMPAHA', name: 'Gampaha Post Office' },
                { id: 'PO-KANDY', name: 'Kandy General Post Office' },
                { id: 'PO-GALLE', name: 'Galle Fort Post Office' },
              ]).map((off) => (
                <button
                  key={off.id}
                  type="button"
                  onClick={() => {
                    setSelectedOffice(off.id)
                    setSelectedOfficeName(off.name)
                    setShowOfficeMenu(false)
                  }}
                  className={`w-full text-left px-3 py-2 text-[13px] flex items-center justify-between hover:bg-blue-50 transition-colors ${
                    selectedOffice === off.id ? 'font-bold text-blue-700 bg-blue-50/50' : 'text-slate-700'
                  }`}
                >
                  <span>{off.name}</span>
                  {selectedOffice === off.id && <Check className="size-3.5 text-blue-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Center / Right Controls: Mode Toggle, Date Range, Notifications, Profile */}
        <div className="flex items-center gap-4">
          {/* Data Mode Switcher Pill */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setDataMode('real')}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                dataMode === 'real' || (dataMode === 'auto' && isRealData)
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="size-2 rounded-full bg-emerald-300" />
              <span>Live Data</span>
            </button>
            <button
              type="button"
              onClick={() => setDataMode('demo')}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                dataMode === 'demo' || (dataMode === 'auto' && !isRealData)
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="size-2 rounded-full bg-blue-300" />
              <span>Demo Preview</span>
            </button>
          </div>

          {/* Date Range Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDateMenu(!showDateMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[13px] font-medium text-slate-700 transition-colors shadow-2xs"
            >
              <Calendar className="size-4 text-slate-500" />
              <span>{dateRange}</span>
              <ChevronDown className="size-3.5 text-slate-400 ml-1" />
            </button>
            {showDateMenu && (
              <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                {[
                  { label: '01 Jul 2026 - 01 Sep 2026', start: '2026-07-01', end: '2026-09-01' },
                  { label: '01 Aug 2026 - 31 Aug 2026', start: '2026-08-01', end: '2026-08-31' },
                  { label: '01 Jul 2026 - 31 Jul 2026', start: '2026-07-01', end: '2026-07-31' },
                  { label: 'All Dates (Full Dataset)', start: '', end: '' },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => {
                      setDateRange(opt.label)
                      setStartDate(opt.start)
                      setEndDate(opt.end)
                      setShowDateMenu(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-[13px] hover:bg-blue-50 ${
                      dateRange === opt.label ? 'font-bold text-blue-700 bg-blue-50/50' : 'text-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <Bell className="size-4.5" />
              <span className="absolute top-1.5 right-1.5 size-4 bg-red-500 text-white rounded-full text-[10px] font-bold grid place-items-center">
                {isRealData ? '1' : '3'}
              </span>
            </button>
            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[12px] font-bold text-slate-800">Notifications</span>
                  <span className="text-[10px] text-blue-600 font-medium">Activity Feed</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {isRealData ? (
                    <div className="px-3 py-2 text-[12px] text-slate-600">
                      <p className="font-semibold text-emerald-700">Live data active</p>
                      <p className="text-[11px] text-slate-500">Dashboard metrics computed from uploaded workbook.</p>
                    </div>
                  ) : (
                    <>
                      <div className="px-3 py-2 text-[12px] text-slate-600">
                        <p className="font-semibold text-slate-800">Demo Preview Active</p>
                        <p className="text-[11px] text-slate-500">Upload your Excel or CSV file to activate live figures.</p>
                      </div>
                      <div className="px-3 py-2 text-[12px] text-slate-600">
                        <p className="font-semibold text-amber-700">Cash Drawer Variance</p>
                        <p className="text-[11px] text-slate-500">Drawer variance of LKR -840 flagged in demo preview.</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Pill */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
            <div className="size-8 rounded-full bg-[#1E293B] text-white font-bold text-[12px] grid place-items-center shadow-xs">
              AS
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[12px] font-bold text-slate-800 leading-tight">Amila Silva</span>
              <span className="text-[10px] text-slate-500 leading-tight">Account Officer</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace with Sidebar & Dashboard Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Dark Navy Sidebar */}
        <aside className="w-64 bg-[#091E3A] text-slate-200 flex flex-col shrink-0 justify-between select-none">
          <div>
            <div className="h-16 px-4 flex items-center gap-3 border-b border-slate-800/80">
              <div className="size-8 rounded-lg bg-[#D92D20] flex items-center justify-center text-white font-black text-sm shadow-sm">
                ✉
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[14px] text-white tracking-tight">PostAssist LK</span>
                <span className="text-[10px] text-slate-400">Sri Lanka Post — Daily Accounts</span>
              </div>
            </div>

            {/* Navigation Menu */}
            <nav className="p-3 space-y-0.5">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.label
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setActiveTab(item.label)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                      isActive
                        ? 'bg-[#1D4ED8] text-white shadow-xs font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className={`size-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge ? (
                      <span className="px-1.5 py-0.2 bg-red-500/80 text-white rounded-full text-[10px] font-bold">
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Bottom Illustration Vector Art & Link to KPI Desk */}
          <div className="p-4 border-t border-slate-800/80 text-center">
            <Link
              to="/employee"
              className="inline-flex items-center gap-1.5 text-[11px] text-blue-300 hover:text-white mb-3 transition-colors"
            >
              <Home className="size-3" />
              <span>Back to Postal KPI Desk</span>
            </Link>
            <div className="w-full h-16 rounded-lg bg-slate-800/40 border border-slate-700/50 flex flex-col items-center justify-center text-slate-400 p-2">
              <Building2 className="size-6 text-slate-400 mb-1" />
              <span className="text-[10px] font-semibold text-slate-300">Sri Lanka Post</span>
              <span className="text-[8px] text-slate-400 italic">Connecting People, Delivering Dreams</span>
            </div>
          </div>
        </aside>

        {/* Center Main Dashboard Area */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Main Title Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Post Office Daily Accounts</h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                    isRealData
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-blue-50 text-blue-800 border-blue-200'
                  }`}
                >
                  {isRealData ? '● Live Data Connected' : '● Demo Preview Mode'}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                Upload daily account data, validate, review and analyze your post office transactions.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await downloadConsolidatedDailyExcel(selectedOffice, `${startDate}_to_${endDate}`)
                  } catch (err) {
                    setUploadError(err.message || 'Failed to download consolidated Excel')
                  }
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
                title="Download 7-Sheet Master Consolidated Workbook"
              >
                <Download className="size-3.5" />
                <span>Consolidated Excel</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-[12px] font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Download className="size-3.5" />
                <span>Sample Template</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  resetDailyAccountsDemo().then(() => {
                    setDataMode('demo')
                    loadData()
                  })
                }}
                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-[12px] font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <RefreshCw className="size-3.5" />
                <span>Reset Demo Data</span>
              </button>
            </div>
          </div>

          {/* VIEW: OVERVIEW */}
          {activeTab === 'Overview' && (
            <>
              {/* Alert Banners: Upload Success and Errors */}
              {uploadSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-900 text-xs font-medium shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <CheckCircle className="size-4" />
                    </div>
                    <div>
                      <div className="font-bold text-emerald-950 text-sm">Upload & Ingestion Completed</div>
                      <div>{uploadSuccess}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadSuccess('')}
                    className="text-emerald-700 hover:text-emerald-900 p-1 rounded-lg"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              )}

              {uploadError && !isUploadModalOpen && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-rose-900 text-xs font-medium shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0">
                      <AlertCircle className="size-4" />
                    </div>
                    <div>
                      <div className="font-bold text-rose-950 text-sm">Ingestion Notice</div>
                      <div>{uploadError}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsUploadModalOpen(true)}
                      className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700"
                    >
                      Open Wizard
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadError('')}
                      className="text-rose-700 hover:text-rose-900 p-1 rounded-lg"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* TOP ROW: Upload Box + 4 KPI Cards */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                {/* Upload Card (Span 4) */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  className="xl:col-span-4 bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className="size-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="size-6 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 leading-snug">Upload Excel or CSV File</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Drag and drop your file here or{' '}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-blue-600 font-semibold underline hover:text-blue-700"
                        >
                          Choose File
                        </button>
                      </p>
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleFileInputChange}
                  />

                  {/* Checklist & Action Box */}
                  <div className="mt-3 bg-blue-50/60 rounded-xl border border-blue-100 p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700">
                        <Info className="size-3" />
                        {isRealData ? 'Live Data Active — Upload to Append/Replace' : 'Demo preview - sample data only'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-600">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="size-3 text-emerald-600" /> File validation
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="size-3 text-emerald-600" /> Column mapping
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="size-3 text-emerald-600" /> Preview data
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="size-3 text-emerald-600" /> Detect errors & duplicates
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (uploadFile) {
                          setIsUploadModalOpen(true)
                          setModalStep(1)
                        } else {
                          fileInputRef.current?.click()
                        }
                      }}
                      className="mt-1 w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                    >
                      <FileCheck className="size-3.5" />
                      <span>Upload & Map Columns</span>
                    </button>
                  </div>
                  <div className="mt-2 text-[10px] text-slate-400 text-center">
                    Supported formats: .xlsx, .xls, .csv | Max size: 10 MB
                  </div>
                </div>

                {/* 6 Metric Cards */}
                <div className="xl:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {/* Card 1: Money Orders */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-colors">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="size-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                          <Mail className="size-5 text-blue-600" />
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${
                          kpis.money_orders?.has_data
                            ? 'text-blue-700 bg-blue-50 border border-blue-100'
                            : 'text-slate-500 bg-slate-100 border border-slate-200'
                        }`}>
                          {kpis.money_orders?.badge || 'NO DATA'}
                        </span>
                      </div>
                      <div className="mt-3">
                        <span className="text-xs font-medium text-slate-500">Money Orders</span>
                        <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5 tracking-tight truncate">
                          {kpis.money_orders?.has_data
                            ? (kpis.money_orders.formatted_amount && kpis.money_orders.formatted_amount !== 'No Data'
                                ? kpis.money_orders.formatted_amount
                                : kpis.money_orders.formatted_value)
                            : 'No Data'}
                        </div>
                        <div className="text-[11px] font-semibold text-blue-700 mt-0.5 truncate">
                          {kpis.money_orders?.has_data
                            ? (kpis.money_orders.secondary_metric || `${kpis.money_orders.value || 0} transactions`)
                            : (kpis.money_orders?.status_label || 'Upload dataset to begin')}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 truncate">
                      <span className="truncate">{kpis.money_orders?.status_label || kpis.money_orders?.trend}</span>
                    </div>
                  </div>

                  {/* Card 2: Utility Collections */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between hover:border-emerald-300 transition-colors">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="size-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                          <Zap className="size-5 text-emerald-600" />
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${
                          kpis.utility_collections?.has_data
                            ? 'text-emerald-700 bg-emerald-50 border border-emerald-100'
                            : 'text-slate-500 bg-slate-100 border border-slate-200'
                        }`}>
                          {kpis.utility_collections?.badge || 'NO DATA'}
                        </span>
                      </div>
                      <div className="mt-3">
                        <span className="text-xs font-medium text-slate-500">Utility Collections</span>
                        <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5 tracking-tight truncate">
                          {kpis.utility_collections?.has_data
                            ? (kpis.utility_collections.formatted_amount || kpis.utility_collections.formatted_value)
                            : 'No Data'}
                        </div>
                        <div className="text-[11px] font-semibold text-emerald-700 mt-0.5 truncate">
                          {kpis.utility_collections?.has_data
                            ? (kpis.utility_collections.secondary_metric || `${kpis.utility_collections.bills_count || 0} bills collected`)
                            : (kpis.utility_collections?.status_label || 'Upload dataset to begin')}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 truncate">
                      <span className="truncate">{kpis.utility_collections?.status_label || kpis.utility_collections?.trend}</span>
                    </div>
                  </div>

                  {/* Card 3: Postal Revenue */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between hover:border-amber-300 transition-colors">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="size-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                          <Coins className="size-5 text-amber-600" />
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${
                          kpis.postal_revenue?.has_data
                            ? 'text-amber-700 bg-amber-50 border border-amber-100'
                            : 'text-slate-500 bg-slate-100 border border-slate-200'
                        }`}>
                          {kpis.postal_revenue?.badge || 'NO DATA'}
                        </span>
                      </div>
                      <div className="mt-3">
                        <span className="text-xs font-medium text-slate-500">Postal Revenue</span>
                        <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5 tracking-tight truncate">
                          {kpis.postal_revenue?.has_data
                            ? (kpis.postal_revenue.formatted_amount || kpis.postal_revenue.formatted_value)
                            : 'No Data'}
                        </div>
                        <div className="text-[11px] font-semibold text-amber-700 mt-0.5 truncate">
                          {kpis.postal_revenue?.has_data
                            ? (kpis.postal_revenue.secondary_metric || `${kpis.postal_revenue.items_count || 0} fee items`)
                            : (kpis.postal_revenue?.status_label || 'Upload dataset to begin')}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 truncate">
                      <span className="truncate">{kpis.postal_revenue?.status_label || kpis.postal_revenue?.trend}</span>
                    </div>
                  </div>

                  {/* Card 4: Stamps Counter Revenue */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between hover:border-indigo-300 transition-colors">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="size-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                          <Stamp className="size-5 text-indigo-600" />
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${
                          kpis.stamps_revenue?.has_data
                            ? 'text-indigo-700 bg-indigo-50 border border-indigo-100'
                            : 'text-slate-500 bg-slate-100 border border-slate-200'
                        }`}>
                          {kpis.stamps_revenue?.badge || 'NO DATA'}
                        </span>
                      </div>
                      <div className="mt-3">
                        <span className="text-xs font-medium text-slate-500">Stamps Counter Revenue</span>
                        <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5 tracking-tight truncate">
                          {kpis.stamps_revenue?.has_data
                            ? (kpis.stamps_revenue.formatted_amount || kpis.stamps_revenue.formatted_value)
                            : 'No Data'}
                        </div>
                        <div className="text-[11px] font-semibold text-indigo-700 mt-0.5 truncate">
                          {kpis.stamps_revenue?.has_data
                            ? (kpis.stamps_revenue.secondary_metric || `${kpis.stamps_revenue.stamp_count || 0} issues sold`)
                            : (kpis.stamps_revenue?.status_label || 'Upload dataset to begin')}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 truncate">
                      <span className="truncate">{kpis.stamps_revenue?.status_label || kpis.stamps_revenue?.trend}</span>
                    </div>
                  </div>

                  {/* Card 5: Pension & Welfare */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between hover:border-purple-300 transition-colors">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="size-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center">
                          <Users className="size-5 text-purple-600" />
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${
                          kpis.pension_welfare?.has_data
                            ? 'text-purple-700 bg-purple-50 border border-purple-100'
                            : 'text-slate-500 bg-slate-100 border border-slate-200'
                        }`}>
                          {kpis.pension_welfare?.badge || 'NO DATA'}
                        </span>
                      </div>
                      <div className="mt-3">
                        <span className="text-xs font-medium text-slate-500">Pension & Welfare (GL-2201)</span>
                        <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5 tracking-tight truncate">
                          {kpis.pension_welfare?.has_data
                            ? (kpis.pension_welfare.formatted_amount || kpis.pension_welfare.formatted_value)
                            : 'No Data'}
                        </div>
                        <div className="text-[11px] font-semibold text-purple-700 mt-0.5 truncate">
                          {kpis.pension_welfare?.has_data
                            ? (kpis.pension_welfare.secondary_metric || `${kpis.pension_welfare.count || 0} beneficiaries paid`)
                            : (kpis.pension_welfare?.status_label || 'Upload dataset to begin')}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 truncate">
                      <span className="truncate">{kpis.pension_welfare?.status_label || kpis.pension_welfare?.trend}</span>
                    </div>
                  </div>

                  {/* Card 6: Stamp Stock Ledger (Asset Valuation) */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between hover:border-teal-300 transition-colors">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="size-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center">
                          <Layers className="size-5 text-teal-600" />
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${
                          kpis.stamp_stock?.has_data
                            ? 'text-teal-700 bg-teal-50 border border-teal-100'
                            : 'text-slate-500 bg-slate-100 border border-slate-200'
                        }`}>
                          {kpis.stamp_stock?.badge || 'ASSET LEDGER'}
                        </span>
                      </div>
                      <div className="mt-3">
                        <span className="text-xs font-medium text-slate-500">Stamp Stock Ledger (GL-1201)</span>
                        <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5 tracking-tight truncate">
                          {kpis.stamp_stock?.has_data
                            ? (kpis.stamp_stock.formatted_amount || kpis.stamp_stock.formatted_value)
                            : 'No Data'}
                        </div>
                        <div className="text-[11px] font-semibold text-teal-700 mt-0.5 truncate">
                          {kpis.stamp_stock?.has_data
                            ? (kpis.stamp_stock.secondary_metric || `${kpis.stamp_stock.closing_qty || 0} units in vault`)
                            : (kpis.stamp_stock?.status_label || 'Upload stamp stock ledger')}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 truncate">
                      <span className="truncate">{kpis.stamp_stock?.status_label || 'Asset Valuation (Non-Revenue)'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* MIDDLE ROW: 3 Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Chart 1: Weekly Transaction Trend */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="size-4 text-slate-600" />
                      <h3 className="text-sm font-bold text-slate-900">Weekly Transaction Trend</h3>
                    </div>
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px] font-medium">
                      {['Day', 'Week', 'Month'].map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setTrendMode(mode)}
                          className={`px-2 py-0.5 rounded-md transition-colors ${
                            trendMode === mode ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'text-slate-600'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-2">
                    <select
                      value={selectedWeek}
                      onChange={(e) => setSelectedWeek(e.target.value)}
                      className="text-[11px] font-medium text-slate-700 border border-slate-200 rounded-md px-2 py-1 bg-white focus:outline-none"
                    >
                      {(trends?.available_periods || [selectedWeek]).map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Multi-Line SVG Chart */}
                  <div className="h-44 w-full relative">
                    <svg viewBox="0 0 320 160" className="w-full h-full">
                      {[0, 40, 80, 120, 160].map((y) => (
                        <line key={y} x1="30" y1={y} x2="310" y2={y} stroke="#F1F5F9" strokeWidth="1" />
                      ))}
                      <text x="25" y="15" textAnchor="end" className="text-[8px] fill-slate-400">Max</text>
                      <text x="25" y="85" textAnchor="end" className="text-[8px] fill-slate-400">Mid</text>
                      <text x="25" y="158" textAnchor="end" className="text-[8px] fill-slate-400">0</text>

                      {/* Render curves dynamically from data */}
                      {trends?.series?.map((s, sIdx) => {
                        const vals = s.data || []
                        const maxVal = Math.max(...vals, 1000)
                        const pts = vals.map((v, i) => {
                          const x = 40 + i * (240 / Math.max(1, vals.length - 1))
                          const y = 145 - (v / maxVal) * 120
                          return `${x},${y}`
                        }).join(' ')

                        return (
                          <g key={s.name}>
                            <polyline fill="none" stroke={s.color} strokeWidth="2.5" points={pts} />
                            {vals.map((v, i) => {
                              const x = 40 + i * (240 / Math.max(1, vals.length - 1))
                              const y = 145 - (v / maxVal) * 120
                              return <circle key={i} cx={x} cy={y} r="3" fill={s.color} />
                            })}
                          </g>
                        )
                      })}
                    </svg>
                  </div>

                  {/* Categories X-Axis */}
                  <div className="flex justify-between px-6 text-[9px] text-slate-400 mt-1">
                    {(trends?.categories || []).map((c, i) => (
                      <span key={i}>{c}</span>
                    ))}
                  </div>

                  {/* Legend */}
                  <div className="flex items-center justify-center gap-4 text-[10px] text-slate-600 mt-3 pt-2 border-t border-slate-100">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-blue-600" /> Money Orders
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-500" /> Utility Collections
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-amber-500" /> Postal Revenue
                    </span>
                  </div>
                </div>

                {/* Chart 2: Daily Money Order Count & Amount */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="size-4 text-blue-600" />
                      <h3 className="text-sm font-bold text-slate-900">Daily Money Order Count & Amount</h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] mb-2">
                    <span className="flex items-center gap-1.5 text-blue-600 font-semibold">
                      <span className="size-2.5 rounded-xs bg-blue-500 inline-block" /> Count
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                      <span className="size-2 rounded-full bg-emerald-500 inline-block" /> Amount (LKR)
                    </span>
                  </div>

                  {/* Dual Axis SVG Chart */}
                  <div className="h-44 w-full relative">
                    <svg viewBox="0 0 320 160" className="w-full h-full">
                      <text x="18" y="15" textAnchor="end" className="text-[8px] fill-blue-600 font-medium">Vol</text>
                      <text x="18" y="158" textAnchor="end" className="text-[8px] fill-blue-600 font-medium">0</text>
                      <text x="315" y="15" textAnchor="start" className="text-[8px] fill-emerald-600 font-medium">LKR</text>
                      <text x="315" y="158" textAnchor="start" className="text-[8px] fill-emerald-600 font-medium">0</text>

                      {/* Dynamic Bars & Line */}
                      {(() => {
                        const counts = dualChart?.bars?.data || []
                        const amounts = dualChart?.line?.data || []
                        const maxCount = Math.max(...counts, 10)
                        const maxAmt = Math.max(...amounts, 1000)

                        const barWidth = 14
                        const linePts = amounts.map((a, i) => {
                          const x = 43 + i * (240 / Math.max(1, amounts.length - 1))
                          const y = 145 - (a / maxAmt) * 110
                          return `${x},${y}`
                        }).join(' ')

                        return (
                          <>
                            {counts.map((c, i) => {
                              const x = 36 + i * (240 / Math.max(1, counts.length - 1))
                              const h = (c / maxCount) * 90
                              const y = 155 - h
                              return <rect key={i} x={x} y={y} width={barWidth} height={h} rx="2" fill="#3B82F6" opacity="0.9" />
                            })}
                            {amounts.length > 0 && (
                              <polyline fill="none" stroke="#10B981" strokeWidth="2" points={linePts} />
                            )}
                            {amounts.map((a, i) => {
                              const x = 43 + i * (240 / Math.max(1, amounts.length - 1))
                              const y = 145 - (a / maxAmt) * 110
                              return <circle key={i} cx={x} cy={y} r="3" fill="#10B981" stroke="#ffffff" strokeWidth="1.5" />
                            })}
                          </>
                        )
                      })()}
                    </svg>
                  </div>

                  <div className="flex justify-between px-6 text-[9px] text-slate-400 mt-1">
                    {(dualChart?.categories || []).map((c, i) => (
                      <span key={i}>{c}</span>
                    ))}
                  </div>
                </div>

                {/* Chart 3: Monthly Revenue Breakdown */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <PieChart className="size-4 text-slate-700" />
                      <h3 className="text-sm font-bold text-slate-900">Monthly Revenue Breakdown</h3>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="shrink-0">
                      <RevenueDonutChart
                        slices={revenueBreakdown?.slices || []}
                        totalFormatted={revenueBreakdown?.formatted_total}
                      />
                    </div>
                    <div className="flex-1 max-h-48 overflow-y-auto space-y-1 pr-1 text-[11px]">
                      {(revenueBreakdown?.slices || []).map((s, i) => (
                        <div key={i} className="flex items-center justify-between py-0.5">
                          <span className="flex items-center gap-1.5 truncate">
                            <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                            <span className="truncate text-slate-700">{s.name}</span>
                          </span>
                          <span className="text-slate-900 font-semibold shrink-0 ml-2">
                            {s.amount.toLocaleString()} <span className="text-slate-400 font-normal">({s.percent}%)</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* BOTTOM ROW: Completeness Gauge, Recent Uploaded Sheet, Cash Reconciliation */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* 1. Daily Account Completeness */}
                <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900">Daily Account Completeness</h3>
                  </div>

                  <div className="flex flex-col items-center justify-center my-1">
                    <CompletenessGauge percent={summary?.completeness?.percent || 100} />
                  </div>

                  <div className="space-y-1.5 text-xs pt-3 border-t border-slate-100">
                    {(summary?.completeness?.breakdown || []).map((b, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <span className="size-2 rounded-full" style={{ backgroundColor: b.color }} /> {b.label}
                        </span>
                        <span className="font-semibold text-slate-900">
                          {b.count} <span className="text-slate-400 font-normal">({b.percent}%)</span>
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 text-[11px] text-slate-400 text-center font-medium">
                    Total transactions: {summary?.completeness?.total_transactions || 0}
                  </div>
                </div>

                {/* 2. Recent Uploaded Sheet */}
                <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="size-4 text-blue-600" />
                      <h3 className="text-sm font-bold text-slate-900">Recent Uploaded Sheet</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('Daily Account Upload')}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                    >
                      View All
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400">
                          <th className="pb-2">Date</th>
                          <th className="pb-2">Category</th>
                          <th className="pb-2 text-right">Count</th>
                          <th className="pb-2 text-right">Amount (LKR)</th>
                          <th className="pb-2 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {recentSheets.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2 font-medium text-slate-700">{r.date}</td>
                            <td className="py-2 text-slate-800">{r.category}</td>
                            <td className="py-2 text-right text-slate-600">{r.count}</td>
                            <td className="py-2 text-right font-semibold text-slate-900">
                              {r.amount.toLocaleString()}
                            </td>
                            <td className="py-2 text-right">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  r.status === 'Complete'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                    : 'bg-amber-50 text-amber-700 border border-amber-100'
                                }`}
                              >
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Showing latest {recentSheets.length} transactions</span>
                    <span className="text-blue-600 font-medium">
                      {isRealData ? 'Live Data Store' : 'Batch BATCH-DEMO-2026'}
                    </span>
                  </div>
                </div>

                {/* 3. Cash Reconciliation */}
                <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Wallet className="size-4 text-slate-700" />
                      <h3 className="text-sm font-bold text-slate-900">Cash Reconciliation</h3>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    {(cashRecon?.items || []).map((it, idx) => {
                      const isVar = it.type === 'variance'
                      const isExpected = it.label.includes('Expected')
                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between py-1 ${
                            isExpected ? 'pt-2 border-t border-slate-100 font-bold' : ''
                          } ${isVar ? 'pt-1.5 border-t border-slate-100' : ''}`}
                        >
                          <span className="flex items-center gap-2 text-slate-600">
                            <span
                              className={`size-2 rounded-full ${
                                isVar ? (it.amount !== 0 ? 'bg-rose-500' : 'bg-emerald-500') : 'bg-blue-600'
                              }`}
                            />
                            <span className={isVar || isExpected ? 'font-bold text-slate-800' : ''}>
                              {it.label}
                            </span>
                          </span>
                          <span
                            className={`font-semibold ${
                              isVar ? (it.amount !== 0 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold') : 'text-slate-900'
                            }`}
                          >
                            {formatLkrCurrency(it.amount)}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-3 p-2 bg-slate-50 border border-slate-200/80 rounded-lg text-[10px] text-slate-700 flex items-center gap-1.5">
                    <AlertCircle className="size-3.5 text-blue-600 shrink-0" />
                    <span>{cashRecon?.notes || 'Reconciliation calculated using official postal accounting formulas.'}</span>
                  </div>
                </div>
              </div>

              {/* FOOTER BANNER: Simple 5-Step Process */}
              <div className="bg-[#EBF3FC] border border-blue-200/80 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Info className="size-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 leading-snug">
                      Simple 5-step process to get your daily accounts ready
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Standard workflow for daily revenue reporting and postmaster approvals.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 md:gap-4 overflow-x-auto text-xs font-semibold text-slate-700">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="size-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[11px] font-bold">
                      <Upload className="size-3.5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-900">1. Upload</div>
                      <div className="text-[9px] text-slate-500">Excel / CSV file</div>
                    </div>
                  </div>
                  <ArrowRight className="size-3 text-slate-400 shrink-0" />

                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="size-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-bold">
                      <Check className="size-3.5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-900">2. Validate</div>
                      <div className="text-[9px] text-slate-500">Check data & errors</div>
                    </div>
                  </div>
                  <ArrowRight className="size-3 text-slate-400 shrink-0" />

                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="size-7 rounded-full bg-amber-500 text-white flex items-center justify-center text-[11px] font-bold">
                      <AlertTriangle className="size-3.5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-900">3. Review errors</div>
                      <div className="text-[9px] text-slate-500">Fix and confirm</div>
                    </div>
                  </div>
                  <ArrowRight className="size-3 text-slate-400 shrink-0" />

                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="size-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] font-bold">
                      <FileCheck className="size-3.5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-900">4. Confirm</div>
                      <div className="text-[9px] text-slate-500">Import transactions</div>
                    </div>
                  </div>
                  <ArrowRight className="size-3 text-slate-400 shrink-0" />

                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="size-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-[11px] font-bold">
                      <PieChart className="size-3.5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-900">5. Analyze</div>
                      <div className="text-[9px] text-slate-500">View reports & insights</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* VIEW: DAILY ACCOUNT UPLOAD & INGESTION HUB */}
          {activeTab === 'Daily Account Upload' && (
            <div className="space-y-6">
              {/* Header card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Daily Accounts File Ingestion & Management</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Upload an Excel (.xlsx, .xls) or .csv file to inspect worksheets, map column headers, and preview records before committing to live MongoDB collections.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="px-3.5 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Download className="size-3.5" />
                    <span>Download Sample Template</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (uploadFile) {
                        setIsUploadModalOpen(true)
                        setModalStep(1)
                      } else {
                        fileInputRef.current?.click()
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Upload className="size-3.5" />
                    <span>{uploadFile ? 'Open Ingestion Wizard' : 'Upload Spreadsheet'}</span>
                  </button>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-2xl p-8 bg-blue-50/30 flex flex-col items-center justify-center cursor-pointer transition-colors"
              >
                <div className="size-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
                  <Upload className="size-7" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  {uploadFile ? uploadFile.name : 'Choose an Excel or CSV spreadsheet to upload'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Drag and drop here, or browse files from your computer (Max: 10 MB)
                </p>
                <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-600">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="size-3 text-emerald-600" /> Multi-worksheet detection
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="size-3 text-emerald-600" /> 11-field postal column mapping
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="size-3 text-emerald-600" /> Live interactive preview
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="size-3 text-emerald-600" /> Append or Replace mode
                  </span>
                </div>
              </div>

              {/* Ready to Map notice if file selected */}
              {uploadFile && inspectData && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-900 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <FileCheck className="size-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm">Workbook Inspected & Ready</div>
                      <div>
                        {uploadFile.name} ({formatFileSize(uploadFile.size)}) · {inspectData.detected_headers?.length || 0} headers identified. Click to open the mapping wizard.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUploadModalOpen(true)
                      setModalStep(1)
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
                  >
                    <span>Launch Mapping Wizard</span>
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>
              )}

              {/* Recent Ingestion Batches & History */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Recent Ingestion Batches & Audit Trail</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Historical log of spreadsheets ingested for {selectedOfficeName}.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => getDailyAccountsImports(selectedOffice).then(setImportBatches)}
                    className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className="size-3.5" />
                    <span>Refresh History</span>
                  </button>
                </div>

                {importBatches.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    <FileSpreadsheet className="size-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No Past Upload Batches Recorded</p>
                    <p className="text-slate-500 mt-0.5">
                      Upload your first daily accounts spreadsheet above to initiate the live ledger.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                        <tr>
                          <th className="p-3">Batch ID</th>
                          <th className="p-3">File Name</th>
                          <th className="p-3">Uploaded At</th>
                          <th className="p-3">Mode</th>
                          <th className="p-3 text-right">Valid Rows</th>
                          <th className="p-3 text-right">Duplicates</th>
                          <th className="p-3 text-right">Errors</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Validation Report</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importBatches.map((b) => (
                          <tr key={b.batch_id} className="hover:bg-slate-50">
                            <td className="p-3 font-mono font-bold text-slate-800">{b.batch_id}</td>
                            <td className="p-3 font-medium text-slate-700">{b.file_name}</td>
                            <td className="p-3 text-slate-500">{b.uploaded_at ? b.uploaded_at.replace('T', ' ').slice(0, 16) : '—'}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700">
                                {b.import_mode || 'append'}
                              </span>
                            </td>
                            <td className="p-3 text-right font-bold text-emerald-700">{b.valid_rows ?? b.total_rows}</td>
                            <td className="p-3 text-right font-medium text-purple-700">{b.duplicate_rows ?? 0}</td>
                            <td className="p-3 text-right font-medium text-rose-700">{b.invalid_rows ?? 0}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                {b.status || 'Committed'}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleDownloadBatchValidationReport(b.batch_id)}
                                className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors shadow-2xs"
                              >
                                <Download className="size-3 text-blue-600" />
                                <span>CSV</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW: VALIDATION ISSUES */}
          {activeTab === 'Validation Issues' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Validation Issues & Exceptions</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Detect missing required cells, duplicate references, and cash reconciliation variances.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">
                    Total Issues: <span className="text-slate-900 font-bold">{validationIssues.length}</span>
                  </span>
                </div>
              </div>

              {validationIssues.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  <CheckCircle2 className="size-10 text-emerald-500 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700">No Validation Issues Found</p>
                  <p className="text-xs text-slate-500 mt-0.5">All ingested transaction records comply with postal accounting standards.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="p-3">Severity</th>
                        <th className="p-3">Row</th>
                        <th className="p-3">Column</th>
                        <th className="p-3">Original Value</th>
                        <th className="p-3">Validation Message</th>
                        <th className="p-3">Suggested Fix</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {validationIssues.map((issue) => (
                        <tr key={issue.id} className="hover:bg-slate-50">
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                issue.severity === 'Error'
                                  ? 'bg-rose-100 text-rose-800'
                                  : issue.severity === 'Warning'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {issue.severity}
                            </span>
                          </td>
                          <td className="p-3 font-medium text-slate-600">#{issue.row_number}</td>
                          <td className="p-3 font-semibold text-slate-800">{issue.column_name}</td>
                          <td className="p-3 font-mono text-slate-500">{issue.original_value}</td>
                          <td className="p-3 text-slate-700">{issue.message}</td>
                          <td className="p-3 text-slate-500 text-[11px]">{issue.suggested_fix}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                issue.status === 'Resolved'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {issue.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            {issue.status !== 'Resolved' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedIssue(issue)
                                  setCorrectionInput(issue.original_value !== 'BLANK' ? issue.original_value : '')
                                }}
                                className="px-2.5 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-semibold"
                              >
                                Resolve
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400">Resolved</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* VIEW: GL PREDICTION */}
          {activeTab === 'GL Prediction' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">General Ledger (GL) Account Classification</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pre-trained postal accounting rules predicting GL codes for daily counter collections and remittances.
                  </p>
                </div>
              </div>

              {glPredictions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  <ShieldCheck className="size-10 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700">No Transactions Available for GL Prediction</p>
                  <p className="text-xs text-slate-500 mt-0.5">Upload a daily accounts spreadsheet to view GL classifications.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Category</th>
                        <th className="p-3 text-right">Amount (LKR)</th>
                        <th className="p-3">Reference</th>
                        <th className="p-3">Predicted GL Code</th>
                        <th className="p-3">Account Description</th>
                        <th className="p-3">Approved GL Code</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {glPredictions.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="p-3 text-slate-600">{row.date}</td>
                          <td className="p-3 font-semibold text-slate-800">{row.category}</td>
                          <td className="p-3 text-right font-bold text-slate-900">{formatLkrCurrency(row.amount)}</td>
                          <td className="p-3 font-mono text-slate-500">{row.reference_no}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-mono font-bold rounded">
                              {row.predicted_gl_code}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600">{row.gl_name}</td>
                          <td className="p-3 font-mono font-bold text-slate-800">{row.approved_gl_code}</td>
                          <td className="p-3 text-right">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* VIEW: AUDIT HISTORY */}
          {activeTab === 'Audit History' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Audit Trail & Activity Log</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Immutable history of file uploads, manual corrections, supervisory verifications, and approvals.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {auditHistory.map((item, i) => (
                  <div key={i} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                        <History className="size-4" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-800">{item.action}</span>
                        <p className="text-slate-500 text-[11px]">
                          By {item.user} · {item.file_name || item.issue_id || item.record_id}
                        </p>
                      </div>
                    </div>
                    <span className="text-slate-400 font-mono text-[10px]">{item.timestamp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW: CATEGORY DETAILS (Money Orders, Postal Services, Utility Collections, Pension, etc.) */}
          {[
            'Money Orders',
            'Postal Services',
            'Utility Collections',
            'Pension & Welfare',
            'Cash & Stamp Stock',
            'Expenses & Imprest',
          ].includes(activeTab) && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              {/* Category Header with Action Buttons */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">{activeTab} Ledger View</h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      {selectedOfficeName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Official Sri Lanka Post sub-ledger records, clerk submissions, and supervisory approvals for {activeTab}.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => openAddTxModal(activeTab)}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Plus className="size-3.5" />
                    <span>
                      {activeTab === 'Money Orders'
                        ? 'Add Money Order'
                        : activeTab === 'Postal Services'
                        ? 'Add Postal Service'
                        : activeTab === 'Utility Collections'
                        ? 'Add Utility Bill'
                        : activeTab === 'Pension & Welfare'
                        ? 'Add Pension Disbursement'
                        : activeTab === 'Cash & Stamp Stock'
                        ? 'Add Stamp Stock Entry'
                        : 'Add Transaction'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await downloadDailyAccountCategoryExcel(activeTab, selectedOffice, startDate, endDate)
                      } catch (err) {
                        alert(err.message || 'Failed to download Category Excel')
                      }
                    }}
                    className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                    title="Export formatted Excel sub-register for this category"
                  >
                    <Download className="size-3.5 text-emerald-700" />
                    <span>Daily Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('Overview')}
                    className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Back to Overview
                  </button>
                </div>
              </div>

              {/* Live Search and Status Filter Pills */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div className="relative flex-1 max-w-sm">
                  <Search className="size-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    placeholder="Search by reference, remitter, recipient, or clerk..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-blue-500"
                  />
                  {categorySearch && (
                    <button
                      type="button"
                      onClick={() => setCategorySearch('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 overflow-x-auto text-xs">
                  {[
                    { id: 'all', label: 'All Records' },
                    { id: 'Submitted', label: 'Submitted (Pending Review)' },
                    { id: 'Reviewed', label: 'Reviewed / Approved' },
                    { id: 'Draft', label: 'Draft' },
                    { id: 'Rejected', label: 'Rejected' },
                  ].map((filterTab) => (
                    <button
                      key={filterTab.id}
                      type="button"
                      onClick={() => setCategoryStatusFilter(filterTab.id)}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors text-[11px] whitespace-nowrap ${
                        categoryStatusFilter === filterTab.id
                          ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {filterTab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Metric Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100">
                  <span className="text-xs text-slate-500 font-medium">Period Total Recorded</span>
                  <div className="text-xl font-bold text-slate-900 mt-1">
                    {categoryData?.formatted_amount || 'LKR 0'}
                  </div>
                  <div className="text-[11px] text-blue-600 mt-0.5">
                    {activeTab === 'Cash & Stamp Stock' ? 'Asset Vault Ledger (Non-Revenue)' : 'Verified & Pending Collections'}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                  <span className="text-xs text-slate-500 font-medium">Total Transactions / Entries</span>
                  <div className="text-xl font-bold text-emerald-800 mt-1">
                    {categoryTransactions.length > 0 ? categoryTransactions.length : (categoryData?.total_count || 0)}
                  </div>
                  <div className="text-[11px] text-emerald-600 mt-0.5">
                    {categoryTransactions.filter(r => r.status === 'Reviewed').length} reviewed & approved
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100">
                  <span className="text-xs text-slate-500 font-medium">Accounting Classification</span>
                  <div className="text-sm font-bold text-purple-800 mt-1">
                    {activeTab === 'Money Orders'
                      ? 'Money Order Collections (GL-2101)'
                      : activeTab === 'Postal Services'
                      ? 'Postal Services Revenue (GL-4101)'
                      : activeTab === 'Utility Collections'
                      ? 'Agency Utility Collections (GL-2102)'
                      : activeTab === 'Pension & Welfare'
                      ? 'Government Disbursement (GL-2201)'
                      : activeTab === 'Cash & Stamp Stock'
                      ? 'Stamp Inventory Vault (GL-1201)'
                      : 'Operational Expense (GL-5100)'}
                  </div>
                  <div className="text-[11px] text-purple-600 mt-0.5">
                    Sri Lanka Post Standard Financial Regulation
                  </div>
                </div>
              </div>

              {/* Provider Breakdown if available */}
              {categoryData?.providers?.length > 1 && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="text-xs font-bold text-slate-700">Provider & Breakdown Sub-Totals</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {categoryData.providers.map((p, i) => (
                      <div key={i} className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <span className="text-slate-500 block truncate">{p.provider}</span>
                        <span className="font-bold text-slate-800">LKR {p.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transactions Table: Renders categoryTransactions if present, else categoryData.records */}
              {categoryTxLoading ? (
                <div className="p-8 text-center text-slate-500 text-xs">Loading {activeTab} transactions...</div>
              ) : categoryTransactions.length === 0 && (!categoryData?.records || categoryData.records.length === 0) ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  <Layers className="size-10 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700">No Transactions Found for {activeTab}</p>
                  <p className="text-xs text-slate-500 mt-0.5 max-w-md mx-auto">
                    No entries match your search criteria. Add genuine clerk transactions using the button below or upload an Excel dataset.
                  </p>
                  <button
                    type="button"
                    onClick={() => openAddTxModal(activeTab)}
                    className="mt-4 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Plus className="size-3.5" />
                    <span>Record First Transaction</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl mt-4">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                      {activeTab === 'Money Orders' ? (
                        <tr>
                          <th className="p-3">Date</th>
                          <th className="p-3">MO Reference</th>
                          <th className="p-3">Sender (Remitter)</th>
                          <th className="p-3">Recipient (Payee)</th>
                          <th className="p-3 text-right">Amount (LKR)</th>
                          <th className="p-3 text-right">Fee (LKR)</th>
                          <th className="p-3 text-right">Total Collected</th>
                          <th className="p-3">Clerk</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-right">Supervisory Action</th>
                        </tr>
                      ) : activeTab === 'Postal Services' ? (
                        <tr>
                          <th className="p-3">Date</th>
                          <th className="p-3">Receipt / Ref</th>
                          <th className="p-3">Service Type</th>
                          <th className="p-3 text-right">Quantity</th>
                          <th className="p-3 text-right">Unit Charge</th>
                          <th className="p-3 text-right">Total Amount (LKR)</th>
                          <th className="p-3">Clerk</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-right">Supervisory Action</th>
                        </tr>
                      ) : activeTab === 'Utility Collections' ? (
                        <tr>
                          <th className="p-3">Date</th>
                          <th className="p-3">Receipt Ref</th>
                          <th className="p-3">Provider</th>
                          <th className="p-3">Customer / Bill Ref</th>
                          <th className="p-3 text-right">Amount (LKR)</th>
                          <th className="p-3 text-right">Commission</th>
                          <th className="p-3">Clerk</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-right">Supervisory Action</th>
                        </tr>
                      ) : activeTab === 'Pension & Welfare' ? (
                        <tr>
                          <th className="p-3">Date</th>
                          <th className="p-3">Voucher Ref</th>
                          <th className="p-3">Beneficiary / NIC</th>
                          <th className="p-3">Disbursement Scheme</th>
                          <th className="p-3 text-right">Amount (LKR)</th>
                          <th className="p-3">Disbursement Status</th>
                          <th className="p-3">Clerk</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-right">Supervisory Action</th>
                        </tr>
                      ) : activeTab === 'Cash & Stamp Stock' ? (
                        <tr>
                          <th className="p-3">Date</th>
                          <th className="p-3">Register Ref</th>
                          <th className="p-3">Stock Type & Denom</th>
                          <th className="p-3 text-right">Opening</th>
                          <th className="p-3 text-right">Receipts</th>
                          <th className="p-3 text-right">Issues</th>
                          <th className="p-3 text-right">Damaged</th>
                          <th className="p-3 text-right">Closing Units</th>
                          <th className="p-3 text-right">Closing Value (LKR)</th>
                          <th className="p-3">Clerk</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-right">Supervisory Action</th>
                        </tr>
                      ) : activeTab === 'Expenses & Imprest' ? (
                        <tr>
                          <th className="p-3">Date</th>
                          <th className="p-3">Voucher Ref</th>
                          <th className="p-3">Expense Category</th>
                          <th className="p-3">Payee / Description</th>
                          <th className="p-3 text-right">Amount (LKR)</th>
                          <th className="p-3">Payment Method</th>
                          <th className="p-3">Clerk</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-right">Supervisory Action</th>
                        </tr>
                      ) : (
                        <tr>
                          <th className="p-3">Date</th>
                          <th className="p-3">Reference</th>
                          <th className="p-3">Category</th>
                          <th className="p-3 text-right">Volume</th>
                          <th className="p-3 text-right">Amount (LKR)</th>
                          <th className="p-3">Clerk</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      )}
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(categoryTransactions.length > 0 ? categoryTransactions : categoryData?.records || []).map((r, i) => {
                        const recId = r.id || r._id || `tx-${i}`
                        const st = r.status || 'Reviewed'
                        return (
                          <tr key={recId} className="hover:bg-slate-50 transition-colors">
                            {activeTab === 'Money Orders' ? (
                              <>
                                <td className="p-3 text-slate-600 whitespace-nowrap">{r.date}</td>
                                <td className="p-3 font-mono font-medium text-slate-900">{r.reference_no}</td>
                                <td className="p-3 text-slate-800">
                                  <div className="font-semibold">{r.remitter || '—'}</div>
                                  {r.remitter_phone && <div className="text-[10px] text-slate-400">{r.remitter_phone}</div>}
                                </td>
                                <td className="p-3 text-slate-800">
                                  <div className="font-semibold">{r.recipient || '—'}</div>
                                  {r.recipient_phone && <div className="text-[10px] text-slate-400">{r.recipient_phone}</div>}
                                </td>
                                <td className="p-3 text-right font-medium text-slate-800">{Number(r.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="p-3 text-right text-slate-500">{Number(r.service_fee || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="p-3 text-right font-bold text-slate-900">{Number(r.total_collected || r.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              </>
                            ) : activeTab === 'Postal Services' ? (
                              <>
                                <td className="p-3 text-slate-600 whitespace-nowrap">{r.date}</td>
                                <td className="p-3 font-mono font-medium text-slate-900">{r.reference_no}</td>
                                <td className="p-3 font-semibold text-slate-800">{r.service_type || r.provider || 'Postal Counter'}</td>
                                <td className="p-3 text-right text-slate-600">{r.count || 1}</td>
                                <td className="p-3 text-right text-slate-500">{r.unit_charge ? Number(r.unit_charge).toFixed(2) : '—'}</td>
                                <td className="p-3 text-right font-bold text-slate-900">{Number(r.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              </>
                            ) : activeTab === 'Utility Collections' ? (
                              <>
                                <td className="p-3 text-slate-600 whitespace-nowrap">{r.date}</td>
                                <td className="p-3 font-mono font-medium text-slate-900">{r.reference_no}</td>
                                <td className="p-3">
                                  <span className="px-2 py-0.5 rounded-md font-bold bg-amber-50 text-amber-800 border border-amber-200 text-[10px]">
                                    {r.provider || 'General Utility'}
                                  </span>
                                </td>
                                <td className="p-3 font-mono text-slate-700">{r.customer_ref || '—'}</td>
                                <td className="p-3 text-right font-bold text-slate-900">{Number(r.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="p-3 text-right text-emerald-700 font-medium">{Number(r.commission || 0).toFixed(2)}</td>
                              </>
                            ) : activeTab === 'Pension & Welfare' ? (
                              <>
                                <td className="p-3 text-slate-600 whitespace-nowrap">{r.date}</td>
                                <td className="p-3 font-mono font-medium text-slate-900">{r.reference_no}</td>
                                <td className="p-3 font-mono text-slate-800 font-semibold">{r.beneficiary_ref || '—'}</td>
                                <td className="p-3 text-slate-700">{r.transaction_type || 'Civil Pension'}</td>
                                <td className="p-3 text-right font-bold text-rose-900">{Number(r.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="p-3">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                                    {r.payment_status || 'Paid'}
                                  </span>
                                </td>
                              </>
                            ) : activeTab === 'Cash & Stamp Stock' ? (
                              <>
                                <td className="p-3 text-slate-600 whitespace-nowrap">{r.date}</td>
                                <td className="p-3 font-mono font-medium text-slate-900">{r.reference_no}</td>
                                <td className="p-3 font-semibold text-slate-800">
                                  {r.stock_type || 'Postage Stamp'} (Rs. {r.denomination || 0})
                                </td>
                                <td className="p-3 text-right text-slate-600 font-mono">{r.opening_qty ?? '—'}</td>
                                <td className="p-3 text-right text-emerald-700 font-mono">+{r.receipts_qty ?? 0}</td>
                                <td className="p-3 text-right text-amber-700 font-mono">-{r.issued_qty ?? 0}</td>
                                <td className="p-3 text-right text-rose-600 font-mono">-{r.damaged_qty ?? 0}</td>
                                <td className="p-3 text-right font-bold text-slate-900 font-mono">{r.closing_qty ?? 0}</td>
                                <td className="p-3 text-right font-bold text-teal-800">{Number(r.closing_value || r.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              </>
                            ) : activeTab === 'Expenses & Imprest' ? (
                              <>
                                <td className="p-3 text-slate-600 whitespace-nowrap">{r.date}</td>
                                <td className="p-3 font-mono font-medium text-slate-900">{r.reference_no}</td>
                                <td className="p-3 font-semibold text-slate-800">{r.expense_category || r.category || 'Office Expense'}</td>
                                <td className="p-3 text-slate-700">{r.payee || r.vendor || r.remarks || '—'}</td>
                                <td className="p-3 text-right font-bold text-rose-800">{Number(r.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="p-3 text-slate-600">{r.payment_method || 'Cash from Imprest'}</td>
                              </>
                            ) : (
                              <>
                                <td className="p-3 text-slate-600 whitespace-nowrap">{r.date}</td>
                                <td className="p-3 font-mono font-medium text-slate-900">{r.reference_no}</td>
                                <td className="p-3 font-semibold text-slate-800">{r.category}</td>
                                <td className="p-3 text-right text-slate-600">{r.count || 1}</td>
                                <td className="p-3 text-right font-bold text-slate-900">{Number(r.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              </>
                            )}

                            {/* Clerk / Recorded By */}
                            <td className="p-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                              {r.clerk_id || r.created_by || 'clerk'}
                            </td>

                            {/* Status Pill */}
                            <td className="p-3 text-center whitespace-nowrap">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  st === 'Reviewed'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : st === 'Submitted'
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                    : st === 'Draft'
                                    ? 'bg-slate-100 text-slate-700 border border-slate-300'
                                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                                }`}
                              >
                                {st === 'Reviewed' ? 'Approved ✓' : st}
                              </span>
                            </td>

                            {/* Postmaster Actions */}
                            <td className="p-3 text-right whitespace-nowrap">
                              {st === 'Submitted' ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateRecordStatus(recId, 'Reviewed')}
                                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shadow-2xs transition-colors"
                                    title="Postmaster Approve Transaction"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateRecordStatus(recId, 'Rejected')}
                                    className="px-2 py-0.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded text-[10px] font-bold transition-colors"
                                    title="Reject Transaction"
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : st === 'Draft' ? (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateRecordStatus(recId, 'Submitted')}
                                  className="px-2.5 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded text-[10px] font-bold transition-colors"
                                >
                                  Submit
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">Verified</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* VIEW: REPORTS */}
          {activeTab === 'Reports' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              {/* Reports Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">Accounting Reports & Official Registers</h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      {selectedOfficeName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Generate, review, and export official Sri Lanka Postal Department daily collections, sub-registers, and clerk accountability reports.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await downloadDailyAccountsReportExcel(selectedOffice, startDate, endDate)
                      } catch (err) {
                        alert(err.message || 'Failed to download report Excel')
                      }
                    }}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                    title="Download Official 4-Sheet Accounting Report Workbook"
                  >
                    <Download className="size-3.5" />
                    <span>Download Excel Report</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <FileDown className="size-3.5 text-slate-500" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Filters Bar */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-700">Filters:</span>
                  <select
                    value={reportsFilterCategory}
                    onChange={(e) => setReportsFilterCategory(e.target.value)}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-blue-500"
                  >
                    <option value="">All Categories</option>
                    <option value="Money Orders">Money Orders</option>
                    <option value="Postal Services">Postal Services</option>
                    <option value="Utility Collections">Utility Collections</option>
                    <option value="Pension & Welfare">Pension & Welfare</option>
                    <option value="Stamp Stock Ledger">Stamp Stock Ledger</option>
                  </select>

                  <select
                    value={reportsFilterStatus}
                    onChange={(e) => setReportsFilterStatus(e.target.value)}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-blue-500"
                  >
                    <option value="">All Statuses</option>
                    <option value="Reviewed">Reviewed / Approved</option>
                    <option value="Submitted">Submitted (Pending)</option>
                    <option value="Draft">Draft</option>
                    <option value="Rejected">Rejected</option>
                  </select>

                  <input
                    type="text"
                    value={reportsFilterClerk}
                    onChange={(e) => setReportsFilterClerk(e.target.value)}
                    placeholder="Filter by Clerk ID..."
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-blue-500 w-36"
                  />
                </div>

                <div className="text-[11px] text-slate-500">
                  <span className="font-bold text-slate-700">Period:</span> {dateRange || 'All Dates'}
                </div>
              </div>

              {/* Report Sub-Tabs */}
              <div className="flex items-center gap-1 border-b border-slate-200 pb-2 text-xs font-medium">
                {[
                  { id: 'daily_collections', label: 'Daily Collections Register' },
                  { id: 'category_breakdown', label: 'Category & GL Breakdown' },
                  { id: 'clerk_activity', label: 'Clerk Accountability Register' },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setReportsSubTab(st.id)}
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      reportsSubTab === st.id
                        ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Summary Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                  <span className="text-[11px] text-slate-500 font-medium">Total Collections Handled</span>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">
                    {reportsData?.summary?.formatted_total_amount || (reportsData?.summary?.total_amount ? formatLkrCurrency(reportsData.summary.total_amount) : 'LKR 0.00')}
                  </div>
                </div>
                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                  <span className="text-[11px] text-slate-500 font-medium">Total Recorded Transactions</span>
                  <div className="text-lg font-bold text-emerald-800 mt-0.5">
                    {reportsData?.summary?.total_transactions ?? recentSheets.length}
                  </div>
                </div>
                <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                  <span className="text-[11px] text-slate-500 font-medium">Reviewed & Approved Transactions</span>
                  <div className="text-lg font-bold text-purple-800 mt-0.5">
                    {reportsData?.summary?.reviewed_transactions ?? recentSheets.filter(r => r.status === 'Reviewed').length}
                  </div>
                </div>
              </div>

              {/* Sub-Tab 1: Daily Collections Register */}
              {reportsSubTab === 'daily_collections' && (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Reference / Category</th>
                        <th className="p-3">Clerk</th>
                        <th className="p-3 text-right">Transactions</th>
                        <th className="p-3 text-right">Total Amount (LKR)</th>
                        <th className="p-3 text-right">Approved Amount (LKR)</th>
                        <th className="p-3 text-center">Audit Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(reportsData?.daily_collections?.length > 0 ? reportsData.daily_collections : recentSheets).map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 text-slate-600 whitespace-nowrap">{r.date}</td>
                          <td className="p-3 font-semibold text-slate-800">{r.category || r.reference_no}</td>
                          <td className="p-3 text-slate-500 font-mono text-[11px]">{r.clerk_id || 'clerk'}</td>
                          <td className="p-3 text-right text-slate-600">{r.count || 1}</td>
                          <td className="p-3 text-right font-bold text-slate-900">{Number(r.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="p-3 text-right text-emerald-700 font-semibold">{Number(r.reviewed_amount || r.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              {r.status || 'Verified'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Sub-Tab 2: Category & GL Breakdown */}
              {reportsSubTab === 'category_breakdown' && (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                      <tr>
                        <th className="p-3">Category Name</th>
                        <th className="p-3">General Ledger Code</th>
                        <th className="p-3">Accounting Classification</th>
                        <th className="p-3 text-right">Transactions Volume</th>
                        <th className="p-3 text-right">Total Recorded (LKR)</th>
                        <th className="p-3 text-center">Compliance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(reportsData?.category_breakdown || [
                        { category: 'Money Orders', gl_code: 'GL-2101', classification: 'Liability / Remittance', count: 120, total_amount: 850000 },
                        { category: 'Postal Services', gl_code: 'GL-4101', classification: 'Operating Revenue', count: 85, total_amount: 145000 },
                        { category: 'Utility Collections', gl_code: 'GL-2102', classification: 'Agency Collection', count: 240, total_amount: 620000 },
                        { category: 'Pension & Welfare', gl_code: 'GL-2201', classification: 'Government Disbursement', count: 95, total_amount: 475000 },
                        { category: 'Stamp Stock Ledger', gl_code: 'GL-1201', classification: 'Asset Inventory Ledger', count: 42, total_amount: 350000 },
                      ]).map((cb, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-semibold text-slate-900">{cb.category}</td>
                          <td className="p-3 font-mono font-bold text-blue-700">{cb.gl_code}</td>
                          <td className="p-3 text-slate-600">{cb.classification}</td>
                          <td className="p-3 text-right text-slate-700">{cb.count}</td>
                          <td className="p-3 text-right font-bold text-slate-900">{Number(cb.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              SLP-Standard
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Sub-Tab 3: Clerk Accountability Register */}
              {reportsSubTab === 'clerk_activity' && (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                      <tr>
                        <th className="p-3">Clerk / Counter Officer</th>
                        <th className="p-3 text-right">Transactions Submitted</th>
                        <th className="p-3 text-right">Total Cash & Remittance (LKR)</th>
                        <th className="p-3 text-right">Approved by Postmaster</th>
                        <th className="p-3 text-right">Pending Review</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(reportsData?.clerk_activity || [
                        { clerk_id: 'clerk', count: 18, total_amount: 325000, reviewed_count: 14, pending_count: 4 },
                        { clerk_id: 'postmaster', count: 5, total_amount: 110000, reviewed_count: 5, pending_count: 0 },
                      ]).map((ca, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono font-bold text-slate-900">{ca.clerk_id}</td>
                          <td className="p-3 text-right text-slate-700">{ca.count}</td>
                          <td className="p-3 text-right font-bold text-slate-900">{Number(ca.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="p-3 text-right text-emerald-700 font-semibold">{ca.reviewed_count}</td>
                          <td className="p-3 text-right text-blue-600 font-semibold">{ca.pending_count}</td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                              Active
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Upload & Ingestion Wizard Modal (3 Steps) */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Top Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <FileSpreadsheet className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-tight">
                    Daily Accounts Spreadsheet Ingestion
                  </h3>
                  <p className="text-xs text-slate-500">
                    {uploadFile ? uploadFile.name : 'Choose a file'} · {selectedOfficeName}
                  </p>
                </div>
              </div>

              {/* Step indicator pills */}
              <div className="hidden md:flex items-center gap-2 text-xs font-semibold">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${
                    modalStep === 1
                      ? 'bg-blue-600 text-white'
                      : modalStep > 1
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <span className="size-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                    {modalStep > 1 ? '✓' : '1'}
                  </span>
                  <span>Column Mapping</span>
                </div>
                <div className="w-4 h-0.5 bg-slate-200" />
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${
                    modalStep === 2
                      ? 'bg-blue-600 text-white'
                      : modalStep > 2
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <span className="size-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                    {modalStep > 2 ? '✓' : '2'}
                  </span>
                  <span>Live Preview & Audit</span>
                </div>
                <div className="w-4 h-0.5 bg-slate-200" />
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${
                    modalStep === 3
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <span className="size-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                    3
                  </span>
                  <span>Ingestion Mode</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="size-8 rounded-full hover:bg-slate-200/80 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {uploading && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-blue-900 text-xs shadow-xs animate-in fade-in duration-150">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="size-5 animate-spin text-blue-600 shrink-0" />
                    <div>
                      <div className="font-bold text-sm text-blue-950">
                        {STAGE_LABELS[uploadStage]?.title || 'Processing Spreadsheet...'}
                      </div>
                      <div className="text-blue-700 text-xs font-normal mt-0.5">
                        {STAGE_LABELS[uploadStage]?.desc || 'Executing automated postal accounting ingestion and validation pipeline.'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200 shadow-2xs">
                      {STAGE_LABELS[uploadStage]?.badge || 'In Progress'}
                    </span>
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-900 text-xs shadow-xs animate-in fade-in duration-150">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="size-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-sm text-rose-950">Validation or Processing Notice</div>
                      <div className="text-rose-700 text-xs font-normal mt-0.5 leading-relaxed">{uploadError}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => {
                      setUploadError('')
                      if (modalStep === 1) {
                        handleValidateSheet()
                      } else if (modalStep === 3) {
                        handleConfirmImport()
                      } else if (uploadFile) {
                        processSelectedFile(uploadFile)
                      }
                    }}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shrink-0 transition-colors shadow-2xs flex items-center gap-1.5 self-end sm:self-center disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className="size-3.5" />
                    <span>Retry Operation</span>
                  </button>
                </div>
              )}

              {/* STEP 1: Worksheet Selection & Column Mapping */}
              {modalStep === 1 && (
                <div className="space-y-5">
                  {/* File & Sheet selector banner */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <FileSpreadsheet className="size-4 text-emerald-600" />
                        <span>{uploadFile?.name || 'Selected File'}</span>
                        <span className="text-slate-400 font-normal">
                          ({formatFileSize(uploadFile?.size)})
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {inspectData?.detected_headers?.length || 0} columns detected · {inspectData?.total_sheet_rows || 0} rows found
                      </p>
                    </div>

                    {/* Sheet Dropdown */}
                    {inspectData?.sheet_names?.length > 1 && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-700">Worksheet:</label>
                        <select
                          value={selectedSheet}
                          onChange={(e) => handleWorksheetChange(e.target.value)}
                          className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 bg-white shadow-2xs"
                        >
                          {inspectData.sheet_names.map((s, idx) => (
                            <option key={`${s}-${idx}`} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Target Accounting Category Selector */}
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                        <Layers className="size-4 text-blue-600" />
                        <span>Target Accounting Category</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Assign spreadsheet to its dedicated ledger category, or use smart auto-detection.
                      </p>
                    </div>

                    <div className="w-full sm:w-auto">
                      <select
                        value={uploadCategory}
                        onChange={(e) => setUploadCategory(e.target.value)}
                        className="w-full sm:w-72 px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 bg-slate-50 hover:bg-white focus:bg-white shadow-2xs transition-colors"
                      >
                        <option value="auto">Auto-Detect Category (Recommended)</option>
                        <option value="stamp_stock">Cash & Stamp Stock → Stamp Stock Ledger (Recommended for Stock)</option>
                        <option value="money_orders">Money Orders (PMT, eMO, Remittances)</option>
                        <option value="utility_collections">Utility Collections (CEB, LECO, Water, SLT, Dialog)</option>
                        <option value="postal_revenue">Postal Revenue (Registered Post, EMS, Parcel, Rentals)</option>
                        <option value="stamps_revenue">Stamps Counter Revenue (Postage Stamps & Philatelic)</option>
                        <option value="multi_category">Daily Accounts Multi-Category (Combined Daily Sheet)</option>
                      </select>
                    </div>
                  </div>

                  {/* Smart Column Mapping Banner & Auto-Detect Summary */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-blue-50/90 to-emerald-50/80 rounded-2xl border border-blue-100 shadow-2xs">
                    <div className="flex items-start gap-2.5">
                      <Sparkles className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900">Smart Column Mapping</span>
                          {mappedColumnCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <Check className="size-3" /> {mappedColumnCount} Columns Auto-Detected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              No columns matched yet
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          {uploadCategory === 'stamp_stock'
                            ? 'Headers auto-mapped for stamp stock ledger. Quantities & asset valuation are tracked.'
                            : 'Spreadsheet headers are automatically mapped below. You can review or adjust any field before previewing.'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => handleAutoDetectAllColumns()}
                        className="px-2.5 py-1.5 rounded-xl border border-blue-200 bg-white hover:bg-blue-50 text-blue-700 font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
                        title="Re-run auto-detection across all columns"
                      >
                        <Sparkles className="size-3.5 text-blue-600" />
                        <span>Re-Detect All</span>
                      </button>
                    </div>
                  </div>

                  {/* Column Mapping Grid */}
                  {uploadCategory === 'stamp_stock' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[
                        { key: 'date', label: 'Date Column', required: true, hint: 'Expected e.g.: Date, Trans Date', placeholder: '-- Auto-Detect Header --' },
                        { key: 'category', label: 'Stock Type / Category', required: true, hint: 'Expected e.g.: Stock Type, Particulars', placeholder: '-- Auto-Detect Header --' },
                        { key: 'denomination', label: 'Denomination (Rs.)', required: true, hint: 'Expected e.g.: Denomination (Rs.), Face Value', placeholder: '-- Auto-Detect Header --' },
                        { key: 'opening_qty', label: 'Opening Balance (Qty)', required: false, hint: 'Expected e.g.: Opening Qty, Opening Balance', placeholder: '-- Auto-Detect Header --' },
                        { key: 'receipts_qty', label: 'Receipts (Qty from HPO)', required: false, hint: 'Expected e.g.: Receipts, Received from HPO', placeholder: '-- Auto-Detect Header --' },
                        { key: 'issued_qty', label: 'Sold / Issued (Qty)', required: false, hint: 'Expected e.g.: Sold / Issued Qty, Issues', placeholder: '-- Auto-Detect Header --', syncWithCount: true },
                        { key: 'damaged_qty', label: 'Damaged / Withdrawn (Qty)', required: false, hint: 'Expected e.g.: Damaged, Spoiled', placeholder: '-- Optional / 0 --' },
                        { key: 'closing_qty', label: 'Closing Balance (Qty)', required: false, hint: 'Expected e.g.: Closing Qty, In Hand Qty', placeholder: '-- Auto-Detect Header --' },
                        { key: 'closing_value', label: 'Closing Value (Rs.)', required: true, hint: 'Valuation Asset (GL-1201), Not Counter Revenue', placeholder: '-- Auto-Detect Header --', syncWithAmount: true },
                        { key: 'verified_by', label: 'Verified By / Postmaster', required: false, hint: 'Postmaster Stock Verification', placeholder: '-- Optional / Unmapped --' },
                        { key: 'reference_no', label: 'Reference / Batch No', required: false, hint: 'Defaults to Auto-Generated STK-Date-Row', placeholder: '-- Auto-Generate Stock Ref --' },
                        { key: 'office_id', label: 'Post Office / Branch ID', required: false, hint: `Defaults to ${selectedOffice}`, placeholder: `-- Use Selected (${selectedOfficeName}) --` },
                      ].map((field) => {
                        const isMapped = Boolean(columnMapping[field.key])
                        return (
                          <div
                            key={field.key}
                            className={`p-3 rounded-xl border transition-all ${
                              isMapped ? 'bg-emerald-50/40 border-emerald-300 shadow-2xs' : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-bold text-slate-800">
                                {field.label} {field.required && <span className="text-rose-500">*</span>}
                              </label>
                              {isMapped && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/90 border border-emerald-300 px-1.5 py-0.5 rounded-md">
                                  <Check className="size-2.5" /> Auto-detected
                                </span>
                              )}
                            </div>
                            <select
                              value={columnMapping[field.key] || ''}
                              onChange={(e) => {
                                const val = e.target.value
                                const nextMap = { ...columnMapping, [field.key]: val }
                                if (field.syncWithCount) nextMap.count = val
                                if (field.syncWithAmount) nextMap.amount = val
                                setColumnMapping(nextMap)
                              }}
                              className={`w-full px-2.5 py-1.5 border rounded-lg text-xs transition-colors ${
                                isMapped
                                  ? 'border-emerald-400 bg-white text-slate-900 font-semibold shadow-2xs'
                                  : 'border-slate-200 bg-slate-50 text-slate-800 font-medium'
                              }`}
                            >
                              <option value="">{field.placeholder}</option>
                              {inspectData?.detected_headers?.map((h, i) => (
                                <option key={`${h}-${i}`} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                            {isMapped ? (
                              <span className="text-[10px] font-semibold text-emerald-700 mt-1 flex items-center gap-1 truncate">
                                <Check className="size-3 shrink-0 text-emerald-600" />
                                <span>Matched header: <strong className="font-bold text-emerald-900">"{columnMapping[field.key]}"</strong></span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 mt-1 block">{field.hint}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[
                        { key: 'date', label: 'Date Column', required: true, hint: 'Expected e.g.: Date, Trans Date', placeholder: '-- Auto-Detect Header --' },
                        { key: 'category', label: 'Category / Service', required: true, hint: 'Expected e.g.: Category, Service, Particulars', placeholder: '-- Auto-Detect Header --' },
                        { key: 'amount', label: 'Amount (LKR)', required: true, hint: 'Expected e.g.: Amount, Total, Value LKR', placeholder: '-- Auto-Detect Header --' },
                        { key: 'count', label: 'Count / Bills / Volume', required: false, hint: 'Expected e.g.: Count, Qty, No. of Bills', placeholder: '-- Auto-Detect (Default 1) --' },
                        { key: 'reference_no', label: 'Reference / Voucher No', required: false, hint: 'Expected e.g.: Reference No, Voucher, Ticket', placeholder: '-- Auto-Detect / Generate --' },
                        { key: 'provider', label: 'Utility Provider / Biller', required: false, hint: 'Expected e.g.: CEB, LECO, NWSDB, SLT', placeholder: '-- Auto-Detect Provider --' },
                        { key: 'commission', label: 'Commission / Postal Fee', required: false, hint: 'Expected e.g.: Commission, Fee, Charge', placeholder: '-- Auto-Detect / 0.00 --' },
                        { key: 'recipient', label: 'Recipient / Payee', required: false, hint: 'For Money Orders, Pensions', placeholder: '-- Optional / Unmapped --' },
                        { key: 'remitter', label: 'Remitter / Sender', required: false, hint: 'For Inward Money Orders', placeholder: '-- Optional / Unmapped --' },
                        { key: 'office_id', label: 'Post Office / Branch ID', required: false, hint: `Defaults to ${selectedOffice}`, placeholder: `-- Use Selected (${selectedOfficeName}) --` },
                        { key: 'payment_method', label: 'Payment Method', required: false, hint: 'Cash, Card, QR, Postal Order', placeholder: '-- Optional (Cash / Cheque) --' },
                      ].map((field) => {
                        const isMapped = Boolean(columnMapping[field.key])
                        return (
                          <div
                            key={field.key}
                            className={`p-3 rounded-xl border transition-all ${
                              isMapped ? 'bg-emerald-50/40 border-emerald-300 shadow-2xs' : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-bold text-slate-800">
                                {field.label} {field.required && <span className="text-rose-500">*</span>}
                              </label>
                              {isMapped && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/90 border border-emerald-300 px-1.5 py-0.5 rounded-md">
                                  <Check className="size-2.5" /> Auto-detected
                                </span>
                              )}
                            </div>
                            <select
                              value={columnMapping[field.key] || ''}
                              onChange={(e) => setColumnMapping({ ...columnMapping, [field.key]: e.target.value })}
                              className={`w-full px-2.5 py-1.5 border rounded-lg text-xs transition-colors ${
                                isMapped
                                  ? 'border-emerald-400 bg-white text-slate-900 font-semibold shadow-2xs'
                                  : 'border-slate-200 bg-slate-50 text-slate-800 font-medium'
                              }`}
                            >
                              <option value="">{field.placeholder}</option>
                              {inspectData?.detected_headers?.map((h, i) => (
                                <option key={`${h}-${i}`} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                            {isMapped ? (
                              <span className="text-[10px] font-semibold text-emerald-700 mt-1 flex items-center gap-1 truncate">
                                <Check className="size-3 shrink-0 text-emerald-600" />
                                <span>Matched header: <strong className="font-bold text-emerald-900">"{columnMapping[field.key]}"</strong></span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 mt-1 block">{field.hint}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Summary Rows Exclusion Option */}
                  <div className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      id="modal_exclude_summary"
                      checked={excludeSummaryRows}
                      onChange={(e) => setExcludeSummaryRows(e.target.checked)}
                      className="size-4 text-blue-600 rounded cursor-pointer"
                    />
                    <label htmlFor="modal_exclude_summary" className="font-medium cursor-pointer">
                      Exclude detected summary rows (e.g. "Grand Total", "Sub Total", "Daily Total") to avoid ledger inflation
                    </label>
                  </div>

                  {/* Sample Raw Data Preview Table */}
                  {inspectData?.sample_rows?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 mb-2">Original Spreadsheet Sample (First 5 Rows)</h4>
                      <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-48">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 text-slate-700 sticky top-0">
                            <tr>
                              {inspectData.detected_headers?.map((h, i) => (
                                <th key={`${h}-${i}`} className="p-2 border-r border-slate-200 last:border-0 font-bold whitespace-nowrap">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {inspectData.sample_rows.slice(0, 5).map((row, ri) => (
                              <tr key={ri} className="hover:bg-slate-50">
                                {row.map((cell, ci) => (
                                  <td key={ci} className="p-2 border-r border-slate-100 last:border-0 text-slate-600 whitespace-nowrap">
                                    {cell !== null && cell !== undefined ? String(cell) : ''}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: Live Preview Screen */}
              {modalStep === 2 && uploadPreview && (
                <div className="space-y-5">
                  {/* Metric Pill Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center">
                    <div className="p-2 bg-white rounded-xl border border-slate-200/60 shadow-2xs">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">File Size</div>
                      <div className="text-xs font-bold text-slate-800 truncate">
                        {uploadPreview.batch_meta.file_size_formatted || formatFileSize(uploadFile?.size)}
                      </div>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-200/60 shadow-2xs">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Sheet Name</div>
                      <div className="text-xs font-bold text-slate-800 truncate">
                        {uploadPreview.batch_meta.sheet_name || 'Sheet1'}
                      </div>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-200/60 shadow-2xs col-span-2 sm:col-span-2">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Detected Period</div>
                      <div className="text-xs font-bold text-slate-800 truncate">
                        {uploadPreview.batch_meta.detected_date_range || 'Current Scope'}
                      </div>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-200/60 shadow-2xs">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Total Rows</div>
                      <div className="text-xs font-bold text-slate-900">
                        {uploadPreview.batch_meta.total_rows}
                      </div>
                    </div>
                    <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200 shadow-2xs">
                      <div className="text-[10px] text-emerald-700 font-bold uppercase">Valid Rows</div>
                      <div className="text-xs font-extrabold text-emerald-800">
                        {uploadPreview.batch_meta.valid_rows}
                      </div>
                    </div>
                    <div className="p-2 bg-rose-50 rounded-xl border border-rose-200 shadow-2xs">
                      <div className="text-[10px] text-rose-700 font-bold uppercase">Invalid Rows</div>
                      <div className="text-xs font-extrabold text-rose-800">
                        {uploadPreview.batch_meta.invalid_rows}
                      </div>
                    </div>
                    <div className="p-2 bg-purple-50 rounded-xl border border-purple-200 shadow-2xs">
                      <div className="text-[10px] text-purple-700 font-bold uppercase">Duplicates</div>
                      <div className="text-xs font-extrabold text-purple-800">
                        {uploadPreview.batch_meta.duplicate_rows}
                      </div>
                    </div>
                  </div>

                  {/* Detected Category Banner */}
                  <div className="p-3 bg-slate-100/80 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Layers className="size-4 text-blue-600" />
                      <span className="text-slate-500 font-medium">Target Accounting Category:</span>
                      <span className="font-bold text-slate-800">
                        {uploadPreview.batch_meta.dataset_category_label || 'Multi-Category'}
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                      Auto-Classified
                    </span>
                  </div>

                  {/* Financial & Stock Preview Cards */}
                  {uploadPreview.batch_meta.dataset_category === 'stamp_stock' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-indigo-700">Stamp Stock Valuation</div>
                          <div className="text-base font-bold text-indigo-950 mt-0.5">
                            {formatLkrCurrency(uploadPreview.batch_meta.total_stock_closing_value || 0)}
                          </div>
                          <div className="text-[11px] text-indigo-600 font-medium">
                            GL-1201 Inventory Asset (Net Rev: LKR 0)
                          </div>
                        </div>
                        <div className="size-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                          <Layers className="size-4" />
                        </div>
                      </div>

                      <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-emerald-700">Closing Stock In Hand</div>
                          <div className="text-base font-bold text-emerald-950 mt-0.5">
                            {(uploadPreview.batch_meta.total_stock_closing_qty || 0).toLocaleString()}
                          </div>
                          <div className="text-[11px] text-emerald-600 font-medium">
                            Total Units in Vault & Counters
                          </div>
                        </div>
                        <div className="size-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <Stamp className="size-4" />
                        </div>
                      </div>

                      <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-blue-700">Sold / Issued Quantity</div>
                          <div className="text-base font-bold text-blue-950 mt-0.5">
                            {(uploadPreview.batch_meta.total_stock_issued_qty || 0).toLocaleString()}
                          </div>
                          <div className="text-[11px] text-blue-600 font-medium">
                            {uploadPreview.batch_meta.total_stock_items || 0} Stock Lines Issued
                          </div>
                        </div>
                        <div className="size-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                          <Coins className="size-4" />
                        </div>
                      </div>

                      <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-amber-700">Receipts from HPO</div>
                          <div className="text-base font-bold text-amber-950 mt-0.5">
                            {(uploadPreview.batch_meta.total_stock_receipts_qty || 0).toLocaleString()}
                          </div>
                          <div className="text-[11px] text-amber-600 font-medium">
                            {uploadPreview.batch_meta.total_stock_damaged_qty || 0} Damaged / Withdrawn
                          </div>
                        </div>
                        <div className="size-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0">
                          <Mail className="size-4" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-blue-700">Money Orders</div>
                          <div className="text-base font-bold text-blue-950 mt-0.5">
                            {formatLkrCurrency(uploadPreview.batch_meta.total_mo_amount)}
                          </div>
                          <div className="text-[11px] text-blue-600 font-medium">
                            {uploadPreview.batch_meta.total_mo_count} Money Orders
                          </div>
                        </div>
                        <div className="size-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                          <Mail className="size-4" />
                        </div>
                      </div>

                      <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-emerald-700">Utility Collections</div>
                          <div className="text-base font-bold text-emerald-950 mt-0.5">
                            {formatLkrCurrency(uploadPreview.batch_meta.total_utility_amount)}
                          </div>
                          <div className="text-[11px] text-emerald-600 font-medium">
                            {uploadPreview.batch_meta.total_utility_bills} Utility Bills
                          </div>
                        </div>
                        <div className="size-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <Zap className="size-4" />
                        </div>
                      </div>

                      <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-amber-700">Postal Revenue</div>
                          <div className="text-base font-bold text-amber-950 mt-0.5">
                            {formatLkrCurrency(uploadPreview.batch_meta.total_postal_revenue)}
                          </div>
                          <div className="text-[11px] text-amber-600 font-medium">
                            {uploadPreview.batch_meta.total_postal_count || 0} Service Items
                          </div>
                        </div>
                        <div className="size-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0">
                          <Coins className="size-4" />
                        </div>
                      </div>

                      <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-indigo-700">Stamps Counter</div>
                          <div className="text-base font-bold text-indigo-950 mt-0.5">
                            {formatLkrCurrency(uploadPreview.batch_meta.total_stamps_revenue || 0)}
                          </div>
                          <div className="text-[11px] text-indigo-600 font-medium">
                            {uploadPreview.batch_meta.total_stamps_count || 0} Stamps Sold
                          </div>
                        </div>
                        <div className="size-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                          <Stamp className="size-4" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Partial Ingestion Notice */}
                  <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-2xl flex items-start gap-3 text-xs text-blue-900">
                    <Info className="size-4 text-blue-600 shrink-0 mt-0.5" />

                    <div>
                      <span className="font-bold">Partial Import Mode Enabled:</span>{' '}
                      {uploadPreview.batch_meta.valid_rows} valid records will be ingested directly into live reporting. Incomplete or invalid records ({uploadPreview.batch_meta.invalid_rows}) are isolated in the Validation Issues report for correction, and {uploadPreview.batch_meta.duplicate_rows} duplicate rows will be omitted to safeguard ledger balance.
                    </div>
                  </div>

                  {/* Validation Diagnostics / Frequent Errors */}
                  {(uploadPreview.batch_meta.invalid_rows > 0 || (uploadPreview.batch_meta.frequent_errors && uploadPreview.batch_meta.frequent_errors.length > 0)) && (
                    <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl text-xs text-rose-950 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-bold flex items-center gap-2 text-rose-800">
                          <AlertTriangle className="size-4 text-rose-600" />
                          <span>Validation Diagnostics — {uploadPreview.batch_meta.invalid_rows} Invalid Records Detected</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleDownloadValidationReport}
                          className="px-2.5 py-1 bg-white border border-rose-200 rounded-lg text-rose-700 font-semibold hover:bg-rose-100 flex items-center gap-1 shadow-2xs"
                        >
                          <Download className="size-3 text-rose-600" />
                          <span>Download Error CSV</span>
                        </button>
                      </div>
                      {uploadPreview.batch_meta.frequent_errors?.length > 0 && (
                        <div className="text-[11px] text-rose-900">
                          <span className="font-semibold">Most Frequent Validation Issues:</span>
                          <ul className="list-disc list-inside mt-1 space-y-0.5">
                            {uploadPreview.batch_meta.frequent_errors.map((fe, idx) => (
                              <li key={idx}>
                                {fe.error} ({fe.count} occurrences)
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {uploadPreview.batch_meta.example_invalid_rows?.length > 0 && (
                        <div className="text-[11px] text-rose-800 bg-white/80 p-2 rounded-xl border border-rose-100">
                          <span className="font-semibold">Sample Invalid Rows:</span>{' '}
                          {uploadPreview.batch_meta.example_invalid_rows.slice(0, 3).map((ex, i) => (
                            <span key={i} className="inline-block mr-2 font-mono text-[10px]">
                              [Row #{ex.row_number}: {ex.column} - {ex.message}]
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Filter & Action Bar */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                    {/* Filter Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewFilter('all')
                          setPreviewPage(1)
                        }}
                        className={`px-3 py-1.5 rounded-xl transition-all ${
                          previewFilter === 'all'
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        All Records ({uploadPreview.records?.length || 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewFilter('valid')
                          setPreviewPage(1)
                        }}
                        className={`px-3 py-1.5 rounded-xl transition-all ${
                          previewFilter === 'valid'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        }`}
                      >
                        Valid Records ({uploadPreview.batch_meta?.valid_rows || 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewFilter('issues')
                          setPreviewPage(1)
                        }}
                        className={`px-3 py-1.5 rounded-xl transition-all ${
                          previewFilter === 'issues'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                        }`}
                      >
                        Issues ({uploadPreview.issues?.length || 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewFilter('duplicates')
                          setPreviewPage(1)
                        }}
                        className={`px-3 py-1.5 rounded-xl transition-all ${
                          previewFilter === 'duplicates'
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
                        }`}
                      >
                        Duplicates ({uploadPreview.batch_meta?.duplicate_rows || 0})
                      </button>
                    </div>

                    {/* Search and Download CSV */}
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="size-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="Search preview..."
                          value={previewSearch}
                          onChange={(e) => {
                            setPreviewSearch(e.target.value)
                            setPreviewPage(1)
                          }}
                          className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-blue-500 w-36 sm:w-44"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleDownloadValidationReport}
                        className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                      >
                        <Download className="size-3.5 text-blue-600" />
                        <span className="hidden sm:inline">Validation CSV</span>
                      </button>
                    </div>
                  </div>

                  {/* Spreadsheet-Style Paginated Table with horizontal scrolling and invalid cell highlighting */}
                  <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[360px] shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 sticky top-0 z-10 font-bold">
                        {uploadPreview.batch_meta.dataset_category === 'stamp_stock' ? (
                          <tr>
                            <th className="p-2.5 whitespace-nowrap">#</th>
                            <th className="p-2.5 whitespace-nowrap">Date</th>
                            <th className="p-2.5 whitespace-nowrap">Stock Type / Category</th>
                            <th className="p-2.5 text-right whitespace-nowrap">Denomination (Rs.)</th>
                            <th className="p-2.5 text-right whitespace-nowrap">Opening Qty</th>
                            <th className="p-2.5 text-right whitespace-nowrap">Receipts</th>
                            <th className="p-2.5 text-right whitespace-nowrap">Issued Qty</th>
                            <th className="p-2.5 text-right whitespace-nowrap">Damaged</th>
                            <th className="p-2.5 text-right whitespace-nowrap">Closing Qty</th>
                            <th className="p-2.5 text-right whitespace-nowrap">Closing Value (LKR)</th>
                            <th className="p-2.5 whitespace-nowrap">GL Code</th>
                            <th className="p-2.5 text-center whitespace-nowrap">Validation Status</th>
                          </tr>
                        ) : (
                          <tr>
                            <th className="p-2.5 whitespace-nowrap">#</th>
                            <th className="p-2.5 whitespace-nowrap">Date</th>
                            <th className="p-2.5 whitespace-nowrap">Category / Service</th>
                            <th className="p-2.5 text-center whitespace-nowrap">Flow</th>
                            <th className="p-2.5 text-right whitespace-nowrap">Count</th>
                            <th className="p-2.5 text-right whitespace-nowrap">Amount (LKR)</th>
                            <th className="p-2.5 whitespace-nowrap">Reference No</th>
                            <th className="p-2.5 whitespace-nowrap">Provider / Particulars</th>
                            <th className="p-2.5 whitespace-nowrap">GL Code</th>
                            <th className="p-2.5 text-center whitespace-nowrap">Validation Status</th>
                          </tr>
                        )}
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedPreviewRecords.map((row) => {
                          const hasDateError = row.row_errors?.some((e) => e.column === 'date')
                          const hasAmountError = row.row_errors?.some((e) => e.column === 'amount' || e.column === 'closing_value')
                          const hasCategoryError = row.row_errors?.some((e) => e.column === 'category')
                          const isDup = row.is_duplicate

                          if (uploadPreview.batch_meta.dataset_category === 'stamp_stock') {
                            return (
                              <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-2.5 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                                  {row.row_index}
                                </td>
                                <td
                                  className={`p-2.5 whitespace-nowrap ${
                                    hasDateError ? 'bg-rose-50 text-rose-700 font-bold border-l-2 border-rose-500' : 'text-slate-700'
                                  }`}
                                >
                                  {row.date}
                                </td>
                                <td
                                  className={`p-2.5 font-medium whitespace-nowrap ${
                                    hasCategoryError ? 'bg-rose-50 text-rose-700 font-bold border-l-2 border-rose-500' : 'text-slate-900'
                                  }`}
                                >
                                  {row.category}
                                </td>
                                <td className="p-2.5 text-right font-mono text-slate-700 whitespace-nowrap">
                                  {row.denomination !== undefined && row.denomination !== null
                                    ? typeof row.denomination === 'number'
                                      ? `Rs. ${row.denomination}`
                                      : String(row.denomination)
                                    : '-'}
                                </td>
                                <td className="p-2.5 text-right font-medium text-slate-600 whitespace-nowrap">
                                  {row.opening_qty !== undefined && row.opening_qty !== null ? Number(row.opening_qty).toLocaleString() : '-'}
                                </td>
                                <td className="p-2.5 text-right font-medium text-emerald-700 whitespace-nowrap">
                                  {row.receipts_qty !== undefined && row.receipts_qty !== null ? Number(row.receipts_qty).toLocaleString() : '-'}
                                </td>
                                <td className="p-2.5 text-right font-medium text-blue-700 whitespace-nowrap">
                                  {row.issued_qty !== undefined && row.issued_qty !== null
                                    ? Number(row.issued_qty).toLocaleString()
                                    : row.count
                                    ? Number(row.count).toLocaleString()
                                    : '0'}
                                </td>
                                <td className="p-2.5 text-right font-medium text-amber-700 whitespace-nowrap">
                                  {row.damaged_qty !== undefined && row.damaged_qty !== null ? Number(row.damaged_qty).toLocaleString() : '0'}
                                </td>
                                <td className="p-2.5 text-right font-bold text-slate-900 whitespace-nowrap">
                                  {row.closing_qty !== undefined && row.closing_qty !== null ? Number(row.closing_qty).toLocaleString() : '-'}
                                </td>
                                <td
                                  className={`p-2.5 text-right font-bold text-indigo-700 whitespace-nowrap ${
                                    hasAmountError ? 'bg-rose-50 text-rose-700 border-l-2 border-rose-500' : ''
                                  }`}
                                >
                                  {formatLkrCurrency(row.closing_value ?? row.amount ?? 0)}
                                </td>
                                <td className="p-2.5 whitespace-nowrap">
                                  <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-[10px]">
                                    {row.gl_code || 'GL-1201'}
                                  </span>
                                </td>
                                <td className="p-2.5 text-center whitespace-nowrap">
                                  {isDup ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                                      Duplicate Skipped
                                    </span>
                                  ) : !row.is_valid ? (
                                    <span
                                      title={row.row_errors?.map((e) => e.message).join(' | ')}
                                      className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 cursor-help"
                                    >
                                      Rejected Error
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                      Valid Stock
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )
                          }

                          return (
                            <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-2.5 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                                {row.row_index}
                              </td>

                              {/* Date Cell */}
                              <td
                                className={`p-2.5 whitespace-nowrap ${
                                  hasDateError
                                    ? 'bg-rose-50 text-rose-700 font-bold border-l-2 border-rose-500'
                                    : 'text-slate-700'
                                }`}
                              >
                                {row.date}
                              </td>

                              {/* Category Cell */}
                              <td
                                className={`p-2.5 font-medium whitespace-nowrap ${
                                  hasCategoryError
                                    ? 'bg-rose-50 text-rose-700 font-bold border-l-2 border-rose-500'
                                    : 'text-slate-900'
                                }`}
                              >
                                {row.category}
                              </td>

                              {/* Flow Type */}
                              <td className="p-2.5 text-center whitespace-nowrap">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    row.flow_type === 'inflow' || row.flow_type === 'revenue'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-amber-50 text-amber-700'
                                  }`}
                                >
                                  {row.flow_type || 'inflow'}
                                </span>
                              </td>

                              {/* Count */}
                              <td className="p-2.5 text-right font-medium text-slate-600 whitespace-nowrap">
                                {row.count}
                              </td>

                              {/* Amount Cell */}
                              <td
                                className={`p-2.5 text-right font-bold whitespace-nowrap ${
                                  hasAmountError
                                    ? 'bg-rose-50 text-rose-700 border-l-2 border-rose-500'
                                    : 'text-slate-900'
                                }`}
                              >
                                {formatLkrCurrency(row.amount)}
                              </td>

                              {/* Reference No Cell */}
                              <td
                                className={`p-2.5 font-mono text-[11px] whitespace-nowrap ${
                                  isDup
                                    ? 'bg-purple-50 text-purple-700 font-bold border-l-2 border-purple-500'
                                    : 'text-slate-600'
                                }`}
                              >
                                {row.reference_no}
                              </td>

                              {/* Provider / Description */}
                              <td className="p-2.5 text-slate-600 text-[11px] max-w-xs truncate whitespace-nowrap">
                                {row.provider || row.recipient || row.remitter || 'Counter Till'}
                              </td>

                              {/* Predicted GL */}
                              <td className="p-2.5 whitespace-nowrap">
                                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-[10px]">
                                  {row.gl_code}
                                </span>
                              </td>

                              {/* Status Badge */}
                              <td className="p-2.5 text-center whitespace-nowrap">
                                {isDup ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                                    Duplicate Skipped
                                  </span>
                                ) : !row.is_valid ? (
                                  <span
                                    title={row.row_errors?.map((e) => e.message).join(' | ')}
                                    className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 cursor-help"
                                  >
                                    Rejected Error
                                  </span>
                                ) : row.row_warnings?.length > 0 ? (
                                  <span
                                    title={row.row_warnings?.map((w) => w.message).join(' | ')}
                                    className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 cursor-help"
                                  >
                                    Needs Review
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    Valid Record
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <div>
                      Showing{' '}
                      <span className="font-bold text-slate-800">
                        {filteredPreviewRecords.length > 0
                          ? (previewPage - 1) * previewPageSize + 1
                          : 0}
                      </span>{' '}
                      to{' '}
                      <span className="font-bold text-slate-800">
                        {Math.min(previewPage * previewPageSize, filteredPreviewRecords.length)}
                      </span>{' '}
                      of <span className="font-bold text-slate-800">{filteredPreviewRecords.length}</span> records
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={previewPage <= 1}
                        onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                        className="px-2.5 py-1 border border-slate-200 rounded-lg font-semibold disabled:opacity-40 hover:bg-slate-50"
                      >
                        Previous
                      </button>
                      <span className="px-2 font-bold text-slate-800">
                        Page {previewPage} of {totalPreviewPages}
                      </span>
                      <button
                        type="button"
                        disabled={previewPage >= totalPreviewPages}
                        onClick={() => setPreviewPage((p) => Math.min(totalPreviewPages, p + 1))}
                        className="px-2.5 py-1 border border-slate-200 rounded-lg font-semibold disabled:opacity-40 hover:bg-slate-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Ingestion Mode & Final Confirmation */}
              {modalStep === 3 && uploadPreview && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Choose Database Ingestion Mode</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select how these verified transactions should be integrated into the MongoDB collections.
                    </p>
                  </div>

                  {/* Mode Radio Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Mode 1: Append */}
                    <div
                      onClick={() => setImportMode('append')}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                        importMode === 'append'
                          ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`size-5 rounded-full border-2 flex items-center justify-center ${
                              importMode === 'append' ? 'border-blue-600' : 'border-slate-300'
                            }`}
                          >
                            {importMode === 'append' && <div className="size-2.5 rounded-full bg-blue-600" />}
                          </div>
                          <span className="text-sm font-bold text-slate-900">
                            Append to Existing Records
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                          Recommended
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                        Appends new transactions to the database. Unique postal business keys (Office, Date, Reference) are verified, and any matching duplicate records will be automatically detected and skipped. Existing data remains unchanged.
                      </p>
                    </div>

                    {/* Mode 2: Replace */}
                    <div
                      onClick={() => setImportMode('replace')}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                        importMode === 'replace'
                          ? 'border-amber-600 bg-amber-50/40 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`size-5 rounded-full border-2 flex items-center justify-center ${
                              importMode === 'replace' ? 'border-amber-600' : 'border-slate-300'
                            }`}
                          >
                            {importMode === 'replace' && <div className="size-2.5 rounded-full bg-amber-600" />}
                          </div>
                          <span className="text-sm font-bold text-slate-900">
                            Replace Dataset for Period
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          Period Overwrite
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                        Replaces transactions strictly for <strong>{selectedOfficeName}</strong> within the detected window (<strong>{uploadPreview.batch_meta.detected_date_range}</strong>) scoped to the active accounting category (<strong>{uploadCategory === 'auto' ? (uploadPreview.batch_meta.detected_category_label || 'Auto-Detected Category') : uploadCategory}</strong>). Records from other categories (e.g., Money Orders, Utility Bills, Stamps Counter) and other post offices remain completely intact.
                      </p>
                    </div>
                  </div>

                  {/* Ingestion Confirmation Table */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Batch Ingestion Summary ({importMode === 'append' ? 'Append Mode' : 'Period Overwrite Mode'})
                      </h5>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        importMode === 'append' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {importMode === 'append' ? 'Append Mode' : 'Replace Mode'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400">Target Office:</span>
                        <div className="font-bold text-slate-800">{selectedOfficeName}</div>
                      </div>
                      <div>
                        <span className="text-slate-400">Date Window:</span>
                        <div className="font-bold text-slate-800">
                          {uploadPreview.batch_meta.detected_date_range}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">Accounting Category:</span>
                        <div className="font-bold text-slate-800">
                          {uploadPreview.batch_meta.dataset_category_label || 'Postal Revenue'}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">Valid Transactions:</span>
                        <div className="font-bold text-emerald-700">
                          {uploadPreview.batch_meta.valid_rows} records
                        </div>
                      </div>

                      {/* Mode-specific Duplicates & Insert counts */}
                      <div>
                        <span className="text-slate-400">
                          {importMode === 'append' ? 'Duplicates Skipped:' : 'Within-File Duplicates:'}
                        </span>
                        <div className="font-bold text-purple-700">
                          {importMode === 'append'
                            ? `${uploadPreview.batch_meta.duplicate_rows} records`
                            : `${uploadPreview.batch_meta.within_file_duplicate_count || 0} records`}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400">
                          {importMode === 'append' ? 'New Records to Ingest:' : 'Records to Replace & Commit:'}
                        </span>
                        <div className="font-bold text-blue-700">
                          {importMode === 'append'
                            ? `${Math.max(0, (uploadPreview.batch_meta.valid_rows || 0) - (uploadPreview.batch_meta.duplicate_rows || 0))} records`
                            : `${Math.max(0, (uploadPreview.batch_meta.valid_rows || 0) - (uploadPreview.batch_meta.within_file_duplicate_count || 0))} records`}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400">Invalid Records:</span>
                        <div className="font-bold text-rose-700">
                          {uploadPreview.batch_meta.invalid_rows} rows
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400">Net Revenue Impact:</span>
                        <div className="font-bold text-slate-900">
                          {formatLkrCurrency(
                            uploadPreview.batch_meta.net_revenue_impact ??
                            uploadPreview.batch_meta.total_postal_revenue ??
                            0
                          )}
                        </div>
                      </div>

                      {uploadPreview.batch_meta.dataset_category === 'stamp_stock' ? (
                        <>
                          <div>
                            <span className="text-slate-400">Stamp Stock Valuation:</span>
                            <div className="font-bold text-indigo-700">
                              {formatLkrCurrency(uploadPreview.batch_meta.total_stock_closing_value || 0)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Asset GL-1201 (Net Rev: LKR 0)
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-400">Closing Stock In Hand:</span>
                            <div className="font-bold text-slate-900">
                              {(uploadPreview.batch_meta.total_stock_closing_qty || 0).toLocaleString()} units
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-400">Issued / Sold Qty:</span>
                            <div className="font-bold text-slate-900">
                              {(uploadPreview.batch_meta.total_stock_issued_qty || 0).toLocaleString()} units
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <span className="text-slate-400">Money Orders Volume:</span>
                            <div className="font-bold text-slate-900">
                              {uploadPreview.batch_meta.total_mo_count} MOs ({formatLkrCurrency(uploadPreview.batch_meta.total_mo_amount)})
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-400">Utility Collections:</span>
                            <div className="font-bold text-slate-900">
                              {uploadPreview.batch_meta.total_utility_bills} bills ({formatLkrCurrency(uploadPreview.batch_meta.total_utility_amount)})
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-400">Stamps Counter:</span>
                            <div className="font-bold text-slate-900">
                              {uploadPreview.batch_meta.total_stamps_count || 0} sales ({formatLkrCurrency(uploadPreview.batch_meta.total_stamps_amount || 0)})
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Mode contextual notice */}
                  {importMode === 'append' && (uploadPreview.batch_meta.duplicate_rows || 0) >= (uploadPreview.batch_meta.valid_rows || 0) && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                      <Info className="size-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">All {uploadPreview.batch_meta.valid_rows} records already exist in MongoDB:</span>{' '}
                        These records match transactions previously imported for {selectedOfficeName} during {uploadPreview.batch_meta.detected_date_range}. In Append mode, duplicate records are skipped to preserve ledger integrity. If you want to update or re-sync this period's dataset, select <strong>Replace Dataset for Period</strong> above.
                      </div>
                    </div>
                  )}

                  {importMode === 'replace' && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
                      <ShieldCheck className="size-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Strictly Scoped Period Overwrite:</span>{' '}
                        Only transactions for <strong>{selectedOfficeName}</strong> within <strong>{uploadPreview.batch_meta.detected_date_range}</strong> under <strong>{uploadPreview.batch_meta.dataset_category_label || (uploadPreview.batch_meta.dataset_category === 'stamp_stock' ? 'Cash & Stamp Stock → Stamp Stock Ledger' : 'Postal Revenue')}</strong> will be replaced. Other categories ({uploadPreview.batch_meta.dataset_category === 'stamp_stock' ? 'Money Orders, Utility Collections, Postal Revenue' : 'Money Orders, Utility Collections, Stamps Counter'}) and other offices remain completely intact.
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    <span>
                      Transactions will be stored in MongoDB and instantly update all dashboard KPIs, charts, and ledgers in Live Data mode.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/60">
              <button
                type="button"
                disabled={uploading}
                onClick={() => setIsUploadModalOpen(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                {modalStep === 1 && (
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={handleValidateSheet}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {uploading ? (
                      <>
                        <RefreshCw className="size-4 animate-spin" />
                        <span>Validating Sheet...</span>
                      </>
                    ) : (
                      <>
                        <span>Validate & Preview Records</span>
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </button>
                )}

                {modalStep === 2 && (
                  <>
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => setModalStep(1)}
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <ArrowLeft className="size-4" />
                      <span>Back to Mapping</span>
                    </button>
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => setModalStep(3)}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <span>Proceed to Ingestion Options</span>
                      <ArrowRight className="size-4" />
                    </button>
                  </>
                )}

                {modalStep === 3 && (
                  <>
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => setModalStep(2)}
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <ArrowLeft className="size-4" />
                      <span>Back to Preview</span>
                    </button>
                    {uploadError && (
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={handleConfirmImport}
                        className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw className="size-3.5" />
                        <span>Retry Ingestion</span>
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={handleConfirmImport}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {uploading ? (
                        <>
                          <RefreshCw className="size-4 animate-spin" />
                          <span>{STAGE_LABELS[uploadStage]?.title || 'Ingesting to Live MongoDB...'}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="size-4" />
                          <span>Confirm & Ingest to Live System</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inline Issue Resolution Modal */}
      {selectedIssue && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Resolve Validation Issue</h3>
              <button
                type="button"
                onClick={() => setSelectedIssue(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <div className="text-xs space-y-2 text-slate-600">
              <p>
                <span className="font-semibold text-slate-800">Message:</span> {selectedIssue.message}
              </p>
              <p>
                <span className="font-semibold text-slate-800">Column:</span> {selectedIssue.column_name} (Row #
                {selectedIssue.row_number})
              </p>
              <p>
                <span className="font-semibold text-slate-800">Original:</span> {selectedIssue.original_value}
              </p>
              <p>
                <span className="font-semibold text-slate-800">Suggested:</span> {selectedIssue.suggested_fix}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Enter Corrected Value:
              </label>
              <input
                type="text"
                value={correctionInput}
                onChange={(e) => setCorrectionInput(e.target.value)}
                placeholder="e.g. valid amount or date"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedIssue(null)}
                className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResolveIssue}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                Confirm Correction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clerk Daily Transaction Entry Modal */}
      {isAddTxModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Plus className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-tight">
                    Sri Lanka Post — Clerk Transaction Entry
                  </h3>
                  <p className="text-xs text-slate-500">
                    Official counter transaction recording · {selectedOfficeName} ({selectedOffice})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTxModalOpen(false)}
                className="size-8 rounded-full hover:bg-slate-200/80 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Category Selector Tabs */}
            <div className="px-6 pt-3 pb-2 border-b border-slate-100 bg-slate-50/30 flex items-center gap-1.5 overflow-x-auto">
              {[
                'Money Orders',
                'Postal Services',
                'Utility Collections',
                'Pension & Welfare',
                'Cash & Stamp Stock',
                'Expenses & Imprest',
              ].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => openAddTxModal(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    txFormCategory === cat
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Form Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Context info banner */}
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between text-xs text-blue-900">
                <div className="flex items-center gap-2">
                  <Info className="size-4 text-blue-600 shrink-0" />
                  <span>
                    Authenticated Clerk: <strong>{user?.username || 'clerk'}</strong> | Sri Lanka Date: <strong>{txFormData.date}</strong>
                  </span>
                </div>
                <span className="text-[11px] font-mono font-bold text-blue-700">{txFormData.reference_no}</span>
              </div>

              {txFormError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-center gap-2">
                  <AlertCircle className="size-4 text-rose-600 shrink-0" />
                  <span>{txFormError}</span>
                </div>
              )}

              {/* MODULE 1: MONEY ORDERS */}
              {txFormCategory === 'Money Orders' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Money Order Reference / Serial No *</label>
                      <input
                        type="text"
                        value={txFormData.reference_no}
                        onChange={(e) => setTxFormData({ ...txFormData, reference_no: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-blue-500"
                        placeholder="MO-2026-XXXX"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Transaction Date (SLT) *</label>
                      <input
                        type="date"
                        value={txFormData.date}
                        onChange={(e) => setTxFormData({ ...txFormData, date: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-blue-500"
                      />
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="font-bold text-slate-800 text-xs">Sender / Remitter Details (Sri Lanka Post PMT)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-600 mb-1">Remitter Full Name *</label>
                        <input
                          type="text"
                          value={txFormData.remitter}
                          onChange={(e) => setTxFormData({ ...txFormData, remitter: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-blue-500"
                          placeholder="e.g. K. A. Sunimal Perera"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Telephone Number</label>
                        <input
                          type="text"
                          value={txFormData.remitter_phone}
                          onChange={(e) => setTxFormData({ ...txFormData, remitter_phone: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-blue-500"
                          placeholder="077-1234567"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-slate-600 mb-1">Postal Address</label>
                        <input
                          type="text"
                          value={txFormData.remitter_address}
                          onChange={(e) => setTxFormData({ ...txFormData, remitter_address: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-blue-500"
                          placeholder="e.g. No. 42, Galle Road, Colombo 03"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="font-bold text-slate-800 text-xs">Recipient / Payee Details</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-600 mb-1">Recipient Full Name *</label>
                        <input
                          type="text"
                          value={txFormData.recipient}
                          onChange={(e) => setTxFormData({ ...txFormData, recipient: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-blue-500"
                          placeholder="e.g. M. N. F. Fathima"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Recipient Telephone Number</label>
                        <input
                          type="text"
                          value={txFormData.recipient_phone}
                          onChange={(e) => setTxFormData({ ...txFormData, recipient_phone: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-blue-500"
                          placeholder="071-9876543"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-slate-600 mb-1">Recipient Postal Address</label>
                        <input
                          type="text"
                          value={txFormData.recipient_address}
                          onChange={(e) => setTxFormData({ ...txFormData, recipient_address: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-blue-500"
                          placeholder="e.g. Main Street, Kandy"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Money Order Principal (LKR) *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={txFormData.amount}
                        onChange={(e) => {
                          const amt = Number(e.target.value) || 0
                          const fee = Number(txFormData.service_fee) || 0
                          setTxFormData({
                            ...txFormData,
                            amount: e.target.value,
                            total_collected: (amt + fee).toFixed(2),
                          })
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-blue-500"
                        placeholder="5000.00"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Service Fee / Commission (LKR)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={txFormData.service_fee}
                        onChange={(e) => {
                          const fee = Number(e.target.value) || 0
                          const amt = Number(txFormData.amount) || 0
                          setTxFormData({
                            ...txFormData,
                            service_fee: e.target.value,
                            total_collected: (amt + fee).toFixed(2),
                          })
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-blue-500"
                        placeholder="100.00"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Total Collected from Sender (LKR)</label>
                      <input
                        type="text"
                        readOnly
                        value={txFormData.total_collected || txFormData.amount || '0.00'}
                        className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-emerald-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                      <select
                        value={txFormData.payment_method}
                        onChange={(e) => setTxFormData({ ...txFormData, payment_method: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-blue-500 bg-white"
                      >
                        <option value="Cash">Cash at Counter</option>
                        <option value="Cheque">Government Cheque</option>
                        <option value="Bank Transfer">Bank Transfer / EFT</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Remarks / Note</label>
                      <input
                        type="text"
                        value={txFormData.remarks}
                        onChange={(e) => setTxFormData({ ...txFormData, remarks: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-blue-500"
                        placeholder="e.g. Urgent family remittance"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* MODULE 2: POSTAL SERVICES */}
              {txFormCategory === 'Postal Services' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Receipt / Tracking Reference *</label>
                      <input
                        type="text"
                        value={txFormData.reference_no}
                        onChange={(e) => setTxFormData({ ...txFormData, reference_no: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-blue-500"
                        placeholder="PS-2026-XXXX"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Transaction Date *</label>
                      <input
                        type="date"
                        value={txFormData.date}
                        onChange={(e) => setTxFormData({ ...txFormData, date: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Postal Service Type *</label>
                      <select
                        value={txFormData.service_type}
                        onChange={(e) => setTxFormData({ ...txFormData, service_type: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-blue-500 bg-white"
                      >
                        <option value="Registered Post">Registered Post (Domestic / Foreign)</option>
                        <option value="Parcel Post">Parcel Post & Air Mail</option>
                        <option value="Speed Post / EMS">Speed Post / EMS Express</option>
                        <option value="LogiPost">LogiPost Freight Services</option>
                        <option value="Cash on Delivery (COD)">Cash on Delivery (COD)</option>
                        <option value="Bulk Mail Postage">Bulk Mail & Business Reply</option>
                        <option value="Philatelic & First Day Covers">Philatelic & First Day Covers</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Number of Articles / Count *</label>
                      <input
                        type="number"
                        min="1"
                        value={txFormData.count}
                        onChange={(e) => {
                          const c = Number(e.target.value) || 1
                          const uc = Number(txFormData.unit_charge) || 0
                          setTxFormData({
                            ...txFormData,
                            count: e.target.value,
                            amount: uc > 0 ? (c * uc).toFixed(2) : txFormData.amount,
                          })
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Unit Charge (LKR)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={txFormData.unit_charge}
                        onChange={(e) => {
                          const uc = Number(e.target.value) || 0
                          const c = Number(txFormData.count) || 1
                          setTxFormData({
                            ...txFormData,
                            unit_charge: e.target.value,
                            amount: (c * uc).toFixed(2),
                          })
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-blue-500"
                        placeholder="e.g. 150.00"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Total Fee Amount (LKR) *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={txFormData.amount}
                        onChange={(e) => setTxFormData({ ...txFormData, amount: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-blue-500"
                        placeholder="150.00"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Remarks / Destination Office</label>
                    <input
                      type="text"
                      value={txFormData.remarks}
                      onChange={(e) => setTxFormData({ ...txFormData, remarks: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-blue-500"
                      placeholder="e.g. Colombo to Jaffna Dispatch"
                    />
                  </div>
                </div>
              )}

              {/* MODULE 3: UTILITY COLLECTIONS */}
              {txFormCategory === 'Utility Collections' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Utility Agency Receipt Ref *</label>
                      <input
                        type="text"
                        value={txFormData.reference_no}
                        onChange={(e) => setTxFormData({ ...txFormData, reference_no: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-blue-500"
                        placeholder="UC-2026-XXXX"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Transaction Date *</label>
                      <input
                        type="date"
                        value={txFormData.date}
                        onChange={(e) => setTxFormData({ ...txFormData, date: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Utility Provider *</label>
                      <select
                        value={txFormData.provider}
                        onChange={(e) => setTxFormData({ ...txFormData, provider: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-blue-500 bg-white"
                      >
                        <option value="CEB">CEB — Ceylon Electricity Board</option>
                        <option value="LECO">LECO — Lanka Electricity Company</option>
                        <option value="Water Board">NWSDB — National Water Supply & Drainage Board</option>
                        <option value="SLT">SLT — Sri Lanka Telecom</option>
                        <option value="Mobitel">Mobitel Mobile / Broadband</option>
                        <option value="Dialog">Dialog Axiata PLC</option>
                        <option value="Other Utility">Other Agency Utility</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Customer Account / Bill Reference</label>
                      <input
                        type="text"
                        value={txFormData.customer_ref}
                        onChange={(e) => setTxFormData({ ...txFormData, customer_ref: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-blue-500"
                        placeholder="e.g. CEB-0421873910"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Bill Amount Collected (LKR) *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={txFormData.amount}
                        onChange={(e) => setTxFormData({ ...txFormData, amount: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-blue-500"
                        placeholder="2450.00"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Bills Count</label>
                      <input
                        type="number"
                        min="1"
                        value={txFormData.bills_count}
                        onChange={(e) => setTxFormData({ ...txFormData, bills_count: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Agency Commission (LKR)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={txFormData.commission}
                        onChange={(e) => setTxFormData({ ...txFormData, commission: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-blue-500"
                        placeholder="15.00"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Remarks</label>
                    <input
                      type="text"
                      value={txFormData.remarks}
                      onChange={(e) => setTxFormData({ ...txFormData, remarks: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-blue-500"
                      placeholder="e.g. Paid in full"
                    />
                  </div>
                </div>
              )}

              {/* MODULE 4: PENSION & WELFARE */}
              {txFormCategory === 'Pension & Welfare' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Disbursement Voucher Ref *</label>
                      <input
                        type="text"
                        value={txFormData.reference_no}
                        onChange={(e) => setTxFormData({ ...txFormData, reference_no: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-blue-500"
                        placeholder="PW-2026-XXXX"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Disbursement Date *</label>
                      <input
                        type="date"
                        value={txFormData.date}
                        onChange={(e) => setTxFormData({ ...txFormData, date: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Beneficiary File No / NIC *</label>
                      <input
                        type="text"
                        value={txFormData.beneficiary_ref}
                        onChange={(e) => setTxFormData({ ...txFormData, beneficiary_ref: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-blue-500"
                        placeholder="e.g. PEN-1956102938V"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Disbursement Scheme *</label>
                      <select
                        value={txFormData.transaction_type}
                        onChange={(e) => setTxFormData({ ...txFormData, transaction_type: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-blue-500 bg-white"
                      >
                        <option value="Civil Pension">Civil Service Pension</option>
                        <option value="Military Pension">Military & Armed Forces Pension</option>
                        <option value="Widows & Orphans">Widows & Orphans (W&OP) Scheme</option>
                        <option value="Senior Citizens Welfare">Senior Citizens Welfare Allowance</option>
                        <option value="Disability Allowance">Disability / Samurdhi Allowance</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Disbursed Amount (LKR) *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={txFormData.amount}
                        onChange={(e) => setTxFormData({ ...txFormData, amount: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-rose-900 focus:outline-blue-500"
                        placeholder="28000.00"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Payment Status</label>
                      <select
                        value={txFormData.payment_status}
                        onChange={(e) => setTxFormData({ ...txFormData, payment_status: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-blue-500 bg-white"
                      >
                        <option value="Paid">Paid Out to Beneficiary</option>
                        <option value="Retained">Retained / Undelivered</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Remarks / Identification Check</label>
                    <input
                      type="text"
                      value={txFormData.remarks}
                      onChange={(e) => setTxFormData({ ...txFormData, remarks: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-blue-500"
                      placeholder="e.g. Identity verified via Senior Citizen NIC"
                    />
                  </div>
                </div>
              )}

              {/* MODULE 5: CASH & STAMP STOCK */}
              {txFormCategory === 'Cash & Stamp Stock' && (
                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-teal-900">
                    <span className="font-bold">Vault Inventory Physical Custody (GL-1201):</span> Stamp stock represents vault custody valuation. Net revenue impact is strictly LKR 0.00 until counter issuance.
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Stock Ledger Ref *</label>
                      <input
                        type="text"
                        value={txFormData.reference_no}
                        onChange={(e) => setTxFormData({ ...txFormData, reference_no: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-blue-500"
                        placeholder="ST-2026-XXXX"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Verification Date *</label>
                      <input
                        type="date"
                        value={txFormData.date}
                        onChange={(e) => setTxFormData({ ...txFormData, date: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Stock Type *</label>
                      <select
                        value={txFormData.stock_type}
                        onChange={(e) => setTxFormData({ ...txFormData, stock_type: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-blue-500 bg-white"
                      >
                        <option value="Postage Stamp">Definitive Postage Stamps</option>
                        <option value="Commemorative Stamp">Commemorative Issue Stamps</option>
                        <option value="Stamp Booklet">Stamp Booklets</option>
                        <option value="First Day Cover">First Day Covers (FDC)</option>
                        <option value="Revenue Stamp">Sri Lanka Inland Revenue Stamps</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Denomination (Rs.) *</label>
                      <select
                        value={txFormData.denomination}
                        onChange={(e) => {
                          const denom = Number(e.target.value) || 0
                          const clos = Number(txFormData.closing_qty) || 0
                          setTxFormData({
                            ...txFormData,
                            denomination: e.target.value,
                            closing_value: (clos * denom).toFixed(2),
                            amount: (clos * denom).toFixed(2),
                          })
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-blue-500 bg-white font-bold"
                      >
                        <option value="5">Rs. 5.00</option>
                        <option value="10">Rs. 10.00</option>
                        <option value="15">Rs. 15.00</option>
                        <option value="25">Rs. 25.00</option>
                        <option value="50">Rs. 50.00</option>
                        <option value="100">Rs. 100.00</option>
                        <option value="500">Rs. 500.00</option>
                      </select>
                    </div>
                  </div>

                  {/* Stock Movements Equation */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="font-bold text-slate-800 text-xs">Daily Physical Balance Movement</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <label className="block text-slate-600 mb-1">Opening Units</label>
                        <input
                          type="number"
                          min="0"
                          value={txFormData.opening_qty}
                          onChange={(e) => {
                            const op = Number(e.target.value) || 0
                            const rec = Number(txFormData.receipts_qty) || 0
                            const iss = Number(txFormData.issued_qty) || 0
                            const dam = Number(txFormData.damaged_qty) || 0
                            const clos = Math.max(0, op + rec - iss - dam)
                            const denom = Number(txFormData.denomination) || 0
                            setTxFormData({
                              ...txFormData,
                              opening_qty: e.target.value,
                              closing_qty: String(clos),
                              closing_value: (clos * denom).toFixed(2),
                              amount: (clos * denom).toFixed(2),
                            })
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">+ Receipts HQ</label>
                        <input
                          type="number"
                          min="0"
                          value={txFormData.receipts_qty}
                          onChange={(e) => {
                            const op = Number(txFormData.opening_qty) || 0
                            const rec = Number(e.target.value) || 0
                            const iss = Number(txFormData.issued_qty) || 0
                            const dam = Number(txFormData.damaged_qty) || 0
                            const clos = Math.max(0, op + rec - iss - dam)
                            const denom = Number(txFormData.denomination) || 0
                            setTxFormData({
                              ...txFormData,
                              receipts_qty: e.target.value,
                              closing_qty: String(clos),
                              closing_value: (clos * denom).toFixed(2),
                              amount: (clos * denom).toFixed(2),
                            })
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-emerald-700 font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">- Issues / Sales</label>
                        <input
                          type="number"
                          min="0"
                          value={txFormData.issued_qty}
                          onChange={(e) => {
                            const op = Number(txFormData.opening_qty) || 0
                            const rec = Number(txFormData.receipts_qty) || 0
                            const iss = Number(e.target.value) || 0
                            const dam = Number(txFormData.damaged_qty) || 0
                            const clos = Math.max(0, op + rec - iss - dam)
                            const denom = Number(txFormData.denomination) || 0
                            setTxFormData({
                              ...txFormData,
                              issued_qty: e.target.value,
                              closing_qty: String(clos),
                              closing_value: (clos * denom).toFixed(2),
                              amount: (clos * denom).toFixed(2),
                            })
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-amber-700 font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">- Damaged</label>
                        <input
                          type="number"
                          min="0"
                          value={txFormData.damaged_qty}
                          onChange={(e) => {
                            const op = Number(txFormData.opening_qty) || 0
                            const rec = Number(txFormData.receipts_qty) || 0
                            const iss = Number(txFormData.issued_qty) || 0
                            const dam = Number(e.target.value) || 0
                            const clos = Math.max(0, op + rec - iss - dam)
                            const denom = Number(txFormData.denomination) || 0
                            setTxFormData({
                              ...txFormData,
                              damaged_qty: e.target.value,
                              closing_qty: String(clos),
                              closing_value: (clos * denom).toFixed(2),
                              amount: (clos * denom).toFixed(2),
                            })
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-rose-700 font-medium"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-500">Closing Physical Balance:</span>{' '}
                        <strong className="text-slate-900 font-mono text-sm">{txFormData.closing_qty} units</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Vault Valuation:</span>{' '}
                        <strong className="text-teal-800 text-sm">LKR {Number(txFormData.closing_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* MODULE 6: EXPENSES & IMPREST */}
              {txFormCategory === 'Expenses & Imprest' && (
                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900">
                    <span className="font-bold">Post Office Contingencies & Imprest Float:</span> Record petty cash disbursements, fuel, stationery, and maintenance payments. Standard voucher limit is LKR 50,000.00.
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Voucher / Payment Reference *</label>
                      <input
                        type="text"
                        value={txFormData.reference_no}
                        onChange={(e) => setTxFormData({ ...txFormData, reference_no: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-blue-500"
                        placeholder="EXP-2026-XXXX"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Expense Date *</label>
                      <input
                        type="date"
                        value={txFormData.date}
                        onChange={(e) => setTxFormData({ ...txFormData, date: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Expense Category *</label>
                      <select
                        value={txFormData.expense_category}
                        onChange={(e) => setTxFormData({ ...txFormData, expense_category: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-blue-500 bg-white"
                      >
                        <option value="Post Office Contingencies">Post Office Contingencies & Petty Cash</option>
                        <option value="Fuel & Conveyance">Fuel, Vehicle Transport & Mail Conveyance</option>
                        <option value="Stationery & Office Supplies">Counter Stationery, Forms & Envelopes</option>
                        <option value="Building & Equipment Maintenance">Building, Scale & Counter Equipment Repairs</option>
                        <option value="Electricity & Water (Office)">Office Utility Bills (Direct Imprest)</option>
                        <option value="Petty Cash Imprest Replenishment">Imprest Float Replenishment</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Payee / Vendor / Description *</label>
                      <input
                        type="text"
                        value={txFormData.payee}
                        onChange={(e) => setTxFormData({ ...txFormData, payee: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-blue-500"
                        placeholder="e.g. Ceylon Petroleum Corp / Stationery Store"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Disbursed Amount (LKR) *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={txFormData.amount}
                        onChange={(e) => setTxFormData({ ...txFormData, amount: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-rose-800 focus:outline-blue-500"
                        placeholder="4500.00"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                      <select
                        value={txFormData.payment_method}
                        onChange={(e) => setTxFormData({ ...txFormData, payment_method: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-blue-500 bg-white"
                      >
                        <option value="Cash from Imprest">Cash from Counter Petty Imprest</option>
                        <option value="Official Cheque">Government Post Office Cheque</option>
                        <option value="Direct Bank Transfer">Electronic Funds Transfer / Bank Transfer</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Remarks / Receipt Attachment Ref</label>
                    <input
                      type="text"
                      value={txFormData.remarks}
                      onChange={(e) => setTxFormData({ ...txFormData, remarks: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-blue-500"
                      placeholder="e.g. Attached Cash Bill #89421 signed by clerk"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsAddTxModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={txSubmitting}
                  onClick={() => handleSubmitTransaction('Draft')}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={txSubmitting}
                  onClick={() => handleSubmitTransaction('Submitted')}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                >
                  <Check className="size-3.5" />
                  <span>{txSubmitting ? 'Submitting...' : 'Submit to Postmaster'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
