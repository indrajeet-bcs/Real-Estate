import { useState, useCallback, useMemo } from 'react'
import { leavesApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, titleCase } from '../../lib/format.js'
import {
  PageHeader, Card, StatCard, Button, Input, Select, Table, Modal, Loader, ErrorState,
} from '../../components/ui.jsx'

const leaveId = (l) => `LR-${String(l._id).slice(-6).toUpperCase()}`
const dateOnly = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

const TYPES = [
  ['casual', 'Casual Leave'], ['sick', 'Sick Leave'], ['earned', 'Earned Leave'],
  ['half_day', 'Half-Day Leave'], ['work_from_home', 'Work From Home'], ['other', 'Other'],
]
const typeLabel = (t) => (TYPES.find(([k]) => k === t) || [null, titleCase(t)])[1]

// Annual allocation that counts toward the balance (WFH/other don't deduct).
const ALLOCATION = { casual: 12, sick: 8, earned: 15 }
const TOTAL_ALLOCATION = Object.values(ALLOCATION).reduce((a, b) => a + b, 0)

const STATUS_META = {
  pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
}
const StatusPill = ({ s }) => {
  const m = STATUS_META[s] || { label: titleCase(s), cls: 'bg-slate-100 text-slate-600 border-slate-200' }
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function MyLeavePage() {
  const toast = useToast()
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState('latest')

  const [applying, setApplying] = useState(false)
  const [detailsFor, setDetailsFor] = useState(null)
  const [cancelFor, setCancelFor] = useState(null)

  const { data, loading, error, refetch } = useFetch(useCallback(() => leavesApi.list(), []))
  const rows = data || []

  const usedCountable = rows.filter((r) => r.status === 'approved' && ALLOCATION[r.type]).reduce((s, r) => s + (r.days || 0), 0)
  const kpis = {
    available: Math.max(0, TOTAL_ALLOCATION - usedCountable),
    used: rows.filter((r) => r.status === 'approved').reduce((s, r) => s + (r.days || 0), 0),
    pending: rows.filter((r) => r.status === 'pending').length,
    rejected: rows.filter((r) => r.status === 'rejected').length,
  }

  const filtered = useMemo(() => {
    let out = rows
    if (type !== 'all') out = out.filter((r) => r.type === type)
    if (status !== 'all') out = out.filter((r) => r.status === status)
    if (from) out = out.filter((r) => new Date(r.startDate) >= new Date(from))
    if (to) out = out.filter((r) => new Date(r.endDate) <= new Date(`${to}T23:59:59`))
    return [...out].sort((a, b) => sort === 'latest' ? new Date(b.createdAt) - new Date(a.createdAt) : new Date(a.createdAt) - new Date(b.createdAt))
  }, [rows, type, status, from, to, sort])

  async function doCancel() {
    try { await leavesApi.cancel(cancelFor._id); toast.success('Leave request cancelled'); setCancelFor(null); refetch() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }

  const columns = [
    { key: 'id', header: 'Request ID', render: (l) => <span className="font-mono text-xs text-slate-500">{leaveId(l)}</span> },
    { key: 'type', header: 'Leave Type', render: (l) => typeLabel(l.type) },
    { key: 'from', header: 'From', render: (l) => dateOnly(l.startDate) },
    { key: 'to', header: 'To', render: (l) => dateOnly(l.endDate) },
    { key: 'days', header: 'Days', render: (l) => l.days },
    { key: 'applied', header: 'Applied On', render: (l) => formatDate(l.createdAt) },
    { key: 'status', header: 'Status', render: (l) => <StatusPill s={l.status} /> },
    { key: 'actions', header: '', render: (l) => (
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setDetailsFor(l) }}>View</Button>
        {l.status === 'pending' && <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); setCancelFor(l) }}>Cancel</Button>}
      </div>
    ) },
  ]

  return (
    <div>
      <PageHeader title="Leave" subtitle="Apply for leave, track leave balances, and monitor approval status."
        actions={<Button onClick={() => setApplying(true)}>+ Apply for Leave</Button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Available Leave" value={kpis.available} hint={`of ${TOTAL_ALLOCATION} days`} />
        <StatCard label="Used Leave" value={kpis.used} hint="Approved days" />
        <StatCard label="Pending Requests" value={kpis.pending} />
        <StatCard label="Rejected Requests" value={kpis.rejected} />
      </div>

      <Card className="mb-4 p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <Select label="Leave Type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All</option>
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All</option>
            {Object.keys(STATUS_META).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </Select>
          <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Select label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="latest">Latest First</option>
            <option value="oldest">Oldest First</option>
          </Select>
        </div>
      </Card>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <Table columns={columns} rows={filtered} empty="No leave requests match your filters." onRowClick={(l) => setDetailsFor(l)} />
      )}

      {applying && <ApplyLeaveModal onClose={() => setApplying(false)} onDone={() => { setApplying(false); refetch() }} />}
      {detailsFor && <LeaveDetailsModal leave={detailsFor} onClose={() => setDetailsFor(null)} />}
      {cancelFor && (
        <Modal open onClose={() => setCancelFor(null)} title="Cancel Leave Request"
          footer={<><Button variant="secondary" onClick={() => setCancelFor(null)}>No</Button><Button variant="danger" onClick={doCancel}>Yes, Cancel</Button></>}
        >
          <p className="text-sm text-slate-700">Are you sure you want to cancel this leave request ({leaveId(cancelFor)})?</p>
        </Modal>
      )}
    </div>
  )
}

