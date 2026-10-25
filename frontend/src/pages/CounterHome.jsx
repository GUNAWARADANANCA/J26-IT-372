import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import Icon from '../components/icons.jsx'
import { INTAKE_STEPS, intakeProgress } from '../components/IntakeProgress.jsx'
import { Badge, Button, Card, EmptyState, ErrorBox, PageHeader, fmtTime } from '../components/ui.jsx'

export default function CounterHome() {
  const navigate = useNavigate()
  const [drafts, setDrafts] = useState(null)
  const [caps, setCaps] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    api('/api/intake/drafts').then(setDrafts).catch((e) => { setError(e); setDrafts([]) })
    api('/api/intake/capabilities').then(setCaps).catch(() => {})
  }, [])

  async function start() {
    setBusy(true)
    try {
      const d = await api('/api/intake/drafts', { method: 'POST' })
      navigate(`/counter/${d._id}`)
    } catch (e) { setError(e) } finally { setBusy(false) }
  }

  // Same as "Cancel draft" inside the wizard: the draft is marked cancelled (kept for the audit log)
  // and its scale reading is released, so it no longer shows up here.
  async function remove(d) {
    const label = d.recipient?.name ? `${d._id} (${d.recipient.name})` : d._id
    if (!window.confirm(`Delete draft ${label}? The scale reading is released.`)) return
    setDeleting(d._id)
    setError(null)
    try {
      await api(`/api/intake/drafts/${d._id}/cancel`, { method: 'POST' })
      setDrafts((list) => list.filter((x) => x._id !== d._id))
    } catch (e) {
      // 409: already cancelled or registered elsewhere (another tab or counter) - just refresh the list
      if (e.status === 409) api('/api/intake/drafts').then(setDrafts).catch(setError)
      else setError(e)
    } finally { setDeleting(null) }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Counter intake" subtitle="Register domestic registered letters of 5–500 g, weighed on the IoT scale."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Counter intake' }]}
        actions={<Button icon="plus" busy={busy} onClick={start}>Register a new letter</Button>} />
      <ErrorBox error={error} />

      <section aria-labelledby="how" className="rounded-lg border border-line bg-white p-5">
        <h2 id="how" className="text-sm font-semibold text-brand-900">How a registration works</h2>
        <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {INTAKE_STEPS.map(([icon, title, text], i) => (
            <li key={title} className="flex gap-3 rounded-md bg-slate-50 p-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-700 text-xs font-bold text-white">{i + 1}</span>
              <span className="text-xs text-slate-600">
                <b className="flex items-center gap-1.5 text-sm text-slate-900"><Icon name={icon} className="h-3.5 w-3.5 text-brand-700" />{title}</b>
                {text}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-slate-500">Your work is saved as you go. You can leave a draft and resume it later from the list below.</p>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Unfinished drafts" description="Registrations started but not yet accepted. Resume to finish, or delete if no longer needed."
          className="xl:col-span-2" padded={false}>
          {drafts === null ? <p className="p-5 text-sm text-slate-500">Loading drafts…</p> : drafts.length === 0 ? (
            <EmptyState icon="inbox" title="No unfinished drafts" action={<Button tone="secondary" icon="plus" busy={busy} onClick={start}>Register a new letter</Button>}>
              Every registration started at this office has been completed or cancelled.
            </EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="rows-hover w-full text-sm">
                <thead><tr><th>Draft</th><th>Recipient</th><th>Progress</th><th>Last saved</th><th className="text-right!">Actions</th></tr></thead>
                <tbody>
                  {drafts.map((d) => {
                    const progress = intakeProgress(d)
                    const done = progress.filter(Boolean).length
                    return (
                      <tr key={d._id} className="border-t">
                        <td className="whitespace-nowrap">
                          <Link className="link font-mono" to={`/counter/${d._id}`}>{d._id}</Link>
                          <span className="mt-0.5 block"><Badge title="Experiment configuration">{d.experiment_config}</Badge></span>
                        </td>
                        <td>
                          {d.recipient?.name || <em className="text-slate-500">not entered yet</em>}
                          {d.recipient?.city && <span className="block text-xs text-slate-500">{d.recipient.city}</span>}
                        </td>
                        <td>
                          <div className="flex items-center gap-1" aria-label={`${done} of 5 steps done`}>
                            {progress.map((ok, i) => (
                              <span key={i} title={`${INTAKE_STEPS[i][1]}: ${ok ? 'done' : 'not done'}`}
                                className={`h-1.5 w-5 rounded-full ${ok ? 'bg-emerald-600' : 'bg-slate-200'}`} />
                            ))}
                          </div>
                          <span className="mt-1 block text-xs text-slate-600">
                            {done} of 5 · {d.weight ? `${d.weight.grams} g` : 'not weighed'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap text-xs text-slate-600">{fmtTime(d.updated_at)}</td>
                        <td>
                          <span className="flex justify-end gap-2">
                            <Button size="sm" tone="secondary" icon="play" onClick={() => navigate(`/counter/${d._id}`)}>Resume</Button>
                            <Button size="sm" tone="danger-outline" icon="trash"
                              busy={deleting === d._id} disabled={deleting !== null} onClick={() => remove(d)}
                              aria-label={`Delete draft ${d._id}`} title="Delete draft">Delete</Button>
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Reading aids" description="Tools that suggest address fields. If one is missing, type the address instead.">
          {!caps ? <p className="text-sm text-slate-500">Checking…</p> : (
            <ul className="divide-y divide-slate-100 text-sm">
              <Capability name="Text reader (OCR)" ok={caps.ocr.available}
                detail={caps.ocr.available ? `Tesseract ${caps.ocr.version}` : 'Not installed – type or paste the address'} />
              {caps.ocr.missing_languages?.length > 0 && (
                <Capability name="Language packs" ok={false} detail={`Missing: ${caps.ocr.missing_languages.join(', ')}`} />
              )}
              <Capability name="Script detection" ok={caps.script_model.available}
                detail={caps.script_model.available ? 'Sinhala / Tamil / English model loaded' : 'Model missing – choose the script by hand'} />
              {caps.handwriting_model && (
                <Capability name="Handwriting reader" ok={caps.handwriting_model.available}
                  detail={caps.handwriting_model.available ? 'Model loaded' : 'Not trained yet – printed text only'} />
              )}
              <Capability name="Address parser" ok={caps.address_model.available} detail={`Engine: ${caps.address_model.engine}`} />
              <Capability name="Language normaliser" ok={null} detail={`Provider: ${caps.llm.provider}`} />
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function Capability({ name, ok, detail }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <span>
        <span className="block font-medium text-slate-900">{name}</span>
        <span className="text-xs text-slate-600">{detail}</span>
      </span>
      {ok === null ? <Badge>Optional</Badge> : ok ? <Badge tone="green" dot>Ready</Badge> : <Badge tone="amber" dot>Not available</Badge>}
    </li>
  )
}
