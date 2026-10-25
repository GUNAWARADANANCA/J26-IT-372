import { useState } from 'react'
import { api } from '../api.js'
import Icon from '../components/icons.jsx'
import { DecisionBadge, LocationBadge } from '../components/StatusBadge.jsx'
import { Alert, Button, Card, DescriptionList, ErrorBox, Field, PageHeader, StepNumber, inputClass } from '../components/ui.jsx'

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
      setResult({ ...res, tracking_id: info.tracking_id })
      setTid(''); setInfo(null)
    } catch (err) { setError(err) } finally { setBusy(false) }
  }

  const canRecord = info && info.allowed_statuses.length > 0
  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="Record a handover scan" subtitle="Record dispatch, in-transit and arrival scans at a desk. A USB barcode reader can type the tracking ID for you."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Record a scan' }]} />
      <ErrorBox error={error} />
      {result && (
        <Alert tone={result.decision === 'accepted' ? 'green' : 'amber'}
          title={result.decision === 'accepted' ? `Scan recorded for ${result.tracking_id}` : `Scan for ${result.tracking_id} is held for review`}>
          <div className="mt-1 flex flex-wrap gap-2"><DecisionBadge decision={result.decision} /><LocationBadge result={result.location?.result} /></div>
          {result.reasons?.map((r) => <p key={r.code} className="mt-1">{r.message}</p>)}
          {result.decision !== 'accepted' && <p className="mt-1">The item status will not change until a postmaster approves it.</p>}
        </Alert>
      )}
      <Card>
        <div className="space-y-6">
          <div className="flex gap-4">
            <StepNumber step={1} done={Boolean(info)} current={!info} />
            <div className="flex-1 space-y-2">
              <h2 className="font-semibold text-brand-900">Find the item</h2>
              <form onSubmit={lookup} className="flex gap-2">
                <input autoFocus className={inputClass} value={tid} onChange={(e) => setTid(e.target.value)} placeholder="Scan the barcode or type the tracking ID" aria-label="Tracking ID" />
                <Button type="submit" icon="search" disabled={!tid.trim()}>Look up</Button>
              </form>
            </div>
          </div>

          {info && (
            <div className="flex gap-4">
              <StepNumber step={2} done={false} current />
              <div className="flex-1 space-y-4">
                <h2 className="font-semibold text-brand-900">Check the item and choose the new status</h2>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <DescriptionList items={[
                    ['Tracking ID', <span className="font-mono">{info.tracking_id}</span>],
                    ['Current status', info.status_label],
                    ['Destination', `${info.destination_office} (${info.destination_town})`],
                  ]} />
                </div>
                {!canRecord ? (
                  <Alert tone="amber" title="No status can be recorded">Your role or office cannot record a status for this item at the moment.</Alert>
                ) : (
                  <>
                    <Field label="New status" required>
                      <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                        {info.allowed_statuses.map((s) => <option key={s.status} value={s.status}>{s.label}</option>)}
                      </select>
                    </Field>
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" className="mt-0.5" checked={useLocation} onChange={(e) => setUseLocation(e.target.checked)} />
                      <span>Attach this computer&apos;s location<span className="block text-xs text-slate-500">A browser estimate, which may be coarse. It is compared with the office&apos;s reference zone.</span></span>
                    </label>
                    <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                      <Button icon="tick" busy={busy} onClick={submit}>Record scan</Button>
                      <Button tone="secondary" onClick={() => { setInfo(null); setTid('') }}>Cancel</Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
      <p className="flex items-center gap-2 text-xs text-slate-500"><Icon name="info" className="h-4 w-4" /> Postmen record delivery and out-for-delivery scans in the mobile app, which also works offline.</p>
    </div>
  )
}
