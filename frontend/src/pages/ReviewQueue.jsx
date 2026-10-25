import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import Icon from '../components/icons.jsx'
import { LocationBadge, STATUS_LABEL } from '../components/StatusBadge.jsx'
import { Alert, Button, Card, EmptyState, ErrorBox, PageHeader, fmtTime, inputClass } from '../components/ui.jsx'

export default function ReviewQueue() {
  const [held, setHeld] = useState(null)
  const [flagged, setFlagged] = useState([])
  const [reasons, setReasons] = useState({})
  const [error, setError] = useState(null)
  const [deciding, setDeciding] = useState(null)

  const load = useCallback(() => {
    api('/api/review/held').then(setHeld).catch((e) => { setError(e); setHeld([]) })
    api('/api/review/flagged').then(setFlagged).catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])

  async function decide(row, action) {
    const reason = reasons[row.event.event_id] || ''
    if (reason.trim().length < 3) { setError(new Error('Write a reason (at least 3 characters) before deciding')); return }
    setDeciding(`${row.event.event_id}:${action}`)
    try {
      await api(`/api/review/${row.tracking_id}/${row.event.event_id}`, { method: 'POST', body: { action, reason } })
      setError(null)
      load()
    } catch (e) { setError(e) } finally { setDeciding(null) }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Review queue" breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Review queue' }]}
        subtitle="Scans that did not pass the automatic checks wait here for a postmaster's decision." />
      <Alert tone="blue" title="What happens when you decide">
        <b>Approve</b> applies the scan: the item status changes and, if the sender asked for updates, they are notified. <b>Reject</b> keeps the item as it is.
        Both decisions and your reason are recorded in the audit log.
      </Alert>
      <ErrorBox error={error} />
      <Card title={`Held for review${held ? ` (${held.length})` : ''}`} description="Newest first" padded={held?.length === 0 || held === null}>
        {held === null ? <p className="text-sm text-slate-500">Loading…</p> : held.length === 0 ? (
          <EmptyState icon="check" title="Nothing waiting for review">All held scans have been decided.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {held.map((row) => {
              const e = row.event
              const reason = reasons[e.event_id] || ''
              return (
                <li key={e.event_id} className="space-y-3 border-l-4 border-l-amber-500 px-5 py-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link className="link font-mono" to={`/items/${row.tracking_id}`}>{row.tracking_id}</Link>
                    <span className="flex items-center gap-1.5 text-slate-700">
                      {STATUS_LABEL[row.item_status]} <Icon name="arrow" className="h-3.5 w-3.5 text-slate-400" /> <b className="text-slate-900">{STATUS_LABEL[e.requested_status]}</b>
                    </span>
                    <LocationBadge result={e.assessment?.result} />
                  </div>
                  <p className="text-xs text-slate-600">Scanned by {e.worker} ({e.worker_role?.replaceAll('_', ' ')}) · captured {fmtTime(e.captured_at)} · received {fmtTime(e.received_at)}</p>
                  <div className="rounded-md bg-amber-50 px-3 py-2 text-amber-950">
                    <p className="text-xs font-semibold">Why it was held</p>
                    <ul className="mt-0.5 list-disc pl-5">{e.decision_reasons.map((r, i) => <li key={i}>{r.message}</li>)}</ul>
                    {e.acknowledgement && <p className="mt-1 text-xs">Acknowledgement: {e.acknowledgement.type} {e.acknowledgement.recipient_name}</p>}
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="min-w-64 flex-1">
                      <span className="mb-1 block text-xs font-semibold text-slate-700">Reason for your decision <span className="font-normal text-red-700">(required)</span></span>
                      <input className={inputClass} placeholder="e.g. postman confirmed by phone"
                        value={reason} onChange={(ev) => setReasons({ ...reasons, [e.event_id]: ev.target.value })} />
                    </label>
                    <Button icon="tick" busy={deciding === `${e.event_id}:approve`} disabled={reason.trim().length < 3 || deciding !== null} onClick={() => decide(row, 'approve')}>Approve</Button>
                    <Button tone="danger-outline" icon="xcircle" busy={deciding === `${e.event_id}:reject`} disabled={reason.trim().length < 3 || deciding !== null} onClick={() => decide(row, 'reject')}>Reject</Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      <Card title={`Accepted but flagged – last 14 days (${flagged.length})`} description="These scans were applied, but the location check raised a concern. No action is required." padded={false}>
        {flagged.length === 0 ? <EmptyState icon="check" title="No flagged scans" /> : (
          <div className="overflow-x-auto">
            <table className="rows-hover w-full text-sm">
              <thead><tr><th>Tracking ID</th><th>Status recorded</th><th>Location</th><th>Scanned by</th><th>Concern</th></tr></thead>
              <tbody>
                {flagged.map((row) => (
                  <tr key={row.event.event_id} className="border-t">
                    <td><Link className="link font-mono" to={`/items/${row.tracking_id}`}>{row.tracking_id}</Link></td>
                    <td>{STATUS_LABEL[row.event.requested_status]}</td>
                    <td><LocationBadge result={row.event.assessment?.result} /></td>
                    <td>{row.event.worker}</td>
                    <td className="text-xs text-slate-600">{row.event.assessment?.reasons?.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
