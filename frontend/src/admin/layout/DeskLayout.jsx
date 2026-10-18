import { useEffect, useRef, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, LogOut, Mail, Settings as SettingsIcon } from 'lucide-react'
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
  useSidebar,
} from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '../data/auth'
import SidebarNavItem from '../ui/SidebarNavItem'
import Topbar from '../ui/Topbar'
import { adminNav, analyticsNav, visibleItems, workspaceNav } from '../ui/navigation'

// ── Section group ─────────────────────────────────────────────────────────

function NavGroup({ label, items, showDivider = false }) {
  if (!items.length) return null
  return (
    <>
      {showDivider && (
        <div className="hidden group-data-[collapsible=icon]:block mx-3 my-2 border-t border-[rgba(255,255,255,0.10)]" />
      )}
      <SidebarGroup className="px-2 pt-3.5 pb-0">
        <SidebarGroupLabel className="px-1.5 !text-[10px] font-semibold tracking-wider uppercase !text-[#A9BDD3]/75">
          {label}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu className="gap-0.5">
            {items.map((item) => (
              <SidebarNavItem key={item.to} item={item} />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  )
}

// ── Bottom profile + logout dropdown ─────────────────────────────────────

function SidebarProfile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { isMobile, setOpenMobile, state } = useSidebar()
  const isCollapsed = state === 'collapsed' && !isMobile
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const initials = (user?.username || 'AU').slice(0, 2).toUpperCase()
  const displayName = user?.name || user?.username || 'Authenticated User'
  const rawRole = (user?.designation || user?.role) ?? ''
  const displayRole = rawRole
    ? rawRole === 'postmaster'
      ? 'Postmaster'
      : rawRole.charAt(0).toUpperCase() + rawRole.slice(1).replace(/-/g, ' ')
    : 'Assigned Role'

  // Close dropdown on outside click / Escape
  useEffect(() => {
    function onPointer(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const profileButton = (
    <SidebarMenuButton
      size="lg"
      className="w-full hover:bg-white/8 transition-colors select-none group-data-[collapsible=icon]:justify-center"
      onClick={() => setOpen((v) => !v)}
    >
      {/* Circular avatar */}
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#1677D2] text-[11px] font-bold text-white shadow-xs select-none">
        {initials}
      </span>

      {/* Name + role — hidden in collapsed mode via overflow */}
      <div className="flex min-w-0 flex-1 flex-col text-left">
        <span className="truncate text-[13px] font-semibold text-white leading-tight">
          {displayName}
        </span>
        <span className="truncate text-[11px] text-[#A9BDD3] leading-tight capitalize">
          {displayRole}
        </span>
      </div>

      {/* Dropdown chevron — also hidden in collapsed mode via overflow */}
      <ChevronDown
        className={`size-3.5 shrink-0 text-[#A9BDD3] transition-transform duration-150 ${
          open ? 'rotate-180' : ''
        }`}
      />
    </SidebarMenuButton>
  )

  return (
    <div ref={rootRef} className="relative w-full">
      {/* Account popover — appears above the profile button */}
      {open && (
        <div
          className={
            isCollapsed
              ? 'absolute bottom-2 left-[calc(100%+8px)] w-52 overflow-hidden rounded-xl border border-white/10 bg-[#092943] shadow-2xl z-50 p-1'
              : 'absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl border border-white/10 bg-[#092943] shadow-2xl z-50 p-1'
          }
        >
          <div className="border-b border-white/10 px-3 py-2">
            <p className="truncate text-[13px] font-semibold text-white">{displayName}</p>
            <p className="truncate text-[11px] text-[#A9BDD3] capitalize">{displayRole}</p>
          </div>
          <div className="pt-1">
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-[#A9BDD3] transition-colors hover:bg-white/10 hover:text-white"
              onClick={() => {
                setOpen(false)
                if (isMobile) setOpenMobile(false)
                navigate('/settings')
              }}
            >
              <SettingsIcon className="size-3.5 shrink-0" />
              Settings
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-[#A9BDD3] transition-colors hover:bg-white/10 hover:text-white"
              onClick={() => {
                setOpen(false)
                if (isMobile) setOpenMobile(false)
                logout().then(() => navigate('/sign-in'))
              }}
            >
              <LogOut className="size-3.5 shrink-0" />
              Sign out
            </button>
          </div>
        </div>
      )}

      {isCollapsed ? (
        <Tooltip>
          <TooltipTrigger render={profileButton} />
          <TooltipContent
            side="right"
            align="center"
            className="border border-white/10 bg-[#092943] px-2.5 py-1 text-xs text-white shadow-lg"
          >
            {displayName} · {displayRole}
          </TooltipContent>
        </Tooltip>
      ) : (
        profileButton
      )}
    </div>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────

export default function DeskLayout() {
  const { pathname } = useLocation()
  const { user, ready } = useAuth()
  const role = user?.role

  // Auth loading spinner
  if (!ready) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F3F6FB] gap-3">
        <div className="size-8 border-4 border-slate-200 border-t-[#0B1F3A] rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-600">Verifying authorized session…</p>
      </div>
    )
  }

  // Redirect unauthenticated users
  if (!user) {
    return <Navigate to="/sign-in" replace state={{ from: pathname }} />
  }

  return (
    <TooltipProvider>
      <SidebarProvider
        className="desk-shell"
        style={{
          '--sidebar-width': '250px',
          '--sidebar-width-icon': '54px',
        }}
      >
        {/* ── LEFT SIDEBAR ─────────────────────────────────────────────── */}
        <Sidebar collapsible="icon" className="border-r border-[rgba(255,255,255,0.10)] bg-[#0B1F3A]">

          {/* Header / Branding */}
          <SidebarHeader className="border-b border-[rgba(255,255,255,0.10)] px-0 py-0">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="lg"
                  className="pointer-events-none select-none hover:bg-transparent active:bg-transparent data-active:bg-transparent"
                >
                  {/* Logo mark — blue rounded square with Mail icon */}
                  <div className="flex shrink-0 size-8.5 items-center justify-center rounded-lg bg-[#1677D2] shadow-xs">
                    <Mail className="size-4.5 text-white" />
                  </div>

                  {/* App name + subtitle */}
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-[13px] font-bold text-white leading-tight">
                      SL Postal KPI Desk
                    </span>
                    <span className="truncate text-[10px] text-[#A9BDD3] leading-snug">
                      Workforce Performance System
                    </span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          {/* Navigation content */}
          <SidebarContent className="pb-3">
            {/* WORKSPACE */}
            <NavGroup
              label="WORKSPACE"
              items={visibleItems(workspaceNav, role)}
              showDivider={false}
            />

            {/* PLANNING & ANALYTICS */}
            <NavGroup
              label="PLANNING & ANALYTICS"
              items={visibleItems(analyticsNav, role)}
              showDivider={true}
            />

            {/* ADMINISTRATION */}
            <NavGroup
              label="ADMINISTRATION"
              items={visibleItems(adminNav, role)}
              showDivider={true}
            />
          </SidebarContent>

          {/* Footer — authenticated user profile */}
          <SidebarFooter className="border-t border-[rgba(255,255,255,0.10)] bg-[#092943] p-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarProfile />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>

          {/* Drag-to-toggle rail */}
          <SidebarRail />
        </Sidebar>

        {/* ── MAIN CONTENT AREA ────────────────────────────────────────── */}
        <SidebarInset className="bg-[#f3f6fb]">
          <Topbar />
          <div className="flex-1 p-4 md:p-6">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
