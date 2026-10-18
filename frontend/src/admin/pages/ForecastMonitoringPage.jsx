import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../data/auth'
import { getForecastMonitoring, list } from '../data/repository'
import ChartCard from '../ui/ChartCard'
import { ChartLegend, GroupedBars, LineChart } from '../ui/charts'
import EmptyState from '../ui/EmptyState'
import FilterPanel from '../ui/FilterPanel'
import InfoBanner from '../ui/InfoBanner'
import KpiCard from '../ui/KpiCard'
import LoadingState from '../ui/LoadingState'
import PageHeader from '../ui/PageHeader'
import PowerBiPanel from '../ui/PowerBiPanel'

function formatWeek(value) {
  if (!value) return ''
  const day = new Date(`${value}T00:00:00`)
  if (Number.isNaN(day.getTime())) return value
  return day.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

const SERIES_COLORS = ['#12315c', '#2f6fed', '#0f766e', '#b45309', '#7c3aed', '#be123c']

function seriesByEmployee(rows, valueKey) {
  const weeks = [...new Set(rows.map((row) => row.target_week))].sort()
  const people = []
  rows.forEach((row) => {
    if (!people.some((person) => person.id === row.employee_id)) {
      people.push({ id: row.employee_id, name: row.employee_name || row.employee_id })
    }
  })
  return {
    labels: weeks.map((week) => formatWeek(week)),
    series: people.map((person, index) => ({
      name: person.name,
      color: SERIES_COLORS[index % SERIES_COLORS.length],
      points: weeks.map((week) => {
        const row = rows.find((item) => item.employee_id === person.id && item.target_week === week)
        const value = row ? Number(row[valueKey]) : null
        return Number.isFinite(value) ? value : null
      }),
    })),
  }
}

export default function ForecastMonitoringPage() {
  const { user, ready } = useAuth()
  const [employees, setEmployees] = useState([])
  const [employeeId, setEmployeeId] = useState('')
  const [periodFrom, setPeriodFrom] = useState('')
  const [periodTo, setPeriodTo] = useState('')
  const [status, setStatus] = useState('all')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ready || user?.role !== 'postmaster') return undefined
    let cancelled = false
    list('employee')
      .then((rows) => {
        if (!cancelled) setEmployees(rows)
      })
      .catch(() => {
        if (!cancelled) setEmployees([])
      })
    return () => {
      cancelled = true
    }
  }, [ready, user])

  useEffect(() => {
    if (!ready || user?.role !== 'postmaster') return undefined
    let cancelled = false
    setLoading(true)
    setError('')
    getForecastMonitoring({ employeeId, periodFrom, periodTo, status })
      .then((payload) => {
        if (!cancelled) setReport(payload)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load forecast monitoring')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ready, user, employeeId, periodFrom, periodTo, status])

  const matched = useMemo(
    () => (report?.rows || []).filter((row) => row.actual_kpi != null),
    [report],
  )
  const officeGroups = useMemo(() => {
    const grouped = new Map()
    matched.forEach((row) => {
      const office = row.post_office || 'Office not recorded'
      const current = grouped.get(office) || []
      current.push(row.absolute_error)
      grouped.set(office, current)
    })
    return [...grouped.entries()].map(([office, errors]) => ({
      office,
      count: errors.length,
      mean: errors.reduce((sum, value) => sum + value, 0) / errors.length,
    }))
  }, [matched])
  const holdout = report?.historical_holdout

  if (!ready) return <LoadingState label="Checking sign-in" />
  if (!user) return <Navigate to="/sign-in" replace />
  if (user.role !== 'postmaster') {
    return <EmptyState title="Postmaster sign-in required">A postmaster sign-in is required to view saved forecasts.</EmptyState>
  }

  return (
    <div>
      <PageHeader title="Forecast monitoring" description="Saved forecasts compared with the measured KPI for the same employee and target week." />
      <InfoBanner>
        Only forecasts someone chose to save are listed. Needs Review means the absolute error is above five points. That flag is not a model confidence score.
      </InfoBanner>
      <FilterPanel>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Employee</span>
          <select className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} aria-label="Employee">
            <option value="">All employees</option>
            {employees.map((employee) => (
              <option key={employee.employee_id} value={employee.employee_id}>
                {employee.employee_name || employee.employee_id} ({employee.employee_id})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Target week from</span>
          <input className="h-10 w-full rounded-lg border border-slate-300 px-2" type="date" value={periodFrom} onChange={(event) => setPeriodFrom(event.target.value)} aria-label="Target week from" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Target week to</span>
          <input className="h-10 w-full rounded-lg border border-slate-300 px-2" type="date" value={periodTo} onChange={(event) => setPeriodTo(event.target.value)} aria-label="Target week to" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Outcome</span>
          <select className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Outcome">
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="matched">Matched</option>
            <option value="needs_review">Needs Review</option>
          </select>
        </label>
      </FilterPanel>
      {error ? <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p> : null}
      {loading ? <LoadingState label="Loading forecast monitoring" /> : null}
      {report && !loading ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Saved forecasts" value={report.saved_forecasts} note="Rows in this filter" />
            <KpiCard label="With actual outcomes" value={report.with_actual_outcomes} note="Same employee and target week" />
            <KpiCard label="Pending forecasts" value={report.pending} note="No measured KPI for that target week" />
            <KpiCard label="Needs review" value={report.needs_review} note="Absolute error above five points" />
            <KpiCard label="Model MAE" value={report.mae ?? '—'} note={`n = ${report.comparison_count}`} />
            <KpiCard label="Model RMSE" value={report.rmse ?? '—'} note={`n = ${report.comparison_count}`} />
            <KpiCard label="Baseline MAE" value={report.baseline_mae ?? '—'} note="Copies the input week's measured KPI" />
            <KpiCard label="Baseline RMSE" value={report.baseline_rmse ?? '—'} note={`n = ${report.comparison_count}`} />
          </div>
          <p className={`rounded-xl border px-3 py-2 text-sm ${report.enough_observations ? 'border-slate-200 bg-white text-slate-700' : 'border-amber-200 bg-amber-50 text-amber-950'}`}>{report.note}</p>
          <div className="grid gap-3 xl:grid-cols-2">
            <ChartCard title="Actual versus predicted" note="Each line is one employee. A point exists only when that employee has a saved forecast and a measured KPI for the same target week.">
              {matched.length ? (
                <>
                  <LineChart
                    ariaLabel="Predicted and actual KPI by employee"
                    labels={seriesByEmployee(matched, 'predicted_kpi').labels}
                    series={[
                      ...seriesByEmployee(matched, 'predicted_kpi').series.map((item) => ({ ...item, name: `${item.name} predicted` })),
                      ...seriesByEmployee(matched, 'actual_kpi').series.map((item) => ({ ...item, name: `${item.name} actual`, dashed: true })),
                    ]}
                  />
                  <ChartLegend items={seriesByEmployee(matched, 'predicted_kpi').series.flatMap((item) => [
                    { label: `${item.name} predicted`, color: item.color },
                    { label: `${item.name} actual`, color: item.color, dashed: true },
                  ])} />
                </>
              ) : <p className="text-sm text-slate-600">No matched forecasts to chart for these filters.</p>}
            </ChartCard>
            <ChartCard title="Prediction error" note="Absolute and signed error use the same employee and target week. Pending forecasts are excluded.">
              {matched.length ? (
                <LineChart
                  ariaLabel="Prediction error by employee"
                  labels={seriesByEmployee(matched, 'absolute_error').labels}
                  series={[
                    ...seriesByEmployee(matched, 'absolute_error').series.map((item) => ({ ...item, name: `${item.name} absolute` })),
                    ...seriesByEmployee(matched, 'signed_error').series.map((item) => ({ ...item, name: `${item.name} signed`, dashed: true })),
                  ]}
                />
              ) : <p className="text-sm text-slate-600">No matched forecasts to chart for these filters.</p>}
              <ChartLegend items={seriesByEmployee(matched, 'absolute_error').series.flatMap((item) => [
                { label: `${item.name} absolute`, color: item.color },
                { label: `${item.name} signed`, color: item.color, dashed: true },
              ])} />
            </ChartCard>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <ChartCard title="Forecast status" note="Counts from the current filter.">
              <GroupedBars
                ariaLabel="Forecast status counts"
                groups={[{ label: 'Status', values: [report.with_actual_outcomes - report.needs_review, report.pending, report.needs_review] }]}
                series={[
                  { name: 'Matched within five', color: '#12315c' },
                  { name: 'Pending', color: '#94a3b8' },
                  { name: 'Needs review', color: '#c2410c' },
                ]}
              />
            </ChartCard>
            <ChartCard title="Model versus baseline" note={`${report.mape_note} Model ${report.model_id}. ${report.training_date_note}`}>
              <GroupedBars
                ariaLabel="Model and baseline error"
                groups={[
                  { label: 'MAE', values: [report.mae, report.baseline_mae] },
                  { label: 'RMSE', values: [report.rmse, report.baseline_rmse] },
                ].filter((group) => group.values.some((value) => value != null))}
                series={[{ name: 'Model', color: '#2f6fed' }, { name: 'Baseline', color: '#12315c' }]}
              />
              <p className="text-xs text-slate-500">MAPE {report.mape ?? '—'}{report.mape != null ? '%' : ''}. Sample size {report.comparison_count}.</p>
            </ChartCard>
            <ChartCard title="Error by office" note="Shown when at least two offices have a matched forecast.">
              {officeGroups.filter((group) => group.count > 0).length >= 2 ? (
                <ul className="space-y-2 text-sm">
                  {officeGroups.map((group) => (
                    <li key={group.office} className="flex justify-between gap-3">
                      <span>{group.office}</span>
                      <span>Mean absolute error {group.mean.toFixed(2)} · n = {group.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-600">Office comparison needs matched forecasts from at least two offices.</p>
              )}
            </ChartCard>
          </div>
          {holdout ? (
            <ChartCard title="Historical holdout" note="This is a separate evaluation. It is not calculated from the saved forecasts in the table.">
              <p className="text-sm text-slate-700">
                {holdout.employees} employees, {holdout.test_rows} later employee-weeks, {holdout.test_start} to {holdout.test_end}.
                Model MAE {holdout.model_mae}, RMSE {holdout.model_rmse}. Same-week baseline MAE {holdout.copy_week_mae}, RMSE {holdout.baseline_rmse}.
                {' '}{holdout.note}
              </p>
            </ChartCard>
          ) : null}
          {!report.rows.length ? (
            <EmptyState title="No saved forecasts">No saved forecasts match these filters.</EmptyState>
          ) : (
            <ChartCard title="Saved forecasts" note="Actual KPI stays blank until the same employee has a measured score for the target week.">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="py-2 pr-3">Employee</th>
                      <th className="py-2 pr-3">Source week</th>
                      <th className="py-2 pr-3">Target week</th>
                      <th className="py-2 pr-3">Predicted KPI</th>
                      <th className="py-2 pr-3">Actual KPI</th>
                      <th className="py-2 pr-3">Error</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row) => (
                      <tr key={`${row.employee_id}-${row.input_week}-${row.source}-${row.scenario_name}-${row.created_at}`} className="border-t border-slate-100">
                        <td className="py-2 pr-3">{row.employee_name} ({row.employee_id})</td>
                        <td className="py-2 pr-3">{formatWeek(row.input_week)}</td>
                        <td className="py-2 pr-3">{formatWeek(row.target_week)}</td>
                        <td className="py-2 pr-3">{row.predicted_kpi}</td>
                        <td className="py-2 pr-3">{row.actual_kpi ?? '—'}</td>
                        <td className="py-2 pr-3">{row.absolute_error ?? '—'}</td>
                        <td className="py-2">{row.status_label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          )}
          <PowerBiPanel page="forecast-monitoring" />
        </div>
      ) : null}
    </div>
  )
}
