import { useEffect, useRef, useState } from 'react'
import { chatCoach, followCoach, getCoach } from '../data/repository'

const SUGGESTED_QUESTIONS_EN = [
  'How am I performing?',
  'What are my strengths?',
  'How can I improve my KPI?',
  'Which area needs attention?',
  'Compare with my previous week.',
  'What does my predicted KPI mean?',
]

const SUGGESTED_QUESTIONS_SI = [
  'මගේ කාර්යසාධනය කෙබඳුද?',
  'මගේ ශක්තීන් මොනවාද?',
  'මගේ KPI වැඩි දියුණු කරගන්නේ කෙසේද?',
  'අවධානය යොමු කළ යුතු අංශය කුමක්ද?',
  'පෙර සතිය සමඟ සසඳන්න.',
  'මගේ පුරෝකථන KPI අගය කුමක්ද?',
]

function getSinhalaCategoryName(category) {
  const c = (category || '').toLowerCase()
  if (c.includes('delivery')) return 'ක්ෂේත්‍ර තැපැල් බෙදාහැරීම'
  if (c.includes('supervisory')) return 'ප්‍රධාන පරිපාලන / අධීක්ෂණ'
  return 'කාර්යාලීය / කවුන්ටර සේවා'
}

export default function CoachPanel({ employeeId, week, year, onSelectWeek }) {
  const [language, setLanguage] = useState('en') // 'en' | 'si'
  const [plan, setPlan] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [asking, setAsking] = useState(false)
  const [followedTitles, setFollowedTitles] = useState({})
  const [expandedEvidence, setExpandedEvidence] = useState({})

  const chatEndRef = useRef(null)
  const requestRef = useRef(0)

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, asking])

  // Reset or reload greeting when employee, week, year, or language changes
  const buildWelcomeMessage = (payload, lang) => {
    const empName = payload?.employee_name || employeeId
    const activeWeek = payload?.week || week || 'Latest'
    const activeYear = payload?.year || year || '2026'
    const workCat = payload?.work_category || 'General'
    const catSi = getSinhalaCategoryName(workCat)

    const isSi = lang === 'si'
    const welcomeText = isSi
      ? `ආයුබෝවන්! මම ඔබගේ PostAssist AI ඵලදායිතා උපදේශකයා වෙමි. මා ${empName} (${employeeId}) මහතාගේ/මහත්මියගේ ${catSi} රාජකාරි සඳහා ${activeWeek}, ${activeYear} සතියේ දෙපාර්තමේන්තු වාර්තා සමඟ සම්බන්ධ වී සිටිමි.\n\nඔබගේ වැඩ නිම කිරීමේ ප්‍රතිශතය, දෝෂ සංඛ්‍යාව, කාලෝචිතභාවය, සතිපතා සංසන්දනයන් හෝ KPI ලකුණු ඉහළ නංවා ගැනීමට අදාළ ඕනෑම කරුණක් පහතින් විමසන්න.`
      : `Hello! I'm your PostAssist AI Productivity Coach. I am connected to the measured departmental records for ${empName} (${employeeId}) in ${workCat} for Week ${activeWeek}, ${activeYear}.\n\nAsk me anything about your completion rate, error defects, dispatch timeliness, historical weekly comparisons, or category-tailored ways to improve your measured KPI.`

    return {
      id: `welcome-${lang}-${Date.now()}`,
      role: 'coach',
      text: welcomeText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isWelcome: true,
      evidence: payload?.historical_baseline_kpi != null || payload?.measured_kpi != null ? {
        employee_id: employeeId,
        employee_name: empName,
        work_category: workCat,
        reporting_period: `Week ${activeWeek}, ${activeYear}`,
        overall_kpi: payload.measured_kpi ?? payload.historical_baseline_kpi,
        completion_rate: payload.completion_rate,
        accuracy_rate: payload.accuracy_rate,
        timeliness_rate: payload.timeliness_rate,
      } : null,
      forecast: payload?.predicted_next_week_kpi != null ? {
        predicted_kpi: payload.predicted_next_week_kpi,
        model: 'Random Forest Regressor (kpi_forecast_model.joblib · Holdout MAE ±3.41, RMSE 4.55)',
        disclaimer: isSi
          ? 'Random Forest යන්ත්‍ර ඉගෙනුම් පුරෝකථනය (Holdout MAE ±3.41, RMSE 4.55). මෙය සැලසුම් ඇස්තමේන්තුවක් වන අතර සහතික කළ ප්‍රමිතියක් නොවේ.'
          : 'Random Forest ML Model (kpi_forecast_model.joblib · Holdout MAE ±3.41, RMSE 4.55). Projections are forward-looking planning estimates, not guaranteed outcomes.',
      } : null,
      recommendations: (payload?.recommendations || []).slice(0, 3).map((r) => ({
        title: r.headline || r.title,
        priority: r.priority || (r.rank >= 2.0 ? 'High' : 'Medium'),
        evidence: r.evidence,
        reason: r.explanation || r.reason,
        action: r.actions?.[0] || r.action || 'Follow standard operational procedures.',
        follow_up: r.follow_up || 'Next recorded week review',
      })),
    }
  }

  // Load employee coaching context
  useEffect(() => {
    if (!employeeId) return undefined
    const token = ++requestRef.current
    setLoading(true)
    setError('')
    setPlan(null)
    setExpandedEvidence({})

    getCoach(employeeId, week || undefined, year || undefined)
      .then((payload) => {
        if (token === requestRef.current) {
          setPlan(payload)
          setMessages([buildWelcomeMessage(payload, language)])
        }
      })
      .catch((err) => {
        if (token === requestRef.current) {
          setError(err.message || 'Could not load employee coaching context.')
        }
      })
      .finally(() => {
        if (token === requestRef.current) setLoading(false)
      })

    return undefined
  }, [employeeId, week, year])

  // Language switcher handler
  const handleLanguageChange = (newLang) => {
    if (newLang === language) return
    setLanguage(newLang)

    // Send a system transition notice in the chat
    const switchMsg = {
      id: `lang-switch-${Date.now()}`,
      role: 'coach',
      text: newLang === 'si'
        ? '🇱🇰 භාෂාව සිංහලට මාරු කරන ලදී. දැන් ඔබට සිංහල භාෂාවෙන් විමසීම් කළ හැකි අතර, උපදෙස් සහ නිර්දේශ සිංහලෙන් ලැබෙනු ඇත.'
        : '🇬🇧 Language switched to English. You can now inquire in English with full category-specific guidance.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    setMessages((prev) => [...prev, switchMsg])
  }

  // Clear chat conversation
  const handleClearChat = () => {
    setMessages([buildWelcomeMessage(plan, language)])
  }

  // Send message to coach
  const sendMessage = async (overrideText) => {
    const message = (overrideText || inputText).trim()
    if (!message || asking || !employeeId) return

    const currentToken = requestRef.current
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    // Add user message
    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: message,
      timestamp,
    }
    setMessages((prev) => [...prev, userMsg])
    setInputText('')
    setAsking(true)

    try {
      const response = await chatCoach(
        employeeId,
        message,
        week || plan?.week || 9,
        year || plan?.year || 2026,
        language
      )
      if (currentToken !== requestRef.current) return

      const coachMsg = {
        id: `coach-${Date.now()}`,
        role: 'coach',
        text: response.reply,
        supported: response.supported,
        intent: response.intent,
        work_category: response.work_category,
        designation: response.designation,
        language: response.language || language,
        evidence: response.evidence,
        forecast: response.forecast,
        recommendations: response.recommendations || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setMessages((prev) => [...prev, coachMsg])
    } catch (err) {
      if (currentToken !== requestRef.current) return
      setMessages((prev) => [
        ...prev,
        {
          id: `coach-err-${Date.now()}`,
          role: 'coach',
          text: err.message || (language === 'si' ? 'සේවා සබඳතාව බිඳවැටී ඇත. කරුණාකර නැවත උත්සාහ කරන්න.' : 'Unable to connect to the coaching service. Please verify your connection.'),
          supported: false,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } finally {
      if (currentToken === requestRef.current) setAsking(false)
    }
  }

  // Handle Mark for Follow-up on recommendation
  const handleFollowUp = async (recTitle) => {
    try {
      await followCoach(employeeId, recTitle, 'Accepted for follow-up')
      setFollowedTitles((prev) => ({ ...prev, [recTitle]: true }))
    } catch {
      setFollowedTitles((prev) => ({ ...prev, [recTitle]: true }))
    }
  }

  const toggleEvidence = (msgId) => {
    setExpandedEvidence((prev) => ({ ...prev, [msgId]: !prev[msgId] }))
  }

  const empName = plan?.employee_name || employeeId
  const measuredKpi = plan?.measured_kpi ?? plan?.overall_kpi ?? plan?.historical_baseline_kpi
  const compRate = plan?.completion_rate ?? plan?.completion
  const accRate = plan?.accuracy_rate ?? plan?.accuracy
  const timeRate = plan?.timeliness_rate ?? plan?.timeliness
  const predKpi = plan?.predicted_next_week_kpi ?? plan?.forecast_kpi
  const workCat = plan?.work_category || 'Delivery (Field)'
  const designation = plan?.designation || 'Postman'
  const isSi = language === 'si'
  const suggestedQuestions = isSi ? SUGGESTED_QUESTIONS_SI : SUGGESTED_QUESTIONS_EN

  return (
    <div className="flex flex-col rounded-2xl border border-[#DFE8F2] bg-white shadow-md">
      {/* 1. Header Bar with Language Filter & Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DFE8F2] bg-[#F8FAFC] px-6 py-4 rounded-t-2xl">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0B1F3A] text-white shadow-sm">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-[#0B1F3A]">PostAssist AI Productivity Coach</h3>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                {isSi ? 'දත්ත සම්බන්ධිතයි' : 'Historical Data Connected'}
              </span>
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-[#1677D2]">
                Random Forest ML Model
              </span>
            </div>
            <p className="text-xs text-[#64748B]">
              {isSi
                ? 'මනින ලද තැපැල් කාර්යසාධනය සහ kpi_forecast_model.joblib ආකෘතිය මත පදනම් වූ විශේෂිත උපදෙස්'
                : 'Personalised coaching based on measured postal workforce performance & kpi_forecast_model.joblib'}
            </p>
          </div>
        </div>

        {/* Right side controls: Language filter & Clear button */}
        <div className="flex items-center gap-3">
          {/* Language Filter Switcher */}
          <div className="flex items-center rounded-xl border border-[#DFE8F2] bg-white p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => handleLanguageChange('en')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                language === 'en'
                  ? 'bg-[#0B1F3A] text-white shadow-2xs'
                  : 'text-[#64748B] hover:text-[#0B1F3A]'
              }`}
            >
              🇬🇧 English
            </button>
            <button
              type="button"
              onClick={() => handleLanguageChange('si')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                language === 'si'
                  ? 'bg-[#0B1F3A] text-white shadow-2xs'
                  : 'text-[#64748B] hover:text-[#0B1F3A]'
              }`}
            >
              🇱🇰 සිංහල
            </button>
          </div>

          <button
            type="button"
            onClick={handleClearChat}
            className="rounded-xl border border-[#DFE8F2] bg-white px-3.5 py-2 text-xs font-semibold text-[#475569] shadow-2xs hover:bg-[#F1F5F9] hover:text-[#0B1F3A] transition-colors"
            title="Clear chat conversation"
          >
            {isSi ? 'සංවාදය මකන්න' : 'Clear Conversation'}
          </button>
        </div>
      </div>

      {/* 2. Selected Context, Category & Compact KPI Summary */}
      <div className="border-b border-[#DFE8F2] bg-[#FAFCFF] px-6 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-[#0B1F3A] text-sm">{empName}</span>
            <span className="rounded bg-[#E2E8F0] px-2 py-0.5 text-[10px] font-semibold text-[#475569]">{employeeId}</span>
            <span className="rounded-md border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-[10px] font-bold text-[#5E35B1]">
              {isSi ? getSinhalaCategoryName(workCat) : `${workCat} · ${designation}`}
            </span>
            <span className="text-[#94A3B8]">·</span>
            <span className="text-[#475569]">
              {isSi ? 'සතිය: ' : 'Week: '}<strong>{plan?.week || week || 'Latest'}</strong> ({year || 2026})
            </span>
          </div>

          {/* Compact KPI Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs shadow-2xs">
              <span className="text-[#64748B]">{isSi ? 'සමස්ත KPI: ' : 'Overall KPI: '}</span>
              <strong className="font-bold text-[#0B1F3A]">{measuredKpi != null ? `${measuredKpi}%` : '—'}</strong>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs shadow-2xs">
              <span className="text-[#64748B]">{isSi ? 'සම්පූර්ණ කිරීම: ' : 'Completion: '}</span>
              <strong className="font-bold text-[#0B1F3A]">{compRate != null ? `${compRate}%` : '—'}</strong>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs shadow-2xs">
              <span className="text-[#64748B]">{isSi ? 'නිරවද්‍යතාවය: ' : 'Accuracy: '}</span>
              <strong className="font-bold text-[#0B1F3A]">{accRate != null ? `${accRate}%` : '—'}</strong>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs shadow-2xs">
              <span className="text-[#64748B]">{isSi ? 'කාලෝචිතභාවය: ' : 'Timeliness: '}</span>
              <strong className="font-bold text-[#0B1F3A]">{timeRate != null ? `${timeRate}%` : '—'}</strong>
            </div>
            {predKpi != null && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs shadow-2xs">
                <span className="text-[#1677D2] font-semibold">{isSi ? 'ආකෘති පුරෝකථනය: ' : 'ML Forecast: '}</span>
                <strong className="font-bold text-[#1677D2]">{predKpi}%</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Conversation Thread (Spacious, Central Focus) */}
      <div className="h-[480px] overflow-y-auto p-6 space-y-4 bg-slate-50/40">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-xs text-[#64748B] gap-2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#1677D2] border-t-transparent" />
            <span>{isSi ? `දත්ත ලබාගනිමින් පවතී (${employeeId})...` : `Loading measured performance records for ${employeeId}...`}</span>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
            {error}
          </div>
        ) : null}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            {/* Sender & Timestamp */}
            <div className="mb-1 flex items-center gap-1.5 px-1 text-[10px] text-[#94A3B8]">
              {msg.role === 'user' ? (
                <>
                  <span className="font-semibold text-[#1677D2]">{isSi ? 'ඔබ' : 'You'}</span>
                  <span>·</span>
                  <span>{msg.timestamp}</span>
                </>
              ) : (
                <>
                  <span className="font-bold text-[#0B1F3A]">PostAssist AI Coach</span>
                  {msg.intent && (
                    <span className="rounded bg-slate-200 px-1.5 py-0.2 text-[9px] font-semibold text-slate-700">
                      {msg.intent}
                    </span>
                  )}
                  <span>·</span>
                  <span>{msg.timestamp}</span>
                </>
              )}
            </div>

            {/* Bubble */}
            {msg.role === 'user' ? (
              <div className="max-w-[80%] rounded-2xl rounded-tr-xs bg-[#1677D2] px-4 py-3 text-xs text-white shadow-2xs leading-relaxed">
                {msg.text}
              </div>
            ) : (
              <div className="max-w-[95%] w-full rounded-2xl rounded-tl-xs border border-[#DFE8F2] bg-white p-4 text-xs text-[#172B4D] shadow-2xs space-y-3">
                {/* Out of scope notice banner if unsupported */}
                {msg.supported === false && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-[11px] text-amber-900 flex items-start gap-2.5">
                    <span className="text-amber-600 font-bold text-base">ℹ</span>
                    <div>
                      <strong className="block font-semibold">
                        {isSi ? 'කාර්ය පරාස සීමාව ක්‍රියාත්මකයි' : 'Scope Restriction Enforced'}
                      </strong>
                      <span>
                        {isSi
                          ? 'මෙම උපදේශකයා මනින ලද තැපැල් සේවා KPI කාර්යසාධන විශ්ලේෂණය සඳහා පමණක් සීමා කර ඇත.'
                          : 'The coach is restricted to measured postal workforce KPI analytics.'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Primary Response Text */}
                <div className="whitespace-pre-line leading-relaxed text-[#1E293B] text-xs sm:text-[13px]">
                  {msg.text}
                </div>

                {/* Evidence Section Drawer */}
                {msg.evidence && Object.keys(msg.evidence).length > 0 && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-[#0B1F3A]">
                        <span>{isSi ? 'දෙපාර්තමේන්තු විගණිත සාක්ෂි' : 'Measured Departmental Evidence'}</span>
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] text-[#1677D2]">
                          {isSi ? 'තහවුරු කළ වාර්තා' : 'Verified'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleEvidence(msg.id)}
                        className="font-semibold text-[#1677D2] hover:underline"
                      >
                        {expandedEvidence[msg.id]
                          ? (isSi ? 'විස්තර සඟවන්න' : 'Hide Details')
                          : (isSi ? 'විගණන විස්තර බලන්න' : 'View Audit Details')}
                      </button>
                    </div>

                    <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4 text-[#334155]">
                      <div className="rounded-lg border border-blue-100 bg-white p-2.5">
                        <span className="block text-[10px] text-[#64748B]">{isSi ? 'පවරන ලද' : 'Assigned'}</span>
                        <strong className="text-sm text-[#0B1F3A]">{msg.evidence.assigned_items ?? '—'}</strong>
                      </div>
                      <div className="rounded-lg border border-blue-100 bg-white p-2.5">
                        <span className="block text-[10px] text-[#64748B]">{isSi ? 'සම්පූර්ණ කළ' : 'Completed'}</span>
                        <strong className="text-sm text-emerald-700">{msg.evidence.completed_items ?? '—'}</strong>
                      </div>
                      <div className="rounded-lg border border-blue-100 bg-white p-2.5">
                        <span className="block text-[10px] text-[#64748B]">{isSi ? 'වාර්තා වූ දෝෂ' : 'Recorded Errors'}</span>
                        <strong className="text-sm text-amber-700">{msg.evidence.error_count ?? 0}</strong>
                      </div>
                      <div className="rounded-lg border border-blue-100 bg-white p-2.5">
                        <span className="block text-[10px] text-[#64748B]">{isSi ? 'ප්‍රමාදයන්' : 'Late Dispatches'}</span>
                        <strong className="text-sm text-rose-700">{msg.evidence.late_count ?? 0}</strong>
                      </div>
                    </div>

                    {expandedEvidence[msg.id] && (
                      <div className="mt-3 pt-2.5 border-t border-blue-100 space-y-2 text-[#475569] text-[11px]">
                        {msg.evidence.previous_week && (
                          <p>
                            • {isSi ? 'පෙර සතිය සමඟ සසඳන විට:' : 'Comparison with prior week:'} <strong>{msg.evidence.previous_week}</strong> {isSi ? 'සතියේ අගය' : 'was'} <strong>{msg.evidence.previous_kpi}%</strong> ({isSi ? 'වෙනස' : 'net shift'}: <strong>{msg.evidence.actual_change != null ? `${msg.evidence.actual_change > 0 ? '+' : ''}${msg.evidence.actual_change}%` : '—'}</strong>).
                          </p>
                        )}
                        {msg.forecast?.model && (
                          <div className="rounded-lg bg-white border border-slate-200 p-2.5 text-[10px] text-[#64748B]">
                            <strong className="text-[#0B1F3A] block">{isSi ? 'යන්ත්‍ර ඉගෙනුම් ආකෘතිය:' : 'Forecasting Model Context:'}</strong>
                            <span>{msg.forecast.model}</span>
                            <p className="mt-1 text-slate-500 italic">{msg.forecast.disclaimer}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Category-Specific Recommendation Cards (Max 3) */}
                {msg.recommendations && msg.recommendations.length > 0 && (
                  <div className="space-y-2.5 pt-1">
                    <span className="text-[11px] font-bold text-[#0B1F3A] uppercase tracking-wider block">
                      {isSi
                        ? `කාණ්ඩය අනුව විශේෂිත වැඩිදියුණු කිරීමේ නිර්දේශ (${msg.recommendations.length})`
                        : `Category-Tailored Improvement Recommendations (${msg.recommendations.length})`}
                    </span>
                    <div className="grid gap-2.5 sm:grid-cols-1">
                      {msg.recommendations.map((rec, idx) => {
                        const isFollowed = followedTitles[rec.title] || rec.follow_up === 'Accepted for follow-up'
                        return (
                          <div
                            key={idx}
                            className="rounded-xl border border-[#DFE8F2] bg-[#F8FAFC] p-3.5 text-xs space-y-2 shadow-2xs hover:border-[#CBD5E1] transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1677D2] text-[10px] font-bold text-white">
                                  {idx + 1}
                                </span>
                                <h4 className="font-bold text-[#0B1F3A] text-xs sm:text-[13px]">{rec.title}</h4>
                              </div>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                  rec.priority === 'High'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-blue-50 text-[#1677D2] border border-blue-200'
                                }`}
                              >
                                {rec.priority} Priority
                              </span>
                            </div>

                            {rec.evidence && (
                              <p className="text-[11px] text-[#475569]">
                                <strong className="text-[#0B1F3A]">{isSi ? 'මනින ලද සාක්ෂිය: ' : 'Measured Evidence: '}</strong> {rec.evidence}
                              </p>
                            )}
                            {rec.reason && (
                              <p className="text-[11px] text-[#475569]">
                                <strong className="text-[#0B1F3A]">{isSi ? 'මූලික හේතුව: ' : 'Operational Reason: '}</strong> {rec.reason}
                              </p>
                            )}
                            {rec.action && (
                              <p className="text-[11px] text-[#1E293B]">
                                <strong className="text-[#1677D2]">{isSi ? 'ප්‍රායෝගික පියවර: ' : 'Practical Action: '}</strong> {rec.action}
                              </p>
                            )}

                            <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-2 text-[10px]">
                              <span className="text-[#64748B]">
                                {isSi ? 'පසු විපරම: ' : 'Follow-up: '}<strong>{isFollowed ? (isSi ? 'පසු විපරමට පිළිගැනිණි' : 'Accepted for follow-up') : rec.follow_up}</strong>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleFollowUp(rec.title)}
                                className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                                  isFollowed
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-white text-[#0B1F3A] border border-[#CBD5E1] hover:bg-slate-100'
                                }`}
                              >
                                {isFollowed
                                  ? (isSi ? '✓ පසු විපරමට සලකුණු කෙරිණි' : '✓ Marked for Follow-up')
                                  : (isSi ? 'පසු විපරමට සලකුණු කරන්න' : 'Mark for Follow-up')}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Loading Indicator */}
        {asking && (
          <div className="flex items-start gap-2 text-xs text-[#64748B]">
            <div className="rounded-2xl rounded-tl-xs border border-[#DFE8F2] bg-white px-4 py-2.5 shadow-2xs flex items-center gap-2">
              <div className="flex space-x-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1677D2] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-[#1677D2] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-[#1677D2] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs font-medium text-[#475569]">
                {isSi ? 'PostAssist උපදේශකයා දෙපාර්තමේන්තු දත්ත විශ්ලේෂණය කරමින් සිටී...' : 'PostAssist Coach is analyzing measured records...'}
              </span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* 4. Suggested Inquiry Chips in Active Language */}
      <div className="border-t border-[#DFE8F2] bg-[#F8FAFC] px-6 py-3">
        <div className="flex items-center gap-1.5 mb-2 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
          <svg className="h-3.5 w-3.5 text-[#1677D2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {isSi ? 'යෝජිත විමසීම්:' : 'Suggested Inquiries:'}
        </div>
        <div className="flex flex-wrap gap-2">
          {suggestedQuestions.map((q) => (
            <button
              key={q}
              type="button"
              disabled={asking}
              onClick={() => sendMessage(q)}
              className="rounded-full border border-[#DFE8F2] bg-white px-3.5 py-1.5 text-xs font-medium text-[#1E293B] shadow-2xs hover:border-[#1677D2] hover:bg-blue-50/70 hover:text-[#1677D2] transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Chat Input Bar */}
      <div className="p-5 border-t border-[#DFE8F2] bg-white rounded-b-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            sendMessage()
          }}
          className="flex flex-col gap-2"
        >
          <div className="flex gap-2.5">
            <input
              type="text"
              maxLength={600}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder={isSi ? 'මේ සතියේ ඔබගේ කාර්යසාධනය ගැන අසන්න...' : 'Ask how you are performing this week...'}
              disabled={asking}
              className="h-11 flex-1 rounded-xl border border-[#DFE8F2] bg-white px-4 text-xs text-[#0B1F3A] placeholder:text-[#94A3B8] focus:border-[#1677D2] focus:ring-1 focus:ring-[#1677D2] focus:outline-none disabled:bg-slate-50 transition-all"
            />
            <button
              type="submit"
              disabled={asking || !inputText.trim()}
              className="h-11 rounded-xl bg-[#0B1F3A] px-6 text-xs font-bold text-white shadow-2xs hover:bg-[#12315c] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <span>{isSi ? 'යවන්න' : 'Send'}</span>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>

          <div className="flex items-center justify-between px-1 text-[10px] text-[#94A3B8]">
            <span>
              {isSi
                ? 'පිළිතුරු සපයන මාතෘකා: වැඩ නිම කිරීම, නිරවද්‍යතා දෝෂ, පිටත්කිරීමේ කාලෝචිතභාවය, සතිපතා සංසන්දනයන්, පුරෝකථන.'
                : 'Supported topics: completion rate, accuracy defects, dispatch timeliness, weekly comparisons, forecast interpretation.'}
            </span>
            <span>{inputText.length} / 600</span>
          </div>
        </form>
      </div>
    </div>
  )
}
