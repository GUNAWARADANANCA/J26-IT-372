import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useAuth } from '../data/auth'
import { adminNav, analyticsNav, crumbsFor, entitlementNav, visibleItems, workspaceNav } from './navigation'
import Breadcrumbs from './Breadcrumbs'
import UserMenu from './UserMenu'

export default function Topbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const crumbs = crumbsFor(pathname)
  const pages = useMemo(
    () => visibleItems([...workspaceNav, ...analyticsNav, ...adminNav, ...entitlementNav], user?.role),
    [user?.role],
  )
  const matches = pages.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/95 px-3 backdrop-blur">
      <SidebarTrigger className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700" />
      <div className="min-w-0">
        <Breadcrumbs items={crumbs} />
        {crumbs.at(-1)?.hint ? <p className="truncate text-xs text-slate-500">{crumbs.at(-1).hint}</p> : null}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <div className="relative">
          <label className="sr-only" htmlFor="desk-search">Search pages</label>
          <Search className="pointer-events-none absolute top-2 left-2 size-4 text-slate-400" aria-hidden="true" />
          <input
            id="desk-search"
            value={query}
            placeholder="Search pages"
            className="h-8 w-36 rounded-lg border border-slate-200 bg-slate-50 pr-2 pl-8 text-sm focus:w-56 focus:border-blue-700 focus:outline-none sm:w-48"
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value)
              setOpen(true)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && matches[0]) {
                navigate(matches[0].to)
                setOpen(false)
                setQuery('')
              }
              if (event.key === 'Escape') setOpen(false)
            }}
          />
          {open && query.trim() ? (
            <ul className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-md" role="listbox">
              {matches.length === 0 ? <li className="px-3 py-2 text-sm text-slate-500">No matching page</li> : null}
              {matches.map((item) => (
                <li key={item.to}>
                  <button
                    type="button"
                    className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100"
                    onClick={() => {
                      navigate(item.to)
                      setOpen(false)
                      setQuery('')
                    }}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <UserMenu />
      </div>
    </header>
  )
}
