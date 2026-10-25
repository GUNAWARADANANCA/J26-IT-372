import { DecisionBadge, LocationBadge, STATUS_LABEL } from './StatusBadge.jsx'
import { Badge, fmtTime } from './ui.jsx'

const DOT = { accepted: 'bg-brand-600', accepted_after_review: 'bg-brand-600', held_for_review: 'bg-amber-500', rejected_after_review: 'bg-red-600' }

// Staff timeline: every event with its decision and location evidence, newest at the top.
export default function Timeline({ events }) {
  const rows = [...(events || [])].sort((a, b) => new Date(b.captured_at) - new Date(a.captured_at))
  return (
    <ol className="relative space-y-5 border-l-2 border-slate-200 pl-6">
      {rows.map((e, i) => {
        const a = e.assessment || {}
        return (
          <li key={e.event_id} className="relative">
            <span className={`absolute -left-[33px] top-0.5 h-4 w-4 rounded-full border-[3px] border-white ring-1 ring-slate-300 ${DOT[e.decision] || 'bg-slate-400'}`} />
            <div className="flex flex-wrap items-center gap-2">
              <span className={`font-semibold ${i === 0 ? 'text-brand-900' : 'text-slate-800'}`}>{STATUS_LABEL[e.requested_status] || e.requested_status}</span>
              {i === 0 && <Badge tone="blue">Latest</Badge>}
              <DecisionBadge decision={e.decision} />
              <LocationBadge result={a.result} />
              {e.late && <Badge tone="slate" title="Arrived after the item had moved on; kept in history only">late – history only</Badge>}
              {e.flagged && <Badge tone="amber">flagged</Badge>}
              {e.offline && <Badge tone="slate">captured offline</Badge>}
            </div>
            <p className="mt-0.5 text-xs text-slate-600">
              {fmtTime(e.captured_at)} · {e.worker} ({e.worker_role?.replaceAll('_', ' ')})
              {e.sync_delay_s > 600 && ` · synchronised ${Math.round(e.sync_delay_s / 60)} min later`}
            </p>
            {(a.reasons?.length > 0 || e.decision_reasons?.length > 0 || e.acknowledgement || e.reason || e.exception_reason || (e.review && e.review.status !== 'pending')) && (
              <div className="mt-1.5 space-y-0.5 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
                {a.reasons?.length > 0 && <p><span className="font-semibold">Location check:</span> {a.reasons.join('; ')}</p>}
                {e.decision_reasons?.map((r, k) => <p key={k} className="text-amber-900"><span className="font-semibold">Held because:</span> {r.message}</p>)}
                {e.acknowledgement && <p><span className="font-semibold">Acknowledgement:</span> {e.acknowledgement.type} {e.acknowledgement.recipient_name}</p>}
                {(e.reason || e.exception_reason) && <p><span className="font-semibold">Reason:</span> {e.reason || e.exception_reason}</p>}
                {e.review && e.review.status !== 'pending' && (
                  <p><span className="font-semibold">Review:</span> {e.review.status} by {e.review.by} – {e.review.reason}</p>
                )}
              </div>
            )}
            <p className="mt-1 text-[11px] text-slate-400">Received by the server {fmtTime(e.received_at)}</p>
          </li>
        )
      })}
    </ol>
  )
}
