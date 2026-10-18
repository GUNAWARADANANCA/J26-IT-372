import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import {
  createEntitlement,
  deleteEntitlement,
  list,
  listEntitlements,
} from '../admin/data/repository'

const MODULES = {
  leave: {
    title: 'Leave Management',
    module: 'leave',
    statusField: 'status',
    fields: [
      { name: 'leave_type', label: 'Leave type' },
      { name: 'from_date', label: 'From', type: 'date' },
      { name: 'to_date', label: 'To', type: 'date' },
      { name: 'days', label: 'Days', type: 'number' },
      { name: 'reason', label: 'Reason' },
      { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'Approved', 'Rejected'] },
    ],
  },
  'holiday-pay': {
    title: 'Holiday Pay',
    module: 'holiday-pay',
    statusField: 'status',
    fields: [
      { name: 'holiday_name', label: 'Holiday' },
      { name: 'holiday_date', label: 'Date', type: 'date' },
      { name: 'hours', label: 'Hours worked', type: 'number' },
      { name: 'amount', label: 'Amount', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'Approved', 'Rejected'] },
    ],
  },
  overtime: {
    title: 'Overtime',
    module: 'overtime',
    statusField: 'status',
    fields: [
      { name: 'date', label: 'Date', type: 'date' },
      { name: 'hours', label: 'Hours', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'Approved', 'Rejected'] },
    ],
  },
  gratuity: {
    title: 'Gratuity',
    module: 'gratuity',
    statusField: 'status',
    fields: [
      { name: 'service_note', label: 'Service note' },
      { name: 'estimated_amount', label: 'Estimated amount', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['Eligible', 'Not eligible', 'Settled'] },
    ],
  },
  promotions: {
    title: 'Promotions',
    module: 'promotion',
    statusField: 'status',
    fields: [
      { name: 'previous_designation', label: 'Previous designation' },
      { name: 'new_designation', label: 'New designation' },
      { name: 'effective_date', label: 'Effective date', type: 'date' },
      { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'Approved', 'Rejected'] },
    ],
  },
  transfers: {
    title: 'Transfers',
    module: 'transfer',
    statusField: 'status',
    fields: [
      { name: 'current_office', label: 'Current office' },
      { name: 'new_office', label: 'New office' },
      { name: 'transfer_date', label: 'Transfer date', type: 'date' },
      { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'Approved', 'Rejected'] },
    ],
  },
  'family-benefits': {
    title: 'Maternity / Family Benefits',
    module: 'family-benefit',
    statusField: 'status',
    fields: [
      { name: 'benefit_type', label: 'Benefit' },
      { name: 'start_date', label: 'Start', type: 'date' },
      { name: 'end_date', label: 'End', type: 'date' },
      { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'Approved', 'Rejected'] },
    ],
  },
  retirement: {
    title: 'Retirement',
    module: 'retirement',
    statusField: 'status',
    fields: [
      { name: 'expected_date', label: 'Expected date', type: 'date' },
      { name: 'note', label: 'Note' },
      { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Due', 'Settled'] },
    ],
  },
  loans: {
    title: 'Loans / Advances',
    module: 'loan',
    statusField: 'status',
    fields: [
      { name: 'loan_type', label: 'Type' },
      { name: 'approved_amount', label: 'Approved amount', type: 'number' },
      { name: 'monthly_installment', label: 'Monthly installment', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Closed'] },
    ],
  },
}

function emptyDraft(meta) {
  const draft = { employee_id: '' }
  for (const field of meta.fields) draft[field.name] = field.options?.[0] || ''
  return draft
}

export default function EntitlementPage({ pageKey }) {
  const meta = MODULES[pageKey]
  const [rows, setRows] = useState([])
  const [employees, setEmployees] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(emptyDraft(meta))
  const [saving, setSaving] = useState(false)

  async function reload() {
    const [records, people] = await Promise.all([
      listEntitlements(meta.module),
      list('employee'),
    ])
    setRows(records)
    setEmployees(people)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    reload()
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load records')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [meta.module])

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesSearch = `${row.employee_id} ${row.employee_name}`.toLowerCase().includes(query)
      const matchesStatus = !status || row[meta.statusField] === status
      return matchesSearch && matchesStatus
    })
  }, [rows, search, status, meta.statusField])

  const statuses = meta.fields.find((field) => field.name === meta.statusField)?.options || []

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await createEntitlement(meta.module, draft)
      setOpen(false)
      setDraft(emptyDraft(meta))
      await reload()
    } catch (err) {
      setError(err.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this record?')) return
    setError('')
    try {
      await deleteEntitlement(meta.module, id)
      await reload()
    } catch (err) {
      setError(err.message || 'Could not delete')
    }
  }

  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        Employee Entitlements
      </Typography>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">{meta.title}</Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>
          Add
        </Button>
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          label="Search employee"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ minWidth: 220 }}
        />
        <TextField
          select
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">All</MenuItem>
          {statuses.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {loading ? (
        <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <Paper variant="outlined" sx={{ overflow: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                {meta.fields.map((field) => (
                  <TableCell key={field.name}>{field.label}</TableCell>
                ))}
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={meta.fields.length + 2}>No records yet.</TableCell>
                </TableRow>
              )}
              {visible.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.employee_name}
                    <Typography variant="caption" display="block" color="text.secondary">
                      {row.employee_id}
                    </Typography>
                  </TableCell>
                  {meta.fields.map((field) => (
                    <TableCell key={field.name}>{row[field.name] ?? '—'}</TableCell>
                  ))}
                  <TableCell>
                    <Button size="small" color="error" onClick={() => handleDelete(row.id)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add {meta.title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Employee"
              required
              value={draft.employee_id}
              onChange={(event) => setDraft((current) => ({ ...current, employee_id: event.target.value }))}
            >
              {employees.map((employee) => (
                <MenuItem key={employee.name} value={employee.name}>
                  {employee.employee_id} — {employee.employee_name}
                </MenuItem>
              ))}
            </TextField>
            {meta.fields.map((field) =>
              field.type === 'select' ? (
                <TextField
                  key={field.name}
                  select
                  label={field.label}
                  value={draft[field.name]}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, [field.name]: event.target.value }))
                  }
                >
                  {field.options.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <TextField
                  key={field.name}
                  label={field.label}
                  type={field.type || 'text'}
                  value={draft[field.name]}
                  InputLabelProps={field.type === 'date' ? { shrink: true } : undefined}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, [field.name]: event.target.value }))
                  }
                />
              ),
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={saving || !draft.employee_id} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
