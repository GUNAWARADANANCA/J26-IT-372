import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { can, useAuth } from '../auth.jsx'
import Icon from './icons.jsx'

const LINKS = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', roles: ['counter_officer', 'hub_officer', 'postman', 'postmaster'] },
  { to: '/counter', label: 'Counter intake', icon: 'intake', roles: ['counter_officer', 'postmaster'] },
  { to: '/items', label: 'Items', icon: 'search', roles: ['counter_officer', 'hub_officer', 'postman', 'postmaster'] },
  { to: '/scan', label: 'Record scan', icon: 'scan', roles: ['counter_officer', 'hub_officer', 'postmaster'] },
  { to: '/review', label: 'Review queue', icon: 'review', roles: ['postmaster'] },
  { to: '/notifications', label: 'Messages', icon: 'bell', roles: ['postmaster', 'counter_officer'] },
  { to: '/devices', label: 'IoT scale', icon: 'scale', roles: ['counter_officer', 'postmaster'] },
  { to: '/offices', label: 'Offices & zones', icon: 'pin', roles: ['postmaster'] },
  { to: '/reports', label: 'Reports', icon: 'report', roles: ['postmaster'] },
  { to: '/audit', label: 'Audit', icon: 'history', roles: ['postmaster'] },
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
      <aside className={`no-print fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-brand-800 text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${menu ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-white text-brand-800"><Icon name="mail" className="h-4.5 w-4.5" /></span>
          <div>
            <p className="text-base font-bold leading-tight">PostAssist LK</p>
            <p className="text-[10px] uppercase tracking-wide text-brand-200">Registered mail</p>
          </div>
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1 text-sm">
            {LINKS.filter((l) => can(user, ...l.roles)).map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  end={l.to === '/'}
                  className={({ isActive }) => `flex items-center gap-3 rounded-md border-l-[3px] px-3 py-2 ${isActive ? 'border-white bg-brand-600 font-semibold text-white' : 'border-transparent text-brand-100 hover:bg-white/10 hover:text-white'}`}
                >
                  <Icon name={l.icon} />
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-white/95 px-4 py-2.5 backdrop-blur lg:px-8">
          <button className="rounded-md p-2 text-brand-800 hover:bg-brand-50 lg:hidden" aria-label="Open menu" onClick={() => setMenu(true)}>
            <Icon name="menu" className="h-5 w-5" />
          </button>
          <form onSubmit={search} role="search" className="relative w-full max-w-sm">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="search" /></span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search items by tracking ID"
              placeholder="Search items by tracking ID…"
              className="w-full rounded-md border border-line bg-brand-50/60 py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
          </form>
          <div className="ml-auto flex items-center gap-3">
            <div className="relative">
              <button className="grid h-9 w-9 place-items-center rounded-md bg-brand-700 text-white hover:bg-brand-800" aria-haspopup="menu"
                aria-expanded={account} aria-label={`Account: ${user.full_name}`} onClick={() => setAccountAt(account ? null : pathname)}>
                <Icon name="user" />
              </button>
              {account && (
                <div role="menu" className="absolute right-0 mt-2 w-60 rounded-lg border border-line bg-white p-3 text-sm shadow-lg">
                  <p className="font-semibold text-brand-800">{user.full_name}</p>
                  <p className="text-xs text-slate-500">{user.role.replace('_', ' ')}</p>
                  <button role="menuitem" onClick={logout}
                    className="mt-3 flex w-full items-center gap-2 rounded-md border border-brand-200 px-3 py-2 font-semibold text-brand-700 hover:bg-brand-50">
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
      </div>
    </div>
  )
}
