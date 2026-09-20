import { useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import DeskLayout from './admin/layout/DeskLayout'
import EmployeeList from './admin/pages/EmployeeList'
import EmployeeForm from './admin/pages/EmployeeForm'
import DailyKpiList from './admin/pages/DailyKpiList'
import DailyKpiForm from './admin/pages/DailyKpiForm'
import AttendanceLogList from './admin/pages/AttendanceLogList'
import AttendanceLogForm from './admin/pages/AttendanceLogForm'
import { ensureSeeded, resetToSeed } from './admin/data/seed'

function EmployeeFormRoute({ onSaved }) {
  const { id } = useParams()
  const isNew = id === 'new'
  return (
    <EmployeeForm
      name={isNew ? null : decodeURIComponent(id)}
      isNew={isNew}
      onSaved={onSaved}
    />
  )
}

function DailyKpiFormRoute({ onSaved }) {
  const { id } = useParams()
  const isNew = id === 'new'
  return (
    <DailyKpiForm
      name={isNew ? null : decodeURIComponent(id)}
      isNew={isNew}
      onSaved={onSaved}
    />
  )
}

function AttendanceLogFormRoute({ onSaved }) {
  const { id } = useParams()
  const isNew = id === 'new'
  return (
    <AttendanceLogForm
      name={isNew ? null : decodeURIComponent(id)}
      isNew={isNew}
      onSaved={onSaved}
    />
  )
}

function BootScreen({ children }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeContent: 'center',
        gap: 1.5,
        bgcolor: '#ffffff',
        px: 2,
      }}
    >
      {children}
    </Box>
  )
}

export default function App() {
  const [ready, setReady] = useState(false)
  const [bootError, setBootError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    let cancelled = false
    ensureSeeded()
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch((err) => {
        if (!cancelled) setBootError(err.message || 'Failed to load seed data')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const bump = useCallback(() => setRefreshKey((k) => k + 1), [])

  async function handleReset() {
    if (!window.confirm('Reset all local data to the Excel seed?')) return
    setResetting(true)
    try {
      await resetToSeed()
      bump()
    } catch (err) {
      alert(err.message || 'Reset failed')
    } finally {
      setResetting(false)
    }
  }

  if (bootError) {
    return (
      <BootScreen>
        <Typography variant="h5">Could not load desk</Typography>
        <Alert severity="error">{bootError}</Alert>
      </BootScreen>
    )
  }

  if (!ready) {
    return (
      <BootScreen>
        <CircularProgress size={28} />
        <Typography color="text.secondary">Loading Postal KPI Desk…</Typography>
      </BootScreen>
    )
  }

  return (
    <Routes>
      <Route
        element={
          <DeskLayout onResetSeed={handleReset} resetting={resetting} />
        }
      >
        <Route index element={<Navigate to="/employee" replace />} />
        <Route
          path="employee"
          element={<EmployeeList refreshKey={refreshKey} />}
        />
        <Route
          path="employee/:id"
          element={<EmployeeFormRoute onSaved={bump} />}
        />
        <Route
          path="daily-kpi-log"
          element={<DailyKpiList refreshKey={refreshKey} />}
        />
        <Route
          path="daily-kpi-log/:id"
          element={<DailyKpiFormRoute onSaved={bump} />}
        />
        <Route
          path="attendance-log"
          element={<AttendanceLogList refreshKey={refreshKey} />}
        />
        <Route
          path="attendance-log/:id"
          element={<AttendanceLogFormRoute onSaved={bump} />}
        />
        <Route path="*" element={<Navigate to="/employee" replace />} />
      </Route>
    </Routes>
  )
}
