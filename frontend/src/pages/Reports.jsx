import { useEffect, useState } from 'react'
import { api, downloadFile } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Alert, Badge, Button, Card, ErrorBox, Field, PageHeader, inputClass } from '../components/ui.jsx'

export default function Reports() {
  const { user } = useAuth()
  const [policy, setPolicy] = useState(null)
  const [tariffs, setTariffs] = useState([])
  const [mode, setMode] = useState('L2')
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api('/api/admin/policy').then((p) => { setPolicy(p); setMode(p.mode) }).catch(setError)
    api('/api/admin/tariffs').then(setTariffs).catch(() => {})
  }, [])

  async function switchMode() {
    try { setPolicy(await api('/api/admin/policy/mode', { method: 'POST', body: { mode, reason } })); setMsg('policy switched') } catch (e) { setError(e) }
  }
  async function approve(version) {
    const note = window.prompt('Approval note (who verified it against the counter price chart?)')
    if (!note) return
    try { await api(`/api/admin/tariffs/${version}/approve`, { method: 'POST', body: { reason: note } }); setTariffs(await api('/api/admin/tariffs')) } catch (e) { setError(e) }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Reports & settings" breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Reports & settings' }]}
        subtitle="Download evaluation data and manage the location policy and tariff versions." />
      <ErrorBox error={error} />
      {msg && <Alert tone="green">{msg}</Alert>}
      <Card title="Evaluation exports" description="CSV files for analysis. They contain no names or addresses.">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ['Intake tasks', 'Time taken, corrections and capture mode per registration', '/api/reports/intake.csv', 'intake_tasks.csv'],
            ['Scan events', 'Decisions and location checks for every scan', '/api/reports/events.csv', 'scan_events.csv'],
            ['Sender messages', 'Outcomes and delivery latency of notifications', '/api/reports/notifications.csv', 'notifications.csv'],
          ].map(([title, text, url, file]) => (
            <div key={file} className="flex flex-col justify-between gap-3 rounded-md border border-slate-200 p-4">
              <div>
                <p className="font-semibold text-slate-900">{title}</p>
                <p className="text-xs text-slate-600">{text}</p>
              </div>
              <Button size="sm" tone="secondary" icon="download" className="self-start" onClick={() => downloadFile(url, file)}>Download CSV</Button>
            </div>
          ))}
        </div>
      </Card>
      {policy && (
        <Card title="Location policy" description="How scan locations are judged (L0 / L1 / L2 from the proposal).">
          <p className="text-sm">Active: <b>{policy.policy_version}</b> – mode {policy.mode}, accuracy read as {Math.round(policy.accuracy_confidence * 100)} % radius,
            consistent if P(inside) ≥ {policy.p_consistent}, mismatch if ≤ {policy.p_mismatch}, max fix age {policy.max_fix_age_s} s.</p>
          {user.role === 'admin' && (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Field label="Mode">
                <select className={inputClass} value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="L0">L0 – status only</option><option value="L1">L1 – fixed radius</option><option value="L2">L2 – uncertainty-aware</option>
                </select>
              </Field>
              <Field label="Reason"><input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="location trial session 3" /></Field>
              <Button disabled={reason.length < 3} onClick={switchMode}>Switch policy</Button>
            </div>
          )}
        </Card>
      )}
      <Card title="Tariff versions" description="Postage bands and registration fee used to calculate the counter charge.">
        <ul className="divide-y divide-slate-100 text-sm">
          {tariffs.map((t) => (
            <li key={t.tariff_version} className="flex flex-wrap items-center gap-2 py-2 first:pt-0 last:pb-0">
              <b>{t.tariff_version}</b> effective {String(t.effective_from).slice(0, 10)}
              <Badge tone={t.approval_status === 'approved' ? 'green' : 'amber'}>{t.approval_status}</Badge>
              <span className="text-xs text-slate-500">registration Rs. {t.registration_fee_lkr} · {t.letter_postage_bands.length} bands</span>
              {user.role === 'admin' && t.approval_status !== 'approved' && <Button tone="ghost" onClick={() => approve(t.tariff_version)}>Mark approved</Button>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
