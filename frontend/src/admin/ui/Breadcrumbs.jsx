export default function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0 text-sm text-slate-500">
      <ol className="flex items-center gap-1 truncate">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            <span className={index === items.length - 1 ? 'truncate font-medium text-slate-800' : 'truncate'}>
              {item.label}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  )
}
