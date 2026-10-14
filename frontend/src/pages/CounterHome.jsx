import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { Badge, Button, Card, ErrorBox, PageHeader, fmtTime } from '../components/ui.jsx'

export default function CounterHome() {
  const navigate = useNavigate()
  const [drafts, setDrafts] = useState([])
  const [caps, setCaps] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('/api/intake/drafts').then(setDrafts).catch(setError)
    api('/api/intake/capabilities').then(setCaps).catch(() => {})
  }, [])

  async function start() {
    setBusy(true)
    try {
      const d = await api('/api/intake/drafts', { method: 'POST' })
      navigate(`/counter/${d._id}`)
    } catch (e) { setError(e) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Counter intake" subtitle="Domestic registered letters, 5–500 g on the IoT scale"
        actions={<Button icon="plus" busy={busy} onClick={start}>New registered letter</Button>} />
      <ErrorBox error={error} />
      {caps && (
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge tone={caps.ocr.available ? 'green' : 'amber'}>OCR: {caps.ocr.available ? `Tesseract ${caps.ocr.version}` : 'not installed – type/paste text'}</Badge>
          {caps.ocr.missing_languages?.length > 0 && <Badge tone="amber">missing language packs: {caps.ocr.missing_languages.join(', ')}</Badge>}
          <Badge tone={caps.script_model.available ? 'green' : 'amber'}>Script ID model {caps.script_model.available ? 'loaded' : 'missing'}</Badge>
          {caps.handwriting_model && <Badge tone={caps.handwriting_model.available ? 'green' : 'amber'}>Handwriting model {caps.handwriting_model.available ? 'loaded' : 'not trained yet'}</Badge>}
          <Badge tone={caps.address_model.available ? 'green' : 'amber'}>Address parser: {caps.address_model.engine}</Badge>
          <Badge>LLM normaliser: {caps.llm.provider}</Badge>
        </div>
      )}
      <Card title="Unfinished drafts (resume)">
        {drafts.length === 0 ? <p className="text-sm text-slate-500">No open drafts.</p> : (
          <ul className="divide-y divide-slate-100">
            {drafts.map((d) => (
              <li key={d._id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <Link className="link" to={`/counter/${d._id}`}>{d._id}</Link>{' '}
                  {d.recipient?.name || <em className="text-slate-500">no recipient yet</em>}
                  {d.recipient?.city ? `, ${d.recipient.city}` : ''}
                </span>
                <span className="flex gap-2">
                  <Badge>{d.experiment_config}</Badge>
                  {d.fields_confirmed_at && <Badge tone="green">fields confirmed</Badge>}
                  {d.weight && <Badge tone="green">{d.weight.grams} g</Badge>}
                  <span className="text-xs text-slate-500">{fmtTime(d.updated_at)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
