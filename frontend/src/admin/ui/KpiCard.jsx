export default function KpiCard({
  label,
  value,
  note,
  change,
  tone = 'neutral',
  icon: Icon,
  className = '',
}) {
  const toneClasses = {
    up: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    down: 'text-rose-700 bg-rose-50 border-rose-200',
    warning: 'text-amber-700 bg-amber-50 border-amber-200',
    blue: 'text-[#1677D2] bg-blue-50 border-blue-200',
    neutral: 'text-slate-600 bg-slate-50 border-slate-200',
  }

  const iconBgClasses = {
    up: 'bg-emerald-50 text-emerald-600',
    down: 'bg-rose-50 text-rose-600',
    warning: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-[#1677D2]',
    neutral: 'bg-slate-100 text-slate-600',
  }

  return (
    <article className={`rounded-xl border border-[#DFE8F2] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-md ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wider text-[#64748B] uppercase">{label}</p>
        {Icon ? (
          <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${iconBgClasses[tone] || iconBgClasses.neutral}`}>
            <Icon className="size-4" />
          </div>
        ) : null}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-2xl font-bold tracking-tight text-[#172B4D] sm:text-3xl">
          {value ?? '—'}
        </p>
        {change !== undefined && change !== null ? (
          <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium border ${toneClasses[tone] || toneClasses.neutral}`}>
            {change}
          </span>
        ) : null}
      </div>
      {note ? <p className="mt-1 text-xs text-[#64748B]">{note}</p> : null}
    </article>
  )
}

