import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { LocationBadge, STATUS_LABEL } from '../components/StatusBadge.jsx'
import { Badge, Button, Card, ErrorBox, PageHeader, fmtTime, inputClass } from '../components/ui.jsx'

export default function ReviewQueue() {
  const [held, setHeld] = useState([])
  const [flagged, setFlagged] = useState([])
  const [reasons, setReasons] = useState({})
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    api('/api/review/held').then(setHeld).catch(setError)
    api('/api/review/flagged').then(setFlagged).catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])

  async function decide(row, action) {
    const reason = reasons[row.event.event_id] || ''
    if (reason.trim().length < 3) { setError(new Error('Write a reason (at least 3 characters) before deciding')); return }
    try {
      await api(`/api/review/${row.tracking_id}/${row.event.event_id}`, { method: 'POST', body: { action, reason } })
      setError(null)
      load()
    } catch (e) { setError(e) }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Review queue" subtitle="Held events do not change the item status or notify the sender until approved." />
      <ErrorBox error={error} />
      <Card title={`Held for review (${held.length})`}>
        {held.length === 0 ? <p className="text-sm text-slate-500">Nothing waiting.</p> : (
          <ul className="space-y-4">
            {held.map((row) => {
              const e = row.event
              return (
                <li key={e.event_id} className="rounded border border-amber-300 bg-amber-50/50 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link className="link font-mono" to={`/items/${row.tracking_id}`}>{row.tracking_id}</Link>
                    <span>requested <b>{STATUS_LABEL[e.requested_status]}</b> (item is {STATUS_LABEL[row.item_status]})</span>
                    <LocationBadge result={e.assessment?.result} />
                  </div>
                  <p className="text-xs text-slate-600">{e.worker} ({e.worker_role}) · captured {fmtTime(e.captured_at)} · received {fmtTime(e.received_at)}</p>
                  <ul className="mt-1 list-disc pl-5">{e.decision_reasons.map((r, i) => <li key={i}>{r.message}</li>)}</ul>
                  {e.acknowledgement && <p className="text-xs">Acknowledgement: {e.acknowledgement.type} {e.acknowledgement.recipient_name}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input className={`${inputClass} max-w-md`} placeholder="Reason for your decision (required)"
                      value={reasons[e.event_id] || ''} onChange={(ev) => setReasons({ ...reasons, [e.event_id]: ev.target.value })} />
                    <Button onClick={() => decide(row, 'approve')}>Approve</Button>
                    <Button tone="danger" onClick={() => decide(row, 'reject')}>Reject</Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      <Card title={`Accepted but flagged – last 14 days (${flagged.length})`}>
        <ul className="divide-y divide-slate-100 text-sm">
          {flagged.map((row) => (
            <li key={row.event.event_id} className="flex flex-wrap items-center gap-2 py-2">
              <Link className="link font-mono" to={`/items/${row.tracking_id}`}>{row.tracking_id}</Link>
              <span>{STATUS_LABEL[row.event.requested_status]}</span>
              <LocationBadge result={row.event.assessment?.result} />
              <Badge>{row.event.worker}</Badge>
              <span className="text-xs text-slate-500">{row.event.assessment?.reasons?.join('; ')}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
