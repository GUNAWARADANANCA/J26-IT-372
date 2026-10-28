export default function ChartCard({
  title,
  note,
  action,
  children,
  className = '',
}) {
  return (
    <section className={`flex min-h-0 flex-col rounded-xl border border-[#DFE8F2] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-[#172B4D] sm:text-base">{title}</h2>
          {note ? <p className="mt-0.5 text-xs text-[#64748B]">{note}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  )
}

