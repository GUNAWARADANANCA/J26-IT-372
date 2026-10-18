import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import { getPayroll } from '../admin/data/repository'
import { currentMonth, money } from './format'

export default function EntitlementDashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getPayroll(currentMonth())
      .then((payload) => {
        if (!cancelled) setData(payload)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load entitlements')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <Alert severity="error">{error}</Alert>
  if (!data) {
    return (
      <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  const cards = [
    ['Employees', data.summary.employee_count],
    ['Late this month', data.summary.late_employees],
    ['Pending overtime', data.summary.pending_overtime],
    ['Net payroll', money(data.summary.payroll_total)],
  ]

  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        Employee Entitlements
      </Typography>
      <Typography variant="h5">Dashboard</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Manage and track employee financial and service entitlements
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} useFlexGap flexWrap="wrap">
        {cards.map(([label, value]) => (
          <Paper key={label} variant="outlined" sx={{ p: 2, minWidth: 180, flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="h5">{value}</Typography>
          </Paper>
        ))}
      </Stack>
    </Box>
  )
}
