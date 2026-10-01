import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { customersApi, usersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { titleCase } from '../../lib/format.js'
import {
  PageHeader, Card, Button, Input, Select, Table, StatusBadge, Modal, Loader, ErrorState,
} from '../../components/ui.jsx'

// Compact icon action buttons (match the branches/inventory row-action style).
const ICONS = {
  eye: (<><path d="M2.036 12.322a1.012 1.012 0 0 1 0-.644C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.01 9.963 7.178.07.207.07.43 0 .644C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.01-9.963-7.178Z" /><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></>),
  transfer: (<path d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-9L21 7.5m0 0L16.5 3m4.5 4.5H7.5" />),
  doc: (<><path d="M9 12h6m-6 4h6M9 8h2" /><path d="M6.75 3h7.5L18 6.75v12A2.25 2.25 0 0 1 15.75 21h-9A2.25 2.25 0 0 1 4.5 18.75V5.25A2.25 2.25 0 0 1 6.75 3Z" /></>),
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
const SOURCES = ['walk_in', 'website', 'referral', 'social_media', 'call', 'portal', 'other']

export default function LeadsPage() {
  const [tab, setTab] = useState('pipeline')
  return (
    <div>
      <PageHeader title="Leads & Buyers" subtitle="Lead pipeline, allocation & buyer KYC" />
      <div className="mb-5 flex gap-2">
        <TabButton active={tab === 'pipeline'} onClick={() => setTab('pipeline')}>Leads Pipeline</TabButton>
        <TabButton active={tab === 'buyers'} onClick={() => setTab('buyers')}>Buyers (KYC)</TabButton>
      </div>
      {tab === 'pipeline' ? <PipelineTab /> : <BuyersTab />}
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
      active ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
    }`}>{children}</button>
  )
}

function PipelineTab() {
  const { can } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [allocator, setAllocator] = useState(false)
  const [newLead, setNewLead] = useState(false)
  const [transferFor, setTransferFor] = useState(null)

  const openLead = (r) => navigate(`/admin/leads/${r._id}`)

  const { data: execs } = useFetch(useCallback(() => usersApi.list({ role: 'sales_executive', status: 'active', limit: 100 }), []))
  const { data, loading, error, refetch } = useFetch(
    useCallback(() => customersApi.list({ status, search, limit: 200 }), [status, search])
  )

  const columns = [
    { key: 'name', header: 'Lead', render: (r) => (
      <div><div className="font-medium text-slate-900">{r.name}</div><div className="text-xs text-slate-500">{r.mobile}</div></div>
    ) },
    { key: 'budget', header: 'Budget', render: (r) => inr(r.budgetMax || r.budgetMin) },
    { key: 'source', header: 'Source', render: (r) => titleCase(r.source || '—') },
    { key: 'assignedTo', header: 'Assigned', render: (r) => r.assignedTo?.name || <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">Unassigned Pool</span> },
    { key: 'status', header: 'Stage', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex justify-end gap-1.5">
        <IconBtn title="View" icon={ICONS.eye} onClick={(e) => { e.stopPropagation(); openLead(r) }} />
        {can('lead', 'assign') && <IconBtn title="Transfer" icon={ICONS.transfer} onClick={(e) => { e.stopPropagation(); setTransferFor(r) }} />}
      </div>
    ) },
  ]

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <Select label="Stage" value={status} onChange={(e) => setStatus(e.target.value)}>
              {['all', 'new', 'in_progress', 'follow_up_due', 'booked', 'lost'].map((s) => <option key={s} value={s}>{s === 'all' ? 'All stages' : titleCase(s)}</option>)}
            </Select>
          </div>
          <div className="w-56"><Input label="Search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name / mobile / email" /></div>
        </div>
        <div className="flex gap-2">
          {can('lead', 'assign') && <Button variant="secondary" onClick={() => setAllocator(true)}>Run Allocator</Button>}
          {can('lead', 'create') && <Button onClick={() => setNewLead(true)}>+ New Lead</Button>}
        </div>
      </div>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <Table columns={columns} rows={data || []} empty="No leads found" onRowClick={openLead} />
      )}

      {allocator && <AllocatorModal onClose={() => setAllocator(false)} onDone={() => { setAllocator(false); refetch() }} />}
      {newLead && <NewLeadModal execs={execs || []} onClose={() => setNewLead(false)} onDone={() => { setNewLead(false); refetch() }} />}
      {transferFor && <TransferOwnershipModal customer={transferFor} execs={execs || []} onClose={() => setTransferFor(null)} onDone={() => { setTransferFor(null); refetch() }} />}
    </div>
  )
}

const ALGOS = [
  { v: 'round_robin', t: 'Round Robin', d: 'Evenly cycle leads across all active executives.' },
  { v: 'load_balanced', t: 'Load Balanced', d: 'Assign to executives with the fewest active leads first.' },
  { v: 'performance', t: 'Performance', d: 'Favor higher-revenue executives while still balancing load.' },
]

function AllocatorModal({ onClose, onDone }) {
  const toast = useToast()
  const [algorithm, setAlgorithm] = useState('round_robin')
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    try {
      const res = await customersApi.distribute({ algorithm })
      const n = res.data.data?.assigned || 0
      toast.success(n ? `Distributed ${n} lead(s)` : 'No unassigned leads to distribute')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Run Lead Allocator" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={run} disabled={busy}>Run Allocation</Button>
      </>
    }>
      <p className="mb-3 text-sm text-slate-600">Distributes all unassigned pool leads to active executives.</p>
      <div className="space-y-2">
        {ALGOS.map((a) => (
          <label key={a.v} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${algorithm === a.v ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
            <input type="radio" name="algo" checked={algorithm === a.v} onChange={() => setAlgorithm(a.v)} className="mt-0.5" />
            <span><span className="block text-sm font-medium text-slate-800">{a.t}</span><span className="block text-xs text-slate-500">{a.d}</span></span>
          </label>
        ))}
      </div>
    </Modal>
  )
}

function NewLeadModal({ execs, onClose, onDone }) {
  const toast = useToast()
  const [form, setForm] = useState({ name: '', mobile: '', source: 'website', budgetMax: '', assignedTo: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    try {
      await customersApi.create({
        name: form.name, mobile: form.mobile, source: form.source,
        budgetMax: form.budgetMax ? Number(form.budgetMax) : undefined,
        assignedTo: form.assignedTo || undefined,
      })
      toast.success('Lead created')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="New Lead" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy || form.name.trim().length < 2 || form.mobile.length < 7}>Create</Button>
      </>
    }>
      <div className="space-y-4">
        <Input label="Full name" value={form.name} onChange={set('name')} />
        <Input label="Mobile" value={form.mobile} onChange={set('mobile')} />
        <Select label="Source" value={form.source} onChange={set('source')}>
          {SOURCES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </Select>
        <Input label="Budget (max ₹)" type="number" value={form.budgetMax} onChange={set('budgetMax')} />
        <Select label="Assign to (optional)" value={form.assignedTo} onChange={set('assignedTo')}>
          <option value="">Unassigned pool</option>
          {execs.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
        </Select>
      </div>
    </Modal>
  )
}

export function TransferOwnershipModal({ customer, execs, onClose, onDone }) {
  const toast = useToast()
  const [form, setForm] = useState({ newEmployee: '', reason: '', remarks: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    try {
      const res = await customersApi.transfer(customer._id, { newEmployee: form.newEmployee, reason: form.reason, remarks: form.remarks })
      const d = res.data.data
      toast.success(`Lead transferred${d?.reassignedFollowUps ? ` · ${d.reassignedFollowUps} follow-up(s) moved` : ''}`)
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Transfer Lead — ${customer.name}`} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy || !form.newEmployee || !form.reason.trim()}>Confirm Transfer</Button>
      </>
    }>
      <p className="mb-3 text-sm text-slate-600">Currently with <strong>{customer.assignedTo?.name || 'the pool'}</strong>. Pending follow-ups &amp; future site visits move to the new employee. Ownership history is preserved.</p>
      <div className="space-y-4">
        <Select label="New Employee" value={form.newEmployee} onChange={set('newEmployee')}>
          <option value="">Select an executive…</option>
          {execs.filter((e) => e._id !== customer.assignedTo?._id).map((e) => <option key={e._id} value={e._id}>{e.name} · {e.email}</option>)}
        </Select>
        <Input label="Transfer Reason" value={form.reason} onChange={set('reason')} placeholder="Why is this lead being transferred?" />
        <Input label="Remarks (optional)" value={form.remarks} onChange={set('remarks')} />
      </div>
    </Modal>
  )
}

