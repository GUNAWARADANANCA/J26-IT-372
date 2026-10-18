import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { STATUS_LABEL, StatusBadge } from '../components/StatusBadge.jsx'
import { Card, ErrorBox, PageHeader, fmtTime, inputClass } from '../components/ui.jsx'

export default function Items() {
  const [params, setParams] = useSearchParams()
  const [rows, setRows] = useState([])
  const q = params.get('q') || ''
  const setQ = (value) => setParams(value ? { q: value } : {}, { replace: true })
  const [status, setStatus] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => {
      api(`/api/items?q=${encodeURIComponent(q)}&status=${status}`).then(setRows).catch(setError)
    }, 300)
    return () => clearTimeout(t)
  }, [q, status])

  return (
    <div className="space-y-4">
      <PageHeader title="Registered items" subtitle="Find an item by tracking ID and open its verified history." />
      <ErrorBox error={error} />
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${inputClass} max-w-xs`} placeholder="Tracking ID (scan or type)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tracking ID" />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status filter">
          {[['', 'All'], ...Object.entries(STATUS_LABEL)].map(([k, v]) => (
            <button key={k} type="button" aria-pressed={status === k} onClick={() => setStatus(k)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${status === k ? 'border-brand-700 bg-brand-700 text-white' : 'border-line bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700'}`}>
              {v}
            </button>
          ))}
        </div>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr><th>Tracking ID</th><th>Status</th><th>To (town)</th><th>Weight</th><th>Accepted</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.tracking_id} className="border-t border-slate-100">
                  <td className="py-2"><Link className="link font-mono" to={`/items/${r.tracking_id}`}>{r.tracking_id}</Link></td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{r.recipient?.city} {r.recipient?.postcode}</td>
                  <td>{r.weight?.grams} g</td>
                  <td>{fmtTime(r.accepted_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="py-4 text-sm text-slate-500">No items.</p>}
        </div>
      </Card>
    </div>
  )
}
