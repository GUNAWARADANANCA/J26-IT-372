import { useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import dailyKpiLogDoctype from '../doctypes/dailyKpiLog.doctype'
import employeeDoctype from '../doctypes/employee.doctype'
import { approveAllocation, previewAllocation } from '../data/repository'

function optionsFor(meta, fieldname) {
  for (const section of meta.sections) {
    const field = section.fields.find((item) => item.fieldname === fieldname)
    if (field?.options) return field.options
  }
  return []
}

function todayIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export default function AllocateWorkPage() {
  const offices = useMemo(() => optionsFor(employeeDoctype, 'post_office'), [])
  const tasks = useMemo(() => optionsFor(dailyKpiLogDoctype, 'primary_task_type'), [])
  const [date, setDate] = useState(todayIso)
  const [postOffice, setPostOffice] = useState(offices[0] || '')
  const [task, setTask] = useState(tasks[0] || '')
  const [itemCount, setItemCount] = useState('20')
  const [routeId, setRouteId] = useState('')
  const [routeLength, setRouteLength] = useState('')
  const [preview, setPreview] = useState(null)
  const [counts, setCounts] = useState({})
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [busy, setBusy] = useState(false)

  const delivery = task === 'Mail & Parcel Delivery'

  function payload(nextCounts) {
    return {
      date,
      post_office: postOffice,
      primary_task_type: task,
      item_count: Number(itemCount),
      route_id: delivery ? routeId : '',
      route_length_km: delivery ? Number(routeLength || 0) : 0,
      assignments: Object.entries(nextCounts || counts).map(([employee_id, count]) => ({
        employee_id,
        count: Number(count),
      })),
    }
  }

  async function showSplit() {
    setBusy(true)
    setError('')
    setSaved('')
    setPreview(null)
    try {
      const result = await previewAllocation(payload())
      const next = {}
      for (const row of result.assignments) next[row.employee_id] = row.suggested
      setCounts(next)
      setPreview(result)
    } catch (err) {
      setError(err.message || 'Could not build a split')
    } finally {
      setBusy(false)
    }
  }

  async function approve() {
    setBusy(true)
    setError('')
    setSaved('')
    try {
      const result = await approveAllocation(payload(counts))
      const names = result.saved
        .map((row) => `${row.employee_name} +${row.added}`)
        .join(', ')
      setSaved(`${result.note} ${names}`)
      setPreview(null)
    } catch (err) {
      setError(err.message || 'Could not save the allocation')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        Daily work
      </Typography>
      <Typography variant="h5">Allocate work</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Enter the day’s workload. The split is a suggestion for people who are present.
        Nothing is saved until you approve it. The KPI forecast is not used.
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
        <TextField
          label="Date"
          type="date"
          size="small"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          select
          label="Post office"
          size="small"
          value={postOffice}
          onChange={(event) => setPostOffice(event.target.value)}
          sx={{ minWidth: 180 }}
        >
          {offices.map((office) => (
            <MenuItem key={office} value={office}>
              {office}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Task type"
          size="small"
          value={task}
          onChange={(event) => setTask(event.target.value)}
          sx={{ minWidth: 220 }}
        >
          {tasks.map((item) => (
            <MenuItem key={item} value={item}>
              {item}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Items"
          type="number"
          size="small"
          value={itemCount}
          onChange={(event) => setItemCount(event.target.value)}
          sx={{ width: 120 }}
        />
        {delivery ? (
          <>
            <TextField
              label="Route ID"
              size="small"
              value={routeId}
              onChange={(event) => setRouteId(event.target.value)}
            />
            <TextField
              label="Route length (km)"
              type="number"
              size="small"
              value={routeLength}
              onChange={(event) => setRouteLength(event.target.value)}
              sx={{ width: 160 }}
            />
          </>
        ) : null}
        <Button variant="contained" onClick={showSplit} disabled={busy}>
          Show suggested split
        </Button>
      </Stack>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {saved ? <Alert severity="success" sx={{ mb: 2 }}>{saved}</Alert> : null}

      {preview ? (
        <Stack spacing={2}>
          <Alert severity="info">{preview.cap_note}</Alert>
          {preview.unassigned > 0 ? (
            <Alert severity="warning">
              {preview.unassigned} items do not fit in the remaining room. Lower the total or leave them for later.
            </Alert>
          ) : null}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Suggested split
            </Typography>
            {preview.assignments.length === 0 ? (
              <Typography variant="body2">No present employee matches this task.</Typography>
            ) : (
              <Stack spacing={1}>
                {preview.assignments.map((row) => (
                  <Stack
                    key={row.employee_id}
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ sm: 'center' }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2">
                        {row.employee_name} ({row.employee_id})
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.attendance_status} · already assigned {row.already_assigned} · room for {row.remaining}
                      </Typography>
                    </Box>
                    <TextField
                      label="Give"
                      type="number"
                      size="small"
                      value={counts[row.employee_id] ?? 0}
                      onChange={(event) =>
                        setCounts((current) => ({
                          ...current,
                          [row.employee_id]: event.target.value,
                        }))
                      }
                      sx={{ width: 100 }}
                    />
                  </Stack>
                ))}
              </Stack>
            )}
            {preview.assignments.length > 0 ? (
              <Button variant="contained" sx={{ mt: 2 }} onClick={approve} disabled={busy}>
                Approve allocation
              </Button>
            ) : null}
          </Paper>
          {preview.excluded.length > 0 ? (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Not included
              </Typography>
              <Stack spacing={0.5}>
                {preview.excluded.map((row) => (
                  <Typography key={`${row.employee_id}-${row.reason}`} variant="body2">
                    {row.employee_name}: {row.reason}
                  </Typography>
                ))}
              </Stack>
            </Paper>
          ) : null}
        </Stack>
      ) : null}
    </Box>
  )
}