function BuyersTab() {
  const { can } = useAuth()
  const navigate = useNavigate()
  const [kycFor, setKycFor] = useState(null)
  const [transferFor, setTransferFor] = useState(null)
  const { data: execs } = useFetch(useCallback(() => usersApi.list({ role: 'sales_executive', status: 'active', limit: 100 }), []))
  const { data, loading, error, refetch } = useFetch(useCallback(() => customersApi.list({ limit: 200 }), []))

  const openBuyer = (r, tab) => navigate(`/admin/buyers/${r._id}${tab ? `?tab=${tab}` : ''}`)

  const columns = [
    { key: 'name', header: 'Buyer', render: (r) => (
      <div><div className="font-medium text-slate-900">{r.name}</div><div className="text-xs text-slate-500">{r.mobile}</div></div>
    ) },
    { key: 'kycStatus', header: 'KYC', render: (r) => <StatusBadge status={r.kycStatus || 'pending'} /> },
    { key: 'reraDocSigned', header: 'RERA Form-6', render: (r) => r.reraDocSigned
      ? <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">Signed</span>
      : <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Not signed</span> },
    { key: 'assignedTo', header: 'Owner', render: (r) => r.assignedTo?.name || '—' },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openBuyer(r, 'Bookings') }}>View Booking</Button>
        {can('customer', 'edit') && <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setKycFor(r) }}>Update KYC</Button>}
        {can('customer', 'edit') && <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setTransferFor(r) }}>Transfer</Button>}
      </div>
    ) },
  ]

  return (
    <div>
      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <Table columns={columns} rows={data || []} empty="No buyers yet" onRowClick={(r) => openBuyer(r)} />
      )}
      {kycFor && <KycModal customer={kycFor} onClose={() => setKycFor(null)} onDone={() => { setKycFor(null); refetch() }} />}
      {transferFor && <TransferOwnershipModal customer={transferFor} execs={execs || []} onClose={() => setTransferFor(null)} onDone={() => { setTransferFor(null); refetch() }} />}
    </div>
  )
}

function KycModal({ customer, onClose, onDone }) {
  const toast = useToast()
  const [kycStatus, setKycStatus] = useState(customer.kycStatus || 'pending')
  const [reraDocSigned, setReraDocSigned] = useState(!!customer.reraDocSigned)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      await customersApi.update(customer._id, { kycStatus, reraDocSigned })
      toast.success('KYC updated')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`KYC — ${customer.name}`} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy}>Save</Button>
      </>
    }>
      <div className="space-y-4">
        <Select label="KYC status" value={kycStatus} onChange={(e) => setKycStatus(e.target.value)}>
          <option value="pending">Pending Verification</option>
          <option value="complete">Complete</option>
          <option value="rejected">Rejected</option>
        </Select>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={reraDocSigned} onChange={(e) => setReraDocSigned(e.target.checked)} />
          RERA Form-6 signed (PAN + Aadhaar verified)
        </label>
      </div>
    </Modal>
  )
}
