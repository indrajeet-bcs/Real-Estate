import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { bookingsApi, customersApi, projectsApi, unitsApi, usersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { formatDate } from '../../lib/format.js'
import {
  PageHeader, StatCard, Button, Input, Select, Table, StatusBadge, Modal, Loader, ErrorState,
} from '../../components/ui.jsx'

const inr = (n) => {
  const v = Number(n) || 0
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`
  return `₹${v.toLocaleString('en-IN')}`
}

function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const FINAL = (r) => (r.discount?.finalSaleAmount || Math.round((r.totalValue || 0) * (1 - (r.appliedDiscount || 0) / 100)))

export default function AdminBookingsPage({
  basePath = '/admin/bookings',
  title = 'Booking Registers',
  subtitle = 'Manage property bookings, payments, buyer details, registration progress, commissions, and sale completion.',
} = {}) {
  const { can } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [register, setRegister] = useState(false)
  const [transferFor, setTransferFor] = useState(null)
  const [showAdv, setShowAdv] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatusFilter] = useState('all')
  const [project, setProject] = useState('all')
  const [branch, setBranch] = useState('all')
  const [payment, setPayment] = useState('all')
  const [registration, setRegistration] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { data, loading, error, refetch } = useFetch(useCallback(() => bookingsApi.list({ limit: 200 }), []))
  const [decideReq, setDecideReq] = useState(null)
  const pendingReqs = useMemo(() => {
    const out = []
    ;(data || []).forEach((b) => {
      if (b.discountRequest?.status === 'pending') out.push({ kind: 'discount', booking: b, req: b.discountRequest })
      if (b.cancellationRequest?.status === 'pending') out.push({ kind: 'cancellation', booking: b, req: b.cancellationRequest })
    })
    return out
  }, [data])

  async function setStatus(e, b, status) {
    e?.stopPropagation()
    try { await bookingsApi.setStatus(b._id, { status }); toast.success(`Booking ${status}`); refetch() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }

  const rows = data || []
  const open = (r) => navigate(`${basePath}/${r._id}`)
  const { data: execs } = useFetch(useCallback(() => usersApi.list({ role: 'sales_executive', status: 'active', limit: 200 }), []))

  // Top KPI section (spec §Booking Registers).
  const kpis = useMemo(() => ({
    total: rows.length,
    reserved: rows.filter((r) => r.status === 'reserved').length,
    confirmed: rows.filter((r) => r.status === 'confirmed').length,
    completed: rows.filter((r) => r.status === 'sale_completed').length,
  }), [rows])

  const projectOptions = useMemo(() => {
    const seen = new Map()
    rows.forEach((r) => { if (r.project?._id) seen.set(r.project._id, r.project.name) })
    return [...seen.entries()]
  }, [rows])
  const branchOptions = useMemo(() => [...new Set(rows.map((r) => r.bookedBy?.branch).filter(Boolean))], [rows])

  const filtered = useMemo(() => {
    let out = rows
    if (status !== 'all') out = out.filter((r) => r.status === status)
    if (project !== 'all') out = out.filter((r) => r.project?._id === project)
    if (branch !== 'all') out = out.filter((r) => r.bookedBy?.branch === branch)
    if (payment !== 'all') out = out.filter((r) => (r.paymentStatus || 'pending') === payment)
    if (registration !== 'all') out = out.filter((r) => (r.registrationStatus || 'pending') === registration)
    if (from) out = out.filter((r) => new Date(r.createdAt) >= new Date(from))
    if (to) out = out.filter((r) => new Date(r.createdAt) <= new Date(`${to}T23:59:59`))
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter((r) => [r.customer?.name, r.customer?.mobile, r.project?.name, r.unit?.unitNumber, r.bookedBy?.name, r._id?.slice(-8)]
        .some((v) => (v || '').toLowerCase().includes(q)))
    }
    return out
  }, [rows, status, project, branch, payment, registration, from, to, search])

  function exportCSV() {
    const header = ['Booking ID', 'Date', 'Buyer', 'Project', 'Unit', 'Executive', 'Branch', 'Sale Value', 'Approved Discount', 'Final Sale Value', 'Brokerage', 'Payment', 'Registration', 'Status']
    const body = filtered.map((r) => [r._id?.slice(-8).toUpperCase(), formatDate(r.createdAt), r.customer?.name, r.project?.name, r.unit?.unitNumber, r.bookedBy?.name, r.bookedBy?.branch, r.discount?.saleAmount || r.totalValue, r.discount?.totalDiscount || `${r.appliedDiscount || 0}%`, FINAL(r), r.commissionEarned, r.paymentStatus, r.registrationStatus, r.status])
    downloadCSV('booking-registers.csv', [header, ...body])
  }

  const columns = [
    { key: 'id', header: 'Booking ID', render: (r) => <span className="font-mono text-xs text-slate-500">#{r._id?.slice(-8).toUpperCase()}</span> },
    { key: 'date', header: 'Date', render: (r) => formatDate(r.createdAt) },
    { key: 'customer', header: 'Buyer', render: (r) => <span className="font-medium text-slate-900">{r.customer?.name || '—'}</span> },
    { key: 'unit', header: 'Project / Unit', render: (r) => (
      <div><div className="text-slate-800">{r.project?.name || '—'}</div><div className="text-xs text-slate-500">{r.unit?.unitNumber || '—'}</div></div>
    ) },
    { key: 'exec', header: 'Executive / Branch', render: (r) => (
      <div><div className="text-slate-800">{r.bookedBy?.name || '—'}</div><div className="text-xs text-slate-500">{r.bookedBy?.branch || '—'}</div></div>
    ) },
    { key: 'totalValue', header: 'Sale Value', render: (r) => inr(r.discount?.saleAmount || r.totalValue) },
    { key: 'discount', header: 'Discount', render: (r) => r.discount?.totalDiscount ? inr(r.discount.totalDiscount) : (r.appliedDiscount ? `${r.appliedDiscount}%` : '—') },
    { key: 'finalValue', header: 'Final Value', render: (r) => <span className="font-medium text-slate-800">{inr(FINAL(r))}</span> },
    { key: 'commissionEarned', header: 'Brokerage', render: (r) => <span className="font-medium text-emerald-600">{inr(r.commissionEarned)}</span> },
    { key: 'payment', header: 'Payment', render: (r) => <StatusBadge status={r.paymentStatus || 'pending'} /> },
    { key: 'registration', header: 'Registration', render: (r) => <StatusBadge status={r.registrationStatus || 'pending'} /> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); open(r) }}>View</Button>
        {can('booking', 'edit') && <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setTransferFor(r) }}>Transfer</Button>}
        {can('booking', 'edit') && r.status === 'reserved' && (
          <>
            <Button size="sm" variant="success" onClick={(e) => setStatus(e, r, 'confirmed')}>Confirm</Button>
            <Button size="sm" variant="danger" onClick={(e) => setStatus(e, r, 'cancelled')}>Cancel</Button>
          </>
        )}
      </div>
    ) },
  ]

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={exportCSV} disabled={!filtered.length}>Export</Button>
            {can('booking', 'create') && <Button onClick={() => setRegister(true)}>+ Register Property Sale</Button>}
          </div>
        }
      />

      {/* Pending approval requests (Employee spec §Approval Flow) */}
      {can('booking', 'edit') && pendingReqs.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-base">⚑</span>
            <h3 className="text-sm font-semibold text-slate-900">Booking Approval Requests</h3>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">{pendingReqs.length} pending</span>
          </div>
          <div className="space-y-2">
            {pendingReqs.map((p) => (
              <div key={`${p.kind}-${p.booking._id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white px-4 py-2.5">
                <div className="min-w-0 text-sm">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">{p.kind === 'discount' ? 'Discount' : 'Cancellation'}</span>
                  <span className="ml-2 font-medium text-slate-900">{p.booking.customer?.name || 'Booking'}</span>
                  <span className="text-slate-500"> · by {p.req.requestedByName || '—'}</span>
                  <div className="text-xs text-slate-500">
                    {p.kind === 'discount'
                      ? `Discount ${inr(p.req.totalDiscount)} → final ${inr(p.req.finalSaleAmount)}${p.req.remarks ? ` · ${p.req.remarks}` : ''}`
                      : `${p.req.reason}${p.req.remarks ? ` — ${p.req.remarks}` : ''}`}
                  </div>
                </div>
                <Button size="sm" onClick={() => setDecideReq(p)}>Review</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top KPI section */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Bookings" value={kpis.total} />
        <StatCard label="Reserved Bookings" value={kpis.reserved} />
        <StatCard label="Confirmed Bookings" value={kpis.confirmed} />
        <StatCard label="Sales Completed" value={kpis.completed} hint="Registration completed" />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-64"><Input label="Search" placeholder="Buyer, mobile, project, unit, booking ID" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="w-44">
          <Select label="Booking Status" value={status} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="reserved">Reserved</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
            <option value="sale_completed">Sale Completed</option>
          </Select>
        </div>
        <div className="w-52">
          <Select label="Project" value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="all">All projects</option>
            {projectOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </Select>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowAdv((v) => !v)}>{showAdv ? 'Hide filters' : 'Advanced Filters'}</Button>
      </div>

      {showAdv && (
        <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-5">
          <Select label="Branch" value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value="all">All branches</option>
            {branchOptions.map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
          <Select label="Payment Status" value={payment} onChange={(e) => setPayment(e.target.value)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="completed">Completed</option>
          </Select>
          <Select label="Registration Status" value={registration} onChange={(e) => setRegistration(e.target.value)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </Select>
          <Input label="From date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To date" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      )}

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <Table columns={columns} rows={filtered} empty="No bookings match your filters." onRowClick={open} />
      )}
      {register && <RegisterModal onClose={() => setRegister(false)} onDone={() => { setRegister(false); refetch() }} />}
      {transferFor && <TransferBookingModal booking={transferFor} execs={execs || []} onClose={() => setTransferFor(null)} onDone={() => { setTransferFor(null); refetch() }} />}
      {decideReq && <DecideRequestModal item={decideReq} onClose={() => setDecideReq(null)} onDone={() => { setDecideReq(null); refetch() }} />}
    </div>
  )
}

// Sub-Admin/Admin approves or rejects a booking discount / cancellation request.
function DecideRequestModal({ item, onClose, onDone }) {
  const toast = useToast()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const { kind, booking, req } = item

  async function decide(decision) {
    setBusy(true)
    try {
      if (kind === 'discount') await bookingsApi.decideDiscount(booking._id, { decision, note })
      else await bookingsApi.decideCancellation(booking._id, { decision, note })
      toast.success(decision === 'approve' ? 'Request approved' : 'Request rejected')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={`${kind === 'discount' ? 'Discount' : 'Cancellation'} Request — ${booking.customer?.name || ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={() => decide('reject')} disabled={busy}>Reject</Button>
          <Button onClick={() => decide('approve')} disabled={busy}>Approve</Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
          <div><span className="text-slate-500">Requested by:</span> {req.requestedByName || '—'}</div>
          {kind === 'discount' ? (
            <>
              <div><span className="text-slate-500">Sale amount:</span> {inr(req.saleAmount)}</div>
              <div><span className="text-slate-500">Firm / Builder:</span> {inr(req.firmDiscount)} / {inr(req.builderDiscount)}</div>
              <div><span className="text-slate-500">Total discount:</span> <strong>{inr(req.totalDiscount)}</strong></div>
              <div><span className="text-slate-500">Final sale amount:</span> <strong>{inr(req.finalSaleAmount)}</strong></div>
              {req.givenBy && <div><span className="text-slate-500">Given by:</span> {req.givenBy}</div>}
              {req.remarks && <div><span className="text-slate-500">Remarks:</span> {req.remarks}</div>}
            </>
          ) : (
            <>
              <div><span className="text-slate-500">Reason:</span> {req.reason}</div>
              {req.remarks && <div><span className="text-slate-500">Remarks:</span> {req.remarks}</div>}
              <p className="mt-2 text-xs text-rose-600">Approving cancels the booking and frees the unit back to available.</p>
            </>
          )}
        </div>
        <Input label="Decision note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  )
}

export function TransferBookingModal({ booking, execs, onClose, onDone }) {
  const toast = useToast()
  const [form, setForm] = useState({ newExecutive: '', reason: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    try {
      await bookingsApi.transfer(booking._id, form)
      toast.success('Booking transferred')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Transfer Booking" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy || !form.newExecutive || !form.reason.trim()}>Confirm Transfer</Button>
      </>
    }>
      <p className="mb-3 text-sm text-slate-600">Currently with <strong>{booking.bookedBy?.name || '—'}</strong>. Ownership history is preserved.</p>
      <div className="space-y-4">
        <Select label="New Executive" value={form.newExecutive} onChange={set('newExecutive')}>
          <option value="">Select an executive…</option>
          {execs.filter((e) => e._id !== booking.bookedBy?._id).map((e) => <option key={e._id} value={e._id}>{e.name} · {e.email}</option>)}
        </Select>
        <Input label="Transfer Reason" value={form.reason} onChange={set('reason')} placeholder="Why is this booking being transferred?" />
      </div>
    </Modal>
  )
}

function RegisterModal({ onClose, onDone }) {
  const toast = useToast()
  const [customer, setCustomer] = useState('')
  const [project, setProject] = useState('')
  const [unit, setUnit] = useState('')
  const [discount, setDiscount] = useState('0')
  const [token, setToken] = useState('500000')
  const [busy, setBusy] = useState(false)

  const { data: customers } = useFetch(useCallback(() => customersApi.list({ limit: 100 }), []))
  const { data: projects } = useFetch(useCallback(() => projectsApi.list({ limit: 100 }), []))
  // Available units for the chosen project only (double-booking guard).
  const { data: units } = useFetch(useCallback(
    () => (project ? unitsApi.list({ project, status: 'available', limit: 100 }) : Promise.resolve({ data: { data: [] } })),
    [project]
  ))

  const proj = (projects || []).find((p) => p._id === project)
  const unitObj = (units || []).find((u) => u._id === unit)

  // Live brokerage preview.
  const preview = useMemo(() => {
    const base = unitObj?.price || 0
    const disc = Number(discount) || 0
    const finalValue = Math.round(base * (1 - disc / 100))
    const rate = proj?.commissionRate || 0
    const commission = Math.round(finalValue * (rate / 100))
    return { base, finalValue, rate, commission }
  }, [unitObj, discount, proj])

  async function save() {
    setBusy(true)
    try {
      const res = await bookingsApi.create({
        customer, project, unit,
        bookingAmount: Number(token) || 1,
        amountReceived: Number(token) || 0,
        totalValue: preview.base,
        appliedDiscount: Number(discount) || 0,
        reraVerified: true,
      })
      // Finalize the sale: confirm → unit booked, customer booked.
      await bookingsApi.setStatus(res.data.data._id, { status: 'confirmed' })
      toast.success('Property sale registered')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Register Property Sale" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy || !customer || !project || !unit}>Register Sale</Button>
      </>
    }>
      <div className="space-y-4">
        <Select label="Buyer" value={customer} onChange={(e) => setCustomer(e.target.value)}>
          <option value="">Select a buyer…</option>
          {(customers || []).map((c) => <option key={c._id} value={c._id}>{c.name} · {c.mobile}</option>)}
        </Select>
        <Select label="Project" value={project} onChange={(e) => { setProject(e.target.value); setUnit('') }}>
          <option value="">Select a project…</option>
          {(projects || []).map((p) => <option key={p._id} value={p._id}>{p.name} (commission {p.commissionRate || 0}%)</option>)}
        </Select>
        <Select label="Available unit" value={unit} onChange={(e) => setUnit(e.target.value)} disabled={!project}>
          <option value="">{project ? 'Select an available unit…' : 'Choose a project first'}</option>
          {(units || []).map((u) => <option key={u._id} value={u._id}>{u.unitNumber} · {inr(u.price)}</option>)}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Discount (%)" type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          <Input label="Escrow token (₹)" type="number" value={token} onChange={(e) => setToken(e.target.value)} />
        </div>

        {unitObj && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Base price</span><span>{inr(preview.base)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">After {Number(discount) || 0}% discount</span><span className="font-medium">{inr(preview.finalValue)}</span></div>
            <div className="mt-1 flex justify-between border-t border-slate-200 pt-1"><span className="text-slate-500">Brokerage @ {preview.rate}%</span><span className="font-semibold text-emerald-600">{inr(preview.commission)}</span></div>
          </div>
        )}
      </div>
    </Modal>
  )
}
