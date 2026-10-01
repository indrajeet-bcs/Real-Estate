import { useState, useCallback, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { visitsApi, customersApi, projectsApi, buildersApi, unitsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, formatMoney, titleCase } from '../../lib/format.js'
import {
  PageHeader, Card, StatCard, Button, Input, Select, Table, Modal, Loader, ErrorState,
} from '../../components/ui.jsx'

const VISIT_TYPES = ['first_visit', 'revisit', 'final_visit', 'virtual', 'other']
const INTEREST_LEVELS = [
  ['highly_interested', 'Highly Interested'],
  ['interested', 'Interested'],
  ['needs_follow_up', 'Needs Follow-up'],
  ['not_interested', 'Not Interested'],
]

// Visit status → { label, badge classes }. "conducted" surfaces as "Completed".
const STATUS_META = {
  scheduled: { label: 'Scheduled', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  confirmed: { label: 'Confirmed', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  in_progress: { label: 'In Progress', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  conducted: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rescheduled: { label: 'Rescheduled', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  missed: { label: 'Missed', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
}
const StatusPill = ({ s }) => {
  const m = STATUS_META[s] || { label: titleCase(s), cls: 'bg-slate-100 text-slate-600 border-slate-200' }
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>
}

const dateOnly = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const timeOnly = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

// Try to grab the browser's GPS (best-effort; resolves null on denial/timeout).
function getGeo() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, address: `${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}` }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  })
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function MyVisitsPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [project, setProject] = useState('all')
  const [builder, setBuilder] = useState('all')
  const [visitType, setVisitType] = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const [sort, setSort] = useState('today')

  const [scheduling, setScheduling] = useState(false)
  const [editing, setEditing] = useState(null)
  const [checkInFor, setCheckInFor] = useState(null)
  const [completeFor, setCompleteFor] = useState(null)
  const [rescheduleFor, setRescheduleFor] = useState(null)
  const [detailsFor, setDetailsFor] = useState(null)
  const [sheetFor, setSheetFor] = useState(null)

  const { data, loading, error, refetch } = useFetch(useCallback(() => visitsApi.list({ limit: 500 }), []))
  const { data: projects } = useFetch(useCallback(() => projectsApi.list({ limit: 200 }), []))
  const { data: builders } = useFetch(useCallback(() => buildersApi.list({ limit: 200 }), []))

  const rows = data || []
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999)
  const isOpen = (s) => ['scheduled', 'confirmed', 'in_progress'].includes(s)

  const kpis = {
    today: rows.filter((r) => isOpen(r.status) && new Date(r.scheduledAt) >= todayStart && new Date(r.scheduledAt) <= todayEnd).length,
    upcoming: rows.filter((r) => ['scheduled', 'confirmed'].includes(r.status) && new Date(r.scheduledAt) > todayEnd).length,
    completed: rows.filter((r) => r.status === 'conducted').length,
    cancelled: rows.filter((r) => r.status === 'cancelled').length,
  }

  const filtered = useMemo(() => {
    let out = rows
    if (status !== 'all') out = out.filter((r) => r.status === status)
    if (project !== 'all') out = out.filter((r) => String(r.project?._id || r.project) === project)
    if (builder !== 'all') out = out.filter((r) => String(r.builder?._id || r.builder) === builder)
    if (visitType !== 'all') out = out.filter((r) => (r.visitType || 'first_visit') === visitType)
    if (dateRange !== 'all') {
      out = out.filter((r) => {
        const d = new Date(r.scheduledAt)
        if (dateRange === 'today') return d >= todayStart && d <= todayEnd
        if (dateRange === 'week') { const w = new Date(todayEnd); w.setDate(w.getDate() + 7); return d >= todayStart && d <= w }
        if (dateRange === 'month') { const m = new Date(todayEnd); m.setDate(m.getDate() + 30); return d >= todayStart && d <= m }
        if (dateRange === 'past') return d < todayStart
        return true
      })
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter((r) => [r.customer?.name, r.customer?.mobile, r.project?.name].some((v) => (v || '').toLowerCase().includes(q)))
    }
    const sorted = [...out]
    if (sort === 'today' || sort === 'upcoming') sorted.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
    else if (sort === 'recently_completed') sorted.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    return sorted
  }, [rows, status, project, builder, visitType, dateRange, search, sort]) // eslint-disable-line

  function call(r) { window.location.href = `tel:${(r.customer?.mobile || '').replace(/\s/g, '')}` }
  function navigateTo(r) {
    const q = r.meetingPoint || r.project?.location || r.project?.name || ''
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`, '_blank')
  }

  const columns = [
    { key: 'customer', header: 'Customer', render: (r) => (
      <div className="min-w-[9rem]">
        <div className="font-medium text-slate-900">{r.customer?.name || '—'}</div>
        <div className="text-xs text-slate-500">{r.customer?.mobile || '—'}</div>
      </div>
    ) },
    { key: 'project', header: 'Project', render: (r) => r.project?.name || '—' },
    { key: 'unit', header: 'Unit', render: (r) => r.unit?.unitNumber || '—' },
    { key: 'date', header: 'Visit Date', render: (r) => dateOnly(r.scheduledAt) },
    { key: 'time', header: 'Time', render: (r) => timeOnly(r.scheduledAt) },
    { key: 'status', header: 'Status', render: (r) => <StatusPill s={r.status} /> },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex items-center justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setDetailsFor(r) }}>View</Button>
        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); call(r) }}>Call</Button>
        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setSheetFor(r) }}>Actions ▾</Button>
      </div>
    ) },
  ]

  return (
    <div>
      <PageHeader
        title="Site Visits"
        subtitle="Manage scheduled property visits, record customer feedback, and update visit outcomes."
        actions={<Button onClick={() => setScheduling(true)}>+ Schedule Site Visit</Button>}
      />

      {/* Top Summary Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Today's Visits" value={kpis.today} />
        <StatCard label="Upcoming Visits" value={kpis.upcoming} />
        <StatCard label="Completed Visits" value={kpis.completed} />
        <StatCard label="Cancelled Visits" value={kpis.cancelled} />
      </div>

      {/* Filters & Search */}
      <Card className="mb-4 p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-7">
          <div className="col-span-2 md:col-span-1">
            <Input label="Search" placeholder="Customer, mobile, project" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select label="Visit Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All</option>
            {Object.keys(STATUS_META).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </Select>
          <Select label="Project" value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="all">All</option>
            {(projects || []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </Select>
          <Select label="Builder" value={builder} onChange={(e) => setBuilder(e.target.value)}>
            <option value="all">All</option>
            {(builders || []).map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </Select>
          <Select label="Visit Type" value={visitType} onChange={(e) => setVisitType(e.target.value)}>
            <option value="all">All</option>
            {VISIT_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
          </Select>
          <Select label="Date Range" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
            <option value="all">All dates</option>
            <option value="today">Today</option>
            <option value="week">Next 7 days</option>
            <option value="month">Next 30 days</option>
            <option value="past">Past</option>
          </Select>
          <Select label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="today">Today's Visits</option>
            <option value="upcoming">Upcoming Visits</option>
            <option value="recently_completed">Recently Completed</option>
          </Select>
        </div>
      </Card>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <Table columns={columns} rows={filtered} empty="No site visits match your filters." onRowClick={(r) => setDetailsFor(r)} />
      )}

      {/* Modals */}
      {scheduling && <VisitFormModal projects={projects || []} builders={builders || []} onClose={() => setScheduling(false)} onDone={() => { setScheduling(false); refetch() }} />}
      {editing && <VisitFormModal visit={editing} projects={projects || []} builders={builders || []} onClose={() => setEditing(null)} onDone={() => { setEditing(null); refetch() }} />}
      {sheetFor && (
        <VisitActionSheet
          visit={sheetFor}
          onClose={() => setSheetFor(null)}
          onEdit={() => { setEditing(sheetFor); setSheetFor(null) }}
          onNavigate={() => { navigateTo(sheetFor); setSheetFor(null) }}
          onCheckIn={() => { setCheckInFor(sheetFor); setSheetFor(null) }}
          onComplete={() => { setCompleteFor(sheetFor); setSheetFor(null) }}
          onReschedule={() => { setRescheduleFor(sheetFor); setSheetFor(null) }}
          onView={() => { const r = sheetFor; setSheetFor(null); setDetailsFor(r) }}
        />
      )}
      {checkInFor && <CheckInModal visit={checkInFor} onClose={() => setCheckInFor(null)} onDone={() => { setCheckInFor(null); refetch() }} />}
      {completeFor && <CompleteVisitModal visit={completeFor} onClose={() => setCompleteFor(null)} onDone={() => { setCompleteFor(null); refetch() }} />}
      {rescheduleFor && <RescheduleVisitModal visit={rescheduleFor} onClose={() => setRescheduleFor(null)} onDone={() => { setRescheduleFor(null); refetch() }} />}
      {detailsFor && (
        <VisitDetailsDrawer
          visit={detailsFor}
          onClose={() => setDetailsFor(null)}
          onCall={() => call(detailsFor)}
          onNavigate={() => navigateTo(detailsFor)}
          onCheckIn={() => { setCheckInFor(detailsFor); setDetailsFor(null) }}
          onComplete={() => { setCompleteFor(detailsFor); setDetailsFor(null) }}
          onReschedule={() => { setRescheduleFor(detailsFor); setDetailsFor(null) }}
          onProfile={() => { const id = detailsFor.customer?._id; setDetailsFor(null); if (id) navigate(`/executive/customers/${id}`) }}
          onDone={refetch}
        />
      )}
    </div>
  )
}

// ─── Row action sheet (spec §Actions) ───────────────────────────────────────────
function VisitActionSheet({ visit, onClose, onView, onEdit, onNavigate, onCheckIn, onComplete, onReschedule }) {
  const editable = !['conducted', 'cancelled'].includes(visit.status)
  const canCheckIn = ['scheduled', 'confirmed'].includes(visit.status) && !visit.checkIn?.at
  const canComplete = ['scheduled', 'confirmed', 'in_progress'].includes(visit.status)
  const items = [
    { label: 'View Details', icon: '👁', onClick: onView, show: true },
    { label: 'Edit', icon: '✏️', onClick: onEdit, show: editable },
    { label: 'Navigate', icon: '🧭', onClick: onNavigate, show: true },
    { label: 'Check-In', icon: '📍', onClick: onCheckIn, show: canCheckIn },
    { label: 'Mark Completed', icon: '✓', onClick: onComplete, show: canComplete },
    { label: 'Reschedule', icon: '↻', onClick: onReschedule, show: editable },
  ].filter((i) => i.show)

  return (
    <Modal open onClose={onClose} title={visit.customer?.name || 'Site Visit'}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <p className="mb-3 text-xs text-slate-500">{visit.project?.name || '—'} · {dateOnly(visit.scheduledAt)} {timeOnly(visit.scheduledAt)} · {STATUS_META[visit.status]?.label || titleCase(visit.status)}</p>
      <div className="grid grid-cols-1 gap-2">
        {items.map((i) => (
          <button
            key={i.label}
            onClick={i.onClick}
            className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50"
          >
            <span className="text-base">{i.icon}</span> {i.label}
          </button>
        ))}
      </div>
    </Modal>
  )
}

// ─── Schedule / Edit Site Visit (spec §Schedule Site Visit) ─────────────────────
function VisitFormModal({ visit, projects, builders, onClose, onDone }) {
  const toast = useToast()
  const isEdit = !!visit
  const [customers, setCustomers] = useState([])
  const [units, setUnits] = useState([])
  const initDate = visit ? new Date(visit.scheduledAt) : null
  const [form, setForm] = useState({
    customer: visit?.customer?._id || '',
    builder: visit?.builder?._id || '',
    project: visit?.project?._id || '',
    unit: visit?.unit?._id || '',
    date: initDate ? initDate.toISOString().slice(0, 10) : '',
    time: initDate ? `${String(initDate.getHours()).padStart(2, '0')}:${String(initDate.getMinutes()).padStart(2, '0')}` : '',
    visitType: visit?.visitType || 'first_visit',
    meetingPoint: visit?.meetingPoint || '',
    notes: visit?.notes || '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    if (isEdit) return
    customersApi.list({ limit: 500 }).then((res) => setCustomers(res.data.data || [])).catch(() => {})
  }, [isEdit])

  useEffect(() => {
    if (!form.project) { setUnits([]); return }
    unitsApi.list({ project: form.project, limit: 200 }).then((res) => setUnits(res.data.data || [])).catch(() => setUnits([]))
  }, [form.project])

  async function save() {
    if (!form.date || !form.time || (!isEdit && !form.customer) || !form.project) {
      toast.error('Customer, project, date and time are required'); return
    }
    setBusy(true)
    try {
      const scheduledAt = new Date(`${form.date}T${form.time}`).toISOString()
      const payload = {
        project: form.project,
        builder: form.builder || undefined,
        unit: form.unit || undefined,
        scheduledAt,
        visitType: form.visitType,
        meetingPoint: form.meetingPoint || undefined,
        notes: form.notes || undefined,
      }
      if (isEdit) {
        await visitsApi.update(visit._id, payload)
        toast.success('Visit updated')
      } else {
        await visitsApi.create({ ...payload, customer: form.customer })
        toast.success('Site visit scheduled')
      }
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} wide title={isEdit ? `Edit Visit — ${visit.customer?.name || ''}` : 'Schedule Site Visit'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{isEdit ? 'Update Schedule' : 'Schedule Visit'}</Button></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {isEdit ? (
          <Input label="Customer" value={visit.customer?.name || ''} disabled />
        ) : (
          <Select label="Customer *" value={form.customer} onChange={set('customer')}>
            <option value="">Select…</option>
            {customers.map((c) => <option key={c._id} value={c._id}>{c.name} · {c.mobile}</option>)}
          </Select>
        )}
        <Select label="Builder" value={form.builder} onChange={set('builder')}>
          <option value="">Select…</option>
          {builders.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
        </Select>
        <Select label="Project *" value={form.project} onChange={set('project')}>
          <option value="">Select…</option>
          {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </Select>
        <Select label="Property Unit (optional)" value={form.unit} onChange={set('unit')} disabled={!form.project}>
          <option value="">{form.project ? 'None' : 'Pick a project first'}</option>
          {units.map((u) => <option key={u._id} value={u._id}>{u.unitNumber}</option>)}
        </Select>
        <Input label="Visit Date *" type="date" value={form.date} onChange={set('date')} />
        <Input label="Visit Time *" type="time" value={form.time} onChange={set('time')} />
        <Select label="Visit Type" value={form.visitType} onChange={set('visitType')}>
          {VISIT_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
        </Select>
        <Input label="Meeting Location" value={form.meetingPoint} onChange={set('meetingPoint')} placeholder="e.g. Project site gate, Sales office" />
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
          <textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Any details for this visit…"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </div>
      </div>
    </Modal>
  )
}

// ─── Check-In (spec §Check-In) ──────────────────────────────────────────────────
function CheckInModal({ visit, onClose, onDone }) {
  const toast = useToast()
  const [geo, setGeo] = useState(null)
  const [locating, setLocating] = useState(true)
  const [photo, setPhoto] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getGeo().then((g) => { setGeo(g); setLocating(false) })
  }, [])

  async function checkIn() {
    setBusy(true)
    try {
      await visitsApi.checkIn(visit._id, { location: geo || undefined, photo: photo || undefined })
      toast.success('Checked in')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Check-In — ${visit.customer?.name || ''}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={checkIn} disabled={busy}>Check-In</Button></>}
    >
      <div className="space-y-4 text-sm">
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex justify-between"><span className="text-slate-500">Check-In Time</span><span className="font-medium">{timeOnly(new Date())}, {dateOnly(new Date())}</span></div>
          <div className="mt-1 flex justify-between">
            <span className="text-slate-500">GPS Location</span>
            <span className="font-medium">{locating ? 'Locating…' : geo ? geo.address : 'Unavailable'}</span>
          </div>
        </div>
        <Input label="Visit Photo URL (optional)" value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder="Paste an uploaded photo link" />
        <p className="text-xs text-slate-500">GPS location and time are captured automatically. This moves the visit to <strong>In Progress</strong>.</p>
      </div>
    </Modal>
  )
}

// ─── Check-Out (spec §Check-Out) ────────────────────────────────────────────────
function CheckOutModal({ visit, onClose, onDone }) {
  const toast = useToast()
  const [geo, setGeo] = useState(null)
  const [locating, setLocating] = useState(true)
  const [summary, setSummary] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { getGeo().then((g) => { setGeo(g); setLocating(false) }) }, [])

  async function checkOut() {
    setBusy(true)
    try {
      await visitsApi.checkOut(visit._id, { location: geo || undefined, summary: summary || undefined })
      toast.success('Checked out')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Check-Out — ${visit.customer?.name || ''}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={checkOut} disabled={busy}>Check-Out</Button></>}
    >
      <div className="space-y-4 text-sm">
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex justify-between"><span className="text-slate-500">Check-Out Time</span><span className="font-medium">{timeOnly(new Date())}, {dateOnly(new Date())}</span></div>
          <div className="mt-1 flex justify-between"><span className="text-slate-500">GPS Location</span><span className="font-medium">{locating ? 'Locating…' : geo ? geo.address : 'Unavailable'}</span></div>
          {visit.checkIn?.at && <div className="mt-1 flex justify-between"><span className="text-slate-500">Duration</span><span className="font-medium">{Math.max(0, Math.round((Date.now() - new Date(visit.checkIn.at)) / 60000))} min</span></div>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Visit Summary</label>
          <textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Brief summary of the visit…"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </div>
        <p className="text-xs text-slate-500">Visit duration is calculated automatically from check-in.</p>
      </div>
    </Modal>
  )
}

// ─── Complete Site Visit (spec §Complete Site Visit / §Visit Outcome) ───────────
function CompleteVisitModal({ visit, onClose, onDone }) {
  const toast = useToast()
  const [feedback, setFeedback] = useState(visit.feedback || '')
  const [interestLevel, setInterestLevel] = useState(visit.interestLevel || 'interested')
  const [nextDate, setNextDate] = useState('')
  const [nextTime, setNextTime] = useState('10:00')
  const [remarks, setRemarks] = useState(visit.remarks || '')
  const [busy, setBusy] = useState(false)

  async function complete() {
    setBusy(true)
    try {
      const payload = { feedback, interestLevel, remarks, nextAction: remarks || undefined }
      if (nextDate) payload.nextFollowUpDate = new Date(`${nextDate}T${nextTime}`).toISOString()
      const res = await visitsApi.complete(visit._id, payload)
      toast.success(res.data?.data?.followUp ? 'Visit completed · follow-up scheduled' : 'Visit completed')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Complete Visit — ${visit.customer?.name || ''}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="success" onClick={complete} disabled={busy}>Mark Completed</Button></>}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Customer Feedback</label>
          <textarea rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What did the customer say about the property?"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </div>
        <Select label="Interest Level" value={interestLevel} onChange={(e) => setInterestLevel(e.target.value)}>
          {INTEREST_LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Next Follow-up Date" type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
          <Input label="Time" type="time" value={nextTime} onChange={(e) => setNextTime(e.target.value)} disabled={!nextDate} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Remarks / Next Action</label>
          <textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Any next action to take…"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </div>
        <p className="text-xs text-slate-500">On completion the visit status changes to Completed, the customer timeline updates, and a follow-up reminder is created if a date is set.</p>
      </div>
    </Modal>
  )
}

// ─── Reschedule (spec §Reschedule Site Visit) ───────────────────────────────────
function RescheduleVisitModal({ visit, onClose, onDone }) {
  const toast = useToast()
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!date || !time) { toast.error('Set new date & time'); return }
    setBusy(true)
    try {
      await visitsApi.reschedule(visit._id, { scheduledAt: new Date(`${date}T${time}`).toISOString(), reason })
      toast.success('Visit rescheduled')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Reschedule — ${visit.customer?.name || ''}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>Update Schedule</Button></>}
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

// ─── Visit Details Drawer (spec §Site Visit Details — 6 sections) ───────────────
function VisitDetailsDrawer({ visit, onClose, onCall, onNavigate, onCheckIn, onComplete, onReschedule, onProfile, onDone }) {
  const [checkingOut, setCheckingOut] = useState(false)
  const c = visit.customer || {}
  const canCheckIn = ['scheduled', 'confirmed'].includes(visit.status) && !visit.checkIn?.at
  const canCheckOut = visit.checkIn?.at && !visit.checkOut?.at && visit.status !== 'conducted'
  const canComplete = ['scheduled', 'confirmed', 'in_progress'].includes(visit.status)
  const editable = !['conducted', 'cancelled'].includes(visit.status)

  const timeline = (visit.timeline || []).slice().reverse()

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-white shadow-2xl">
        <div className="flex items-start justify-between bg-slate-900 px-6 py-5 text-white">
          <div>
            <h2 className="text-lg font-bold">{c.name || 'Site Visit'}</h2>
            <p className="mt-0.5 text-xs text-slate-400">{STATUS_META[visit.status]?.label || titleCase(visit.status)} · {dateOnly(visit.scheduledAt)}</p>
          </div>
          <button onClick={onClose} className="mt-0.5 rounded-lg p-1 text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* Quick actions */}
          <div className="grid grid-cols-4 gap-2">
            <QuickBtn icon="📞" label="Call" onClick={onCall} />
            <QuickBtn icon="🧭" label="Navigate" onClick={onNavigate} />
            <QuickBtn icon="👤" label="Profile" onClick={onProfile} />
            {canCheckIn && <QuickBtn icon="📍" label="Check-In" onClick={onCheckIn} accent="emerald" />}
            {canCheckOut && <QuickBtn icon="🏁" label="Check-Out" onClick={() => setCheckingOut(true)} accent="amber" />}
          </div>

          <Section title="1 · Customer Information">
            <Info rows={[
              ['Name', c.name],
              ['Contact', c.mobile],
              ['Email', c.email],
              ['Budget', c.budgetMin || c.budgetMax ? `${formatMoney(c.budgetMin)} – ${formatMoney(c.budgetMax)}` : null],
            ]} />
          </Section>

          <Section title="2 · Property Details">
            <Info rows={[
              ['Builder', visit.builder?.name],
              ['Project', visit.project?.name],
              ['Property Type', c.propertyType ? titleCase(c.propertyType) : null],
              ['Configuration', c.configuration],
              ['Unit', visit.unit?.unitNumber],
            ]} />
          </Section>

          <Section title="3 · Visit Information">
            <Info rows={[
              ['Visit Date', dateOnly(visit.scheduledAt)],
              ['Visit Time', timeOnly(visit.scheduledAt)],
              ['Visit Type', titleCase(visit.visitType || 'first_visit')],
              ['Meeting Point', visit.meetingPoint],
              ['Assigned Employee', visit.assignedTo?.name],
              ['Status', STATUS_META[visit.status]?.label || titleCase(visit.status)],
              ['Checked In', visit.checkIn?.at ? `${timeOnly(visit.checkIn.at)}${visit.checkIn.location?.address ? ` · ${visit.checkIn.location.address}` : ''}` : null],
              ['Checked Out', visit.checkOut?.at ? timeOnly(visit.checkOut.at) : null],
              ['Duration', visit.durationMinutes ? `${visit.durationMinutes} min` : null],
            ]} />
          </Section>

          <Section title="4 · Visit Outcome">
            {visit.status === 'conducted' || visit.feedback || visit.interestLevel ? (
              <Info rows={[
                ['Interest Level', visit.interestLevel ? titleCase(visit.interestLevel) : null],
                ['Feedback', visit.feedback],
                ['Next Action', visit.nextAction],
                ['Remarks', visit.remarks],
              ]} />
            ) : (
              <p className="text-xs italic text-slate-400">Not captured yet. Use "Mark Completed" to record the outcome.</p>
            )}
          </Section>

          <Section title="5 · Visit Timeline">
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

          <Section title="6 · Attachments">
            {(visit.photos || []).length === 0 && !visit.checkIn?.photo ? (
              <p className="text-xs italic text-slate-400">No photos or documents uploaded.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {visit.checkIn?.photo && <a href={visit.checkIn.photo} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">Check-in photo</a>}
                {(visit.photos || []).map((p, i) => <a key={i} href={p} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">Photo {i + 1}</a>)}
              </div>
            )}
          </Section>
        </div>

        {/* Footer actions */}
        {editable && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3">
            <Button size="sm" variant="secondary" onClick={onReschedule}>Reschedule</Button>
            {canComplete && <Button size="sm" variant="success" onClick={onComplete}>Mark Completed</Button>}
          </div>
        )}
      </div>

      {checkingOut && <CheckOutModal visit={visit} onClose={() => setCheckingOut(false)} onDone={() => { setCheckingOut(false); onClose(); onDone() }} />}
    </div>
  )
}

function QuickBtn({ icon, label, onClick, accent = 'slate' }) {
  const cls = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    amber: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
  }[accent]
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[11px] font-semibold transition ${cls}`}>
      <span className="text-lg">{icon}</span> {label}
    </button>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</h4>
      {children}
    </div>
  )
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
