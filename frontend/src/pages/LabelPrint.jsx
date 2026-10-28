import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'
import Icon from '../components/icons.jsx'
import { Alert, Button, ErrorBox, Loading, Money, inputClass } from '../components/ui.jsx'

// Label for the envelope + sender receipt. Both codes contain only the tracking
// ID (receipt QR = tracking link); nothing personal is encoded (NFR06).
export default function LabelPrint() {
  const { trackingId } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [scan, setScan] = useState('')
  const [verified, setVerified] = useState(null)

  useEffect(() => { api(`/api/items/${trackingId}/label`).then(setData).catch(setError) }, [trackingId])

  async function print() {
    setError(null)
    try {
      const reprint = data.label.prints > 0
      const reason = reprint ? window.prompt('Reason for reprint (e.g. printer jam)') : null
      if (reprint && !reason) return
      await api(`/api/items/${trackingId}/label/printed`, { method: 'POST', body: reprint ? { reason } : undefined })
      window.print()
      setData(await api(`/api/items/${trackingId}/label`))
    } catch (e) { setError(e) }
  }

  async function verify(e) {
    e.preventDefault()
    try {
      await api(`/api/items/${trackingId}/label/verify`, { method: 'POST', body: { scanned_value: scan } })
      setVerified(true)
    } catch (err) { setVerified(false); setError(err) }
  }

  if (!data) return error ? <div className="p-4"><ErrorBox error={error} /></div> : <Loading>Preparing label…</Loading>
  const r = data.recipient
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="no-print space-y-4">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-slate-600">
          <Link to="/counter" className="font-medium text-brand-700 hover:underline">Counter intake</Link>
          <Icon name="chevron" className="h-3 w-3 text-slate-400" />
          <Link to={`/items/${trackingId}`} className="font-medium text-brand-700 hover:underline">{trackingId}</Link>
          <Icon name="chevron" className="h-3 w-3 text-slate-400" />
          <span aria-current="page">Label &amp; receipt</span>
        </nav>
        <div className="rounded-lg border border-line bg-white p-5">
          <h1 className="text-xl font-bold text-brand-900">Label and receipt</h1>
          <p className="text-sm text-slate-600">The letter is registered. Finish these steps before handing the receipt to the sender.</p>
          <ol className="mt-4 grid gap-4 md:grid-cols-3">
            <li className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Done ok={data.label.prints > 0} n={1} /> Print the label and receipt
              </p>
              <Button icon="printer" onClick={print}>{data.label.prints > 0 ? 'Reprint label & receipt' : 'Print label & receipt'}</Button>
              {data.label.prints > 0 && <p className="text-xs text-slate-500">Printed {data.label.prints} time(s). A reprint asks for a reason.</p>}
            </li>
            <li className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Done ok={verified === true || Boolean(data.label.verified_at)} n={2} /> Scan the printed barcode</p>
              <form onSubmit={verify} className="flex items-center gap-2">
                <input className={inputClass} aria-label="Scanned barcode value" placeholder="Scan the label barcode" value={scan} onChange={(e) => setScan(e.target.value)} />
                <Button tone="secondary" type="submit" disabled={!scan.trim()}>Verify</Button>
              </form>
            </li>
            <li className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Done ok={false} n={3} /> Stick the label and file the letter</p>
              <p className="text-xs text-slate-600">Fix the label to the envelope, give the receipt to the sender and place the letter in the dispatch tray.</p>
            </li>
          </ol>
        </div>
        <ErrorBox error={error} />
        {verified && <Alert tone="green" title="Label verified">The printed code reads back as {trackingId}. Place the letter in the dispatch tray.</Alert>}
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Print preview</p>
      </div>

      <section className="print-area rounded-lg border-2 border-black bg-white p-4" aria-label="Envelope label">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-3xl font-black">R</p>
            <p className="text-xs">Registered · {data.origin_office}</p>
            <p className="text-xs">{data.accepted_local}</p>
          </div>
          <div className="h-24 w-24 shrink-0 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: data.qr_svg }} />
        </div>
        <div className="mt-2 [&_svg]:h-16 [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: data.code128_svg }} />
        <p className="text-center font-mono text-xl font-bold tracking-widest">{data.tracking_id}</p>
        <p className="mt-1 text-center text-xs">Prototype identifier – not an official postal number</p>
      </section>

      <section className="print-area rounded-lg border border-slate-300 bg-white p-4 text-sm" aria-label="Sender receipt">
        <div className="flex justify-between gap-4">
          <div className="space-y-1">
            <p className="text-lg font-bold">Receipt – registered letter</p>
            <p>Tracking ID: <b className="font-mono">{data.tracking_id}</b></p>
            <p>Accepted: {data.accepted_local} at {data.origin_office} by {data.accepted_by}</p>
            <p>From: {data.sender_name}</p>
            <p>To: {r.name}, {[r.house_number, r.street, r.locality, r.city, r.postcode].filter(Boolean).join(', ')}</p>
            <p>Destination office: {data.destination_office}</p>
            <p>Weight: {data.weight.grams} g ({data.weight.source === 'device' ? `IoT scale ${data.weight.device_id}` : 'approved scale'})</p>
          </div>
          <div className="shrink-0 text-center">
            <div className="h-28 w-28 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: data.receipt_qr_svg }} />
            <p className="text-xs">Scan to track</p>
          </div>
        </div>
        <table className="mt-3 w-full">
          <tbody>
            {data.quote.lines.map((l) => <tr key={l.code}><td>{l.label}</td><td className="text-right"><Money value={l.amount_lkr} /></td></tr>)}
            <tr className="border-t font-bold"><td>Total paid ({data.payment.method})</td><td className="text-right"><Money value={data.quote.total_lkr} /></td></tr>
          </tbody>
        </table>
        <p className="mt-2 text-xs">Tariff {data.tariff_version}. Track at: <span className="break-all">{data.tracking_link}</span></p>
        <p className="text-xs">Keep this receipt. Delivery is recorded against the approved acknowledgement procedure.</p>
      </section>
    </div>
  )
}

function Done({ ok, n }) {
  return ok
    ? <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-white"><Icon name="tick" className="h-3.5 w-3.5" /><span className="sr-only">done</span></span>
    : <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-700 text-xs font-bold text-white">{n}</span>
}
