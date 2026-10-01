import { useState, useCallback, useMemo, useEffect } from 'react'
import { bookingsApi, customersApi, projectsApi, buildersApi, unitsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, titleCase } from '../../lib/format.js'
import {
  PageHeader, Card, StatCard, Button, Input, Select, Table, Modal, Loader, ErrorState,
} from '../../components/ui.jsx'

const inr = (n) => {
  const v = Number(n) || 0
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`
  return v ? `₹${v.toLocaleString('en-IN')}` : '—'
}
const money = (n) => (n || n === 0 ? `₹${Number(n).toLocaleString('en-IN')}` : '—')
const bookingId = (b) => `BKG-${String(b._id).slice(-6).toUpperCase()}`
const unitPrice = (u) => (u ? u.currentPrice || u.price || u.basePrice || 0 : 0)

// Booking status shown to the executive ("reserved" surfaces as Pending Approval).
const STATUS_META = {
  draft: { label: 'Draft', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  reserved: { label: 'Pending Approval', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  confirmed: { label: 'Confirmed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  sale_completed: { label: 'Sale Completed', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
}
const PAY_META = {
  pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  partial: { label: 'Partial', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}
const Pill = ({ meta, s }) => {
  const m = meta[s] || { label: titleCase(s), cls: 'bg-slate-100 text-slate-600 border-slate-200' }
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>
}

const PAYMENT_MODES = ['cash', 'cheque', 'bank_transfer', 'upi', 'card', 'loan', 'other']

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function MyBookingsPage() {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [project, setProject] = useState('all')
  const [builder, setBuilder] = useState('all')
  const [payment, setPayment] = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const [sort, setSort] = useState('latest')

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null)
  const [paymentFor, setPaymentFor] = useState(null)
  const [discountFor, setDiscountFor] = useState(null)
  const [cancelFor, setCancelFor] = useState(null)
  const [docsFor, setDocsFor] = useState(null)
  const [detailsFor, setDetailsFor] = useState(null)
  const [sheetFor, setSheetFor] = useState(null)

  const { data, loading, error, refetch } = useFetch(useCallback(() => bookingsApi.list({ limit: 500 }), []))
  const { data: projects } = useFetch(useCallback(() => projectsApi.list({ limit: 200 }), []))
  const { data: builders } = useFetch(useCallback(() => buildersApi.list({ limit: 200 }), []))

  const rows = data || []
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)

  const kpis = {
    total: rows.length,
    pending: rows.filter((r) => r.status === 'reserved').length,
    confirmed: rows.filter((r) => ['confirmed', 'sale_completed'].includes(r.status)).length,
    cancelled: rows.filter((r) => r.status === 'cancelled').length,
  }

  const filtered = useMemo(() => {
    let out = rows
    if (status !== 'all') out = out.filter((r) => r.status === status)
    if (project !== 'all') out = out.filter((r) => String(r.project?._id || r.project) === project)
    if (builder !== 'all') out = out.filter((r) => String(r.builder?._id || r.builder) === builder)
    if (payment !== 'all') out = out.filter((r) => (r.paymentStatus || 'pending') === payment)
    if (dateRange !== 'all') {
      out = out.filter((r) => {
        const d = new Date(r.bookingDate || r.createdAt)
        if (dateRange === 'today') return d >= todayStart
        if (dateRange === 'week') { const w = new Date(todayStart); w.setDate(w.getDate() - 7); return d >= w }
        if (dateRange === 'month') { const m = new Date(todayStart); m.setDate(m.getDate() - 30); return d >= m }
        return true
      })
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter((r) => [r.customer?.name, r.customer?.mobile, bookingId(r)].some((v) => (v || '').toLowerCase().includes(q)))
    }
    const sorted = [...out]
    if (sort === 'latest') sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    else if (sort === 'booking_date') sorted.sort((a, b) => new Date(b.bookingDate || b.createdAt) - new Date(a.bookingDate || a.createdAt))
    else if (sort === 'name') sorted.sort((a, b) => (a.customer?.name || '').localeCompare(b.customer?.name || ''))
    return sorted
  }, [rows, status, project, builder, payment, dateRange, search, sort]) // eslint-disable-line

  const projName = (r) => r.project?.name || '—'
  const refetchAndClose = (setter) => { setter(null); refetch() }

  const columns = [
    { key: 'id', header: 'Booking ID', render: (r) => <span className="font-mono text-xs text-slate-500">{bookingId(r)}</span> },
    { key: 'customer', header: 'Customer', render: (r) => (
      <div className="min-w-[8rem]"><div className="font-medium text-slate-900">{r.customer?.name || '—'}</div><div className="text-xs text-slate-500">{r.customer?.mobile || ''}</div></div>
    ) },
    { key: 'project', header: 'Project', render: projName },
    { key: 'unit', header: 'Unit', render: (r) => r.unit?.unitNumber || '—' },
    { key: 'date', header: 'Booking Date', render: (r) => formatDate(r.bookingDate || r.createdAt) },
    { key: 'amount', header: 'Amount', render: (r) => inr(r.bookingAmount) },
    { key: 'pay', header: 'Payment', render: (r) => <Pill meta={PAY_META} s={r.paymentStatus || 'pending'} /> },
    { key: 'status', header: 'Status', render: (r) => (
      <div className="flex flex-col items-start gap-0.5">
        <Pill meta={STATUS_META} s={r.status} />
        {r.discountRequest?.status === 'pending' && <span className="text-[10px] text-amber-600">Discount pending</span>}
        {r.cancellationRequest?.status === 'pending' && <span className="text-[10px] text-rose-600">Cancellation pending</span>}
      </div>
    ) },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex items-center justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setDetailsFor(r) }}>View</Button>
        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setSheetFor(r) }}>Actions ▾</Button>
      </div>
    ) },
  ]

  return (
    <div>
      <PageHeader
        title="Bookings"
        subtitle="Create, manage, and track customer bookings from reservation to confirmation."
        actions={<Button onClick={() => setCreating(true)}>+ Create Booking</Button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Bookings" value={kpis.total} />
        <StatCard label="Pending Approval" value={kpis.pending} />
        <StatCard label="Confirmed Bookings" value={kpis.confirmed} />
        <StatCard label="Cancelled Bookings" value={kpis.cancelled} />
      </div>

      <Card className="mb-4 p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-7">
          <div className="col-span-2 md:col-span-1">
            <Input label="Search" placeholder="Customer, mobile, booking ID" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select label="Booking Status" value={status} onChange={(e) => setStatus(e.target.value)}>
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
          <Select label="Payment Status" value={payment} onChange={(e) => setPayment(e.target.value)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="completed">Completed</option>
          </Select>
          <Select label="Date Range" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
          </Select>
          <Select label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="latest">Latest Booking</option>
            <option value="booking_date">Booking Date</option>
            <option value="name">Customer Name</option>
          </Select>
        </div>
      </Card>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <Table columns={columns} rows={filtered} empty="No bookings match your filters." onRowClick={(r) => setDetailsFor(r)} />
      )}

      {creating && <BookingFormModal projects={projects || []} builders={builders || []} onClose={() => setCreating(false)} onDone={() => { setCreating(false); refetch() }} />}
      {editing && <BookingFormModal booking={editing} projects={projects || []} builders={builders || []} onClose={() => setEditing(null)} onDone={() => { setEditing(null); refetch() }} />}
      {paymentFor && <PaymentEntryModal booking={paymentFor} onClose={() => setPaymentFor(null)} onDone={() => refetchAndClose(setPaymentFor)} />}
      {discountFor && <RequestDiscountModal booking={discountFor} onClose={() => setDiscountFor(null)} onDone={() => refetchAndClose(setDiscountFor)} />}
      {cancelFor && <RequestCancellationModal booking={cancelFor} onClose={() => setCancelFor(null)} onDone={() => refetchAndClose(setCancelFor)} />}
      {docsFor && <UploadDocumentsModal booking={docsFor} onClose={() => setDocsFor(null)} onDone={() => refetchAndClose(setDocsFor)} />}
      {sheetFor && (
        <BookingActionSheet
          booking={sheetFor}
          onClose={() => setSheetFor(null)}
          onView={() => { const r = sheetFor; setSheetFor(null); setDetailsFor(r) }}
          onEdit={() => { setEditing(sheetFor); setSheetFor(null) }}
          onSubmit={async () => { try { await bookingsApi.submit(sheetFor._id); toast.success('Submitted for approval'); setSheetFor(null); refetch() } catch (e) { toast.error(e.response?.data?.message || 'Failed') } }}
          onPayment={() => { setPaymentFor(sheetFor); setSheetFor(null) }}
          onDocs={() => { setDocsFor(sheetFor); setSheetFor(null) }}
          onDiscount={() => { setDiscountFor(sheetFor); setSheetFor(null) }}
          onCancel={() => { setCancelFor(sheetFor); setSheetFor(null) }}
        />
      )}
      {detailsFor && (
        <BookingDetailsDrawer
          bookingRow={detailsFor}
          onClose={() => setDetailsFor(null)}
          onEdit={() => { setEditing(detailsFor); setDetailsFor(null) }}
          onSubmit={async () => { try { await bookingsApi.submit(detailsFor._id); toast.success('Submitted for approval'); setDetailsFor(null); refetch() } catch (e) { toast.error(e.response?.data?.message || 'Failed') } }}
          onPayment={() => { setPaymentFor(detailsFor); setDetailsFor(null) }}
          onDocs={() => { setDocsFor(detailsFor); setDetailsFor(null) }}
          onDiscount={() => { setDiscountFor(detailsFor); setDetailsFor(null) }}
          onCancel={() => { setCancelFor(detailsFor); setDetailsFor(null) }}
        />
      )}
    </div>
  )
}

// ─── Action sheet (spec §Bookings Table · Actions) ──────────────────────────────
function BookingActionSheet({ booking, onClose, onView, onEdit, onSubmit, onPayment, onDocs, onDiscount, onCancel }) {
  const s = booking.status
  const items = [
    { label: 'View Details', icon: '👁', onClick: onView, show: true },
    { label: 'Submit Booking', icon: '📤', onClick: onSubmit, show: s === 'draft' },
    { label: 'Edit Draft', icon: '✏️', onClick: onEdit, show: s === 'draft' },
    { label: 'Record Payment', icon: '💰', onClick: onPayment, show: ['reserved', 'confirmed', 'sale_completed'].includes(s) },
    { label: 'Upload Documents', icon: '📎', onClick: onDocs, show: s !== 'cancelled' },
    { label: booking.discountRequest?.status === 'pending' ? 'Discount request pending' : 'Request Discount', icon: '％', onClick: onDiscount, show: ['draft', 'reserved'].includes(s), disabled: booking.discountRequest?.status === 'pending' },
    { label: booking.cancellationRequest?.status === 'pending' ? 'Cancellation pending' : 'Request Cancellation', icon: '✕', onClick: onCancel, show: ['reserved', 'confirmed', 'sale_completed'].includes(s), disabled: booking.cancellationRequest?.status === 'pending' },
  ].filter((i) => i.show)

  return (
    <Modal open onClose={onClose} title={bookingId(booking)}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <p className="mb-3 text-xs text-slate-500">{booking.customer?.name} · {booking.project?.name} · <Pill meta={STATUS_META} s={booking.status} /></p>
      <div className="grid grid-cols-1 gap-2">
        {items.map((i) => (
          <button key={i.label} onClick={i.onClick} disabled={i.disabled}
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-medium transition ${
              i.disabled ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400' : 'border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
            }`}>
            <span className="text-base">{i.icon}</span> {i.label}
          </button>
        ))}
      </div>
    </Modal>
  )
}

