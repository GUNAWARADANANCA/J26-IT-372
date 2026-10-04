import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import { getPayroll } from '../admin/data/repository'
import { currentMonth, money } from './format'

const FULL_COLUMNS = [
  ['employee_id', 'Employee ID'],
  ['employee_name', 'Name'],
  ['basic_salary', 'Basic'],
  ['overtime_pay', 'Overtime'],
  ['late_deduction', 'Late deduction'],
  ['epf_employee', 'EPF employee'],
  ['epf_employer', 'EPF employer'],
  ['etf', 'ETF'],
  ['net_salary', 'Net salary'],
]

const EPF_COLUMNS = [
  ['employee_id', 'Employee ID'],
  ['employee_name', 'Name'],
  ['basic_salary', 'Salary base'],
  ['epf_employee', 'Employee EPF'],
  ['epf_employer', 'Employer EPF'],
]

const ETF_COLUMNS = [
  ['employee_id', 'Employee ID'],
  ['employee_name', 'Name'],
  ['basic_salary', 'Salary base'],
  ['etf', 'ETF'],
]

export default function PayrollPage({ mode = 'payroll' }) {
  const [month, setMonth] = useState(currentMonth())
  const [search, setSearch] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getPayroll(month)
      .then((payload) => {
        if (!cancelled) {
          setData(payload)
          setError('')
          setSelected(null)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load payroll')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [month])

  const columns = mode === 'epf' ? EPF_COLUMNS : mode === 'etf' ? ETF_COLUMNS : FULL_COLUMNS
  const title = mode === 'epf' ? 'EPF' : mode === 'etf' ? 'ETF' : 'Salary & Payroll'
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (data?.rows || []).filter((row) =>
      `${row.employee_id} ${row.employee_name}`.toLowerCase().includes(query),
    )
  }, [data, search])

  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        Employee Entitlements
      </Typography>
      <Typography variant="h5" sx={{ mb: 2 }}>
        {title}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          label="Month"
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Search employee"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ minWidth: 240 }}
        />
      </Stack>
      {data && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          EPF employee {data.rates.epf_employee_percent}% · EPF employer{' '}
          {data.rates.epf_employer_percent}% · ETF {data.rates.etf_percent}% · Late{' '}
          {money(data.rates.late_deduction_lkr)} / day · Overtime {money(data.rates.ot_rate_lkr)} / hour
        </Typography>
      )}
      {error && <Alert severity="error">{error}</Alert>}
      {loading ? (
        <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="flex-start">
          <Paper variant="outlined" sx={{ flex: 1, width: '100%', overflow: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {columns.map(([, label]) => (
                    <TableCell key={label}>{label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columns.length}>No employees match this search.</TableCell>
                  </TableRow>
                )}
                {rows.map((row) => (
                  <TableRow
                    key={row.employee_id}
                    hover
                    selected={selected?.employee_id === row.employee_id}
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setSelected(row)}
                  >
                    {columns.map(([key]) => (
                      <TableCell key={key}>
                        {typeof row[key] === 'number' && key !== 'employee_id'
                          ? money(row[key])
                          : row[key]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
          {mode === 'payroll' && selected && (
            <Paper variant="outlined" sx={{ p: 2, width: { xs: '100%', lg: 280 } }}>
              <Typography variant="h6">{selected.employee_name}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {selected.employee_id}
              </Typography>
              {[
                ['Basic salary', selected.basic_salary],
                ['Overtime', selected.overtime_pay],
                ['Late deduction', selected.late_deduction],
                ['EPF employee', selected.epf_employee],
                ['EPF employer', selected.epf_employer],
                ['ETF', selected.etf],
                ['Net salary', selected.net_salary],
              ].map(([label, value]) => (
                <Stack key={label} direction="row" justifyContent="space-between" sx={{ py: 0.4 }}>
                  <Typography variant="body2">{label}</Typography>
                  <Typography variant="body2">{money(value)}</Typography>
                </Stack>
              ))}
              <Typography variant="caption" color="text.secondary">
                {selected.late_days} late day(s), {selected.overtime_hours} approved overtime hour(s).
                EPF employer and ETF are shown and are not deducted from net pay.
              </Typography>
            </Paper>
          )}
        </Stack>
      )}
    </Box>
  )
}
