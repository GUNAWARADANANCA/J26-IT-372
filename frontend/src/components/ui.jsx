// Small, accessible building blocks shared by every page.
import { Link } from 'react-router-dom'
import Icon from './icons.jsx'

const tones = {
  primary: 'bg-brand-700 text-white shadow-sm hover:bg-brand-800 disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none',
  secondary: 'bg-white text-brand-800 border border-brand-300 hover:bg-brand-50 hover:border-brand-400 disabled:text-slate-400 disabled:border-slate-200 disabled:bg-white',
  danger: 'bg-red-700 text-white shadow-sm hover:bg-red-800 disabled:bg-slate-300 disabled:text-slate-600',
  'danger-outline': 'bg-white text-red-700 border border-red-300 hover:bg-red-50 disabled:text-slate-400 disabled:border-slate-200',
  ghost: 'text-brand-700 hover:bg-brand-50 disabled:text-slate-400',
}

const sizes = {
  sm: 'gap-1.5 px-2.5 py-1 text-xs',
  md: 'gap-2 px-4 py-2 text-sm',
}

export function Button({ tone = 'primary', size = 'md', className = '', busy = false, icon, children, ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-md font-semibold transition disabled:cursor-not-allowed ${sizes[size]} ${tones[tone]} ${className}`}
      {...props}
      disabled={busy || props.disabled}
    >
      {busy ? <Spinner small /> : icon && <Icon name={icon} className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
      {children}
    </button>
  )
}

// Round step marker: the number, or a tick once the step is complete.
export function StepNumber({ step, done, current }) {
  const look = done
    ? 'bg-emerald-600 text-white'
    : current ? 'bg-brand-700 text-white ring-4 ring-brand-100' : 'bg-white text-slate-500 ring-1 ring-inset ring-slate-300'
  return (
    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${look}`}>
      {done ? <Icon name="tick" className="h-4 w-4" /> : step}
      <span className="sr-only">{done ? ' (complete)' : current ? ' (current step)' : ''}</span>
    </span>
  )
}

