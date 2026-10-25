import { useCallback, useEffect, useState } from 'react'
import { api, downloadFile, imageUrl } from '../api.js'
import { can, useAuth } from '../auth.jsx'
import { Alert, Badge, Button, Card, EmptyState, ErrorBox, Field, PageHeader, fmtTime, inputClass } from '../components/ui.jsx'

export default function Devices() {
  const [devices, setDevices] = useState([])
  const [error, setError] = useState(null)
  useEffect(() => { api('/api/devices').then(setDevices).catch(setError) }, [])
  return (
    <div className="space-y-4">
      <PageHeader title="Scale & camera" breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Scale & camera' }]}
        subtitle="Live status, zeroing, calibration and weighing trials for the counter's IoT scale (ESP32-CAM OV3660, HX711, 1 kg load cell)." />
      <ErrorBox error={error} />
      {devices.length === 0 && (
        <Card><EmptyState icon="scale" title="No scale registered for your office">Ask the administrator to register the device. Until then, weights can be entered by hand during intake.</EmptyState></Card>
      )}
      {devices.map((d) => <DeviceCard key={d.device_id} deviceId={d.device_id} />)}
    </div>
  )
}

// What the device answered to a tare / calibrate command, as [text, tone] for the status line.
function commandOutcome(type, cmd) {
  const res = cmd.result || {}
  if (cmd.status !== 'done') return [`${type} ${cmd.status}: ${res.error || res.message || 'the device did not pick it up'}`, 'red']
  if (type === 'calibrate') return [`calibrated: ${res.calibration_id}${res.readback_g != null ? ` – reads ${res.readback_g} g with the reference mass on it` : ''}`, 'green']
  return [`${type} done: ${[res.message, res.note].filter(Boolean).join(' – ')}`, 'green']
}

