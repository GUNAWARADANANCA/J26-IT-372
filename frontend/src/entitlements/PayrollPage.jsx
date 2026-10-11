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
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import MenuItem from '@mui/material/MenuItem'
import { get, getPayroll, update } from '../admin/data/repository'
import { currentMonth, money } from './format'

const WORK_ROLES = [
  'Delivery Officer',
  'Postal Assistant',
  'Postal Clerk',
  'Postman',
  'Postmaster (Head)',
  'Senior Postman',
]

const WORK_CATEGORIES = ['Delivery (Field)', 'Office', 'Supervisory / Office']

const FULL_COLUMNS = [
  ['employee_id', 'Employee ID'],
  ['employee_name', 'Name'],
  ['designation', 'Work role'],
  ['basic_salary', 'Basic salary'],
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
  ['designation', 'Work role'],
  ['basic_salary', 'Basic salary'],
  ['epf_employee', 'Employee EPF'],
  ['epf_employer', 'Employer EPF'],
]

const ETF_COLUMNS = [
  ['employee_id', 'Employee ID'],
  ['employee_name', 'Name'],
  ['designation', 'Work role'],
  ['basic_salary', 'Basic salary'],
  ['etf', 'ETF'],
]

export default function PayrollPage({ mode = 'payroll' }) {
  const [month, setMonth] = useState(currentMonth())
  const [search, setSearch] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)

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

  async function openEdit(row, event) {
    event.stopPropagation()
    setError('')
    try {
      const employee = await get('employee', row.employee_id)
      if (!employee) {
        setError('This employee record was not found')
        return
      }
      setEditing(employee)
      setDraft({
        employee_name: employee.employee_name || '',
        designation: employee.designation || '',
        work_category: employee.work_category || '',
        post_office: employee.post_office || '',
        basic_salary: employee.basic_salary ?? '',
      })
    } catch (err) {
      setError(err.message || 'Could not open this employee')
    }
  }

  function changeDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  async function saveEdit() {
    const name = String(draft.employee_name || '').trim()
    if (!name) {
      setError('Enter the employee name')
      return
    }
    const salary = Number(draft.basic_salary)
    if (!Number.isFinite(salary) || salary < 0) {
      setError('Enter a basic salary of zero or more')
      return
    }
    setSaving(true)
    setError('')
    try {
      await update('employee', editing.employee_id, {
        ...editing,
        employee_name: name,
        designation: draft.designation,
        work_category: draft.work_category,
        post_office: draft.post_office,
        basic_salary: salary,
        name: editing.employee_id,
      })
      const payload = await getPayroll(month)
      setData(payload)
      setSelected(null)
      setEditing(null)
      setDraft(null)
    } catch (err) {
      setError(err.message || 'Could not save the employee')
    } finally {
      setSaving(false)
    }
  }

  const columns = mode === 'epf' ? EPF_COLUMNS : mode === 'etf' ? ETF_COLUMNS : FULL_COLUMNS
  const title = mode === 'epf' ? 'EPF' : mode === 'etf' ? 'ETF' : 'Salary & Payroll'
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (data?.rows || []).filter((row) =>
      `${row.employee_id} ${row.employee_name} ${row.designation}`.toLowerCase().includes(query),
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
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columns.length + 1}>No employees match this search.</TableCell>
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
                    <TableCell>
                      <Button size="small" onClick={(event) => openEdit(row, event)}>
                        Edit
                      </Button>
                    </TableCell>
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
                {selected.designation ? ` · ${selected.designation}` : ''}
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
              <Button sx={{ mt: 1.5 }} size="small" variant="outlined" onClick={(event) => openEdit(selected, event)}>
                Edit employee
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                {selected.late_days} late day(s), {selected.overtime_hours} approved overtime hour(s).
                EPF employer and ETF are shown and are not deducted from net pay.
              </Typography>
            </Paper>
          )}
        </Stack>
      )}
      <Dialog open={Boolean(editing)} onClose={() => !saving && setEditing(null)} fullWidth maxWidth="sm">
        <DialogTitle>Edit employee</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The postmaster can change this employee’s name, work role, and basic salary. The employee ID stays the same.
          </Typography>
          {draft && (
            <Stack spacing={1.5} sx={{ pt: 0.5 }}>
              <TextField label="Employee ID" value={editing.employee_id} size="small" disabled />
              <TextField
                label="Employee name"
                value={draft.employee_name}
                onChange={(event) => changeDraft('employee_name', event.target.value)}
                size="small"
                required
              />
              <TextField
                select
                label="Work role"
                value={draft.designation}
                onChange={(event) => changeDraft('designation', event.target.value)}
                size="small"
              >
                {[draft.designation, ...WORK_ROLES].filter((value, index, list) => value && list.indexOf(value) === index).map((role) => (
                  <MenuItem key={role} value={role}>{role}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Work category"
                value={draft.work_category}
                onChange={(event) => changeDraft('work_category', event.target.value)}
                size="small"
              >
                {[draft.work_category, ...WORK_CATEGORIES].filter((value, index, list) => value && list.indexOf(value) === index).map((category) => (
                  <MenuItem key={category} value={category}>{category}</MenuItem>
                ))}
              </TextField>
              <TextField
                label="Post office"
                value={draft.post_office}
                onChange={(event) => changeDraft('post_office', event.target.value)}
                size="small"
              />
              <TextField
                label="Basic salary (LKR)"
                type="number"
                value={draft.basic_salary}
                onChange={(event) => changeDraft('basic_salary', event.target.value)}
                size="small"
                required
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={saveEdit} disabled={saving || !draft}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
