import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Banknote,
  Briefcase,
  CheckCircle2,
  DollarSign,
  FileText,
  Gift,
  HandCoins,
  HeartHandshake,
  Home,
  Info,
  Layers,
  Scale,
  ShieldCheck,
  User,
  Users,
  Wallet,
} from 'lucide-react'
import { getPayroll, list } from '../admin/data/repository'
import ChartCard from '../admin/ui/ChartCard'
import KpiCard from '../admin/ui/KpiCard'
import { currentMonth, money } from './format'

export default function EntitlementDashboard() {
  const [data, setData] = useState(null)
  const [employees, setEmployees] = useState([])
  const [selectedEmpId, setSelectedEmpId] = useState('')
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'allowances' | 'gratuity' | 'holiday' | 'loans'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([getPayroll(currentMonth()), list('employee')])
      .then(([payload, people]) => {
        if (!cancelled) {
          setData(payload)
          const listArr = Array.isArray(people) ? people : []
          setEmployees(listArr)
          if (listArr.length > 0 && !selectedEmpId) {
            setSelectedEmpId(listArr[0].employee_id || listArr[0].name)
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load entitlements')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selectedEmp = useMemo(() => {
    return employees.find((e) => (e.employee_id || e.name) === selectedEmpId) || employees[0] || null
  }, [employees, selectedEmpId])

  // Allowances breakdown
  const allowances = useMemo(() => [
    { type: 'Cost of Living Allowance', amount: '15,000', freq: 'Monthly' },
    { type: 'Transport Allowance', amount: '5,000', freq: 'Monthly' },
    { type: 'Medical Allowance', amount: '3,500', freq: 'Monthly' },
  ], [])

  // Deductions breakdown
  const deductions = useMemo(() => [
    { type: 'EPF (8%)', amount: '2,800', freq: 'Monthly' },
    { type: 'ETF (3%)', amount: '1,050', freq: 'Monthly' },
    { type: 'Income Tax', amount: '1,500', freq: 'Monthly' },
  ], [])

  return (
    <div className="space-y-4">
      {/* ── Top Bar: Employee Selector (Mockup 5) ─────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#DFE8F2] bg-white p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <label htmlFor="ent-emp-select" className="text-xs font-semibold text-[#172B4D]">
            Employee:
          </label>
          <select
            id="ent-emp-select"
            className="h-9 w-full max-w-sm rounded-lg border border-[#DFE8F2] bg-slate-50 px-3 text-xs font-medium text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
            value={selectedEmpId}
            onChange={(e) => setSelectedEmpId(e.target.value)}
          >
            {employees.map((e) => (
              <option key={e.employee_id || e.name} value={e.employee_id || e.name}>
                {e.employee_name || e.employee_id} ({e.designation || 'Staff'} · {e.post_office || 'General'})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/entitlements/payroll"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#DFE8F2] bg-white px-3 py-1.5 text-xs font-semibold text-[#172B4D] shadow-xs hover:bg-slate-50"
          >
            <Banknote className="size-3.5 text-[#1677D2]" />
            Salary & Payroll View
          </Link>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {/* ── Sub Navigation Tabs (Mockup 5) ────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1 border-b border-[#DFE8F2] pb-1 text-xs">
        {[
          ['overview', 'Overview'],
          ['allowances', 'Allowances & Deductions'],
          ['gratuity', 'Gratuity'],
          ['holiday', 'Holiday Pay'],
          ['loans', 'Loans'],
          ['leave', 'Leave Entitlements'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`rounded-lg px-3 py-1.5 font-semibold transition-colors ${activeTab === key ? 'bg-[#1677D2] text-white' : 'text-[#64748B] hover:bg-slate-100'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Employee Profile Strip (Mockup 5) ─────────────────────────────── */}
      {selectedEmp && (
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-[#DFE8F2] bg-white p-4 shadow-xs sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full bg-blue-50 text-[#1677D2] font-bold text-sm">
              {(selectedEmp.employee_name || 'NP').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-base font-bold text-[#172B4D]">{selectedEmp.employee_name || selectedEmp.employee_id}</h2>
              <p className="text-xs text-[#64748B]">
                {selectedEmp.designation || 'Postal Clerk'} · {selectedEmp.post_office || 'Kaduwela Post Office'} · ID: <span className="font-mono text-[#172B4D]">{selectedEmp.employee_id || selectedEmp.name}</span>
              </p>
            </div>
          </div>
          <div className="text-left sm:text-right border-t border-[#DFE8F2] pt-2 sm:border-t-0 sm:pt-0">
            <span className="text-[11px] text-[#64748B] uppercase font-semibold">Service Period</span>
            <p className="text-sm font-bold text-[#172B4D]">5 Years 2 Months</p>
          </div>
        </div>
      )}

      {/* ── Allowances & Deductions Dual Tables (Mockup 5) ────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Allowances Table */}
        <ChartCard
          title="Allowances"
          note="Designated state allowances for selected grade"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#DFE8F2] bg-slate-50 text-[10px] font-semibold text-[#64748B] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Allowance Type</th>
                  <th className="py-2.5 px-3">Amount (LKR)</th>
                  <th className="py-2.5 px-3 text-right">Frequency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFE8F2]">
                {allowances.map((a, i) => (
                  <tr key={i} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-medium text-[#172B4D]">{a.type}</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-700">{a.amount}</td>
                    <td className="py-2.5 px-3 text-right text-[#64748B]">{a.freq}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        {/* Deductions Table */}
        <ChartCard
          title="Deductions"
          note="Statutory government deductions & pension/EPF/ETF"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#DFE8F2] bg-slate-50 text-[10px] font-semibold text-[#64748B] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Amount (LKR)</th>
                  <th className="py-2.5 px-3 text-right">Frequency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFE8F2]">
                {deductions.map((d, i) => (
                  <tr key={i} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-medium text-[#172B4D]">{d.type}</td>
                    <td className="py-2.5 px-3 font-bold text-rose-700">{d.amount}</td>
                    <td className="py-2.5 px-3 text-right text-[#64748B]">{d.freq}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      {/* ── 4 Status Cards (Mockup 5 bottom cards) ────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* Gratuity */}
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
            <Wallet className="size-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-amber-900 uppercase">Gratuity</span>
            <p className="text-xs font-bold text-amber-900">Eligible</p>
          </div>
        </div>

        {/* Holiday Pay */}
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-[#1677D2]">
            <CalendarIcon className="size-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-blue-900 uppercase">Holiday Pay</span>
            <p className="text-xs font-bold text-blue-900">Applicable</p>
          </div>
        </div>

        {/* Housing Loan */}
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
            <Home className="size-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-emerald-900 uppercase">Housing Loan</span>
            <p className="text-xs font-bold text-emerald-900">Eligible</p>
          </div>
        </div>

        {/* Maternity Leave / Extended Benefits */}
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-600">
            <HeartHandshake className="size-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-700 uppercase">Maternity Leave</span>
            <p className="text-xs font-bold text-slate-600">Not Applicable</p>
          </div>
        </div>
      </div>
    </div>
  )
}

