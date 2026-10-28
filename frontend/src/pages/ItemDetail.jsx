import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { can, useAuth } from '../auth.jsx'
import { OutboxBadge, StatusBadge, StatusProgress } from '../components/StatusBadge.jsx'
import Timeline from '../components/Timeline.jsx'
import { Button, Card, DescriptionList, EmptyState, ErrorBox, Field, Loading, Money, PageHeader, fmtTime, inputClass } from '../components/ui.jsx'

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

  if (!item) return error ? <ErrorBox error={error} /> : <Loading>Loading item…</Loading>
  const r = item.recipient || {}
  return (
    <div className="space-y-5">
      <PageHeader title={<span className="font-mono">{item.tracking_id}</span>}
        breadcrumbs={[{ label: 'Registered items', to: '/items' }, { label: item.tracking_id }]}
        subtitle={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={item.status} />
          <span>{item.direction === 'return' ? 'Being returned to the sender' : `To ${r.city || 'destination'}`} · record revision {item.revision}</span></span>}
        actions={can(user, 'counter_officer') && <Link to={`/items/${item.tracking_id}/print`} className="inline-flex items-center gap-2 rounded-md border border-brand-300 bg-white px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50">Label &amp; receipt</Link>} />
      <ErrorBox error={error} />

      <section aria-label="Delivery progress" className="rounded-lg border border-line bg-white px-4 py-4 sm:px-6">
        <StatusProgress status={item.status} direction={item.direction} />
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Event history" description="Every scan with its decision and location check (staff view)" className="lg:col-span-2">
          {item.events?.length ? <Timeline events={item.events} /> : <EmptyState icon="history" title="No events yet" />}
        </Card>
        <div className="space-y-5">
          <Card title="Item details">
            <DescriptionList items={[
              ['Recipient', <>{r.name}<span className="block font-normal text-slate-600">{[r.house_number, r.street, r.locality, r.city, r.postcode].filter(Boolean).join(', ')}</span></>],
              item.sender && ['Sender', [item.sender.name, item.sender.city].filter(Boolean).join(', ')],
              ['Accepted', <>{fmtTime(item.accepted_at)}<span className="block font-normal text-slate-600">by {item.accepted_by}</span></>],
              ['Weight', item.weight ? `${item.weight.grams} g (${item.weight.source === 'device' ? 'IoT scale' : item.weight.source})` : null],
              item.quote && ['Charge', <><Money value={item.quote.total_lkr} /><span className="block font-normal text-slate-600">Tariff {item.tariff_version}</span></>],
              ['Assigned postman', item.assigned_postman || 'Not assigned'],
              ['Label', `${item.label?.prints ?? 0} print(s)${item.label?.verified_at ? ' · verified' : ' · not verified'}`],
            ]} />
          </Card>
          {can(user, 'postmaster') && (
            <Card title="Assign to a postman" description="The postman sees the item in the mobile app.">
              <div className="flex items-end gap-2">
                <Field label="Postman username" className="flex-1"><input className={inputClass} value={postman} onChange={(e) => setPostman(e.target.value)} placeholder="e.g. postman2" /></Field>
                <Button tone="secondary" disabled={!postman} onClick={assign}>Assign</Button>
              </div>
            </Card>
          )}
          {item.outbox?.length > 0 && (
            <Card title="Messages to the sender">
              <ul className="divide-y divide-slate-100 text-sm">
                {item.outbox.map((o) => (
                  <li key={o.key} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                    <span>
                      <span className="block font-medium capitalize text-slate-900">{o.status_code.replaceAll('_', ' ')}</span>
                      <span className="text-xs text-slate-500">{o.channel} · {o.language} · {o.attempts} attempt(s)</span>
                    </span>
                    <OutboxBadge status={o.status} />
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-slate-500">"Sent" means the e-mail service accepted the message – not that the sender has read it.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
