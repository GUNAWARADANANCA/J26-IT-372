import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { Badge, Card, EmptyState, ErrorBox, Field, PageHeader, fmtTime, inputClass } from '../components/ui.jsx'

export default function Audit() {
  const [rows, setRows] = useState([])
  const [f, setF] = useState({ action: '', target: '', severity: '' })
  const [error, setError] = useState(null)
  useEffect(() => {
    const t = setTimeout(() => {
      const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString()
      api(`/api/review/audit?${qs}`).then(setRows).catch(setError)
    }, 300)
    return () => clearTimeout(t)
  }, [f])
  return (
    <div className="space-y-4">
      <PageHeader title="Audit log" breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Audit log' }]}
        subtitle="Who did what, to which record, and why." />
      <ErrorBox error={error} />
      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Action starts with"><input className={inputClass} placeholder="e.g. scan. or review." value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} /></Field>
          <Field label="Record"><input className={inputClass} placeholder="Tracking ID or draft ID" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} /></Field>
          <Field label="Severity">
            <select className={inputClass} value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}>
              <option value="">All severities</option><option value="security">Security</option><option value="warning">Warning</option><option value="info">Information</option>
            </select>
          </Field>
        </div>
      </Card>
      <Card padded={false} title={`${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}`} description="Newest first">
        <div className="overflow-x-auto">
        <table className="rows-hover w-full text-sm">
          <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id} className="border-t align-top">
                <td className="whitespace-nowrap text-slate-600">{fmtTime(r.at)}</td>
                <td className="font-medium">{r.actor}</td>
                <td><span className="font-mono text-xs">{r.action}</span> {r.severity !== 'info' && <Badge tone={r.severity === 'security' ? 'red' : 'amber'}>{r.severity}</Badge>}</td>
                <td className="font-mono text-xs">{r.target}</td>
                <td className="max-w-md text-xs text-slate-600"><Details value={r.details} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState icon="history" title="No entries match">Change or clear the filters above.</EmptyState>}
        </div>
      </Card>
    </div>
  )
}

// Audit details as "key: value" lines instead of raw JSON.
function Details({ value }) {
  if (!value || typeof value !== 'object') return value ?? null
  const entries = Object.entries(value)
  if (entries.length === 0) return null
  return (
    <dl className="space-y-0.5">
      {entries.map(([k, v]) => (
        <div key={k} className="break-all"><dt className="inline font-semibold text-slate-700">{k.replaceAll('_', ' ')}: </dt>
          <dd className="inline">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd></div>
      ))}
    </dl>
  )
}
