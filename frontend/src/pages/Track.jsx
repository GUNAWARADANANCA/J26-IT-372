import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { api } from '../api.js'
import Icon from '../components/icons.jsx'
import { Alert, Badge, Spinner } from '../components/ui.jsx'

// Public sender page. The token is in the URL fragment (#t=...), which the
// browser never sends to the server; we pass it in a header instead.
export default function Track() {
  const { trackingId } = useParams()
  const { hash } = useLocation()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const tokenValue = new URLSearchParams(hash.replace(/^#/, '')).get('t') || ''

  useEffect(() => {
    api(`/api/public/track/${trackingId}`, { headers: { 'X-Tracking-Token': tokenValue } }).then(setData).catch(setError)
  }, [trackingId, tokenValue])

  return (
    <div className="min-h-full px-4 py-10">
      <div className="mx-auto max-w-xl space-y-5">
        <header className="text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-700 text-white shadow-sm"><Icon name="truck" className="h-6 w-6" /></span>
          <p className="mt-3 text-sm font-bold uppercase tracking-wide text-brand-600">PostAssist LK</p>
          <h1 className="text-2xl font-bold text-brand-800">Track your registered letter</h1>
        </header>
        {error && <Alert tone="amber" title="Tracking record not found">Check that you opened the full link printed on your receipt.</Alert>}
        {!data && !error && <div className="text-center text-brand-700"><Spinner /></div>}
        {data && (
          <section className="overflow-hidden rounded-xl border border-line bg-white shadow-[0_8px_24px_rgba(22,38,58,0.08)]">
            <div className="border-b border-line bg-brand-50/70 px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tracking ID</p>
              <p className="font-mono text-lg font-bold text-brand-900">{data.tracking_id}</p>
              <p className="mt-1 text-sm text-slate-600">Accepted {data.accepted_local} at {data.origin_office} · to {data.destination_town}</p>
              <p className="mt-2"><Badge tone={data.status === 'delivered' ? 'green' : 'blue'}>{data.status_label}</Badge></p>
            </div>
            <ol className="space-y-4 px-5 py-5">
              {data.events.slice().reverse().map((e, i) => (
                <li key={i} className="relative border-l-2 border-brand-200 pl-5">
                  <span className={`absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white ${i === 0 ? 'bg-brand-600' : 'bg-brand-300'}`} />
                  <p className="font-semibold text-brand-900">{e.status_label}{e.history_only && ' (earlier scan, received late)'}</p>
                  <p className="text-sm text-slate-600">{e.captured_local}{e.place ? ` · ${e.place}` : ''}</p>
                  {e.synchronised_later && <p className="text-xs text-slate-500">This update was synchronised at {e.received_local}.</p>}
                </li>
              ))}
            </ol>
            <p className="border-t border-line px-5 py-3 text-xs text-slate-500">{data.notice}</p>
          </section>
        )}
      </div>
    </div>
  )
}
