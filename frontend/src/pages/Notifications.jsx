import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { Badge, Button, Card, ErrorBox, PageHeader, fmtTime, inputClass } from '../components/ui.jsx'

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
    <div className="space-y-4">
      <PageHeader title="Sender messages (outbox)" subtitle="Messages are created only for committed events; retries are bounded and de-duplicated." />
      <ErrorBox error={error} />
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${inputClass} max-w-xs`} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          {FILTERS.map((f) => <option key={f} value={f}>{f ? f.replaceAll('_', ' ') : 'All'}</option>)}
        </select>
        {Object.entries(data.counts).map(([k, v]) => <Badge key={k}>{k.replaceAll('_', ' ')}: {v}</Badge>)}
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th>Item</th><th>Event</th><th>Channel</th><th>Status</th><th>Attempts</th><th>Created</th><th /></tr></thead>
            <tbody>
              {data.entries.map((row) => {
                const e = row.entry
                const bad = e.status === 'failed_permanent' || e.status === 'ambiguous'
                return (
                  <tr key={e.key} className="border-t border-slate-100">
                    <td className="py-2"><Link className="link font-mono" to={`/items/${row.tracking_id}`}>{row.tracking_id}</Link></td>
                    <td>{e.status_code.replaceAll('_', ' ')}</td>
                    <td>{e.channel}/{e.language}</td>
                    <td><Badge tone={bad ? 'red' : e.status === 'provider_accepted' ? 'green' : 'amber'}>{e.status.replaceAll('_', ' ')}</Badge>
                      {e.history?.length > 0 && <span className="block text-xs text-slate-500">{e.history[e.history.length - 1].detail}</span>}</td>
                    <td>{e.attempts}</td>
                    <td>{fmtTime(e.created_at)}</td>
                    <td className="space-x-1 whitespace-nowrap">
                      <Button tone="ghost" onClick={async () => setPreview(await api(`/api/notifications/${row.tracking_id}/${e.key}/preview`))}>Preview</Button>
                      {bad && <Button tone="secondary" onClick={() => act(row, 'retry')}>Retry</Button>}
                      {bad && <Button tone="ghost" onClick={() => act(row, 'resolve')}>Resolve</Button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {preview && (
        <Card title={`Preview – ${preview.subject}`} actions={<Button tone="ghost" onClick={() => setPreview(null)}>Close</Button>}>
          <p className="text-xs text-slate-500">To {preview.to} · template {preview.template_version}</p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">{preview.body}</pre>
        </Card>
      )}
    </div>
  )
}
