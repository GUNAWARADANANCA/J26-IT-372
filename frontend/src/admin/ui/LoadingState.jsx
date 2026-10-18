export default function LoadingState({ label = 'Loading' }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-slate-500" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-700" aria-hidden="true" />
      {label}
    </div>
  )
}
