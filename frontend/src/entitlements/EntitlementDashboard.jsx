import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  Award,
  Banknote,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Edit,
  Eye,
  FileSpreadsheet,
  Gift,
  HandCoins,
  History,
  Home,
  Info,
  Lock,
  MinusCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { useAuth } from '../admin/data/auth'
import {
  actionEntitlementRecord,
  createEntitlementRecord,
  getEmployeeEntitlements,
  getEntitlementAudit,
  getEntitlementRecords,
  getEntitlementsReports,
  getEntitlementsSummary,
  list,
  updateEmployeeServiceProfile,
  updateEntitlementRecord,
} from '../admin/data/repository'
import ChartCard from '../admin/ui/ChartCard'
import KpiCard from '../admin/ui/KpiCard'
import LoadingState from '../admin/ui/LoadingState'
import {
  calculateMonthlyTotals,
  calculateServicePeriod,
  filterEntitlementRecords,
  formatLkr,
} from './entitlementHelpers'

const ALLOWANCE_PRESETS = [
  'Cost of Living Allowance',
  'Transport Allowance',
  'Administrative Allowance',
  'Housing Allowance',
  'Overtime Allowance',
  'Motorcycle Fuel Subsidy',
  'Special Duty Allowance',
  'Medical Allowance',
  'Other Authorized Allowance',
]

const DEDUCTION_PRESETS = [
  'Employee EPF Contribution (8%)',
  'Employer EPF Contribution (12%)',
  'Employer ETF Contribution (3%)',
  'Festival Advance Repayment',
  'Distress Loan Installment',
  'Postal Housing Loan Deduction',
  'Postal Welfare Society Contribution',
  'Postal Union Dues',
  'Salary Advance Recovery',
  'Other Approved Deduction',
]

const BENEFIT_PRESETS = [
  'Gratuity Benefit',
  'Postal Housing Loan Scheme',
  'Annual Festival Advance',
  'Government Distress Loan',
  'Long Service Recognition',
  'Death & Distress Relief Benefit',
]