function DeviceCard({ deviceId }) {
  const { user } = useAuth()
  const [live, setLive] = useState(null)
  const [error, setError] = useState(null)
  const [known, setKnown] = useState('100')
  const [trial, setTrial] = useState({ reference_g: '', condition: 'centre', note: '' })
  const [trials, setTrials] = useState([])
  const [img, setImg] = useState(null)
  const [unc, setUnc] = useState({ value: '', evidence: '' })
  const [msg, setMsg] = useState('')
  const [msgTone, setMsgTone] = useState('blue')
  const note = (text, tone = 'blue') => { setMsg(text); setMsgTone(tone) }

  useEffect(() => {
    let stop = false
    const tick = async () => {
      try { const l = await api(`/api/devices/${deviceId}/live`); if (!stop) setLive(l) } catch (e) { if (!stop) setError(e) }
      if (!stop) setTimeout(tick, 800)
    }
    tick()
    return () => { stop = true }
  }, [deviceId])

  const loadTrials = useCallback(() => api(`/api/devices/${deviceId}/trials`).then(setTrials).catch(() => {}), [deviceId])
  useEffect(() => { loadTrials() }, [loadTrials])

  async function command(type, params = {}) {
    setError(null)
    try {
      const cmd = await api(`/api/devices/${deviceId}/commands`, { method: 'POST', body: { type, params } })
      note(`${type} sent – the device picks it up within a second`)
      if (type === 'capture') {
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 800))
          const s = await api(`/api/intake/captures/${cmd.params.capture_id}`)
          if (s.status === 'received') { setImg(await imageUrl(s.image_id)); note(`photo received (${s.width}×${s.height}), quality ${s.quality?.ok ? 'OK' : 'issues: ' + s.quality?.issues.map((x) => x.code).join(', ')}`); return }
          if (s.status !== 'requested') { note(`capture ${s.status} ${s.error || ''}`, 'red'); return }
        }
        return
      }
      for (let i = 0; i < 25; i++) {
        await new Promise((r) => setTimeout(r, 600))
        const done = (await api(`/api/devices/${deviceId}/live`)).recent_commands?.find((c) => c._id === cmd._id)
        if (done && !['queued', 'sent'].includes(done.status)) { note(...commandOutcome(type, done)); return }
      }
      note(`${type}: no answer from the device – is it online?`, 'amber')
    } catch (e) { setError(e) }
  }

  async function recordTrial() {
    try {
      const t = await api(`/api/devices/${deviceId}/trials`, { method: 'POST', body: { ...trial, reference_g: Number(trial.reference_g) } })
      note(`trial recorded: ${t.reading_g} g for ${t.reference_g} g (error ${t.error_g} g)`)
      loadTrials()
    } catch (e) { setError(e) }
  }

  async function saveUncertainty() {
    try {
      await api(`/api/devices/${deviceId}/uncertainty`, { method: 'POST', body: { expanded_uncertainty_g: Number(unc.value), evidence: unc.evidence } })
      note('expanded uncertainty saved')
    } catch (e) { setError(e) }
  }

  const r = live?.latest_reading
  const cal = live?.calibration || {}
  const mae = trials.length ? (trials.reduce((s, t) => s + Math.abs(t.error_g), 0) / trials.length).toFixed(2) : null
  return (
    <Card title={<span className="flex items-center gap-2">{deviceId} <Badge tone={live?.online ? 'green' : 'red'} dot>{live?.online ? 'Online' : 'Offline'}</Badge></span>}
      description={`Last seen ${fmtTime(live?.last_seen)}`}
      actions={<span className="text-xs text-slate-500">IP {live?.ip || '–'} · firmware {live?.firmware || '–'} · signal {live?.rssi != null ? `${live.rssi} dBm` : 'n/a'}</span>}>
      <div className="space-y-4">
        <ErrorBox error={error} />
        {msg && <Alert tone={msgTone}>{msg}</Alert>}
        <div className="flex flex-wrap items-center gap-6 rounded-md bg-brand-900 p-4 text-white" aria-live="polite">
          <span className="text-5xl font-bold tabular-nums">{r?.net_g != null ? r.net_g.toFixed(1) : '—'} g</span>
          <div className="space-y-1 text-sm">
            <div className="flex gap-2">
              {r?.needs_tare
                ? <Badge tone="red" dot>Needs tare</Badge>
                : <Badge tone={r?.stable ? 'green' : 'amber'} dot>{r?.stable ? 'Stable' : 'Settling'}</Badge>}
              <Badge tone={r?.loaded ? 'blue' : 'slate'}>{r?.loaded ? `Item on scale #${r.placement_id}` : 'Platform empty'}</Badge>
              <Badge tone={r?.sensor_ok === false ? 'red' : 'green'}>Load sensor {r?.sensor_ok === false ? 'fault' : 'OK'}</Badge>
              <Badge tone={live?.camera_ok ? 'green' : 'amber'}>Camera {live?.camera_ok ? 'OK' : 'n/a'}</Badge>
            </div>
            <p className="text-xs text-slate-300">spread {r?.spread_g ?? '–'} g over the last second · calibration {cal.calibration_id || 'none'} · ±{cal.expanded_uncertainty_g ?? '? (no trials yet)'} g</p>
            {r?.needs_tare && <p className="text-xs text-amber-300">The scale was restarted: empty the platform and press Tare.</p>}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2 rounded-md border border-slate-200 p-4">
            <h3 className="font-semibold text-brand-900">Zero and calibrate</h3>
            <Button tone="secondary" onClick={() => command('tare')}>Tare (platform empty)</Button>
            <div className="flex items-end gap-2">
              <Field label="Reference mass (g)"><input className={inputClass} type="number" value={known} onChange={(e) => setKnown(e.target.value)} /></Field>
              <Button tone="secondary" onClick={() => command('calibrate', { known_g: Number(known) })}>Calibrate</Button>
            </div>
            <p className="text-xs text-slate-500">Tare with the platform empty, then place the reference mass and press Calibrate.</p>
          </div>
          <div className="space-y-2 rounded-md border border-slate-200 p-4">
            <h3 className="font-semibold text-brand-900">Camera test</h3>
            <p className="text-xs text-slate-500">Takes a photo of the platform to check focus and lighting.</p>
            <Button tone="secondary" onClick={() => command('capture', { flash: false })}>Take test photo</Button>
            {img && <img src={img} alt="Test capture from the ESP32-CAM" className="w-full rounded border" />}
          </div>
          <div className="space-y-2 rounded-md border border-slate-200 p-4">
            <h3 className="font-semibold text-brand-900">Weighing trial (reference masses)</h3>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Reference (g)"><input className={inputClass} type="number" step="0.1" value={trial.reference_g} onChange={(e) => setTrial({ ...trial, reference_g: e.target.value })} /></Field>
              <Field label="Condition">
                <select className={inputClass} value={trial.condition} onChange={(e) => setTrial({ ...trial, condition: e.target.value })}>
                  <option value="centre">centre</option><option value="off_centre">off-centre</option><option value="replaced">re-placed</option>
                  <option value="after_restart">after restart</option><option value="boundary">near band boundary</option>
                </select>
              </Field>
            </div>
            <Button tone="secondary" disabled={!trial.reference_g} onClick={recordTrial}>Record current stable reading</Button>
            <p className="text-xs text-slate-500">{trials.length} trials · mean absolute error {mae ?? '–'} g</p>
            <Button size="sm" tone="ghost" icon="download" onClick={() => downloadFile(`/api/devices/${deviceId}/trials.csv`, `${deviceId}_trials.csv`)}>Download trials CSV</Button>
          </div>
        </div>

        {can(user, 'postmaster') && (
          <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
            <Field label="Expanded uncertainty U (g, k=2)" hint="from ml/evaluation/weighing_analysis.py">
              <input className={inputClass} type="number" step="0.1" value={unc.value} onChange={(e) => setUnc({ ...unc, value: e.target.value })} />
            </Field>
            <Field label="Evidence"><input className={`${inputClass} min-w-72`} value={unc.evidence} placeholder="100 trials 2026-11-03, MAE 0.6 g" onChange={(e) => setUnc({ ...unc, evidence: e.target.value })} /></Field>
            <Button tone="secondary" disabled={!unc.value || unc.evidence.length < 5} onClick={saveUncertainty}>Save</Button>
          </div>
        )}
      </div>
    </Card>
  )
}
