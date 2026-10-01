import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { followupsApi, usersApi, customersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, titleCase } from '../../lib/format.js'
import { PageHeader, StatCard, Button, Input, Select, Textarea, Table, StatusBadge, Modal, Loader, ErrorState } from '../../components/ui.jsx'

const OUTCOMES = ['interested', 'follow_up_required', 'site_visit_scheduled', 'booking_discussion', 'booked', 'not_interested', 'no_response']
const STATUSES = ['scheduled', 'pending', 'completed', 'missed', 'rescheduled', 'cancelled', 'closed']
const isLeadType = (r) => (r.customer?.status === 'booked' ? 'Customer' : 'Lead')
const sameDay = (a, b) => { const d = new Date(a); return d.toDateString() === b.toDateString() }

export default function SubAdminFollowUpsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [date, setDate] = useState('')
  const [status, setStatus] = useState('all')
  const [exec, setExec] = useState('all')
  const [type, setType] = useState('all')
  const [detail, setDetail] = useState(null)
  const [action, setAction] = useState(null) // { kind, followup }
  const [adding, setAdding] = useState(false)

  const { data, loading, error, refetch } = useFetch(useCallback(() => followupsApi.list({ limit: 500 }), []))
  const { data: execs } = useFetch(useCallback(() => usersApi.list({ role: 'sales_executive', status: 'active', limit: 200 }), []))

  const rows = data || []
  const now = new Date()
  const kpis = useMemo(() => ({
    today: rows.filter((r) => r.status === 'scheduled' && sameDay(r.scheduledAt, now)).length,
    pending: rows.filter((r) => r.status === 'scheduled' || r.status === 'pending').length,
    completed: rows.filter((r) => r.status === 'completed').length,
    missed: rows.filter((r) => r.status === 'missed').length,
    rescheduled: rows.filter((r) => r.status === 'rescheduled').length,
    overdue: rows.filter((r) => r.status === 'scheduled' && new Date(r.scheduledAt) < now).length,
  }), [rows]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    let out = rows
    if (status !== 'all') out = out.filter((r) => r.status === status)
    if (exec !== 'all') out = out.filter((r) => r.assignedTo?._id === exec)
    if (type !== 'all') out = out.filter((r) => isLeadType(r).toLowerCase() === type)
    if (date) out = out.filter((r) => sameDay(r.scheduledAt, new Date(date)))
    if (search.trim()) { const q = search.toLowerCase(); out = out.filter((r) => [r.customer?.name, r.customer?.mobile, r.assignedTo?.name].some((v) => (v || '').toLowerCase().includes(q))) }
    return out
  }, [rows, status, exec, type, date, search])

  const refresh = () => { setAction(null); setDetail(null); refetch() }

  const columns = [
    { key: 'id', header: 'Follow-up ID', render: (r) => <span className="font-mono text-xs text-slate-500">#{r._id.slice(-6).toUpperCase()}</span> },
    { key: 'name', header: 'Lead / Customer', render: (r) => (
      <div className="flex items-center gap-2">
        <span className="font-medium text-slate-800">{r.customer?.name || '—'}</span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${isLeadType(r) === 'Customer' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{isLeadType(r)}</span>
      </div>
    ) },
    { key: 'contact', header: 'Contact', render: (r) => r.customer?.mobile || '—' },
    { key: 'exec', header: 'Assigned Executive', render: (r) => r.assignedTo?.name || '—' },
    { key: 'time', header: 'Date & Time', render: (r) => formatDate(r.scheduledAt, true) },
    { key: 'type', header: 'Type', render: (r) => titleCase(r.type || 'call') },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'outcome', header: 'Outcome', render: (r) => r.outcomeNotes ? <span className="text-xs text-slate-600">{r.outcomeNotes}</span> : '—' },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={() => setDetail(r)}>View</Button>
        {['scheduled', 'pending'].includes(r.status) && <Button size="sm" variant="success" onClick={() => setAction({ kind: 'complete', followup: r })}>Complete</Button>}
        {['scheduled', 'pending'].includes(r.status) && <Button size="sm" variant="secondary" onClick={() => setAction({ kind: 'reschedule', followup: r })}>Reschedule</Button>}
      </div>
    ) },
  ]

  return (
    <div>
      <PageHeader title="Follow-up Management" subtitle="Track, assign and complete branch follow-ups." actions={<Button onClick={() => setAdding(true)}>+ Add Follow-up</Button>} />

      {/* KPI cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Today's Follow-ups" value={kpis.today} />
        <StatCard label="Pending" value={kpis.pending} />
        <StatCard label="Completed" value={kpis.completed} />
        <StatCard label="Missed" value={kpis.missed} />
        <StatCard label="Rescheduled" value={kpis.rescheduled} />
        <StatCard label="Overdue" value={kpis.overdue} />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-44"><Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="w-44"><Select label="Employee" value={exec} onChange={(e) => setExec(e.target.value)}><option value="all">All</option>{(execs || []).map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}</Select></div>
        <div className="w-40"><Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option>{STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></div>
        <div className="w-36"><Select label="Lead / Customer" value={type} onChange={(e) => setType(e.target.value)}><option value="all">All</option><option value="lead">Lead</option><option value="customer">Customer</option></Select></div>
        <div className="w-48"><Input label="Search" placeholder="Name, mobile, executive" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <Table columns={columns} rows={filtered} empty="No follow-ups match your filters." onRowClick={setDetail} />
      )}

      {adding && <AddFollowUpModal execs={execs || []} onClose={() => setAdding(false)} onDone={() => { setAdding(false); refetch() }} />}
      {detail && <FollowUpDetail followup={detail} all={rows} execs={execs || []} navigate={navigate} onAction={(kind) => setAction({ kind, followup: detail })} onClose={() => setDetail(null)} onChanged={refresh} />}
      {action?.kind === 'complete' && <CompleteModal followup={action.followup} onClose={() => setAction(null)} onDone={refresh} />}
      {action?.kind === 'reschedule' && <RescheduleModal followup={action.followup} onClose={() => setAction(null)} onDone={refresh} />}
      {action?.kind === 'reassign' && <ReassignModal followup={action.followup} execs={execs || []} onClose={() => setAction(null)} onDone={refresh} />}
    </div>
  )
}

function Field({ label, value }) { return <div><dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-0.5 text-sm text-slate-800">{value || '—'}</dd></div> }

function FollowUpDetail({ followup: f, all, navigate, onAction, onClose, onChanged }) {
  const toast = useToast()
  const history = all.filter((x) => String(x.customer?._id || x.customer) === String(f.customer?._id || f.customer) && x._id !== f._id)
  async function cancel() {
    const r = window.prompt('Cancellation reason (optional):')
    if (r == null) return
    try { await followupsApi.cancel(f._id, r); toast.success('Follow-up cancelled'); onChanged() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }
  return (
    <Modal open onClose={onClose} wide title={`Follow-up · #${f._id.slice(-6).toUpperCase()}`} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Field label="Lead / Customer" value={f.customer?.name} />
        <Field label="Contact" value={f.customer?.mobile} />
        <Field label="Type" value={<span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{isLeadType(f)}</span>} />
        <Field label="Assigned Executive" value={f.assignedTo?.name} />
        <Field label="Date & Time" value={formatDate(f.scheduledAt, true)} />
        <Field label="Follow-up Type" value={titleCase(f.type || 'call')} />
        <Field label="Status" value={<StatusBadge status={f.status} />} />
        <Field label="Outcome" value={f.outcomeNotes} />
        <Field label="Notes" value={f.notes || f.purpose} />
      </dl>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {['scheduled', 'pending'].includes(f.status) && <Button size="sm" variant="success" onClick={() => onAction('complete')}>Complete</Button>}
        {['scheduled', 'pending'].includes(f.status) && <Button size="sm" variant="secondary" onClick={() => onAction('reschedule')}>Reschedule</Button>}
        <Button size="sm" variant="secondary" onClick={() => onAction('reassign')}>Reassign</Button>
        {['scheduled', 'pending'].includes(f.status) && <Button size="sm" variant="danger" onClick={cancel}>Cancel</Button>}
        {f.customer?._id && <Button size="sm" variant="ghost" onClick={() => navigate(`/sub-admin/customers/${f.customer._id}`)}>Open Customer</Button>}
      </div>

      <div className="mt-5">
        <h4 className="mb-2 text-sm font-semibold text-slate-900">Previous Follow-up History</h4>
        <Table
          columns={[
            { key: 'time', header: 'Date & Time', render: (r) => formatDate(r.scheduledAt, true) },
            { key: 'type', header: 'Type', render: (r) => titleCase(r.type || 'call') },
            { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'outcome', header: 'Outcome', render: (r) => r.outcomeNotes || '—' },
          ]}
          rows={history}
          empty="No prior follow-ups for this customer."
        />
      </div>
    </Modal>
  )
}

function CompleteModal({ followup, onClose, onDone }) {
  const toast = useToast()
  const [outcome, setOutcome] = useState('interested')
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    try { await followupsApi.complete(followup._id, { outcome, remarks }); toast.success('Follow-up completed'); onDone() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
    finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="Complete Follow-up" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>Save</Button></>}>
      <div className="space-y-4">
        <Select label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)}>{OUTCOMES.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}</Select>
        <Textarea label="Remarks / Discussion Summary" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </div>
    </Modal>
  )
}

function RescheduleModal({ followup, onClose, onDone }) {
  const toast = useToast()
  const [scheduledAt, setScheduledAt] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    try { await followupsApi.reschedule(followup._id, { scheduledAt, reason }); toast.success('Follow-up rescheduled'); onDone() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
    finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="Reschedule Follow-up" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy || !scheduledAt}>Reschedule</Button></>}>
      <div className="space-y-4">
        <Input label="New Date & Time" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </Modal>
  )
}

function ReassignModal({ followup, execs, onClose, onDone }) {
  const toast = useToast()
  const [assignedTo, setAssignedTo] = useState('')
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    try { await followupsApi.reassign(followup._id, assignedTo); toast.success('Follow-up reassigned'); onDone() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
    finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="Reassign Follow-up" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy || !assignedTo}>Reassign</Button></>}>
      <Select label="New Executive" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
        <option value="">Select…</option>
        {execs.filter((e) => e._id !== followup.assignedTo?._id).map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
      </Select>
    </Modal>
  )
}

function AddFollowUpModal({ execs, onClose, onDone }) {
  const toast = useToast()
  const { data: customers } = useFetch(useCallback(() => customersApi.list({ limit: 300 }), []))
  const [form, setForm] = useState({ customer: '', scheduledAt: '', type: 'call', notes: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  async function save() {
    setBusy(true)
    try { await followupsApi.create({ ...form, purpose: form.notes }); toast.success('Follow-up scheduled'); onDone() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
    finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="Add Follow-up" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy || !form.customer || !form.scheduledAt}>Schedule</Button></>}>
      <div className="space-y-4">
        <Select label="Lead / Customer" value={form.customer} onChange={set('customer')}>
          <option value="">Select…</option>
          {(customers || []).map((c) => <option key={c._id} value={c._id}>{c.name} · {c.mobile}</option>)}
        </Select>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Date & Time" type="datetime-local" value={form.scheduledAt} onChange={set('scheduledAt')} />
          <Select label="Type" value={form.type} onChange={set('type')}>
            {['call', 'whatsapp', 'email', 'meeting', 'visit', 'callback'].map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
          </Select>
        </div>
        <Textarea label="Notes" value={form.notes} onChange={set('notes')} />
      </div>
    </Modal>
  )
}
