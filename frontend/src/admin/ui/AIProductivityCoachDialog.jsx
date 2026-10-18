import { useEffect, useRef, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import CloseIcon from '@mui/icons-material/Close'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { followCoach, getCoach } from '../data/repository'

function scoreText(value) {
  if (value == null || value === '') return 'Not recorded'
  return Number(value).toFixed(1)
}

function recommendationText(item) {
  return [
    item.headline,
    item.explanation,
    `Evidence: ${item.evidence}`,
    `Next step: ${(item.actions || []).join(' ')}`,
    `Review after ${item.review_after}.`,
    item.coverage,
  ].filter(Boolean).join('\n')
}

export default function AIProductivityCoachDialog({ open, employeeId, week, onClose }) {
  const [plan, setPlan] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [openId, setOpenId] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [attempt, setAttempt] = useState(0)
  const requestRef = useRef(0)

  useEffect(() => {
    if (!open || !employeeId) return undefined
    const token = ++requestRef.current
    setLoading(true)
    setError('')
    setPlan(null)
    setStatusNote('')
    getCoach(employeeId, week)
      .then((payload) => {
        if (token === requestRef.current) setPlan(payload)
      })
      .catch((err) => {
        if (token === requestRef.current) setError(err.message || 'Could not generate recommendations')
      })
      .finally(() => {
        if (token === requestRef.current) setLoading(false)
      })
    return () => {
      requestRef.current += 1
    }
  }, [open, employeeId, week, attempt])

  const measured = plan?.measured_kpi
  const forecast = plan?.predicted_next_week_kpi
  const both = measured != null && forecast != null
  const gap = both ? Math.round((Number(forecast) - Number(measured)) * 10) / 10 : null

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text)
      setStatusNote('Copied.')
    } catch {
      setStatusNote('The browser did not allow copying.')
    }
  }

  function downloadReport() {
    if (!plan) return
    const lines = [
      'AI Productivity Coach',
      'Rule-based notes from recorded weekly KPI. A language model was not called.',
      plan.notice || '',
      `${plan.employee_name || plan.employee_id || employeeId}`,
      `Measurement week: ${plan.week || 'Not recorded'}`,
      `Measured KPI: ${scoreText(plan.measured_kpi)}`,
      `Forecast estimate: ${scoreText(plan.predicted_next_week_kpi)}`,
      plan.forecast_note || '',
      '',
      ...(plan.recommendations || []).map((item) => recommendationText(item)),
    ]
    const blob = new Blob([lines.join('\n\n')], { type: 'text/plain' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `coach-${employeeId}-${plan.week || 'week'}.txt`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  async function mark(item) {
    setStatusNote('')
    try {
      await followCoach(employeeId, item.id, 'Reviewed')
      setStatusNote(`Marked for review: ${item.headline}`)
    } catch (err) {
      setStatusNote(err.message || 'The review status was not saved.')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, pr: 6 }}>
        <AutoAwesomeIcon sx={{ color: '#12315c', mt: 0.4 }} />
        <Box>
          <Typography variant="h6" sx={{ color: '#12315c', fontWeight: 700 }}>AI Productivity Coach</Typography>
          <Typography variant="body2" color="text.secondary">
            Suggestions from recorded weekly KPI. A language model was not called.
          </Typography>
        </Box>
        <IconButton aria-label="Close" onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Stack alignItems="center" spacing={1.5} sx={{ py: 6 }}>
            <CircularProgress size={36} />
            <Typography>Analyzing recorded KPI performance...</Typography>
          </Stack>
        ) : null}
        {error ? (
          <Alert severity="error" action={<Button color="inherit" onClick={() => setAttempt((value) => value + 1)}>Retry</Button>}>
            {error}
          </Alert>
        ) : null}
        {plan && !loading ? (
          <Stack spacing={2}>
            <Alert severity="info">{plan.notice}</Alert>
            {plan.coverage === 'Limited history' ? (
              <Alert severity="warning">
                Limited history. The next-week figure is a forecast estimate, not a recorded result and not a promised effect of these suggestions.
              </Alert>
            ) : null}
            <Typography variant="body2" color="text.secondary">
              {plan.employee_name || employeeId}
              {plan.week ? ` · Measurement week ${plan.week}` : ''}
              . A forecast is not a recorded outcome.
            </Typography>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                <Typography variant="caption" color="text.secondary">Measured KPI score</Typography>
                <Typography variant="h4" sx={{ color: '#0f766e' }}>{scoreText(measured)}</Typography>
              </Box>
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#f5f3ff', border: '1px solid #ddd6fe' }}>
                <Typography variant="caption" color="text.secondary">Forecast estimate</Typography>
                <Typography variant="h4" sx={{ color: '#6d28d9' }}>{scoreText(forecast)}</Typography>
              </Box>
            </Box>
            {both ? (
              <Typography variant="body2">
                The forecast estimate is {gap > 0 ? `${gap} points above` : gap < 0 ? `${Math.abs(gap)} points below` : 'the same as'} the measured score. That difference is not evidence that performance will change.
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary">A score difference is not shown because both values are not available on the same record.</Typography>
            )}
            <Typography variant="body2" color="text.secondary">{plan.forecast_note}</Typography>
            {plan.message ? <Alert severity="warning">{plan.message}</Alert> : null}
            <Typography variant="h6" sx={{ color: '#12315c' }}>Personalized Recommendations</Typography>
            {(plan.recommendations || []).length === 0 ? (
              <Alert severity="warning">Insufficient evidence. Component scores are missing, so no recommendation is shown.</Alert>
            ) : (plan.recommendations || []).map((item) => (
              <Box key={item.id} sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
                <Typography variant="subtitle1" sx={{ color: '#12315c', fontWeight: 700 }}>{item.headline}</Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>{item.why_prioritized}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{item.explanation}</Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                  <Button size="small" onClick={() => setOpenId(openId === item.id ? '' : item.id)}>
                    {openId === item.id ? 'Hide evidence' : 'Show evidence'}
                  </Button>
                  <Button size="small" onClick={() => mark(item)}>Mark for Review</Button>
                  <Button size="small" onClick={() => copyText(recommendationText(item))}>Copy Recommendation</Button>
                </Stack>
                {openId === item.id ? (
                  <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 1, bgcolor: '#fffbeb' }}>
                    <Typography variant="body2">{item.evidence}</Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>Next step: {(item.actions || []).join(' ')}</Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>Review after {item.review_after}. {item.coverage}.</Typography>
                    <Typography variant="caption" color="text.secondary">{item.follow_up}</Typography>
                  </Box>
                ) : null}
              </Box>
            ))}
            {statusNote ? <Alert severity="info">{statusNote}</Alert> : null}
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setAttempt((value) => value + 1)} disabled={loading || !employeeId}>Regenerate</Button>
        <Button onClick={downloadReport} disabled={!plan || loading}>Download Report</Button>
        <Button variant="contained" onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  )
}
