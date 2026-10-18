import {
  ArrowLeftRight,
  BrainCircuit,
  CalendarCheck,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  Clock,
  Gift,
  HandCoins,
  Landmark,
  LayoutDashboard,
  PartyPopper,
  PiggyBank,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  UserRound,
  UsersRound,
  Wallet,
} from 'lucide-react'

// ── WORKSPACE ──────────────────────────────────────────────────────────────
export const workspaceNav = [
  {
    to: '/employee',
    label: 'Employee Overview',
    hint: "Overall view of your team's performance",
    icon: LayoutDashboard,
    group: 'WORKSPACE',
  },
  {
    to: '/daily-kpi-log',
    label: 'Daily KPI Log',
    hint: 'Record and manage daily performance',
    icon: ClipboardList,
    group: 'WORKSPACE',
  },
  {
    to: '/productivity',
    label: 'AI Productivity Coach',
    hint: 'Smart suggestions for better performance',
    icon: BrainCircuit,
    group: 'WORKSPACE',
  },
  {
    to: '/attendance-log',
    label: 'Leave & Attendance',
    hint: 'Time-bound door tokens & verified attendance logs',
    icon: CalendarCheck,
    group: 'WORKSPACE',
  },
  {
    to: '/entitlements',
    label: 'Employee Entitlements',
    hint: 'Manage employee benefits and allowances',
    icon: Wallet,
    group: 'WORKSPACE',
  },
]

// ── PLANNING & ANALYTICS ───────────────────────────────────────────────────
export const analyticsNav = [
  {
    to: '/kpi-forecasts',
    label: 'KPI Forecasts & Analytics',
    hint: 'Predict future performance with ML forecasting models',
    icon: ChartNoAxesCombined,
    group: 'PLANNING & ANALYTICS',
    role: 'postmaster',
  },
  {
    to: '/kpi-simulator',
    label: 'KPI Simulator',
    hint: 'Explore what-if productivity scenarios',
    icon: SlidersHorizontal,
    group: 'PLANNING & ANALYTICS',
  },
  {
    to: '/work-allocation',
    label: 'Work Allocation',
    hint: 'Plan and balance employee workload',
    icon: UsersRound,
    group: 'PLANNING & ANALYTICS',
  },
]

// ── ADMINISTRATION ─────────────────────────────────────────────────────────
export const adminNav = [
  {
    to: '/postal-kpi-dashboard',
    label: 'Administration',
    hint: 'Postal workforce administrative oversight and KPI metrics',
    icon: ShieldCheck,
    group: 'ADMINISTRATION',
    role: 'postmaster',
  },
  {
    to: '/settings',
    label: 'Settings',
    hint: 'User preferences, post office location, and door codes',
    icon: Settings,
    group: 'ADMINISTRATION',
  },
]

// ── EMPLOYEE ENTITLEMENTS sub-nav (used for breadcrumbs + search only) ─────
export const entitlementNav = [
  { to: '/entitlements', label: 'Dashboard', hint: 'Manage employee benefits and allowances', icon: LayoutDashboard, end: true, group: 'Employee Entitlements' },
  { to: '/entitlements/payroll', label: 'Salary & Payroll', hint: 'Manage salary and payroll', icon: Wallet, group: 'Employee Entitlements' },
  { to: '/entitlements/leave', label: 'Leave Management', hint: 'Manage leaves and view attendance', icon: CalendarDays, group: 'Employee Entitlements' },
  { to: '/entitlements/holiday-pay', label: 'Holiday Pay', icon: PartyPopper, group: 'Employee Entitlements' },
  { to: '/entitlements/overtime', label: 'Overtime', icon: Clock, group: 'Employee Entitlements' },
  { to: '/entitlements/epf', label: 'EPF', icon: Landmark, group: 'Employee Entitlements' },
  { to: '/entitlements/etf', label: 'ETF', icon: PiggyBank, group: 'Employee Entitlements' },
  { to: '/entitlements/gratuity', label: 'Gratuity', icon: Gift, group: 'Employee Entitlements' },
  { to: '/entitlements/promotions', label: 'Promotions', icon: TrendingUp, group: 'Employee Entitlements' },
  { to: '/entitlements/transfers', label: 'Transfers', icon: ArrowLeftRight, group: 'Employee Entitlements' },
  { to: '/entitlements/family-benefits', label: 'Maternity / Family Benefits', icon: UsersRound, group: 'Employee Entitlements' },
  { to: '/entitlements/retirement', label: 'Retirement', icon: UserRound, group: 'Employee Entitlements' },
  { to: '/entitlements/loans', label: 'Loans / Advances', icon: HandCoins, group: 'Employee Entitlements' },
]

// ── Helpers ────────────────────────────────────────────────────────────────

/** Filter nav items to those visible for a given role. */
export function visibleItems(items, role) {
  return items.filter((item) => !item.role || item.role === role)
}

/** Build breadcrumb trail from the current pathname. */
export function crumbsFor(pathname) {
  const all = [
    ...workspaceNav,
    ...analyticsNav,
    ...adminNav,
    { to: '/forecast-monitoring', label: 'Forecast Monitoring', hint: 'Compare saved forecasts with recorded weeks', group: 'PLANNING & ANALYTICS' },
    ...entitlementNav,
  ]
  const match = [...all]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) =>
      item.end
        ? pathname === item.to
        : pathname === item.to || pathname.startsWith(`${item.to}/`),
    )
  if (!match) return [{ label: 'Postal KPI Desk' }]
  return [{ label: match.group }, { label: match.label, hint: match.hint }]
}
