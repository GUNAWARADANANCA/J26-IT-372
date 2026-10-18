// Small, accessible building blocks shared by every page.
import { Link } from 'react-router-dom'
import Icon from './icons.jsx'

const tones = {
  primary: 'bg-brand-700 text-white shadow-sm hover:bg-brand-800 disabled:bg-slate-300 disabled:shadow-none',
  secondary: 'bg-white text-brand-700 border border-brand-200 hover:bg-brand-50 disabled:text-slate-400 disabled:border-slate-200',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:bg-slate-300',
  ghost: 'text-brand-700 hover:bg-brand-50 disabled:text-slate-400',
}

export function Button({ tone = 'primary', className = '', busy = false, icon, children, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${tones[tone]} ${className}`}
      {...props}
      disabled={busy || props.disabled}
    >
      {busy ? <Spinner small /> : icon && <Icon name={icon} />}
      {children}
    </button>
  )
}

export function Card({ title, actions, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-line bg-white shadow-[0_1px_2px_rgba(22,38,58,0.05)] ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 rounded-t-xl border-b border-line bg-brand-50/70 px-5 py-3">
          {title && <h2 className="text-[15px] font-semibold text-brand-800">{title}</h2>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

const badgeTones = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/25',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/30',
  red: 'bg-red-50 text-red-700 ring-red-600/25',
  blue: 'bg-brand-100 text-brand-700 ring-brand-500/25',
  purple: 'bg-violet-50 text-violet-700 ring-violet-600/25',
  slate: 'bg-slate-100 text-slate-700 ring-slate-500/20',
}

export function Badge({ tone = 'slate', children, title }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${badgeTones[tone]}`}>
      {children}
    </span>
  )
}

const alertTones = {
  red: 'border-red-200 border-l-red-500 bg-red-50 text-red-900',
  amber: 'border-amber-200 border-l-amber-500 bg-amber-50 text-amber-900',
  green: 'border-emerald-200 border-l-emerald-500 bg-emerald-50 text-emerald-900',
  blue: 'border-brand-200 border-l-brand-500 bg-brand-50 text-brand-900',
}

export function Alert({ tone = 'red', title, children }) {
  return (
    <div role={tone === 'red' ? 'alert' : 'status'} className={`rounded-md border border-l-4 px-3 py-2 text-sm ${alertTones[tone]}`}>
      {title && <p className="font-semibold">{title}</p>}
      {children}
    </div>
  )
}

export function ErrorBox({ error }) {
  if (!error) return null
  return (
    <Alert tone="red" title={error.message || String(error)}>
      {error.problems?.length > 0 && (
        <ul className="mt-1 list-disc pl-5">
          {error.problems.map((p, i) => <li key={i}>{typeof p === 'string' ? p : p.message}</li>)}
        </ul>
      )}
    </Alert>
  )
}

export function Field({ label, hint, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-semibold text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50 disabled:text-slate-500'

export function Spinner({ small }) {
  return <span aria-hidden className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${small ? 'h-3 w-3' : 'h-5 w-5'}`} />
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-800">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

const tileAccent = { amber: 'border-l-4 border-l-amber-400', red: 'border-l-4 border-l-red-500', green: 'border-l-4 border-l-emerald-500' }

// Dashboard figure: label, number and what it means. An accent marks something that needs attention.
export function StatTile({ label, value, hint, accent, icon, to }) {
  const body = (
    <div className={`flex h-full items-start justify-between gap-3 rounded-xl border border-line bg-brand-50/60 p-4 ${tileAccent[accent] || ''} ${to ? 'transition hover:border-brand-300 hover:bg-brand-50' : ''}`}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className={`mt-1 text-3xl font-bold tabular-nums ${accent === 'red' ? 'text-red-600' : 'text-brand-900'}`}>{value}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
      {icon && <span className="rounded-md bg-white p-1.5 text-brand-700 shadow-sm"><Icon name={icon} /></span>}
    </div>
  )
  return to ? <Link to={to} className="block h-full">{body}</Link> : body
}

export function Money({ value }) {
  return <span className="tabular-nums">Rs. {Number(value).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
}

// eslint-disable-next-line react-refresh/only-export-components
export const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—')
