import { useEffect, useRef, useState } from 'react'
import { askCoach, followCoach, getCoach } from '../data/repository'

const QUESTIONS = [
  'Why is this the main improvement priority?',
  'What should I focus on next week?',
  'What information is missing from this analysis?',
]

export default function CoachPanel({ employeeId, week, onSelectWeek }) {
  const [plan, setPlan] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState([])
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [evidenceId, setEvidenceId] = useState('')
  const [followedIds, setFollowedIds] = useState({})
  const [attempt, setAttempt] = useState(0)
  const requestRef = useRef(0)

  useEffect(() => {
    if (!employeeId) return undefined
    const token = ++requestRef.current
    setLoading(true)
    setError('')
    setMessages([])
    setPlan(null)
    getCoach(employeeId, week || undefined)
      .then((payload) => {
        if (token === requestRef.current) setPlan(payload)
      })
      .catch((err) => {
        if (token === requestRef.current) setError(err.message || 'Could not load coaching notes')
      })
      .finally(() => {
        if (token === requestRef.current) setLoading(false)
      })
    return undefined
  }, [employeeId, week, attempt])

  async function send(text) {
    const asked = (text || question).trim()
    if (!asked) return
    const token = requestRef.current
    const forEmployee = employeeId
    setAsking(true)
    setQuestion('')
    setMessages((current) => [...current, { role: 'you', text: asked }])
    try {
      const payload = await askCoach(forEmployee, week || undefined, asked)
      if (token !== requestRef.current) return
      setMessages((current) => [...current, { role: 'coach', text: payload.reply }])
    } catch (err) {
      if (token !== requestRef.current) return
      setMessages((current) => [...current, { role: 'coach', text: err.message || 'The coach could not answer. Try again.' }])
    } finally {
      if (token === requestRef.current) setAsking(false)
    }
  }

  async function handleFollowUp(itemId) {
    try {
      await followCoach(employeeId, itemId, 'Accepted for follow-up')
      setFollowedIds((prev) => ({ ...prev, [itemId]: true }))
    } catch {
      // ignore or keep button enabled
    }
  }

  return (
    <div className="space-y-4">
      {loading ? <p className="text-xs text-[#64748B]">Loading coaching analysis...</p> : null}
      {error ? (
        <p className="text-xs text-red-800" role="alert">
          {error}{' '}
          <button type="button" className="font-semibold underline" onClick={() => setAttempt((value) => value + 1)}>
            Retry
          </button>
        </p>
      ) : null}

      {plan ? (
        <div className="space-y-3.5">
          {/* Context Summary Bar */}
          <div className="rounded-xl border border-[#DFE8F2] bg-[#F8FAFC] px-3.5 py-2.5 text-xs text-[#475569]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-[#172B4D]">
                {plan.employee_name || plan.employee_id} · Week of {plan.week || week || 'Latest'}
              </span>
              <span className="text-[11px] font-medium text-[#64748B]">
                Measured KPI: <strong className="text-[#172B4D]">{plan.measured_kpi != null ? `${plan.measured_kpi}%` : '—'}</strong>
                {' · '}
                Forecast Estimate: <strong className="text-[#1677D2]">{plan.predicted_next_week_kpi != null ? `${plan.predicted_next_week_kpi}%` : '—'}</strong>
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[#64748B]">
              {plan.coverage}. {plan.forecast_note}
            </p>
          </div>

          {/* Note when current week has no logs and historical mode is active */}
          {plan.current_week_note && (
            <div className="flex flex-col justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-900 sm:flex-row sm:items-center">
              <span>{plan.current_week_note}</span>
              {plan.latest_available_week && onSelectWeek && (
                <button
                  type="button"
                  onClick={() => onSelectWeek(plan.latest_available_week)}
                  className="shrink-0 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                >
                  Switch to {plan.latest_available_week}
                </button>
              )}
            </div>
          )}

          {/* Recommendations Cards */}
          {(plan.recommendations || []).map((item) => {
            const isHistorical = item.basis === 'historical'
            const isFollowed = followedIds[item.id] || item.follow_up === 'Accepted for follow-up'
            return (
              <article
                key={item.id}
                className="rounded-xl border border-[#DFE8F2] bg-white p-4 shadow-2xs transition-colors hover:border-[#cbd5e1]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isHistorical
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      ✓
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-xs font-bold text-[#172B4D] sm:text-sm">{item.headline}</h4>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            isHistorical
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-blue-50 text-[#1677D2] border border-blue-200'
                          }`}
                        >
                          {isHistorical ? 'Historical Basis' : 'Measured Week Basis'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#475569]">{item.explanation}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEvidenceId(evidenceId === item.id ? '' : item.id)}
                    className="shrink-0 rounded-lg border border-[#DFE8F2] bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-semibold text-[#172B4D] hover:border-[#1677D2] hover:text-[#1677D2]"
                  >
                    {evidenceId === item.id ? 'Hide Evidence' : 'View Evidence'}
                  </button>
                </div>

                {/* Action bullet list */}
                {item.actions?.length > 0 && (
                  <ul className="mt-2.5 space-y-1 pl-7 text-xs text-[#334155] list-disc">
                    {item.actions.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                )}

                {/* Expanded Evidence Drawer */}
                {evidenceId === item.id && (
                  <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-xs text-[#172B4D]">
                    <p className="font-semibold text-[#12315c]">Supporting Evidence & Pattern</p>
                    <p className="mt-1 text-[#475569]">{item.evidence}</p>
                    <p className="mt-1 text-[11px] text-[#64748B]">
                      {item.why_prioritized} · Pattern: <strong>{item.pattern}</strong> · Review after {item.review_after}.
                    </p>
                  </div>
                )}

                {/* Footer Action Buttons */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#F1F5F9] pt-2.5 text-[11px]">
                  <span className="text-[#64748B]">
                    Follow-up status: <strong className="text-[#172B4D]">{isFollowed ? 'Accepted for follow-up' : item.follow_up}</strong>
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => send(item.headline)}
                      className="rounded-lg border border-[#DFE8F2] px-2.5 py-1 font-medium text-[#172B4D] hover:bg-slate-50"
                    >
                      Discuss with Coach
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFollowUp(item.id)}
                      className={`rounded-lg border px-2.5 py-1 font-medium ${
                        isFollowed
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-[#DFE8F2] text-[#172B4D] hover:bg-slate-50'
                      }`}
                    >
                      {isFollowed ? '✓ Marked for Follow-up' : 'Mark for Follow-up'}
                    </button>
                  </div>
                </div>
              </article>
            )
          })}

          {/* Interactive Q&A Box */}
          <div className="rounded-xl border border-[#DFE8F2] bg-[#F8FAFC] p-3.5">
            <h4 className="text-xs font-bold text-[#172B4D]">Ask Your Productivity Coach</h4>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUESTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="rounded-full border border-[#DFE8F2] bg-white px-2.5 py-1 text-[11px] font-medium text-[#172B4D] transition-colors hover:border-[#1677D2] hover:text-[#1677D2]"
                  onClick={() => send(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            {messages.length > 0 && (
              <div className="mt-2.5 space-y-1.5 rounded-lg border border-[#DFE8F2] bg-white p-2.5">
                {messages.map((item, index) => (
                  <p key={`${item.role}-${index}`} className="text-xs text-[#334155]">
                    <span className="font-bold text-[#172B4D]">{item.role === 'you' ? 'You' : 'Coach'}: </span>
                    {item.text}
                  </p>
                ))}
              </div>
            )}
            <form
              className="mt-2.5 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                send()
              }}
            >
              <input
                className="h-9 flex-1 rounded-lg border border-[#DFE8F2] bg-white px-3 text-xs text-[#172B4D] placeholder:text-[#94A3B8] focus:border-[#1677D2] focus:outline-none"
                placeholder="Ask a follow-up question about this employee's KPI..."
                aria-label="Ask the productivity coach"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
              />
              <button
                type="submit"
                className="h-9 rounded-lg bg-[#1677D2] px-3.5 text-xs font-bold text-white hover:bg-[#1262ab] disabled:opacity-50"
                disabled={asking}
              >
                Ask
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