// A titled panel. `step` adds a numbered marker (ticked when `done`) for multi-step forms.
export function Card({ title, description, actions, children, className = '', step, done, current, id, padded = true }) {
  return (
    <section id={id} className={`scroll-mt-28 rounded-lg border bg-white shadow-[0_1px_2px_rgba(22,38,58,0.06)] ${current ? 'border-brand-400' : 'border-line'} ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-t-lg border-b border-line bg-brand-50/60 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {step !== undefined && <StepNumber step={step} done={done} current={current} />}
            <div className="min-w-0">
              {title && <h2 className="text-[15px] font-semibold text-brand-900">{title}</h2>}
              {description && <p className="text-xs text-slate-600">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  )
}

const badgeTones = {
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-600/30',
  amber: 'bg-amber-50 text-amber-900 ring-amber-600/35',
  red: 'bg-red-50 text-red-800 ring-red-600/30',
  blue: 'bg-brand-50 text-brand-800 ring-brand-500/30',
  purple: 'bg-violet-50 text-violet-800 ring-violet-600/30',
  slate: 'bg-slate-100 text-slate-700 ring-slate-500/25',
}

const badgeDots = {
  green: 'bg-emerald-600', amber: 'bg-amber-500', red: 'bg-red-600', blue: 'bg-brand-600', purple: 'bg-violet-600', slate: 'bg-slate-500',
}

export function Badge({ tone = 'slate', children, title, dot = false }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${badgeTones[tone]}`}>
      {dot && <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${badgeDots[tone]}`} />}
      {children}
    </span>
  )
}

const alertTones = {
  red: 'border-red-200 border-l-red-600 bg-red-50 text-red-900',
  amber: 'border-amber-200 border-l-amber-500 bg-amber-50 text-amber-950',
  green: 'border-emerald-200 border-l-emerald-600 bg-emerald-50 text-emerald-950',
  blue: 'border-brand-200 border-l-brand-600 bg-brand-50 text-brand-950',
}
const alertIcons = { red: 'alert', amber: 'alert', green: 'check', blue: 'info' }

export function Alert({ tone = 'red', title, children }) {
  return (
    <div role={tone === 'red' ? 'alert' : 'status'} className={`flex gap-2.5 rounded-md border border-l-4 px-3 py-2.5 text-sm ${alertTones[tone]}`}>
      <Icon name={alertIcons[tone]} className="mt-0.5 h-4 w-4 opacity-80" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
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

export function Field({ label, hint, optional, required, children, className = '' }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-slate-700">
        {label}
        {required && <span className="font-normal text-red-700"> (required)</span>}
        {optional && <span className="font-normal text-slate-500"> (optional)</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50 disabled:text-slate-500'

export function Spinner({ small }) {
  return <span aria-hidden className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${small ? 'h-3 w-3' : 'h-5 w-5'}`} />
}

// Centred loading message for a whole page or panel.
export function Loading({ children = 'Loading…' }) {
  return (
    <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-600" role="status">
      <span className="text-brand-700"><Spinner /></span> {children}
    </p>
  )
}

// Title row of a page. `breadcrumbs` is a list of { label, to }; the page itself is the last, unlinked crumb.
export function PageHeader({ title, subtitle, actions, breadcrumbs }) {
  return (
    <div className="mb-6 border-b border-line pb-4">
      {breadcrumbs?.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-slate-600">
            {breadcrumbs.map((b, i) => (
              <li key={i} className="flex items-center gap-1">
                {i > 0 && <Icon name="chevron" className="h-3 w-3 text-slate-400" />}
                {b.to ? <Link to={b.to} className="font-medium text-brand-700 hover:underline">{b.label}</Link> : <span aria-current="page">{b.label}</span>}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-brand-900">{title}</h1>
          {subtitle && <div className="mt-1 max-w-3xl text-sm text-slate-600">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

// What a list looks like when it has nothing in it: what that means and, if useful, what to do.
export function EmptyState({ icon = 'inbox', title, children, action }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-600"><Icon name={icon} className="h-5 w-5" /></span>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {children && <div className="max-w-md text-sm text-slate-600">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

// Label / value pairs for a record (item, device, office).
export function DescriptionList({ items, className = '' }) {
  return (
    <dl className={`divide-y divide-slate-100 text-sm ${className}`}>
      {items.filter(Boolean).map(([label, value]) => (
        <div key={label} className="grid grid-cols-[minmax(7rem,38%)_1fr] gap-3 py-2 first:pt-0 last:pb-0">
          <dt className="text-slate-500">{label}</dt>
          <dd className="min-w-0 break-words font-medium text-slate-900">{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

const tileAccent = { amber: 'border-l-4 border-l-amber-500', red: 'border-l-4 border-l-red-600', green: 'border-l-4 border-l-emerald-600' }

// Dashboard figure: label, number and what it means. An accent marks something that needs attention.
export function StatTile({ label, value, hint, accent, icon, to }) {
  const body = (
    <div className={`flex h-full items-start justify-between gap-3 rounded-lg border border-line bg-white p-4 shadow-[0_1px_2px_rgba(22,38,58,0.05)] ${tileAccent[accent] || ''} ${to ? 'transition hover:border-brand-300 hover:shadow-md' : ''}`}>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-600">{label}</p>
        <p className={`mt-1 text-3xl font-bold tabular-nums ${accent === 'red' ? 'text-red-700' : 'text-brand-900'}`}>{value}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
      {icon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-700"><Icon name={icon} /></span>}
    </div>
  )
  return to ? <Link to={to} className="block h-full rounded-lg">{body}</Link> : body
}

export function Money({ value }) {
  return <span className="tabular-nums">Rs. {Number(value).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
}

// eslint-disable-next-line react-refresh/only-export-components
export const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—')

// eslint-disable-next-line react-refresh/only-export-components
export const fmtDate = (d = new Date()) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
