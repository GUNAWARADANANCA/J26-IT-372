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
  return <Badge tone={STATUS_TONE[status] || 'slate'}>{STATUS_LABEL[status] || status}</Badge>
}

const LOC_TONE = { consistent: 'green', uncertain: 'amber', mismatch: 'red', unlocated: 'slate', not_assessed: 'slate' }

// Text + colour, never colour alone (NFR08)
export function LocationBadge({ result }) {
  if (!result) return null
  return <Badge tone={LOC_TONE[result] || 'slate'}>Location: {result.replace('_', ' ')}</Badge>
}

const DECISION_TONE = { accepted: 'green', accepted_after_review: 'green', held_for_review: 'amber', rejected_after_review: 'red' }

export function DecisionBadge({ decision }) {
  return <Badge tone={DECISION_TONE[decision] || 'slate'}>{decision?.replaceAll('_', ' ')}</Badge>
}
