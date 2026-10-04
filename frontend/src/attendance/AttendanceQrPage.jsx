import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import Paper from '@mui/material/Paper'
import CircularProgress from '@mui/material/CircularProgress'
import InputAdornment from '@mui/material/InputAdornment'
import SearchIcon from '@mui/icons-material/Search'
import {
  checkAttendanceLocation,
  list,
  scanAttendance,
} from '../admin/data/repository'

const MAX_ACCURACY_METERS = 150

const LOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 0,
}

function requestLocation() {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) {
      reject(
        new Error(
          'Open this page with https, then tap Check my location again so the phone can ask for permission.',
        ),
      )
      return
    }
    if (!navigator.geolocation) {
      reject(new Error('This phone cannot share its location.'))
      return
    }

    let settled = false
    let watchId = null
    const finish = (ok, value) => {
      if (settled) return
      settled = true
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
      if (ok) resolve(value)
      else reject(value)
    }

    const onSuccess = (position) => finish(true, position)
    const onError = (error) => {
      if (error.code === error.PERMISSION_DENIED) {
        finish(false, new Error('Tap Allow when the phone asks for location.'))
        return
      }
      finish(
        false,
        new Error('Could not read this phone’s location. Try again nearer the door.'),
      )
    }

    watchId = navigator.geolocation.watchPosition(onSuccess, onError, LOCATION_OPTIONS)
    navigator.geolocation.getCurrentPosition(onSuccess, onError, LOCATION_OPTIONS)
  })
}

export default function AttendanceQrPage() {
  const [step, setStep] = useState('start')
  const [position, setPosition] = useState(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [employees, setEmployees] = useState([])
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)

  const matches = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return []
    return employees
      .filter((employee) =>
        `${employee.employee_name} ${employee.employee_id} ${employee.post_office}`
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 8)
  }, [employees, search])

  async function handleLocate() {
    setError('')
    const readingPromise = requestLocation()
    setStep('locating')
    try {
      const reading = await readingPromise
      const { latitude, longitude, accuracy } = reading.coords
      if (accuracy != null && accuracy > MAX_ACCURACY_METERS) {
        setError(
          `Location is only accurate to ${Math.round(accuracy)} m. Step outside near the door and try again.`,
        )
        setStep('start')
        return
      }
      await checkAttendanceLocation(latitude, longitude)
      const rows = await list('employee')
      setEmployees(rows)
      setPosition({ latitude, longitude, accuracy })
      setStep('search')
    } catch (err) {
      setError(err.message || 'Location check failed')
      setStep('start')
    }
  }

  async function handleConfirm() {
    if (!selected || !position) return
    setSaving(true)
    setError('')
    try {
      const saved = await scanAttendance({
        employeeId: selected.name,
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
      })
      setResult(saved)
      setStep('done')
    } catch (err) {
      setError(err.message || 'Could not save attendance')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#f4f7fb',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        py: 4,
      }}
    >
      <Paper sx={{ width: '100%', maxWidth: 420, p: 3 }}>
        <Typography variant="overline" color="text.secondary">
          Postal KPI
        </Typography>
        <Typography variant="h5" sx={{ mb: 0.5 }}>
          Attendance
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Stand at the post office door. Your phone’s location is checked before the time is saved.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {step === 'start' && (
          <Button variant="contained" size="large" fullWidth onClick={handleLocate}>
            Check my location
          </Button>
        )}

        {step === 'locating' && (
          <Stack alignItems="center" spacing={1.5} sx={{ py: 2 }}>
            <CircularProgress size={28} />
            <Typography color="text.secondary">Checking if you are at the post office...</Typography>
          </Stack>
        )}

        {step === 'search' && (
          <Stack spacing={2}>
            <TextField
              autoFocus
              placeholder="Search your name"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setSelected(null)
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <Stack spacing={1}>
              {search.trim() && matches.length === 0 && (
                <Typography color="text.secondary">No matching employee</Typography>
              )}
              {matches.map((employee) => {
                const active = selected?.name === employee.name
                return (
                  <Button
                    key={employee.name}
                    variant={active ? 'contained' : 'outlined'}
                    onClick={() => setSelected(employee)}
                    sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: 600 }}>
                        {employee.employee_name}
                      </Typography>
                      <Typography variant="caption" color={active ? 'inherit' : 'text.secondary'}>
                        {employee.employee_id}
                        {employee.post_office ? ` · ${employee.post_office}` : ''}
                      </Typography>
                    </Box>
                  </Button>
                )
              })}
            </Stack>
            <Button
              variant="contained"
              size="large"
              disabled={!selected || saving}
              onClick={handleConfirm}
            >
              {saving ? 'Saving…' : 'Record my time'}
            </Button>
          </Stack>
        )}

        {step === 'done' && result && (
          <Alert severity="success">
            {result.action === 'in' ? 'Checked in' : 'Checked out'} at {result.time}
            {result.status ? ` (${result.status})` : ''} for {result.employee_name}.
          </Alert>
        )}
      </Paper>
    </Box>
  )
}
