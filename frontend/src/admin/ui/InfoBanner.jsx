import { Info } from 'lucide-react'

export default function InfoBanner({ children }) {
  return (
    <div className="mb-4 flex gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-slate-700" role="note">
      <Info className="mt-0.5 size-4 shrink-0 text-blue-700" aria-hidden="true" />
      <p>{children}</p>
    </div>
  )
}
