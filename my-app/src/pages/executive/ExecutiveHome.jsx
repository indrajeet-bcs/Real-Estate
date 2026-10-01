import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { attendanceApi, followupsApi, visitsApi, bookingsApi, customersApi, tasksApi, notificationsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { formatDate, titleCase } from '../../lib/format.js'
import { Card, Button, Input, Textarea, Select, StatusBadge, Modal, Loader } from '../../components/ui.jsx'

const inr = (n) => {
  const v = Number(n) || 0
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`
  return `₹${v.toLocaleString('en-IN')}`
}
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const isToday = (v) => v && new Date(v).toDateString() === new Date().toDateString()
const thisMonth = (v) => { const d = new Date(v); const n = new Date(); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() }
const timeOf = (v) => v ? new Date(v).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'

function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined)
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(undefined), { timeout: 5000 }
    )
  })
}

export default function ExecutiveHome() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const first = (user?.name || 'there').split(' ')[0]
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  const customers = useFetch(useCallback(() => customersApi.list({ limit: 200 }), []))
  const followups = useFetch(useCallback(() => followupsApi.list({ limit: 200 }), []))
  const visits = useFetch(useCallback(() => visitsApi.list({ limit: 200 }), []))
  const bookings = useFetch(useCallback(() => bookingsApi.list({ limit: 200 }), []))
  const tasks = useFetch(useCallback(() => tasksApi.list({ official: false }), []))
  const attendance = useFetch(useCallback(() => attendanceApi.me({ limit: 5 }), []))
  const notifs = useFetch(useCallback(() => notificationsApi.list({ limit: 6 }), []))

  const cList = customers.data || []
  const fList = followups.data || []
  const vList = visits.data || []
  const bList = bookings.data || []

  const kpis = [
    { label: 'My Leads', value: cList.length, icon: '☰', to: '/executive/leads' },
    { label: "Today's Follow-ups", value: fList.filter((f) => f.status === 'scheduled' && isToday(f.scheduledAt)).length, icon: '↻', to: '/executive/followups' },
    { label: "Today's Site Visits", value: vList.filter((v) => isToday(v.scheduledAt)).length, icon: '⌖', to: '/executive/visits' },
    { label: 'This Month Bookings', value: bList.filter((b) => thisMonth(b.createdAt)).length, icon: '✓', to: '/executive/bookings' },
  ]

  const achieved = bList.filter((b) => b.status === 'confirmed' || b.status === 'sale_completed').reduce((s, b) => s + (b.totalValue || 0), 0)
  const target = user?.targetRevenue || 0
  const remaining = Math.max(0, target - achieved)
  const pct = target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 0

  const todaysFollowups = fList.filter((f) => f.status === 'scheduled' && isToday(f.scheduledAt))
  const todaysVisits = vList.filter((v) => isToday(v.scheduledAt) && v.status !== 'cancelled')
  const recentLeads = [...cList].sort((a, b) => new Date(b.assignedAt || b.createdAt) - new Date(a.assignedAt || a.createdAt)).slice(0, 6)

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Section 1 — Welcome header */}
      <div>
        <p className="text-sm text-slate-500">Welcome back · {today}</p>
        <h1 className="text-2xl font-bold text-slate-900">Hi, {first} 👋</h1>
        <p className="text-sm text-slate-500">Track today's work, manage daily activities, and monitor your sales performance.</p>
      </div>

      {/* Section 2 — Quick KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="cursor-pointer p-4 transition hover:border-blue-400 hover:shadow-md" onClick={() => navigate(k.to)}>
            <div className="flex items-center justify-between"><span className="text-xs uppercase tracking-wide text-slate-500">{k.label}</span><span className="text-lg text-slate-300">{k.icon}</span></div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{k.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Section 3 — Work planner */}
        <WorkPlanner q={tasks} />

        {/* Section 7 + 8 — Target + Attendance */}
        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Target Progress <span className="text-xs font-normal text-slate-400">(this month)</span></h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><div className="text-lg font-semibold text-slate-900">{inr(target)}</div><div className="text-xs text-slate-500">Target</div></div>
              <div><div className="text-lg font-semibold text-emerald-600">{inr(achieved)}</div><div className="text-xs text-slate-500">Achieved</div></div>
              <div><div className="text-lg font-semibold text-amber-600">{inr(remaining)}</div><div className="text-xs text-slate-500">Remaining</div></div>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${pct}%` }} /></div>
            <div className="mt-1 text-right text-xs text-slate-400">{target > 0 ? `${pct}% achieved` : 'No target set'}</div>
          </Card>

          <AttendanceCard q={attendance} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Section 4 — Today's follow-ups */}
        <Card className="p-5">
          <SectionHead title="Today's Follow-ups" onView={() => navigate('/executive/followups')} />
          {todaysFollowups.length === 0 ? <Empty text="No follow-ups scheduled for today." /> : (
            <div className="space-y-2">{todaysFollowups.map((f) => <FollowUpCard key={f._id} f={f} onDone={followups.refetch} />)}</div>
          )}
        </Card>

        {/* Section 5 — Today's site visits */}
        <Card className="p-5">
          <SectionHead title="Today's Site Visits" onView={() => navigate('/executive/visits')} />
          {todaysVisits.length === 0 ? <Empty text="No site visits scheduled for today." /> : (
            <div className="space-y-2">{todaysVisits.map((v) => <VisitCard key={v._id} v={v} onDone={visits.refetch} />)}</div>
          )}
        </Card>
      </div>

      {/* Section 6 — Recent leads */}
      <Card className="p-5">
        <SectionHead title="Recent Leads" onView={() => navigate('/executive/customers')} />
        {customers.loading ? <Loader /> : recentLeads.length === 0 ? <Empty text="No leads assigned yet." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500"><tr>
                <th className="py-2 pr-3 font-medium">Lead</th><th className="py-2 pr-3 font-medium">Contact</th><th className="py-2 pr-3 font-medium">Source</th><th className="py-2 pr-3 font-medium">Stage</th><th className="py-2 pr-3 font-medium">Assigned</th><th className="py-2 font-medium"></th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {recentLeads.map((l) => (
                  <tr key={l._id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/executive/customers/${l._id}`)}>
                    <td className="py-2 pr-3 font-medium text-slate-800">{l.name}</td>
                    <td className="py-2 pr-3 text-slate-600">{l.mobile}</td>
                    <td className="py-2 pr-3 text-slate-600">{titleCase(l.source)}</td>
                    <td className="py-2 pr-3"><StatusBadge status={l.status} /></td>
                    <td className="py-2 pr-3 text-slate-500">{formatDate(l.assignedAt || l.createdAt)}</td>
                    <td className="py-2 text-right"><Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); navigate(`/executive/customers/${l._id}`) }}>Open</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Section 9 — Recent notifications */}
      <Card className="p-5">
        <SectionHead title="Recent Notifications" />
        {(notifs.data || []).length === 0 ? <Empty text="No notifications yet." /> : (
          <ul className="divide-y divide-slate-100">
            {(notifs.data || []).map((n) => (
              <li key={n._id} className="flex items-start gap-2.5 py-2.5">
                <span className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-slate-200' : 'bg-blue-500'}`} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{n.title}</p>{n.message && <p className="truncate text-xs text-slate-500">{n.message}</p>}<p className="text-[11px] text-slate-400">{formatDate(n.createdAt, true)}</p></div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function SectionHead({ title, onView }) {
  return <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900">{title}</h3>{onView && <button onClick={onView} className="text-xs font-medium text-blue-600 hover:underline">View all</button>}</div>
}
function Empty({ text }) { return <p className="py-6 text-center text-sm text-slate-400">{text}</p> }

const PRIORITY_CLS = { high: 'text-red-600', medium: 'text-amber-600', low: 'text-slate-500' }

// Section 3 — Today's Work Planner
function WorkPlanner({ q }) {
  const toast = useToast()
  const [editing, setEditing] = useState(null) // task obj or {} for new
  const tasks = q.data || []
  const now = new Date()
  const isOverdue = (t) => t.status === 'pending' && t.dueDate && new Date(t.dueDate) < now
  const pending = tasks.filter((t) => t.status === 'pending').length
  const completed = tasks.filter((t) => t.status === 'completed').length

  async function toggle(t) {
    try { await tasksApi.setStatus(t._id, t.status === 'completed' ? 'pending' : 'completed'); q.refetch() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }
  async function remove(t) {
    if (!window.confirm('Delete this task?')) return
    try { await tasksApi.remove(t._id); toast.success('Task deleted'); q.refetch() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Today's Work Planner</h3>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">{pending} pending</span>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">{completed} done</span>
          <Button size="sm" onClick={() => setEditing({})}>+ Task</Button>
        </div>
      </div>
      {q.loading ? <Loader /> : tasks.length === 0 ? <Empty text="No tasks yet — add your first task." /> : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t._id} className={`flex items-start gap-3 rounded-lg border p-3 ${t.status === 'completed' ? 'border-slate-100 bg-slate-50' : 'border-slate-200'}`}>
              <input type="checkbox" checked={t.status === 'completed'} onChange={() => toggle(t)} className="mt-1" />
              <div className="min-w-0 flex-1">
                <div className={`text-sm font-medium ${t.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{t.title}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                  {t.dueDate && <span className="text-slate-500">{formatDate(t.dueDate)}{t.dueTime ? ` · ${t.dueTime}` : ''}</span>}
                  <span className={PRIORITY_CLS[t.priority] || 'text-slate-500'}>● {titleCase(t.priority)}</span>
                  {t.relatedType && t.relatedType !== 'none' && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">{titleCase(t.relatedType)}</span>}
                  {isOverdue(t) && <span className="rounded bg-red-50 px-1.5 py-0.5 font-medium text-red-600">Overdue</span>}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => setEditing(t)} className="text-xs text-slate-500 hover:text-blue-600">Edit</button>
                {t.status !== 'completed' && <button onClick={() => remove(t)} className="text-xs text-slate-400 hover:text-red-600">Delete</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && <TaskModal task={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); q.refetch() }} />}
    </Card>
  )
}

function TaskModal({ task, onClose, onDone }) {
  const toast = useToast()
  const isNew = !task._id
  const [form, setForm] = useState({
    title: task.title || '', description: task.description || '',
    dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : '', dueTime: task.dueTime || '',
    priority: task.priority || 'medium', relatedType: task.relatedType || 'none',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  async function save() {
    setBusy(true)
    try {
      const body = { ...form, dueDate: form.dueDate || undefined }
      if (isNew) await tasksApi.create(body); else await tasksApi.update(task._id, body)
      toast.success(isNew ? 'Task added' : 'Task updated'); onDone()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={isNew ? 'Add Task' : 'Edit Task'} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy || form.title.trim().length < 1}>{isNew ? 'Add' : 'Save'}</Button></>}>
      <div className="space-y-4">
        <Input label="Task Title" value={form.title} onChange={set('title')} />
        <Textarea label="Description (optional)" value={form.description} onChange={set('description')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Due Date" type="date" value={form.dueDate} onChange={set('dueDate')} />
          <Input label="Due Time" type="time" value={form.dueTime} onChange={set('dueTime')} />
          <Select label="Priority" value={form.priority} onChange={set('priority')}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></Select>
          <Select label="Related To (optional)" value={form.relatedType} onChange={set('relatedType')}><option value="none">None</option><option value="lead">Lead</option><option value="customer">Customer</option><option value="booking">Booking</option></Select>
        </div>
      </div>
    </Modal>
  )
}

// Section 4 — Follow-up card
function FollowUpCard({ f, onDone }) {
  const toast = useToast()
  const act = async (fn, msg) => { try { await fn(); toast.success(msg); onDone() } catch (err) { toast.error(err.response?.data?.message || 'Failed') } }
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><div className="truncate text-sm font-medium text-slate-800">{f.customer?.name || 'Lead'}</div><div className="text-xs text-slate-500">{f.customer?.mobile || '—'} · {timeOf(f.scheduledAt)}</div></div>
        {f.customer?.status && <StatusBadge status={f.customer.status} />}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {f.customer?.mobile && <a href={`tel:${f.customer.mobile}`} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">Call</a>}
        <Button size="sm" variant="success" onClick={() => act(() => followupsApi.complete(f._id, { outcome: 'Done' }), 'Completed')}>Mark Completed</Button>
        <Button size="sm" variant="secondary" onClick={() => { const t = window.prompt('New date & time (YYYY-MM-DDTHH:mm):'); if (t) act(() => followupsApi.reschedule(f._id, { scheduledAt: t, reason: 'Rescheduled' }), 'Rescheduled') }}>Reschedule</Button>
      </div>
    </div>
  )
}

// Section 5 — Site visit card
function VisitCard({ v, onDone }) {
  const toast = useToast()
  const act = async (fn, msg) => { try { await fn(); toast.success(msg); onDone() } catch (err) { toast.error(err.response?.data?.message || 'Failed') } }
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><div className="truncate text-sm font-medium text-slate-800">{v.customer?.name || '—'}</div><div className="text-xs text-slate-500">{v.project?.name || '—'} · {timeOf(v.scheduledAt)}</div></div>
        <StatusBadge status={v.status} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button size="sm" variant="secondary" onClick={() => act(() => visitsApi.setStatus(v._id, 'in_progress'), 'Checked in')}>Check-In</Button>
        <Button size="sm" variant="success" onClick={() => act(() => visitsApi.conduct(v._id, { outcome: 'interested' }), 'Completed')}>Mark Completed</Button>
      </div>
    </div>
  )
}

// Section 8 — Attendance
function AttendanceCard({ q }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const today = (q.data || []).find((a) => a.date === todayKey())
  const checkedIn = !!today?.checkInAt
  const checkedOut = !!today?.checkOutAt

  async function mark(kind) {
    setBusy(true)
    try {
      const loc = await getLocation()
      if (kind === 'in') await attendanceApi.checkIn(loc); else await attendanceApi.checkOut(loc)
      toast.success(kind === 'in' ? 'Checked in' : 'Checked out'); q.refetch()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed') } finally { setBusy(false) }
  }

  const hrs = today?.workedMinutes ? `${Math.floor(today.workedMinutes / 60)}h ${today.workedMinutes % 60}m` : '—'
  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Attendance <span className="text-xs font-normal text-slate-400">(today)</span></h3>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div><div className="text-sm font-semibold text-slate-900">{timeOf(today?.checkInAt)}</div><div className="text-xs text-slate-500">Check-In</div></div>
        <div><div className="text-sm font-semibold text-slate-900">{timeOf(today?.checkOutAt)}</div><div className="text-xs text-slate-500">Check-Out</div></div>
        <div><div className="text-sm font-semibold text-slate-900">{hrs}</div><div className="text-xs text-slate-500">Working Hours</div></div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="success" disabled={busy || checkedIn} onClick={() => mark('in')}>📍 Check In</Button>
        <Button size="sm" variant="secondary" disabled={busy || !checkedIn || checkedOut} onClick={() => mark('out')}>Check Out</Button>
      </div>
    </Card>
  )
}
