import { useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import Paper from '@mui/material/Paper'
import CircularProgress from '@mui/material/CircularProgress'
import {
  checkAttendanceLocation,
  getAttendanceRoster,
  scanAttendance,
} from '../admin/data/repository'

const LOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 15000,
}

function requestLocation() {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) {
      reject(new Error('Open the page with https, then allow location.'))
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
      finish(false, new Error('Could not read location. Stand nearer the door and try again.'))
    }

    watchId = navigator.geolocation.watchPosition(onSuccess, onError, LOCATION_OPTIONS)
    navigator.geolocation.getCurrentPosition(onSuccess, onError, LOCATION_OPTIONS)
  })
}

function employeeLabel(employee) {
  return employee.employee_name || employee.employee_id || employee.name
}

const DOOR_CODE_KEY = 'postassist-door-code'

function doorCodeFromAddress() {
  const params = new URLSearchParams(window.location.search)
  let code = (params.get('code') || '').trim()
  if (!code) {
    const raw = window.location.hash.replace(/^#/, '')
    if (raw) {
      try {
        code = decodeURIComponent(raw).trim()
      } catch {
        code = raw.trim()
      }
    }
  }
  const hashAt = code.lastIndexOf('#')
  if (hashAt >= 0) code = code.slice(hashAt + 1).trim()
  if (code) {
    sessionStorage.setItem(DOOR_CODE_KEY, code)
    return code
  }
  return sessionStorage.getItem(DOOR_CODE_KEY) || ''
}

export default function AttendanceQrPage() {
  const [doorToken, setDoorToken] = useState(doorCodeFromAddress)
  const [step, setStep] = useState('locating')
  const [position, setPosition] = useState(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [employees, setEmployees] = useState([])
  const [savingName, setSavingName] = useState('')
  const [result, setResult] = useState(null)
  const errorRef = useRef(null)

  useEffect(() => {
    if (!window.location.hash && !new URLSearchParams(window.location.search).get('code')) return
    window.history.replaceState(null, '', window.location.pathname)
  }, [])

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [error])

  const matches = useMemo(() => {
    const query = search.trim().toLowerCase()
    const rows = [...employees].sort((a, b) =>
      employeeLabel(a).localeCompare(employeeLabel(b)),
    )
    if (!query) return rows
    return rows.filter((employee) =>
      `${employee.employee_name} ${employee.employee_id} ${employee.post_office}`
        .toLowerCase()
        .includes(query),
    )
  }, [employees, search])

  useEffect(() => {
    let cancelled = false
    async function begin() {
      try {
        const reading = await requestLocation()
        if (cancelled) return
        const { latitude, longitude, accuracy } = reading.coords
        await checkAttendanceLocation(latitude, longitude)
        if (cancelled) return
        const rows = await getAttendanceRoster()
        if (cancelled) return
        setEmployees(Array.isArray(rows) ? rows : [])
        setPosition({ latitude, longitude, accuracy })
        setStep('pick')
      } catch (err) {
        if (cancelled) return
        setError(err.message || 'Location check failed')
        setStep('blocked')
      }
    }
    begin()
    return () => {
      cancelled = true
    }
  }, [])

  async function retryLocation() {
    setError('')
    setStep('locating')
    try {
      const reading = await requestLocation()
      const { latitude, longitude, accuracy } = reading.coords
      await checkAttendanceLocation(latitude, longitude)
      if (employees.length === 0) {
        const rows = await getAttendanceRoster()
        setEmployees(Array.isArray(rows) ? rows : [])
      }
      setPosition({ latitude, longitude, accuracy })
      setStep('pick')
    } catch (err) {
      setError(err.message || 'Location check failed')
      setStep('blocked')
    }
  }

  async function record(employee) {
    if (!position || savingName) return
    const id = employee.name || employee.employee_id
    setSavingName(id)
    setError('')
    try {
      const saved = await scanAttendance({
        employeeId: id,
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        doorToken,
      })
      setResult({ ...saved, employee_name: saved.employee_name || employeeLabel(employee) })
      setStep('done')
    } catch (err) {
      setError(err.message || 'Could not save attendance')
    } finally {
      setSavingName('')
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#f4f7fb',
        px: 2,
        py: 3,
      }}
    >
      <Paper sx={{ width: '100%', maxWidth: 480, mx: 'auto', p: 2.5 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
          Attendance
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Enter the current door code, then tap your name. Selecting a name is not identity verification. The code and this phone’s location do not prove who is at the door.
        </Typography>
        <TextField
          label="Door code"
          value={doorToken}
          onChange={(event) => {
            const value = event.target.value.trim()
            const code = value.includes('#') ? value.slice(value.lastIndexOf('#') + 1).trim() : value
            if (code) sessionStorage.setItem(DOOR_CODE_KEY, code)
            setDoorToken(code)
          }}
          size="small"
          fullWidth
          sx={{ mb: 2 }}
        />

        {error && (
          <Alert ref={errorRef} severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {step === 'locating' && (
          <Stack alignItems="center" spacing={1.5} sx={{ py: 4 }}>
            <CircularProgress size={36} />
            <Typography variant="h6" align="center">
              Allow location
            </Typography>
            <Typography color="text.secondary" align="center">
              The phone checks that you are at the post office.
            </Typography>
          </Stack>
        )}

        {step === 'blocked' && (
          <Button variant="contained" size="large" fullWidth onClick={retryLocation} sx={{ py: 1.5 }}>
            Try again
          </Button>
        )}

        {(step === 'pick' || (step === 'done' && error)) && (
          <Stack spacing={1.5}>
            <TextField
              placeholder="Find a name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              fullWidth
            />
            {matches.length === 0 && (
              <Typography color="text.secondary">No matching employee</Typography>
            )}
            {matches.map((employee) => {
              const id = employee.name || employee.employee_id
              const busy = savingName === id
              return (
                <Button
                  key={id}
                  variant="contained"
                  size="large"
                  disabled={Boolean(savingName)}
                  onClick={() => record(employee)}
                  sx={{
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    py: 1.75,
                    px: 2,
                    borderRadius: 2,
                  }}
                >
                  <Box sx={{ width: '100%' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.15rem' }}>
                      {busy ? 'Saving…' : employeeLabel(employee)}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      {employee.employee_id}
                      {employee.designation ? ` · ${employee.designation}` : ''}
                    </Typography>
                  </Box>
                </Button>
              )
            })}
          </Stack>
        )}

        {step === 'done' && result && !error && (
          <Stack spacing={1.5} sx={{ py: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {result.action === 'in' ? 'Checked in' : 'Checked out'}
            </Typography>
            <Typography variant="h6">{result.employee_name}</Typography>
            <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              {[
                ['Employee ID', result.employee_id],
                ['Date', result.date],
                ['Time', result.time],
                ['Status', result.status || 'Recorded'],
                ['Post office', result.post_office],
                ['Designation', result.designation],
              ].map(([label, value]) => (
                <Box key={label}>
                  <Typography component="dt" variant="caption" color="text.secondary">{label}</Typography>
                  <Typography component="dd" sx={{ m: 0, fontWeight: 700 }}>{value || 'Not recorded'}</Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="body2" color="text.secondary">
              This scan is saved on today’s attendance report.
            </Typography>
            <Button
              variant="contained"
              size="large"
              fullWidth
              sx={{ py: 1.5 }}
              onClick={() => {
                setResult(null)
                setSearch('')
                setStep('pick')
              }}
            >
              Next person
            </Button>
          </Stack>
        )}
      </Paper>
    </Box>
  )
}
