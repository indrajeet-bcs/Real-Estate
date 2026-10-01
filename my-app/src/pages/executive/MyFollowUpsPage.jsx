import { useState, useCallback, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { followupsApi, customersApi, projectsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, titleCase } from '../../lib/format.js'
import { LEAD_STAGES, LEAD_STAGE_LABELS } from '../../lib/constants.js'
import {
  PageHeader, Card, StatCard, Button, Input, Select, Table, Modal, Loader, ErrorState,
} from '../../components/ui.jsx'

const FU_TYPES = ['call', 'whatsapp', 'email', 'meeting', 'visit', 'callback', 'other']
const OUTCOMES = [
  ['interested', 'Interested'],
  ['need_more_info', 'Need More Information'],
  ['site_visit_scheduled', 'Site Visit Scheduled'],
  ['negotiation', 'Negotiation'],
  ['not_interested', 'Not Interested'],
  ['call_later', 'Call Later'],
  ['converted', 'Converted'],
]
const CUSTOMER_STAGES = ['converted', 'booked', 'active', 'closed', 'sale_completed']
const custType = (c) => (CUSTOMER_STAGES.includes(c?.status) ? 'Customer' : 'Lead')

const dateOnly = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const timeOnly = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
const outcomeLabel = (v) => (OUTCOMES.find(([k]) => k === v) || [null, v ? titleCase(v) : null])[1]

const STATUS_META = {
  scheduled: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  missed: { label: 'Missed', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  rescheduled: { label: 'Rescheduled', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  overdue: { label: 'Overdue', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
}
function StatusPill({ f, todayStart }) {
  const overdue = f.status === 'scheduled' && new Date(f.scheduledAt) < todayStart
  const key = overdue ? 'overdue' : f.status
  const m = STATUS_META[key] || { label: titleCase(f.status), cls: 'bg-slate-100 text-slate-600 border-slate-200' }
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function MyFollowUpsPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [type, setType] = useState('all')
  const [stage, setStage] = useState('all')
  const [project, setProject] = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const [sort, setSort] = useState('today')

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [completeFor, setCompleteFor] = useState(null)
  const [rescheduleFor, setRescheduleFor] = useState(null)
  const [detailsFor, setDetailsFor] = useState(null)
  const [sheetFor, setSheetFor] = useState(null)

  const { data, loading, error, refetch } = useFetch(useCallback(() => followupsApi.list({ limit: 500 }), []))
  const { data: projects } = useFetch(useCallback(() => projectsApi.list({ limit: 200 }), []))

  const rows = data || []
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999)

  const kpis = {
    today: rows.filter((r) => r.status === 'scheduled' && new Date(r.scheduledAt) >= todayStart && new Date(r.scheduledAt) <= todayEnd).length,
    upcoming: rows.filter((r) => r.status === 'scheduled' && new Date(r.scheduledAt) > todayEnd).length,
    completed: rows.filter((r) => r.status === 'completed').length,
    overdue: rows.filter((r) => r.status === 'scheduled' && new Date(r.scheduledAt) < todayStart).length,
  }

  const filtered = useMemo(() => {
    let out = rows
    if (status !== 'all') {
      if (status === 'overdue') out = out.filter((r) => r.status === 'scheduled' && new Date(r.scheduledAt) < todayStart)
      else out = out.filter((r) => r.status === status)
    }
    if (type !== 'all') out = out.filter((r) => (r.type || 'call') === type)
    if (stage !== 'all') out = out.filter((r) => (r.customer?.status || '') === stage)
    if (project !== 'all') out = out.filter((r) => String(r.project?._id || r.project) === project)
    if (dateRange !== 'all') {
      out = out.filter((r) => {
        const d = new Date(r.scheduledAt)
        if (dateRange === 'today') return d >= todayStart && d <= todayEnd
        if (dateRange === 'week') { const w = new Date(todayEnd); w.setDate(w.getDate() + 7); return d >= todayStart && d <= w }
        if (dateRange === 'overdue') return r.status === 'scheduled' && d < todayStart
        return true
      })
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter((r) => [r.customer?.name, r.customer?.mobile].some((v) => (v || '').toLowerCase().includes(q)))
    }
    const sorted = [...out]
    if (sort === 'today' || sort === 'upcoming' || sort === 'overdue') sorted.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
    else if (sort === 'recently_completed') sorted.sort((a, b) => new Date(b.completedAt || b.updatedAt) - new Date(a.completedAt || a.updatedAt))
    return sorted
  }, [rows, status, type, stage, project, dateRange, search, sort]) // eslint-disable-line

  function call(r) { window.location.href = `tel:${(r.customer?.mobile || '').replace(/\s/g, '')}` }

  const columns = [
    { key: 'name', header: 'Name', render: (r) => (
      <div className="min-w-[9rem]"><div className="font-medium text-slate-900">{r.customer?.name || '—'}</div><div className="text-xs text-slate-500">{r.customer?.mobile || ''}</div></div>
    ) },
    { key: 'type', header: 'Type', render: (r) => (
      <span className={`rounded border px-2 py-0.5 text-xs font-medium ${custType(r.customer) === 'Customer' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{custType(r.customer)}</span>
    ) },
    { key: 'project', header: 'Project', render: (r) => r.project?.name || '—' },
    { key: 'ftype', header: 'Follow-up', render: (r) => titleCase(r.type || 'call') },
    { key: 'date', header: 'Date', render: (r) => dateOnly(r.scheduledAt) },
    { key: 'time', header: 'Time', render: (r) => timeOnly(r.scheduledAt) },
    { key: 'status', header: 'Status', render: (r) => <StatusPill f={r} todayStart={todayStart} /> },
    { key: 'assigned', header: 'Assigned', render: (r) => formatDate(r.createdAt) },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex items-center justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setDetailsFor(r) }}>View</Button>
        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); call(r) }}>Call</Button>
        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setSheetFor(r) }}>Actions ▾</Button>
      </div>
    ) },
  ]

  const overdueList = rows.filter((r) => r.status === 'scheduled' && new Date(r.scheduledAt) < todayStart)

  return (
    <div>
      <PageHeader
        title="Follow-ups"
        subtitle="Manage scheduled follow-ups, record conversations, and maintain customer engagement."
        actions={<Button onClick={() => setAdding(true)}>+ Add Follow-up</Button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Today's Follow-ups" value={kpis.today} />
        <StatCard label="Upcoming Follow-ups" value={kpis.upcoming} />
        <StatCard label="Completed Follow-ups" value={kpis.completed} />
        <StatCard label="Overdue Follow-ups" value={kpis.overdue} />
      </div>

      {/* Overdue highlight (spec §Overdue Follow-ups) */}
      {overdueList.length > 0 && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50/50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-800"><span>🚨</span> {overdueList.length} overdue follow-up{overdueList.length > 1 ? 's' : ''}</div>
          <div className="space-y-2">
            {overdueList.slice(0, 4).map((r) => (
              <div key={r._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm">
                <div><span className="font-medium text-slate-900">{r.customer?.name}</span> <span className="text-xs text-slate-500">· due {dateOnly(r.scheduledAt)}</span></div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => call(r)}>Call Now</Button>
                  <Button size="sm" variant="secondary" onClick={() => setRescheduleFor(r)}>Reschedule</Button>
                  <Button size="sm" variant="success" onClick={() => setCompleteFor(r)}>Mark Completed</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Card className="mb-4 p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-7">
          <div className="col-span-2 md:col-span-1">
            <Input label="Search" placeholder="Name or mobile" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All</option>
            <option value="scheduled">Pending</option>
            <option value="overdue">Overdue</option>
            <option value="completed">Completed</option>
            <option value="rescheduled">Rescheduled</option>
            <option value="missed">Missed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All</option>
            {FU_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
          </Select>
          <Select label="Lead Stage" value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="all">All</option>
            {LEAD_STAGES.map((s) => <option key={s} value={s}>{LEAD_STAGE_LABELS[s] || titleCase(s)}</option>)}
          </Select>
          <Select label="Project" value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="all">All</option>
            {(projects || []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </Select>
          <Select label="Date Range" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
            <option value="all">All dates</option>
            <option value="today">Today</option>
            <option value="week">Next 7 days</option>
            <option value="overdue">Overdue</option>
          </Select>
          <Select label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="today">Today</option>
            <option value="upcoming">Upcoming</option>
            <option value="overdue">Overdue</option>
            <option value="recently_completed">Recently Completed</option>
          </Select>
        </div>
      </Card>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <Table columns={columns} rows={filtered} empty="No follow-ups match your filters." onRowClick={(r) => setDetailsFor(r)} />
      )}

      {adding && <FollowUpFormModal projects={projects || []} onClose={() => setAdding(false)} onDone={() => { setAdding(false); refetch() }} />}
      {editing && <FollowUpFormModal followUp={editing} projects={projects || []} onClose={() => setEditing(null)} onDone={() => { setEditing(null); refetch() }} />}
      {completeFor && <CompleteFollowUpModal followUp={completeFor} onClose={() => setCompleteFor(null)} onDone={() => { setCompleteFor(null); refetch() }} />}
      {rescheduleFor && <RescheduleFollowUpModal followUp={rescheduleFor} onClose={() => setRescheduleFor(null)} onDone={() => { setRescheduleFor(null); refetch() }} />}
      {sheetFor && (
        <FollowUpActionSheet
          followUp={sheetFor}
          onClose={() => setSheetFor(null)}
          onView={() => { const r = sheetFor; setSheetFor(null); setDetailsFor(r) }}
          onEdit={() => { setEditing(sheetFor); setSheetFor(null) }}
          onCall={() => { call(sheetFor); setSheetFor(null) }}
          onComplete={() => { setCompleteFor(sheetFor); setSheetFor(null) }}
          onReschedule={() => { setRescheduleFor(sheetFor); setSheetFor(null) }}
        />
      )}
      {detailsFor && (
        <FollowUpDetailsDrawer
          followUp={detailsFor}
          todayStart={todayStart}
          onClose={() => setDetailsFor(null)}
          onCall={() => call(detailsFor)}
          onProfile={() => { const id = detailsFor.customer?._id; setDetailsFor(null); if (id) navigate(`/executive/customers/${id}`) }}
          onEdit={() => { setEditing(detailsFor); setDetailsFor(null) }}
          onComplete={() => { setCompleteFor(detailsFor); setDetailsFor(null) }}
          onReschedule={() => { setRescheduleFor(detailsFor); setDetailsFor(null) }}
        />
      )}
    </div>
  )
}

// ─── Action sheet ───────────────────────────────────────────────────────────────
function FollowUpActionSheet({ followUp, onClose, onView, onEdit, onCall, onComplete, onReschedule }) {
  const open = followUp.status === 'scheduled' || followUp.status === 'rescheduled'
  const items = [
    { label: 'View Details', icon: '👁', onClick: onView, show: true },
    { label: 'Edit', icon: '✏️', onClick: onEdit, show: open },
    { label: 'Call', icon: '📞', onClick: onCall, show: true },
    { label: 'Mark Completed', icon: '✓', onClick: onComplete, show: open },
    { label: 'Reschedule', icon: '↻', onClick: onReschedule, show: open },
  ].filter((i) => i.show)
  return (
    <Modal open onClose={onClose} title={followUp.customer?.name || 'Follow-up'} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <p className="mb-3 text-xs text-slate-500">{titleCase(followUp.type || 'call')} · {dateOnly(followUp.scheduledAt)} {timeOnly(followUp.scheduledAt)}</p>
      <div className="grid grid-cols-1 gap-2">
        {items.map((i) => (
          <button key={i.label} onClick={i.onClick} className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50">
            <span className="text-base">{i.icon}</span> {i.label}
          </button>
        ))}
      </div>
    </Modal>
  )
}

// ─── Add / Edit Follow-up (spec §Add Follow-up) ─────────────────────────────────
function FollowUpFormModal({ followUp, projects, onClose, onDone }) {
  const toast = useToast()
  const isEdit = !!followUp
  const [customers, setCustomers] = useState([])
  const init = followUp ? new Date(followUp.scheduledAt) : null
  const [form, setForm] = useState({
    customer: followUp?.customer?._id || '',
    date: init ? init.toISOString().slice(0, 10) : '',
    time: init ? `${String(init.getHours()).padStart(2, '0')}:${String(init.getMinutes()).padStart(2, '0')}` : '',
    type: followUp?.type || 'call',
    priority: followUp?.priority || 'medium',
    project: followUp?.project?._id || followUp?.project || '',
    notes: followUp?.notes || followUp?.purpose || '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    if (isEdit) return
    customersApi.list({ limit: 500 }).then((res) => setCustomers(res.data.data || [])).catch(() => {})
  }, [isEdit])

  const valid = (isEdit || form.customer) && form.date && form.time

  async function save(alsoCall) {
    if (!valid) { toast.error('Lead/Customer, date and time are required'); return }
    setBusy(true)
    try {
      const scheduledAt = new Date(`${form.date}T${form.time}`).toISOString()
      if (isEdit) {
        await followupsApi.update(followUp._id, { scheduledAt, type: form.type, priority: form.priority, notes: form.notes, project: form.project || null })
        toast.success('Follow-up updated')
      } else {
        await followupsApi.create({ customer: form.customer, scheduledAt, type: form.type, priority: form.priority, purpose: form.notes, notes: form.notes, project: form.project || undefined })
        toast.success('Follow-up scheduled')
      }
      onDone()
      if (alsoCall) {
        const c = isEdit ? followUp.customer : customers.find((x) => x._id === form.customer)
        if (c?.mobile) window.location.href = `tel:${c.mobile.replace(/\s/g, '')}`
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} wide title={isEdit ? `Edit Follow-up — ${followUp.customer?.name || ''}` : 'Add Follow-up'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          {!isEdit && <Button variant="secondary" onClick={() => save(true)} disabled={busy}>Save &amp; Call</Button>}
          <Button onClick={() => save(false)} disabled={busy}>{isEdit ? 'Save Changes' : 'Save'}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {isEdit ? (
          <Input label="Lead / Customer" value={followUp.customer?.name || ''} disabled />
        ) : (
          <Select label="Lead / Customer *" value={form.customer} onChange={set('customer')}>
            <option value="">Select…</option>
            {customers.map((c) => <option key={c._id} value={c._id}>{c.name} · {c.mobile}</option>)}
          </Select>
        )}
        <Select label="Project (optional)" value={form.project} onChange={set('project')}>
          <option value="">None</option>
          {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </Select>
        <Input label="Follow-up Date *" type="date" value={form.date} onChange={set('date')} />
        <Input label="Follow-up Time *" type="time" value={form.time} onChange={set('time')} />
        <Select label="Follow-up Type" value={form.type} onChange={set('type')}>
          {FU_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
        </Select>
        <Select label="Priority" value={form.priority} onChange={set('priority')}>
          <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </Select>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
          <textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Purpose / talking points…"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </div>
      </div>
    </Modal>
  )
}

// ─── Mark Completed (spec §Mark Follow-up Completed) ────────────────────────────
function CompleteFollowUpModal({ followUp, onClose, onDone }) {
  const toast = useToast()
  const [summary, setSummary] = useState('')
  const [outcome, setOutcome] = useState('interested')
  const [nextAction, setNextAction] = useState('')
  const [nextDate, setNextDate] = useState('')
  const [nextTime, setNextTime] = useState('10:00')
  const [busy, setBusy] = useState(false)

  async function complete() {
    setBusy(true)
    try {
      const payload = { conversationSummary: summary, outcome, nextAction }
      if (nextDate) payload.nextFollowUpDate = new Date(`${nextDate}T${nextTime}`).toISOString()
      await followupsApi.complete(followUp._id, payload)
      toast.success(nextDate ? 'Completed · next follow-up scheduled' : 'Follow-up completed')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Complete Follow-up — ${followUp.customer?.name || ''}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="success" onClick={complete} disabled={busy}>Mark Completed</Button></>}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Conversation Summary</label>
          <textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What was discussed?"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </div>
        <Select label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          {OUTCOMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Input label="Next Action" value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="e.g. Send cost sheet, schedule visit" />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Next Follow-up Date (optional)" type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
          <Input label="Time" type="time" value={nextTime} onChange={(e) => setNextTime(e.target.value)} disabled={!nextDate} />
        </div>
        <p className="text-xs text-slate-500">On completion the status changes to Completed and the customer/lead timeline updates automatically.</p>
      </div>
    </Modal>
  )
}

// ─── Reschedule (spec §Reschedule Follow-up) ────────────────────────────────────
function RescheduleFollowUpModal({ followUp, onClose, onDone }) {
  const toast = useToast()
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!date || !time) { toast.error('Set new date & time'); return }
    setBusy(true)
    try {
      await followupsApi.reschedule(followUp._id, { scheduledAt: new Date(`${date}T${time}`).toISOString(), reason })
      toast.success('Follow-up rescheduled')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Reschedule — ${followUp.customer?.name || ''}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>Update</Button></>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="New Date *" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="New Time *" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Reason</label>
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this being rescheduled?"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </div>
      </div>
    </Modal>
  )
}

// ─── Details Drawer (spec §Follow-up Details — 5 sections) ──────────────────────
function FollowUpDetailsDrawer({ followUp: f, todayStart, onClose, onCall, onProfile, onEdit, onComplete, onReschedule }) {
  const c = f.customer || {}
  const open = f.status === 'scheduled' || f.status === 'rescheduled'
  const timeline = (f.timeline || []).slice().reverse()

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-white shadow-2xl">
        <div className="flex items-start justify-between bg-slate-900 px-6 py-5 text-white">
          <div>
            <h2 className="text-lg font-bold">{c.name || 'Follow-up'}</h2>
            <p className="mt-0.5 text-xs text-slate-400">{titleCase(f.type || 'call')} · {dateOnly(f.scheduledAt)} {timeOnly(f.scheduledAt)}</p>
          </div>
          <button onClick={onClose} className="mt-0.5 rounded-lg p-1 text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div className="grid grid-cols-3 gap-2">
            <QuickBtn icon="📞" label="Call" onClick={onCall} />
            <QuickBtn icon="👤" label="Profile" onClick={onProfile} />
            <div className="flex items-center justify-center"><StatusPill f={f} todayStart={todayStart} /></div>
          </div>

          <Section title="1 · Basic Information">
            <Info rows={[['Name', c.name], ['Type', custType(c)], ['Contact', c.mobile], ['Email', c.email], ['Project', f.project?.name]]} />
          </Section>

          <Section title="2 · Follow-up Information">
            <Info rows={[
              ['Follow-up Date', dateOnly(f.scheduledAt)],
              ['Follow-up Time', timeOnly(f.scheduledAt)],
              ['Type', titleCase(f.type || 'call')],
              ['Current Stage', c.status ? (LEAD_STAGE_LABELS[c.status] || titleCase(c.status)) : null],
              ['Priority', titleCase(f.priority || 'medium')],
            ]} />
          </Section>

          <Section title="3 · Conversation Notes">
            <p className="text-sm text-slate-700">{f.conversationSummary || f.notes || f.purpose || <span className="italic text-slate-400">No notes recorded yet.</span>}</p>
          </Section>

          <Section title="4 · Outcome">
            {f.outcome ? (
              <Info rows={[['Outcome', outcomeLabel(f.outcome)], ['Next Action', f.nextAction]]} />
            ) : (
              <p className="text-xs italic text-slate-400">Not captured yet. Use "Mark Completed" to record the outcome.</p>
            )}
          </Section>

          <Section title="5 · Timeline">
            {timeline.length === 0 ? <p className="text-xs italic text-slate-400">No events yet.</p> : (
              <ol className="relative ml-2 space-y-3 border-l border-slate-200 pl-5">
                {timeline.map((t) => (
                  <li key={t._id} className="relative">
                    <span className="absolute -left-[22px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-blue-500" />
                    <p className="text-xs font-semibold text-slate-800">{titleCase(t.type)}</p>
                    {t.note && <p className="text-xs text-slate-600">{t.note}</p>}
                    <time className="text-[10px] text-slate-400">{formatDate(t.at, true)}</time>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>

        {open && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3">
            <Button size="sm" variant="secondary" onClick={onEdit}>Edit</Button>
            <Button size="sm" variant="secondary" onClick={onReschedule}>Reschedule</Button>
            <Button size="sm" variant="success" onClick={onComplete}>Mark Completed</Button>
          </div>
        )}
      </div>
    </div>
  )
}

function QuickBtn({ icon, label, onClick }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100">
      <span className="text-lg">{icon}</span> {label}
    </button>
  )
}

function Section({ title, children }) {
  return <div><h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</h4>{children}</div>
}

function Info({ rows }) {
  const shown = rows.filter(([, v]) => v)
  if (!shown.length) return <p className="text-xs italic text-slate-400">—</p>
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      {shown.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
          <dd className="mt-0.5 text-sm text-slate-800">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
