import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { checklistLabels } from '../admin/pages/ChecklistPage'
import { confirmOvertime, getAllocation } from '../admin/data/repository'

function today() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function money(value) {
  if (value == null) return 'Salary missing'
  return `Rs ${Number(value).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function OvertimeFromDay({ onSaved }) {
  const [date, setDate] = useState(today)
  const [plan, setPlan] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setNotice('')
    getAllocation(date, checklistLabels(date))
      .then((result) => {
        if (!cancelled) setPlan(result)
      })
      .catch((err) => {
        if (!cancelled) {
          setPlan(null)
          setError(err.message || 'Could not read attendance and the checklist')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [date])

  async function confirm() {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await confirmOvertime(date, checklistLabels(date))
      const names = result.saved.map((row) => row.employee_name).join(', ')
      setNotice(`Saved overtime for ${names}.`)
      if (onSaved) await onSaved()
    } catch (err) {
      setError(err.message || 'Could not save overtime')
    } finally {
      setSaving(false)
    }
  }

  const rows = plan?.overtime || []

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
        From attendance and checklist
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        People who attended are given the checked checklist tasks. Extra work, including covering an absent colleague’s route, is shown here as overtime.
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1.5 }}>
        <TextField
          label="Date"
          type="date"
          size="small"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          InputLabelProps={{ shrink: true }}
        />
      </Stack>
      {error ? <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert> : null}
      {notice ? <Alert severity="success" sx={{ mb: 1.5 }}>{notice}</Alert> : null}
      {loading ? (
        <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Hours</TableCell>
              <TableCell>Overtime pay</TableCell>
              <TableCell>Why</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  No overtime for this date. Nobody who attended has extra work or a route to cover.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.employee_id}>
                  <TableCell>
                    {row.employee_name}
                    <Typography variant="caption" display="block" color="text.secondary">
                      {row.employee_id} · {row.designation}
                    </Typography>
                  </TableCell>
                  <TableCell>{date}</TableCell>
                  <TableCell>{row.overtime_hours}</TableCell>
                  <TableCell>{money(row.overtime_pay)}</TableCell>
                  <TableCell>{row.reason}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
      {rows.length > 0 ? (
        <Button sx={{ mt: 1.5 }} variant="contained" disabled={saving} onClick={confirm}>
          {saving ? 'Saving…' : 'Save into overtime records'}
        </Button>
      ) : null}
    </Paper>
  )
}
