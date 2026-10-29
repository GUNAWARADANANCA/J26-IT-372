import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Globe,
  HelpCircle,
  Lightbulb,
  Maximize2,
  Minimize2,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Target,
  TrendingUp,
  User,
  UserCheck,
  Zap,
} from 'lucide-react'
import { useAuth } from '../data/auth'
import { list, productivityCoachChat } from '../data/repository'

// ── Markdown & Structured Text Formatter ────────────────────────────────────

function formatInline(text) {
  if (!text) return null
  // Replace `code` and **bold** and *italic*
  const parts = []
  let remaining = text

  // Regex matches `code`, **bold**, or *italic*
  const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/
  let keyIdx = 0

  while (remaining) {
    const match = remaining.match(tokenRegex)
    if (!match) {
      parts.push(remaining)
      break
    }
    const matchIdx = match.index
    if (matchIdx > 0) {
      parts.push(remaining.slice(0, matchIdx))
    }
    const token = match[0]
    if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={`code-${keyIdx++}`}
          className="px-1.5 py-0.5 text-xs font-mono font-semibold bg-slate-100 text-[#0B1F3A] rounded border border-slate-200"
        >
          {token.slice(1, -1)}
        </code>
      )
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={`bold-${keyIdx++}`} className="font-semibold text-slate-900">
          {token.slice(2, -2)}
        </strong>
      )
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={`italic-${keyIdx++}`} className="italic text-slate-700">
          {token.slice(1, -1)}
        </em>
      )
    }
    remaining = remaining.slice(matchIdx + token.length)
  }

  return parts
}

function FormattedContent({ content }) {
  if (!content) return null

  const lines = content.split('\n')
  const blocks = []
  let currentList = []

  const flushList = () => {
    if (currentList.length > 0) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="my-2 space-y-1.5 pl-1">
          {currentList.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-slate-800 leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1677D2] mt-2 shrink-0" />
              <div>{formatInline(item)}</div>
            </li>
          ))}
        </ul>
      )
      currentList = []
    }
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim()

    // Empty line
    if (!trimmed) {
      flushList()
      return
    }

    // Bullet line
    if (trimmed.startsWith('•') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const itemText = trimmed.replace(/^[•\-\*]\s*/, '')
      currentList.push(itemText)
      return
    }

    flushList()

    // Callout / Tip line
    if (trimmed.startsWith('💡') || trimmed.startsWith('ℹ️') || trimmed.startsWith('⚠️')) {
      blocks.push(
        <div
          key={`tip-${index}`}
          className="my-3 p-3 rounded-lg bg-blue-50/80 border border-blue-200/60 text-sm text-slate-800 flex items-start gap-2"
        >
          <span className="text-base shrink-0">{trimmed.slice(0, 2)}</span>
          <div className="font-medium text-slate-700">{formatInline(trimmed.slice(2).trim())}</div>
        </div>
      )
      return
    }

    // Numbered step (e.g. Day 1, 1., etc.)
    const numberedMatch = trimmed.match(/^(\d+\.|Day\s+\d+[\s\w]*:)/i)
    if (numberedMatch) {
      blocks.push(
        <div key={`step-${index}`} className="my-2 pl-2 text-sm leading-relaxed text-slate-800">
          {formatInline(trimmed)}
        </div>
      )
      return
    }

    // Standard paragraph
    blocks.push(
      <p key={`p-${index}`} className="my-1 text-sm leading-relaxed text-slate-800">
        {formatInline(trimmed)}
      </p>
    )
  })

  flushList()

  return <div className="space-y-1">{blocks}</div>
}

// ── Main Page Component ─────────────────────────────────────────────────────

