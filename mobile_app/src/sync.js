// Upload pending scans in capture order (idempotent: same event_id on every retry).
import { request } from './api'
import { markAttemptFailed, markResult, pendingEvents } from './db'

let running = null

export function syncNow(session) {
  if (!running) running = doSync(session).finally(() => { running = null })
  return running
}

async function doSync(session) {
  const summary = { sent: 0, accepted: 0, held: 0, rejected: 0, duplicate: 0, failed: 0, error: null }
  for (;;) {
    const batch = await pendingEvents(50)
    if (batch.length === 0) return summary
    let res
    try {
      res = await request(session, '/api/scans/batch', { method: 'POST', body: { events: batch.map((b) => b.payload) }, timeoutMs: 30000 })
    } catch (err) {
      // Network error or server failure: nothing is lost, events stay pending.
      await markAttemptFailed(batch.map((b) => b.event_id), err.message)
      summary.failed += batch.length
      summary.error = err.message
      return summary
    }
    for (const r of res.results) {
      summary.sent += 1
      if (r.http_status >= 500) { summary.failed += 1; continue }
      const state = r.decision === 'held_for_review' ? 'held' : r.decision
      summary[state] = (summary[state] || 0) + 1
      await markResult(r.event_id, { state, decision: r.decision, message: r.reasons?.map((x) => x.message).join('; ') })
    }
    if (batch.length < 50) return summary
  }
}
