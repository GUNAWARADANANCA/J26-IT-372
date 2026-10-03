import { DecisionBadge, LocationBadge, STATUS_LABEL } from './StatusBadge.jsx'
import { Badge, fmtTime } from './ui.jsx'

// Staff timeline: every event with its decision and location evidence.
export default function Timeline({ events }) {
  const rows = [...(events || [])].sort((a, b) => new Date(a.captured_at) - new Date(b.captured_at))
  return (
    <ol className="relative space-y-4 border-l-2 border-slate-200 pl-5">
      {rows.map((e) => {
        const a = e.assessment || {}
        return (
          <li key={e.event_id} className="relative">
            <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-slate-400" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{STATUS_LABEL[e.requested_status] || e.requested_status}</span>
              <DecisionBadge decision={e.decision} />
              <LocationBadge result={a.result} />
              {e.late && <Badge tone="slate" title="Arrived after the item had moved on; kept in history only">late – history only</Badge>}
              {e.flagged && <Badge tone="amber">flagged</Badge>}
              {e.offline && <Badge tone="slate">captured offline</Badge>}
            </div>
            <p className="text-xs text-slate-600">
              Captured {fmtTime(e.captured_at)} · received {fmtTime(e.received_at)}
              {e.sync_delay_s > 600 && ` (synchronised ${Math.round(e.sync_delay_s / 60)} min later)`} · {e.worker} ({e.worker_role})
            </p>
            {a.reasons?.length > 0 && <p className="text-xs text-slate-700">{a.reasons.join('; ')}</p>}
            {e.decision_reasons?.length > 0 && (
              <ul className="text-xs text-amber-800">{e.decision_reasons.map((r, i) => <li key={i}>Hold: {r.message}</li>)}</ul>
            )}
            {e.acknowledgement && (
              <p className="text-xs text-slate-700">Acknowledgement: {e.acknowledgement.type} {e.acknowledgement.recipient_name}</p>
            )}
            {(e.reason || e.exception_reason) && <p className="text-xs text-slate-700">Reason: {e.reason || e.exception_reason}</p>}
            {e.review && e.review.status !== 'pending' && (
              <p className="text-xs text-slate-600">Review: {e.review.status} by {e.review.by} – {e.review.reason}</p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
