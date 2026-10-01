import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usersApi, customersApi, followupsApi, visitsApi, attendanceApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, titleCase } from '../../lib/format.js'
import { PageHeader, Card, Button, Input, Modal, Table, StatCard, StatusBadge, Loader, ErrorState } from '../../components/ui.jsx'

const inr = (n) => {
  const v = Number(n) || 0
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`
  return `₹${v.toLocaleString('en-IN')}`
}

// Health signals derived from real CRM metrics (no invented ratings).
function health(u) {
  const leads = u.activeLeadsCount || 0
  const bookings = u.bookingsCount || 0
  const conversion = bookings + leads > 0 ? Math.round((bookings / (bookings + leads)) * 100) : 0
  const attendance = u.attendanceRate
  const quota = u.targetRevenue > 0 ? Math.round(((u.revenueGenerated || 0) / u.targetRevenue) * 100) : null
  const score = Math.round((attendance ?? 60) * 0.4 + conversion * 0.6)
  return { conversion, attendance, quota, score }
}

const TABS = ['Overview', 'Leads', 'Follow-ups', 'Attendance', 'Site Visits', 'Tasks', 'Performance', 'Activity Timeline', 'Documents']

export default function SubAdminEmployeesPage() {
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const { data, loading, error, refetch } = useFetch(useCallback(() => usersApi.list({ role: 'sales_executive', withMetrics: 'true', limit: 200 }), []))

  const rows = data || []
  const employees = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((e) => [e.name, e.designation, e.branch].some((v) => (v || '').toLowerCase().includes(q)))
  }, [rows, search])
  const selected = rows.find((e) => e._id === selectedId) || employees[0] || null

  return (
    <div>
      <PageHeader title="Employees" subtitle="Team roster, health, leads, follow-ups, attendance, visits and performance." actions={<Button onClick={() => setCreating(true)}>+ Add Employee</Button>} />
      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
          {/* Left — roster */}
          <Card className="p-3">
            <div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400"><span>☰</span> Team Roster</div>
            <div className="mb-3"><Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <ul className="max-h-[70vh] space-y-2 overflow-y-auto">
              {employees.length === 0 && <li className="px-2 py-4 text-center text-sm text-slate-400">No employees</li>}
              {employees.map((e) => {
                const active = selected && selected._id === e._id
                return (
                  <li key={e._id}>
                    <button onClick={() => setSelectedId(e._id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${active ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <Avatar user={e} size="h-10 w-10 text-sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">{e.name}</span>
                        <span className="block truncate text-xs text-slate-500">{e.designation || titleCase(e.role)}</span>
                        <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${e.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{e.isActive ? 'Active' : 'Inactive'}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Card>

          {/* Right — detail */}
          {selected ? <EmployeePanel emp={selected} onChanged={refetch} /> : <Card className="flex items-center justify-center p-16 text-sm text-slate-400">Select an employee.</Card>}
        </div>
      )}
      {creating && <EmployeeModal onClose={() => setCreating(false)} onDone={() => { setCreating(false); refetch() }} />}
    </div>
  )
}

function Avatar({ user, size = 'h-14 w-14 text-xl' }) {
  const initial = (user?.name || 'E').charAt(0).toUpperCase()
  if (user?.avatar) return <img src={user.avatar} alt={user.name} className={`${size} shrink-0 rounded-full object-cover`} />
  return <div className={`${size} flex shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700`}>{initial}</div>
}

function Gauge({ value, size = 56 }) {
  const v = Math.max(0, Math.min(100, value || 0))
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  const dash = (v / 100) * c
  const color = v >= 70 ? '#10b981' : v >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${dash} ${c - dash}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="53%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 13, fontWeight: 700, fill: '#0f172a' }}>{v}%</text>
    </svg>
  )
}

function EmployeePanel({ emp, onChanged }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState('Overview')
  const [editing, setEditing] = useState(false)
  const h = health(emp)
  // Aggregated detail (summaries, activity timeline) for the richer tabs.
  const { data: detail } = useFetch(useCallback(() => usersApi.get(emp._id), [emp._id]))

  return (
    <div>
      {/* Header */}
      <Card className="mb-4 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar user={emp} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">{emp.name}</h2>
              <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{emp.designation || titleCase(emp.role)}</span>
              <StatusBadge status={emp.isActive ? 'approved' : 'cancelled'} />
            </div>
            <p className="mt-0.5 text-sm text-slate-500">{emp.employeeId || '—'} · {emp.branch || 'No branch'} · Sales Operation</p>
            <p className="mt-1 text-xs text-slate-500">{emp.phone && <span className="mr-3">☎ {emp.phone}</span>}{emp.email && <span>✉ {emp.email}</span>}</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit Employee</Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/sub-admin/leads')}>Assign Lead</Button>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Gauge value={h.score} size={44} />
              <div><div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Health Score</div><div className="text-[11px] text-slate-500">Live CRM metrics</div></div>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm font-medium transition ${tab === t ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>{t}</button>)}
      </div>

      {tab === 'Overview' && <OverviewTab emp={emp} h={h} detail={detail} />}
      {tab === 'Leads' && <LeadsTab empId={emp._id} navigate={navigate} />}
      {tab === 'Follow-ups' && <FollowUpsTab empId={emp._id} />}
      {tab === 'Attendance' && <AttendanceTab empId={emp._id} summary={detail?.attendanceSummary} />}
      {tab === 'Site Visits' && <VisitsTab empId={emp._id} />}
      {tab === 'Tasks' && <EmptyTab title="Tasks" note="Task assignments will appear here once the Tasks module is enabled." />}
      {tab === 'Performance' && <PerformanceTab emp={emp} h={h} detail={detail} />}
      {tab === 'Activity Timeline' && <ActivityTab detail={detail} />}
      {tab === 'Documents' && <EmptyTab title="Documents" note="Employee documents (Aadhaar, PAN, offer letter, etc.) will appear here once document storage is enabled." />}

      {editing && <EmployeeModal user={emp} onClose={() => setEditing(false)} onDone={() => { setEditing(false); onChanged() }} />}
    </div>
  )
}

function KpiRow({ items, cols = 'sm:grid-cols-4' }) {
  return <div className={`grid grid-cols-2 gap-3 ${cols}`}>{items.map((it) => <StatCard key={it.label} label={it.label} value={it.value} />)}</div>
}
function EmptyTab({ title, note }) {
  return <Card className="p-12 text-center"><h3 className="text-sm font-semibold text-slate-700">{title}</h3><p className="mx-auto mt-1 max-w-md text-sm text-slate-400">{note}</p></Card>
}
function Info({ label, value }) { return <div><dt className="text-xs text-slate-400">{label}</dt><dd className="text-slate-700">{value || '—'}</dd></div> }
function HealthStat({ label, value, sub, color }) {
  return <Card className="p-4"><div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div><div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>{sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}</Card>
}

// 1 — Overview (+ health card breakdown)
function OverviewTab({ emp, h, detail }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <HealthStat label="Attendance Rate" value={h.attendance == null ? '—' : `${h.attendance}%`} sub="90% required SLA" color="text-emerald-600" />
        <HealthStat label="Monthly Quota" value={h.quota == null ? '—' : `${h.quota}%`} sub={emp.targetRevenue ? `${inr(emp.revenueGenerated)} vs ${inr(emp.targetRevenue)}` : 'No target set'} color="text-amber-600" />
        <HealthStat label="Lead Conversion" value={`${h.conversion}%`} sub="Bookings ÷ pipeline" color="text-blue-600" />
        <HealthStat label="Bookings Closed" value={emp.bookingsCount || 0} sub={`${emp.activeLeadsCount || 0} active leads`} color="text-violet-600" />
      </div>
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Employee Information</h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Info label="Email" value={emp.email} />
          <Info label="Mobile" value={emp.phone} />
          <Info label="Branch" value={emp.branch} />
          <Info label="Joining Date" value={emp.joiningDate ? formatDate(emp.joiningDate) : (detail?.user?.joiningDate ? formatDate(detail.user.joiningDate) : '—')} />
          <Info label="Employment Status" value={emp.isActive ? 'Active' : 'Disabled'} />
        </dl>
      </Card>
    </div>
  )
}

// 2 — Leads
function LeadsTab({ empId, navigate }) {
  const { data, loading } = useFetch(useCallback(() => customersApi.list({ assignedTo: empId, limit: 200 }), [empId]))
  const rows = data || []
  const by = (s) => rows.filter((r) => r.status === s).length
  const columns = [
    { key: 'id', header: 'Lead ID', render: (r) => <span className="font-mono text-xs text-slate-500">#{r._id.slice(-6).toUpperCase()}</span> },
    { key: 'name', header: 'Customer', render: (r) => <span className="font-medium text-slate-800">{r.name}</span> },
    { key: 'project', header: 'Project', render: (r) => r.interestedProjects?.[0]?.project?.name || '—' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'date', header: 'Date Assigned', render: (r) => formatDate(r.assignedAt || r.createdAt) },
  ]
  return (
    <div className="space-y-4">
      <KpiRow cols="sm:grid-cols-5" items={[
        { label: 'Total Leads', value: rows.length }, { label: 'New', value: by('new') }, { label: 'In Progress', value: by('in_progress') },
        { label: 'Qualified', value: by('follow_up_due') }, { label: 'Closed', value: by('booked') + by('lost') },
      ]} />
      {loading ? <Loader /> : <Table columns={columns} rows={rows} empty="No leads assigned." onRowClick={(r) => navigate(`/sub-admin/customers/${r._id}`)} />}
    </div>
  )
}

// 3 — Follow-ups
function FollowUpsTab({ empId }) {
  const toast = useToast()
  const { data, loading, refetch } = useFetch(useCallback(() => followupsApi.list({ assignedTo: empId, limit: 200 }), [empId]))
  const rows = data || []
  const now = new Date()
  const same = (a) => { const d = new Date(a); return d.toDateString() === now.toDateString() }
  const complete = async (r) => {
    try { await followupsApi.complete(r._id, { outcome: 'Completed by sub-admin' }); toast.success('Marked completed'); refetch() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }
  const columns = [
    { key: 'type', header: 'Follow-up Type', render: (r) => titleCase(r.type || 'call') },
    { key: 'customer', header: 'Customer', render: (r) => r.customer?.name || '—' },
    { key: 'time', header: 'Scheduled Time', render: (r) => formatDate(r.scheduledAt, true) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: '', render: (r) => r.status === 'scheduled' && <Button size="sm" variant="secondary" onClick={() => complete(r)}>Mark Completed</Button> },
  ]
  return (
    <div className="space-y-4">
      <KpiRow items={[
        { label: 'Today', value: rows.filter((r) => r.status === 'scheduled' && same(r.scheduledAt)).length },
        { label: 'Upcoming', value: rows.filter((r) => r.status === 'scheduled' && new Date(r.scheduledAt) > now).length },
        { label: 'Completed', value: rows.filter((r) => r.status === 'completed').length },
        { label: 'Missed', value: rows.filter((r) => r.status === 'missed').length },
      ]} />
      {loading ? <Loader /> : <Table columns={columns} rows={rows} empty="No follow-ups." />}
    </div>
  )
}

// 4 — Attendance
function AttendanceTab({ empId, summary = {} }) {
  const { data, loading } = useFetch(useCallback(() => attendanceApi.review({ user: empId, limit: 60 }), [empId]))
  const columns = [
    { key: 'date', header: 'Date' },
    { key: 'in', header: 'Check-in', render: (r) => r.checkInAt ? formatDate(r.checkInAt, true) : '—' },
    { key: 'out', header: 'Check-out', render: (r) => r.checkOutAt ? formatDate(r.checkOutAt, true) : '—' },
    { key: 'hours', header: 'Working Hours', render: (r) => r.workedMinutes ? `${(r.workedMinutes / 60).toFixed(1)}h` : '—' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]
  return (
    <div className="space-y-4">
      <KpiRow items={[
        { label: 'Present', value: summary.presentDays ?? 0 }, { label: 'Absent', value: summary.absentDays ?? 0 },
        { label: 'Late Check-ins', value: summary.lateCheckIns ?? 0 }, { label: 'Attendance %', value: summary.attendancePct == null ? '—' : `${summary.attendancePct}%` },
      ]} />
      {loading ? <Loader /> : <Table columns={columns} rows={data || []} empty="No attendance records." />}
    </div>
  )
}

// 5 — Site Visits
function VisitsTab({ empId }) {
  const { data, loading } = useFetch(useCallback(() => visitsApi.list({ assignedTo: empId, limit: 200 }), [empId]))
  const rows = data || []
  const columns = [
    { key: 'id', header: 'Visit ID', render: (r) => <span className="font-mono text-xs text-slate-500">#{r._id.slice(-6).toUpperCase()}</span> },
    { key: 'project', header: 'Project', render: (r) => r.project?.name || '—' },
    { key: 'customer', header: 'Customer', render: (r) => r.customer?.name || '—' },
    { key: 'time', header: 'Date & Time', render: (r) => formatDate(r.scheduledAt, true) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]
  return (
    <div className="space-y-4">
      <KpiRow items={[
        { label: 'Total Visits', value: rows.length }, { label: 'Upcoming', value: rows.filter((r) => r.status === 'scheduled').length },
        { label: 'Completed', value: rows.filter((r) => r.status === 'conducted').length }, { label: 'Cancelled', value: rows.filter((r) => r.status === 'cancelled').length },
      ]} />
      {loading ? <Loader /> : <Table columns={columns} rows={rows} empty="No site visits." />}
    </div>
  )
}

// 7 — Performance
function PerformanceTab({ emp, h, detail }) {
  const sp = detail?.salesPerformance || {}
  const ls = detail?.leadSummary || {}
  const kpis = [
    { label: 'Performance Score', value: `${h.score}%` },
    { label: 'Total Leads Assigned', value: ls.assignedLeads ?? (emp.activeLeadsCount || 0) },
    { label: 'Lead Conversion Rate', value: `${sp.conversionRate ?? h.conversion}%` },
    { label: 'Bookings Closed', value: sp.bookings ?? (emp.bookingsCount || 0) },
    { label: 'Revenue Generated', value: inr(sp.revenueGenerated ?? emp.revenueGenerated) },
    { label: 'Follow-up Completion', value: ls.followUps ?? '—' },
    { label: 'Attendance %', value: h.attendance == null ? '—' : `${h.attendance}%` },
    { label: 'Site Visits', value: sp.customersHandled ?? '—' },
  ]
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{kpis.map((k) => <StatCard key={k.label} label={k.label} value={k.value} />)}</div>
      <Card className="p-5 text-sm text-slate-400">Performance trend charts (lead, conversion, booking, follow-up, attendance, visit) populate as historical activity accrues.</Card>
    </div>
  )
}

// 8 — Activity Timeline
function ActivityTab({ detail }) {
  const items = detail?.activityTimeline || []
  const recent = detail?.recentActivities || []
  const list = items.length ? items : recent
  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Activity Timeline</h3>
      {list.length === 0 ? <p className="text-sm text-slate-400">No activity recorded.</p> : (
        <ol className="relative space-y-4 border-l border-slate-200 pl-4">
          {list.map((t, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-blue-500" />
              <div className="text-sm font-medium text-slate-800">{t.label || t.description || `${titleCase(t.action)} · ${titleCase(t.module)}`}</div>
              {t.meta && <div className="text-xs text-slate-500">{t.meta}</div>}
              <div className="text-xs text-slate-400">{formatDate(t.at || t.createdAt, true)}</div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

// Create / Edit employee
function EmployeeModal({ user, onClose, onDone }) {
  const toast = useToast()
  const isNew = !user
  const [form, setForm] = useState({
    name: user?.name || '', email: user?.email || '', password: '', phone: user?.phone || '',
    designation: user?.designation || '', branch: user?.branch || '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  async function save() {
    setBusy(true)
    try {
      if (isNew) await usersApi.create({ ...form, role: 'sales_executive' })
      else await usersApi.update(user._id, { name: form.name, phone: form.phone, designation: form.designation, branch: form.branch })
      toast.success(isNew ? 'Employee created' : 'Employee updated')
      onDone()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed') }
    finally { setBusy(false) }
  }
  const invalid = isNew ? (!form.name || !form.email || form.password.length < 8) : form.name.trim().length < 2
  return (
    <Modal open onClose={onClose} wide title={isNew ? 'Add Employee' : `Edit ${user.name}`} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy || invalid}>{isNew ? 'Create' : 'Save'}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Full name" value={form.name} onChange={set('name')} />
        {isNew && <Input label="Email" type="email" value={form.email} onChange={set('email')} />}
        {isNew && <Input label="Password (min 8)" type="password" value={form.password} onChange={set('password')} />}
        <Input label="Phone" value={form.phone} onChange={set('phone')} />
        <Input label="Designation" value={form.designation} onChange={set('designation')} />
        <Input label="Branch" value={form.branch} onChange={set('branch')} />
      </div>
    </Modal>
  )
}
