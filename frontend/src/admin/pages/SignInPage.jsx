import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  Lock,
  ShieldCheck,
  TrendingUp,
  User,
  Users,
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
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F3F6FB] font-sans antialiased selection:bg-[#1677D2] selection:text-white">
      {/* LEFT PANEL: POSTAL BRANDING (50–55% width on desktop) */}
      <section className="w-full lg:w-[52%] xl:w-[50%] bg-[#0B1F3A] text-white flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-16 relative overflow-hidden shrink-0">
        {/* Subtle decorative geometric & radial accents */}
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage: `radial-gradient(circle at 15% 15%, rgba(22, 119, 210, 0.35) 0%, transparent 45%), radial-gradient(circle at 85% 85%, rgba(229, 57, 53, 0.15) 0%, transparent 40%)`,
          }}
          aria-hidden="true"
        />
        <div
          className="absolute -right-24 -bottom-24 w-96 h-96 rounded-full border border-white/5 pointer-events-none"
          aria-hidden="true"
        />

        {/* Top Branding & Official Emblem */}
        <div className="relative z-10">
          <div className="flex items-center gap-3.5">
            {/* Custom SL Postal Emblem */}
            <div className="flex items-center justify-center size-12 rounded-xl bg-gradient-to-br from-[#E53935] to-[#B71C1C] shadow-lg shadow-red-950/40 border border-red-400/30 text-white font-extrabold text-lg tracking-wider shrink-0 select-none">
              SL
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold tracking-widest uppercase text-red-400">
                  Department of Posts
                </span>
                <span className="inline-block size-1 rounded-full bg-slate-500" />
                <span className="text-[11px] font-medium text-slate-300">
                  Sri Lanka
                </span>
              </div>
              <h2 className="text-base font-semibold tracking-tight text-white leading-tight">
                Post-Assist LK Terminal
              </h2>
            </div>
          </div>

          {/* Main Hero & Welcome */}
          <div className="mt-8 lg:mt-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-blue-200 border border-white/15 backdrop-blur-sm">
              <span className="size-1.5 rounded-full bg-[#1677D2] animate-pulse" />
              Administrative Operations Terminal
            </div>
            <h1 className="mt-4 text-3xl sm:text-4xl xl:text-[42px] font-extrabold tracking-tight text-white leading-[1.15]">
              SL Postal <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-[#64B5F6]">KPI Desk</span>
            </h1>
            <p className="mt-2 text-base font-medium text-[#90CAF9]">
              Postal Workforce Performance & Analytics
            </p>
            <p className="mt-3 text-sm text-slate-300 max-w-lg leading-relaxed">
              Centralized operational terminal for authorized postal supervisors and postmasters. Monitor delivery throughput, audit weekly KPIs, and manage workforce capacity across divisional networks.
            </p>
          </div>

          {/* Subtle Postal Network Topology Graphic */}
          <div className="mt-8 hidden sm:block p-4 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 font-medium text-slate-300">
                <span className="size-2 rounded-full bg-emerald-400" />
                Divisional Route Mesh
              </span>
              <span className="text-[11px] text-slate-400">Live Network Node Status</span>
            </div>
            <svg
              className="w-full h-24 text-slate-400 overflow-visible"
              viewBox="0 0 460 90"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              {/* Connection Lines */}
              <path
                d="M 50 45 L 180 25 L 310 65 L 410 40"
                stroke="rgba(22, 119, 210, 0.45)"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <path
                d="M 180 25 L 310 30"
                stroke="rgba(229, 57, 53, 0.35)"
                strokeWidth="1.5"
              />
              <path
                d="M 50 45 L 310 65"
                stroke="rgba(255, 255, 255, 0.12)"
                strokeWidth="1"
              />

              {/* Node 1: Central Sorting */}
              <circle cx="50" cy="45" r="7" fill="#0B1F3A" stroke="#1677D2" strokeWidth="3" />
              <circle cx="50" cy="45" r="3" fill="#64B5F6" />
              <text x="50" y="66" textAnchor="middle" fill="#CBD5E1" fontSize="10" fontFamily="sans-serif">Colombo GPO</text>

              {/* Node 2: Kaduwela */}
              <circle cx="180" cy="25" r="8" fill="#0B1F3A" stroke="#E53935" strokeWidth="3" />
              <circle cx="180" cy="25" r="3.5" fill="#EF5350" />
              <text x="180" y="46" textAnchor="middle" fill="#FFFFFF" fontWeight="600" fontSize="10" fontFamily="sans-serif">Kaduwela Hub</text>

              {/* Node 3: Battaramulla */}
              <circle cx="310" cy="65" r="6" fill="#0B1F3A" stroke="#1677D2" strokeWidth="2.5" />
              <circle cx="310" cy="65" r="2.5" fill="#64B5F6" />
              <text x="310" y="84" textAnchor="middle" fill="#CBD5E1" fontSize="10" fontFamily="sans-serif">Battaramulla</text>

              {/* Node 4: Regional Distribution */}
              <circle cx="410" cy="40" r="6" fill="#0B1F3A" stroke="#1677D2" strokeWidth="2.5" />
              <circle cx="410" cy="40" r="2.5" fill="#64B5F6" />
              <text x="410" y="59" textAnchor="middle" fill="#CBD5E1" fontSize="10" fontFamily="sans-serif">Regional Dist.</text>
            </svg>
          </div>

          {/* 4 Feature Highlights */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/5 hover:border-white/15 transition-colors">
              <div className="p-2 rounded-lg bg-blue-500/15 text-blue-300 shrink-0">
                <BarChart3 className="size-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white">Performance Monitoring</h3>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-tight">Daily completion, accuracy & timeliness tracking.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/5 hover:border-white/15 transition-colors">
              <div className="p-2 rounded-lg bg-red-500/15 text-red-300 shrink-0">
                <TrendingUp className="size-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white">KPI Forecasting</h3>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-tight">Predictive modeling with holdout-verified ML models.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/5 hover:border-white/15 transition-colors">
              <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-300 shrink-0">
                <CalendarCheck className="size-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white">Leave & Attendance</h3>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-tight">Time-bound door tokens & verified attendance logs.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/5 hover:border-white/15 transition-colors">
              <div className="p-2 rounded-lg bg-purple-500/15 text-purple-300 shrink-0">
                <Users className="size-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white">Workforce Planning</h3>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-tight">Route balancing and operational staff allocations.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Left Panel Footer */}
        <div className="relative z-10 mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2 text-slate-300">
            <ShieldCheck className="size-4 text-emerald-400 shrink-0" />
            <span>Authorized Personnel Access Only • SL Post</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Protected Government System
          </span>
        </div>
      </section>

      {/* RIGHT PANEL: SIGN-IN CARD (Spacious & Clean) */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12 xl:p-16">
        <div className="w-full max-w-[460px]">
          {/* Card Container */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_12px_40px_rgba(11,31,58,0.06),0_2px_8px_rgba(11,31,58,0.04)] p-6 sm:p-10 relative overflow-hidden">
            {/* Top postal red accent stripe */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#1677D2] via-[#E53935] to-[#0B1F3A]" />

            {/* Header / Caption */}
            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#1677D2] border border-blue-100">
                <Lock className="size-3.5" />
                Authorized Staff Access
              </div>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#0B1F3A]">
                Welcome back
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-700">
                Sign in to SL Postal KPI Desk
              </p>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                Enter your authorized Postmaster ID and account password to open the operational workspace.
              </p>
            </div>

            {/* Currently Signed In Alert (if session already active) */}
            {user ? (
              <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200 text-slate-800 text-xs">
                <div className="flex items-center gap-2 font-semibold text-[#0B1F3A]">
                  <CheckCircle2 className="size-4 text-[#1677D2]" />
                  Active Session Detected
                </div>
                <p className="mt-1 text-slate-600">
                  Signed in as <strong className="font-semibold text-slate-900">{user.username}</strong> ({user.role || 'User'}).
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGoToDashboard}
                    className="px-3 py-1.5 rounded-lg bg-[#0B1F3A] hover:bg-[#12315c] text-white text-xs font-medium transition-colors"
                  >
                    Enter Desk →
                  </button>
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            ) : null}

            {/* Error Message */}
            {error ? (
              <div
                role="alert"
                className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2.5 shadow-sm"
              >
                <AlertCircle className="size-4 text-[#E53935] shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{error}</div>
              </div>
            ) : null}

            {/* Policy Help Message */}
            {help ? (
              <div
                role="status"
                className="mb-5 p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5 shadow-sm"
              >
                <Info className="size-4 text-[#1677D2] shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">{help}</div>
              </div>
            ) : null}

            {/* Sign-In Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username / Postmaster ID */}
              <div>
                <label
                  htmlFor="postmaster-id"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
                >
                  Postmaster ID
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="e.g. postmaster"
                    className="h-11 w-full pl-10 pr-3.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1677D2] focus:ring-2 focus:ring-[#1677D2]/20 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={requestHelp}
                    disabled={helping || submitting}
                    className="text-xs font-medium text-[#1677D2] hover:text-[#0B1F3A] hover:underline transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#1677D2]"
                  >
                    {helping ? 'Checking policy…' : 'Need password help?'}
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter account password"
                    className="h-11 w-full pl-10 pr-10 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1677D2] focus:ring-2 focus:ring-[#1677D2]/20 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500"
                  />
                  <button
                    type="button"
                    tabIndex={0}
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
                className="mt-6 h-11 w-full rounded-xl bg-[#0B1F3A] hover:bg-[#12315c] active:bg-[#08172b] text-white text-sm font-semibold tracking-wide shadow-md shadow-slate-900/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677D2] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 size-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Authenticating Credentials…</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Terminal</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>
            </form>

            {/* Security Notice */}
            <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-500 text-center">
              <ShieldCheck className="size-3.5 text-slate-400" />
              <span>Encrypted connection with scrypt server-side credential verification</span>
            </div>
          </div>

          {/* Restrained Application Footer */}
          <footer className="mt-6 text-center text-xs text-slate-500">
            <p className="font-medium text-slate-600">
              SL Postal KPI Desk • Version 1.0.0
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Sessions expire after 8 hours of inactivity. Sri Lanka Postal Department.
            </p>
          </footer>
        </div>
      </main>
    </div>
  )
}
