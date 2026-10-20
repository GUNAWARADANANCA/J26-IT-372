import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import DeskLayout from './admin/layout/DeskLayout'
import { AuthProvider, useAuth } from './admin/data/auth'
import { ensureSeeded } from './admin/data/seed'
import { FieldOptionsProvider } from './admin/data/fieldOptions'

// Lazy-loaded pages for code splitting & fast initial paint
const EmployeeList = lazy(() => import('./admin/pages/EmployeeList'))
const EmployeeForm = lazy(() => import('./admin/pages/EmployeeForm'))
const DailyAttendancePage = lazy(() => import('./admin/pages/DailyAttendancePage'))
const AttendanceLogList = lazy(() => import('./admin/pages/AttendanceLogList'))
const AttendanceLogForm = lazy(() => import('./admin/pages/AttendanceLogForm'))
const SettingsPage = lazy(() => import('./admin/pages/SettingsPage'))
const AttendanceQrPage = lazy(() => import('./attendance/AttendanceQrPage'))
const ProductivityPage = lazy(() => import('./admin/pages/ProductivityPage'))
const KpiSimulatorPage = lazy(() => import('./admin/pages/KpiSimulatorPage'))
const ForecastMonitoringPage = lazy(() => import('./admin/pages/ForecastMonitoringPage'))
const KpiForecastPage = lazy(() => import('./admin/pages/KpiForecastPage'))
const PostalKpiDashboard = lazy(() => import('./admin/pages/PostalKpiDashboard'))
const SignInPage = lazy(() => import('./admin/pages/SignInPage'))
const WorkAllocationPage = lazy(() => import('./admin/pages/WorkAllocationPage'))
const DailyAccountsPage = lazy(() => import('./admin/pages/DailyAccountsPage'))
const EntitlementDashboard = lazy(() => import('./entitlements/EntitlementDashboard'))
const PayrollPage = lazy(() => import('./entitlements/PayrollPage'))
const EntitlementPage = lazy(() => import('./entitlements/EntitlementPage'))

function PageLoadingFallback() {
  return (
    <Box
      sx={{
        p: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '40vh',
        gap: 1.5,
      }}
    >
      <CircularProgress size={30} sx={{ color: '#1677D2' }} />
      <Typography variant="body2" sx={{ color: '#475569', fontWeight: 500 }}>
        Loading Sri Lanka Post module…
      </Typography>
    </Box>
  )
}

function RequirePostmaster({ children }) {
  const { user } = useAuth()
  if (user?.role !== 'postmaster') {
    return <Navigate to="/employee" replace />
  }
  return children
}

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
        bgcolor: '#F3F6FB',
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
        <Typography variant="h5" sx={{ color: '#0B1F3A', fontWeight: 700 }}>
          Could not connect to Post-Assist LK service
        </Typography>
        <Alert severity="error" sx={{ borderRadius: 2 }}>{bootError}</Alert>
      </BootScreen>
    )
  }

  if (!ready) {
    return (
      <BootScreen>
        <CircularProgress size={32} sx={{ color: '#1677D2' }} />
        <Typography sx={{ color: '#475569', fontWeight: 500 }}>
          Loading Post-Assist LK Desk…
        </Typography>
      </BootScreen>
    )
  }

  return (
    <AuthProvider>
      <FieldOptionsProvider>
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            <Route path="attendance-qr/token" element={<AttendanceQrPage />} />
            <Route path="sign-in" element={<SignInPage />} />
            <Route path="daily-accounts" element={<DailyAccountsPage />} />
            <Route path="daily-accounts/*" element={<DailyAccountsPage />} />
            <Route index element={<Navigate to="/sign-in" replace />} />
            <Route element={<DeskLayout />}>
              <Route
                path="employee"
                element={<EmployeeList refreshKey={refreshKey} />}
              />
              <Route
                path="employee/:id"
                element={<EmployeeFormRoute onSaved={bump} />}
              />
              <Route
                path="daily-attendance"
                element={<DailyAttendancePage refreshKey={refreshKey} />}
              />
              <Route
                path="daily-kpi-log"
                element={<Navigate to="/attendance-log" replace />}
              />
              <Route
                path="daily-kpi-log/*"
                element={<Navigate to="/attendance-log" replace />}
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
              <Route path="productivity" element={<ProductivityPage />} />
              <Route path="kpi-simulator" element={<KpiSimulatorPage />} />
              <Route path="forecast-monitoring" element={<RequirePostmaster><ForecastMonitoringPage /></RequirePostmaster>} />
              <Route path="kpi-forecasts" element={<RequirePostmaster><KpiForecastPage /></RequirePostmaster>} />
              <Route path="postal-kpi-dashboard" element={<RequirePostmaster><PostalKpiDashboard /></RequirePostmaster>} />
              <Route path="work-allocation" element={<WorkAllocationPage />} />
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
        </Suspense>
      </FieldOptionsProvider>
    </AuthProvider>
  )
}
