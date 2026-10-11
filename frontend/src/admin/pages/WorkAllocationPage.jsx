import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { checklistLabels } from './ChecklistPage'
import { approveAllocation, confirmOvertime, getAllocation } from '../data/repository'

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function WorkAllocationPage() {
  const [date, setDate] = useState(today())
  const [plan, setPlan] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState('')

  async function load(nextDate = date) {
    setLoading(true)
    setError('')
    setSaved('')
    try {
      setPlan(await getAllocation(nextDate, checklistLabels(nextDate)))
    } catch (err) {
      setPlan(null)
      setError(err.message || 'Could not load the allocation')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(date)
    // Reload when the postmaster opens the page or changes the date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  function money(value) {
    if (value == null) return 'Salary missing'
    return `Rs ${Number(value).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  async function confirmOt() {
    setLoading(true)
    setError('')
    try {
      const result = await confirmOvertime(date, checklistLabels(date))
      setPlan(result.plan)
      const names = result.saved.map((row) => `${row.employee_name} ${row.hours} h`).join(', ')
      setSaved(`Overtime confirmed for ${names}. Roles were not changed.`)
    } catch (err) {
      setError(err.message || 'Could not confirm overtime')
    } finally {
      setLoading(false)
    }
  }

  async function approve() {
    setLoading(true)
    setError('')
    try {
      const result = await approveAllocation(date, checklistLabels(date))
      setPlan(result.plan)
      setSaved('The postmaster’s approval was saved. Existing roles were not changed.')
    } catch (err) {
      setError(err.message || 'Could not approve the allocation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        Daily work
      </Typography>
      <Typography variant="h5">Work allocation</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Opening this page reads attendance, the checklist, and overtime. Each checked task is offered to someone who attended, and only if their current role can do it. Covering an absent colleague’s route is estimated as overtime. A Postman is not offered counter work. Roles stay as they are.
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          label="Date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          InputLabelProps={{ shrink: true }}
          size="small"
        />
        <Button variant="contained" onClick={() => load()} disabled={loading}>
          Review day
        </Button>
      </Stack>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {saved ? <Alert severity="success" sx={{ mb: 2 }}>{saved}</Alert> : null}
      {loading ? (
        <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={28} />
        </Box>
      ) : null}
      {plan && !loading ? (
        <Stack spacing={2}>
          <Alert severity="info">{plan.advisory} {plan.capacity_note}</Alert>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2">Present</Typography>
            {plan.present.length === 0 ? (
              <Typography variant="body2">No employee is recorded as present on this date.</Typography>
            ) : (
              plan.present.map((person) => (
                <Typography key={person.employee_id} variant="body2">
                  {person.employee_name} ({person.employee_id}) · {person.designation} · {person.work_category}
                </Typography>
              ))
            )}
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2">Checklist for people who attended</Typography>
            {(plan.checklist || []).length === 0 && (plan.checklist_unmet || []).length === 0 ? (
              <Typography variant="body2">No checklist task to assign.</Typography>
            ) : null}
            {(plan.checklist || []).map((item) => (
              <Typography key={`${item.task}-${item.employee_id}`} variant="body2" sx={{ mb: 0.5 }}>
                {item.task} → {item.employee_name} ({item.designation})
              </Typography>
            ))}
            {(plan.checklist_unmet || []).map((item) => (
              <Typography key={item.task} variant="body2" color="text.secondary">
                {item.reason}
              </Typography>
            ))}
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2">Unfinished daily logs</Typography>
            {plan.moves.length === 0 && plan.unmet.length === 0 ? (
              <Typography variant="body2">
                No unfinished daily log needs to be moved.
              </Typography>
            ) : null}
            {plan.moves.length > 0
              ? plan.moves.map((move) => (
                <Typography key={`${move.from_employee_id}-${move.to_employee_id}-${move.task || ''}-${move.count}`} variant="body2" sx={{ mb: 0.5 }}>
                  Move {move.count} {move.task || 'unfinished'} items from {move.from_employee_name} to {move.to_employee_name}. {move.reason}
                </Typography>
              ))
              : null}
            {(plan.blocked || []).map((item) => (
              <Typography key={`${item.employee_id}-${item.task}`} variant="body2" color="text.secondary">
                {item.reason}
              </Typography>
            ))}
            {plan.unmet.map((item) => (
              <Typography key={`${item.employee_id}-${item.task || ''}-${item.count}`} variant="body2">
                {item.count} unfinished {item.task || 'items'} from {item.employee_name} {item.count === 1 ? 'needs' : 'need'} a present {item.needed_roles || item.work_category} with room under the daily cap.
              </Typography>
            ))}
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2">Overtime</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {plan.overtime_note}
            </Typography>
            {(plan.overtime || []).length === 0 ? (
              <Typography variant="body2">No overtime is estimated for the people who attended.</Typography>
            ) : (
              (plan.overtime || []).map((row) => (
                <Typography key={row.employee_id} variant="body2" sx={{ mb: 0.75 }}>
                  {row.employee_name} ({row.designation}) · {row.overtime_hours} h · hourly {money(row.hourly_rate)} · overtime rate {money(row.overtime_rate)} · estimated pay {money(row.overtime_pay)}. {row.reason}
                </Typography>
              ))
            )}
            {(plan.overtime || []).length > 0 ? (
              <Button sx={{ mt: 1.5 }} variant="contained" onClick={confirmOt}>
                Confirm overtime
              </Button>
            ) : null}
          </Paper>
          {plan.moves.length > 0 || (plan.checklist || []).length > 0 ? (
            <Button variant="contained" onClick={approve}>
              Approve this allocation
            </Button>
          ) : null}
        </Stack>
      ) : null}
    </Box>
  )
}
