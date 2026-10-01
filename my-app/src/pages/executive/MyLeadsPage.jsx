import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { customersApi, projectsApi, followupsApi, visitsApi, leadTransfersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, titleCase } from '../../lib/format.js'
import { LEAD_STAGES, LEAD_STAGE_LABELS } from '../../lib/constants.js'
import {
  PageHeader, Card, StatCard, Button, Input, Select, Table, Modal, Loader, ErrorState,
} from '../../components/ui.jsx'

// Compact icon action buttons (match the branches/inventory row-action style).
const ICONS = {
  eye: (<><path d="M2.036 12.322a1.012 1.012 0 0 1 0-.644C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.01 9.963 7.178.07.207.07.43 0 .644C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.01-9.963-7.178Z" /><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></>),
  phone: (<path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />),
  kebab: (<><circle cx="12" cy="5.5" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="12" cy="18.5" r="1.4" /></>),
}
function IconBtn({ title, onClick, icon }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">{icon}</svg>
    </button>
  )
}

const inr = (n) => {
  const v = Number(n) || 0
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`
  return v ? `₹${v.toLocaleString('en-IN')}` : '—'
}

const PRIORITY_CLS = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
}
const stageLabel = (s) => LEAD_STAGE_LABELS[s] || titleCase(s)

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function MyLeadsPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [source, setSource] = useState('all')
  const [project, setProject] = useState('all')
  const [priority, setPriority] = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const [sort, setSort] = useState('recently_assigned')

  // modal targets
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [followUpFor, setFollowUpFor] = useState(null)
  const [visitFor, setVisitFor] = useState(null)
  const [convertFor, setConvertFor] = useState(null)
  const [transferFor, setTransferFor] = useState(null)
  const [sheetFor, setSheetFor] = useState(null)

  const { data, loading, error, refetch } = useFetch(useCallback(() => customersApi.list({ limit: 500 }), []))
  const { data: projects } = useFetch(useCallback(() => projectsApi.list({ limit: 200 }), []))
  const { data: requests, refetch: refetchReq } = useFetch(useCallback(() => leadTransfersApi.list({ status: 'pending', limit: 200 }), []))

  const rows = data || []
  const projectName = useMemo(() => {
    const m = {}
    ;(projects || []).forEach((p) => { m[String(p._id)] = p.name })
    return m
  }, [projects])
  const leadProject = (r) => {
    const first = r.interestedProjects?.[0]
    if (!first) return null
    const id = first.project?._id || first.project
    return first.project?.name || projectName[String(id)] || null
  }
  const pendingByCustomer = useMemo(() => {
    const map = {}
    ;(requests || []).forEach((r) => { const cid = r.customer?._id || r.customer; if (cid) map[String(cid)] = true })
    return map
  }, [requests])

  // KPI summary cards (spec §Top Summary Cards)
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999)
  const kpis = {
    total: rows.length,
    new: rows.filter((r) => r.status === 'new').length,
    dueToday: rows.filter((r) => {
      if (!r.nextFollowUp) return false
      const d = new Date(r.nextFollowUp)
      return d >= todayStart && d <= todayEnd
    }).length,
    qualified: rows.filter((r) => r.status === 'qualified').length,
  }

  const sourceOptions = useMemo(() => [...new Set(rows.map((r) => r.source).filter(Boolean))], [rows])

  const filtered = useMemo(() => {
    let out = rows
    if (status !== 'all') out = out.filter((r) => r.status === status)
    if (source !== 'all') out = out.filter((r) => r.source === source)
    if (priority !== 'all') out = out.filter((r) => (r.priority || 'medium') === priority)
    if (project !== 'all') out = out.filter((r) => (r.interestedProjects || []).some((i) => String(i.project?._id || i.project) === project))
    if (dateRange !== 'all') {
      out = out.filter((r) => {
        const d = r.assignedAt ? new Date(r.assignedAt) : new Date(r.createdAt)
        if (dateRange === 'today') return d >= todayStart && d <= todayEnd
        if (dateRange === 'week') { const w = new Date(todayStart); w.setDate(w.getDate() - 7); return d >= w }
        if (dateRange === 'month') { const m = new Date(todayStart); m.setDate(m.getDate() - 30); return d >= m }
        return true
      })
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter((r) => [r.name, r.mobile].some((v) => (v || '').toLowerCase().includes(q)))
    }
    const sorted = [...out]
    if (sort === 'recently_assigned') sorted.sort((a, b) => new Date(b.assignedAt || b.createdAt) - new Date(a.assignedAt || a.createdAt))
    else if (sort === 'latest_followup') sorted.sort((a, b) => {
      const av = a.nextFollowUp ? new Date(a.nextFollowUp).getTime() : Infinity
      const bv = b.nextFollowUp ? new Date(b.nextFollowUp).getTime() : Infinity
      return av - bv
    })
    else if (sort === 'name') sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    return sorted
  }, [rows, status, source, priority, project, dateRange, search, sort]) // eslint-disable-line

  async function quickStage(r, next) {
    try { await customersApi.changeStatus(r._id, { status: next }); toast.success('Stage updated'); refetch() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }

  function call(r) {
    // Best-effort dialer; on desktop this is a no-op beyond the toast.
    window.location.href = `tel:${(r.mobile || '').replace(/\s/g, '')}`
  }

  const refetchAll = () => { refetch(); refetchReq() }

  const columns = [
    { key: 'name', header: 'Lead', render: (r) => (
      <div className="min-w-[9rem]">
        <div className="font-medium text-slate-900">{r.name}</div>
        <div className="text-xs text-slate-500">{r.mobile}</div>
        {pendingByCustomer[String(r._id)] && <span className="mt-0.5 inline-block rounded bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700">Transfer pending</span>}
      </div>
    ) },
    { key: 'budget', header: 'Budget', render: (r) => inr(r.budgetMax || r.budgetMin) },
    { key: 'config', header: 'Configuration', render: (r) => r.configuration || '—' },
    { key: 'project', header: 'Project Interest', render: (r) => leadProject(r) || '—' },
    { key: 'source', header: 'Source', render: (r) => titleCase(r.source || '—') },
    { key: 'stage', header: 'Current Stage', render: (r) => (
      <select
        value={r.status}
        onChange={(e) => { e.stopPropagation(); quickStage(r, e.target.value) }}
        onClick={(e) => e.stopPropagation()}
        className="rounded border border-slate-300 px-1.5 py-1 text-xs"
      >
        {LEAD_STAGES.map((s) => <option key={s} value={s}>{stageLabel(s)}</option>)}
      </select>
    ) },
    { key: 'next', header: 'Next Follow-up', render: (r) => {
      if (!r.nextFollowUp) return <span className="text-slate-400">—</span>
      const d = new Date(r.nextFollowUp)
      const overdue = d < todayStart
      const today = d >= todayStart && d <= todayEnd
      return <span className={overdue ? 'text-rose-600' : today ? 'text-blue-600 font-medium' : 'text-slate-700'}>{formatDate(r.nextFollowUp, true)}</span>
    } },
    { key: 'assigned', header: 'Assigned', render: (r) => formatDate(r.assignedAt || r.createdAt) },
    { key: 'priority', header: 'Priority', render: (r) => <span className={`rounded border px-2 py-0.5 text-xs font-medium ${PRIORITY_CLS[r.priority || 'medium']}`}>{titleCase(r.priority || 'medium')}</span> },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex items-center justify-end gap-1.5">
        <IconBtn title="View" icon={ICONS.eye} onClick={(e) => { e.stopPropagation(); navigate(`/executive/leads/${r._id}`) }} />
        <IconBtn title="Call" icon={ICONS.phone} onClick={(e) => { e.stopPropagation(); call(r) }} />
        <IconBtn title="Actions" icon={ICONS.kebab} onClick={(e) => { e.stopPropagation(); setSheetFor(r) }} />
      </div>
    ) },
  ]

  return (
    <div>
      <PageHeader
        title="My Leads"
        subtitle="Manage your assigned leads, track progress, schedule follow-ups, and convert qualified leads into customers."
        actions={<Button onClick={() => setAdding(true)}>+ Add Lead</Button>}
      />

      {/* Top Summary Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Leads" value={kpis.total} />
        <StatCard label="New Leads" value={kpis.new} />
        <StatCard label="Follow-ups Due Today" value={kpis.dueToday} />
        <StatCard label="Qualified Leads" value={kpis.qualified} />
      </div>

      {/* Filters & Search */}
      <Card className="mb-4 p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-7">
          <div className="col-span-2 md:col-span-1">
            <Input label="Search" placeholder="Name or mobile" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select label="Lead Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All</option>
            {LEAD_STAGES.map((s) => <option key={s} value={s}>{stageLabel(s)}</option>)}
          </Select>
          <Select label="Source" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">All</option>
            {sourceOptions.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </Select>
          <Select label="Project Interest" value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="all">All</option>
            {(projects || []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </Select>
          <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="all">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
          <Select label="Date Range" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
            <option value="all">All time</option>
            <option value="today">Assigned today</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
          </Select>
          <Select label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="recently_assigned">Recently Assigned</option>
            <option value="latest_followup">Next Follow-up</option>
            <option value="name">Name (A–Z)</option>
          </Select>
        </div>
      </Card>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <Table
          columns={columns}
          rows={filtered}
          empty="No leads match your filters."
          onRowClick={(r) => navigate(`/executive/leads/${r._id}`)}
        />
      )}

      {/* Modals */}
      {adding && (
        <LeadFormModal
          projects={projects || []}
          onClose={() => setAdding(false)}
          onSaved={(created, alsoFollowUp) => {
            setAdding(false); refetch()
            if (alsoFollowUp && created) setFollowUpFor(created)
          }}
        />
      )}
      {editing && (
        <LeadFormModal
          lead={editing}
          projects={projects || []}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refetch() }}
        />
      )}
      {followUpFor && <ScheduleFollowUpModal lead={followUpFor} projects={projects || []} onClose={() => setFollowUpFor(null)} onDone={() => { setFollowUpFor(null); refetch() }} />}
      {visitFor && <ScheduleVisitModal lead={visitFor} projects={projects || []} onClose={() => setVisitFor(null)} onDone={() => { setVisitFor(null); refetch() }} />}
      {convertFor && <ConvertModal lead={convertFor} onClose={() => setConvertFor(null)} onDone={() => { setConvertFor(null); refetch() }} />}
      {transferFor && <RequestTransferModal lead={transferFor} onClose={() => setTransferFor(null)} onDone={() => { setTransferFor(null); refetchAll() }} />}
      {sheetFor && (
        <ActionSheet
          lead={sheetFor}
          hasPendingTransfer={pendingByCustomer[String(sheetFor._id)]}
          onClose={() => setSheetFor(null)}
          onView={() => { const r = sheetFor; setSheetFor(null); navigate(`/executive/leads/${r._id}`) }}
          onEdit={() => { setEditing(sheetFor); setSheetFor(null) }}
          onFollowUp={() => { setFollowUpFor(sheetFor); setSheetFor(null) }}
          onVisit={() => { setVisitFor(sheetFor); setSheetFor(null) }}
          onConvert={() => { setConvertFor(sheetFor); setSheetFor(null) }}
          onTransfer={() => { setTransferFor(sheetFor); setSheetFor(null) }}
        />
      )}
    </div>
  )
}

// ─── Per-row action sheet (spec §Leads Table · Actions) ─────────────────────────
function ActionSheet({ lead, hasPendingTransfer, onClose, onView, onEdit, onFollowUp, onVisit, onConvert, onTransfer }) {
  const canConvert = lead.status === 'qualified'
  const actions = [
    { label: 'View Details', icon: '👤', onClick: onView },
    { label: 'Edit Lead', icon: '✏️', onClick: onEdit },
    { label: 'Schedule Follow-up', icon: '↻', onClick: onFollowUp },
    { label: 'Schedule Site Visit', icon: '⌖', onClick: onVisit },
    { label: canConvert ? 'Convert to Customer' : 'Convert to Customer (qualified only)', icon: '✓', onClick: onConvert, disabled: !canConvert },
    { label: hasPendingTransfer ? 'Transfer request pending' : 'Request Lead Transfer', icon: '⇄', onClick: onTransfer, disabled: hasPendingTransfer },
  ]
  return (
    <Modal open onClose={onClose} title={lead.name}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <p className="mb-3 text-xs text-slate-500">{lead.mobile} · {stageLabel(lead.status)}</p>
      <div className="grid grid-cols-1 gap-2">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            disabled={a.disabled}
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-medium transition ${
              a.disabled ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400' : 'border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            <span className="text-base">{a.icon}</span> {a.label}
          </button>
        ))}
      </div>
    </Modal>
  )
}

// ─── Add / Edit Lead (spec §Add New Lead) ───────────────────────────────────────
const PROPERTY_TYPES = ['apartment', 'villa', 'plot', 'commercial', 'penthouse', 'row_house']
const CONFIGS = ['1 RK', '1 BHK', '2 BHK', '3 BHK', '4 BHK', '4+ BHK', 'Plot', 'Office']
const SOURCES = ['walk_in', 'website', 'referral', 'social_media', 'call', 'portal', 'other']

function LeadFormModal({ lead, projects, onClose, onSaved }) {
  const toast = useToast()
  const isEdit = !!lead
  const [form, setForm] = useState({
    name: lead?.name || '',
    mobile: lead?.mobile || '',
    email: lead?.email || '',
    budgetMax: lead?.budgetMax || '',
    propertyType: lead?.propertyType || '',
    configuration: lead?.configuration || '',
    preferredLocation: lead?.preferredLocation || '',
    source: lead?.source || 'walk_in',
    priority: lead?.priority || 'medium',
    interestedProject: lead?.interestedProjects?.[0]?.project?._id || lead?.interestedProjects?.[0]?.project || '',
    note: '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const valid = form.name.trim().length >= 2 && form.mobile.trim().length >= 7

  async function submit(alsoFollowUp) {
    if (!valid) { toast.error('Name and a valid mobile are required'); return }
    setBusy(true)
    try {
      const payload = {
        name: form.name,
        mobile: form.mobile,
        email: form.email || undefined,
        budgetMax: form.budgetMax ? Number(form.budgetMax) : undefined,
        propertyType: form.propertyType || undefined,
        configuration: form.configuration || undefined,
        preferredLocation: form.preferredLocation || undefined,
        source: form.source,
        priority: form.priority,
      }
      if (isEdit) {
        await customersApi.update(lead._id, payload)
        toast.success('Lead updated')
        onSaved(null, false)
      } else {
        const res = await customersApi.create({
          ...payload,
          interestedProject: form.interestedProject || undefined,
          note: form.note || undefined,
        })
        toast.success('Lead created')
        onSaved(res.data.data, alsoFollowUp)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} wide title={isEdit ? `Edit Lead — ${lead.name}` : 'Add New Lead'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          {!isEdit && <Button variant="secondary" onClick={() => submit(true)} disabled={busy || !valid}>Save &amp; Add Follow-up</Button>}
          <Button onClick={() => submit(false)} disabled={busy || !valid}>{isEdit ? 'Save Changes' : 'Save'}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Lead Name *" value={form.name} onChange={set('name')} />
        <Input label="Mobile Number *" value={form.mobile} onChange={set('mobile')} />
        <Input label="Email" type="email" value={form.email} onChange={set('email')} />
        <Input label="Budget (max ₹)" type="number" value={form.budgetMax} onChange={set('budgetMax')} />
        <Select label="Property Type" value={form.propertyType} onChange={set('propertyType')}>
          <option value="">Select…</option>
          {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
        </Select>
        <Select label="Configuration" value={form.configuration} onChange={set('configuration')}>
          <option value="">Select…</option>
          {CONFIGS.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Input label="Preferred Location" value={form.preferredLocation} onChange={set('preferredLocation')} />
        <Select label="Source" value={form.source} onChange={set('source')}>
          {SOURCES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </Select>
        <Select label="Project Interest" value={form.interestedProject} onChange={set('interestedProject')} disabled={isEdit}>
          <option value="">None</option>
          {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </Select>
        <Select label="Priority" value={form.priority} onChange={set('priority')}>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </Select>
        {!isEdit && (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
            <textarea rows={2} value={form.note} onChange={set('note')} placeholder="Initial notes about this lead…"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-slate-500">Duplicate mobile numbers are blocked automatically. {isEdit ? '' : 'The lead is assigned to you.'}</p>
    </Modal>
  )
}

// ─── Schedule Follow-up ─────────────────────────────────────────────────────────
const FU_TYPES = ['call', 'whatsapp', 'email', 'meeting', 'visit', 'callback', 'other']

export function ScheduleFollowUpModal({ lead, projects, onClose, onDone }) {
  const toast = useToast()
  const [type, setType] = useState('call')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [priority, setPriority] = useState(lead.priority || 'medium')
  const [projectId, setProjectId] = useState(lead.interestedProjects?.[0]?.project?._id || '')
  const [purpose, setPurpose] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!date || !time) { toast.error('Set date & time'); return }
    setBusy(true)
    try {
      await followupsApi.create({
        customer: lead._id,
        scheduledAt: new Date(`${date}T${time}`).toISOString(),
        type, priority, purpose, notes: purpose,
        project: projectId || undefined,
      })
      toast.success('Follow-up scheduled')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Schedule Follow-up — ${lead.name}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Schedule'}</Button></>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value)}>
            {FU_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
          </Select>
          <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
          </Select>
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <Select label="Project (optional)" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">None / General</option>
          {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </Select>
        <Input label="Purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Discuss pricing, share brochure" />
      </div>
    </Modal>
  )
}

// ─── Schedule Site Visit ────────────────────────────────────────────────────────
export function ScheduleVisitModal({ lead, projects, onClose, onDone }) {
  const toast = useToast()
  const [projectId, setProjectId] = useState(lead.interestedProjects?.[0]?.project?._id || '')
  const [scheduledAt, setScheduledAt] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!projectId || !scheduledAt) { toast.error('Select project, date & time'); return }
    setBusy(true)
    try {
      await visitsApi.create({ customer: lead._id, project: projectId, scheduledAt })
      toast.success('Site visit scheduled')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Schedule Site Visit — ${lead.name}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Schedule'}</Button></>}
    >
      <div className="space-y-4">
        <Select label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Select…</option>
          {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </Select>
        <Input label="Date & time" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
      </div>
    </Modal>
  )
}

// ─── Convert to Customer (spec §Convert to Customer) ────────────────────────────
function ConvertModal({ lead, onClose, onDone }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const eligible = lead.status === 'qualified'

  async function convert() {
    setBusy(true)
    try {
      await customersApi.convert(lead._id)
      toast.success(`${lead.name} converted to customer`)
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title="Convert to Customer"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={convert} disabled={busy || !eligible}>Convert</Button></>}
    >
      {eligible ? (
        <div className="space-y-3 text-sm text-slate-700">
          <p>Convert <strong>{lead.name}</strong> into a customer?</p>
          <ul className="list-inside list-disc space-y-1 text-slate-600">
            <li>The lead becomes a customer.</li>
            <li>The customer record is created automatically.</li>
            <li>The complete lead history is preserved.</li>
          </ul>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Only <strong>qualified</strong> leads can be converted. Move this lead to the <em>Qualified</em> stage first.
        </div>
      )}
    </Modal>
  )
}

// ─── Request Lead / Customer Transfer (spec §Request Lead Transfer) ──────────────
export function RequestTransferModal({ lead, entityLabel = 'Lead', onClose, onDone }) {
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!reason.trim()) { toast.error('Transfer reason is required'); return }
    setBusy(true)
    try {
      await leadTransfersApi.create({ customer: lead._id, reason, remarks })
      toast.success('Transfer request submitted for approval')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Request ${entityLabel} Transfer — ${lead.name}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy || !reason.trim()}>Submit Request</Button></>}
    >
      <p className="mb-3 text-sm text-slate-600">
        You cannot reassign a lead directly. This request is sent to your Sub-Admin for approval
        (Admin, if a cross-branch transfer is required).
      </p>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Transfer Reason *</label>
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Select a reason…</option>
            {['Not my territory', 'Language barrier', 'Workload / capacity', 'Customer requested another executive', 'Left unattended', 'Other'].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Remarks</label>
          <textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Add any context for the approver…"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </div>
      </div>
    </Modal>
  )
}
