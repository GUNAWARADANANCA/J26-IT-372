import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Building2,
  ChevronDown,
  Fingerprint,
  LayoutDashboard,
  Settings,
  Users,
  Wallet,
  CalendarDays,
  PartyPopper,
  Clock,
  Landmark,
  PiggyBank,
  Gift,
  TrendingUp,
  ArrowLeftRight,
  UsersRound,
  UserRound,
  HandCoins,
  ClipboardList,
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

const modules = [
  { to: '/employee', label: 'Employee', icon: Users },
  { to: '/daily-kpi-log', label: 'Daily KPI Log', icon: ClipboardList },
  { to: '/attendance-log', label: 'Attendance Logs', icon: Fingerprint },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const entitlements = [
  { to: '/entitlements', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/entitlements/payroll', label: 'Salary & Payroll', icon: Wallet },
  { to: '/entitlements/leave', label: 'Leave Management', icon: CalendarDays },
  { to: '/entitlements/holiday-pay', label: 'Holiday Pay', icon: PartyPopper },
  { to: '/entitlements/overtime', label: 'Overtime', icon: Clock },
  { to: '/entitlements/epf', label: 'EPF', icon: Landmark },
  { to: '/entitlements/etf', label: 'ETF', icon: PiggyBank },
  { to: '/entitlements/gratuity', label: 'Gratuity', icon: Gift },
  { to: '/entitlements/promotions', label: 'Promotions', icon: TrendingUp },
  { to: '/entitlements/transfers', label: 'Transfers', icon: ArrowLeftRight },
  { to: '/entitlements/family-benefits', label: 'Maternity / Family Benefits', icon: UsersRound },
  { to: '/entitlements/retirement', label: 'Retirement', icon: UserRound },
  { to: '/entitlements/loans', label: 'Loans / Advances', icon: HandCoins },
]

function isActivePath(pathname, to, end) {
  if (end) return pathname === to
  return pathname === to || pathname.startsWith(`${to}/`)
}

function NavItems({ items }) {
  const { pathname } = useLocation()
  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.to}>
          <SidebarMenuButton
            render={<NavLink to={item.to} end={item.end} />}
            isActive={isActivePath(pathname, item.to, item.end)}
            tooltip={item.label}
          >
            <item.icon />
            <span>{item.label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

export default function DeskLayout() {
  const { pathname } = useLocation()

  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" className="pointer-events-none">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-semibold">
                    SL
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Postal KPI</span>
                    <span className="truncate text-xs text-muted-foreground">Desk</span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Modules</SidebarGroupLabel>
              <SidebarGroupContent>
                <NavItems items={modules} />
              </SidebarGroupContent>
            </SidebarGroup>
            <Collapsible
              defaultOpen={pathname.startsWith('/entitlements')}
              className="group/collapsible"
            >
              <SidebarGroup>
                <SidebarGroupLabel
                  render={<CollapsibleTrigger />}
                  className="cursor-pointer"
                >
                  <Building2 />
                  Employee Entitlements
                  <ChevronDown className="ml-auto transition-transform group-data-open/collapsible:rotate-180" />
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <NavItems items={entitlements} />
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          </SidebarContent>
          <SidebarFooter>
            <p className="px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
              MongoDB connected
            </p>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>
        <SidebarInset>
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
            <SidebarTrigger />
          </header>
          <div className="flex-1 p-4 md:p-6">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
