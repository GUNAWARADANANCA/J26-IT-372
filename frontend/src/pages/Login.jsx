import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import Icon from '../components/icons.jsx'
import { Button, ErrorBox, Field, inputClass } from '../components/ui.jsx'

export default function Login() {
  const { user, login } = useAuth()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  // Once signed in, counter officers start at the intake screen.
  if (user) return <Navigate to={user.role === 'counter_officer' ? '/counter' : '/'} replace />

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(form.username.trim(), form.password)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 bg-brand-950 px-4 py-1.5 text-[11px] text-brand-100 sm:px-8">
        <span className="flex items-center gap-1.5 font-semibold"><Icon name="shield" className="h-3.5 w-3.5 text-amber-300" /> Official use – authorised postal staff only</span>
        <span className="text-brand-200">Research prototype</span>
      </div>
      <header className="border-b-4 border-amber-400 bg-brand-900 px-4 py-4 text-white sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-white text-brand-800"><Icon name="mail" className="h-5 w-5" /></span>
          <div>
            <p className="text-lg font-bold leading-tight">PostAssist LK</p>
            <p className="text-xs text-brand-200">Smart Registered Mail Intake &amp; Tracking</p>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="grid w-full max-w-4xl items-start gap-8 md:grid-cols-2">
          <section className="order-2 md:order-1">
            <h1 className="text-2xl font-bold text-brand-900">Staff sign-in</h1>
            <p className="mt-2 text-sm text-slate-700">
              Use the account issued to you by your postmaster. After signing in you can:
            </p>
            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              {[
                ['intake', 'Register letters at the counter', 'Capture the envelope, check the address, weigh and print the label.'],
                ['scan', 'Record handover scans', 'Dispatch, in-transit and arrival scans for each item.'],
                ['search', 'Find any registered item', 'See its verified history and where it is now.'],
              ].map(([icon, title, text]) => (
                <li key={title} className="flex gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-700"><Icon name={icon} /></span>
                  <span><b className="block text-slate-900">{title}</b>{text}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="order-1 md:order-2">
            <form onSubmit={submit} className="space-y-4 rounded-lg border border-line bg-white p-6 shadow-[0_8px_24px_rgba(22,38,58,0.08)]">
              <div className="border-b border-line pb-3">
                <h2 className="text-base font-semibold text-brand-900">Sign in to continue</h2>
                <p className="text-xs text-slate-600">Both fields are required.</p>
              </div>
              <ErrorBox error={error} />
              <Field label="Username">
                <input className={inputClass} autoComplete="username" value={form.username} autoFocus
                  onChange={(e) => setForm({ ...form, username: e.target.value })} required />
              </Field>
              <Field label="Password">
                <input className={inputClass} type="password" autoComplete="current-password" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </Field>
              <Button type="submit" busy={busy} className="w-full">Sign in</Button>
              <p className="text-xs text-slate-500">Cannot sign in? Contact your postmaster or the system administrator.</p>
            </form>
          </section>
        </div>
      </main>

      <footer className="border-t border-line bg-white px-4 py-3 text-center text-[11px] text-slate-500">
        Research prototype. Use synthetic mail only unless operational and ethics approval has been obtained.
      </footer>
    </div>
  )
}
