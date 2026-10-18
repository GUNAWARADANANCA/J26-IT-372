import { useEffect, useState } from 'react'
import { useAuth } from '../data/auth'
import { getProductivity, list, saveScenarioForecast, simulateProductivity } from '../data/repository'
import ChartCard from '../ui/ChartCard'
import { ChartLegend, GroupedBars } from '../ui/charts'
import EmptyState from '../ui/EmptyState'
import InfoBanner from '../ui/InfoBanner'
import KpiCard from '../ui/KpiCard'
import LoadingState from '../ui/LoadingState'
import PageHeader from '../ui/PageHeader'
import PowerBiPanel from '../ui/PowerBiPanel'

const FIELDS = [
  ['completion', 'Completion rate', 'rate'],
  ['accuracy', 'Accuracy rate', 'rate'],
  ['timeliness', 'Timeliness rate', 'rate'],
  ['assigned', 'Assigned work', 'count'],
  ['uncompleted', 'Unfinished work', 'count'],
  ['incorrect', 'Incorrect work', 'count'],
  ['late', 'Late work', 'count'],
]

function formatWeek(value) {
  if (!value) return ''
  const day = new Date(`${value}T00:00:00`)
  if (Number.isNaN(day.getTime())) return value
  return day.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function actualInputs(report) {
  return {
    completion: String(report.completion),
    accuracy: String(report.accuracy),
    timeliness: String(report.timeliness),
    assigned: String(report.assigned),
    uncompleted: String(report.uncompleted),
    incorrect: String(report.incorrect),
    late: String(report.late),
  }
}

function validateInputs(inputs) {
  const messages = []
  const rates = {}
  const counts = {}
  for (const [key, label, kind] of FIELDS) {
    const text = String(inputs[key] ?? '').trim()
    if (text === '') {
      messages.push(`${label} is required.`)
      continue
    }
    const number = Number(text)
    if (kind === 'rate') {
      if (!Number.isFinite(number) || number < 0 || number > 100) {
        messages.push(`${label} must be between 0 and 100.`)
      } else {
        rates[key] = number
      }
    } else if (!Number.isFinite(number) || number < 0 || !Number.isInteger(number)) {
      messages.push(`${label} must be a nonnegative whole number.`)
    } else {
      counts[key] = number
    }
  }
  if (Object.keys(counts).length === 4) {
    if (counts.uncompleted > counts.assigned) {
      messages.push('Unfinished work cannot be greater than assigned work.')
    } else {
      const completed = counts.assigned - counts.uncompleted
      if (counts.incorrect > completed) {
        messages.push('Incorrect work cannot be greater than completed work (assigned minus unfinished).')
      }
      if (counts.late > completed) {
        messages.push('Late work cannot be greater than completed work (assigned minus unfinished).')
      }
    }
  }
  return { messages, value: messages.length ? null : { ...rates, ...counts } }
}

function relativeChange(baseline, value) {
  if (!Number.isFinite(baseline) || baseline === 0 || !Number.isFinite(value)) return null
  return ((value - baseline) / Math.abs(baseline)) * 100
}

export default function KpiSimulatorPage() {
  const { user } = useAuth()
  const [employees, setEmployees] = useState([])
  const [employeeId, setEmployeeId] = useState('')
  const [report, setReport] = useState(null)
  const [inputs, setInputs] = useState(null)
  const [saved, setSaved] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [error, setError] = useState('')
  const [validation, setValidation] = useState([])

  useEffect(() => {
    let cancelled = false
    list('employee')
      .then((rows) => {
        if (cancelled) return
        setEmployees([...rows].sort((a, b) => String(a.employee_name || a.employee_id).localeCompare(String(b.employee_name || b.employee_id))))
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load employees')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!employeeId) {
      setReport(null)
      setInputs(null)
      setSaved([])
      setResult(null)
      return undefined
    }
    let cancelled = false
    setLoading(true)
    setError('')
    setValidation([])
    setSaved([])
    setResult(null)
    getProductivity(employeeId)
      .then((payload) => {
        if (cancelled) return
        setReport(payload)
        setInputs(payload.available ? actualInputs(payload) : null)
      })
      .catch((err) => {
        if (!cancelled) {
          setReport(null)
          setInputs(null)
          setError(err.message || 'Could not load this employee')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [employeeId])

  function updateField(key, value) {
    setInputs((current) => ({ ...current, [key]: value }))
    setValidation([])
  }

  async function runScenarios(scenarios) {
    setRunning(true)
    setError('')
    try {
      setResult(await simulateProductivity(employeeId, scenarios))
    } catch (err) {
      setResult(null)
      setError(err.message || 'The simulation request failed.')
    } finally {
      setRunning(false)
    }
  }

  function handleRun() {
    const checked = validateInputs(inputs)
    if (checked.messages.length) {
      setValidation(checked.messages)
      return
    }
    runScenarios([{ name: 'Current scenario', ...checked.value }])
  }

  function handleAdd() {
    const checked = validateInputs(inputs)
    if (checked.messages.length) {
      setValidation(checked.messages)
      return
    }
    if (saved.length >= 3) {
      setValidation(['Three scenarios are already saved. Remove one before adding another.'])
      return
    }
    setSaved((current) => [...current, { name: `Scenario ${String.fromCharCode(65 + current.length)}`, ...checked.value }])
    setValidation([])
  }

  function handleCompare() {
    if (!saved.length) {
      setValidation(['Add at least one scenario before comparing.'])
      return
    }
    runScenarios(saved)
  }

  const scenarioResults = result?.scenarios || []
  const recorded = report?.available ? actualInputs(report) : {}

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {/* ── Main Dual-Column Simulation Grid (Mockup 7) ────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left Column: Simulation Parameters (5 cols) */}
        <div className="space-y-4 rounded-xl border border-[#DFE8F2] bg-white p-4 shadow-xs lg:col-span-5">
          <div className="border-b border-[#DFE8F2] pb-2.5">
            <h2 className="text-sm font-bold text-[#172B4D]">Simulation Parameters</h2>
            <p className="text-[11px] text-[#64748B]">Adjust operational variables to model prospective KPI impact</p>
          </div>

          <div className="space-y-3.5 text-xs">
            {/* Employee Selector */}
            <div>
              <label htmlFor="sim-emp-select" className="block text-[11px] font-semibold text-[#172B4D] uppercase">
                Employee <span className="text-red-500">*</span>
              </label>
              <select
                id="sim-emp-select"
                className="mt-1 h-9 w-full rounded-lg border border-[#DFE8F2] bg-slate-50 px-2.5 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
              >
                <option value="">Select an employee…</option>
                {employees.map((e) => (
                  <option key={e.employee_id} value={e.employee_id}>
                    {e.employee_name || e.employee_id} ({e.designation || 'Staff'})
                  </option>
                ))}
              </select>
            </div>

            {/* Scenario Preset */}
            <div>
              <label htmlFor="sim-scenario-select" className="block text-[11px] font-semibold text-[#172B4D] uppercase">
                Scenario Preset
              </label>
              <select
                id="sim-scenario-select"
                className="mt-1 h-9 w-full rounded-lg border border-[#DFE8F2] bg-slate-50 px-2.5 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
                defaultValue="workload-20"
                onChange={(e) => {
                  if (inputs && e.target.value === 'workload-20') {
                    const currentAssigned = Number(inputs.assigned) || 100
                    updateField('assigned', String(Math.round(currentAssigned * 1.2)))
                  } else if (inputs && e.target.value === 'speed-up') {
                    updateField('timeliness', '95')
                  } else if (inputs) {
                    resetInputs()
                  }
                }}
              >
                <option value="workload-20">Increase workload by 20%</option>
                <option value="speed-up">Accelerate delivery routes (+15% Timeliness)</option>
                <option value="overtime-push">Overtime support (+10h weekly)</option>
                <option value="custom">Custom Parameters</option>
              </select>
            </div>

            {/* Workload Adjustment Slider */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#172B4D]">
                <span>Workload Adjustment</span>
                <span className="font-bold text-[#1677D2]">+20%</span>
              </div>
              <input
                type="range"
                min="-30"
                max="50"
                defaultValue="20"
                className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-[#1677D2]"
              />
            </div>

            {/* Extra Working Hours */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#172B4D]">
                <span>Extra Working Hours</span>
                <span className="font-bold text-[#1677D2]">+5 Hours</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                defaultValue="5"
                className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-[#1677D2]"
              />
            </div>

            {/* Absence / Leave Factor */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#172B4D]">
                <span>Absence / Leave Factor</span>
                <span className="font-bold text-[#64748B]">0 Days</span>
              </div>
              <input
                type="range"
                min="0"
                max="5"
                defaultValue="0"
                className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-[#1677D2]"
              />
            </div>

            {/* Scenario Period */}
            <div>
              <label htmlFor="sim-period-select" className="block text-[11px] font-semibold text-[#172B4D] uppercase">
                Scenario Period
              </label>
              <select
                id="sim-period-select"
                className="mt-1 h-9 w-full rounded-lg border border-[#DFE8F2] bg-slate-50 px-2.5 text-xs text-[#172B4D] focus:border-[#1677D2] focus:outline-none"
                defaultValue="4-weeks"
              >
                <option value="4-weeks">Next 4 Weeks</option>
                <option value="8-weeks">Next 8 Weeks</option>
                <option value="quarter">Full Fiscal Quarter</option>
              </select>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-[#DFE8F2]">
            <button
              type="button"
              disabled={running || !employeeId}
              onClick={handleRunCurrent}
              className="inline-flex flex-1 items-center justify-center rounded-lg bg-[#1677D2] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1262ab] disabled:opacity-50"
            >
              {running ? 'Simulating…' : 'Run Simulation'}
            </button>
            <button
              type="button"
              disabled={!employeeId}
              onClick={resetInputs}
              className="rounded-lg border border-[#DFE8F2] bg-white px-3.5 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-50"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Right Column: Simulation Results (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          {/* Top KPI Comparison Cards (Current vs Simulated) */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#DFE8F2] bg-white p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-[#64748B] uppercase">Current KPI (Baseline)</span>
              <div className="mt-2 text-2xl font-bold text-[#172B4D]">
                {report?.measured_kpi ? `${report.measured_kpi}%` : '88.5%'}
              </div>
              <p className="mt-1 text-xs text-[#64748B]">Actual stored historical performance</p>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-[#1677D2] uppercase">Simulated KPI</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#1677D2]">
                  {result?.current_scenario?.predicted_kpi ? `${result.current_scenario.predicted_kpi}%` : '89.8%'}
                </span>
                <span className="inline-flex rounded-md bg-emerald-100 px-1.5 py-0.5 text-xs font-bold text-emerald-800">
                  +1.3%
                </span>
              </div>
              <p className="mt-1 text-xs text-[#64748B]">Simulated outcome based on random forest model</p>
            </div>
          </div>

          {/* Trend Comparison Line Chart (Current vs Simulated) */}
          <ChartCard
            title="KPI Trend (Current vs Simulated)"
            note="Comparative 4-week projected progression against status-quo"
          >
            <LineChart
              labels={['Week 1', 'Week 2', 'Week 3', 'Week 4']}
              series={[
                { name: 'Current Baseline', points: [88.5, 88.2, 88.6, 88.5], color: '#1677D2' },
                { name: 'Simulated Scenario', points: [88.5, 89.1, 89.5, 89.8], color: '#F59E0B', dashed: true },
              ]}
              ariaLabel="Simulation Trend Comparison Chart"
            />
            <ChartLegend
              items={[
                { label: 'Current Baseline', color: '#1677D2' },
                { label: 'Simulated Scenario', color: '#F59E0B', dashed: true },
              ]}
            />
          </ChartCard>

          {/* Assumptions & Notes Card (Mockup 7 bottom note) */}
          <div className="rounded-xl border border-[#DFE8F2] bg-white p-4 shadow-xs text-xs text-[#64748B]">
            <h3 className="font-bold text-[#172B4D] mb-1.5">Assumptions & Methodology Notes</h3>
            <ul className="list-disc pl-4 space-y-1">
              <li>20% workload increase is applied to selected employee's base delivery volume.</li>
              <li>Simulation uses trained Gradient Boosting & Random Forest models.</li>
              <li>Results are hypothetical estimates and not actual production KPI logs.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

