import { useState, useCallback, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { formatDate, titleCase } from '../../lib/format.js'
import { ROLES } from '../../lib/constants.js'

const ROLE_BASE = {
  [ROLES.ADMIN]: '/admin',
  [ROLES.SUB_ADMIN]: '/sub-admin',
  [ROLES.SALES_EXECUTIVE]: '/executive',
  [ROLES.SUPER_ADMIN]: '/super-admin',
}

// Resolve a notification to the module/record it should open (spec: "clicking any
// notification should directly open the related module or record").
function targetPath(n, role) {
  const base = ROLE_BASE[role] || ''
  const id = n.entityId
  switch (n.entityType) {
    case 'customer':
    case 'lead':
      if (role === ROLES.ADMIN) return id ? `/admin/leads/${id}` : '/admin/leads'
      if (role === ROLES.SUB_ADMIN) return id ? `/sub-admin/customers/${id}` : '/sub-admin/customers'
      if (role === ROLES.SALES_EXECUTIVE) return id ? `/executive/customers/${id}` : '/executive/customers'
      return base
    case 'booking':
      if (role === ROLES.ADMIN) return id ? `/admin/bookings/${id}` : '/admin/bookings'
      if (role === ROLES.SUB_ADMIN) return id ? `/sub-admin/bookings/${id}` : '/sub-admin/bookings'
      return `${base}/bookings`
    case 'visit':
      if (role === ROLES.SUB_ADMIN) return '/sub-admin/visits'
      if (role === ROLES.SALES_EXECUTIVE) return '/executive/visits'
      return base
    case 'followup':
      if (role === ROLES.SUB_ADMIN) return '/sub-admin/followups'
      if (role === ROLES.SALES_EXECUTIVE) return '/executive/followups'
      if (role === ROLES.ADMIN) return '/admin/leads'
      return base
    case 'attendance_correction':
    case 'attendance':
      if (role === ROLES.SALES_EXECUTIVE) return '/executive/attendance'
      if (role === ROLES.SUB_ADMIN) return '/sub-admin/attendance'
      return base
    case 'task':
      if (role === ROLES.SALES_EXECUTIVE) return '/executive/tasks'
      return base
    case 'marketing_task':
    case 'campaign':
      return `${base}/marketing`
    case 'payment':
      return `${base}/payments`
    case 'expense':
      return `${base}/expenses`
    case 'legal_case':
      return `${base}/legal`
    case 'leave':
      if (role === ROLES.SALES_EXECUTIVE) return '/executive/leave'
      if (role === ROLES.SUB_ADMIN) return '/sub-admin/attendance'
      return base
    default:
      return base || '/'
  }
}

const MODULE_LABEL = {
  customer: 'Leads', lead: 'Leads', booking: 'Bookings', visit: 'Site Visits',
  followup: 'Follow-ups', attendance_correction: 'Attendance', attendance: 'Attendance',
  unit: 'Inventory', task: 'Tasks', leave: 'Leave',
  marketing_task: 'Marketing', campaign: 'Marketing', payment: 'Payments', expense: 'Expenses', legal_case: 'Legal',
}

const PRIORITY_META = {
  high: { label: 'High', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  medium: { label: 'Medium', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  low: { label: 'Low', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
}
const FILTERS = [['all', 'All'], ['unread', 'Unread'], ['read', 'Read'], ['high', 'High Priority']]

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('all')
  const [detail, setDetail] = useState(null) // selected notification for details view
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data, meta, refetch } = useFetch(useCallback(() => notificationsApi.list({ limit: 100 }), []))

  // Near-real-time delivery without a websocket layer: poll every 45s and refetch
  // whenever the tab regains focus, so remarks/updates from other roles surface
  // promptly in the bell.
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') refetch() }, 45000)
    const onFocus = () => refetch()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(id); window.removeEventListener('focus', onFocus) }
  }, [refetch])

  const unread = meta?.unreadCount || 0
  const items = data || []

  const filtered = useMemo(() => {
    let out = items
    if (filter === 'unread') out = out.filter((n) => !n.read)
    else if (filter === 'read') out = out.filter((n) => n.read)
    else if (filter === 'high') out = out.filter((n) => n.priority === 'high')
    return out // server already returns latest-first
  }, [items, filter])

  async function markAll() { await notificationsApi.markAllRead(); refetch() }
  async function clearAll() {
    if (!window.confirm('Clear all notifications?')) return
    await notificationsApi.clearAll(); refetch()
  }
  async function markRead(e, n) { e.stopPropagation(); await notificationsApi.markRead(n._id); refetch() }
  async function remove(e, n) { e.stopPropagation(); await notificationsApi.remove(n._id); refetch() }

  function openDetails(n) {
    setDetail(n)
    if (!n.read) { notificationsApi.markRead(n._id).then(refetch).catch(() => {}) }
  }
  function openRecord(n) {
    setOpen(false); setDetail(null)
    if (!n.read) { try { notificationsApi.markRead(n._id) } catch { /* ignore */ } refetch() }
    navigate(targetPath(n, user?.role))
  }
  function closeDrawer() { setOpen(false); setDetail(null); setFilter('all') }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-100"
        title="Notifications"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeDrawer} />

          <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                <p className="text-xs text-slate-500">Stay updated with activities, reminders, approvals, and alerts.</p>
              </div>
              <button onClick={closeDrawer} className="text-slate-400 hover:text-slate-700" aria-label="Close">✕</button>
            </div>

            {detail ? (
              <NotificationDetail
                n={detail}
                onBack={() => setDetail(null)}
                onOpen={() => openRecord(detail)}
              />
            ) : (
              <>
                {/* Filter tabs */}
                <div className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-2">
                  {FILTERS.map(([v, l]) => (
                    <button key={v} onClick={() => setFilter(v)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${filter === v ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                      {l}{v === 'unread' && unread > 0 ? ` (${unread})` : ''}
                    </button>
                  ))}
                  <button onClick={markAll} disabled={!unread} className="ml-auto text-xs text-blue-600 hover:text-blue-700 disabled:text-slate-300">Mark all read</button>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <div className="px-5 py-16 text-center text-sm text-slate-400">No notifications{filter !== 'all' ? ' in this view' : ''}.</div>
                  ) : (
                    filtered.map((n) => {
                      const moduleLabel = MODULE_LABEL[n.entityType] || (n.entityType ? titleCase(n.entityType) : null)
                      const pri = PRIORITY_META[n.priority || 'medium']
                      return (
                        <div
                          key={n._id}
                          onClick={() => openDetails(n)}
                          className={`group flex cursor-pointer items-start gap-2.5 border-b border-slate-100 px-5 py-3.5 transition hover:bg-slate-50 ${n.read ? '' : 'bg-blue-50/40'}`}
                        >
                          <span className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-slate-200' : 'bg-blue-500'}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`truncate text-sm ${n.read ? 'font-medium text-slate-700' : 'font-semibold text-slate-900'}`}>{n.title}</span>
                              <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${pri.cls}`}>{pri.label}</span>
                            </div>
                            {n.message && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.message}</p>}
                            <div className="mt-1 flex items-center gap-2">
                              {moduleLabel && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{moduleLabel}</span>}
                              <span className="text-[11px] text-slate-400">{formatDate(n.createdAt, true)}</span>
                              {!n.read && <button onClick={(e) => markRead(e, n)} className="ml-auto text-[11px] text-blue-600 opacity-0 transition group-hover:opacity-100">Mark read</button>}
                              <button onClick={(e) => remove(e, n)} className={`text-[11px] text-slate-400 opacity-0 transition hover:text-red-600 group-hover:opacity-100 ${n.read ? 'ml-auto' : ''}`}>Clear</button>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// Notification Details view (spec §Notification Details).
function NotificationDetail({ n, onBack, onOpen }) {
  const moduleLabel = MODULE_LABEL[n.entityType] || (n.entityType ? titleCase(n.entityType) : '—')
  const pri = PRIORITY_META[n.priority || 'medium']
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <button onClick={onBack} className="border-b border-slate-100 px-5 py-2 text-left text-xs text-slate-500 hover:text-slate-800">← Back to notifications</button>
      <div className="flex-1 space-y-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-base font-semibold text-slate-900">{n.title}</h4>
          <span className={`shrink-0 rounded border px-2 py-0.5 text-[11px] font-medium ${pri.cls}`}>{pri.label}</span>
        </div>
        <p className="whitespace-pre-line text-sm text-slate-700">{n.message || 'No additional details.'}</p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4">
          {[
            ['Related Module', moduleLabel],
            ['Date & Time', formatDate(n.createdAt, true)],
            ['Status', n.read ? 'Read' : 'Unread'],
            ['Priority', pri.label],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
              <dd className="mt-0.5 text-sm text-slate-800">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {n.entityId && (
        <div className="border-t border-slate-100 p-4">
          <button onClick={onOpen} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700">Open Related Record</button>
        </div>
      )}
    </div>
  )
}
