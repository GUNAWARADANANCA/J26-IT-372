import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.js'
import AddressBlock from '../components/AddressBlock.jsx'
import ImagePanel from '../components/ImagePanel.jsx'
import Icon from '../components/icons.jsx'
import { INTAKE_STEPS, IntakeStepper, intakeProgress } from '../components/IntakeProgress.jsx'
import { Alert, Badge, Button, Card, ErrorBox, Field, Loading, Money, PageHeader, Spinner, inputClass } from '../components/ui.jsx'
import WeightPanel from '../components/WeightPanel.jsx'

const CONFIGS = {
  B0: 'B0 – manual entry (baseline)',
  B1: 'B1 – basic OCR + rules',
  P1: 'P1 – assisted capture (quality gate, script ID, trained parser)',
}

// What to do next, for the first unfinished step.
const NEXT = [
  'Capture or upload a photo of the envelope. Drag over the address block, then press "Read address".',
  'Check the recipient and sender fields against the envelope. Fields outlined in red need a closer look.',
  'Choose the destination delivery office, then press "I have checked the envelope – confirm details".',
  'Place the letter on the scale. When the reading shows "Stable – ready", press "Use this weight".',
  'Calculate the charge, collect the payment, then accept the letter and print its label.',
]

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

  if (!draft || !form) return error ? <ErrorBox error={error} /> : <Loading>Opening draft…</Loading>
  if (draft.status === 'committed') {
    return <Alert tone="green" title="Already accepted">This draft became item {draft.item_id}. <Link className="underline" to={`/items/${draft.item_id}`}>Open item</Link></Alert>
  }
  const locked = draft.status !== 'draft'
  const confirmed = Boolean(draft.fields_confirmed_at)
  const config = form.experiment_config || 'P1'
  const n = form.notification || {}
  const progress = intakeProgress(draft, form.recipient, config)
  const current = progress.findIndex((ok) => !ok)
  const stepProps = (i) => ({ step: i + 1, done: progress[i], current: current === i, id: INTAKE_STEPS[i][3] })

  return (
    <div className="space-y-4">
      <PageHeader title="Register a letter"
        breadcrumbs={[{ label: 'Counter intake', to: '/counter' }, { label: `Draft ${draft._id}` }]}
        subtitle={<span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Draft <b className="font-mono text-slate-800">{draft._id}</b> · started {new Date(draft.created_at).toLocaleTimeString()}</span>
          {locked ? <Badge tone="slate">{draft.status}</Badge> : <SaveState saving={saving} />}
        </span>}
        actions={<>
          <ConfidenceTile suggestion={draft.suggestions?.recipient} run={draft.ocr_runs?.at(-1)} />
          <label className="text-xs font-semibold text-slate-600">
            <span className="mb-1 block">Capture mode</span>
            <select aria-label="Experiment configuration" className={`${inputClass} py-1.5`} value={config} onChange={(e) => edit({ experiment_config: e.target.value })}>
              {Object.entries(CONFIGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <Button tone="secondary" icon="refresh" disabled={locked} onClick={clearForm}>Clear form</Button>
          <Button tone="danger-outline" icon="xcircle" busy={busy === 'cancel'} onClick={cancel}>Cancel draft</Button>
        </>} />
      <IntakeStepper progress={progress} />
      {!locked && current >= 0 && (
        <div className="flex items-start gap-3 rounded-md border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-950" role="status">
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-700 text-xs font-bold text-white">{current + 1}</span>
          <p><b>Next: {INTAKE_STEPS[current][1].toLowerCase()}.</b> {NEXT[current]}</p>
        </div>
      )}
      <ErrorBox error={error} />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <ImagePanel draft={draft} devices={devices} config={config} onSuggestion={applySuggestion} reload={reload} stepProps={stepProps(0)} />
        </div>

        <div className="space-y-4 lg:col-span-3">
          <AddressBlock title="Recipient (to)" party="recipient" value={form.recipient} suggestion={draft.suggestions?.recipient}
            onChange={(v) => edit({ recipient: v })} disabled={locked}
            stepProps={{ ...stepProps(1), description: 'Who the letter is addressed to. Name and postal town are needed.' }} />
          <AddressBlock title="Sender (from)" party="sender" value={form.sender} suggestion={draft.suggestions?.sender}
            onChange={(v) => edit({ sender: v })} disabled={locked}
            stepProps={{ step: 2, done: progress[1], id: 'step-sender', description: 'Who is posting the letter (printed on the receipt).' }} />

          <Card title="Destination office and sender updates" description="Where the letter goes, and how the sender hears about it." {...stepProps(2)}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Destination delivery office" required>
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
                  <Field label={n.channel === 'email' ? 'Sender e-mail' : 'Sender mobile'} hint={n.channel === 'sms' ? 'Format: 07XXXXXXXX' : undefined}>
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
                <span className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><Icon name="check" /> Details confirmed by {draft.confirmed_by}</span>
              ) : (
                <Button icon="check" busy={busy === 'confirm'} onClick={confirm}>I have checked the envelope – confirm details</Button>
              )}
              {draft.review_stats && (
                <span className="text-xs text-slate-600" title="How the suggested fields were used">
                  Suggested {draft.review_stats.suggested} · kept {draft.review_stats.accepted_unchanged} · corrected {draft.review_stats.corrected} · typed {draft.review_stats.added_manually}
                </span>
              )}
            </div>
          </Card>

          <WeightPanel draft={draft} devices={devices} onChange={reload} disabled={locked} stepProps={stepProps(3)} />

          <Card title="Charge, payment and acceptance" description="The charge follows the tariff for the recorded weight." {...stepProps(4)}>
            <div className="space-y-4">
              <fieldset>
                <legend className="mb-2 text-xs font-semibold text-slate-700">Extra services</legend>
                <div className="flex flex-wrap items-end gap-4">
                  <label className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm">
                    <input type="checkbox" checked={services.advice_of_delivery} onChange={(e) => setServices({ ...services, advice_of_delivery: e.target.checked })} />
                    Advice of delivery (+Rs. 100)
                  </label>
                  <Field label="Insured value (Rs.)" optional>
                    <input className={inputClass} type="number" min="0" max="25000" value={services.insured_value_lkr}
                      onChange={(e) => setServices({ ...services, insured_value_lkr: e.target.value })} />
                  </Field>
                  <Button tone="secondary" icon="report" busy={busy === 'quote'} disabled={!draft.weight} onClick={getQuote}>Calculate charge</Button>
                </div>
                {!draft.weight && <p className="mt-2 text-xs text-slate-600">Record the weight in step 4 to calculate the charge.</p>}
              </fieldset>
              {quote && <QuoteView quote={quote} />}
              <Checklist items={[
                ['Details confirmed (step 3)', confirmed],
                ['Weight recorded (step 4)', Boolean(draft.weight)],
                ['Charge calculated', quote?.status === 'ok'],
              ]} />
              {quote?.status === 'ok' && (
                <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
                  <Field label="Payment method">
                    <select className={inputClass} value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })}>
                      <option value="cash">Cash</option><option value="card">Card</option><option value="other">Other (approved)</option>
                    </select>
                  </Field>
                  <Field label="Receipt / reference" optional>
                    <input className={inputClass} value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} />
                  </Field>
                  <Button icon="printer" busy={busy === 'accept'} disabled={!confirmed} onClick={accept}>
                    Received <Money value={quote.total_lkr} /> – accept &amp; print label
                  </Button>
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

function SaveState({ saving }) {
  if (saving === 'saving') return <span className="flex items-center gap-1.5 text-xs text-slate-600"><Spinner small /> Saving…</span>
  if (saving === 'saved') return <span className="flex items-center gap-1.5 text-xs text-emerald-700"><Icon name="tick" className="h-3.5 w-3.5" /> All changes saved</span>
  return <span className="text-xs text-slate-500">Changes save automatically</span>
}

// What must be true before the letter can be accepted.
function Checklist({ items }) {
  return (
    <ul className="grid gap-1.5 rounded-md bg-slate-50 p-3 text-sm sm:grid-cols-3" aria-label="Before accepting">
      {items.map(([label, ok]) => (
        <li key={label} className={`flex items-center gap-2 ${ok ? 'text-emerald-800' : 'text-slate-600'}`}>
          {ok
            ? <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-600 text-white"><Icon name="tick" className="h-3 w-3" /></span>
            : <span className="h-5 w-5 rounded-full border-2 border-slate-300" aria-hidden />}
          <span>{label}<span className="sr-only">{ok ? ': done' : ': not done'}</span></span>
        </li>
      ))}
    </ul>
  )
}
