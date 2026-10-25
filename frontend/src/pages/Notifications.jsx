import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { OUTBOX_LABEL, OutboxBadge } from '../components/StatusBadge.jsx'
import { Button, Card, EmptyState, ErrorBox, PageHeader, fmtTime } from '../components/ui.jsx'

const FILTERS = ['', 'queued', 'retry', 'sending', 'provider_accepted', 'ambiguous', 'failed_permanent', 'resolved_manually']

export default function Notifications() {
  const [status, setStatus] = useState('')
  const [data, setData] = useState({ counts: {}, entries: [] })
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(() => api(`/api/notifications?status=${status}`).then(setData).catch(setError), [status])
  useEffect(() => { load() }, [load])

  async function act(row, action) {
    const reason = window.prompt(action === 'retry' ? 'Why retry? (e.g. provider back online)' : 'How was it resolved? (e.g. sender phoned)')
    if (!reason) return
    try { await api(`/api/notifications/${row.tracking_id}/${row.entry.key}/${action}`, { method: 'POST', body: { reason } }); load() } catch (e) { setError(e) }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Sender messages" breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Sender messages' }]}
        subtitle="Status updates sent to senders by e-mail or SMS. A message is created only after a scan is accepted; retries are limited and duplicates are suppressed." />
      <ErrorBox error={error} />

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by outcome">
        {FILTERS.map((f) => {
          const n = f ? data.counts[f] : undefined
          const bad = f === 'failed_permanent' || f === 'ambiguous'
          return (
            <button key={f} type="button" aria-pressed={status === f} onClick={() => setStatus(f)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-semibold transition ${status === f
                ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-brand-400'}`}>
              {f ? OUTBOX_LABEL[f] : 'All messages'}
              {n > 0 && <span className={`rounded px-1.5 tabular-nums ${status === f ? 'bg-white/20' : bad ? 'bg-red-100 text-red-800' : 'bg-slate-100'}`}>{n}</span>}
            </button>
          )
        })}
      </div>

      <Card padded={false} title={`${data.entries.length} message${data.entries.length === 1 ? '' : 's'}`}
        description='"Sent" means the e-mail or SMS service accepted the message – not that the sender has read it.'>
        <div className="overflow-x-auto">
          <table className="rows-hover w-full text-sm">
            <thead><tr><th>Item</th><th>Update</th><th>Channel</th><th>Outcome</th><th>Attempts</th><th>Created</th><th className="text-right!">Actions</th></tr></thead>
            <tbody>
              {data.entries.map((row) => {
                const e = row.entry
                const bad = e.status === 'failed_permanent' || e.status === 'ambiguous'
                return (
                  <tr key={e.key} className={`border-t ${bad ? 'bg-red-50/40' : ''}`}>
                    <td><Link className="link font-mono" to={`/items/${row.tracking_id}`}>{row.tracking_id}</Link></td>
                    <td className="capitalize">{e.status_code.replaceAll('_', ' ')}</td>
                    <td className="whitespace-nowrap">{e.channel} · {e.language}</td>
                    <td><OutboxBadge status={e.status} />
                      {e.history?.length > 0 && <span className="mt-0.5 block max-w-xs text-xs text-slate-500">{e.history[e.history.length - 1].detail}</span>}</td>
                    <td className="tabular-nums">{e.attempts}</td>
                    <td className="whitespace-nowrap text-slate-600">{fmtTime(e.created_at)}</td>
                    <td>
                      <span className="flex justify-end gap-1.5 whitespace-nowrap">
                        <Button size="sm" tone="ghost" icon="eye" onClick={async () => setPreview(await api(`/api/notifications/${row.tracking_id}/${e.key}/preview`))}>Preview</Button>
                        {bad && <Button size="sm" tone="secondary" icon="refresh" onClick={() => act(row, 'retry')}>Retry</Button>}
                        {bad && <Button size="sm" tone="secondary" icon="tick" onClick={() => act(row, 'resolve')}>Mark resolved</Button>}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {data.entries.length === 0 && (
            <EmptyState icon="bell" title={status ? `No messages with outcome "${OUTBOX_LABEL[status]}"` : 'No sender messages yet'}>
              Messages appear here when a sender asked for updates at the counter.
            </EmptyState>
          )}
        </div>
      </Card>
      {preview && (
        <Card title={`Message preview – ${preview.subject}`} description={`To ${preview.to} · template ${preview.template_version}`}
          actions={<Button size="sm" tone="ghost" icon="close" onClick={() => setPreview(null)}>Close</Button>}>
          <pre className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-4 font-sans text-sm">{preview.body}</pre>
        </Card>
      )}
    </div>
  )
}