export default function ProductivityPage() {
  const { user } = useAuth()
  const isPostmaster = Boolean(user?.is_postmaster || user?.role === 'postmaster' || user?.role === 'Postmaster')

  const [employees, setEmployees] = useState([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [language, setLanguage] = useState('en')
  const [conversationId, setConversationId] = useState(() => `conv_${Date.now()}`)
  const [errorBanner, setErrorBanner] = useState('')

  const chatBottomRef = useRef(null)
  const inputRef = useRef(null)

  // 1. Load employees for Postmaster switch & default selection
  useEffect(() => {
    let cancelled = false
    list('employee')
      .then((rows) => {
        if (!cancelled && Array.isArray(rows) && rows.length > 0) {
          const sorted = [...rows].sort((a, b) =>
            String(a.employee_name || '').localeCompare(String(b.employee_name || ''))
          )
          setEmployees(sorted)

          // Select current employee
          if (!selectedEmployeeId) {
            // If logged-in user matches an employee, select them
            const matched = sorted.find(
              (e) => (e.employee_id || e._id) === user?.username || e.employee_id === user?.employee_id
            )
            if (matched) {
              setSelectedEmployeeId(matched.employee_id || matched._id)
            } else {
              setSelectedEmployeeId(sorted[0].employee_id || sorted[0]._id)
            }
          }
        }
      })
      .catch((err) => {
        if (!cancelled) console.error('Failed to load employees for coach:', err)
      })

    return () => {
      cancelled = true
    }
  }, [user, selectedEmployeeId])

  // Current selected employee object
  const currentEmployee = useMemo(() => {
    return employees.find((e) => (e.employee_id || e._id) === selectedEmployeeId) || null
  }, [employees, selectedEmployeeId])

  // Auto-scroll on new messages or typing state
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Reset / Clear chat
  const handleClearChat = useCallback(() => {
    setMessages([])
    setConversationId(`conv_${Date.now()}`)
    setErrorBanner('')
    if (inputRef.current) inputRef.current.focus()
  }, [])

  // Send a message
  const handleSendMessage = useCallback(
    async (textToSend) => {
      const text = (textToSend || inputValue).trim()
      if (!text || loading) return

      setErrorBanner('')
      const userMessage = {
        id: `msg_${Date.now()}_u`,
        sender: 'user',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setMessages((prev) => [...prev, userMessage])
      setInputValue('')
      setLoading(true)

      try {
        const payload = await productivityCoachChat({
          message: text,
          conversationId,
          employeeId: selectedEmployeeId,
          language,
        })

        const coachMessage = {
          id: `msg_${Date.now()}_c`,
          sender: 'assistant',
          text: payload.reply || "I've reviewed your operational records and updated the coaching summary.",
          intent: payload.intent,
          evidence: payload.evidence,
          forecast: payload.forecast,
          recommendations: payload.recommendations || [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }

        setMessages((prev) => [...prev, coachMessage])
      } catch (err) {
        console.error('Chat error:', err)
        setErrorBanner(err.message || 'Unable to connect to AI Coach service. Please try again.')
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_${Date.now()}_err`,
            sender: 'assistant',
            isError: true,
            text: 'I encountered an error retrieving your performance records. Please verify your connection or try again.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ])
      } finally {
        setLoading(false)
      }
    },
    [inputValue, loading, conversationId, selectedEmployeeId, language]
  )

  // Keyboard shortcut (Enter to send, Shift+Enter for newline)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Suggestion card prompts
  const suggestionCards = useMemo(
    () => [
      {
        id: 'performance',
        title: language === 'si' ? 'මගේ කාර්යසාධනය' : 'My Performance',
        prompt: language === 'si' ? 'මගේ සමස්ත කාර්යසාධනය කොහොමද?' : 'How is my overall performance?',
        desc: language === 'si' ? 'මනින ලද KPI, සම්පූර්ණ කිරීම සහ කාලෝචිතභාවය' : 'Review overall KPI, completion, accuracy and timeliness.',
        icon: TrendingUp,
        color: 'text-[#1677D2] bg-blue-50 border-blue-200',
      },
      {
        id: 'weaknesses',
        title: language === 'si' ? 'මගේ දුර්වලතා' : 'My Weaknesses',
        prompt: language === 'si' ? 'මගේ අඩුම KPI අංශ මොනවාද?' : 'What are my weakest KPI areas?',
        desc: language === 'si' ? 'අඩුපාඩු, ප්‍රධාන හේතු සහ පරතර විශ්ලේෂණය' : 'Pinpoint lowest scoring areas, gaps and primary bottlenecks.',
        icon: AlertTriangle,
        color: 'text-[#E53935] bg-red-50 border-red-200',
      },
      {
        id: 'profile',
        title: language === 'si' ? 'සේවක විස්තර' : 'My Employee Details',
        prompt: language === 'si' ? 'මගේ සේවක පැතිකඩ සහ රාජකාරි තොරතුරු පෙන්වන්න' : 'Show my employee profile and work details.',
        desc: language === 'si' ? 'තනතුර, තැපැල් කාර්යාලය, කාණ්ඩය සහ පළපුරුද්ද' : 'Official designation, station, work category and experience.',
        icon: UserCheck,
        color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      },
      {
        id: 'improve',
        title: language === 'si' ? 'KPI වැඩිදියුණු කිරීම' : 'Improve My KPIs',
        prompt: language === 'si' ? 'ලබන සතියේ මගේ කාර්යසාධනය වැඩිදියුණු කරගන්නේ කෙසේද?' : 'How can I improve my performance next week?',
        desc: language === 'si' ? 'දෙපාර්තමේන්තු උපදෙස් සහ ක්‍රියාකාරී පියවර' : 'Targeted operational advice and category-tailored best practices.',
        icon: Sparkles,
        color: 'text-amber-600 bg-amber-50 border-amber-200',
      },
    ],
    [language]
  )

  // Follow-up quick pills
  const quickPills = useMemo(
    () => [
      {
        label: language === 'si' ? 'දින 7 ක සැලැස්ම' : '7-Day Improvement Plan',
        prompt: language === 'si' ? 'මට දින හතක ප්‍රායෝගික සැලැස්මක් දෙන්න.' : 'Give me a practical seven-day improvement plan.',
      },
      {
        label: language === 'si' ? 'අනාගත KPI පුරෝකථනය' : 'ML Forecast Projection',
        prompt: language === 'si' ? 'මගේ ඊළඟ සතියේ පුරෝකථනය කළ KPI අගය කුමක්ද?' : 'What is my predicted next-week KPI forecast?',
      },
      {
        label: language === 'si' ? 'ශක්තීන් විශ්ලේෂණය' : 'Top Strengths',
        prompt: language === 'si' ? 'මගේ ප්‍රධාන ශක්තීන් මොනවාද?' : 'What are my top strengths?',
      },
    ],
    [language]
  )

  return (
    <div className="flex flex-col h-[calc(100vh-4.25rem)] max-w-6xl mx-auto px-4 py-3">
      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0B1F3A] to-[#1677D2] flex items-center justify-center text-white shadow-md shadow-blue-900/10 shrink-0">
            <Bot className="w-5 h-5 text-blue-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#0B1F3A] tracking-tight">AI Productivity Coach</h1>
              {/* Green status indicator */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Performance Data Connected
              </span>
            </div>
            <p className="text-xs text-slate-500 font-normal">
              Your personal AI assistant for employee performance and career development.
            </p>
          </div>
        </div>

        {/* Controls: Employee selector (Postmaster), Language toggle, Clear Chat */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          {/* Employee selector for Postmasters */}
          {isPostmaster ? (
            <div className="relative">
              <select
                value={selectedEmployeeId}
                onChange={(e) => {
                  setSelectedEmployeeId(e.target.value)
                  handleClearChat()
                }}
                className="appearance-none bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg pl-3 pr-8 py-1.5 shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1677D2]"
                title="Select employee to coach"
              >
                {employees.map((emp) => (
                  <option key={emp.employee_id || emp._id} value={emp.employee_id || emp._id}>
                    {emp.employee_name || emp.name} ({emp.employee_id || emp._id})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          ) : currentEmployee ? (
            <div className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {currentEmployee.employee_name || currentEmployee.name} ({currentEmployee.employee_id || currentEmployee._id})
              </span>
            </div>
          ) : null}

          {/* Language Toggle */}
          <button
            type="button"
            onClick={() => setLanguage((prev) => (prev === 'en' ? 'si' : 'en'))}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            title="Toggle between English and Sinhala"
          >
            <Globe className="w-3.5 h-3.5 text-[#1677D2]" />
            <span>{language === 'en' ? 'EN' : 'සිංහල'}</span>
          </button>

          {/* Clear / New Conversation Button */}
          <button
            type="button"
            onClick={handleClearChat}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-[#E53935] transition-colors"
            title="Start New Conversation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Chat</span>
          </button>
        </div>
      </div>

      {/* ── CHAT CONTAINER ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-4 px-1 space-y-4">
        {errorBanner && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorBanner('')}
              className="text-red-500 hover:text-red-800 font-bold px-2"
            >
              ×
            </button>
          </div>
        )}

        {/* ── EMPTY STATE / WELCOME SCREEN ─────────────────────────────────── */}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[420px] text-center px-4 py-8 max-w-3xl mx-auto">
            {/* Sparkle badge */}
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#0B1F3A] to-[#1677D2] flex items-center justify-center text-white shadow-xl shadow-blue-900/15">
                <Sparkles className="w-8 h-8 text-blue-200" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                <CheckCircle2 className="w-3 h-3 text-white" />
              </span>
            </div>

            {/* Welcome title & description */}
            <h2 className="text-xl font-bold text-[#0B1F3A] mb-2 tracking-tight">
              {language === 'si'
                ? `ආයුබෝවන්! මම ඔබගේ PostAssist කාර්යසාධන උපදේශකයායි`
                : `Hello! I'm your PostAssist AI Performance Coach`}
            </h2>
            <p className="text-sm text-slate-600 max-w-xl mb-8 leading-relaxed">
              {language === 'si'
                ? `ඔබගේ සේවක පැතිකඩ, සතිපතා KPI වාර්තා, දුර්වලතා හා ශක්තීන් තේරුම් ගැනීමට සහ කාර්යසාධනය වැඩිදියුණු කිරීමට ප්‍රායෝගික සැලැස්මක් සකස් කර ගැනීමට මට ඔබට උදව් කළ හැකිය.`
                : `I can help you understand your employee profile, review your weekly performance, identify areas for improvement, and develop a practical plan to improve your KPIs.`}
            </p>

            {/* Currently reviewing indicator */}
            {currentEmployee && (
              <div className="inline-flex items-center gap-2 px-3 py-1 mb-8 rounded-full bg-blue-50 border border-blue-200/80 text-xs text-[#0B1F3A] font-medium">
                <User className="w-3.5 h-3.5 text-[#1677D2]" />
                <span>
                  Coaching Profile:{' '}
                  <strong>{currentEmployee.employee_name || currentEmployee.name}</strong> ({currentEmployee.designation || 'Postal Staff'})
                </span>
              </div>
            )}

            {/* 4 Clickable Suggestion Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full text-left">
              {suggestionCards.map((card) => {
                const Icon = card.icon
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => handleSendMessage(card.prompt)}
                    className="p-4 rounded-xl bg-white border border-slate-200/90 hover:border-[#1677D2] hover:shadow-md transition-all duration-150 group text-left flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`p-2 rounded-lg border ${card.color} shrink-0`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#1677D2] group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <h3 className="text-sm font-semibold text-[#0B1F3A] group-hover:text-[#1677D2] transition-colors mb-1">
                        {card.title}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{card.desc}</p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] font-medium text-slate-400 group-hover:text-slate-600 truncate">
                      "{card.prompt}"
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          /* ── MESSAGE THREAD ─────────────────────────────────────────────── */
          <div className="space-y-4 pb-2">
            {messages.map((msg) => {
              const isUser = msg.sender === 'user'

              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-sm ${
                      isUser
                        ? 'bg-[#0B1F3A] text-white'
                        : 'bg-gradient-to-tr from-[#1677D2] to-blue-400 text-white'
                    }`}
                  >
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  {/* Bubble Container */}
                  <div className={`max-w-[85%] sm:max-w-[75%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                    {/* Header: Sender and timestamp */}
                    <div className="flex items-center gap-1.5 px-1 mb-1 text-[11px] text-slate-400 font-medium">
                      <span>{isUser ? 'You' : 'PostAssist AI Coach'}</span>
                      <span>•</span>
                      <span>{msg.timestamp}</span>
                    </div>

                    {/* Content Box */}
                    <div
                      className={`p-4 rounded-2xl shadow-sm text-sm ${
                        isUser
                          ? 'bg-[#0B1F3A] text-white rounded-tr-none'
                          : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-none'
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                      ) : (
                        <div>
                          <FormattedContent content={msg.text} />

                          {/* Machine Learning Forecast Card if present */}
                          {msg.forecast && msg.forecast.predicted_kpi != null && (
                            <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-col gap-1.5">
                              <div className="flex items-center justify-between bg-blue-50/70 border border-blue-200/60 rounded-lg p-2.5">
                                <div className="flex items-center gap-2">
                                  <Sparkles className="w-4 h-4 text-[#1677D2] shrink-0" />
                                  <span className="text-xs font-semibold text-[#0B1F3A]">
                                    Projected Next-Week KPI:
                                  </span>
                                </div>
                                <span className="text-sm font-bold text-[#1677D2]">
                                  {Number(msg.forecast.predicted_kpi).toFixed(1)}%
                                </span>
                              </div>
                              {msg.forecast.disclaimer && (
                                <p className="text-[11px] text-slate-400 italic px-1">
                                  {msg.forecast.disclaimer}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Recommendations pills if any */}
                          {Array.isArray(msg.recommendations) && msg.recommendations.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-100">
                              <span className="text-xs font-semibold text-slate-700 block mb-2">
                                Key Action Points:
                              </span>
                              <div className="space-y-1.5">
                                {msg.recommendations.slice(0, 3).map((rec, rIdx) => (
                                  <div
                                    key={rIdx}
                                    className="p-2 rounded bg-slate-50 border border-slate-200/60 text-xs text-slate-700"
                                  >
                                    <strong className="text-[#0B1F3A]">{rec.title || rec.headline}:</strong>{' '}
                                    <span>{rec.action || rec.actions?.[0]}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Typing / Loading Indicator */}
            {loading && (
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#1677D2] to-blue-400 flex items-center justify-center shrink-0 text-white shadow-sm">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-3.5 shadow-sm flex items-center gap-2.5 text-xs font-medium text-slate-500">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#1677D2] animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 rounded-full bg-[#1677D2] animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 rounded-full bg-[#1677D2] animate-bounce" />
                  </div>
                  <span>Analyzing performance records & verified KPIs...</span>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>
        )}
      </div>

      {/* ── COMPOSER / INPUT AREA ───────────────────────────────────────────── */}
      <div className="pt-2 border-t border-slate-200 shrink-0">
        {/* Quick follow-up pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0 flex items-center gap-1">
            <Lightbulb className="w-3 h-3 text-amber-500" />
            Quick:
          </span>
          {quickPills.map((pill, pIdx) => (
            <button
              key={pIdx}
              type="button"
              disabled={loading}
              onClick={() => handleSendMessage(pill.prompt)}
              className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-[#1677D2] hover:border-blue-200 border border-slate-200 rounded-full text-xs font-medium text-slate-600 shrink-0 transition-colors disabled:opacity-50"
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Input box */}
        <div className="relative flex items-center bg-white border border-slate-300 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-[#1677D2] focus-within:border-transparent transition-all">
          <textarea
            ref={inputRef}
            rows={1}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              language === 'si'
                ? 'කාර්යසාධනය, සේවක විස්තර හෝ වැඩිදියුණු කිරීම පිළිබඳව අසන්න...'
                : 'Ask about your performance, employee details, or how to improve...'
            }
            disabled={loading}
            className="w-full pl-4 pr-12 py-3 bg-transparent text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none max-h-32 leading-relaxed"
          />

          {/* Send button */}
          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim() || loading}
            className="absolute right-2.5 p-2 rounded-xl bg-[#1677D2] hover:bg-[#0B1F3A] text-white disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors shadow-sm"
            title="Send message (Enter)"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Footnote */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-2 pt-1.5 font-normal">
          <span>Press Enter to send · Shift+Enter for new line</span>
          <span>Sri Lanka Postal Department · Official Performance Coach</span>
        </div>
      </div>
    </div>
  )
}