// ─── Discount Section (spec §Discount Section) — reusable ────────────────────────
const GIVEN_BY = [['admin', 'Admin'], ['sub_admin', 'Sub-Admin'], ['builder_sales_executive', 'Builder Sales Executive']]
const SOURCES = [['firm', 'Firm'], ['builder', 'Builder'], ['combined', 'Combined']]

function DiscountSection({ value, onChange, saleAmount }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value })
  const setUnit = (k) => (e) => onChange({ ...value, [k]: e.target.value })

  const toRupees = (amt, unit) => (unit === '%' ? Math.round((Number(saleAmount) || 0) * (Number(amt) || 0) / 100) : Number(amt) || 0)
  const firmRs = toRupees(value.firmDiscount, value.firmUnit)
  const builderRs = toRupees(value.builderDiscount, value.builderUnit)
  const totalDiscount = firmRs + builderRs
  const finalSale = Math.max(0, (Number(saleAmount) || 0) - totalDiscount)

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Discount Details (optional)</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Sale Amount (from unit price)</label>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800">{money(saleAmount)}</div>
        </div>
        <Select label="Discount Given By" value={value.givenBy || ''} onChange={set('givenBy')}>
          <option value="">Select…</option>
          {GIVEN_BY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        {value.givenBy === 'builder_sales_executive' && (
          <Input label="Builder Sales Executive" value={value.builderSalesExecutive || ''} onChange={set('builderSalesExecutive')} placeholder="Name" />
        )}
        <Select label="Discount Source" value={value.source || ''} onChange={set('source')}>
          <option value="">Select…</option>
          {SOURCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Firm Discount</label>
          <div className="flex gap-2">
            <Input type="number" value={value.firmDiscount || ''} onChange={set('firmDiscount')} />
            <select value={value.firmUnit || '₹'} onChange={setUnit('firmUnit')} className="rounded-lg border border-slate-300 px-2 text-sm"><option>₹</option><option>%</option></select>
          </div>
          {value.firmUnit === '%' && <p className="mt-0.5 text-[10px] text-slate-500">= {money(firmRs)}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Builder Discount</label>
          <div className="flex gap-2">
            <Input type="number" value={value.builderDiscount || ''} onChange={set('builderDiscount')} />
            <select value={value.builderUnit || '₹'} onChange={setUnit('builderUnit')} className="rounded-lg border border-slate-300 px-2 text-sm"><option>₹</option><option>%</option></select>
          </div>
          {value.builderUnit === '%' && <p className="mt-0.5 text-[10px] text-slate-500">= {money(builderRs)}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
        <div className="flex justify-between"><span className="text-slate-500">Total Discount</span><span className="font-semibold text-rose-600">{money(totalDiscount)}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Final Sale Amount</span><span className="font-semibold text-emerald-700">{money(finalSale)}</span></div>
      </div>
      {totalDiscount > 0 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Discount Remarks <span className="text-rose-500">*</span></label>
          <textarea rows={2} value={value.remarks || ''} onChange={set('remarks')} placeholder="Reason / approval context (mandatory)"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </div>
      )}
      <Input label="Supporting Document URL (optional)" value={value.supportingUrl || ''} onChange={set('supportingUrl')} placeholder="Link to an uploaded document" />
    </div>
  )
}

// Convert the DiscountSection state into the API payload (or null if empty).
function discountPayload(value, saleAmount) {
  const toRupees = (amt, unit) => (unit === '%' ? Math.round((Number(saleAmount) || 0) * (Number(amt) || 0) / 100) : Number(amt) || 0)
  const firmDiscount = toRupees(value.firmDiscount, value.firmUnit)
  const builderDiscount = toRupees(value.builderDiscount, value.builderUnit)
  if (!firmDiscount && !builderDiscount) return null
  return {
    saleAmount: Number(saleAmount) || 0,
    givenBy: value.givenBy || undefined,
    builderSalesExecutive: value.builderSalesExecutive || undefined,
    source: value.source || undefined,
    firmDiscount,
    builderDiscount,
    remarks: value.remarks || '',
    supportingDocument: value.supportingUrl ? { label: 'Supporting document', fileUrl: value.supportingUrl } : undefined,
  }
}

// ─── Create / Edit Booking (spec §Create Booking) ───────────────────────────────
function BookingFormModal({ booking, projects, builders, onClose, onDone }) {
  const toast = useToast()
  const isEdit = !!booking
  const [customers, setCustomers] = useState([])
  const [units, setUnits] = useState([])
  const [form, setForm] = useState({
    customer: booking?.customer?._id || '',
    builder: booking?.builder?._id || '',
    project: booking?.project?._id || '',
    unit: booking?.unit?._id || '',
    bookingDate: (booking?.bookingDate || booking?.createdAt || new Date().toISOString()).slice(0, 10),
    bookingAmount: booking?.bookingAmount || '',
    paymentMode: booking?.paymentMode || 'cheque',
    tokenAmount: booking?.amountReceived || '',
    notes: booking?.notes || '',
  })
  const [discount, setDiscount] = useState({})
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    if (isEdit) return
    customersApi.list({ limit: 500 }).then((res) => setCustomers(res.data.data || [])).catch(() => {})
  }, [isEdit])

  useEffect(() => {
    if (!form.project) { setUnits([]); return }
    unitsApi.list({ project: form.project, status: 'available', limit: 200 }).then((res) => setUnits(res.data.data || [])).catch(() => setUnits([]))
  }, [form.project])

  const selectedUnit = units.find((u) => u._id === form.unit) || (isEdit ? booking.unit : null)
  const saleAmount = unitPrice(selectedUnit) || Number(form.bookingAmount) || 0
  const valid = form.customer && form.project && form.unit && Number(form.bookingAmount) > 0

  async function save(asDraft) {
    if (!valid) { toast.error('Customer, project, unit and booking amount are required'); return }
    const disc = discountPayload(discount, saleAmount)
    if (disc && !disc.remarks.trim()) { toast.error('Discount remarks are mandatory'); return }
    setBusy(true)
    try {
      const payload = {
        customer: form.customer, project: form.project, unit: form.unit,
        builder: form.builder || undefined,
        bookingDate: form.bookingDate, bookingAmount: Number(form.bookingAmount),
        paymentMode: form.paymentMode, tokenAmount: form.tokenAmount ? Number(form.tokenAmount) : undefined,
        notes: form.notes || undefined,
      }
      if (isEdit) {
        await bookingsApi.update(booking._id, payload)
        toast.success('Draft updated')
      } else {
        await bookingsApi.create({ ...payload, draft: asDraft, discount: disc || undefined })
        toast.success(asDraft ? 'Draft saved' : 'Booking submitted for approval')
      }
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} wide title={isEdit ? `Edit Draft — ${bookingId(booking)}` : 'Create Booking'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          {isEdit ? (
            <Button onClick={() => save(true)} disabled={busy}>Save Changes</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => save(true)} disabled={busy}>Save Draft</Button>
              <Button onClick={() => save(false)} disabled={busy}>Submit Booking</Button>
            </>
          )}
        </>
      }
    >
      <p className="mb-3 text-xs text-slate-500">A booking can only be created for an existing customer assigned to you.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {isEdit ? (
          <Input label="Customer" value={booking.customer?.name || ''} disabled />
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
        <Select label="Project *" value={form.project} onChange={(e) => setForm((f) => ({ ...f, project: e.target.value, unit: '' }))}>
          <option value="">Select…</option>
          {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </Select>
        <Select label="Unit *" value={form.unit} onChange={set('unit')} disabled={!form.project}>
          <option value="">{form.project ? (units.length ? 'Select available unit…' : 'No available units') : 'Pick a project first'}</option>
          {isEdit && booking.unit && !units.find((u) => u._id === booking.unit._id) && <option value={booking.unit._id}>{booking.unit.unitNumber} (current)</option>}
          {units.map((u) => <option key={u._id} value={u._id}>{u.unitNumber}{unitPrice(u) ? ` · ${money(unitPrice(u))}` : ''}</option>)}
        </Select>
        <Input label="Booking Date" type="date" value={form.bookingDate} onChange={set('bookingDate')} />
        <Input label="Booking Amount *" type="number" value={form.bookingAmount} onChange={set('bookingAmount')} />
        <Select label="Payment Mode" value={form.paymentMode} onChange={set('paymentMode')}>
          {PAYMENT_MODES.map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}
        </Select>
        <Input label="Token Amount" type="number" value={form.tokenAmount} onChange={set('tokenAmount')} placeholder="Amount paid now" />
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
          <textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Any notes about this booking…"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </div>
      </div>

      {!isEdit && (
        <div className="mt-4">
          <DiscountSection value={discount} onChange={setDiscount} saleAmount={saleAmount} />
          <p className="mt-2 text-xs text-slate-500">Any discount entered is submitted as a request for Sub-Admin/Admin approval — you cannot approve it yourself.</p>
        </div>
      )}
    </Modal>
  )
}

// ─── Payment Entry (spec §Payment Entry) ────────────────────────────────────────
function PaymentEntryModal({ booking, onClose, onDone }) {
  const toast = useToast()
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), amount: '', mode: 'cheque', reference: '', receiptUrl: '', remarks: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    if (!(Number(form.amount) > 0)) { toast.error('Enter a valid amount'); return }
    setBusy(true)
    try {
      await bookingsApi.addPayment(booking._id, { ...form, amount: Number(form.amount) })
      toast.success('Payment recorded')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Record Payment — ${bookingId(booking)}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>Save</Button></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Payment Date" type="date" value={form.date} onChange={set('date')} />
        <Input label="Amount *" type="number" value={form.amount} onChange={set('amount')} />
        <Select label="Payment Mode" value={form.mode} onChange={set('mode')}>
          {PAYMENT_MODES.map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}
        </Select>
        <Input label="Transaction Reference" value={form.reference} onChange={set('reference')} />
        <div className="sm:col-span-2"><Input label="Payment Receipt URL (optional)" value={form.receiptUrl} onChange={set('receiptUrl')} placeholder="Link to uploaded receipt" /></div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">Remarks</label>
          <textarea rows={2} value={form.remarks} onChange={set('remarks')}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </div>
      </div>
    </Modal>
  )
}

