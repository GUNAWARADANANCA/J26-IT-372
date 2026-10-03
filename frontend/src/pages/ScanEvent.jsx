import { useState } from 'react'
import { api } from '../api.js'
import { DecisionBadge, LocationBadge } from '../components/StatusBadge.jsx'
import { Alert, Button, Card, ErrorBox, Field, PageHeader, inputClass } from '../components/ui.jsx'

// Desktop scan entry for counter and hub staff (USB barcode readers type the ID).
// Postmen use the mobile app, which also works offline.
export default function ScanEvent() {
  const [tid, setTid] = useState('')
  const [info, setInfo] = useState(null)
  const [status, setStatus] = useState('')
  const [useLocation, setUseLocation] = useState(true)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function lookup(e) {
    e?.preventDefault()
    setError(null); setResult(null); setInfo(null)
    try {
      const i = await api(`/api/scans/lookup/${encodeURIComponent(tid.trim())}`)
      setInfo(i)
      setStatus(i.allowed_statuses[0]?.status || '')
    } catch (err) { setError(err) }
  }

  const position = () => new Promise((resolve) => {
    if (!useLocation || !navigator.geolocation) return resolve({ permission: 'unavailable' })
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy_m: p.coords.accuracy,
        fix_age_s: Math.max(0, (Date.now() - p.timestamp) / 1000), permission: 'granted', provider: 'browser' }),
      (err) => resolve({ permission: err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable' }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  })

  async function submit() {
    setBusy(true); setError(null)
    try {
      const location = await position()
      const res = await api('/api/scans', { method: 'POST', body: {
        event_id: crypto.randomUUID(), item_id: info.tracking_id, requested_status: status,
        captured_at: new Date().toISOString(), expected_revision: info.revision, device_id: 'web', client_version: 'web-1.0', location,
      } })
      setResult(res)
      setTid(''); setInfo(null)
    } catch (err) { setError(err) } finally { setBusy(false) }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader title="Record a handover scan" subtitle="Dispatch, in-transit and arrival scans at a desk" />
      <ErrorBox error={error} />
      {result && (
        <Alert tone={result.decision === 'accepted' ? 'green' : 'amber'} title={`Scan ${result.decision.replaceAll('_', ' ')}`}>
          <div className="flex gap-2"><DecisionBadge decision={result.decision} /><LocationBadge result={result.location?.result} /></div>
          {result.reasons?.map((r) => <p key={r.code}>{r.message}</p>)}
        </Alert>
      )}
      <Card>
        <form onSubmit={lookup} className="flex gap-2">
          <input autoFocus className={inputClass} value={tid} onChange={(e) => setTid(e.target.value)} placeholder="Scan or type tracking ID" aria-label="Tracking ID" />
          <Button type="submit" tone="secondary">Look up</Button>
        </form>
        {info && (
          <div className="mt-4 space-y-3">
            <p className="text-sm">Current status: <b>{info.status_label}</b> · destination {info.destination_office} ({info.destination_town})</p>
            {info.allowed_statuses.length === 0 ? (
              <Alert tone="amber">Your role/office cannot record a status for this item now.</Alert>
            ) : (
              <>
                <Field label="New status">
                  <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                    {info.allowed_statuses.map((s) => <option key={s.status} value={s.status}>{s.label}</option>)}
                  </select>
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={useLocation} onChange={(e) => setUseLocation(e.target.checked)} />
                  Attach this computer's location (browser estimate; may be coarse)
                </label>
                <Button busy={busy} onClick={submit}>Record scan</Button>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
