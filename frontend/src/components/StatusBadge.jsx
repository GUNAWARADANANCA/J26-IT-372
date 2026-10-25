import Icon from './icons.jsx'
import { Badge } from './ui.jsx'

const STATUS_TONE = {
  accepted: 'blue', dispatched: 'blue', in_transit: 'blue', at_destination_office: 'blue',
  out_for_delivery: 'amber', delivery_attempted: 'amber', delivered: 'green',
  return_started: 'red', returned_to_sender: 'slate',
}

// eslint-disable-next-line react-refresh/only-export-components
export const STATUS_LABEL = {
  accepted: 'Accepted', dispatched: 'Dispatched', in_transit: 'In transit', at_destination_office: 'At destination office',
  out_for_delivery: 'Out for delivery', delivery_attempted: 'Delivery attempted', delivered: 'Delivered',
  return_started: 'Return started', returned_to_sender: 'Returned to sender',
}

export function StatusBadge({ status }) {
  return <Badge tone={STATUS_TONE[status] || 'slate'} dot>{STATUS_LABEL[status] || status}</Badge>
}

const LOC_TONE = { consistent: 'green', uncertain: 'amber', mismatch: 'red', unlocated: 'slate', not_assessed: 'slate' }
const LOC_LABEL = {
  consistent: 'Location matches', uncertain: 'Location uncertain', mismatch: 'Location mismatch',
  unlocated: 'No location sent', not_assessed: 'Location not checked',
}

// Text + colour, never colour alone (NFR08)
export function LocationBadge({ result }) {
  if (!result) return null
  return <Badge tone={LOC_TONE[result] || 'slate'} title="Scan location compared with the office reference zone">{LOC_LABEL[result] || `Location: ${result.replace('_', ' ')}`}</Badge>
}

const DECISION_TONE = { accepted: 'green', accepted_after_review: 'green', held_for_review: 'amber', rejected_after_review: 'red' }
const DECISION_LABEL = {
  accepted: 'Accepted', accepted_after_review: 'Accepted after review', held_for_review: 'Held for review', rejected_after_review: 'Rejected after review',
}

export function DecisionBadge({ decision }) {
  return <Badge tone={DECISION_TONE[decision] || 'slate'}>{DECISION_LABEL[decision] || decision?.replaceAll('_', ' ')}</Badge>
}

// Sender message (outbox) states in plain words.
// eslint-disable-next-line react-refresh/only-export-components
export const OUTBOX_LABEL = {
  queued: 'Queued', retry: 'Waiting to retry', sending: 'Sending', provider_accepted: 'Sent',
  ambiguous: 'Unclear – check', failed_permanent: 'Failed', resolved_manually: 'Resolved manually',
}
const OUTBOX_TONE = {
  queued: 'slate', retry: 'amber', sending: 'blue', provider_accepted: 'green', ambiguous: 'red', failed_permanent: 'red', resolved_manually: 'slate',
}

export function OutboxBadge({ status }) {
  return <Badge tone={OUTBOX_TONE[status] || 'amber'} dot>{OUTBOX_LABEL[status] || status.replaceAll('_', ' ')}</Badge>
}

const FORWARD = ['accepted', 'dispatched', 'in_transit', 'at_destination_office', 'out_for_delivery', 'delivered']
const RETURN = ['return_started', 'returned_to_sender']
const STEP_LABEL = { ...STATUS_LABEL, at_destination_office: 'At destination', out_for_delivery: 'Out for delivery' }

// Where the item is on its journey: completed steps are ticked, the current one is highlighted.
export function StatusProgress({ status, direction }) {
  const returning = direction === 'return' || RETURN.includes(status)
  const steps = returning ? ['accepted', ...RETURN] : FORWARD
  const at = status === 'delivery_attempted' ? steps.indexOf('out_for_delivery') : Math.max(0, steps.indexOf(status))
  const finished = status === 'delivered' || status === 'returned_to_sender'
  return (
    <ol className="flex w-full items-start" aria-label={`Progress: ${STATUS_LABEL[status] || status}`}>
      {steps.map((s, i) => {
        const done = i < at || (finished && i === at)
        const current = i === at && !finished
        const warn = current && (status === 'delivery_attempted' || status === 'return_started')
        return (
          <li key={s} className="relative flex flex-1 flex-col items-center text-center" aria-current={current ? 'step' : undefined}>
            {i > 0 && <span aria-hidden className={`absolute right-1/2 top-3 h-0.5 w-full ${i <= at ? 'bg-brand-600' : 'bg-slate-200'}`} />}
            <span className={`relative z-10 grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${done
              ? 'bg-brand-700 text-white' : current ? (warn ? 'bg-amber-500 text-white ring-4 ring-amber-100' : 'bg-white text-brand-800 ring-[3px] ring-brand-600') : 'bg-white text-slate-400 ring-1 ring-slate-300'}`}>
              {done ? <Icon name="tick" className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={`mt-1.5 px-0.5 text-[11px] leading-tight ${current ? 'font-semibold text-brand-900' : done ? 'text-slate-700' : 'text-slate-400'}`}>
              {current && status === 'delivery_attempted' ? 'Delivery attempted' : STEP_LABEL[s]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