// ─── Request Discount (spec §Request Discount) ──────────────────────────────────
function RequestDiscountModal({ booking, onClose, onDone }) {
  const toast = useToast()
  const [discount, setDiscount] = useState({})
  const [busy, setBusy] = useState(false)
  const saleAmount = booking.discount?.saleAmount || booking.totalValue || unitPrice(booking.unit) || 0

  async function submit() {
    const disc = discountPayload(discount, saleAmount)
    if (!disc) { toast.error('Enter a firm or builder discount'); return }
    if (!disc.remarks.trim()) { toast.error('Discount remarks are mandatory'); return }
    setBusy(true)
    try {
      await bookingsApi.requestDiscount(booking._id, disc)
      toast.success('Discount request submitted for approval')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} wide title={`Request Discount — ${bookingId(booking)}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>Submit Request</Button></>}
    >
      <p className="mb-3 text-sm text-slate-600">Enter the discount details. This is sent to your Sub-Admin/Admin for approval — you cannot approve discounts yourself.</p>
      <DiscountSection value={discount} onChange={setDiscount} saleAmount={saleAmount} />
    </Modal>
  )
}

// ─── Request Cancellation (spec §Request Booking Cancellation) ──────────────────
function RequestCancellationModal({ booking, onClose, onDone }) {
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!reason.trim()) { toast.error('Cancellation reason is required'); return }
    setBusy(true)
    try {
      await bookingsApi.requestCancellation(booking._id, { reason, remarks })
      toast.success('Cancellation request submitted for approval')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Request Cancellation — ${bookingId(booking)}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="danger" onClick={submit} disabled={busy}>Submit Request</Button></>}
    >
      <p className="mb-3 text-sm text-slate-600">You cannot cancel a booking directly. This request goes to your Sub-Admin (Admin for final approval if required).</p>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Cancellation Reason *</label>
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Select a reason…</option>
            {['Customer backed out', 'Payment default', 'Found another property', 'Financing fell through', 'Duplicate booking', 'Other'].map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Remarks</label>
          <textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </div>
      </div>
    </Modal>
  )
}

// ─── Upload Documents (spec §Documents) ─────────────────────────────────────────
const DOC_CATEGORIES = [['booking_form', 'Booking Form'], ['kyc', 'Customer KYC'], ['agreement', 'Agreement Document'], ['receipt', 'Payment Receipt'], ['other', 'Other Supporting Document']]

function UploadDocumentsModal({ booking, onClose, onDone }) {
  const toast = useToast()
  const [category, setCategory] = useState('booking_form')
  const [busy, setBusy] = useState(false)

  async function upload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('label', file.name)
    fd.append('category', category)
    setBusy(true)
    try {
      await bookingsApi.uploadDocument(booking._id, fd)
      toast.success('Document uploaded')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed')
    } finally { setBusy(false); e.target.value = '' }
  }

  return (
    <Modal open onClose={onClose} title={`Upload Documents — ${bookingId(booking)}`}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-4">
        <Select label="Document Type" value={category} onChange={(e) => setCategory(e.target.value)}>
          {DOC_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <label className="block text-sm text-slate-700">
          <span className="mb-2 block">Choose a file (PDF, image, DOC — max 10MB)</span>
          <input type="file" onChange={upload} disabled={busy} className="text-sm text-slate-600" />
        </label>
        {(booking.documents || []).length > 0 && (
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Uploaded</p>
            <ul className="space-y-1 text-sm">
              {booking.documents.map((d) => <li key={d._id} className="flex justify-between"><span>{d.label}</span><span className="text-xs text-slate-500">{titleCase(d.category || 'other')}</span></li>)}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Booking Details Drawer (spec §Booking Details — 6 sections) ────────────────
function BookingDetailsDrawer({ bookingRow, onClose, onEdit, onSubmit, onPayment, onDocs, onDiscount, onCancel }) {
  const { data, loading } = useFetch(useCallback(() => bookingsApi.get(bookingRow._id), [bookingRow._id]))
  const b = data || bookingRow
  const disc = b.discount || (b.discountRequest?.status === 'approved' ? b.discountRequest : null)
  const pendingDisc = b.discountRequest?.status === 'pending' ? b.discountRequest : null
  const sale = disc?.saleAmount || b.totalValue || 0
  const paid = b.amountReceived || 0
  const finalSale = disc?.finalSaleAmount || b.totalValue || 0
  const pending = Math.max(0, finalSale - paid)
  const timeline = (b.timeline || []).slice().reverse()

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col overflow-hidden bg-white shadow-2xl">
        <div className="flex items-start justify-between bg-slate-900 px-6 py-5 text-white">
          <div>
            <h2 className="text-lg font-bold">{bookingId(b)}</h2>
            <p className="mt-0.5 text-xs text-slate-400">{b.customer?.name} · <span className="text-slate-300">{STATUS_META[b.status]?.label || b.status}</span></p>
          </div>
          <button onClick={onClose} className="mt-0.5 rounded-lg p-1 text-slate-400 hover:text-white">✕</button>
        </div>

        {loading && !data ? <div className="flex flex-1 items-center justify-center"><Loader /></div> : (
          <div className="flex-1 space-y-6 overflow-y-auto p-6">
            <Section title="1 · Customer Information">
              <Info rows={[['Name', b.customer?.name], ['Mobile', b.customer?.mobile], ['Email', b.customer?.email]]} />
            </Section>

            <Section title="2 · Property Information">
              <Info rows={[
                ['Builder', b.builder?.name || b.project?.builder?.name],
                ['Project', b.project?.name],
                ['Property Type', b.unit?.propertyType ? titleCase(b.unit.propertyType) : null],
                ['Configuration', b.unit?.configuration],
                ['Tower / Wing', b.unit?.tower],
                ['Floor', b.unit?.floor],
                ['Unit Number', b.unit?.unitNumber],
              ]} />
            </Section>

            <Section title="3 · Booking Information">
              <Info rows={[
                ['Booking ID', bookingId(b)],
                ['Booking Date', formatDate(b.bookingDate || b.createdAt)],
                ['Booking Amount', money(b.bookingAmount)],
                ['Booking Source', titleCase(b.bookingSource || 'direct')],
                ['Booking Status', STATUS_META[b.status]?.label || b.status],
                ['Notes', b.notes],
              ]} />
            </Section>

            <Section title="4 · Payment Details">
              <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-center text-sm">
                <div><div className="text-[10px] uppercase text-slate-400">Sale Value</div><div className="font-semibold">{money(finalSale)}</div></div>
                <div><div className="text-[10px] uppercase text-slate-400">Paid</div><div className="font-semibold text-emerald-700">{money(paid)}</div></div>
                <div><div className="text-[10px] uppercase text-slate-400">Pending</div><div className="font-semibold text-rose-600">{money(pending)}</div></div>
              </div>
              <div className="mt-2"><Pill meta={PAY_META} s={b.paymentStatus || 'pending'} /></div>
              {(b.payments || []).length > 0 && (
                <ul className="mt-3 space-y-2">
                  {b.payments.slice().reverse().map((p) => (
                    <li key={p._id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                      <div><div className="font-medium">{money(p.amount)}</div><div className="text-xs text-slate-500">{titleCase(p.mode)}{p.reference ? ` · ${p.reference}` : ''}</div></div>
                      <div className="text-right text-xs text-slate-500">{formatDate(p.date)}{p.receiptUrl && <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="ml-2 text-blue-600 underline">Receipt</a>}</div>
                    </li>
                  ))}
                </ul>
              )}
              {['reserved', 'confirmed', 'sale_completed'].includes(b.status) && <Button size="sm" variant="secondary" className="mt-3" onClick={onPayment}>+ Add Payment Entry</Button>}
            </Section>

            {(disc || pendingDisc) && (
              <Section title="Discount Summary">
                {pendingDisc && <p className="mb-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">Pending approval</p>}
                <Info rows={[
                  ['Sale Amount', money((disc || pendingDisc).saleAmount)],
                  ['Discount Given By', (disc || pendingDisc).givenBy ? titleCase((disc || pendingDisc).givenBy) : null],
                  ['Builder Sales Executive', (disc || pendingDisc).builderSalesExecutive],
                  ['Discount Source', (disc || pendingDisc).source ? titleCase((disc || pendingDisc).source) : null],
                  ['Firm Discount', money((disc || pendingDisc).firmDiscount)],
                  ['Builder Discount', money((disc || pendingDisc).builderDiscount)],
                  ['Total Discount', money((disc || pendingDisc).totalDiscount)],
                  ['Final Sale Amount', money((disc || pendingDisc).finalSaleAmount)],
                  ['Remarks', (disc || pendingDisc).remarks],
                ]} />
              </Section>
            )}

            <Section title="5 · Documents">
              {(b.documents || []).length === 0 ? <p className="text-xs italic text-slate-400">No documents uploaded.</p> : (
                <ul className="space-y-1 text-sm">
                  {b.documents.map((d) => (
                    <li key={d._id} className="flex items-center justify-between">
                      <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">{d.label}</a>
                      <span className="text-xs text-slate-500">{titleCase(d.category || 'other')}</span>
                    </li>
                  ))}
                </ul>
              )}
              {b.status !== 'cancelled' && <Button size="sm" variant="secondary" className="mt-3" onClick={onDocs}>Upload Documents</Button>}
            </Section>

            <Section title="6 · Booking Timeline">
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
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3">
          {b.status === 'draft' && <><Button size="sm" variant="secondary" onClick={onEdit}>Edit</Button><Button size="sm" onClick={onSubmit}>Submit</Button></>}
          {['draft', 'reserved'].includes(b.status) && b.discountRequest?.status !== 'pending' && <Button size="sm" variant="secondary" onClick={onDiscount}>Request Discount</Button>}
          {['reserved', 'confirmed', 'sale_completed'].includes(b.status) && b.cancellationRequest?.status !== 'pending' && <Button size="sm" variant="danger" onClick={onCancel}>Request Cancellation</Button>}
        </div>
      </div>
    </div>
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
