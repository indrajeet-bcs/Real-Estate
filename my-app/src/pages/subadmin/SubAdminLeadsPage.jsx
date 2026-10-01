import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { customersApi, usersApi, reportsApi, leadTransfersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { titleCase } from '../../lib/format.js'
import { PageHeader, Card, StatCard, Button, Input, Select, Table, StatusBadge, Modal, Loader, ErrorState } from '../../components/ui.jsx'
import { TransferOwnershipModal } from '../admin/LeadsPage.jsx'

const inr = (n) => {
  const v = Number(n) || 0
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`
  return v ? `₹${v.toLocaleString('en-IN')}` : '—'
}

const STAGES = ['new', 'in_progress', 'follow_up_due', 'booked', 'lost']
const PRIORITY_CLS = { high: 'bg-red-50 text-red-700 border-red-200', medium: 'bg-amber-50 text-amber-700 border-amber-200', low: 'bg-slate-100 text-slate-600 border-slate-200' }

function csv(filename, rows) {
  const blob = new Blob([rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
}

export default function SubAdminLeadsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [exec, setExec] = useState('all')
  const [source, setSource] = useState('all')
  const [priority, setPriority] = useState('all')
  const [adding, setAdding] = useState(false)
  const [transferFor, setTransferFor] = useState(null)

  const { data, loading, error, refetch } = useFetch(useCallback(() => customersApi.list({ limit: 500 }), []))
  const { data: execs } = useFetch(useCallback(() => usersApi.list({ role: 'sales_executive', status: 'active', limit: 200 }), []))
  const { data: overview } = useFetch(useCallback(() => reportsApi.subAdminOverview(), []))
  const { data: transferReqs, refetch: refetchReqs } = useFetch(useCallback(() => leadTransfersApi.list({ status: 'pending', limit: 200 }), []))
  const [decideReq, setDecideReq] = useState(null)

  const rows = data || []
  const kpis = {
    total: rows.length,
    new: rows.filter((r) => r.status === 'new').length,
    assigned: rows.filter((r) => r.assignedTo).length,
    followsToday: overview?.followUps?.due ?? '—',
    overdue: overview?.followUps?.overdue ?? '—',
    visitsToday: overview?.kpis?.scheduledVisits ?? '—',
    bookings: overview?.kpis?.monthlyBookings ?? '—',
  }

  const filtered = useMemo(() => {
    let out = rows
    if (status !== 'all') out = out.filter((r) => r.status === status)
    if (exec !== 'all') out = out.filter((r) => (exec === 'unassigned' ? !r.assignedTo : r.assignedTo?._id === exec))
    if (source !== 'all') out = out.filter((r) => r.source === source)
    if (priority !== 'all') out = out.filter((r) => (r.priority || 'medium') === priority)
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter((r) => [r.name, r.mobile, r.interestedProjects?.[0]?.project?.name].some((v) => (v || '').toLowerCase().includes(q)))
    }
    return out
  }, [rows, status, exec, source, priority, search])

  async function quickStatus(r, next) {
    try { await customersApi.changeStatus(r._id, { status: next }); toast.success('Status updated'); refetch() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }

  function exportCsv() {
    const header = ['Name', 'Mobile', 'Priority', 'Budget', 'Executive', 'Source', 'Status']
    csv('leads.csv', [header, ...filtered.map((r) => [r.name, r.mobile, r.priority, r.budgetMax || r.budgetMin, r.assignedTo?.name, r.source, r.status])])
  }

  const sourceOptions = [...new Set(rows.map((r) => r.source).filter(Boolean))]

  const columns = [
    { key: 'name', header: 'Lead', render: (r) => (
      <div><div className="font-medium text-slate-900">{r.name}</div><div className="text-xs text-slate-500">{r.mobile}</div></div>
    ) },
    { key: 'priority', header: 'Priority', render: (r) => <span className={`rounded border px-2 py-0.5 text-xs font-medium ${PRIORITY_CLS[r.priority || 'medium']}`}>{titleCase(r.priority || 'medium')}</span> },
    { key: 'project', header: 'Project', render: (r) => r.interestedProjects?.[0]?.project?.name || '—' },
    { key: 'budget', header: 'Budget', render: (r) => inr(r.budgetMax || r.budgetMin) },
    { key: 'exec', header: 'Assigned Executive', render: (r) => r.assignedTo?.name || <span className="text-amber-600">Unassigned</span> },
    { key: 'source', header: 'Source', render: (r) => titleCase(r.source || '—') },
    { key: 'quick', header: 'Quick Status', render: (r) => (
      <select value={r.status} onChange={(e) => { e.stopPropagation(); quickStatus(r, e.target.value) }} onClick={(e) => e.stopPropagation()} className="rounded border border-slate-300 px-1.5 py-1 text-xs">
        {STAGES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
      </select>
    ) },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); navigate(`/sub-admin/customers/${r._id}`) }}>View</Button>
        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setTransferFor(r) }}>Transfer</Button>
      </div>
    ) },
  ]

  return (
    <div>
      <PageHeader
        title="Lead Management"
        subtitle="Track, assign, transfer and convert branch leads."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate('/sub-admin/leads/import')}>Import</Button>
            <Button variant="secondary" onClick={() => navigate('/sub-admin/leads/assign')}>Bulk Assign</Button>
            <Button variant="secondary" onClick={exportCsv} disabled={!filtered.length}>Export</Button>
            <Button onClick={() => setAdding(true)}>+ Add Lead</Button>
          </div>
        }
      />

      {/* Pending lead-transfer requests (Employee spec §Request Lead Transfer · Approval Flow) */}
      {(transferReqs || []).length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50/40 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-base">⇄</span>
            <h3 className="text-sm font-semibold text-slate-900">Lead Transfer Requests</h3>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">{transferReqs.length} pending</span>
          </div>
          <div className="space-y-2">
            {transferReqs.map((r) => (
              <div key={r._id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white px-4 py-2.5">
                <div className="min-w-0 text-sm">
                  <span className="font-medium text-slate-900">{r.customer?.name || 'Lead'}</span>
                  <span className="text-slate-500"> · requested by {r.requestedBy?.name || '—'}</span>
                  <div className="text-xs text-slate-500">Reason: {r.reason}{r.remarks ? ` — ${r.remarks}` : ''}</div>
                </div>
                <Button size="sm" onClick={() => setDecideReq(r)}>Review</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Dashboard KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Total Leads" value={kpis.total} />
        <StatCard label="New Leads" value={kpis.new} />
        <StatCard label="Assigned" value={kpis.assigned} />
        <StatCard label="Follow-ups Today" value={kpis.followsToday} />
        <StatCard label="Overdue Follow-ups" value={kpis.overdue} />
        <StatCard label="Site Visits Today" value={kpis.visitsToday} />
        <StatCard label="Bookings" value={kpis.bookings} />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-56"><Input label="Search" placeholder="Name, mobile, project" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="w-40"><Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option>{STAGES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></div>
        <div className="w-44"><Select label="Executive" value={exec} onChange={(e) => setExec(e.target.value)}><option value="all">All</option><option value="unassigned">Unassigned</option>{(execs || []).map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}</Select></div>
        <div className="w-40"><Select label="Source" value={source} onChange={(e) => setSource(e.target.value)}><option value="all">All</option>{sourceOptions.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></div>
        <div className="w-36"><Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}><option value="all">All</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></Select></div>
      </div>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <Table columns={columns} rows={filtered} empty="No leads match your filters." onRowClick={(r) => navigate(`/sub-admin/customers/${r._id}`)} />
      )}

      {adding && <AddLeadModal execs={execs || []} onClose={() => setAdding(false)} onDone={() => { setAdding(false); refetch() }} />}
      {transferFor && <TransferOwnershipModal customer={transferFor} execs={execs || []} onClose={() => setTransferFor(null)} onDone={() => { setTransferFor(null); refetch() }} />}
      {decideReq && <DecideTransferModal request={decideReq} execs={execs || []} onClose={() => setDecideReq(null)} onDone={() => { setDecideReq(null); refetchReqs(); refetch() }} />}
    </div>
  )
}

// Sub-Admin decides on an employee's lead-transfer request (approve → reassign, or reject).
function DecideTransferModal({ request, execs, onClose, onDone }) {
  const toast = useToast()
  const [newEmployee, setNewEmployee] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const requesterId = request.requestedBy?._id || request.requestedBy

  async function decide(decision) {
    setBusy(true)
    try {
      await leadTransfersApi.decide(request._id, {
        decision,
        newEmployee: decision === 'approve' ? (newEmployee || undefined) : undefined,
        note,
      })
      toast.success(decision === 'approve' ? 'Approved — lead reassigned' : 'Request rejected')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Transfer Request — ${request.customer?.name || 'Lead'}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={() => decide('reject')} disabled={busy}>Reject</Button>
          <Button onClick={() => decide('approve')} disabled={busy}>Approve</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
          <div><span className="text-slate-500">Requested by:</span> {request.requestedBy?.name || '—'}</div>
          <div><span className="text-slate-500">Reason:</span> {request.reason}</div>
          {request.remarks && <div><span className="text-slate-500">Remarks:</span> {request.remarks}</div>}
        </div>
        <Select label="Reassign to (leave empty to move to the unassigned pool)" value={newEmployee} onChange={(e) => setNewEmployee(e.target.value)}>
          <option value="">Unassigned pool</option>
          {execs.filter((e) => String(e._id) !== String(requesterId)).map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
        </Select>
        <Input label="Decision note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add context for the requester…" />
      </div>
      <p className="mt-3 text-xs text-slate-500">Approving reassigns the lead and moves its pending follow-ups &amp; future site visits to the chosen employee.</p>
    </Modal>
  )
}

function AddLeadModal({ execs, onClose, onDone }) {
  const toast = useToast()
  const [form, setForm] = useState({ name: '', mobile: '', email: '', budgetMax: '', source: 'walk_in', priority: 'medium', assignedTo: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    try {
      await customersApi.create({
        name: form.name, mobile: form.mobile, email: form.email || undefined,
        budgetMax: form.budgetMax ? Number(form.budgetMax) : undefined,
        source: form.source, priority: form.priority,
        assignedTo: form.assignedTo || undefined,
      })
      toast.success('Lead created')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} wide title="Add Lead" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy || form.name.trim().length < 2 || form.mobile.trim().length < 7}>Create Lead</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Customer Name" value={form.name} onChange={set('name')} />
        <Input label="Mobile Number" value={form.mobile} onChange={set('mobile')} />
        <Input label="Email" type="email" value={form.email} onChange={set('email')} />
        <Input label="Budget (max ₹)" type="number" value={form.budgetMax} onChange={set('budgetMax')} />
        <Select label="Lead Source" value={form.source} onChange={set('source')}>
          {['walk_in', 'website', 'referral', 'social_media', 'call', 'portal', 'other'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </Select>
        <Select label="Priority" value={form.priority} onChange={set('priority')}>
          <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </Select>
        <Select label="Assigned Executive (optional)" value={form.assignedTo} onChange={set('assignedTo')}>
          <option value="">Unassigned pool</option>
          {execs.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
        </Select>
      </div>
      <p className="mt-3 text-xs text-slate-500">Duplicate mobile numbers are blocked automatically.</p>
    </Modal>
  )
}
