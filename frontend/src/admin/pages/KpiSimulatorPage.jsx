import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  History,
  Info,
  Loader2,
  RotateCcw,
  Sliders,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '../data/auth'
import {
  getEmployeeKpiHistory,
  getKpiSimulations,
  list,
  simulateKpi,
} from '../data/repository'
import {
  PERIOD_OPTIONS,
  SCENARIO_PRESETS,
  formatChangeBadge,
  formatSignedHours,
  formatSignedPercent,
  validateSimulationParameters,
} from './kpiSimulatorHelpers'

export default function KpiSimulatorPage() {
  const { user } = useAuth()
  const [employees, setEmployees] = useState([])
  const [employeeId, setEmployeeId] = useState('')
  const [employeeBaseline, setEmployeeBaseline] = useState(null)

  // Simulation form state
  const [scenarioId, setScenarioId] = useState('workload-20')
  const [workloadAdj, setWorkloadAdj] = useState(20)
  const [extraHours, setExtraHours] = useState(5)
  const [absenceRate, setAbsenceRate] = useState(0)
  const [periodWeeks, setPeriodWeeks] = useState(4)

  // Execution state
  const [running, setRunning] = useState(false)
  const [loadingBaseline, setLoadingBaseline] = useState(false)
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState([])
  const [simulationResult, setSimulationResult] = useState(null)

  // History & Tooltip state
  const [simHistory, setSimHistory] = useState([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [hoveredPoint, setHoveredPoint] = useState(null)

  // Load employee list on mount
  useEffect(() => {
    let cancelled = false
    list('employee')
      .then((rows) => {
        if (cancelled) return
        const sorted = [...rows].sort((a, b) =>
          String(a.employee_name || a.employee_id).localeCompare(
            String(b.employee_name || b.employee_id),
          ),
        )
        setEmployees(sorted)
        // Default to first employee if available (e.g. EMP1137)
        if (sorted.length > 0 && !employeeId) {
          setEmployeeId(sorted[0].employee_id)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load employees.')
      })

    // Fetch initial simulations history
    getKpiSimulations(10)
      .then((rows) => {
        if (!cancelled && Array.isArray(rows)) setSimHistory(rows)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  // When selected employee changes, fetch their live baseline
  useEffect(() => {
    if (!employeeId) {
      setEmployeeBaseline(null)
      return undefined
    }
    let cancelled = false
    setLoadingBaseline(true)
    setError('')
    setValidationErrors([])

    getEmployeeKpiHistory(employeeId)
      .then((data) => {
        if (cancelled) return
        setEmployeeBaseline(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Could not load employee baseline.')
          setEmployeeBaseline(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingBaseline(false)
      })

    return () => {
      cancelled = true
    }
  }, [employeeId])

  // Handle Scenario Preset Change
  function handleScenarioChange(newScenarioId) {
    setScenarioId(newScenarioId)
    const preset = SCENARIO_PRESETS.find((s) => s.id === newScenarioId)
    if (preset && preset.id !== 'custom') {
      setWorkloadAdj(preset.workloadAdj)
      setExtraHours(preset.extraHours)
      setAbsenceRate(preset.absenceRate)
    }
    setValidationErrors([])
  }

  // Handle manual slider adjustments (sets scenario to custom if deviates)
  function handleWorkloadSlider(val) {
    setWorkloadAdj(Number(val))
    setScenarioId('custom')
    setValidationErrors([])
  }

  function handleExtraHoursSlider(val) {
    setExtraHours(Number(val))
    setScenarioId('custom')
    setValidationErrors([])
  }

  function handleAbsenceRateSlider(val) {
    setAbsenceRate(Number(val))
    setScenarioId('custom')
    setValidationErrors([])
  }

  // Reset to default preset
  function handleReset() {
    setScenarioId('workload-20')
    setWorkloadAdj(20)
    setExtraHours(5)
    setAbsenceRate(0)
    setPeriodWeeks(4)
    setError('')
    setValidationErrors([])
  }

  // Run Simulation
  async function handleRunSimulation() {
    setError('')
    const validation = validateSimulationParameters({
      employeeId,
      workloadAdj,
      extraHours,
      absenceRate,
    })
    if (!validation.isValid) {
      setValidationErrors(validation.errors)
      return
    }

    const currentPreset = SCENARIO_PRESETS.find((s) => s.id === scenarioId)
    const scenarioName =
      scenarioId === 'custom'
        ? 'Custom Scenario'
        : currentPreset?.label || 'Custom Scenario'

    setRunning(true)
    try {
      const payload = {
        employee_id: employeeId,
        scenario: scenarioName,
        workload_adjustment_percent: workloadAdj,
        extra_hours_per_week: extraHours,
        absence_rate_percent: absenceRate,
        period_weeks: periodWeeks,
      }
      const result = await simulateKpi(payload)
      setSimulationResult(result)

      // Refresh recent simulations
      getKpiSimulations(10)
        .then((rows) => {
          if (Array.isArray(rows)) setSimHistory(rows)
        })
        .catch(() => {})
    } catch (err) {
      setError(err.message || 'Simulation execution failed.')
    } finally {
      setRunning(false)
    }
  }

  // Active baseline and display values
  const activeBaselineKpi = employeeBaseline?.baseline_kpi ?? 88.5
  const simulatedKpi = simulationResult?.simulated_kpi ?? 89.8
  const kpiChange = simulationResult
    ? simulationResult.kpi_change
    : Number((simulatedKpi - activeBaselineKpi).toFixed(1))
  const changeBadge = formatChangeBadge(kpiChange)

  // Chart data points
  const chartLabels = useMemo(() => {
    if (simulationResult?.trend?.labels?.length) {
      return simulationResult.trend.labels
    }
    return ['Week 1', 'Week 2', 'Week 3', 'Week 4']
  }, [simulationResult])

  const currentTrendPoints = useMemo(() => {
    if (simulationResult?.trend?.current?.length) {
      return simulationResult.trend.current
    }
    // Default reference trajectory: 90.0 -> 86.5 -> 83.0 -> 84.0
    return [90.0, 86.5, 83.2, 84.0]
  }, [simulationResult])

  const simulatedTrendPoints = useMemo(() => {
    if (simulationResult?.trend?.simulated?.length) {
      return simulationResult.trend.simulated
    }
    // Default reference trajectory: 84.5 -> 81.2 -> 78.0 -> 74.5
    return [84.8, 81.4, 78.2, 74.6]
  }, [simulationResult])

  // Assumptions & Notes
  const displayNotes = useMemo(() => {
    if (simulationResult?.assumptions?.length) {
      return simulationResult.assumptions
    }
    const notes = []
    if (workloadAdj !== 0) {
      notes.push(
        `${Math.abs(workloadAdj)}% workload ${workloadAdj > 0 ? 'increase' : 'decrease'} is applied to selected employee(s).`,
      )
    } else {
      notes.push('Standard baseline delivery volume maintained (0% adjustment).')
    }
    notes.push('Simulation uses trained Gradient Boosting model.')
    notes.push('Results are estimates and not actual KPI records.')
    if (extraHours > 0) {
      notes.push(
        `Extra working hours (+${extraHours}h) are treated as a scenario capacity input, not approved overtime.`,
      )
    }
    return notes
  }, [simulationResult, workloadAdj, extraHours])

  const userName = user?.name || user?.username || 'Postmaster'
  const officeName = user?.post_office || 'Kaduwela'
  const initials = userName.slice(0, 2).toUpperCase()

  return (
    <div className="space-y-4 pb-10">
      {/* ── Top Blue Banner (matches Screen 7 reference) ────────────────── */}
      <div className="flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#185DC7] to-[#1677D2] px-5 py-3 text-white shadow-xs">
        <span className="text-sm font-bold tracking-tight">7. KPI Simulator</span>
        <span className="text-xs font-normal text-blue-100">
          — Explore what-if scenarios
        </span>
      </div>

      {/* ── Page Title & User Info Bar ──────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#0F172A] sm:text-2xl">
            KPI Simulator
          </h1>
          <p className="text-xs text-[#64748B]">
            Test different scenarios and see how changes may impact KPI performance.
          </p>
        </div>

        {/* User Pill & Notifications */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="relative grid size-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-2xs hover:bg-slate-50 transition-colors"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="size-4 text-slate-500" />
            <span className="absolute top-2 right-2 size-1.5 rounded-full bg-blue-600" />
          </button>
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-2xs">
            <span className="grid size-7 place-items-center rounded-full bg-[#1677D2] text-[11px] font-bold text-white shadow-xs">
              {initials}
            </span>
            <div className="text-left">
              <div className="text-xs font-semibold text-[#0F172A] leading-tight">
                {userName}
              </div>
              <div className="text-[10px] text-[#64748B] leading-tight">
                {officeName}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Error & Validation Notifications ────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <AlertCircle className="size-4 shrink-0 mt-0.5 text-red-600" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
          {validationErrors.map((msg, i) => (
            <p key={i} className="flex items-center gap-1.5">
              <span className="size-1 rounded-full bg-amber-600" />
              {msg}
            </p>
          ))}
        </div>
      )}

      {/* ── Main Two-Column Layout (Parameters vs Results) ──────────────── */}
      <div className="grid gap-5 lg:grid-cols-12 items-start">
        {/* ── Left Column: Simulation Parameters (5 cols) ───────────────── */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-4 lg:col-span-5">
          <div>
            <h2 className="text-sm font-bold text-[#0F172A]">
              Simulation Parameters
            </h2>
            <p className="text-[11px] text-[#64748B]">
              Configure scenario variables to forecast prospective employee outcomes
            </p>
          </div>

          <div className="space-y-4 text-xs">
            {/* Employee Selector */}
            <div>
              <label
                htmlFor="sim-employee-select"
                className="block text-[11px] font-semibold text-[#334155] uppercase tracking-wider mb-1"
              >
                Employee
              </label>
              <div className="relative">
                <select
                  id="sim-employee-select"
                  className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/70 px-3 pr-8 text-xs font-medium text-[#0F172A] focus:border-[#1677D2] focus:bg-white focus:outline-none transition-all"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  disabled={running}
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.employee_id} value={emp.employee_id}>
                      {emp.employee_name || emp.employee_id} ({emp.employee_id})
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-3 size-4 text-slate-400" />
              </div>
              {loadingBaseline && (
                <p className="mt-1 flex items-center gap-1 text-[10px] text-blue-600">
                  <Loader2 className="size-3 animate-spin" /> Loading employee baseline...
                </p>
              )}
            </div>

            {/* Scenario Selector */}
            <div>
              <label
                htmlFor="sim-scenario-select"
                className="block text-[11px] font-semibold text-[#334155] uppercase tracking-wider mb-1"
              >
                Scenario
              </label>
              <div className="relative">
                <select
                  id="sim-scenario-select"
                  className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/70 px-3 pr-8 text-xs font-medium text-[#0F172A] focus:border-[#1677D2] focus:bg-white focus:outline-none transition-all"
                  value={scenarioId}
                  onChange={(e) => handleScenarioChange(e.target.value)}
                  disabled={running}
                >
                  {SCENARIO_PRESETS.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-3 size-4 text-slate-400" />
              </div>
            </div>

            {/* Workload Adjustment Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-[#0F172A]">
                <span>Workload Adjustment</span>
                <span className="font-bold text-[#1677D2]">
                  {formatSignedPercent(workloadAdj)}
                </span>
              </div>
              <div className="relative flex items-center">
                <input
                  type="range"
                  min="-50"
                  max="50"
                  step="5"
                  value={workloadAdj}
                  onChange={(e) => handleWorkloadSlider(e.target.value)}
                  disabled={running}
                  aria-label="Workload Adjustment"
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-[#1677D2] focus:outline-none"
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>-50%</span>
                <span>0%</span>
                <span>+50%</span>
              </div>
            </div>

            {/* Extra Working Hours Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-[#0F172A]">
                <span>Extra Working Hours</span>
                <span className="font-bold text-[#1677D2]">
                  {formatSignedHours(extraHours)}
                </span>
              </div>
              <div className="relative flex items-center">
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  value={extraHours}
                  onChange={(e) => handleExtraHoursSlider(e.target.value)}
                  disabled={running}
                  aria-label="Extra Working Hours"
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-[#1677D2] focus:outline-none"
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>0 hrs</span>
                <span>10 hrs</span>
                <span>20 hrs</span>
              </div>
            </div>

            {/* Absence Rate Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-[#0F172A]">
                <div className="flex items-center gap-1.5">
                  <span>Absence Rate</span>
                  {employeeBaseline && (
                    <span className="text-[10px] font-normal text-slate-500">
                      (Base: {employeeBaseline.baseline_absence_rate}%)
                    </span>
                  )}
                </div>
                <span className="font-bold text-[#64748B]">{absenceRate}%</span>
              </div>
              <div className="relative flex items-center">
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={absenceRate}
                  onChange={(e) => handleAbsenceRateSlider(e.target.value)}
                  disabled={running}
                  aria-label="Absence Rate"
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-[#1677D2] focus:outline-none"
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
              </div>
            </div>

            {/* Scenario Period Selector */}
            <div>
              <label
                htmlFor="sim-period-select"
                className="block text-[11px] font-semibold text-[#334155] uppercase tracking-wider mb-1"
              >
                Scenario Period
              </label>
              <div className="relative">
                <select
                  id="sim-period-select"
                  className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/70 px-3 pr-8 text-xs font-medium text-[#0F172A] focus:border-[#1677D2] focus:bg-white focus:outline-none transition-all"
                  value={periodWeeks}
                  onChange={(e) => setPeriodWeeks(Number(e.target.value))}
                  disabled={running}
                >
                  {PERIOD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-3 size-4 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={running || !employeeId}
              onClick={handleRunSimulation}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#1677D2] px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#1262ab] disabled:opacity-50 transition-all cursor-pointer"
            >
              {running ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Simulating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  <span>Run Simulation</span>
                </>
              )}
            </button>
            <button
              type="button"
              disabled={running}
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-[#64748B] hover:bg-slate-50 hover:text-slate-800 transition-all cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* ── Right Column: Simulation Results & Charts (7 cols) ─────────── */}
        <div className="space-y-4 lg:col-span-7">
          {/* 1. Simulation Results Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#0F172A]">Simulation Results</h2>
              {simulationResult && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                  <CheckCircle2 className="size-3 text-blue-600" /> Simulated
                </span>
              )}
            </div>

            {/* Results Two-Card Comparison */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Current KPI Box */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <span className="text-[11px] font-medium text-slate-500">
                  Current KPI
                </span>
                <div className="mt-1 text-3xl font-extrabold text-[#0F172A] tracking-tight">
                  {activeBaselineKpi.toFixed(1)}%
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {employeeBaseline?.has_real_logs
                    ? 'Active measured baseline from logs'
                    : 'Standard baseline estimate'}
                </p>
              </div>

              {/* Simulated KPI Box */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4">
                <span className="text-[11px] font-medium text-slate-500">
                  Simulated KPI
                </span>
                <div className="mt-1 flex items-baseline gap-2.5">
                  <span className="text-3xl font-extrabold text-[#0F172A] tracking-tight">
                    {simulatedKpi.toFixed(1)}%
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold border ${changeBadge.bgClass}`}
                  >
                    <span>{changeBadge.symbol}</span>
                    <span>{changeBadge.text}</span>
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {simulationResult
                    ? 'Trained Gradient Boosting model'
                    : 'Prospective scenario outcome'}
                </p>
              </div>
            </div>

            {/* Metadata Footer */}
            {simulationResult && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                <span className="font-semibold text-slate-700">
                  {simulationResult.employee_name} ({simulationResult.employee_id})
                </span>
                <span>•</span>
                <span>Scenario: {simulationResult.scenario}</span>
                <span>•</span>
                <span>Period: {PERIOD_OPTIONS.find((p) => p.value === simulationResult.period_weeks)?.label || '4 weeks'}</span>
                <span>•</span>
                <span>Run: {new Date(simulationResult.run_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            )}
          </div>

          {/* 2. KPI Trend (Current vs Simulated) Chart Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#0F172A]">
                KPI Trend (Current vs Simulated)
              </h2>

              {/* Chart Legend */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-slate-600">
                  <span className="size-2.5 rounded-full bg-[#1677D2]" />
                  <span>Current</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium text-slate-600">
                  <span className="size-2.5 rounded-full bg-[#F59E0B]" />
                  <span>Simulated</span>
                </div>
              </div>
            </div>

            {/* Interactive SVG Line Chart */}
            <div className="relative pt-2">
              <KpiTrendChart
                labels={chartLabels}
                currentPoints={currentTrendPoints}
                simulatedPoints={simulatedTrendPoints}
                onHoverPoint={setHoveredPoint}
              />

              {/* Hover Tooltip Overlay */}
              {hoveredPoint && (
                <div
                  className="pointer-events-none absolute z-10 rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-md"
                  style={{
                    left: `${Math.min(Math.max(hoveredPoint.xPercent, 15), 85)}%`,
                    top: '25px',
                    transform: 'translateX(-50%)',
                  }}
                >
                  <p className="font-bold text-slate-800">{hoveredPoint.label}</p>
                  <p className="text-[#1677D2]">
                    Current: <span className="font-semibold">{hoveredPoint.currentVal}%</span>
                  </p>
                  <p className="text-[#F59E0B]">
                    Simulated: <span className="font-semibold">{hoveredPoint.simulatedVal}%</span>
                  </p>
                  <p className="text-slate-500 text-[10px]">
                    Diff: {hoveredPoint.diff > 0 ? `+${hoveredPoint.diff}%` : `${hoveredPoint.diff}%`}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 3. Assumptions & Notes Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-2.5">
            <h2 className="text-sm font-bold text-[#0F172A]">
              Assumptions & Notes
            </h2>
            <ul className="space-y-2 text-xs text-slate-600">
              {displayNotes.map((note, index) => (
                <li key={index} className="flex items-start gap-2.5">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#1677D2]" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 4. Recent Simulations History (Collapsible) */}
          {simHistory.length > 0 && (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                className="flex w-full items-center justify-between text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <History className="size-4 text-slate-500" />
                  <span>Recent Simulations ({simHistory.length})</span>
                </div>
                {historyOpen ? (
                  <ChevronUp className="size-4 text-slate-400" />
                ) : (
                  <ChevronDown className="size-4 text-slate-400" />
                )}
              </button>

              {historyOpen && (
                <div className="mt-3 overflow-x-auto pt-2 border-t border-slate-100">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-semibold uppercase text-slate-400">
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Officer</th>
                        <th className="pb-2">Scenario</th>
                        <th className="pb-2">Baseline</th>
                        <th className="pb-2">Simulated</th>
                        <th className="pb-2">Diff</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-slate-700">
                      {simHistory.map((row) => {
                        const badge = formatChangeBadge(row.kpi_change)
                        return (
                          <tr key={row.simulation_id} className="hover:bg-slate-50/60">
                            <td className="py-2 text-[11px] text-slate-500">
                              {row.created_at
                                ? new Date(row.created_at).toLocaleDateString([], {
                                    month: 'short',
                                    day: 'numeric',
                                  })
                                : 'Recent'}
                            </td>
                            <td className="py-2 font-medium">
                              {row.employee_name || row.employee_id}
                            </td>
                            <td className="py-2 max-w-[150px] truncate text-slate-600">
                              {row.scenario}
                            </td>
                            <td className="py-2 font-medium">
                              {row.current_kpi}%
                            </td>
                            <td className="py-2 font-medium text-slate-900">
                              {row.simulated_kpi}%
                            </td>
                            <td className="py-2">
                              <span
                                className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${badge.bgClass}`}
                              >
                                {badge.text}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Interactive SVG Line Chart matching the exact visual style of the reference image:
 * Y-axis from 70 to 100 with ticks at 70, 80, 90, 100
 * Blue line with circles for Current
 * Orange line with circles for Simulated
 */
function KpiTrendChart({
  labels,
  currentPoints,
  simulatedPoints,
  onHoverPoint,
}) {
  const width = 640
  const height = 220
  const pad = { left: 42, right: 24, top: 20, bottom: 32 }

  // Fixed Y scale from 70 to 100 as shown in the screenshot
  const yMin = 70
  const yMax = 100
  const yTicks = [100, 90, 80, 70]

  const count = labels.length
  const xStep = (width - pad.left - pad.right) / Math.max(count - 1, 1)

  function xAt(index) {
    return pad.left + index * xStep
  }

  function yAt(val) {
    const clamped = Math.max(yMin, Math.min(yMax, Number(val) || yMin))
    const ratio = (clamped - yMin) / (yMax - yMin)
    return height - pad.bottom - ratio * (height - pad.top - pad.bottom)
  }

  // Build SVG polyline points
  const currentSvgPoints = currentPoints
    .map((val, i) => `${xAt(i)},${yAt(val)}`)
    .join(' ')

  const simulatedSvgPoints = simulatedPoints
    .map((val, i) => `${xAt(i)},${yAt(val)}`)
    .join(' ')

  return (
    <div className="w-full select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-56 overflow-visible"
        role="img"
        aria-label="KPI Trend (Current vs Simulated)"
      >
        {/* Horizontal Grid lines and Y-axis labels */}
        {yTicks.map((tick) => {
          const y = yAt(tick)
          return (
            <g key={tick}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y}
                y2={y}
                stroke="#E2E8F0"
                strokeWidth="1"
              />
              <text
                x={pad.left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="#94A3B8"
                fontWeight="500"
              >
                {tick}
              </text>
            </g>
          )
        })}

        {/* Blue Line: Current Baseline */}
        <polyline
          fill="none"
          stroke="#1677D2"
          strokeWidth="2.5"
          points={currentSvgPoints}
        />

        {/* Orange Line: Simulated Scenario */}
        <polyline
          fill="none"
          stroke="#F59E0B"
          strokeWidth="2.5"
          points={simulatedSvgPoints}
        />

        {/* Current Circular Markers */}
        {currentPoints.map((val, i) => {
          const cx = xAt(i)
          const cy = yAt(val)
          return (
            <circle
              key={`curr-${i}`}
              cx={cx}
              cy={cy}
              r="4.5"
              fill="#1677D2"
              className="cursor-pointer transition-transform hover:scale-125"
              onMouseEnter={() =>
                onHoverPoint({
                  label: labels[i],
                  currentVal: val,
                  simulatedVal: simulatedPoints[i],
                  diff: Number((simulatedPoints[i] - val).toFixed(1)),
                  xPercent: (cx / width) * 100,
                })
              }
              onMouseLeave={() => onHoverPoint(null)}
            >
              <title>{`${labels[i]} Current: ${val}%`}</title>
            </circle>
          )
        })}

        {/* Simulated Circular Markers */}
        {simulatedPoints.map((val, i) => {
          const cx = xAt(i)
          const cy = yAt(val)
          return (
            <circle
              key={`sim-${i}`}
              cx={cx}
              cy={cy}
              r="4.5"
              fill="#F59E0B"
              className="cursor-pointer transition-transform hover:scale-125"
              onMouseEnter={() =>
                onHoverPoint({
                  label: labels[i],
                  currentVal: currentPoints[i],
                  simulatedVal: val,
                  diff: Number((val - currentPoints[i]).toFixed(1)),
                  xPercent: (cx / width) * 100,
                })
              }
              onMouseLeave={() => onHoverPoint(null)}
            >
              <title>{`${labels[i]} Simulated: ${val}%`}</title>
            </circle>
          )
        })}

        {/* X-axis Labels (Week 1, Week 2, etc.) */}
        {labels.map((lbl, i) => {
          const x = xAt(i)
          return (
            <text
              key={lbl}
              x={x}
              y={height - 8}
              textAnchor="middle"
              fontSize="11"
              fill="#64748B"
              fontWeight="500"
            >
              {lbl}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
