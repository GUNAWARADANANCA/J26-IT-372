import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { getGratuity, saveGratuity } from '../admin/data/repository'

function money(value) {
  if (value == null) return '—'
  return `Rs ${Number(value).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function GratuityFromService({ onSaved }) {
  const [board, setBoard] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getGratuity()
      .then((result) => {
        if (!cancelled) setBoard(result)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not calculate gratuity')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function save() {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await saveGratuity()
      setNotice(`Saved gratuity for ${result.saved.length} employees.`)
      if (onSaved) await onSaved()
    } catch (err) {
      setError(err.message || 'Could not save gratuity')
    } finally {
      setSaving(false)
    }
  }

  const rows = board?.rows || []

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
        From salary and years of experience
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {board?.formula_note || 'Estimated gratuity = (monthly basic salary / 2) × completed years.'}
      </Typography>
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
              <TableCell>Years</TableCell>
              <TableCell>Basic salary</TableCell>
              <TableCell>Estimated amount</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>No employees to calculate.</TableCell>
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
                  <TableCell>{row.years_of_experience ?? '—'}</TableCell>
                  <TableCell>{money(row.basic_salary)}</TableCell>
                  <TableCell>{money(row.estimated_amount)}</TableCell>
                  <TableCell>{row.status}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
      {rows.length > 0 ? (
        <Button sx={{ mt: 1.5 }} variant="contained" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save into gratuity records'}
        </Button>
      ) : null}
    </Paper>
  )
}
