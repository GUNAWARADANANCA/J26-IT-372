import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Paper from '@mui/material/Paper'
import CircularProgress from '@mui/material/CircularProgress'
import { QRCodeSVG } from 'qrcode.react'
import {
  getAttendanceSettings,
  saveAttendanceSettings,
} from '../data/repository'

const QR_URL = 'https://localhost:5173/attendance-qr/token'

export default function SettingsPage() {
  const [form, setForm] = useState({
    latitude: '',
    longitude: '',
    radius_meters: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let cancelled = false
    getAttendanceSettings()
      .then((settings) => {
        if (cancelled) return
        setForm({
          latitude: String(settings.latitude),
          longitude: String(settings.longitude),
          radius_meters: String(settings.radius_meters),
        })
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
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        radius_meters: Number(form.radius_meters),
      })
      setForm({
        latitude: String(saved.latitude),
        longitude: String(saved.longitude),
        radius_meters: String(saved.radius_meters),
      })
      setNotice('Post office location saved.')
    } catch (err) {
      setError(err.message || 'Could not save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 720 }}>
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
            <Button type="submit" variant="contained" disabled={saving} sx={{ alignSelf: 'flex-start' }}>
              {saving ? 'Saving…' : 'Save location'}
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
