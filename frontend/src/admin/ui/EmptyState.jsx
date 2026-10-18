import { BarChart3 } from 'lucide-react'

export default function EmptyState({ title, children }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <BarChart3 className="mx-auto mb-3 size-8 text-slate-400" aria-hidden="true" />
      <p className="text-base font-medium text-slate-800">{title}</p>
      {children ? <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{children}</p> : null}
    </div>
  )
}
