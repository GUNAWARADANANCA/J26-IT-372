import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.js'
import AddressBlock from '../components/AddressBlock.jsx'
import ImagePanel from '../components/ImagePanel.jsx'
import { Alert, Badge, Button, Card, ErrorBox, Field, Money, PageHeader, Spinner, inputClass } from '../components/ui.jsx'
import WeightPanel from '../components/WeightPanel.jsx'

const CONFIGS = {
  B0: 'B0 – manual entry (baseline)',
  B1: 'B1 – basic OCR + rules',
  P1: 'P1 – assisted capture (quality gate, script ID, trained parser)',
}

export default function IntakeWizard() {
  const { draftId } = useParams()
  const navigate = useNavigate()
  const [draft, setDraft] = useState(null)
  const [form, setForm] = useState(null)
  const [devices, setDevices] = useState([])
  const [offices, setOffices] = useState([])
  const [saving, setSaving] = useState('')
  const [error, setError] = useState(null)
  const [quote, setQuote] = useState(null)
  const [services, setServices] = useState({ advice_of_delivery: false, insured_value_lkr: '' })
  const [payment, setPayment] = useState({ method: 'cash', reference: '' })
  const [busy, setBusy] = useState('')
  const dirty = useRef(false)

  const applyDraft = useCallback((d) => {
    setDraft(d)
    setForm((f) => (f && dirty.current ? f : {
      sender: d.sender || {}, recipient: d.recipient || {}, notification: d.notification,
      destination_office_id: d.destination_office_id || '', experiment_config: d.experiment_config,
    }))
    if (d.quote) setQuote(d.quote)
    return d
  }, [])

  const reload = useCallback(() => api(`/api/intake/drafts/${draftId}`).then(applyDraft), [draftId, applyDraft])

  useEffect(() => {
    api(`/api/intake/drafts/${draftId}`).then(applyDraft).catch(setError)
    api('/api/devices').then(setDevices).catch(() => setDevices([]))
    api('/api/admin/offices').then(setOffices).catch(() => setOffices([]))
  }, [draftId, applyDraft])

  // Debounced autosave of the editable fields (drafts can be resumed later, FR02).
  useEffect(() => {
    if (!form || !dirty.current || draft?.status !== 'draft') return
    setSaving('saving')
    const t = setTimeout(async () => {
      try {
        const d = await api(`/api/intake/drafts/${draftId}`, { method: 'PATCH', body: form })
        dirty.current = false
        setDraft(d)
        setSaving('saved')
      } catch (e) { setError(e); setSaving('') }
    }, 600)
    return () => clearTimeout(t)
  }, [form, draftId, draft?.status])

  const edit = (patch) => { dirty.current = true; setForm((f) => ({ ...f, ...patch })) }

  async function act(label, fn) {
    setBusy(label)
    setError(null)
    try { return await fn() } catch (e) { setError(e) } finally { setBusy('') }
  }

  // Suggestion from OCR/parser: offer it, and fill only empty fields.
  const applySuggestion = (target, parse) => {
    reload()
    const current = form[target] || {}
    const filled = { ...current }
    for (const [k, v] of Object.entries(parse.fields || {})) if (v && !current[k]) filled[k] = v
    edit({ [target]: filled })
    if (target === 'recipient' && parse.fields?.postcode && !form.destination_office_id) suggestOffice(parse.fields.postcode, parse.fields.city)
  }

  const suggestOffice = async (postcode, city) => {
    const list = await api(`/api/intake/offices/suggest?postcode=${encodeURIComponent(postcode || '')}&city=${encodeURIComponent(city || '')}`)
    if (list.length === 1) edit({ destination_office_id: list[0]._id })
  }

  const confirm = () => act('confirm', async () => {
    if (dirty.current) {
      await api(`/api/intake/drafts/${draftId}`, { method: 'PATCH', body: form })
      dirty.current = false
    }
    await api(`/api/intake/drafts/${draftId}/confirm-fields`, { method: 'POST', body: { confirmed_fields: ['sender', 'recipient', 'notification'] } })
    await reload()
  })

  const getQuote = () => act('quote', async () => {
    const q = await api(`/api/intake/drafts/${draftId}/quote`, {
      method: 'POST', body: { advice_of_delivery: services.advice_of_delivery, insured_value_lkr: services.insured_value_lkr ? Number(services.insured_value_lkr) : null },
    })
    setQuote(q)
  })

  const accept = () => act('accept', async () => {
    const res = await api(`/api/intake/drafts/${draftId}/accept`, {
      method: 'POST', body: { quote_id: quote.quote_id, payment: { method: payment.method, amount_lkr: quote.total_lkr, reference: payment.reference } },
    })
    navigate(`/items/${res.item.tracking_id}/print`)
  })

  // Empties the address, destination and contact fields (auto-filled or typed) so the officer can start over.
  const clearForm = () => {
    if (!window.confirm('Clear the recipient, sender, destination office and contact fields?')) return
    edit({ sender: {}, recipient: {}, destination_office_id: '', notification: { ...form.notification, contact: '' } })
    setQuote(null)
  }

  const cancel = () => act('cancel', async () => {
    if (!window.confirm('Cancel this draft? The scale reading is released.')) return
    await api(`/api/intake/drafts/${draftId}/cancel`, { method: 'POST' })
    navigate('/counter')
  })

  if (!draft || !form) return error ? <ErrorBox error={error} /> : <Spinner />
  if (draft.status === 'committed') {
    return <Alert tone="green" title="Already accepted">This draft became item {draft.item_id}. <a className="underline" href={`/items/${draft.item_id}`}>Open item</a></Alert>
  }
  const locked = draft.status !== 'draft'
  const confirmed = Boolean(draft.fields_confirmed_at)
  const config = form.experiment_config || 'P1'
  const n = form.notification || {}

  return (
    <div className="space-y-4">
      <PageHeader title={`Registered letter intake · ${draft._id}`}
        subtitle={<>Started {new Date(draft.created_at).toLocaleTimeString()} · {saving === 'saving' ? 'saving…' : saving === 'saved' ? 'all changes saved' : ''}</>}
        actions={<>
          <ConfidenceTile suggestion={draft.suggestions?.recipient} run={draft.ocr_runs?.at(-1)} />
          <select aria-label="Experiment configuration" className={inputClass} value={config} onChange={(e) => edit({ experiment_config: e.target.value })}>
            {Object.entries(CONFIGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <Button tone="secondary" disabled={locked} onClick={clearForm}>Clear form</Button>
          <Button tone="secondary" busy={busy === 'cancel'} onClick={cancel}>Cancel draft</Button>
        </>} />
      <ErrorBox error={error} />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <ImagePanel draft={draft} devices={devices} config={config} onSuggestion={applySuggestion} reload={reload} />
        </div>

        <div className="space-y-4 lg:col-span-3">
          <AddressBlock title="2a · Recipient (to)" party="recipient" value={form.recipient} suggestion={draft.suggestions?.recipient}
            onChange={(v) => edit({ recipient: v })} disabled={locked} />
          <AddressBlock title="2b · Sender (from)" party="sender" value={form.sender} suggestion={draft.suggestions?.sender}
            onChange={(v) => edit({ sender: v })} disabled={locked} />

          <Card title="3 · Destination office and sender updates">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Destination delivery office">
                <select className={inputClass} value={form.destination_office_id} onChange={(e) => edit({ destination_office_id: e.target.value })}>
                  <option value="">— choose —</option>
                  {offices.map((o) => <option key={o._id} value={o._id}>{o.name} ({o.postcode})</option>)}
                </select>
              </Field>
              <Field label="Send status updates by">
                <select className={inputClass} value={n.channel} onChange={(e) => edit({ notification: { ...n, channel: e.target.value } })}>
                  <option value="none">No messages (receipt only)</option>
                  <option value="email">E-mail</option>
                  <option value="sms">SMS (only if a gateway is approved)</option>
                </select>
              </Field>
              {n.channel !== 'none' && (
                <>
                  <Field label={n.channel === 'email' ? 'Sender e-mail' : 'Sender mobile (07XXXXXXXX)'}>
                    <input className={inputClass} value={n.contact} onChange={(e) => edit({ notification: { ...n, contact: e.target.value } })} />
                  </Field>
                  <Field label="Message language">
                    <select className={inputClass} value={n.language} onChange={(e) => edit({ notification: { ...n, language: e.target.value } })}>
                      <option value="en">English</option><option value="si">සිංහල</option><option value="ta">தமிழ்</option>
                    </select>
                  </Field>
                  <Field label="Which updates">
                    <select className={inputClass} value={n.updates} onChange={(e) => edit({ notification: { ...n, updates: e.target.value } })}>
                      <option value="key">Key updates only (accepted, out for delivery, delivered, problems)</option>
                      <option value="all">Every accepted scan</option>
                    </select>
                  </Field>
                </>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
              {confirmed ? (
                <Badge tone="green">Fields confirmed by {draft.confirmed_by}</Badge>
              ) : (
                <Button busy={busy === 'confirm'} onClick={confirm}>I have checked the envelope – confirm fields</Button>
              )}
              {draft.review_stats && (
                <span className="text-xs text-slate-600">
                  suggestions: {draft.review_stats.suggested} · kept {draft.review_stats.accepted_unchanged} · corrected {draft.review_stats.corrected} · typed {draft.review_stats.added_manually}
                </span>
              )}
            </div>
          </Card>

          <WeightPanel draft={draft} devices={devices} onChange={reload} disabled={locked} />

          <Card title="5 · Quote, payment and acceptance">
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={services.advice_of_delivery} onChange={(e) => setServices({ ...services, advice_of_delivery: e.target.checked })} />
                  Advice of delivery (+Rs. 100)
                </label>
                <Field label="Insured value (Rs., optional)">
                  <input className={inputClass} type="number" min="0" max="25000" value={services.insured_value_lkr}
                    onChange={(e) => setServices({ ...services, insured_value_lkr: e.target.value })} />
                </Field>
                <Button tone="secondary" busy={busy === 'quote'} disabled={!draft.weight} onClick={getQuote}>Calculate charge</Button>
              </div>
              {quote && <QuoteView quote={quote} />}
              {quote?.status === 'ok' && (
                <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
                  <Field label="Payment method">
                    <select className={inputClass} value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })}>
                      <option value="cash">Cash</option><option value="card">Card</option><option value="other">Other (approved)</option>
                    </select>
                  </Field>
                  <Field label="Receipt / reference (optional)">
                    <input className={inputClass} value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} />
                  </Field>
                  <Button busy={busy === 'accept'} disabled={!confirmed} onClick={accept}>
                    Received <Money value={quote.total_lkr} /> – accept &amp; print label
                  </Button>
                  {!confirmed && <span className="text-xs text-amber-800">Confirm the fields first.</span>}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

// Mean confidence of the address parser over the recipient fields it suggested (not a measure of OCR accuracy).
function ConfidenceTile({ suggestion, run }) {
  const values = Object.values(suggestion?.confidence || {})
  if (values.length === 0) return null
  const mean = Math.round((100 * values.reduce((a, b) => a + b, 0)) / values.length)
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-1.5" title="Mean confidence of the address parser for the recipient fields">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Field confidence</p>
        <p className="text-xl font-bold leading-tight tabular-nums text-brand-900">{mean}%</p>
      </div>
      <div className="flex flex-col items-start gap-1">
        {suggestion.needs_review?.length > 0 ? <Badge tone="amber">needs review</Badge> : <Badge tone="green">no flags</Badge>}
        {run?.reader === 'handwriting' ? <Badge tone="purple">handwriting model</Badge> : run?.script?.script && <Badge>{run.script.script}</Badge>}
      </div>
    </div>
  )
}

function QuoteView({ quote }) {
  if (quote.status !== 'ok') {
    return (
      <Alert tone="amber" title={quote.status === 'reweigh_required' ? 'Reweigh required' : 'Cannot quote'}>
        {quote.reasons.map((r) => <p key={r.code}>{r.message}</p>)}
      </Alert>
    )
  }
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <table className="w-full text-sm">
        <caption className="px-3 py-2 text-left text-xs text-slate-600">
          Tariff {quote.tariff_version} {quote.approval_status !== 'approved' && <Badge tone="amber">{quote.approval_status} – research use</Badge>} ·
          weight {quote.weight_g} g ± {quote.uncertainty_g} g
        </caption>
        <tbody>
          {quote.lines.map((l) => (
            <tr key={l.code} className="border-t border-slate-100">
              <td className="px-3 py-1.5">{l.label}</td><td className="px-3 py-1.5 text-right"><Money value={l.amount_lkr} /></td>
            </tr>
          ))}
          <tr className="border-t-2 border-brand-200 bg-brand-50 font-bold text-brand-900">
            <td className="px-3 py-2">Total</td><td className="px-3 py-2 text-right"><Money value={quote.total_lkr} /></td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