export default function EntitlementDashboard() {
  const { user } = useAuth()
  const isPostmaster = user?.role === 'postmaster'

  // Summary and core data state
  const [summary, setSummary] = useState(null)
  const [employees, setEmployees] = useState([])
  const [records, setRecords] = useState([])
  const [selectedEmpId, setSelectedEmpId] = useState('')
  const [employeeProfile, setEmployeeProfile] = useState(null)
  const [reportsData, setReportsData] = useState(null)

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'allowances' | 'deductions' | 'benefits' | 'reports'
  const [categoryFilter, setCategoryFilter] = useState('all') // 'all' | 'allowance' | 'deduction' | 'service_benefit'
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'Active' | 'Approved' | 'Pending' | 'Inactive' | 'Expired'
  const [searchQuery, setSearchQuery] = useState('')

  // UI status
  const [loading, setLoading] = useState(true)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Modals
  const [showAddEditModal, setShowAddEditModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [selectedAuditRecord, setSelectedAuditRecord] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [confirmActionModal, setConfirmActionModal] = useState(null)
  const [savingAction, setSavingAction] = useState(false)

  // Add/Edit Form State
  const [formData, setFormData] = useState({
    employee_id: '',
    category: 'allowance',
    entitlement_name: '',
    custom_name: '',
    amount_type: 'fixed',
    amount: '',
    percentage_value: '8.0',
    percentage_basis: 'basic_salary',
    frequency: 'Monthly',
    eligibility_status: 'Applicable',
    approval_status: 'Approved',
    effective_date: new Date().toISOString().slice(0, 10),
    expiry_date: '',
    notes: '',
  })

  // Edit Service Profile Form State
  const [profileFormData, setProfileFormData] = useState({
    appointment_date: '',
    basic_salary: '',
    employment_type: 'Permanent',
    years_of_experience: '',
  })

  // Initial Data Load
  const loadInitialData = async () => {
    try {
      setLoading(true)
      setError('')
      const [sumRes, empRes, recRes, repRes] = await Promise.all([
        getEntitlementsSummary().catch(() => null),
        list('employee').catch(() => []),
        getEntitlementRecords().catch(() => []),
        getEntitlementsReports().catch(() => null),
      ])

      setSummary(sumRes)
      const empList = Array.isArray(empRes) ? empRes : []
      setEmployees(empList)
      setRecords(Array.isArray(recRes) ? recRes : [])
      setReportsData(repRes)

      if (empList.length > 0 && !selectedEmpId) {
        const firstId = empList[0].employee_id || empList[0].name
        setSelectedEmpId(firstId)
      }
    } catch (err) {
      setError(err.message || 'Failed to load employee entitlements data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInitialData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load selected employee's full entitlements profile
  const loadEmployeeProfile = async (empId) => {
    if (!empId) return
    try {
      setLoadingProfile(true)
      const profile = await getEmployeeEntitlements(empId)
      setEmployeeProfile(profile)
    } catch (err) {
      console.error('Could not load employee entitlement details:', err)
    } finally {
      setLoadingProfile(false)
    }
  }

  useEffect(() => {
    if (selectedEmpId) {
      loadEmployeeProfile(selectedEmpId)
    }
  }, [selectedEmpId])

  // Filtered Entitlement Records Table
  const filteredRecords = useMemo(() => {
    let effectiveCategory = categoryFilter
    if (activeTab === 'allowances') effectiveCategory = 'allowance'
    else if (activeTab === 'deductions') effectiveCategory = 'deduction'
    else if (activeTab === 'benefits') effectiveCategory = 'service_benefit'

    return filterEntitlementRecords(records, {
      search: searchQuery,
      category: effectiveCategory,
      status: statusFilter,
    })
  }, [records, searchQuery, categoryFilter, statusFilter, activeTab])

  // Selected Employee object
  const selectedEmp = useMemo(() => {
    return employees.find((e) => (e.employee_id || e.name) === selectedEmpId) || employees[0] || null
  }, [employees, selectedEmpId])

  // Computed service period for selected employee
  const servicePeriodInfo = useMemo(() => {
    if (!selectedEmp) return { formatted: 'Not available', isAvailable: false }
    return calculateServicePeriod(
      selectedEmp.appointment_date || employeeProfile?.employee?.appointment_date,
      selectedEmp.years_of_experience ?? employeeProfile?.employee?.years_of_experience,
    )
  }, [selectedEmp, employeeProfile])

  // Open Add Modal
  const handleOpenAddModal = (presetCategory = 'allowance') => {
    setEditingRecord(null)
    setFormData({
      employee_id: selectedEmpId || (employees[0] ? employees[0].employee_id || employees[0].name : ''),
      category: presetCategory,
      entitlement_name: presetCategory === 'allowance' ? ALLOWANCE_PRESETS[0] : presetCategory === 'deduction' ? DEDUCTION_PRESETS[0] : BENEFIT_PRESETS[0],
      custom_name: '',
      amount_type: 'fixed',
      amount: presetCategory === 'allowance' ? '5000' : presetCategory === 'deduction' ? '1500' : '',
      percentage_value: '8.0',
      percentage_basis: 'basic_salary',
      frequency: 'Monthly',
      eligibility_status: 'Approved',
      approval_status: isPostmaster ? 'Approved' : 'Pending',
      effective_date: new Date().toISOString().slice(0, 10),
      expiry_date: '',
      notes: '',
    })
    setShowAddEditModal(true)
  }

  // Open Edit Modal
  const handleOpenEditModal = (rec) => {
    setEditingRecord(rec)
    const isPreset = [...ALLOWANCE_PRESETS, ...DEDUCTION_PRESETS, ...BENEFIT_PRESETS].includes(rec.entitlement_name)
    setFormData({
      employee_id: rec.employee_id,
      category: rec.category,
      entitlement_name: isPreset ? rec.entitlement_name : 'Custom',
      custom_name: isPreset ? '' : rec.entitlement_name,
      amount_type: rec.amount_type || 'fixed',
      amount: rec.amount != null ? String(rec.amount) : '',
      percentage_value: rec.percentage_value != null ? String(rec.percentage_value) : '8.0',
      percentage_basis: rec.percentage_basis || 'basic_salary',
      frequency: rec.frequency || 'Monthly',
      eligibility_status: rec.eligibility_status || 'Applicable',
      approval_status: rec.approval_status || 'Approved',
      effective_date: rec.effective_date || '',
      expiry_date: rec.expiry_date || '',
      notes: rec.notes || '',
    })
    setShowAddEditModal(true)
  }

  // Save Add/Edit Entitlement
  const handleSaveEntitlement = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')

    const resolvedName =
      formData.entitlement_name === 'Custom'
        ? formData.custom_name.trim()
        : formData.entitlement_name.trim()

    if (!resolvedName) {
      setError('Please provide an entitlement name.')
      return
    }

    if (formData.amount_type === 'fixed' && Number(formData.amount) < 0) {
      setError('Monetary amount cannot be negative.')
      return
    }

    if (formData.amount_type === 'percentage') {
      const p = Number(formData.percentage_value)
      if (Number.isNaN(p) || p < 0 || p > 100) {
        setError('Percentage must be a valid number between 0% and 100%.')
        return
      }
    }

    if (formData.expiry_date && formData.effective_date && formData.expiry_date < formData.effective_date) {
      setError('Expiry date cannot precede the effective start date.')
      return
    }

    setSavingAction(true)
    try {
      const payload = {
        employee_id: formData.employee_id,
        category: formData.category,
        entitlement_name: resolvedName,
        amount_type: formData.amount_type,
        amount: formData.amount_type === 'fixed' ? Number(formData.amount) || 0 : null,
        percentage_value: formData.amount_type === 'percentage' ? Number(formData.percentage_value) : null,
        percentage_basis: formData.percentage_basis,
        frequency: formData.frequency,
        eligibility_status: formData.eligibility_status,
        approval_status: formData.approval_status,
        effective_date: formData.effective_date,
        expiry_date: formData.expiry_date || null,
        notes: formData.notes,
      }

      if (editingRecord) {
        await updateEntitlementRecord(editingRecord.id, payload)
        setNotice(`Successfully updated entitlement "${resolvedName}".`)
      } else {
        await createEntitlementRecord(payload)
        setNotice(`Successfully recorded new ${formData.category} "${resolvedName}".`)
      }

      setShowAddEditModal(false)
      await loadInitialData()
      if (selectedEmpId) loadEmployeeProfile(selectedEmpId)
    } catch (err) {
      setError(err.message || 'Could not save entitlement record.')
    } finally {
      setSavingAction(false)
    }
  }

  // Open Audit Trail Modal
  const handleOpenAuditModal = async (rec) => {
    setSelectedAuditRecord(rec)
    setShowAuditModal(true)
    setAuditLoading(true)
    try {
      const logs = await getEntitlementAudit(rec.id)
      setAuditLogs(Array.isArray(logs) ? logs : [])
    } catch (err) {
      console.error('Failed to load audit history:', err)
      setAuditLogs([])
    } finally {
      setAuditLoading(false)
    }
  }

  // Consequential Action Handler (Approve, Reject, Deactivate, Activate)
  const handleConfirmAction = async () => {
    if (!confirmActionModal) return
    const { record, action, notes } = confirmActionModal
    setSavingAction(true)
    setError('')
    try {
      await actionEntitlementRecord(record.id, { action, notes })
      setNotice(`Entitlement "${record.entitlement_name}" status updated to ${action}d.`)
      setConfirmActionModal(null)
      await loadInitialData()
      if (selectedEmpId) loadEmployeeProfile(selectedEmpId)
    } catch (err) {
      setError(err.message || `Failed to perform ${action} action.`)
    } finally {
      setSavingAction(false)
    }
  }

  // Open Edit Service Profile Modal
  const handleOpenProfileModal = () => {
    const emp = employeeProfile?.employee || selectedEmp || {}
    setProfileFormData({
      appointment_date: emp.appointment_date || '',
      basic_salary: emp.basic_salary != null ? String(emp.basic_salary) : '',
      employment_type: emp.employment_type || 'Permanent',
      years_of_experience: emp.years_of_experience != null ? String(emp.years_of_experience) : '',
    })
    setShowProfileModal(true)
  }

  // Save Service Profile
  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setError('')
    setSavingAction(true)
    try {
      await updateEmployeeServiceProfile(selectedEmpId, {
        appointment_date: profileFormData.appointment_date || null,
        basic_salary: profileFormData.basic_salary ? Number(profileFormData.basic_salary) : null,
        employment_type: profileFormData.employment_type,
        years_of_experience: profileFormData.years_of_experience ? parseInt(profileFormData.years_of_experience, 10) : null,
      })
      setNotice(`Updated official service profile for ${selectedEmp.employee_name || selectedEmpId}.`)
      setShowProfileModal(false)
      await loadInitialData()
      if (selectedEmpId) loadEmployeeProfile(selectedEmpId)
    } catch (err) {
      setError(err.message || 'Failed to update service profile.')
    } finally {
      setSavingAction(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* ── Top Header & Global Actions ────────────────────────────────────────── */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-[#1677D2] text-white shadow-xs">
              <Wallet className="size-4" />
            </span>
            <span className="text-[11px] font-bold text-[#1677D2] uppercase tracking-wider">
              Department of Posts Sri Lanka • Benefits & Allowances
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#0B1F3A] sm:text-2xl">
            Employee Entitlements
          </h1>
          <p className="text-xs text-[#64748B]">
            Manage employee allowances, statutory EPF/ETF deductions, and verified government service benefits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenAddModal('allowance')}
            className="flex items-center gap-1.5 rounded-xl bg-[#1677D2] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#125ea7] transition-colors"
          >
            <Plus className="size-4" />
            <span>Add Entitlement</span>
          </button>

          <a
            href="/api/entitlements/reports/export"
            download
            className="flex items-center gap-1.5 rounded-xl border border-[#DFE8F2] bg-white px-3.5 py-2 text-xs font-semibold text-[#172B4D] shadow-xs hover:bg-slate-50 transition-colors"
          >
            <Download className="size-4 text-[#1677D2]" />
            <span>Export CSV</span>
          </a>

          <Link
            to="/entitlements/payroll"
            className="flex items-center gap-1.5 rounded-xl border border-[#DFE8F2] bg-white px-3.5 py-2 text-xs font-semibold text-[#172B4D] shadow-xs hover:bg-slate-50 transition-colors"
          >
            <Banknote className="size-4 text-emerald-600" />
            <span>Salary & Payroll</span>
          </Link>
        </div>
      </div>

      {/* ── Notifications ──────────────────────────────────────────────────────── */}
      {error && (
        <div role="alert" className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError('')} className="p-1 hover:text-rose-950">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {notice && (
        <div role="status" className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice('')} className="p-1 hover:text-emerald-950">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* ── 5 Summary KPI Cards (Requirement 1) ─────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Total Employees"
          value={summary?.total_employees || employees.length || 16}
          note="Registered postal workforce"
          icon={Users}
          tone="blue"
        />
        <KpiCard
          label="Eligible for Benefits"
          value={summary?.eligible_count || 0}
          note="Qualified for gratuity / schemes"
          icon={ShieldCheck}
          tone="up"
        />
        <KpiCard
          label="Active Allowances"
          value={summary?.active_allowances_count || 0}
          note={summary?.active_allowances_monthly_lkr ? formatLkr(summary.active_allowances_monthly_lkr) + '/mo' : 'Configured allowances'}
          icon={Gift}
          tone="blue"
        />
        <KpiCard
          label="Active Deductions"
          value={summary?.active_deductions_count || 0}
          note={summary?.active_deductions_monthly_lkr ? formatLkr(summary.active_deductions_monthly_lkr) + '/mo' : 'Statutory & loans'}
          icon={HandCoins}
          tone="warning"
        />
        <KpiCard
          label="Pending Reviews"
          value={summary?.pending_reviews_count || 0}
          note="Awaiting Postmaster sign-off"
          icon={Clock}
          tone={summary?.pending_reviews_count > 0 ? 'warning' : 'neutral'}
        />
      </div>

      {/* ── Employee Selector & Profile Strip (Requirement 2) ───────────────────── */}
      <div className="rounded-2xl border border-[#DFE8F2] bg-white p-4 sm:p-5 shadow-xs space-y-4">
        {/* Selector row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#DFE8F2] pb-4">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <label htmlFor="employee-select" className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide">
              Select Employee:
            </label>
            <div className="relative flex-1 max-w-md">
              <select
                id="employee-select"
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="h-10 w-full rounded-xl border border-[#DFE8F2] bg-slate-50/80 px-3.5 pr-8 text-xs font-semibold text-[#0B1F3A] focus:border-[#1677D2] focus:bg-white focus:outline-none"
              >
                {employees.map((e) => {
                  const id = e.employee_id || e.name
                  return (
                    <option key={id} value={id}>
                      {id} — {e.employee_name || 'Staff Member'} ({e.designation || 'Postal Clerk'})
                    </option>
                  )
                })}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenProfileModal}
              className="flex items-center gap-1.5 rounded-xl border border-[#DFE8F2] bg-white px-3 py-2 text-xs font-semibold text-[#475569] hover:bg-slate-50 transition-colors"
            >
              <Edit className="size-3.5 text-[#1677D2]" />
              <span>Edit Service Profile</span>
            </button>
            <button
              type="button"
              onClick={() => setShowDetailsModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-[#0B1F3A] px-3 py-2 text-xs font-semibold text-white hover:bg-[#12315c] transition-colors"
            >
              <Eye className="size-3.5" />
              <span>View Full Details</span>
            </button>
          </div>
        </div>

        {/* Selected Employee Detailed Profile */}
        {selectedEmp && (
          <div className="grid gap-4 md:grid-cols-4 items-center">
            {/* Identity */}
            <div className="flex items-center gap-3 md:col-span-2">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-[#E8F1FC] font-extrabold text-[#1677D2] text-sm shrink-0">
                {(selectedEmp.employee_name || 'EM').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-base font-bold text-[#0B1F3A]">
                    {selectedEmp.employee_name || selectedEmp.employee_id}
                  </h2>
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                    {selectedEmp.employment_type || 'Permanent'}
                  </span>
                </div>
                <p className="text-xs text-[#64748B]">
                  {selectedEmp.designation || 'Postal Officer'} · {selectedEmp.post_office || 'Kaduwela Head Post Office'} ·{' '}
                  <span className="font-mono font-medium text-[#172B4D]">{selectedEmp.employee_id || selectedEmp.name}</span>
                </p>
              </div>
            </div>

            {/* Service Duration */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                Service Period
              </span>
              <p className="text-xs font-bold text-[#0B1F3A] mt-0.5">
                {servicePeriodInfo.formatted}
              </p>
              <span className="text-[10px] text-[#64748B]">
                Appointed:{' '}
                {selectedEmp.appointment_date || employeeProfile?.employee?.appointment_date || 'Not available'}
              </span>
            </div>

            {/* Basic Salary & Monthly Net Impact */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
              <span className="text-[10px] font-bold text-[#1677D2] uppercase tracking-wider">
                Basic & Monthly Net Impact
              </span>
              <p className="text-xs font-bold text-[#0B1F3A] mt-0.5">
                {selectedEmp.basic_salary ? formatLkr(selectedEmp.basic_salary) : 'Salary: Not available'}
              </p>
              <span className="text-[10px] font-medium text-emerald-700">
                +{formatLkr(employeeProfile?.summary?.monthly_allowances_total || 0)} allowances /{' '}
                <span className="text-rose-700">-{formatLkr(employeeProfile?.summary?.monthly_deductions_total || 0)} ded.</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Entitlement Categories Navigation Tabs (Requirement 3) ─────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DFE8F2] pb-2">
        <div className="flex flex-wrap items-center gap-1 text-xs">
          {[
            ['all', 'All Entitlements Table', Wallet],
            ['allowances', 'Allowances', Gift],
            ['deductions', 'Deductions', HandCoins],
            ['benefits', 'Service Benefits', Award],
            ['reports', 'Reports & Summary', FileSpreadsheet],
          ].map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-semibold transition-colors ${
                activeTab === key
                  ? 'bg-[#1677D2] text-white shadow-xs'
                  : 'text-[#475569] hover:bg-slate-100'
              }`}
            >
              <Icon className="size-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Status Quick Filter */}
        {activeTab !== 'reports' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#64748B] font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-lg border border-[#DFE8F2] bg-white px-2.5 text-xs text-[#0B1F3A] focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="Approved">Approved / Active</option>
              <option value="Pending">Pending Review</option>
              <option value="Inactive">Inactive / Expired</option>
            </select>
          </div>
        )}
      </div>

      {/* ── TAB CONTENT ──────────────────────────────────────────────────────── */}

      {/* TAB 1: ALL ENTITLEMENTS TABLE (Requirement 4) */}
      {(activeTab === 'all' || activeTab === 'allowances' || activeTab === 'deductions' || activeTab === 'benefits') && (
        <ChartCard
          title={
            activeTab === 'all'
              ? 'Departmental Entitlement Registry'
              : activeTab === 'allowances'
              ? 'Authorized Allowances'
              : activeTab === 'deductions'
              ? 'Configured Deductions & Recoveries'
              : 'Postal Service Benefits & Eligibility'
          }
          note={`${filteredRecords.length} records matching current filters`}
          headerAction={
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search entitlement or employee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-full rounded-lg border border-[#DFE8F2] bg-slate-50/70 pl-8 pr-3 text-xs text-[#0B1F3A] placeholder:text-slate-400 focus:border-[#1677D2] focus:bg-white focus:outline-none"
              />
            </div>
          }
        >
          {loading ? (
            <LoadingState message="Loading entitlement registry..." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#DFE8F2] bg-slate-50 text-[11px] font-semibold text-[#64748B] uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Entitlement</th>
                    <th className="py-2.5 px-3">Amount (LKR)</th>
                    <th className="py-2.5 px-3">Frequency</th>
                    <th className="py-2.5 px-3">Eligibility</th>
                    <th className="py-2.5 px-3">Effective Date</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DFE8F2]">
                  {filteredRecords.length > 0 ? (
                    filteredRecords.map((r) => {
                      const isApproved = r.approval_status === 'Approved' || r.approval_status === 'Active'
                      const isPending = r.approval_status === 'Pending'

                      return (
                        <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Employee */}
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-[#0B1F3A]">{r.employee_name || r.employee_id}</div>
                            <div className="text-[10px] text-[#64748B]">
                              {r.employee_id} · {r.designation}
                            </div>
                          </td>

                          {/* Entitlement */}
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-[#0B1F3A]">{r.entitlement_name}</div>
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${
                                r.category === 'allowance'
                                  ? 'bg-blue-50 text-blue-700'
                                  : r.category === 'deduction'
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-amber-50 text-amber-800'
                              }`}
                            >
                              {r.category === 'service_benefit' ? 'Service Benefit' : r.category}
                            </span>
                          </td>

                          {/* Amount */}
                          <td className="py-2.5 px-3 font-semibold">
                            {r.amount_type === 'percentage' ? (
                              <div>
                                <span className="text-[#0B1F3A]">{r.percentage_value}% of basic</span>
                                <div className="text-[10px] text-[#64748B]">≈ {formatLkr(r.effective_amount)}</div>
                              </div>
                            ) : (
                              <span
                                className={
                                  r.category === 'allowance'
                                    ? 'text-emerald-700 font-bold'
                                    : r.category === 'deduction'
                                    ? 'text-rose-700 font-bold'
                                    : 'text-[#0B1F3A]'
                                }
                              >
                                {r.effective_amount ? formatLkr(r.effective_amount) : 'Rule-based'}
                              </span>
                            )}
                          </td>

                          {/* Frequency */}
                          <td className="py-2.5 px-3 text-[#475569]">{r.frequency || 'Monthly'}</td>

                          {/* Eligibility */}
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                r.eligibility_status === 'Approved' || r.eligibility_status === 'Applicable'
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                  : r.eligibility_status === 'Pending verification'
                                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                                  : 'border-slate-200 bg-slate-50 text-slate-600'
                              }`}
                            >
                              {r.eligibility_status}
                            </span>
                          </td>

                          {/* Effective Date */}
                          <td className="py-2.5 px-3 text-[#475569]">
                            <div>{r.effective_date}</div>
                            {r.expiry_date && (
                              <div className="text-[10px] text-amber-700">Exp: {r.expiry_date}</div>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                isApproved
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : isPending
                                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                                  : 'border-slate-200 bg-slate-50 text-slate-600'
                              }`}
                            >
                              {r.approval_status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                title="View details and audit log"
                                onClick={() => handleOpenAuditModal(r)}
                                className="rounded-lg p-1 text-[#64748B] hover:bg-slate-100 hover:text-[#0B1F3A]"
                              >
                                <History className="size-4" />
                              </button>

                              <button
                                type="button"
                                title="Edit entitlement"
                                onClick={() => handleOpenEditModal(r)}
                                className="rounded-lg p-1 text-[#64748B] hover:bg-slate-100 hover:text-[#0B1F3A]"
                              >
                                <Edit className="size-4" />
                              </button>

                              {isPostmaster && isPending && (
                                <button
                                  type="button"
                                  title="Approve request"
                                  onClick={() =>
                                    setConfirmActionModal({
                                      record: r,
                                      action: 'approve',
                                      title: 'Approve Entitlement',
                                      message: `Are you sure you want to approve "${r.entitlement_name}" for ${r.employee_name}?`,
                                    })
                                  }
                                  className="rounded-lg p-1 text-emerald-600 hover:bg-emerald-50"
                                >
                                  <CheckCircle2 className="size-4" />
                                </button>
                              )}

                              {isPostmaster && isApproved && (
                                <button
                                  type="button"
                                  title="Deactivate entitlement"
                                  onClick={() =>
                                    setConfirmActionModal({
                                      record: r,
                                      action: 'deactivate',
                                      title: 'Deactivate Entitlement',
                                      message: `Deactivate "${r.entitlement_name}" for ${r.employee_name}? History will be preserved.`,
                                    })
                                  }
                                  className="rounded-lg p-1 text-rose-600 hover:bg-rose-50"
                                >
                                  <MinusCircle className="size-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-xs text-[#64748B]">
                        No entitlement records match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      )}

      {/* TAB 2: REPORTS & SUMMARY (Requirement 9) */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Monthly Allowance Totals by Type */}
            <ChartCard title="Monthly Allowances by Type" note="Current monthly payout breakdown">
              <div className="space-y-3">
                {reportsData?.allowance_breakdown?.map((item) => (
                  <div key={item.type} className="flex items-center justify-between border-b border-[#DFE8F2] pb-2 text-xs">
                    <div>
                      <p className="font-semibold text-[#0B1F3A]">{item.type}</p>
                      <p className="text-[10px] text-[#64748B]">{item.count} officers receiving</p>
                    </div>
                    <span className="font-bold text-emerald-700">{formatLkr(item.total_monthly)}/mo</span>
                  </div>
                ))}
              </div>
            </ChartCard>

            {/* Monthly Deduction Totals by Type */}
            <ChartCard title="Monthly Deductions by Type" note="Statutory and internal recoveries">
              <div className="space-y-3">
                {reportsData?.deduction_breakdown?.map((item) => (
                  <div key={item.type} className="flex items-center justify-between border-b border-[#DFE8F2] pb-2 text-xs">
                    <div>
                      <p className="font-semibold text-[#0B1F3A]">{item.type}</p>
                      <p className="text-[10px] text-[#64748B]">{item.count} officers enrolled</p>
                    </div>
                    <span className="font-bold text-rose-700">{formatLkr(item.total_monthly)}/mo</span>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>

          {/* Pending Reviews & Expiring Entitlements */}
          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard title="Pending Entitlement Reviews" note="Awaiting supervisory sign-off">
              <div className="space-y-2">
                {reportsData?.pending_approvals?.length > 0 ? (
                  reportsData.pending_approvals.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/50 p-2.5 text-xs">
                      <div>
                        <p className="font-semibold text-[#0B1F3A]">{p.entitlement_name}</p>
                        <p className="text-[10px] text-[#64748B]">
                          {p.employee_name} ({p.employee_id}) · {formatLkr(p.effective_amount)}
                        </p>
                      </div>
                      {isPostmaster && (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmActionModal({
                              record: p,
                              action: 'approve',
                              title: 'Approve Entitlement',
                              message: `Approve "${p.entitlement_name}" for ${p.employee_name}?`,
                            })
                          }
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                        >
                          Approve
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-center py-4 text-xs text-[#64748B]">No pending entitlement reviews.</p>
                )}
              </div>
            </ChartCard>

            <ChartCard title="Expiring Entitlements (Next 60 Days)" note="Subject to annual or periodic renewal">
              <div className="space-y-2">
                {reportsData?.expiring_entitlements?.length > 0 ? (
                  reportsData.expiring_entitlements.map((x) => (
                    <div key={x.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs">
                      <div>
                        <p className="font-semibold text-[#0B1F3A]">{x.entitlement_name}</p>
                        <p className="text-[10px] text-[#64748B]">
                          {x.employee_name} · Expires on {x.expiry_date} ({x.days_remaining} days left)
                        </p>
                      </div>
                      <span className="font-bold text-amber-800">{formatLkr(x.effective_amount)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-4 text-xs text-[#64748B]">No entitlements expiring in the next 60 days.</p>
                )}
              </div>
            </ChartCard>
          </div>
        </div>
      )}

      {/* ── ADD / EDIT ENTITLEMENT MODAL (Requirement 5) ────────────────────────── */}
      {showAddEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveEntitlement}
            className="w-full max-w-lg rounded-2xl border border-[#DFE8F2] bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between border-b border-[#DFE8F2] pb-3">
              <div>
                <span className="text-[10px] font-bold text-[#1677D2] uppercase tracking-wider">
                  {editingRecord ? 'Edit Entitlement' : 'New Entitlement'}
                </span>
                <h3 className="text-base font-bold text-[#0B1F3A]">
                  {editingRecord ? `Update ${editingRecord.entitlement_name}` : 'Record Employee Entitlement'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddEditModal(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Employee Selection */}
              <div>
                <label htmlFor="form-emp" className="block font-semibold text-[#0B1F3A] mb-1">
                  Employee *
                </label>
                <select
                  id="form-emp"
                  disabled={Boolean(editingRecord)}
                  value={formData.employee_id}
                  onChange={(e) => setFormData((p) => ({ ...p, employee_id: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-[#DFE8F2] bg-slate-50 px-3 text-xs text-[#0B1F3A] focus:outline-none focus:bg-white"
                >
                  {employees.map((e) => (
                    <option key={e.employee_id || e.name} value={e.employee_id || e.name}>
                      {e.employee_id || e.name} — {e.employee_name} ({e.designation})
                    </option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['allowance', 'Allowance'],
                  ['deduction', 'Deduction'],
                  ['service_benefit', 'Service Benefit'],
                ].map(([cat, label]) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setFormData((p) => ({
                        ...p,
                        category: cat,
                        entitlement_name:
                          cat === 'allowance'
                            ? ALLOWANCE_PRESETS[0]
                            : cat === 'deduction'
                            ? DEDUCTION_PRESETS[0]
                            : BENEFIT_PRESETS[0],
                      }))
                    }}
                    className={`rounded-lg border py-2 text-center text-xs font-semibold transition-colors ${
                      formData.category === cat
                        ? 'border-[#1677D2] bg-blue-50 text-[#1677D2]'
                        : 'border-[#DFE8F2] bg-white text-[#475569]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Entitlement Name Preset or Custom */}
              <div>
                <label htmlFor="form-name" className="block font-semibold text-[#0B1F3A] mb-1">
                  Entitlement Name *
                </label>
                <select
                  id="form-name"
                  value={formData.entitlement_name}
                  onChange={(e) => setFormData((p) => ({ ...p, entitlement_name: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-[#DFE8F2] bg-white px-3 text-xs text-[#0B1F3A] focus:outline-none"
                >
                  {(formData.category === 'allowance'
                    ? ALLOWANCE_PRESETS
                    : formData.category === 'deduction'
                    ? DEDUCTION_PRESETS
                    : BENEFIT_PRESETS
                  ).map((preset) => (
                    <option key={preset} value={preset}>
                      {preset}
                    </option>
                  ))}
                  <option value="Custom">-- Custom Entitlement Name --</option>
                </select>

                {formData.entitlement_name === 'Custom' && (
                  <input
                    type="text"
                    required
                    placeholder="Enter custom entitlement name..."
                    value={formData.custom_name}
                    onChange={(e) => setFormData((p) => ({ ...p, custom_name: e.target.value }))}
                    className="mt-1.5 h-9 w-full rounded-lg border border-[#DFE8F2] px-3 text-xs text-[#0B1F3A] focus:outline-none"
                  />
                )}
              </div>

              {/* Amount Type & Values */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="form-amt-type" className="block font-semibold text-[#0B1F3A] mb-1">
                    Amount Basis
                  </label>
                  <select
                    id="form-amt-type"
                    value={formData.amount_type}
                    onChange={(e) => setFormData((p) => ({ ...p, amount_type: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-[#DFE8F2] bg-white px-3 text-xs text-[#0B1F3A] focus:outline-none"
                  >
                    <option value="fixed">Fixed Amount (LKR)</option>
                    <option value="percentage">Percentage (%) of Basic</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="form-freq" className="block font-semibold text-[#0B1F3A] mb-1">
                    Payment Frequency
                  </label>
                  <select
                    id="form-freq"
                    value={formData.frequency}
                    onChange={(e) => setFormData((p) => ({ ...p, frequency: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-[#DFE8F2] bg-white px-3 text-xs text-[#0B1F3A] focus:outline-none"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Annual">Annual</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="One-time">One-time</option>
                  </select>
                </div>
              </div>

              {formData.amount_type === 'fixed' ? (
                <div>
                  <label htmlFor="form-amount" className="block font-semibold text-[#0B1F3A] mb-1">
                    Amount (LKR) *
                  </label>
                  <input
                    id="form-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData((p) => ({ ...p, amount: e.target.value }))}
                    placeholder="e.g. 5000"
                    className="h-9 w-full rounded-lg border border-[#DFE8F2] px-3 text-xs font-bold text-[#0B1F3A] focus:outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label htmlFor="form-pct" className="block font-semibold text-[#0B1F3A] mb-1">
                    Percentage Rate (%) *
                  </label>
                  <input
                    id="form-pct"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    required
                    value={formData.percentage_value}
                    onChange={(e) => setFormData((p) => ({ ...p, percentage_value: e.target.value }))}
                    placeholder="e.g. 8.0"
                    className="h-9 w-full rounded-lg border border-[#DFE8F2] px-3 text-xs font-bold text-[#0B1F3A] focus:outline-none"
                  />
                </div>
              )}

              {/* Effective and Expiry Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="form-eff" className="block font-semibold text-[#0B1F3A] mb-1">
                    Effective Date *
                  </label>
                  <input
                    id="form-eff"
                    type="date"
                    required
                    value={formData.effective_date}
                    onChange={(e) => setFormData((p) => ({ ...p, effective_date: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-[#DFE8F2] px-3 text-xs text-[#0B1F3A] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="form-exp" className="block font-semibold text-[#0B1F3A] mb-1">
                    Expiry Date (Optional)
                  </label>
                  <input
                    id="form-exp"
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData((p) => ({ ...p, expiry_date: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-[#DFE8F2] px-3 text-xs text-[#0B1F3A] focus:outline-none"
                  />
                </div>
              </div>

              {/* Eligibility & Approval Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="form-elig" className="block font-semibold text-[#0B1F3A] mb-1">
                    Eligibility Status
                  </label>
                  <select
                    id="form-elig"
                    value={formData.eligibility_status}
                    onChange={(e) => setFormData((p) => ({ ...p, eligibility_status: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-[#DFE8F2] bg-white px-3 text-xs text-[#0B1F3A] focus:outline-none"
                  >
                    <option value="Approved">Approved</option>
                    <option value="Applicable">Applicable</option>
                    <option value="Pending verification">Pending verification</option>
                    <option value="Not applicable">Not applicable</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="form-app" className="block font-semibold text-[#0B1F3A] mb-1">
                    Approval Decision
                  </label>
                  <select
                    id="form-app"
                    disabled={!isPostmaster}
                    value={formData.approval_status}
                    onChange={(e) => setFormData((p) => ({ ...p, approval_status: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-[#DFE8F2] bg-white px-3 text-xs text-[#0B1F3A] focus:outline-none disabled:bg-slate-50"
                  >
                    <option value="Approved">Approved</option>
                    <option value="Pending">Pending Review</option>
                    <option value="Inactive">Inactive / Suspended</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="form-notes" className="block font-semibold text-[#0B1F3A] mb-1">
                  Departmental Notes & Reference
                </label>
                <textarea
                  id="form-notes"
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Official circular, gazette reference, or sanction note..."
                  className="w-full rounded-lg border border-[#DFE8F2] p-2.5 text-xs text-[#0B1F3A] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#DFE8F2] pt-4">
              <button
                type="button"
                onClick={() => setShowAddEditModal(false)}
                className="h-9 rounded-xl border border-[#DFE8F2] px-4 text-xs font-semibold text-[#475569] hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingAction}
                className="h-9 rounded-xl bg-[#1677D2] px-4 text-xs font-bold text-white hover:bg-[#125ea7] disabled:opacity-50"
              >
                {savingAction ? 'Saving...' : editingRecord ? 'Save Changes' : 'Confirm & Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── AUDIT TRAIL & DETAILS MODAL (Requirement 8) ─────────────────────────── */}
      {showAuditModal && selectedAuditRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[#DFE8F2] bg-white p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-[#DFE8F2] pb-3">
              <div>
                <span className="text-[10px] font-bold text-[#1677D2] uppercase tracking-wider">
                  Audit History & Specifications
                </span>
                <h3 className="text-base font-bold text-[#0B1F3A]">
                  {selectedAuditRecord.entitlement_name}
                </h3>
                <p className="text-xs text-[#64748B]">
                  Employee: {selectedAuditRecord.employee_name} ({selectedAuditRecord.employee_id})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Current Spec details */}
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Category:</span>
                <span className="font-semibold text-[#0B1F3A] capitalize">{selectedAuditRecord.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Amount:</span>
                <span className="font-bold text-[#0B1F3A]">{formatLkr(selectedAuditRecord.effective_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Frequency:</span>
                <span className="text-[#0B1F3A]">{selectedAuditRecord.frequency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Effective Range:</span>
                <span className="text-[#0B1F3A]">
                  {selectedAuditRecord.effective_date} to {selectedAuditRecord.expiry_date || 'Ongoing'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Approval Status:</span>
                <span className="font-semibold text-emerald-700">{selectedAuditRecord.approval_status}</span>
              </div>
              {selectedAuditRecord.notes && (
                <div className="border-t border-slate-200 pt-2 text-[11px] text-[#475569]">
                  <strong>Notes:</strong> {selectedAuditRecord.notes}
                </div>
              )}
            </div>

            {/* Chronological Audit Logs */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide">
                Chronological Modification History
              </h4>
              {auditLoading ? (
                <LoadingState message="Fetching audit logs..." />
              ) : auditLogs.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {auditLogs.map((log) => (
                    <div key={log.id || log.timestamp} className="rounded-lg border border-[#DFE8F2] p-2.5 text-xs bg-white">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-[#1677D2] uppercase">{log.action}</span>
                        <span className="text-[#64748B]">{log.timestamp?.replace('T', ' ')}</span>
                      </div>
                      <p className="text-slate-800 text-[11px] mt-1">{log.notes || 'Status or value modification.'}</p>
                      <p className="text-[10px] text-slate-500">By user: {log.performed_by}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-3 text-xs text-[#64748B]">No modification logs recorded yet.</p>
              )}
            </div>

            <div className="flex justify-end border-t border-[#DFE8F2] pt-3">
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="h-9 rounded-xl bg-[#0B1F3A] px-4 text-xs font-semibold text-white hover:bg-[#12315c]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW FULL DETAILS MODAL (Requirement 2) ─────────────────────────────── */}
      {showDetailsModal && employeeProfile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-[#DFE8F2] bg-white p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-[#DFE8F2] pb-3">
              <div>
                <span className="text-[10px] font-bold text-[#1677D2] uppercase tracking-wider">
                  Full Entitlement & Benefit Portfolio
                </span>
                <h3 className="text-lg font-bold text-[#0B1F3A]">
                  {employeeProfile.employee?.employee_name} ({employeeProfile.employee?.employee_id})
                </h3>
                <p className="text-xs text-[#64748B]">
                  {employeeProfile.employee?.designation} · {employeeProfile.employee?.post_office} ·{' '}
                  {employeeProfile.employee?.employment_type}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Service & Salary Banner */}
            <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
              <div>
                <span className="text-[10px] text-[#64748B] font-semibold uppercase">Appointment Date</span>
                <p className="font-bold text-[#0B1F3A]">{employeeProfile.employee?.appointment_date || 'Not available'}</p>
              </div>
              <div>
                <span className="text-[10px] text-[#64748B] font-semibold uppercase">Service Period</span>
                <p className="font-bold text-[#0B1F3A]">{employeeProfile.employee?.service_period?.formatted}</p>
              </div>
              <div>
                <span className="text-[10px] text-[#64748B] font-semibold uppercase">Basic Salary</span>
                <p className="font-bold text-[#0B1F3A]">
                  {employeeProfile.employee?.basic_salary ? formatLkr(employeeProfile.employee?.basic_salary) : 'Not available'}
                </p>
              </div>
            </div>

            {/* Departmental Statutory Benefit Rules */}
            <div>
              <h4 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide mb-2">
                Statutory & Departmental Benefit Schemes
              </h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {employeeProfile.statutory_benefits?.map((b) => (
                  <div key={b.benefit_key} className="rounded-xl border border-[#DFE8F2] p-3 text-xs bg-white">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#0B1F3A]">{b.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          b.applicable ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {b.eligibility_status}
                      </span>
                    </div>
                    {b.estimated_amount && (
                      <p className="mt-1 font-bold text-[#1677D2]">{formatLkr(b.estimated_amount)}</p>
                    )}
                    <p className="mt-1 text-[11px] text-[#64748B] leading-tight">{b.rule_note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end border-t border-[#DFE8F2] pt-3">
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="h-9 rounded-xl bg-[#0B1F3A] px-4 text-xs font-semibold text-white hover:bg-[#12315c]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT SERVICE PROFILE MODAL (Requirement 2) ─────────────────────────── */}
      {showProfileModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveProfile}
            className="w-full max-w-md rounded-2xl border border-[#DFE8F2] bg-white p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between border-b border-[#DFE8F2] pb-3">
              <div>
                <span className="text-[10px] font-bold text-[#1677D2] uppercase tracking-wider">
                  Update Employee Service Profile
                </span>
                <h3 className="text-base font-bold text-[#0B1F3A]">
                  {selectedEmp?.employee_name} ({selectedEmp?.employee_id})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label htmlFor="prof-date" className="block font-semibold text-[#0B1F3A] mb-1">
                  Official Appointment Date (YYYY-MM-DD)
                </label>
                <input
                  id="prof-date"
                  type="date"
                  value={profileFormData.appointment_date}
                  onChange={(e) => setProfileFormData((p) => ({ ...p, appointment_date: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-[#DFE8F2] px-3 text-xs text-[#0B1F3A] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="prof-salary" className="block font-semibold text-[#0B1F3A] mb-1">
                  Monthly Basic Salary (LKR)
                </label>
                <input
                  id="prof-salary"
                  type="number"
                  min="0"
                  step="0.01"
                  value={profileFormData.basic_salary}
                  onChange={(e) => setProfileFormData((p) => ({ ...p, basic_salary: e.target.value }))}
                  placeholder="e.g. 48000"
                  className="h-9 w-full rounded-lg border border-[#DFE8F2] px-3 text-xs font-bold text-[#0B1F3A] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="prof-type" className="block font-semibold text-[#0B1F3A] mb-1">
                  Employment Status
                </label>
                <select
                  id="prof-type"
                  value={profileFormData.employment_type}
                  onChange={(e) => setProfileFormData((p) => ({ ...p, employment_type: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-[#DFE8F2] bg-white px-3 text-xs text-[#0B1F3A] focus:outline-none"
                >
                  <option value="Permanent">Permanent</option>
                  <option value="Contract">Contract</option>
                  <option value="Temporary">Temporary</option>
                  <option value="Probation">Probation</option>
                </select>
              </div>

              <div>
                <label htmlFor="prof-yoe" className="block font-semibold text-[#0B1F3A] mb-1">
                  Years of Experience (Fallback)
                </label>
                <input
                  id="prof-yoe"
                  type="number"
                  min="0"
                  value={profileFormData.years_of_experience}
                  onChange={(e) => setProfileFormData((p) => ({ ...p, years_of_experience: e.target.value }))}
                  placeholder="e.g. 8"
                  className="h-9 w-full rounded-lg border border-[#DFE8F2] px-3 text-xs text-[#0B1F3A] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#DFE8F2] pt-4">
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="h-9 rounded-xl border border-[#DFE8F2] px-4 text-xs font-semibold text-[#475569] hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingAction}
                className="h-9 rounded-xl bg-[#1677D2] px-4 text-xs font-bold text-white hover:bg-[#125ea7] disabled:opacity-50"
              >
                {savingAction ? 'Saving...' : 'Update Service Profile'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── CONFIRMATION MODAL (Requirement 5) ─────────────────────────────────── */}
      {confirmActionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl border border-[#DFE8F2] bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#0B1F3A]">{confirmActionModal.title}</h3>
            <p className="text-xs text-[#64748B]">{confirmActionModal.message}</p>
            <div className="flex justify-end gap-2 border-t border-[#DFE8F2] pt-4">
              <button
                type="button"
                onClick={() => setConfirmActionModal(null)}
                className="h-9 rounded-xl border border-[#DFE8F2] px-3.5 text-xs font-semibold text-[#475569] hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingAction}
                onClick={handleConfirmAction}
                className={`h-9 rounded-xl px-4 text-xs font-bold text-white ${
                  confirmActionModal.action === 'deactivate' || confirmActionModal.action === 'reject'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-[#1677D2] hover:bg-[#125ea7]'
                } disabled:opacity-50`}
              >
                {savingAction ? 'Processing...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
