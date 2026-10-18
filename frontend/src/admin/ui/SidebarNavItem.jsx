import { NavLink, useLocation } from 'react-router-dom'
import { SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

function isActivePath(pathname, to) {
  if (to === '/employee') {
    return pathname === '/' || pathname === '/employee' || pathname.startsWith('/employee/')
  }
  if (to === '/kpi-forecasts') {
    return pathname === '/kpi-forecasts' || pathname.startsWith('/kpi-forecasts/') || pathname === '/forecast-monitoring' || pathname.startsWith('/forecast-monitoring/')
  }
  if (to === '/attendance-log') {
    return pathname === '/attendance-log' || pathname.startsWith('/attendance-log/') || pathname.startsWith('/attendance-qr')
  }
  if (to === '/entitlements') {
    return pathname === '/entitlements' || pathname.startsWith('/entitlements/')
  }
  return pathname === to || pathname.startsWith(`${to}/`)
}

export default function SidebarNavItem({ item }) {
  const { pathname } = useLocation()
  const { isMobile, setOpenMobile, state } = useSidebar()
  const isCollapsed = state === 'collapsed' && !isMobile
  const active = isActivePath(pathname, item.to)

  function handleClick() {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const buttonElement = (
    <SidebarMenuButton
      render={<NavLink to={item.to} end={item.end} onClick={handleClick} />}
      isActive={active}
      className={
        active
          ? '!bg-[#1677D2] font-semibold !text-white [&_svg]:!text-white hover:!bg-[#1677D2]'
          : 'text-[#A9BDD3] [&_svg]:text-[#A9BDD3] hover:!bg-[rgba(22,119,210,0.18)] hover:!text-white hover:[&_svg]:!text-white'
      }
    >
      <item.icon className="size-4 shrink-0 transition-colors" />
      <span>{item.label}</span>
    </SidebarMenuButton>
  )

  return (
    <SidebarMenuItem className="relative w-full">
      {/* Active red indicator accent pill (#E53935) */}
      {active && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 w-[3.5px] h-[22px] rounded-r-full bg-[#E53935] z-20"
        />
      )}
      {isCollapsed ? (
        <Tooltip>
          <TooltipTrigger render={buttonElement} />
          <TooltipContent
            side="right"
            align="center"
            className="border border-white/10 bg-[#0B1F3A] px-2.5 py-1 text-xs text-white shadow-lg"
          >
            {item.label}
          </TooltipContent>
        </Tooltip>
      ) : (
        buttonElement
      )}
    </SidebarMenuItem>
  )
}
