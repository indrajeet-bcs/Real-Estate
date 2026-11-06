import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  attendanceApi,
  followupsApi,
  visitsApi,
  bookingsApi,
  customersApi,
  tasksApi,
  notificationsApi,
} from '../../api/resources.js'
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

const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const isToday = (v) => v && new Date(v).toDateString() === new Date().toDateString()

const thisMonth = (v) => {
  const d = new Date(v)
  const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth()
}

const timeOf = (v) =>
  v ? new Date(v).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'

function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined)
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(undefined),
      { timeout: 5000 }
    )
  })
}

export default function ExecutiveHome() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const first = (user?.name || 'there').split(' ')[0]
  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Data queries
  const customers = useFetch(useCallback(() => customersApi.list({ limit: 200 }), []))
  const followups = useFetch(useCallback(() => followupsApi.list({ limit: 200 }), []))
  const visits = useFetch(useCallback(() => visitsApi.list({ limit: 200 }), []))
  const bookings = useFetch(useCallback(() => bookingsApi.list({ limit: 200 }), []))
  const tasks = useFetch(useCallback(() => tasksApi.list({ official: false }), []))
  const attendance = useFetch(useCallback(() => attendanceApi.me({ limit: 5 }), []))
  const notifs = useFetch(useCallback(() => notificationsApi.list({ limit: 8 }), []))

  // State for modals
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [rescheduleItem, setRescheduleItem] = useState(null)

  const cList = customers.data || []
  const fList = followups.data || []
  const vList = visits.data || []
  const bList = bookings.data || []

  // Metrics
  const todaysFollowups = fList.filter((f) => f.status === 'scheduled' && isToday(f.scheduledAt))
  const todaysVisits = vList.filter((v) => isToday(v.scheduledAt) && v.status !== 'cancelled')
  const thisMonthBookings = bList.filter((b) => thisMonth(b.createdAt))
  const recentLeads = [...cList]
    .sort((a, b) => new Date(b.assignedAt || b.createdAt) - new Date(a.assignedAt || a.createdAt))
    .slice(0, 6)

  const achieved = bList
    .filter((b) => b.status === 'confirmed' || b.status === 'sale_completed')
    .reduce((s, b) => s + (b.totalValue || 0), 0)
  const target = user?.targetRevenue || 0
  const remaining = Math.max(0, target - achieved)
  const pct = target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 0

  // Attendance check state
  const todayAttendance = (attendance.data || []).find((a) => a.date === todayKey())
  const isCheckedIn = Boolean(todayAttendance?.checkInAt)
  const isCheckedOut = Boolean(todayAttendance?.checkOutAt)

  const kpis = [
    {
      label: 'My Leads',
      value: cList.length,
      hint: 'Active in pipeline',
      icon: 'person_search',
      color: 'bg-blue-50 text-blue-600 border-blue-100',
      to: '/executive/leads',
    },
    {
      label: "Today's Follow-ups",
      value: todaysFollowups.length,
      hint: 'Calls & tasks due today',
      icon: 'phone_callback',
      color: 'bg-amber-50 text-amber-600 border-amber-100',
      to: '/executive/followups',
    },
    {
      label: "Today's Site Visits",
      value: todaysVisits.length,
      hint: 'Scheduled client visits',
      icon: 'calendar_month',
      color: 'bg-purple-50 text-purple-600 border-purple-100',
      to: '/executive/visits',
    },
    {
      label: 'This Month Bookings',
      value: thisMonthBookings.length,
      hint: `${inr(achieved)} generated`,
      icon: 'check_circle',
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      to: '/executive/bookings',
    },
  ]

  return (
    <div className="space-y-6 pb-8">
      {/* ─── 1. Welcome & Header Banner ─── */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                <span className="material-symbols-outlined text-[14px] text-slate-500">today</span>
                {todayFormatted}
              </span>
              {isCheckedIn && !isCheckedOut ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Checked In at {timeOf(todayAttendance?.checkInAt)}
                </span>
              ) : isCheckedOut ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  Shift Completed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Not Checked In
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Hi, {first} 👋
            </h1>
            <p className="text-sm text-slate-500">
              Track today's work, manage client follow-ups, and monitor your monthly targets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate('/executive/followups')}
              className="flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px] text-slate-600">add_call</span>
              <span>View Follow-ups</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setTaskModalOpen(true)}
              className="flex items-center gap-1.5 shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">add_task</span>
              <span>New Task</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ─── 2. Quick KPI Metrics Grid ─── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card
            key={k.label}
            className="group cursor-pointer p-5 transition-all duration-150 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
            onClick={() => navigate(k.to)}
          >
            <div className="flex items-start justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {k.label}
              </span>
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${k.color} transition-transform group-hover:scale-105`}
              >
                <span className="material-symbols-outlined text-[20px]">{k.icon}</span>
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{k.value}</div>
            <div className="mt-1 text-xs text-slate-400">{k.hint}</div>
          </Card>
        ))}
      </div>

      {/* ─── 3. Main 12-Column Responsive Dashboard Layout ─── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* ─── LEFT COLUMN (8-col xl, 7-col lg): Operations & Schedules ─── */}
        <div className="space-y-6 lg:col-span-7 xl:col-span-8">
          {/* Dual Queues: Today's Follow-ups & Site Visits (Clean Equal Heights) */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Card: Today's Follow-ups */}
            <Card className="flex flex-col h-[390px] p-5">
              <SectionHead
                title="Today's Follow-ups"
                badge={todaysFollowups.length}
                badgeColor="bg-amber-100 text-amber-800"
                onView={() => navigate('/executive/followups')}
              />
              <div className="flex-1 overflow-y-auto space-y-2.5 thin-scroll pr-1">
                {todaysFollowups.length === 0 ? (
                  <Empty
                    icon="check_circle"
                    text="All follow-ups clear for today."
                    subtext="Schedule follow-ups from your leads to keep deals moving."
                  />
                ) : (
                  todaysFollowups.map((f) => (
                    <FollowUpCard
                      key={f._id}
                      f={f}
                      onDone={followups.refetch}
                      onReschedule={() => setRescheduleItem(f)}
                    />
                  ))
                )}
              </div>
            </Card>

            {/* Card: Today's Site Visits */}
            <Card className="flex flex-col h-[390px] p-5">
              <SectionHead
                title="Today's Site Visits"
                badge={todaysVisits.length}
                badgeColor="bg-purple-100 text-purple-800"
                onView={() => navigate('/executive/visits')}
              />
              <div className="flex-1 overflow-y-auto space-y-2.5 thin-scroll pr-1">
                {todaysVisits.length === 0 ? (
                  <Empty
                    icon="calendar_month"
                    text="No site visits scheduled for today."
                    subtext="Plan customer site visits to showcase properties."
                  />
                ) : (
                  todaysVisits.map((v) => (
                    <VisitCard key={v._id} v={v} onDone={visits.refetch} />
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* Section: Today's Work Planner */}
          <WorkPlanner
            q={tasks}
            openNewModal={() => setTaskModalOpen(true)}
            isModalOpen={taskModalOpen}
            onCloseModal={() => setTaskModalOpen(false)}
          />

          {/* Section: Recent Assigned Leads */}
          <Card className="p-5">
            <SectionHead
              title="Recent Assigned Leads"
              badge={cList.length}
              badgeColor="bg-blue-100 text-blue-800"
              onView={() => navigate('/executive/leads')}
            />
            {customers.loading ? (
              <div className="py-8"><Loader /></div>
            ) : recentLeads.length === 0 ? (
              <Empty
                icon="person_search"
                text="No leads assigned yet."
                subtext="Your branch manager or sub-admin will distribute new leads to you."
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Lead Name</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Stage</th>
                      <th className="px-4 py-3">Assigned Date</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentLeads.map((l) => (
                      <tr
                        key={l._id}
                        className="cursor-pointer transition-colors hover:bg-blue-50/40"
                        onClick={() => navigate(`/executive/leads/${l._id}`)}
                      >
                        <td className="px-4 py-3 font-medium text-slate-800">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                              {l.name ? l.name.charAt(0).toUpperCase() : 'L'}
                            </span>
                            <span className="truncate max-w-[150px] font-semibold text-slate-900">
                              {l.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {l.mobile ? (
                            <a
                              href={`tel:${String(l.mobile).replace(/[^\d+]/g, '')}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 font-medium text-slate-700 hover:text-emerald-700 hover:underline"
                              title={`Call ${l.name}`}
                            >
                              <span className="material-symbols-outlined text-[15px] text-emerald-600">
                                call
                              </span>
                              <span>{l.mobile}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {titleCase(l.source || 'Direct')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={l.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                          {formatDate(l.assignedAt || l.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/executive/leads/${l._id}`)
                            }}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            Open Lead
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* ─── RIGHT COLUMN (4-col xl, 5-col lg): Personal Progress & Status ─── */}
        <div className="space-y-6 lg:col-span-5 xl:col-span-4">
          {/* Card: Attendance & Shift Tracking */}
          <AttendanceCard q={attendance} />

          {/* Card: Monthly Target & Sales Progress */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Monthly Target</h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                This Month
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 py-3 px-2 rounded-xl bg-slate-50 border border-slate-100 text-center">
              <div>
                <div className="text-base font-bold text-slate-900">{inr(target)}</div>
                <div className="mt-0.5 text-[11px] font-medium text-slate-500 uppercase tracking-wide">Target</div>
              </div>
              <div>
                <div className="text-base font-bold text-emerald-600">{inr(achieved)}</div>
                <div className="mt-0.5 text-[11px] font-medium text-slate-500 uppercase tracking-wide">Achieved</div>
              </div>
              <div>
                <div className="text-base font-bold text-amber-600">{inr(remaining)}</div>
                <div className="mt-0.5 text-[11px] font-medium text-slate-500 uppercase tracking-wide">Remaining</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-medium text-slate-600 mb-1.5">
                <span>Progress</span>
                <span className={pct >= 100 ? 'text-emerald-600 font-bold' : 'text-blue-600 font-bold'}>
                  {target > 0 ? `${pct}% Achieved` : 'No Target Set'}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    pct >= 100 ? 'bg-emerald-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500 text-right">
                {target > 0
                  ? pct >= 100
                    ? '🎉 Monthly target accomplished!'
                    : `${inr(remaining)} needed to reach target`
                  : 'Contact your branch admin to set a monthly target.'}
              </p>
            </div>
          </Card>

          {/* Card: Recent Notifications */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-slate-600">notifications</span>
                <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
              </div>
              {(notifs.data || []).filter((n) => !n.read).length > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                  {(notifs.data || []).filter((n) => !n.read).length} new
                </span>
              )}
            </div>

            {(notifs.data || []).length === 0 ? (
              <Empty
                icon="notifications_off"
                text="No notifications yet."
                subtext="You will be notified when leads or tasks are assigned."
              />
            ) : (
              <ul className="divide-y divide-slate-100 max-h-[310px] overflow-y-auto thin-scroll pr-1">
                {(notifs.data || []).map((n) => (
                  <li key={n._id} className="flex items-start gap-3 py-3 first:pt-1 last:pb-1">
                    <span
                      className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${
                        n.read ? 'bg-slate-300' : 'bg-blue-600'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 leading-snug truncate">
                        {n.title}
                      </p>
                      {n.message && (
                        <p className="mt-0.5 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] font-medium text-slate-400">
                        {formatDate(n.createdAt, true)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* ─── Reschedule Modal (Clean UI instead of window.prompt) ─── */}
      {rescheduleItem && (
        <RescheduleModal
          item={rescheduleItem}
          onClose={() => setRescheduleItem(null)}
          onDone={() => {
            setRescheduleItem(null)
            followups.refetch()
          }}
        />
      )}
    </div>
  )
}

function SectionHead({ title, badge, badgeColor = 'bg-blue-100 text-blue-800', onView }) {
  return (
    <div className="mb-3.5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {badge !== undefined && (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeColor}`}>
            {badge}
          </span>
        )}
      </div>
      {onView && (
        <button
          onClick={onView}
          className="text-xs font-medium text-blue-600 transition-colors hover:text-blue-800 hover:underline"
        >
          View all
        </button>
      )}
    </div>
  )
}