// ─── Apply for Leave (spec §Apply for Leave) ────────────────────────────────────
function ApplyLeaveModal({ onClose, onDone }) {
  const toast = useToast()
  const [form, setForm] = useState({ type: 'casual', startDate: '', endDate: '', reason: '' })
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const isHalf = form.type === 'half_day'

  const totalDays = useMemo(() => {
    if (isHalf) return 0.5
    if (!form.startDate || !form.endDate) return 0
    const d = Math.floor((new Date(form.endDate) - new Date(form.startDate)) / 86400000) + 1
    return d > 0 ? d : 0
  }, [form.startDate, form.endDate, isHalf])

  async function submit() {
    if (!form.startDate || (!isHalf && !form.endDate)) { toast.error('Select the leave dates'); return }
    if (form.reason.trim().length < 3) { toast.error('A reason is required'); return }
    setBusy(true)
    try {
      const res = await leavesApi.create({
        type: form.type,
        startDate: form.startDate,
        endDate: isHalf ? form.startDate : form.endDate,
        reason: form.reason,
      })
      const id = res.data.data._id
      if (file) {
        const fd = new FormData(); fd.append('file', file); fd.append('label', file.name)
        await leavesApi.uploadAttachment(id, fd)
      }
      toast.success('Leave request submitted')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} wide title="Apply for Leave"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>Submit Request</Button></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Leave Type" value={form.type} onChange={set('type')}>
          {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <div className="hidden sm:block" />
        <Input label="From Date *" type="date" value={form.startDate} onChange={set('startDate')} />
        <Input label="To Date *" type="date" value={isHalf ? form.startDate : form.endDate} onChange={set('endDate')} disabled={isHalf} />
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Total Days</label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">{totalDays || '—'}{isHalf ? ' (half day)' : ''}</div>
        </div>
        <div className="hidden sm:block" />
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">Reason *</label>
          <textarea rows={2} value={form.reason} onChange={set('reason')} placeholder="Reason for leave…"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">Attachment (optional)</label>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm text-slate-600" />
          <p className="mt-1 text-xs text-slate-500">e.g. Medical certificate or supporting document.</p>
        </div>
      </div>
    </Modal>
  )
}

// ─── Leave Request Details (spec §Leave Request Details) ────────────────────────
function LeaveDetailsModal({ leave: l, onClose }) {
  return (
    <Modal open onClose={onClose} wide title={`Leave Request — ${leaveId(l)}`} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <div className="space-y-5">
        <Section title="Leave Information">
          <Info rows={[
            ['Request ID', leaveId(l)],
            ['Leave Type', typeLabel(l.type)],
            ['From Date', dateOnly(l.startDate)],
            ['To Date', dateOnly(l.endDate)],
            ['Total Days', l.days],
            ['Applied On', formatDate(l.createdAt)],
            ['Reason', l.reason],
          ]} />
        </Section>
        <Section title="Approval Information">
          <Info rows={[
            ['Current Status', <StatusPill key="status" s={l.status} />],
            ['Approved By', l.decidedBy?.name || l.decidedByName],
            ['Approval Date', l.decidedAt ? formatDate(l.decidedAt, true) : null],
            ['Remarks', l.decisionNote],
          ]} />
        </Section>
        <Section title="Attachments">
          {(l.attachments || []).length === 0 ? <p className="text-xs italic text-slate-400">No documents uploaded.</p> : (
            <ul className="space-y-1 text-sm">
              {l.attachments.map((a) => <li key={a._id}><a href={a.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">{a.label}</a></li>)}
            </ul>
          )}
        </Section>
      </div>
    </Modal>
  )
}

function Section({ title, children }) {
  return <div><h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</h4>{children}</div>
}

function Info({ rows }) {
  const shown = rows.filter(([, v]) => v || v === 0)
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
