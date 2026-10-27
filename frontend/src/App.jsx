import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
<<<<<<< HEAD
import { Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
=======
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
>>>>>>> 9d23eff4f7a18d59ab13c66ac499ca36202d5cae
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import { useAuth } from './auth.jsx'
import Layout from './components/Layout.jsx'
import { Spinner } from './components/ui.jsx'
import Audit from './pages/Audit.jsx'
import CounterHome from './pages/CounterHome.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Devices from './pages/Devices.jsx'
import IntakeWizard from './pages/IntakeWizard.jsx'
import ItemDetail from './pages/ItemDetail.jsx'
import Items from './pages/Items.jsx'
import LabelPrint from './pages/LabelPrint.jsx'
import Login from './pages/Login.jsx'
import Notifications from './pages/Notifications.jsx'
import Offices from './pages/Offices.jsx'
import Reports from './pages/Reports.jsx'
import ReviewQueue from './pages/ReviewQueue.jsx'
import ScanEvent from './pages/ScanEvent.jsx'
import Track from './pages/Track.jsx'
// Postal KPI desk (employees, daily KPI, attendance, productivity, entitlements and payroll)
import DeskLayout from './admin/layout/DeskLayout'
<<<<<<< HEAD
import frappeTheme from './admin/theme'
=======
import { AuthProvider, useAuth } from './admin/data/auth'
>>>>>>> 9d23eff4f7a18d59ab13c66ac499ca36202d5cae
import { ensureSeeded } from './admin/data/seed'
import { FieldOptionsProvider } from './admin/data/fieldOptions'
import { AuthProvider as KpiAuthProvider, useAuth as useKpiAuth } from './admin/data/auth'

<<<<<<< HEAD
// Lazy-loaded pages for Postal KPI desk & Daily Accounts
const EmployeeList = lazy(() => import('./admin/pages/EmployeeList'))
const EmployeeForm = lazy(() => import('./admin/pages/EmployeeForm'))
const DailyAttendancePage = lazy(() => import('./admin/pages/DailyAttendancePage'))
const DailyKpiList = lazy(() => import('./admin/pages/DailyKpiList'))
const DailyKpiForm = lazy(() => import('./admin/pages/DailyKpiForm'))
=======
// Lazy-loaded pages for code splitting & fast initial paint
const EmployeeList = lazy(() => import('./admin/pages/EmployeeList'))
const EmployeeForm = lazy(() => import('./admin/pages/EmployeeForm'))
const DailyAttendancePage = lazy(() => import('./admin/pages/DailyAttendancePage'))
>>>>>>> 9d23eff4f7a18d59ab13c66ac499ca36202d5cae
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

<<<<<<< HEAD
// Registered mail route protection
function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="grid h-full place-items-center"><Spinner /></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

// ------------------------------------------------------------------ Postal KPI desk helpers
=======
>>>>>>> 9d23eff4f7a18d59ab13c66ac499ca36202d5cae
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
<<<<<<< HEAD
  const { user } = useKpiAuth()
=======
  const { user } = useAuth()
>>>>>>> 9d23eff4f7a18d59ab13c66ac499ca36202d5cae
  if (user?.role !== 'postmaster') {
    return <Navigate to="/employee" replace />
  }
  return children
}
<<<<<<< HEAD
=======

>>>>>>> 9d23eff4f7a18d59ab13c66ac499ca36202d5cae
function EmployeeFormRoute({ onSaved }) {
  const { id } = useParams()
  const isNew = id === 'new'
  return <EmployeeForm name={isNew ? null : decodeURIComponent(id)} isNew={isNew} onSaved={onSaved} />
}

<<<<<<< HEAD
function DailyKpiFormRoute({ onSaved }) {
  const { id } = useParams()
  const isNew = id === 'new'
  return <DailyKpiForm name={isNew ? null : decodeURIComponent(id)} isNew={isNew} onSaved={onSaved} />
}

