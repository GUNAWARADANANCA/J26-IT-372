import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../data/auth'

export default function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const initials = (user?.username || 'P').slice(0, 2).toUpperCase()

  useEffect(() => {
    function onPointer(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  if (!user) {
    return (
      <button type="button" className="text-sm underline" onClick={() => navigate('/sign-in')}>
        Sign in
      </button>
    )
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="flex items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="grid size-8 place-items-center rounded-full bg-[#12315c] text-xs font-semibold text-white">
          {initials}
        </span>
        <span className="hidden leading-tight sm:block">
          <span className="block text-sm font-medium text-slate-900">{user.username}</span>
          <span className="block text-xs text-slate-500">{user.role}</span>
        </span>
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-md">
          <button
            type="button"
            role="menuitem"
            className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
            onClick={() => {
              setOpen(false)
              logout().then(() => navigate('/sign-in'))
            }}
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  )
}
