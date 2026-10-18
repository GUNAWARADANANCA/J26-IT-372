import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Alert, Button, Card, ErrorBox, Field, PageHeader, inputClass } from '../components/ui.jsx'

// Approved reference areas for location consistency. Every change needs provenance.
export default function Offices() {
  const { user } = useAuth()
  const [offices, setOffices] = useState([])
  const [error, setError] = useState(null)
  const load = () => api('/api/admin/offices').then(setOffices).catch(setError)
  useEffect(() => { load() }, [])
  return (
    <div className="space-y-4">
      <PageHeader title="Offices and reference zones" subtitle="Scan locations are compared with these points. A town centroid is not a building location." />
      <ErrorBox error={error} />
      {offices.map((o) => <OfficeCard key={o._id} office={o} editable={user.role === 'admin' || user.office_id === o._id} onSaved={load} />)}
    </div>
  )
}

function OfficeCard({ office, editable, onSaved }) {
  const [f, setF] = useState({ latitude: office.latitude, longitude: office.longitude, zone_radius_m: office.zone_radius_m,
    service_radius_m: office.service_radius_m, provenance: '' })
  const [error, setError] = useState(null)
  const [msg, setMsg] = useState('')

  const here = () => navigator.geolocation?.getCurrentPosition((p) => {
    setF({ ...f, latitude: Number(p.coords.latitude.toFixed(7)), longitude: Number(p.coords.longitude.toFixed(7)),
      provenance: `measured on site ${new Date().toISOString().slice(0, 10)} with browser geolocation, accuracy ${Math.round(p.coords.accuracy)} m` })
  }, (e) => setError(e), { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 })

  async function save() {
    try {
      await api(`/api/admin/offices/${office._id}`, { method: 'PATCH', body: { ...f, latitude: Number(f.latitude), longitude: Number(f.longitude),
        zone_radius_m: Number(f.zone_radius_m), service_radius_m: Number(f.service_radius_m) } })
      setMsg('saved'); onSaved()
    } catch (e) { setError(e) }
  }

  return (
    <Card title={`${office.name} (${office._id})`} actions={<span className="text-xs text-slate-500">{office.type} · {office.postcode}</span>}>
      <p className="mb-2 text-xs text-slate-600">Provenance: {office.provenance}</p>
      <ErrorBox error={error} />
      {msg && <Alert tone="green">{msg}</Alert>}
      {editable && (
        <div className="grid gap-2 sm:grid-cols-5">
          <Field label="Latitude"><input className={inputClass} value={f.latitude} onChange={(e) => setF({ ...f, latitude: e.target.value })} /></Field>
          <Field label="Longitude"><input className={inputClass} value={f.longitude} onChange={(e) => setF({ ...f, longitude: e.target.value })} /></Field>
          <Field label="Facility radius (m)"><input className={inputClass} type="number" value={f.zone_radius_m} onChange={(e) => setF({ ...f, zone_radius_m: e.target.value })} /></Field>
          <Field label="Delivery area radius (m)"><input className={inputClass} type="number" value={f.service_radius_m} onChange={(e) => setF({ ...f, service_radius_m: e.target.value })} /></Field>
          <Field label="Provenance (required)"><input className={inputClass} value={f.provenance} onChange={(e) => setF({ ...f, provenance: e.target.value })} /></Field>
          <div className="flex gap-2 sm:col-span-5">
            <Button tone="secondary" onClick={here}>Use my current location</Button>
            <Button disabled={f.provenance.length < 5} onClick={save}>Save zone</Button>
            <a className="link self-center text-xs" target="_blank" rel="noreferrer"
              href={`https://www.openstreetmap.org/?mlat=${f.latitude}&mlon=${f.longitude}#map=17/${f.latitude}/${f.longitude}`}>View on OpenStreetMap</a>
          </div>
        </div>
      )}
    </Card>
  )
}
