import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from 'lucide-react'
import { useAuth } from '../data/auth'

const API = import.meta.env.VITE_API_URL ?? ''

export default function SignInPage() {
  const { login, logout, user, ready } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/employee'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [help, setHelp] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [helping, setHelping] = useState(false)

  // Redirect to Employee Overview (or return URL) if already authenticated
  useEffect(() => {
    if (ready && user) {
      navigate(from, { replace: true })
    }
  }, [ready, user, navigate, from])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setHelp('')
    if (!username.trim() || !password) {
      setError('Enter your authorized postmaster ID and password.')
      return
    }
    setSubmitting(true)
    try {
      const session = await login(username.trim(), password)
      if (session.role) {
        navigate(from, { replace: true })
      } else {
        setError('This account does not have a role authorized to open the desk.')
      }
    } catch (err) {
      setError(err.message || 'Sign-in failed. Please verify your credentials.')
    } finally {
      setSubmitting(false)
    }
  }

  async function requestHelp() {
    setHelping(true)
    setError('')
    try {
      const response = await fetch(`${API}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.detail || 'Could not request password help.')
      }
      setHelp(payload.detail || 'Ask the system administrator to set a new password.')
    } catch (err) {
      setError(err.message || 'Could not request password help.')
    } finally {
      setHelping(false)
    }
  }

  function handleGoToDashboard() {
    navigate('/employee')
  }

  if (!ready) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F3F6FB] gap-3">
        <div className="size-8 border-4 border-slate-200 border-t-[#0B1F3A] rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-600">Verifying authorized session…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#F3F6FB] text-[#0B1F3A] font-sans antialiased">
      {/* Official Top Bar */}
      <header className="h-13 w-full border-b border-slate-200 bg-white/95 px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-[#C62828] text-white shadow-xs">
            <Mail className="size-4" />
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-bold text-[#0B1F3A]">Department of Posts</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-500">Sri Lanka</span>
          </div>
        </div>
        <div className="text-[11px] font-medium text-slate-500 hidden sm:block">
          Postmaster & Supervisor Portal
        </div>
      </header>

      {/* Main Authentication Area (Simple & Centered) */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-[420px]">
          {/* Main Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm">
            {/* Header / Branding */}
            <div className="text-center mb-6">
              <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-[#1677D2] text-white shadow-sm mb-3">
                <Mail className="size-6" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-[#0B1F3A]">
                SL Postal KPI Desk
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                Sign in to your Postmaster or Supervisor account
              </p>
            </div>

            {/* Active Session Notification (if already logged in) */}
            {user ? (
              <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs">
                <div className="flex items-center gap-2 font-semibold text-[#0B1F3A]">
                  <CheckCircle2 className="size-4 text-[#1677D2]" />
                  Active Session Detected
                </div>
                <p className="mt-1 text-slate-600">
                  Signed in as <strong className="font-semibold text-slate-900">{user.username}</strong> ({user.role || 'Staff'}).
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGoToDashboard}
                    className="h-8 rounded-lg bg-[#1677D2] px-3 text-xs font-semibold text-white hover:bg-[#125ea7] transition-colors"
                  >
                    Enter Workspace →
                  </button>
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            ) : null}

            {/* Error Banner */}
            {error ? (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
              >
                <AlertCircle className="size-4 text-[#E53935] shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{error}</div>
              </div>
            ) : null}

            {/* Help / Information Banner */}
            {help ? (
              <div
                role="status"
                className="mb-5 flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900"
              >
                <Info className="size-4 text-[#1677D2] shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">{help}</div>
              </div>
            ) : null}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Postmaster ID */}
              <div>
                <label
                  htmlFor="postmaster-id"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Postmaster ID or Username
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <User className="size-4" />
                  </div>
                  <input
                    id="postmaster-id"
                    name="username"
                    type="text"
                    required
                    autoFocus
                    autoComplete="username"
                    disabled={submitting}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. postmaster"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1677D2] focus:ring-2 focus:ring-[#1677D2]/20 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={requestHelp}
                    disabled={helping || submitting}
                    className="text-xs font-medium text-[#1677D2] hover:underline transition-colors focus-visible:outline-none"
                  >
                    {helping ? 'Checking…' : 'Need password help?'}
                  </button>
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Lock className="size-4" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    disabled={submitting}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter account password"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1677D2] focus:ring-2 focus:ring-[#1677D2]/20 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus-visible:outline-none"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || !username.trim() || !password}
                className="mt-2 h-10 w-full rounded-lg bg-[#1677D2] hover:bg-[#125ea7] text-white text-xs font-semibold shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677D2] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 size-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Signing in…</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="size-3.5" />
                  </>
                )}
              </button>
            </form>

            {/* Security Notice */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
              <ShieldCheck className="size-3.5 text-emerald-600 shrink-0" />
              <span>Official Postal Department System • Authorized Access Only</span>
            </div>
          </div>

          {/* Simple Clean Footer */}
          <footer className="mt-5 text-center text-[11px] text-slate-500 space-y-0.5">
            <p className="font-medium text-slate-600">
              Department of Posts — Sri Lanka
            </p>
            <p className="text-slate-400">
              Post-Assist LK • Version 1.0.0
            </p>
          </footer>
        </div>
      </main>
    </div>
  )
}
