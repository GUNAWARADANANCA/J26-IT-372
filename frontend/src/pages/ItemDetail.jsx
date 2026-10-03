import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { can, useAuth } from '../auth.jsx'
import { StatusBadge } from '../components/StatusBadge.jsx'
import Timeline from '../components/Timeline.jsx'
import { Badge, Button, Card, ErrorBox, Field, Money, PageHeader, Spinner, fmtTime, inputClass } from '../components/ui.jsx'

export default function ItemDetail() {
  const { trackingId } = useParams()
  const { user } = useAuth()
  const [item, setItem] = useState(null)
  const [error, setError] = useState(null)
  const [postman, setPostman] = useState('')

  const load = useCallback(() => api(`/api/items/${trackingId}`).then(setItem).catch(setError), [trackingId])
  useEffect(() => { load() }, [load])

  const assign = async () => {
    try { await api(`/api/items/${trackingId}/assign`, { method: 'POST', body: { postman_username: postman } }); load() } catch (e) { setError(e) }
  }

  if (!item) return error ? <ErrorBox error={error} /> : <Spinner />
  const r = item.recipient || {}
  return (
    <div className="space-y-4">
      <PageHeader title={<span className="font-mono">{item.tracking_id}</span>}
        subtitle={<span className="flex items-center gap-2"><StatusBadge status={item.status} /> revision {item.revision} · {item.direction === 'return' ? 'return to sender' : 'forward'}</span>}
        actions={can(user, 'counter_officer') && <Link to={`/items/${item.tracking_id}/print`}><Button tone="secondary">Label / receipt</Button></Link>} />
      <ErrorBox error={error} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Event history (staff view)" className="lg:col-span-2"><Timeline events={item.events} /></Card>
        <div className="space-y-4">
          <Card title="Item">
            <dl className="space-y-1 text-sm">
              <div><dt className="inline text-slate-500">To: </dt><dd className="inline">{r.name}, {[r.house_number, r.street, r.locality, r.city, r.postcode].filter(Boolean).join(', ')}</dd></div>
              {item.sender && <div><dt className="inline text-slate-500">From: </dt><dd className="inline">{item.sender.name}, {item.sender.city}</dd></div>}
              <div><dt className="inline text-slate-500">Accepted: </dt><dd className="inline">{fmtTime(item.accepted_at)} by {item.accepted_by}</dd></div>
              <div><dt className="inline text-slate-500">Weight: </dt><dd className="inline">{item.weight?.grams} g ({item.weight?.source})</dd></div>
              {item.quote && <div><dt className="inline text-slate-500">Charge: </dt><dd className="inline"><Money value={item.quote.total_lkr} /> · {item.tariff_version}</dd></div>}
              <div><dt className="inline text-slate-500">Assigned postman: </dt><dd className="inline">{item.assigned_postman || '—'}</dd></div>
              <div><dt className="inline text-slate-500">Label: </dt><dd className="inline">{item.label?.prints} print(s){item.label?.verified_at ? ' · verified' : ''}</dd></div>
            </dl>
          </Card>
          {can(user, 'postmaster') && (
            <Card title="Assign to postman">
              <div className="flex gap-2">
                <Field label="Username"><input className={inputClass} value={postman} onChange={(e) => setPostman(e.target.value)} placeholder="postman2" /></Field>
                <Button className="self-end" tone="secondary" disabled={!postman} onClick={assign}>Assign</Button>
              </div>
            </Card>
          )}
          {item.outbox?.length > 0 && (
            <Card title="Sender messages">
              <ul className="space-y-1 text-sm">
                {item.outbox.map((o) => (
                  <li key={o.key} className="flex flex-wrap items-center gap-2">
                    <span>{o.status_code.replaceAll('_', ' ')}</span>
                    <Badge tone={o.status === 'provider_accepted' ? 'green' : o.status.startsWith('failed') || o.status === 'ambiguous' ? 'red' : 'amber'}>{o.status.replaceAll('_', ' ')}</Badge>
                    <span className="text-xs text-slate-500">{o.channel}/{o.language} · {o.attempts} attempt(s)</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-500">"provider accepted" means the e-mail service took the message – not that the sender read it.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
