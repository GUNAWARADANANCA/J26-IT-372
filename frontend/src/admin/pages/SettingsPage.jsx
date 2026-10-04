import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Paper from '@mui/material/Paper'
import CircularProgress from '@mui/material/CircularProgress'
import FormGroup from '@mui/material/FormGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import { QRCodeSVG } from 'qrcode.react'
import {
  getAttendanceSettings,
  saveAttendanceSettings,
} from '../data/repository'

const QR_URL = 'https://localhost:5173/attendance-qr/token'

const DAYS = [
  { value: 0, label: 'Monday' },
  { value: 1, label: 'Tuesday' },
  { value: 2, label: 'Wednesday' },
  { value: 3, label: 'Thursday' },
  { value: 4, label: 'Friday' },
  { value: 5, label: 'Saturday' },
  { value: 6, label: 'Sunday' },
]

const TIME_FIELDS = [
  ['on_time_start', 'on_time_end', 'On-time check-in'],
  ['late_start', 'late_end', 'Late check-in'],
  ['half_day_start', 'half_day_end', 'Half day'],
  ['checkout_start', 'checkout_end', 'Evening check-out'],
]

function formFromSettings(settings) {
  return {
    latitude: String(settings.latitude),
    longitude: String(settings.longitude),
    radius_meters: String(settings.radius_meters),
    on_time_start: settings.on_time_start,
    on_time_end: settings.on_time_end,
    late_start: settings.late_start,
    late_end: settings.late_end,
    half_day_start: settings.half_day_start,
    half_day_end: settings.half_day_end,
    checkout_start: settings.checkout_start,
    checkout_end: settings.checkout_end,
    open_days: settings.open_days || [],
  }
}

export default function SettingsPage() {
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let cancelled = false
    getAttendanceSettings()
      .then((settings) => {
        if (cancelled) return
        setForm(formFromSettings(settings))
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load settings')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleSave(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const saved = await saveAttendanceSettings({
        ...form,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        radius_meters: Number(form.radius_meters),
      })
      setForm(formFromSettings(saved))
      setNotice('Attendance settings saved.')
    } catch (err) {
      setError(err.message || 'Could not save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !form) {
    return (
      <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
        {error ? <Alert severity="error">{error}</Alert> : <CircularProgress size={28} />}
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 980 }}>
      <Typography variant="caption" color="text.secondary">
        Module
      </Typography>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Settings
      </Typography>

      {notice && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {notice}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="flex-start">
        <Box component="form" onSubmit={handleSave} sx={{ flex: 1, width: '100%' }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Post office location
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Latitude"
              type="number"
              required
              value={form.latitude}
              inputProps={{ step: 'any' }}
              onChange={(event) => setField('latitude', event.target.value)}
            />
            <TextField
              label="Longitude"
              type="number"
              required
              value={form.longitude}
              inputProps={{ step: 'any' }}
              onChange={(event) => setField('longitude', event.target.value)}
            />
            <TextField
              label="Allowed radius (meters)"
              type="number"
              required
              value={form.radius_meters}
              inputProps={{ step: 1, min: 20, max: 1000 }}
              onChange={(event) => setField('radius_meters', event.target.value)}
            />
            <Typography variant="h6" sx={{ mt: 1 }}>
              Attendance hours
            </Typography>
            {TIME_FIELDS.map(([start, end, label]) => (
              <Stack key={label} direction="row" spacing={1.5}>
                <TextField
                  label={`${label} from`}
                  type="time"
                  required
                  value={form[start]}
                  InputLabelProps={{ shrink: true }}
                  onChange={(event) => setField(start, event.target.value)}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="to"
                  type="time"
                  required
                  value={form[end]}
                  InputLabelProps={{ shrink: true }}
                  onChange={(event) => setField(end, event.target.value)}
                  sx={{ flex: 1 }}
                />
              </Stack>
            ))}
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                Open days
              </Typography>
              <FormGroup row>
                {DAYS.map((day) => (
                  <FormControlLabel
                    key={day.value}
                    label={day.label}
                    control={
                      <Checkbox
                        checked={form.open_days.includes(day.value)}
                        onChange={(event) => {
                          setForm((current) => {
                            const open_days = event.target.checked
                              ? [...current.open_days, day.value]
                              : current.open_days.filter((value) => value !== day.value)
                            return { ...current, open_days }
                          })
                        }}
                      />
                    }
                  />
                ))}
              </FormGroup>
            </Box>
            <Button type="submit" variant="contained" disabled={saving} sx={{ alignSelf: 'flex-start' }}>
              {saving ? 'Saving…' : 'Save settings'}
            </Button>
          </Stack>
        </Box>

        <Paper variant="outlined" sx={{ p: 2, width: { xs: '100%', md: 280 } }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Door QR
          </Typography>
          <Box sx={{ display: 'grid', placeItems: 'center', py: 1 }}>
            <QRCodeSVG value={QR_URL} size={180} />
          </Box>
          <Typography variant="body2" sx={{ wordBreak: 'break-all', mb: 1 }}>
            {QR_URL}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            On a phone, replace localhost with this laptop’s IP address. Accept the certificate warning once so the browser can read location.
          </Typography>
        </Paper>
      </Stack>
    </Box>
  )
}
