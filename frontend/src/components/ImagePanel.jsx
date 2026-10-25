import { useEffect, useRef, useState } from 'react'
import { api, imageUrl } from '../api.js'
import Icon from './icons.jsx'
import { Alert, Badge, Button, Card, ErrorBox, Field, inputClass } from './ui.jsx'

// Envelope image: capture (ESP32-CAM on the scale, webcam or file), crop/rotate, then OCR or typed text.
export default function ImagePanel({ draft, devices, config, onSuggestion, reload, stepProps }) {
  const [src, setSrc] = useState(null)          // object URL of the stored image
  const [preview, setPreview] = useState(null)  // rotated preview (data URL)
  const [rotate, setRotate] = useState(0)
  const [crop, setCrop] = useState(null)
  const [target, setTarget] = useState('recipient')
  const [scriptHint, setScriptHint] = useState('auto')
  const [writing, setWriting] = useState('auto')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState(null)
  const [quality, setQuality] = useState(null)
  const [ocr, setOcr] = useState(null)
  const [typed, setTyped] = useState('')
  const [webcam, setWebcam] = useState(false)
  const deviceId = devices[0]?.device_id
  const mode = config === 'B1' ? 'B1' : 'P1'

  useEffect(() => {
    let url
    if (draft.current_image_id) imageUrl(draft.current_image_id).then((u) => { url = u; setSrc(u) }).catch(setError)
    return () => url && URL.revokeObjectURL(url)
  }, [draft.current_image_id])

  // Render the rotated preview on a canvas so the crop box matches what the server crops.
  useEffect(() => {
    if (!src) return
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      const swap = rotate % 180 !== 0
      c.width = swap ? img.height : img.width
      c.height = swap ? img.width : img.height
      const ctx = c.getContext('2d')
      ctx.translate(c.width / 2, c.height / 2)
      ctx.rotate((rotate * Math.PI) / 180)
      ctx.drawImage(img, -img.width / 2, -img.height / 2)
      setPreview(c.toDataURL('image/jpeg', 0.85))
    }
    img.src = src
  }, [src, rotate])

  async function run(label, fn) {
    setBusy(label)
    setError(null)
    try { await fn() } catch (e) { setError(e) } finally { setBusy('') }
  }

  const upload = (blob) => run('upload', async () => {
    const form = new FormData()
    form.append('file', blob, 'envelope.jpg')
    const res = await api(`/api/intake/drafts/${draft._id}/image`, { method: 'POST', form })
    setQuality(res.quality)
    setCrop(null)
    setRotate(0)
    await reload()
  })

  const captureFromScale = () => run('capture', async () => {
    const { capture_id } = await api(`/api/intake/drafts/${draft._id}/capture`, { method: 'POST', body: { device_id: deviceId } })
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 700))
      const s = await api(`/api/intake/captures/${capture_id}`)
      if (s.status === 'received') { setQuality(s.quality); setCrop(null); setRotate(0); await reload(); return }
      if (s.status === 'failed' || s.status === 'expired') throw new Error(`Camera capture ${s.status}${s.error ? ': ' + s.error : ''}. Check the scale is online (IoT scale page).`)
    }
    throw new Error('Camera did not answer in time')
  })

  const runOcr = () => run('ocr', async () => {
    const res = await api(`/api/intake/drafts/${draft._id}/ocr`, {
      method: 'POST', body: { mode, target, crop, rotate, script_hint: scriptHint, writing },
    })
    setOcr(res)
    onSuggestion(target, res.parse)
  })

  const parseTyped = () => run('parse', async () => {
    const res = await api(`/api/intake/drafts/${draft._id}/parse/${target}`, { method: 'POST', body: { text: typed } })
    setOcr({ text: typed, parse: res, mode: 'typed' })
    onSuggestion(target, res)
  })

  return (
    <Card title="Envelope image" description={config === 'B0' ? 'Optional in manual entry (B0).' : 'Photograph the front of the envelope.'} {...stepProps}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {deviceId && <Button size="sm" icon="camera" busy={busy === 'capture'} onClick={captureFromScale}>Capture from scale camera</Button>}
          <Button size="sm" tone="secondary" icon="eye" onClick={() => setWebcam((w) => !w)}>{webcam ? 'Close webcam' : 'Use webcam'}</Button>
          <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-brand-300 bg-white px-2.5 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-50 focus-within:outline-3 focus-within:outline-brand-500 ${busy === 'upload' ? 'opacity-60' : ''}`}>
            <Icon name="upload" className="h-3.5 w-3.5" /> Upload photo
            <input type="file" accept="image/jpeg,image/png" className="sr-only" onChange={(e) => e.target.files[0] && upload(e.target.files[0])} />
          </label>
        </div>
        <ErrorBox error={error} />
        {webcam && <Webcam onCapture={(blob) => { setWebcam(false); upload(blob) }} />}
        {preview ? (
          <>
            <CropBox src={preview} crop={crop} onChange={setCrop} />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Button size="sm" tone="ghost" icon="rotateLeft" onClick={() => { setRotate((r) => (r + 270) % 360); setCrop(null) }}>Rotate left</Button>
              <Button size="sm" tone="ghost" icon="rotateRight" onClick={() => { setRotate((r) => (r + 90) % 360); setCrop(null) }}>Rotate right</Button>
              <Button size="sm" tone="ghost" icon="close" onClick={() => setCrop(null)} disabled={!crop}>Clear selection</Button>
              <span className="text-xs text-slate-600">{crop ? 'Address block selected.' : 'Tip: drag over the address block to read only that part.'}</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-md border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
            <Icon name="camera" className="h-8 w-8 text-slate-400" />
            <p className="text-sm font-semibold text-slate-700">No envelope photo yet</p>
            <p className="max-w-xs text-xs text-slate-600">Place the envelope face up on the scale platform and press <b>Capture from scale camera</b>, or upload a photo.</p>
          </div>
        )}
        {quality && !quality.ok && (
          <Alert tone="amber" title="Image quality">
            <ul className="list-disc pl-5">{quality.issues.map((i) => <li key={i.code}>{i.message}</li>)}</ul>
          </Alert>
        )}

        {config !== 'B0' && (
          <div className="space-y-2 border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold text-slate-700">Read the address from the photo</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Fill fields of">
              <select className={inputClass} value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="recipient">Recipient</option>
                <option value="sender">Sender</option>
              </select>
            </Field>
            <Field label="Script" hint={mode === 'P1' ? 'auto = trained script classifier' : 'B1 uses all three packs'}>
              <select className={inputClass} value={scriptHint} disabled={mode === 'B1'} onChange={(e) => setScriptHint(e.target.value)}>
                <option value="auto">Auto-detect</option>
                <option value="si">Sinhala</option>
                <option value="ta">Tamil</option>
                <option value="en">English</option>
              </select>
            </Field>
            <Field label="Writing" hint={mode === 'P1' ? 'auto = the more confident reader' : 'B1 reads everything as print'}>
              <select className={inputClass} value={writing} disabled={mode === 'B1'} onChange={(e) => setWriting(e.target.value)}>
                <option value="auto">Auto</option>
                <option value="handwritten">Handwritten</option>
                <option value="printed">Printed</option>
              </select>
            </Field>
            <div className="flex items-end">
              <Button className="w-full" icon="scan" busy={busy === 'ocr'} disabled={!preview} onClick={runOcr}>Read address ({mode})</Button>
            </div>
          </div>
          </div>
        )}

        <details className="rounded-md border border-slate-200 px-3 py-2" open={config === 'B0'}>
          <summary className="cursor-pointer text-sm font-semibold text-brand-800">Type or paste the address text instead</summary>
          <textarea className={`${inputClass} mt-2 h-28`} lang="si" value={typed} onChange={(e) => setTyped(e.target.value)}
            placeholder={'Mr. A. B. Perera\nNo. 25/3, Galle Road\nColombo 03'} />
          {config !== 'B0' && (
            <Button tone="secondary" className="mt-2" busy={busy === 'parse'} disabled={!typed.trim()} onClick={parseTyped}>
              Split into fields ({target})
            </Button>
          )}
        </details>

        {ocr && <OcrSummary ocr={ocr} />}
      </div>
    </Card>
  )
}

function OcrSummary({ ocr }) {
  return (
    <div className="space-y-1.5 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
      <p className="font-semibold text-slate-700">Text read from the envelope</p>
      <div className="flex flex-wrap gap-2">
        {ocr.mode && <Badge tone="blue">{ocr.mode}</Badge>}
        {ocr.script?.script && <Badge>script: {ocr.script.script} ({Math.round((ocr.script.confidence || 0) * 100)}%)</Badge>}
        {ocr.reader === 'handwriting' && <Badge tone="green">handwriting model</Badge>}
        {ocr.reader !== 'handwriting' && ocr.engine?.lang && <Badge>tesseract: {ocr.engine.lang}</Badge>}
        {ocr.parse?.engine && <Badge>parser: {ocr.parse.engine}</Badge>}
        {ocr.timings?.total_ms && <Badge>{ocr.timings.total_ms} ms</Badge>}
      </div>
      {ocr.text && <pre className="whitespace-pre-wrap font-sans text-slate-700">{ocr.text}</pre>}
      {ocr.low_confidence_words?.length > 0 && (
        <p className="text-amber-800">Low-confidence words: {ocr.low_confidence_words.join(', ')}</p>
      )}
    </div>
  )
}

function CropBox({ src, crop, onChange }) {
  const ref = useRef(null)
  const start = useRef(null)
  const pos = (e) => {
    const r = ref.current.getBoundingClientRect()
    const p = e.touches ? e.touches[0] : e
    return { x: Math.min(Math.max((p.clientX - r.left) / r.width, 0), 1), y: Math.min(Math.max((p.clientY - r.top) / r.height, 0), 1) }
  }
  const down = (e) => { start.current = pos(e) }
  const move = (e) => {
    if (!start.current) return
    const p = pos(e)
    const s = start.current
    onChange({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) })
  }
  const up = () => {
    start.current = null
    if (crop && (crop.w < 0.03 || crop.h < 0.03)) onChange(null)
  }
  return (
    <div ref={ref} className="relative select-none overflow-hidden rounded border border-slate-200 touch-none"
      onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up} onTouchStart={down} onTouchMove={move} onTouchEnd={up}>
      <img src={src} alt="Envelope" className="block w-full" draggable={false} />
      {crop && (
        <div className="pointer-events-none absolute border-2 border-amber-500 bg-amber-400/15"
          style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }} />
      )}
    </div>
  )
}

function Webcam({ onCapture }) {
  const video = useRef(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    let stream
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } } })
      .then((s) => { stream = s; video.current.srcObject = s })
      .catch((e) => setError(e))
    return () => stream?.getTracks().forEach((t) => t.stop())
  }, [])
  const snap = () => {
    const v = video.current
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d').drawImage(v, 0, 0)
    c.toBlob((b) => b && onCapture(b), 'image/jpeg', 0.92)
  }
  if (error) return <Alert tone="amber" title="Webcam unavailable">{error.message}. Browsers allow the camera only on https:// or localhost.</Alert>
  return (
    <div className="space-y-2">
      <video ref={video} autoPlay playsInline muted className="w-full rounded bg-black" />
      <Button onClick={snap}>Take photo</Button>
    </div>
  )
}
