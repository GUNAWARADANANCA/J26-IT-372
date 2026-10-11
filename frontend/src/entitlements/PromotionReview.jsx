import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { getPromotionReview } from '../admin/data/repository'

function evidenceText(row) {
  const evidence = row.evidence || {}
  const parts = [
    `${evidence.months_with_work ?? 0} months of work`,
    evidence.mean_kpi != null ? `mean KPI ${evidence.mean_kpi}` : null,
    evidence.attendance_rate != null ? `attendance ${evidence.attendance_rate}%` : null,
    evidence.completion != null ? `completion ${evidence.completion}` : null,
    evidence.accuracy != null ? `accuracy ${evidence.accuracy}` : null,
    evidence.timeliness != null ? `timeliness ${evidence.timeliness}` : null,
  ].filter(Boolean)
  return parts.join(' · ')
}

export default function PromotionReview() {
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getPromotionReview()
      .then((payload) => {
        if (!cancelled) setReport(payload)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load the promotion review')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
  if (!report) {
    return (
      <Box sx={{ py: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={24} />
      </Box>
    )
  }

  const rows = [
    ...report.recommended,
    ...report.others,
  ]

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6">24-month promotion review</Typography>
      <Alert severity="info" sx={{ my: 1.5 }}>
        {report.advisory} {report.criteria_note}
      </Alert>
      <Paper variant="outlined" sx={{ overflow: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Rank</TableCell>
              <TableCell>Employee</TableCell>
              <TableCell>Designation</TableCell>
              <TableCell>Review</TableCell>
              <TableCell>Evidence</TableCell>
              <TableCell>Why</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.employee_id}>
                <TableCell>{row.rank || '—'}</TableCell>
                <TableCell>
                  {row.employee_name} ({row.employee_id})
                </TableCell>
                <TableCell>{row.designation}</TableCell>
                <TableCell>
                  {row.status === 'recommended'
                    ? 'Recommended for review'
                    : row.status === 'not_recommended'
                      ? 'Not recommended'
                      : 'More information needed'}
                </TableCell>
                <TableCell>{evidenceText(row)}</TableCell>
                <TableCell>{(row.reasons || []).join(' ')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  )
}
