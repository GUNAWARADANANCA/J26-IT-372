import { useCallback, useEffect, useState } from 'react'
import { Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
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
import EmployeeList from './admin/pages/EmployeeList'
import EmployeeForm from './admin/pages/EmployeeForm'
import DailyKpiList from './admin/pages/DailyKpiList'
import ChecklistPage from './admin/pages/ChecklistPage'
import DailyKpiForm from './admin/pages/DailyKpiForm'
import AttendanceLogList from './admin/pages/AttendanceLogList'
import AttendanceLogForm from './admin/pages/AttendanceLogForm'
import SettingsPage from './admin/pages/SettingsPage'
import AttendanceQrPage from './attendance/AttendanceQrPage'
import ProductivityPage from './admin/pages/ProductivityPage'
import WorkAllocationPage from './admin/pages/WorkAllocationPage'
import EntitlementDashboard from './entitlements/EntitlementDashboard'
import PayrollPage from './entitlements/PayrollPage'
import EntitlementPage from './entitlements/EntitlementPage'
import frappeTheme from './admin/theme'
import { ensureSeeded } from './admin/data/seed'
import { FieldOptionsProvider } from './admin/data/fieldOptions'

// ------------------------------------------------------------------ registered mail (staff sign-in)
function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="grid h-full place-items-center"><Spinner /></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

// ------------------------------------------------------------------ Postal KPI desk
function EmployeeFormRoute({ onSaved }) {
  const { id } = useParams()
  const isNew = id === 'new'
  return <EmployeeForm name={isNew ? null : decodeURIComponent(id)} isNew={isNew} onSaved={onSaved} />
}

function DailyKpiFormRoute({ onSaved }) {
  const { id } = useParams()
  const isNew = id === 'new'
  return <DailyKpiForm name={isNew ? null : decodeURIComponent(id)} isNew={isNew} onSaved={onSaved} />
}

function AttendanceLogFormRoute({ onSaved }) {
  const { id } = useParams()
  const isNew = id === 'new'
  return <AttendanceLogForm name={isNew ? null : decodeURIComponent(id)} isNew={isNew} onSaved={onSaved} />
}

function BootScreen({ children }) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeContent: 'center', gap: 1.5, bgcolor: '#ffffff', px: 2 }}>
      {children}
    </Box>
  )
}

// The desk's own theme, start-up check and dropdown options apply to its pages only.
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
        <Typography variant="h5">Could not load desk</Typography>
        <Alert severity="error">{bootError}</Alert>
      </BootScreen>
    )
  } else if (!ready) {
    body = (
      <BootScreen>
        <CircularProgress size={28} />
        <Typography color="text.secondary">Loading Postal KPI Desk…</Typography>
      </BootScreen>
    )
  } else {
    body = <FieldOptionsProvider><Outlet /></FieldOptionsProvider>
  }
  return (
    <ThemeProvider theme={frappeTheme}>
      <CssBaseline />
      {body}
    </ThemeProvider>
  )
}

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0)
  const bump = useCallback(() => setRefreshKey((k) => k + 1), [])

  return (
    <Routes>
      {/* Registered mail intake and tracking */}
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

      {/* Postal KPI desk */}
      <Route element={<KpiDeskShell />}>
        <Route path="attendance-qr/token" element={<AttendanceQrPage />} />
        <Route element={<DeskLayout />}>
          <Route path="employee" element={<EmployeeList refreshKey={refreshKey} />} />
          <Route path="employee/:id" element={<EmployeeFormRoute onSaved={bump} />} />
          <Route path="daily-kpi-log" element={<DailyKpiList refreshKey={refreshKey} />} />
          <Route path="checklist" element={<ChecklistPage />} />
          <Route path="daily-kpi-log/:id" element={<DailyKpiFormRoute onSaved={bump} />} />
          <Route path="attendance-log" element={<AttendanceLogList refreshKey={refreshKey} />} />
          <Route path="attendance-log/:id" element={<AttendanceLogFormRoute onSaved={bump} />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="productivity" element={<ProductivityPage />} />
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
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
