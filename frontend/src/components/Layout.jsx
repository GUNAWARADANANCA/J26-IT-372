import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { can, roleLabel, useAuth } from '../auth.jsx'
import Icon from './icons.jsx'
import { fmtDate } from './ui.jsx'

const ALL = ['counter_officer', 'hub_officer', 'postman', 'postmaster']

// Grouped by the kind of work, so staff find daily tasks first and set-up pages last.
const GROUPS = [
  {
    label: 'Daily work',
    links: [
      { to: '/', label: 'Dashboard', icon: 'dashboard', roles: ALL },
      { to: '/counter', label: 'Counter intake', icon: 'intake', roles: ['counter_officer', 'postmaster'] },
      { to: '/items', label: 'Registered items', icon: 'search', roles: ALL },
      { to: '/scan', label: 'Record a scan', icon: 'scan', roles: ['counter_officer', 'hub_officer', 'postmaster'] },
    ],
  },
  {
    label: 'Supervision',
    links: [
      { to: '/review', label: 'Review queue', icon: 'review', roles: ['postmaster'] },
      { to: '/notifications', label: 'Sender messages', icon: 'bell', roles: ['postmaster', 'counter_officer'] },
      { to: '/audit', label: 'Audit log', icon: 'history', roles: ['postmaster'] },
    ],
  },
  {
    label: 'Set-up',
    links: [
      { to: '/devices', label: 'Scale & camera', icon: 'scale', roles: ['counter_officer', 'postmaster'] },
      { to: '/offices', label: 'Offices & zones', icon: 'pin', roles: ['postmaster'] },
      { to: '/reports', label: 'Reports & settings', icon: 'report', roles: ['postmaster'] },
    ],
  },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // Both pop-ups remember the page they were opened on, so they close by themselves on navigation.
  const [menuAt, setMenuAt] = useState(null)        // sidebar drawer on small screens
  const [accountAt, setAccountAt] = useState(null)
  const [query, setQuery] = useState('')
  const menu = menuAt === pathname
  const account = accountAt === pathname
  const setMenu = (open) => setMenuAt(open ? pathname : null)
  const office = user.office_name || user.office_id

  const search = (e) => {
    e.preventDefault()
    if (query.trim()) navigate(`/items?q=${encodeURIComponent(query.trim())}`)
  }

  return (
    <div className="flex min-h-full">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-white focus:p-2">
        Skip to content
      </a>
      {menu && <button aria-label="Close menu" className="no-print fixed inset-0 z-30 bg-brand-900/50 lg:hidden" onClick={() => setMenu(false)} />}
      <aside className={`no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-brand-900 text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${menu ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-white text-brand-800 ring-2 ring-amber-400/80"><Icon name="mail" className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="text-base font-bold leading-tight">PostAssist LK</p>
            <p className="text-[11px] leading-tight text-brand-200">Registered Mail Intake &amp; Tracking</p>
          </div>
          <button className="ml-auto rounded-md p-1.5 text-brand-200 hover:bg-white/10 lg:hidden" aria-label="Close menu" onClick={() => setMenu(false)}>
            <Icon name="close" />
          </button>
        </div>
        <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {GROUPS.map((g) => {
            const links = g.links.filter((l) => can(user, ...l.roles))
            if (links.length === 0) return null
            return (
              <div key={g.label}>
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-300">{g.label}</p>
                <ul className="space-y-0.5 text-sm">
                  {links.map((l) => (
                    <li key={l.to}>
                      <NavLink
                        to={l.to}
                        end={l.to === '/'}
                        className={({ isActive }) => `flex items-center gap-3 rounded-md border-l-[3px] px-3 py-2 ${isActive ? 'border-amber-400 bg-white/12 font-semibold text-white' : 'border-transparent text-brand-100 hover:bg-white/8 hover:text-white'}`}
                      >
                        <Icon name={l.icon} />
                        {l.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </nav>
        <div className="border-t border-white/10 px-5 py-3 text-xs">
          <p className="truncate font-semibold text-white">{user.full_name}</p>
          <p className="truncate text-brand-200">{roleLabel(user.role)} · {office}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Notice strip: who the system is for and that this build is a research prototype. */}
        <div className="no-print flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 bg-brand-950 px-4 py-1.5 text-[11px] text-brand-100 lg:px-8">
          <span className="flex items-center gap-1.5 font-semibold"><Icon name="shield" className="h-3.5 w-3.5 text-amber-300" /> Official use – authorised postal staff only</span>
          <span className="text-brand-200">Research prototype · use synthetic mail unless approved</span>
        </div>
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-white px-4 py-2.5 shadow-[0_1px_0_rgba(22,38,58,0.04)] lg:px-8">
          <button className="rounded-md p-2 text-brand-800 hover:bg-brand-50 lg:hidden" aria-label="Open menu" onClick={() => setMenu(true)}>
            <Icon name="menu" className="h-5 w-5" />
          </button>
          <form onSubmit={search} role="search" className="relative w-full max-w-md">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="search" /></span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find an item by tracking ID"
              placeholder="Find an item – scan or type tracking ID"
              className="w-full rounded-md border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-sm placeholder:text-slate-500 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
          </form>
          <div className="ml-auto flex items-center gap-4">
            <div className="hidden text-right text-xs leading-tight xl:block">
              <p className="flex items-center justify-end gap-1.5 font-semibold text-brand-900"><Icon name="building" className="h-3.5 w-3.5" />{office}</p>
              <p className="mt-0.5 text-slate-500">{fmtDate()}</p>
            </div>
            <div className="relative">
              <button className="flex items-center gap-2 rounded-md border border-line py-1 pl-1 pr-2.5 text-left hover:bg-brand-50" aria-haspopup="menu"
                aria-expanded={account} aria-label={`Account: ${user.full_name}`} onClick={() => setAccountAt(account ? null : pathname)}>
                <span className="grid h-8 w-8 place-items-center rounded bg-brand-700 text-white"><Icon name="user" /></span>
                <span className="hidden text-xs leading-tight md:block">
                  <span className="block max-w-40 truncate font-semibold text-brand-900">{user.full_name}</span>
                  <span className="block text-slate-500">{roleLabel(user.role)}</span>
                </span>
              </button>
              {account && (
                <div role="menu" className="absolute right-0 mt-2 w-64 rounded-lg border border-line bg-white p-3 text-sm shadow-lg">
                  <p className="font-semibold text-brand-900">{user.full_name}</p>
                  <p className="text-xs text-slate-600">{roleLabel(user.role)} · {office}</p>
                  <p className="text-xs text-slate-500">Signed in as {user.username}</p>
                  <button role="menuitem" onClick={logout}
                    className="mt-3 flex w-full items-center gap-2 rounded-md border border-brand-300 px-3 py-2 font-semibold text-brand-800 hover:bg-brand-50">
                    <Icon name="logout" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main id="main" className="flex-1 px-4 py-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
        <footer className="no-print border-t border-line bg-white px-4 py-3 text-[11px] text-slate-500 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-2">
            <span>PostAssist LK · Smart Registered Mail Intake &amp; Tracking</span>
            <span>Sign-ins and changes to records are logged for audit.</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
