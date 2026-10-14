import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { Alert, Badge, Button, Card, Field, inputClass } from './ui.jsx'

// eslint-disable-next-line react-refresh/only-export-components
export const FIELDS = [
  ['name', 'Name'],
  ['house_number', 'House / unit no.'],
  ['street', 'Street / road'],
  ['locality', 'Village / locality'],
  ['city', 'Postal town'],
  ['postcode', 'Postcode'],
  ['region', 'District / province'],
]

// Officer-confirmed fields are edited here. OCR/parser suggestions are shown
// beside them (never silently merged), and low-confidence fields are highlighted.
export default function AddressBlock({ title, party, value, suggestion, onChange, disabled }) {
  const conf = suggestion?.confidence || {}
  const review = new Set(suggestion?.needs_review || [])
  const [check, setCheck] = useState(null)

  useEffect(() => {
    if (!value.city && !value.postcode) return
    const t = setTimeout(() => {
      api(`/api/intake/address-check?city=${encodeURIComponent(value.city || '')}&postcode=${encodeURIComponent(value.postcode || '')}`)
        .then(setCheck).catch(() => setCheck(null))
    }, 500)
    return () => clearTimeout(t)
  }, [value.city, value.postcode])

  const setField = (k, v) => onChange({ ...value, [k]: v })
  const status = check?.city_postcode?.status

  return (
    <Card title={title} actions={suggestion?.fields && (
      <Button tone="secondary" disabled={disabled} onClick={() => onChange({ ...value, ...nonEmpty(suggestion.fields) })}>
        Use all suggestions
      </Button>
    )}>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map(([k, label]) => {
          const s = suggestion?.fields?.[k]
          const flagged = review.has(k)
          const differs = s && s !== value[k]
          return (
            <Field key={k} label={<span className={flagged ? 'text-red-700' : ''}>{label}</span>}>
              <span className="relative block">
                <input className={`${inputClass} ${conf[k] !== undefined ? 'pr-14' : ''} ${flagged ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                  value={value[k] || ''} disabled={disabled} lang="si" onChange={(e) => setField(k, e.target.value)} aria-describedby={`${party}-${k}-s`} />
                {conf[k] !== undefined && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2">
                    <Badge tone={flagged ? 'red' : 'blue'} title="model confidence">{Math.round(conf[k] * 100)}%</Badge>
                  </span>
                )}
              </span>
              {flagged && <span className="mt-1 block text-xs font-medium text-red-700">Low confidence – check against the envelope.</span>}
              {differs && (
                <span id={`${party}-${k}-s`} className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                  Suggested: <q className="font-medium">{s}</q>
                  <button type="button" className="link" disabled={disabled} onClick={() => setField(k, s)}>use</button>
                </span>
              )}
            </Field>
          )
        })}
      </div>
      {suggestion?.derived?.postcode && !value.postcode && (
        <div className="mt-3">
          <Alert tone="blue">
            Postcode {suggestion.derived.postcode.value} can be derived ({suggestion.derived.postcode.reason}).{' '}
            <button type="button" className="underline" onClick={() => setField('postcode', suggestion.derived.postcode.value)}>Use it</button>
          </Alert>
        </div>
      )}
      {status && status !== 'consistent' && status !== 'incomplete' && (
        <div className="mt-3">
          <Alert tone="amber" title={`Town / postcode check: ${status.replace('_', ' ')}`}>
            {check.city_postcode.detail}
            {check.city_postcode.candidates?.length > 0 && <> · expected: {check.city_postcode.candidates.join(', ')}</>}
          </Alert>
        </div>
      )}
      {status === 'consistent' && <p className="mt-2 text-xs text-green-700">✓ Town and postcode agree with the gazetteer.</p>}
    </Card>
  )
}

function nonEmpty(fields) {
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v))
}
