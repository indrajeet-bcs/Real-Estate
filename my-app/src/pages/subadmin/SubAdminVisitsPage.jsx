import { useState, useCallback, useMemo } from 'react'
import { visitsApi, customersApi, projectsApi, usersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, titleCase } from '../../lib/format.js'
import { PageHeader, StatCard, Button, Input, Select, Textarea, Table, StatusBadge, Modal, Loader, ErrorState } from '../../components/ui.jsx'

const OUTCOMES = ['interested', 'follow_up_required', 'booking_discussion', 'booked', 'not_interested', 'site_closed', 'no_response']
const STATUSES = ['scheduled', 'confirmed', 'in_progress', 'conducted', 'missed', 'cancelled', 'rescheduled']
const statusLabel = (s) => (s === 'conducted' ? 'Completed' : titleCase(s))
const visitType = (v) => (v.customer?.status === 'booked' ? 'Customer' : 'Lead')
const sameDay = (a, b) => { const d = new Date(a); return d.toDateString() === b.toDateString() }

export default function SubAdminVisitsPage() {
  const [search, setSearch] = useState('')
  const [date, setDate] = useState('')
  const [status, setStatus] = useState('all')
  const [exec, setExec] = useState('all')
  const [project, setProject] = useState('all')
  const [type, setType] = useState('all')
  const [scheduling, setScheduling] = useState(false)
  const [detail, setDetail] = useState(null)

  const { data, loading, error, refetch } = useFetch(useCallback(() => visitsApi.list({ limit: 500 }), []))
  const { data: execs } = useFetch(useCallback(() => usersApi.list({ role: 'sales_executive', status: 'active', limit: 200 }), []))
  const { data: projects } = useFetch(useCallback(() => projectsApi.list({ limit: 200 }), []))

  const rows = data || []
  const now = new Date()

  const kpis = useMemo(() => ({
    scheduledToday: rows.filter((r) => r.status === 'scheduled' && sameDay(r.scheduledAt, now)).length,
    completed: rows.filter((r) => r.status === 'conducted').length,
    inProgress: rows.filter((r) => r.status === 'in_progress').length,
    missed: rows.filter((r) => r.status === 'missed').length,
    rescheduled: rows.filter((r) => r.status === 'rescheduled').length,
    cancelled: rows.filter((r) => r.status === 'cancelled').length,
  }), [rows]) // eslint-disable-line react-hooks/exhaustive-deps

  const projectOptions = useMemo(() => {
    const m = new Map(); rows.forEach((r) => r.project?._id && m.set(r.project._id, r.project.name)); return [...m.entries()]
  }, [rows])

  const filtered = useMemo(() => {
    let out = rows
    if (status !== 'all') out = out.filter((r) => r.status === status)
    if (exec !== 'all') out = out.filter((r) => r.assignedTo?._id === exec)
    if (project !== 'all') out = out.filter((r) => r.project?._id === project)
    if (type !== 'all') out = out.filter((r) => visitType(r).toLowerCase() === type)
    if (date) out = out.filter((r) => sameDay(r.scheduledAt, new Date(date)))
    if (search.trim()) { const q = search.toLowerCase(); out = out.filter((r) => [r.customer?.name, r.project?.name, r.assignedTo?.name].some((v) => (v || '').toLowerCase().includes(q))) }
    return out
  }, [rows, status, exec, project, type, date, search])

  const columns = [
    { key: 'id', header: 'Visit ID', render: (r) => <span className="font-mono text-xs text-slate-500">#{r._id.slice(-6).toUpperCase()}</span> },
    { key: 'customer', header: 'Customer', render: (r) => (
      <div className="flex items-center gap-2">
        <span className="font-medium text-slate-800">{r.customer?.name || '—'}</span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${visitType(r) === 'Customer' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{visitType(r)}</span>
      </div>
    ) },
    { key: 'project', header: 'Project', render: (r) => r.project?.name || '—' },
    { key: 'time', header: 'Visit Date & Time', render: (r) => formatDate(r.scheduledAt, true) },
    { key: 'exec', header: 'Executive', render: (r) => r.assignedTo?.name || '—' },
    { key: 'by', header: 'Assigned By', render: (r) => r.createdBy?.name || '—' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'outcome', header: 'Outcome', render: (r) => r.outcome ? titleCase(r.outcome) : '—' },
    { key: 'actions', header: '', render: (r) => <Button size="sm" variant="ghost" onClick={() => setDetail(r)}>View</Button> },
  ]

  return (
    <div>
      <PageHeader title="Site Visits" subtitle="Schedule, track and record branch site visits." actions={<Button onClick={() => setScheduling(true)}>+ Schedule Visit</Button>} />

      {/* KPI cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Scheduled Today" value={kpis.scheduledToday} />
        <StatCard label="Completed" value={kpis.completed} />
        <StatCard label="In Progress" value={kpis.inProgress} />
        <StatCard label="Missed" value={kpis.missed} />
        <StatCard label="Rescheduled" value={kpis.rescheduled} />
        <StatCard label="Cancelled" value={kpis.cancelled} />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-44"><Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="w-40"><Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option>{STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</Select></div>
        <div className="w-44"><Select label="Executive" value={exec} onChange={(e) => setExec(e.target.value)}><option value="all">All</option>{(execs || []).map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}</Select></div>
        <div className="w-48"><Select label="Project" value={project} onChange={(e) => setProject(e.target.value)}><option value="all">All</option>{projectOptions.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</Select></div>
        <div className="w-36"><Select label="Visit Type" value={type} onChange={(e) => setType(e.target.value)}><option value="all">All</option><option value="lead">Lead</option><option value="customer">Customer</option></Select></div>
        <div className="w-48"><Input label="Search" placeholder="Customer, project, executive" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <Table columns={columns} rows={filtered} empty="No site visits match your filters." onRowClick={setDetail} />
      )}

      {scheduling && <ScheduleModal execs={execs || []} onClose={() => setScheduling(false)} onDone={() => { setScheduling(false); refetch() }} />}
      {detail && <VisitDetail visit={detail} execs={execs || []} onClose={() => setDetail(null)} onChanged={() => { setDetail(null); refetch() }} />}
    </div>
  )
}

function Field({ label, value }) { return <div><dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-0.5 text-sm text-slate-800">{value || '—'}</dd></div> }

function VisitDetail({ visit, execs, onClose, onChanged }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState(visit.outcome || 'interested')
  const [notes, setNotes] = useState(visit.remarks || '')
  const [reassignTo, setReassignTo] = useState('')
  const [rescheduleAt, setRescheduleAt] = useState('')
  const done = (msg) => { toast.success(msg); onChanged() }
  const run = async (fn, msg) => { setBusy(true); try { await fn(); done(msg) } catch (err) { toast.error(err.response?.data?.message || 'Failed') } finally { setBusy(false) } }

  return (
    <Modal open onClose={onClose} wide title={`Site Visit · #${visit._id.slice(-6).toUpperCase()}`} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Field label="Customer" value={visit.customer?.name} />
        <Field label="Lead / Customer" value={visitType(visit)} />
        <Field label="Customer Status" value={visit.customer?.status ? <StatusBadge status={visit.customer.status} /> : '—'} />
        <Field label="Project" value={visit.project?.name} />
        <Field label="Assigned Executive" value={visit.assignedTo?.name} />
        <Field label="Assigned By" value={visit.createdBy?.name} />
        <Field label="Scheduled Date & Time" value={formatDate(visit.scheduledAt, true)} />
        <Field label="Visit Status" value={<StatusBadge status={visit.status} />} />
        <Field label="Visit Outcome" value={visit.outcome ? titleCase(visit.outcome) : '—'} />
        <Field label="Check-In Time" value="—" />
        <Field label="Check-Out Time" value="—" />
        <Field label="Visit Location" value="—" />
      </dl>
      {visit.remarks && <p className="mt-4 text-sm text-slate-600"><span className="font-medium text-slate-800">Notes:</span> {visit.remarks}</p>}

      {/* Actions */}
      <div className="mt-6 space-y-4 border-t border-slate-100 pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Select label="Update Status" value={visit.status} onChange={(e) => run(() => visitsApi.setStatus(visit._id, e.target.value), 'Status updated')} disabled={busy}>
              {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Select label="Reassign Executive" value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
                <option value="">Select…</option>
                {execs.filter((e) => e._id !== visit.assignedTo?._id).map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
              </Select>
            </div>
            <Button variant="secondary" disabled={busy || !reassignTo} onClick={() => run(() => visitsApi.reassign(visit._id, reassignTo), 'Visit reassigned')}>Reassign</Button>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1"><Input label="Reschedule To" type="datetime-local" value={rescheduleAt} onChange={(e) => setRescheduleAt(e.target.value)} /></div>
            <Button variant="secondary" disabled={busy || !rescheduleAt} onClick={() => run(() => visitsApi.reschedule(visit._id, { scheduledAt: rescheduleAt, reason: 'Rescheduled by sub-admin' }), 'Visit rescheduled')}>Reschedule</Button>
          </div>
          <div className="flex items-end">
            <Button variant="danger" disabled={busy} onClick={() => { const r = window.prompt('Cancellation reason?'); if (r) run(() => visitsApi.cancel(visit._id, { reason: r }), 'Visit cancelled') }}>Cancel Visit</Button>
          </div>
        </div>

        {/* Record outcome + notes */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Record Outcome</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              {OUTCOMES.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}
            </Select>
            <div className="sm:col-span-2"><Textarea label="Visit Notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </div>
          <div className="mt-3">
            <Button disabled={busy} onClick={() => run(() => visitsApi.conduct(visit._id, { outcome, remarks: notes }), 'Outcome recorded')}>Save Outcome &amp; Notes</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function ScheduleModal({ execs, onClose, onDone }) {
  const toast = useToast()
  const { data: customers } = useFetch(useCallback(() => customersApi.list({ limit: 200 }), []))
  const { data: projects } = useFetch(useCallback(() => projectsApi.list({ limit: 200 }), []))
  const [form, setForm] = useState({ customer: '', project: '', scheduledAt: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    try { await visitsApi.create(form); toast.success('Visit scheduled'); onDone() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
    finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title="Schedule Site Visit" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy || !form.customer || !form.project || !form.scheduledAt}>Schedule</Button></>}>
      <div className="space-y-4">
        <Select label="Customer" value={form.customer} onChange={set('customer')}>
          <option value="">Select…</option>
          {(customers || []).map((c) => <option key={c._id} value={c._id}>{c.name} · {c.mobile}</option>)}
        </Select>
        <Select label="Project" value={form.project} onChange={set('project')}>
          <option value="">Select…</option>
          {(projects || []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </Select>
        <Input label="Date & Time" type="datetime-local" value={form.scheduledAt} onChange={set('scheduledAt')} />
      </div>
    </Modal>
  )
}
