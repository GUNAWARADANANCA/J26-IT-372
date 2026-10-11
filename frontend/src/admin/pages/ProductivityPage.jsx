import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { getProductivity, list } from '../data/repository'

function formatWeek(value) {
  if (!value) return ''
  const day = new Date(`${value}T00:00:00`)
  if (Number.isNaN(day.getTime())) return value
  return day.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function Stat({ label, value, note }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, minWidth: 160, flex: 1 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5">{value}</Typography>
      {note ? (
        <Typography variant="caption" color="text.secondary">
          {note}
        </Typography>
      ) : null}
    </Paper>
  )
}

export default function ProductivityPage() {
  const [employees, setEmployees] = useState([])
  const [employeeId, setEmployeeId] = useState('')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
      return undefined
    }
    let cancelled = false
    setLoading(true)
    setError('')
    getProductivity(employeeId)
      .then((payload) => {
        if (!cancelled) setReport(payload)
      })
      .catch((err) => {
        if (!cancelled) {
          setReport(null)
          setError(err.message || 'Could not load the forecast')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [employeeId])

  const evaluation = report?.evaluation

  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        Weekly forecast
      </Typography>
      <Typography variant="h5">Productivity</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Measured score for the latest week, a next-week estimate, and what
        pulled the score down. The estimate is advice for the postmaster.
        Promotion review for the last 24 months is a separate list and does not use this forecast.
      </Typography>

      <TextField
        select
        label="Employee"
        value={employeeId}
        onChange={(event) => setEmployeeId(event.target.value)}
        sx={{ mb: 2, minWidth: 280 }}
        size="small"
      >
        {employees.map((employee) => (
          <MenuItem key={employee.employee_id} value={employee.employee_id}>
            {employee.employee_name || employee.employee_id} ({employee.employee_id})
          </MenuItem>
        ))}
      </TextField>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {!employeeId ? (
        <Alert severity="info">Choose an employee to see this week’s score and the next-week estimate.</Alert>
      ) : null}

      {loading ? (
        <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={28} />
        </Box>
      ) : null}

      {report && !report.available && !loading ? (
        <Alert severity="warning">{report.message}</Alert>
      ) : null}

      {report?.available && !loading ? (
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            {report.employee_name} · {report.work_category || 'No work category'} · week of{' '}
            {formatWeek(report.week)}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} useFlexGap flexWrap="wrap">
            <Stat label="Measured KPI this week" value={report.measured_kpi} note="From the three rates" />
            <Stat
              label="Predicted KPI next week"
              value={report.predicted_next_week_kpi}
              note="Forecast, not a measured score"
            />
            <Stat label="Completion" value={report.completion} />
            <Stat label="Accuracy" value={report.accuracy} />
            <Stat label="Timeliness" value={report.timeliness} />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} useFlexGap flexWrap="wrap">
            <Stat label="Unfinished work" value={report.uncompleted} />
            <Stat label="Incorrect work" value={report.incorrect} />
            <Stat label="Late work" value={report.late} />
          </Stack>
          <Alert severity="info">{report.summary}</Alert>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2">Recommendations from scores already recorded</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Each note uses this week’s completion, accuracy, or timeliness score and the work counted against it.
            </Typography>
            <Stack spacing={1.5}>
              {(report.recommendations || []).map((item) => (
                <Box key={item.kpi}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {item.title}
                    {item.weakest ? ' · weakest' : ''} · {item.priority}
                  </Typography>
                  <Typography variant="body2">{item.evidence}</Typography>
                  <Typography variant="body2">{item.action}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.review_note}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Recent weekly scores
            </Typography>
            <Stack spacing={0.5}>
              {report.history.map((row) => (
                <Stack key={row.week} direction="row" spacing={2}>
                  <Typography variant="body2" sx={{ width: 120 }}>
                    {formatWeek(row.week)}
                  </Typography>
                  <Typography variant="body2">{row.kpi}</Typography>
                </Stack>
              ))}
            </Stack>
          </Paper>
        </Stack>
      ) : null}

      {evaluation ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          Held-out test: baseline MAE {evaluation.baseline_mae}, same-as-this-week MAE{' '}
          {evaluation.copy_week_mae}, model MAE {evaluation.model_mae}, RMSE {evaluation.model_rmse}.{' '}
          {evaluation.note}
        </Typography>
      ) : null}
    </Box>
  )
}
