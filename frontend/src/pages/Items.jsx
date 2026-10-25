import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import Icon from '../components/icons.jsx'
import { STATUS_LABEL, StatusBadge } from '../components/StatusBadge.jsx'
import { Card, EmptyState, ErrorBox, PageHeader, fmtTime, inputClass } from '../components/ui.jsx'

export default function Items() {
  const [params, setParams] = useSearchParams()
  const [rows, setRows] = useState(null)
  const q = params.get('q') || ''
  const setQ = (value) => setParams(value ? { q: value } : {}, { replace: true })
  const [status, setStatus] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => {
      api(`/api/items?q=${encodeURIComponent(q)}&status=${status}`).then(setRows).catch((e) => { setError(e); setRows([]) })
    }, 300)
    return () => clearTimeout(t)
  }, [q, status])

  const filtered = q || status

  return (
    <div className="space-y-5">
      <PageHeader title="Registered items" subtitle="Find a letter by its tracking ID and open its verified history."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Registered items' }]} />
      <ErrorBox error={error} />
      <Card>
        <div className="space-y-4">
          <label className="block max-w-md">
            <span className="mb-1 block text-xs font-semibold text-slate-700">Tracking ID</span>
            <span className="relative block">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="search" /></span>
              <input className={`${inputClass} pl-9`} placeholder="Scan the barcode or type part of the ID" value={q} onChange={(e) => setQ(e.target.value)} />
            </span>
          </label>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-700" id="status-filter">Status</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="status-filter">
              {[['', 'All statuses'], ...Object.entries(STATUS_LABEL)].map(([k, v]) => (
                <button key={k} type="button" aria-pressed={status === k} onClick={() => setStatus(k)}
                  className={`rounded-md border px-3 py-1 text-xs font-semibold transition ${status === k ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-brand-400 hover:text-brand-800'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card padded={false} title={rows ? `${rows.length} item${rows.length === 1 ? '' : 's'}${filtered ? ' found' : ''}` : 'Items'}
        description={status ? `Showing items with status "${STATUS_LABEL[status]}"` : 'Newest first'}
        actions={filtered && <button type="button" className="link text-xs" onClick={() => { setQ(''); setStatus('') }}>Clear search &amp; filter</button>}>
        <div className="overflow-x-auto">
          <table className="rows-hover w-full text-sm">
            <thead>
              <tr><th>Tracking ID</th><th>Status</th><th>Destination town</th><th>Weight</th><th>Accepted</th></tr>
            </thead>
            <tbody>
              {(rows || []).map((r) => (
                <tr key={r.tracking_id} className="border-t">
                  <td><Link className="link font-mono" to={`/items/${r.tracking_id}`}>{r.tracking_id}</Link></td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{[r.recipient?.city, r.recipient?.postcode].filter(Boolean).join(' ') || '—'}</td>
                  <td className="tabular-nums">{r.weight?.grams != null ? `${r.weight.grams} g` : '—'}</td>
                  <td className="whitespace-nowrap text-slate-600">{fmtTime(r.accepted_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows === null && <p className="p-5 text-sm text-slate-500">Loading items…</p>}
          {rows?.length === 0 && (
            <EmptyState icon="search" title={filtered ? 'No items match' : 'No registered items yet'}>
              {filtered ? 'Check the tracking ID, or clear the search and status filter.' : 'Letters appear here once they are accepted at the counter.'}
            </EmptyState>
          )}
        </div>
      </Card>
    </div>
  )
}
