import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { can, useAuth } from '../auth.jsx'
import Icon from '../components/icons.jsx'
import { STATUS_LABEL, StatusBadge } from '../components/StatusBadge.jsx'
import { Alert, Card, ErrorBox, PageHeader, StatTile, fmtTime } from '../components/ui.jsx'

const RECENT_LIMIT = 200
const MOVING = ['dispatched', 'in_transit', 'at_destination_office']

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState(null)
  const [summary, setSummary] = useState(null)
  const [drafts, setDrafts] = useState(null)
  const [devices, setDevices] = useState(null)
  const [error, setError] = useState(null)
  const counter = can(user, 'counter_officer')
  const postmaster = can(user, 'postmaster')

  useEffect(() => {
    api(`/api/items?limit=${RECENT_LIMIT}`).then(setItems).catch(() => setItems([]))
    if (postmaster) api('/api/reports/summary').then(setSummary).catch(() => {})
    if (counter) {
      api('/api/intake/drafts').then(setDrafts).catch(() => {})
      api('/api/devices').then(setDevices).catch(() => {})
    }
  }, [counter, postmaster])

  async function startIntake() {
    try {
      const d = await api('/api/intake/drafts', { method: 'POST' })
      navigate(`/counter/${d._id}`)
    } catch (e) { setError(e) }
  }

  const rows = items || []
  const today = new Date().toDateString()
  const acceptedToday = rows.filter((r) => r.accepted_at && new Date(r.accepted_at).toDateString() === today)
  const count = (statuses) => (summary ? statuses.reduce((n, s) => n + (summary.items_by_status[s] || 0), 0) : rows.filter((r) => statuses.includes(r.status)).length)
  const failedMessages = summary ? (summary.outbox_by_status.failed_permanent || 0) + (summary.outbox_by_status.ambiguous || 0) : null
  const openDrafts = summary ? summary.open_drafts : drafts?.length
  const scale = devices?.[0]
  // Items accepted today, per hour of the working day
  const hours = Array.from({ length: 10 }, (_, k) => 8 + k)
  const perHour = hours.map((h) => acceptedToday.filter((r) => new Date(r.accepted_at).getHours() === h).length)
  const peak = Math.max(1, ...perHour)

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" subtitle={`Registered mail at ${user.office_name || user.office_id} – intake, movement and items that need attention.`} />
      <ErrorBox error={error} />
      {user.role === 'postman' && (
        <Alert tone="blue" title="Postmen use the mobile app">
          Scans, offline capture and delivery acknowledgement are done in the PostAssist mobile app (mobile_app/).
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile label="Registered today" value={items ? acceptedToday.length : '–'} hint="accepted at the counter" icon="inbox" to="/items" />
        {openDrafts !== undefined && openDrafts !== null && (
          <StatTile label="Unfinished drafts" value={openDrafts} hint={openDrafts ? 'resume or cancel them' : 'nothing waiting'} accent={openDrafts ? 'amber' : undefined}
            icon="clock" to={counter ? '/counter' : undefined} />
        )}
        <StatTile label="On the way" value={items ? count(MOVING) : '–'} hint="dispatched, in transit or at the destination office" icon="truck" to="/items" />
        <StatTile label="Out for delivery" value={items ? count(['out_for_delivery', 'delivery_attempted']) : '–'} hint="with a postman" icon="pin" to="/items" />
        <StatTile label="Delivered" value={items ? count(['delivered']) : '–'} hint={summary ? 'all time' : `among the latest ${RECENT_LIMIT} items`} icon="check" to="/items" />
        {summary && <StatTile label="Held for review" value={summary.held_events} hint={summary.held_events ? 'location or acknowledgement to check' : 'nothing waiting'}
          accent={summary.held_events ? 'red' : undefined} icon="review" to="/review" />}
        {failedMessages !== null && <StatTile label="Failed messages" value={failedMessages} hint={failedMessages ? 'review the outbox' : 'all sender messages went out'}
          accent={failedMessages ? 'red' : undefined} icon="bell" to="/notifications" />}
        {scale && <StatTile label="IoT scale" value={scale.online ? 'Online' : 'Offline'} hint={`${scale.device_id} · ${scale.calibration?.calibration_id ? 'calibrated' : 'not calibrated'}`}
          accent={scale.online ? 'green' : 'amber'} icon="scale" to="/devices" />}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Recent activity" className="lg:col-span-2" actions={<Link className="link text-xs" to="/items">View all →</Link>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><th>Tracking ID</th><th>To (town)</th><th>Accepted</th><th>Status</th></tr></thead>
              <tbody>
                {rows.slice(0, 6).map((r) => (
                  <tr key={r.tracking_id} className="border-t">
                    <td><Link className="link font-mono" to={`/items/${r.tracking_id}`}>{r.tracking_id}</Link></td>
                    <td>{r.recipient?.city} {r.recipient?.postcode}</td>
                    <td className="whitespace-nowrap text-slate-600">{fmtTime(r.accepted_at)}</td>
                    <td><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items && rows.length === 0 && <p className="py-4 text-sm text-slate-500">No registered items yet.</p>}
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Quick actions">
            <div className="space-y-2">
              {counter && <QuickAction primary icon="plus" onClick={startIntake}>Start new registration</QuickAction>}
              {can(user, 'hub_officer', 'counter_officer') && <QuickAction icon="scan" to="/scan">Record a handover scan</QuickAction>}
              <QuickAction icon="search" to="/items">Search items</QuickAction>
              {counter && <QuickAction icon="scale" to="/devices">IoT scale &amp; camera</QuickAction>}
              {postmaster && <QuickAction icon="review" to="/review">Review held events</QuickAction>}
            </div>
          </Card>
          <Card title="Intake today, by hour">
            <div className="flex h-28 items-end gap-1.5" role="img" aria-label={`Items accepted per hour today: ${perHour.join(', ')}`}>
              {perHour.map((n, k) => (
                <div key={hours[k]} className="flex-1 rounded-t bg-brand-300" title={`${hours[k]}:00 – ${n} item(s)`}
                  style={{ height: `${Math.max(4, (n / peak) * 100)}%`, opacity: n ? 1 : 0.35 }} />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-slate-500"><span>08:00</span><span>17:00</span></div>
          </Card>
        </div>
      </div>

      {summary && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card title="Items by status">
            <ul className="space-y-1 text-sm">{Object.entries(summary.items_by_status).map(([k, v]) => <li key={k} className="flex justify-between"><span>{STATUS_LABEL[k] || k}</span><b className="tabular-nums">{v}</b></li>)}</ul>
          </Card>
          <Card title="Sender messages">
            <ul className="space-y-1 text-sm">{Object.entries(summary.outbox_by_status).map(([k, v]) => <li key={k} className="flex justify-between"><span>{k.replaceAll('_', ' ')}</span><b className="tabular-nums">{v}</b></li>)}</ul>
          </Card>
        </div>
      )}
    </div>
  )
}

function QuickAction({ icon, to, onClick, primary, children }) {
  const className = `flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold transition ${primary
    ? 'bg-brand-700 text-white shadow-sm hover:bg-brand-800' : 'border border-line bg-brand-50/60 text-brand-800 hover:border-brand-300 hover:bg-brand-50'}`
  const body = <><Icon name={icon} /><span className="flex-1">{children}</span><Icon name="arrow" className="h-3.5 w-3.5 opacity-70" /></>
  return to ? <Link to={to} className={className}>{body}</Link> : <button type="button" onClick={onClick} className={className}>{body}</button>
}
