import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { Badge, Card, ErrorBox, PageHeader, fmtTime, inputClass } from '../components/ui.jsx'

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
      <PageHeader title="Audit log" subtitle="Who did what, to which record, and why." />
      <ErrorBox error={error} />
      <div className="flex flex-wrap gap-2">
        <input className={`${inputClass} max-w-xs`} placeholder="action prefix, e.g. scan." value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} aria-label="Action" />
        <input className={`${inputClass} max-w-xs`} placeholder="target (tracking ID, draft)" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} aria-label="Target" />
        <select className={`${inputClass} max-w-xs`} value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })} aria-label="Severity">
          <option value="">all severities</option><option value="security">security</option><option value="warning">warning</option><option value="info">info</option>
        </select>
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id} className="border-t border-slate-100 align-top">
                <td className="whitespace-nowrap py-1.5">{fmtTime(r.at)}</td>
                <td>{r.actor}</td>
                <td>{r.action} {r.severity !== 'info' && <Badge tone={r.severity === 'security' ? 'red' : 'amber'}>{r.severity}</Badge>}</td>
                <td className="font-mono text-xs">{r.target}</td>
                <td className="max-w-md break-all text-xs text-slate-600">{JSON.stringify(r.details)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
