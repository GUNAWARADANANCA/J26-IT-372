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
    <div className="grid min-h-full place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-700 text-white shadow-sm"><Icon name="mail" className="h-6 w-6" /></span>
          <h1 className="mt-3 text-2xl font-bold text-brand-800">PostAssist LK</h1>
          <p className="text-sm text-slate-600">Smart Registered Mail Intake &amp; Tracking</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-line bg-white p-6 shadow-[0_8px_24px_rgba(22,38,58,0.08)]">
          <ErrorBox error={error} />
          <Field label="Username">
            <input className={inputClass} autoComplete="username" value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })} required />
          </Field>
          <Field label="Password">
            <input className={inputClass} type="password" autoComplete="current-password" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </Field>
          <Button type="submit" busy={busy} className="w-full">Sign in</Button>
        </form>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600">
          <Icon name="shield" className="h-3.5 w-3.5" /> Authorised postal staff only
        </p>
        <p className="mt-1 text-center text-xs text-slate-500">
          Research prototype. Use synthetic mail only unless operational and ethics approval has been obtained.
        </p>
      </div>
    </div>
  )
}