=======
>>>>>>> 9d23eff4f7a18d59ab13c66ac499ca36202d5cae
function AttendanceLogFormRoute({ onSaved }) {
  const { id } = useParams()
  const isNew = id === 'new'
  return <AttendanceLogForm name={isNew ? null : decodeURIComponent(id)} isNew={isNew} onSaved={onSaved} />
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

// The desk's own theme, start-up check, auth provider, and dropdown options apply to its pages only.
function KpiDeskShell() {
  const [ready, setReady] = useState(false)
  const [bootError, setBootError] = useState('')

  useEffect(() => {
    let cancelled = false
    ensureSeeded()
      .then(() => { if (!cancelled) setReady(true) })
      .catch((err) => { if (!cancelled) setBootError(err.message || 'Failed to reach the API') })
    return () => { cancelled = true }
  }, [])

  let body
  if (bootError) {
    body = (
      <BootScreen>
        <Typography variant="h5" sx={{ color: '#0B1F3A', fontWeight: 700 }}>
          Could not connect to Post-Assist LK service
        </Typography>
        <Alert severity="error" sx={{ borderRadius: 2 }}>{bootError}</Alert>
      </BootScreen>
    )
  } else if (!ready) {
    body = (
      <BootScreen>
        <CircularProgress size={32} sx={{ color: '#1677D2' }} />
        <Typography sx={{ color: '#475569', fontWeight: 500 }}>
          Loading Post-Assist LK Desk…
        </Typography>
      </BootScreen>
    )
  } else {
    body = <Outlet />
  }
  return (
<<<<<<< HEAD
    <ThemeProvider theme={frappeTheme}>
      <CssBaseline />
      <KpiAuthProvider>
        <FieldOptionsProvider>
          <Suspense fallback={<PageLoadingFallback />}>
            {body}
          </Suspense>
        </FieldOptionsProvider>
      </KpiAuthProvider>
    </ThemeProvider>
  )
}

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0)
  const bump = useCallback(() => setRefreshKey((k) => k + 1), [])

  return (
    <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/track/:trackingId" element={<Track />} />
          <Route path="/items/:trackingId/print" element={<Protected><LabelPrint /></Protected>} />
          <Route element={<Protected><Layout /></Protected>}>
            <Route index element={<Dashboard />} />
            <Route path="counter" element={<CounterHome />} />
            <Route path="counter/:draftId" element={<IntakeWizard />} />
            <Route path="items" element={<Items />} />
            <Route path="items/:trackingId" element={<ItemDetail />} />
            <Route path="scan" element={<ScanEvent />} />
            <Route path="review" element={<ReviewQueue />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="devices" element={<Devices />} />
            <Route path="offices" element={<Offices />} />
            <Route path="reports" element={<Reports />} />
            <Route path="audit" element={<Audit />} />
          </Route>

          <Route element={<KpiDeskShell />}>
=======
    <AuthProvider>
      <FieldOptionsProvider>
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
>>>>>>> 9d23eff4f7a18d59ab13c66ac499ca36202d5cae
            <Route path="attendance-qr/token" element={<AttendanceQrPage />} />
            <Route path="sign-in" element={<SignInPage />} />
            <Route path="daily-accounts" element={<DailyAccountsPage />} />
            <Route path="daily-accounts/*" element={<DailyAccountsPage />} />
<<<<<<< HEAD
            <Route element={<DeskLayout />}>
              <Route path="employee" element={<EmployeeList refreshKey={refreshKey} />} />
              <Route path="employee/:id" element={<EmployeeFormRoute onSaved={bump} />} />
              <Route path="daily-kpi-log" element={<DailyKpiList refreshKey={refreshKey} />} />
              <Route path="daily-kpi-log/:id" element={<DailyKpiFormRoute onSaved={bump} />} />
              <Route path="daily-attendance" element={<DailyAttendancePage refreshKey={refreshKey} />} />
              <Route path="attendance-log" element={<AttendanceLogList refreshKey={refreshKey} />} />
              <Route path="attendance-log/:id" element={<AttendanceLogFormRoute onSaved={bump} />} />
=======
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
>>>>>>> 9d23eff4f7a18d59ab13c66ac499ca36202d5cae
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
<<<<<<< HEAD
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
=======
          </Routes>
        </Suspense>
      </FieldOptionsProvider>
    </AuthProvider>
>>>>>>> 9d23eff4f7a18d59ab13c66ac499ca36202d5cae
  )
}
