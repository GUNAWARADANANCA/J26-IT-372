export default function FilterPanel({ children, onClear }) {
  return (
    <section className="mb-4 rounded-xl border border-slate-200 bg-white p-3" aria-label="Filters">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="grid flex-1 gap-3 sm:grid-cols-2">{children}</div>
        {onClear ? (
          <button
            type="button"
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
            onClick={onClear}
          >
            Clear filters
          </button>
        ) : null}
      </div>
    </section>
  )
}
