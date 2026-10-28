export default function PageHeader({
  title,
  description,
  badge,
  actions,
  children,
  className = '',
}) {
  return (
    <header className={`mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-[#172B4D] sm:text-2xl">{title}</h1>
          {badge ? (
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-[#1677D2] border border-blue-200">
              {badge}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="mt-0.5 text-xs sm:text-sm text-[#64748B] line-clamp-2">{description}</p>
        ) : null}
      </div>
      {(actions || children) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
          {children}
        </div>
      )}
    </header>
  )
}

