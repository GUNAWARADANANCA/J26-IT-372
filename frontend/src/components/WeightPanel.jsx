import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { Alert, Badge, Button, Card, ErrorBox, Field, inputClass } from './ui.jsx'

// Live IoT scale reading with an explicit "use this weight" action (FR06).
export default function WeightPanel({ draft, devices, onChange, disabled }) {
  const [chosenDevice, setDeviceId] = useState('')
  const deviceId = chosenDevice || devices[0]?.device_id || ''  // devices arrive after the first render
  const [live, setLive] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [manual, setManual] = useState({ grams: '', reason: '', instrument: '' })

  useEffect(() => {
    if (!deviceId || disabled) return
    let stop = false
    const tick = async () => {
      try { const r = await api(`/api/intake/drafts/${draft._id}/weight/live?device_id=${deviceId}`); if (!stop) setLive(r) } catch { /* shown on next tick */ }
      if (!stop) setTimeout(tick, 700)
    }
    tick()
    return () => { stop = true }
  }, [deviceId, draft._id, disabled])

  async function act(fn) {
    setBusy(true)
    setError(null)
    try { await fn(); await onChange() } catch (e) { setError(e) } finally { setBusy(false) }
  }

  const pair = () => act(() => api(`/api/intake/drafts/${draft._id}/weight/pair`, { method: 'POST', body: { device_id: deviceId } }))
  const saveManual = () => act(() => api(`/api/intake/drafts/${draft._id}/weight/manual`, {
    method: 'POST', body: { grams: Number(manual.grams), reason: manual.reason, instrument: manual.instrument },
  }))

  const r = live?.reading
  const w = draft.weight
  return (
    <Card title="4 · Weight">
      <div className="space-y-3">
        <ErrorBox error={error} />
        {devices.length > 1 && (
          <Field label="Scale">
            <select className={inputClass} value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
              {devices.map((d) => <option key={d.device_id} value={d.device_id}>{d.device_id}</option>)}
            </select>
          </Field>
        )}
        {devices.length === 0 && <Alert tone="amber">No IoT scale registered for this office – use the manual weight below.</Alert>}
        {deviceId && (
          <div className="flex flex-wrap items-center gap-4 rounded-md bg-brand-900 p-4 text-white" aria-live="polite">
            <span className="text-4xl font-bold tabular-nums">{r?.net_g != null ? `${r.net_g.toFixed(1)} g` : '— g'}</span>
            <div className="space-y-1 text-sm">
              {live?.ready ? <Badge tone="green">stable – ready</Badge> : <Badge tone="amber">{live?.problems?.[0]?.code?.replaceAll('_', ' ').toLowerCase() || 'waiting'}</Badge>}
              <p className="text-xs text-slate-300">spread {r?.spread_g ?? '–'} g · placement #{r?.placement_id ?? '–'} · {r?.calibration_id || 'not calibrated'}</p>
            </div>
            <Button className="ml-auto" busy={busy} disabled={!live?.ready || disabled} onClick={pair}>Use this weight</Button>
          </div>
        )}
        {live && !live.ready && live.problems?.length > 0 && <p className="text-xs text-slate-600">{live.problems.map((p) => p.message).join(' · ')}</p>}
        {w && (
          <Alert tone="green" title={`Paired: ${w.grams} g (${w.source === 'device' ? `scale ${w.device_id}` : 'manual – approved instrument'})`}>
            Uncertainty ±{w.uncertainty_g} g{w.calibration_id ? ` · calibration ${w.calibration_id}` : ''}{w.manual ? ` · reason: ${w.manual.reason}` : ''}
          </Alert>
        )}
        <details className="rounded border border-slate-200 p-2">
          <summary className="cursor-pointer text-sm font-medium">Manual weight from an approved instrument (audited)</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <Field label="Grams"><input className={inputClass} type="number" step="0.1" value={manual.grams} onChange={(e) => setManual({ ...manual, grams: e.target.value })} /></Field>
            <Field label="Instrument"><input className={inputClass} value={manual.instrument} placeholder="Counter scale #2" onChange={(e) => setManual({ ...manual, instrument: e.target.value })} /></Field>
            <Field label="Reason"><input className={inputClass} value={manual.reason} placeholder="above prototype range" onChange={(e) => setManual({ ...manual, reason: e.target.value })} /></Field>
          </div>
          <Button tone="secondary" className="mt-2" busy={busy} disabled={disabled || !manual.grams || manual.reason.length < 5 || manual.instrument.length < 2} onClick={saveManual}>
            Record manual weight
          </Button>
        </details>
      </div>
    </Card>
  )
}
