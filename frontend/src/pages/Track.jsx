import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { api } from '../api.js'
import Icon from '../components/icons.jsx'
import { StatusProgress } from '../components/StatusBadge.jsx'
import { Alert, Badge, Loading } from '../components/ui.jsx'

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

  const events = data ? data.events.slice().reverse() : []
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b-4 border-amber-400 bg-brand-900 px-4 py-4 text-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-white text-brand-800"><Icon name="mail" className="h-5 w-5" /></span>
          <div>
            <p className="text-lg font-bold leading-tight">PostAssist LK</p>
            <p className="text-xs text-brand-200">Registered letter tracking</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-8">
        <div className="mx-auto max-w-2xl space-y-5">
          <h1 className="text-2xl font-bold text-brand-900">Track your registered letter</h1>
          {error && (
            <Alert tone="amber" title="Tracking record not found">
              Check that you opened the full link printed on your receipt, or scan the QR code on the receipt again.
            </Alert>
          )}
          {!data && !error && <Loading>Finding your letter…</Loading>}
          {data && (
            <>
              <section className="overflow-hidden rounded-lg border border-line bg-white shadow-[0_4px_16px_rgba(22,38,58,0.06)]">
                <div className="grid gap-4 border-b border-line px-5 py-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Tracking ID</p>
                    <p className="font-mono text-lg font-bold text-brand-900">{data.tracking_id}</p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-xs font-semibold text-slate-500">Current status</p>
                    <p className="mt-1"><Badge tone={data.status === 'delivered' ? 'green' : 'blue'} dot>{data.status_label}</Badge></p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Accepted</p>
                    <p className="text-sm text-slate-800">{data.accepted_local} at {data.origin_office}</p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-xs font-semibold text-slate-500">Destination</p>
                    <p className="text-sm text-slate-800">{data.destination_town}</p>
                  </div>
                </div>
                {data.status && (
                  <div className="border-b border-line bg-slate-50 px-3 py-4 sm:px-5">
                    <StatusProgress status={data.status} />
                  </div>
                )}
                <div className="px-5 py-5">
                  <h2 className="mb-4 text-sm font-semibold text-brand-900">Updates</h2>
                  <ol className="space-y-4">
                    {events.map((e, i) => (
                      <li key={i} className="relative border-l-2 border-brand-200 pl-5">
                        <span className={`absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white ${i === 0 ? 'bg-brand-700' : 'bg-brand-300'}`} />
                        <p className={`font-semibold ${i === 0 ? 'text-brand-900' : 'text-slate-800'}`}>{e.status_label}{e.history_only && ' (earlier scan, received late)'}</p>
                        <p className="text-sm text-slate-600">{e.captured_local}{e.place ? ` · ${e.place}` : ''}</p>
                        {e.synchronised_later && <p className="text-xs text-slate-500">This update was synchronised at {e.received_local}.</p>}
                      </li>
                    ))}
                  </ol>
                </div>
              </section>
              <p className="flex gap-2 text-xs text-slate-600"><Icon name="info" className="h-4 w-4 shrink-0" />{data.notice}</p>
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-line bg-white px-4 py-3 text-center text-[11px] text-slate-500">
        Keep your receipt until the letter is delivered. For questions, contact the post office where you posted it.
      </footer>
    </div>
  )
}
