import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { can, useAuth } from '../auth.jsx'
import Icon from '../components/icons.jsx'
import { OUTBOX_LABEL, STATUS_LABEL, StatusBadge } from '../components/StatusBadge.jsx'
import { Alert, Button, Card, EmptyState, ErrorBox, PageHeader, StatTile, fmtDate, fmtTime } from '../components/ui.jsx'

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

  // Things someone has to act on, most urgent first.
  const attention = [
    summary?.held_events > 0 && { tone: 'red', icon: 'review', to: '/review', text: `${summary.held_events} scan event(s) held for review`, action: 'Review now' },
    failedMessages > 0 && { tone: 'red', icon: 'bell', to: '/notifications', text: `${failedMessages} sender message(s) failed or unclear`, action: 'Open messages' },
    scale && !scale.online && { tone: 'amber', icon: 'scale', to: '/devices', text: `Scale ${scale.device_id} is offline – weights must be entered manually`, action: 'Check scale' },
    scale && scale.online && !scale.calibration?.calibration_id && { tone: 'amber', icon: 'scale', to: '/devices', text: `Scale ${scale.device_id} is not calibrated`, action: 'Calibrate' },
    openDrafts > 0 && { tone: 'amber', icon: 'clock', to: counter ? '/counter' : undefined, text: `${openDrafts} unfinished registration draft(s)`, action: 'Resume or cancel' },
  ].filter(Boolean)
  const loaded = items !== null
  const attentionReady = loaded && (!postmaster || summary) && (!counter || drafts)

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard"
        subtitle={`Registered mail at ${user.office_name || user.office_id} · ${fmtDate()}`}
        actions={counter && <Button icon="plus" onClick={startIntake}>Register a new letter</Button>} />
      <ErrorBox error={error} />
      {user.role === 'postman' && (
        <Alert tone="blue" title="Postmen use the mobile app">
          Scans, offline capture and delivery acknowledgement are done in the PostAssist mobile app.
        </Alert>
      )}

      {(counter || postmaster) && attentionReady && (
        <Card title="Needs your attention" description={attention.length ? 'Work waiting for action at your office.' : undefined} padded={attention.length === 0}>
          {attention.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-emerald-800"><Icon name="check" /> Nothing is waiting for action right now.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {attention.map((a) => (
                <li key={a.text} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <span className={`grid h-8 w-8 place-items-center rounded-md ${a.tone === 'red' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}><Icon name={a.icon} /></span>
                  <span className="flex-1 font-medium text-slate-900">{a.text}</span>
                  {a.to && <Link to={a.to} className="inline-flex items-center gap-1 rounded-md border border-brand-300 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-50">{a.action} <Icon name="chevron" className="h-3.5 w-3.5" /></Link>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <section aria-labelledby="figures">
        <h2 id="figures" className="mb-3 text-sm font-semibold text-slate-700">Registered mail at a glance</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Registered today" value={loaded ? acceptedToday.length : '–'} hint="accepted at the counter" icon="inbox" to="/items" />
          <StatTile label="On the way" value={loaded ? count(MOVING) : '–'} hint="dispatched, in transit or at the destination office" icon="truck" to="/items" />
          <StatTile label="Out for delivery" value={loaded ? count(['out_for_delivery', 'delivery_attempted']) : '–'} hint="with a postman" icon="pin" to="/items" />
          <StatTile label="Delivered" value={loaded ? count(['delivered']) : '–'} hint={summary ? 'all time' : `among the latest ${RECENT_LIMIT} items`} icon="check" to="/items" />
          {openDrafts !== undefined && openDrafts !== null && (
            <StatTile label="Unfinished drafts" value={openDrafts} hint={openDrafts ? 'resume or cancel them' : 'nothing waiting'} accent={openDrafts ? 'amber' : undefined}
              icon="clock" to={counter ? '/counter' : undefined} />
          )}
          {summary && <StatTile label="Held for review" value={summary.held_events} hint={summary.held_events ? 'location or acknowledgement to check' : 'nothing waiting'}
            accent={summary.held_events ? 'red' : undefined} icon="review" to="/review" />}
          {failedMessages !== null && <StatTile label="Failed messages" value={failedMessages} hint={failedMessages ? 'review the outbox' : 'all sender messages went out'}
            accent={failedMessages ? 'red' : undefined} icon="bell" to="/notifications" />}
          {scale && <StatTile label="IoT scale" value={scale.online ? 'Online' : 'Offline'} hint={`${scale.device_id} · ${scale.calibration?.calibration_id ? 'calibrated' : 'not calibrated'}`}
            accent={scale.online ? 'green' : 'amber'} icon="scale" to="/devices" />}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Recent items" description="The latest letters registered or updated" className="lg:col-span-2" padded={false}
          actions={<Link className="link inline-flex items-center gap-1 text-xs" to="/items">View all items <Icon name="chevron" className="h-3.5 w-3.5" /></Link>}>
          <div className="overflow-x-auto">
            <table className="rows-hover w-full text-sm">
              <thead><tr><th>Tracking ID</th><th>Destination town</th><th>Accepted</th><th>Status</th></tr></thead>
              <tbody>
                {rows.slice(0, 6).map((r) => (
                  <tr key={r.tracking_id} className="border-t">
                    <td><Link className="link font-mono" to={`/items/${r.tracking_id}`}>{r.tracking_id}</Link></td>
                    <td>{[r.recipient?.city, r.recipient?.postcode].filter(Boolean).join(' ') || '—'}</td>
                    <td className="whitespace-nowrap text-slate-600">{fmtTime(r.accepted_at)}</td>
                    <td><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {loaded && rows.length === 0 && (
              <EmptyState icon="inbox" title="No registered items yet">Letters appear here once they are accepted at the counter.</EmptyState>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Quick actions">
            <div className="space-y-2">
              {counter && <QuickAction primary icon="plus" onClick={startIntake}>Register a new letter</QuickAction>}
              {can(user, 'hub_officer', 'counter_officer') && <QuickAction icon="scan" to="/scan">Record a handover scan</QuickAction>}
              <QuickAction icon="search" to="/items">Find a registered item</QuickAction>
              {counter && <QuickAction icon="scale" to="/devices">Check the scale &amp; camera</QuickAction>}
              {postmaster && <QuickAction icon="review" to="/review">Review held events</QuickAction>}
            </div>
          </Card>
          <Card title="Letters registered today, by hour" description={`${acceptedToday.length} in total, 08:00–17:59`}>
            <div className="flex h-32 items-end gap-0.5 border-b border-slate-300" role="img" aria-label={`Items accepted per hour today: ${hours.map((h, k) => `${h}:00 ${perHour[k]}`).join(', ')}`}>
              {perHour.map((n, k) => (
                <div key={hours[k]} className="group relative flex h-full flex-1 flex-col items-center justify-end" title={`${hours[k]}:00–${hours[k]}:59 · ${n} letter(s)`}>
                  {n > 0 && <span className="mb-0.5 text-[10px] font-semibold tabular-nums text-slate-700">{n}</span>}
                  <div className={`w-full max-w-6 rounded-t ${n ? 'bg-brand-600 group-hover:bg-brand-800' : 'bg-slate-200'}`}
                    style={{ height: n ? `${Math.max(6, (n / peak) * 82)}%` : '2px' }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-0.5 text-center text-[10px] tabular-nums text-slate-500">
              {hours.map((h) => <span key={h} className="flex-1">{String(h).padStart(2, '0')}</span>)}
            </div>
          </Card>
        </div>
      </div>

      {summary && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card title="Items by status" description="All registered items at your office">
            <BarList rows={Object.entries(summary.items_by_status).map(([k, v]) => [STATUS_LABEL[k] || k, v])} />
          </Card>
          <Card title="Sender messages by outcome" description='"Sent" means the e-mail service accepted it, not that it was read'>
            <BarList rows={Object.entries(summary.outbox_by_status).map(([k, v]) => [OUTBOX_LABEL[k] || k.replaceAll('_', ' '), v])} />
          </Card>
        </div>
      )}
    </div>
  )
}

// Label, bar and count per row; the count is always written, the bar only helps compare.
function BarList({ rows }) {
  const max = Math.max(1, ...rows.map(([, v]) => v))
  if (rows.length === 0) return <p className="text-sm text-slate-500">No data yet.</p>
  return (
    <ul className="space-y-2.5 text-sm">
      {rows.map(([label, v]) => (
        <li key={label} className="grid grid-cols-[9.5rem_1fr_2.5rem] items-center gap-3" title={`${label}: ${v}`}>
          <span className="truncate text-slate-700">{label}</span>
          <span className="h-2 rounded-full bg-slate-100"><span className="block h-2 rounded-full bg-brand-600" style={{ width: `${v ? Math.max(2, (v / max) * 100) : 0}%` }} /></span>
          <b className="text-right tabular-nums text-slate-900">{v}</b>
        </li>
      ))}
    </ul>
  )
}

function QuickAction({ icon, to, onClick, primary, children }) {
  const className = `flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold transition ${primary
    ? 'bg-brand-700 text-white shadow-sm hover:bg-brand-800' : 'border border-line bg-white text-brand-800 hover:border-brand-300 hover:bg-brand-50'}`
  const body = <><Icon name={icon} /><span className="flex-1">{children}</span><Icon name="chevron" className="h-4 w-4 opacity-70" /></>
  return to ? <Link to={to} className={className}>{body}</Link> : <button type="button" onClick={onClick} className={className}>{body}</button>
}
