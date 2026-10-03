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
      <PageHeader title="Reports and experiment settings" />
      <ErrorBox error={error} />
      {msg && <Alert tone="green">{msg}</Alert>}
      <Card title="Evaluation exports (no names or addresses)">
        <div className="flex flex-wrap gap-2">
          <Button tone="secondary" onClick={() => downloadFile('/api/reports/intake.csv', 'intake_tasks.csv')}>Intake tasks (time, corrections, config)</Button>
          <Button tone="secondary" onClick={() => downloadFile('/api/reports/events.csv', 'scan_events.csv')}>Scan events (decisions, location)</Button>
          <Button tone="secondary" onClick={() => downloadFile('/api/reports/notifications.csv', 'notifications.csv')}>Notifications (outcomes, latency)</Button>
        </div>
      </Card>
      {policy && (
        <Card title="Location policy (proposal L0 / L1 / L2)">
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
      <Card title="Tariff versions">
        <ul className="space-y-2 text-sm">
          {tariffs.map((t) => (
            <li key={t.tariff_version} className="flex flex-wrap items-center gap-2">
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
