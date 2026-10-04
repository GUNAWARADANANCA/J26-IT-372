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
import SettingsPage from './admin/pages/SettingsPage'
import AttendanceQrPage from './attendance/AttendanceQrPage'
import EntitlementDashboard from './entitlements/EntitlementDashboard'
import PayrollPage from './entitlements/PayrollPage'
import EntitlementPage from './entitlements/EntitlementPage'
import { ensureSeeded } from './admin/data/seed'
import { FieldOptionsProvider } from './admin/data/fieldOptions'

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

  useEffect(() => {
    let cancelled = false
    ensureSeeded()
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch((err) => {
        if (!cancelled) setBootError(err.message || 'Failed to reach the API')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const bump = useCallback(() => setRefreshKey((k) => k + 1), [])

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
    <FieldOptionsProvider>
    <Routes>
      <Route path="attendance-qr/token" element={<AttendanceQrPage />} />
      <Route
        element={
          <DeskLayout />
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
        <Route path="settings" element={<SettingsPage />} />
        <Route path="entitlements" element={<EntitlementDashboard />} />
        <Route path="entitlements/payroll" element={<PayrollPage />} />
        <Route path="entitlements/epf" element={<PayrollPage mode="epf" />} />
        <Route path="entitlements/etf" element={<PayrollPage mode="etf" />} />
        <Route path="entitlements/leave" element={<EntitlementPage pageKey="leave" />} />
        <Route path="entitlements/holiday-pay" element={<EntitlementPage pageKey="holiday-pay" />} />
        <Route path="entitlements/overtime" element={<EntitlementPage pageKey="overtime" />} />
        <Route path="entitlements/gratuity" element={<EntitlementPage pageKey="gratuity" />} />
        <Route path="entitlements/promotions" element={<EntitlementPage pageKey="promotions" />} />
        <Route path="entitlements/transfers" element={<EntitlementPage pageKey="transfers" />} />
        <Route path="entitlements/family-benefits" element={<EntitlementPage pageKey="family-benefits" />} />
        <Route path="entitlements/retirement" element={<EntitlementPage pageKey="retirement" />} />
        <Route path="entitlements/loans" element={<EntitlementPage pageKey="loans" />} />
        <Route path="*" element={<Navigate to="/employee" replace />} />
      </Route>
    </Routes>
    </FieldOptionsProvider>
  )
}
