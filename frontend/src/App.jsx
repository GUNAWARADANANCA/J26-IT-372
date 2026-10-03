import { Navigate, Route, Routes } from 'react-router-dom'
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

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="grid h-full place-items-center"><Spinner /></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