function Empty({ icon = 'info', text, subtext }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <span className="material-symbols-outlined text-[32px] text-slate-300 mb-1.5">{icon}</span>
      <p className="text-sm font-medium text-slate-600">{text}</p>
      {subtext && <p className="mt-1 max-w-xs text-xs text-slate-400">{subtext}</p>}
    </div>
  )
}

const PRIORITY_CLS = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
}

// ─── Section 3 — Today's Work Planner ───
function WorkPlanner({ q, openNewModal, isModalOpen, onCloseModal }) {
  const toast = useToast()
  const [editing, setEditing] = useState(null)
  const [filter, setFilter] = useState('all') // 'all' | 'pending' | 'completed'

  const tasks = q.data || []
  const now = new Date()
  const isOverdue = (t) => t.status === 'pending' && t.dueDate && new Date(t.dueDate) < now
  const pending = tasks.filter((t) => t.status === 'pending').length
  const completed = tasks.filter((t) => t.status === 'completed').length

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'pending') return t.status === 'pending'
    if (filter === 'completed') return t.status === 'completed'
    return true
  })

  async function toggle(t) {
    try {
      await tasksApi.setStatus(t._id, t.status === 'completed' ? 'pending' : 'completed')
      q.refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update task')
    }
  }

  async function remove(t) {
    if (!window.confirm('Delete this task?')) return
    try {
      await tasksApi.remove(t._id)
      toast.success('Task deleted')
      q.refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete task')
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Today's Work Planner</h3>
          <p className="text-xs text-slate-400 mt-0.5">Prioritized tasks and daily to-do checklist</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Pills */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                filter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All ({tasks.length})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                filter === 'pending' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Pending ({pending})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                filter === 'completed' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Done ({completed})
            </button>
          </div>

          <Button size="sm" onClick={openNewModal} className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>Task</span>
          </Button>
        </div>
      </div>

      {q.loading ? (
        <div className="py-8"><Loader /></div>
      ) : filteredTasks.length === 0 ? (
        <Empty
          icon="task_alt"
          text={filter === 'all' ? 'No tasks planned yet.' : `No ${filter} tasks.`}
          subtext="Add daily action items to stay on top of calls and clients."
        />
      ) : (
        <ul className="space-y-2 max-h-[340px] overflow-y-auto thin-scroll pr-1">
          {filteredTasks.map((t) => (
            <li
              key={t._id}
              className={`flex items-start gap-3 rounded-xl border p-3 transition ${
                t.status === 'completed'
                  ? 'border-slate-100 bg-slate-50/70'
                  : 'border-slate-200 bg-white hover:border-blue-200'
              }`}
            >
              <input
                type="checkbox"
                checked={t.status === 'completed'}
                onChange={() => toggle(t)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="min-w-0 flex-1">
                <div
                  className={`text-sm font-medium ${
                    t.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800'
                  }`}
                >
                  {t.title}
                </div>
                {t.description && (
                  <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{t.description}</p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  {t.dueDate && (
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <span className="material-symbols-outlined text-[13px]">schedule</span>
                      {formatDate(t.dueDate)}
                      {t.dueTime ? ` · ${t.dueTime}` : ''}
                    </span>
                  )}
                  {t.priority && (
                    <span
                      className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        PRIORITY_CLS[t.priority] || PRIORITY_CLS.low
                      }`}
                    >
                      {titleCase(t.priority)}
                    </span>
                  )}
                  {t.relatedType && t.relatedType !== 'none' && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                      {titleCase(t.relatedType)}
                    </span>
                  )}
                  {isOverdue(t) && (
                    <span className="rounded bg-red-50 border border-red-200 px-1.5 py-0.5 text-[11px] font-semibold text-red-600">
                      Overdue
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => setEditing(t)}
                  className="p-1 text-slate-400 hover:text-blue-600 transition"
                  title="Edit task"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
                {t.status !== 'completed' && (
                  <button
                    onClick={() => remove(t)}
                    className="p-1 text-slate-400 hover:text-red-600 transition"
                    title="Delete task"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {(isModalOpen || editing) && (
        <TaskModal
          task={editing || {}}
          onClose={() => {
            setEditing(null)
            onCloseModal()
          }}
          onDone={() => {
            setEditing(null)
            onCloseModal()
            q.refetch()
          }}
        />
      )}
    </Card>
  )
}

function TaskModal({ task, onClose, onDone }) {
  const toast = useToast()
  const isNew = !task._id
  const [form, setForm] = useState({
    title: task.title || '',
    description: task.description || '',
    dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : '',
    dueTime: task.dueTime || '',
    priority: task.priority || 'medium',
    relatedType: task.relatedType || 'none',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const isValid = form.title.trim().length > 0 && Boolean(form.priority)

  async function save() {
    if (!form.title.trim()) {
      toast.error('Task title is required')
      return
    }
    if (!form.priority) {
      toast.error('Priority is required')
      return
    }
    setBusy(true)
    try {
      const body = {
        ...form,
        title: form.title.trim(),
        dueDate: form.dueDate || undefined,
        dueTime: form.dueTime || undefined,
      }
      if (isNew) await tasksApi.create(body)
      else await tasksApi.update(task._id, body)
      toast.success(isNew ? 'Task added' : 'Task updated')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Add Task' : 'Edit Task'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !isValid}>
            {busy ? 'Saving…' : isNew ? 'Add Task' : 'Save Changes'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label={
            <span>
              Task Title <span className="text-red-500">*</span>
            </span>
          }
          placeholder="e.g. Call Mr. Sharma regarding 3BHK unit"
          value={form.title}
          onChange={set('title')}
          required
          autoFocus
        />
        <Textarea
          label="Description (optional)"
          placeholder="Add any specific context or notes…"
          value={form.description}
          onChange={set('description')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Due Date" type="date" value={form.dueDate} onChange={set('dueDate')} />
          <Input label="Due Time" type="time" value={form.dueTime} onChange={set('dueTime')} />
          <Select
            label={
              <span>
                Priority <span className="text-red-500">*</span>
              </span>
            }
            value={form.priority}
            onChange={set('priority')}
            required
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
          <Select
            label="Related To (optional)"
            value={form.relatedType}
            onChange={set('relatedType')}
          >
            <option value="none">None</option>
            <option value="lead">Lead</option>
            <option value="customer">Customer</option>
            <option value="booking">Booking</option>
          </Select>
        </div>
      </div>
    </Modal>
  )
}

// ─── Section 4 — Follow-up Card Item ───
function FollowUpCard({ f, onDone, onReschedule }) {
  const toast = useToast()

  const act = async (fn, msg) => {
    try {
      await fn()
      toast.success(msg)
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    }
  }

  const cleanPhone = f.customer?.mobile ? String(f.customer.mobile).replace(/[^\d+]/g, '') : ''

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 transition-colors hover:bg-white hover:border-blue-200">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-900">
            {f.customer?.name || 'Lead Contact'}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <span className="inline-flex items-center gap-0.5">
              <span className="material-symbols-outlined text-[13px]">schedule</span>
              {timeOf(f.scheduledAt)}
            </span>
            {f.notes && <span>· {f.notes}</span>}
          </div>
        </div>
        {f.customer?.status && <StatusBadge status={f.customer.status} />}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {cleanPhone && (
          <a
            href={`tel:${cleanPhone}`}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition"
            title={`Call ${f.customer?.name || 'Lead'}`}
          >
            <span className="material-symbols-outlined text-[14px] text-emerald-600">call</span>
            <span>Call</span>
          </a>
        )}
        <Button
          size="sm"
          variant="success"
          onClick={() => act(() => followupsApi.complete(f._id, { outcome: 'Done' }), 'Completed')}
          className="text-xs"
        >
          Mark Done
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={onReschedule}
          className="text-xs"
        >
          Reschedule
        </Button>
      </div>
    </div>
  )
}

// ─── Reschedule Modal ───
function RescheduleModal({ item, onClose, onDone }) {
  const toast = useToast()
  const [scheduledAt, setScheduledAt] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleConfirm() {
    if (!scheduledAt) {
      toast.error('Please pick a new date and time')
      return
    }
    setBusy(true)
    try {
      await followupsApi.reschedule(item._id, {
        scheduledAt,
        reason: reason.trim() || 'Rescheduled',
      })
      toast.success('Follow-up rescheduled successfully')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reschedule')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Reschedule Follow-up"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={busy || !scheduledAt}>
            {busy ? 'Updating…' : 'Confirm Reschedule'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Client</span>
          <p className="text-sm font-semibold text-slate-900 mt-0.5">
            {item.customer?.name || 'Lead'} {item.customer?.mobile ? `(${item.customer.mobile})` : ''}
          </p>
        </div>
        <Input
          label={
            <span>
              New Date & Time <span className="text-red-500">*</span>
            </span>
          }
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          required
        />
        <Textarea
          label="Reschedule Reason (optional)"
          placeholder="e.g. Client requested callback in the evening…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </Modal>
  )
}

// ─── Section 5 — Site Visit Card Item ───
function VisitCard({ v, onDone }) {
  const toast = useToast()

  const act = async (fn, msg) => {
    try {
      await fn()
      toast.success(msg)
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 transition-colors hover:bg-white hover:border-blue-200">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-900">
            {v.customer?.name || 'Client Visit'}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            {v.project?.name && (
              <span className="inline-flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[13px]">apartment</span>
                {v.project.name}
              </span>
            )}
            <span>·</span>
            <span className="inline-flex items-center gap-0.5">
              <span className="material-symbols-outlined text-[13px]">schedule</span>
              {timeOf(v.scheduledAt)}
            </span>
          </div>
        </div>
        <StatusBadge status={v.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => act(() => visitsApi.setStatus(v._id, 'in_progress'), 'Checked in for visit')}
          className="text-xs"
        >
          Check-In
        </Button>
        <Button
          size="sm"
          variant="success"
          onClick={() => act(() => visitsApi.conduct(v._id, { outcome: 'interested' }), 'Visit completed')}
          className="text-xs"
        >
          Mark Completed
        </Button>
      </div>
    </div>
  )
}

// ─── Section 8 — Attendance Widget ───
function AttendanceCard({ q }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const today = (q.data || []).find((a) => a.date === todayKey())
  const checkedIn = Boolean(today?.checkInAt)
  const checkedOut = Boolean(today?.checkOutAt)

  async function mark(kind) {
    setBusy(true)
    try {
      const loc = await getLocation()
      if (kind === 'in') {
        await attendanceApi.checkIn(loc)
      } else {
        await attendanceApi.checkOut(loc)
      }
      toast.success(kind === 'in' ? 'Checked in successfully' : 'Checked out successfully')
      q.refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Attendance action failed')
    } finally {
      setBusy(false)
    }
  }

  const hrs = today?.workedMinutes
    ? `${Math.floor(today.workedMinutes / 60)}h ${today.workedMinutes % 60}m`
    : '—'

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Attendance</h3>
        {checkedIn && !checkedOut ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            Active Shift
          </span>
        ) : checkedOut ? (
          <span className="text-xs font-medium text-slate-500">Day Ended</span>
        ) : (
          <span className="text-xs font-medium text-amber-600">Not Checked In</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 py-3 px-2 rounded-xl bg-slate-50 border border-slate-100 text-center">
        <div>
          <div className="text-sm font-bold text-slate-900">{timeOf(today?.checkInAt)}</div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500 uppercase tracking-wide">Check-In</div>
        </div>
        <div>
          <div className="text-sm font-bold text-slate-900">{timeOf(today?.checkOutAt)}</div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500 uppercase tracking-wide">Check-Out</div>
        </div>
        <div>
          <div className="text-sm font-bold text-slate-900">{hrs}</div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500 uppercase tracking-wide">Working Hours</div>
        </div>
      </div>

      <div className="mt-3.5 flex gap-2.5">
        <Button
          size="sm"
          variant="success"
          disabled={busy || checkedIn}
          onClick={() => mark('in')}
          className="flex-1 flex items-center justify-center gap-1.5 shadow-xs"
        >
          <span className="material-symbols-outlined text-[16px]">my_location</span>
          <span>{busy && !checkedIn ? 'Checking In…' : 'Check In'}</span>
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy || !checkedIn || checkedOut}
          onClick={() => mark('out')}
          className="flex-1"
        >
          {busy && checkedIn ? 'Checking Out…' : 'Check Out'}
        </Button>
      </div>
    </Card>
  )
}
