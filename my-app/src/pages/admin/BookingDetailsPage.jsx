import { useCallback, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { bookingsApi, usersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { formatDate, formatMoney, titleCase } from '../../lib/format.js'
import {
  Card, Button, Input, Select, Textarea, Table, StatusBadge, Modal, Loader, ErrorState,
} from '../../components/ui.jsx'
import { TransferBookingModal } from './AdminBookingsPage.jsx'

const money = (n) => formatMoney(n ?? 0)

function Section({ title, action, children }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {action}
      </div>
      {children}
    </Card>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || value === 0 ? value : '—'}</dd>
    </div>
  )
}

export default function BookingDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { can } = useAuth()
  const toast = useToast()
  const { data: booking, loading, error, refetch } = useFetch(useCallback(() => bookingsApi.get(id), [id]))
  const { data: execs } = useFetch(useCallback(() => usersApi.list({ role: 'sales_executive', status: 'active', limit: 200 }), []))

  const [modal, setModal] = useState(null) // 'discount' | 'payment' | 'registration' | 'edit' | 'transfer'

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (!booking) return null

  const editable = can('booking', 'edit')
  const d = booking.discount
  const basePrice = d?.saleAmount || booking.unit?.basePrice || booking.unit?.price || booking.totalValue || 0
  const finalValue = d?.finalSaleAmount || booking.totalValue || 0
  const totalDiscount = d?.totalDiscount || 0
  const paid = booking.amountReceived || 0
  const balance = Math.max(0, finalValue - paid)
  const shortId = booking._id?.slice(-8).toUpperCase()

  async function setStatus(status, cancelReason) {
    try { await bookingsApi.setStatus(booking._id, { status, cancelReason }); toast.success(`Booking ${status}`); refetch() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }
  async function removeDiscount() {
    if (!window.confirm('Remove the discount from this booking? This is recorded in the discount history.')) return
    try { await bookingsApi.removeDiscount(booking._id); toast.success('Discount removed'); refetch() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }

  const close = () => setModal(null)
  const done = () => { setModal(null); refetch() }

  // Section 8 — timeline steps derived from the booking's current state.
  const steps = [
    { label: 'Booking Reserved', done: true, at: booking.createdAt },
    { label: 'Booking Confirmed', done: ['confirmed', 'sale_completed'].includes(booking.status) },
    { label: 'Payment Completed', done: booking.paymentStatus === 'completed' },
    { label: 'Registration Completed', done: booking.registrationStatus === 'completed', at: booking.registrationDate },
    { label: 'Sale Completed', done: booking.status === 'sale_completed' },
  ]

  // Section 9 — activity log synthesised from booking data.
  const activity = [
    { at: booking.createdAt, text: `Booking created for ${booking.customer?.name || 'buyer'}` },
    ...(booking.payments || []).map((p) => ({ at: p.date || p.createdAt, text: `Payment recorded — ${money(p.amount)}${p.mode ? ` (${titleCase(p.mode)})` : ''}` })),
    ...(booking.discountHistory || []).map((h) => ({ at: h.at, text: `Discount ${h.action} — total ${money(h.totalDiscount)}, final ${money(h.finalSaleAmount)}${h.actorName ? ` by ${h.actorName}` : ''}` })),
    ...(booking.registrationDate ? [{ at: booking.registrationDate, text: `Registration ${titleCase(booking.registrationStatus)}` }] : []),
  ].filter((a) => a.at).sort((a, b) => new Date(b.at) - new Date(a.at))

  return (
    <div className="print:bg-white">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <button onClick={() => navigate(-1)} className="text-sm text-slate-500 hover:text-slate-700">← Back</button>
        <div className="flex flex-wrap items-center gap-2">
          {editable && booking.status === 'reserved' && (
            <>
              <Button size="sm" variant="success" onClick={() => setStatus('confirmed')}>Confirm Booking</Button>
              <Button size="sm" variant="danger" onClick={() => { const r = window.prompt('Cancellation reason?'); if (r != null) setStatus('cancelled', r) }}>Cancel Booking</Button>
            </>
          )}
          {editable && <Button size="sm" variant="secondary" onClick={() => setModal('edit')}>Edit Booking</Button>}
          {editable && <Button size="sm" variant="secondary" onClick={() => setModal('transfer')}>Transfer</Button>}
          {can('payment', 'create') && booking.status !== 'cancelled' && (
            <Button size="sm" onClick={() => navigate(`${window.location.pathname.startsWith('/sub-admin') ? '/sub-admin' : '/admin'}/payments?add=${booking._id}`)}>Add Payment</Button>
          )}
          {can('legal', 'create') && booking.status !== 'cancelled' && (
            <Button size="sm" variant="secondary" onClick={() => navigate(`${window.location.pathname.startsWith('/sub-admin') ? '/sub-admin' : '/admin'}/legal?add=${booking._id}`)}>Create Legal Case</Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => window.print()}>Print</Button>
        </div>
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">Booking #{shortId}</h1>
            <StatusBadge status={booking.status} />
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {booking.customer?.name} · {booking.project?.name || '—'} · Unit {booking.unit?.unitNumber || '—'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Section 1 — Booking Information */}
        <Section title="Booking Information">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            <Field label="Booking ID" value={shortId} />
            <Field label="Booking Date" value={formatDate(booking.createdAt)} />
            <Field label="Booking Status" value={<StatusBadge status={booking.status} />} />
            <Field label="Booking Source" value={titleCase(booking.bookingSource)} />
          </dl>
        </Section>

        {/* Section 2 — Buyer Information */}
        <Section title="Buyer Information">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            <Field label="Buyer Name" value={booking.customer?.name} />
            <Field label="Mobile Number" value={booking.customer?.mobile} />
            <Field label="Email" value={booking.customer?.email} />
            <Field label="Address" value={booking.customer?.address} />
            <Field label="KYC Status" value={booking.customer?.kycStatus ? <StatusBadge status={booking.customer.kycStatus} /> : '—'} />
          </dl>
        </Section>

        {/* Section 3 — Property Information */}
        <Section title="Property Information">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            <Field label="Builder" value={booking.project?.builder?.name} />
            <Field label="Project" value={booking.project?.name} />
            <Field label="Property Unit" value={booking.unit?.unitNumber} />
            <Field label="Property Type" value={titleCase(booking.unit?.propertyType || booking.project?.propertyType)} />
            <Field label="Configuration" value={booking.unit?.configuration || booking.unit?.unitType} />
            <Field label="Area" value={booking.unit?.areaSqft ? `${booking.unit.areaSqft} sq.ft` : null} />
          </dl>
        </Section>

        {/* Section 4 — Pricing */}
        <Section title="Pricing">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            <Field label="Base Price" value={money(basePrice)} />
            <Field label="Approved Discount" value={totalDiscount ? money(totalDiscount) : (booking.appliedDiscount ? `${booking.appliedDiscount}%` : '—')} />
            <Field label="Final Sale Value" value={<span className="font-semibold text-slate-900">{money(finalValue)}</span>} />
            <Field label="Brokerage / Commission" value={<span className="font-medium text-emerald-600">{money(booking.commissionEarned)}</span>} />
          </dl>
        </Section>
      </div>

      {/* Section 5 — Payment Information */}
      <div className="mt-6">
        <Section
          title="Payment Information"
          action={editable && <Button size="sm" onClick={() => setModal('payment')}>Add Payment</Button>}
        >
          <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Total Amount" value={money(finalValue)} />
            <Field label="Amount Paid" value={money(paid)} />
            <Field label="Balance Amount" value={money(balance)} />
            <Field label="Payment Status" value={<StatusBadge status={booking.paymentStatus || 'pending'} />} />
          </div>
          <Table
            columns={[
              { key: 'date', header: 'Date', render: (p) => formatDate(p.date || p.createdAt) },
              { key: 'amount', header: 'Amount', render: (p) => money(p.amount) },
              { key: 'mode', header: 'Mode', render: (p) => titleCase(p.mode) },
              { key: 'reference', header: 'Reference', render: (p) => p.reference || '—' },
              { key: 'receiptNumber', header: 'Receipt', render: (p) => p.receiptNumber || '—' },
              { key: 'recordedBy', header: 'Recorded By', render: (p) => p.recordedBy?.name || '—' },
            ]}
            rows={booking.payments || []}
            empty="No payments recorded yet."
          />
        </Section>
      </div>

      {/* Section 6 — Registration Information */}
      <div className="mt-6">
        <Section
          title="Registration Information"
          action={editable && <Button size="sm" variant="secondary" onClick={() => setModal('registration')}>Update Registration</Button>}
        >
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <Field label="Registration Status" value={<StatusBadge status={booking.registrationStatus || 'pending'} />} />
            <Field label="Registration Date" value={booking.registrationDate ? formatDate(booking.registrationDate) : '—'} />
            <Field label="Agreement Number" value={booking.agreementNumber} />
            <Field label="Agreement Upload" value={booking.agreementDocuments?.length ? `${booking.agreementDocuments.length} file(s)` : '—'} />
          </dl>
          {booking.registrationRemarks && <p className="mt-3 text-sm text-slate-600">Remarks: {booking.registrationRemarks}</p>}
        </Section>
      </div>

      {/* Section 7 — Assigned Team */}
      <div className="mt-6">
        <Section title="Assigned Team">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <Field label="Branch" value={booking.bookedBy?.branch} />
            <Field label="Sub-Admin" value={booking.assignedSubAdmin?.name} />
            <Field label="Sales Executive" value={booking.bookedBy?.name} />
          </dl>
        </Section>
      </div>

      {/* Booking Transfer History (spec §Booking Transfer) */}
      {booking.transferHistory?.length > 0 && (
        <div className="mt-6">
          <Section title="Transfer History">
            <Table
              columns={[
                { key: 'at', header: 'Date & Time', render: (t) => formatDate(t.at, true) },
                { key: 'prev', header: 'Previous Executive', render: (t) => t.previousExecutiveName || '—' },
                { key: 'new', header: 'New Executive', render: (t) => <span className="font-medium text-slate-800">{t.newExecutiveName || '—'}</span> },
                { key: 'by', header: 'Transferred By', render: (t) => t.transferredByName || '—' },
                { key: 'reason', header: 'Reason', render: (t) => t.reason || '—' },
              ]}
              rows={[...booking.transferHistory].reverse()}
              empty="No transfers."
            />
          </Section>
        </div>
      )}

      {/* Discount Information (spec §Discount Information) */}
      <div className="mt-6">
        <Section
          title="Discount Information"
          action={editable && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setModal('discount')}>{d ? 'Update Discount' : 'Add Discount'}</Button>
              {d && <Button size="sm" variant="danger" onClick={removeDiscount}>Remove</Button>}
            </div>
          )}
        >
          {d ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <Field label="Sale Amount" value={money(d.saleAmount)} />
              <Field label="Discount Given By" value={titleCase(d.givenBy)} />
              <Field label="Builder Sales Executive" value={d.builderSalesExecutive} />
              <Field label="Discount Source" value={titleCase(d.source)} />
              <Field label="Firm Discount" value={money(d.firmDiscount)} />
              <Field label="Builder Discount" value={money(d.builderDiscount)} />
              <Field label="Total Discount" value={<span className="font-medium">{money(d.totalDiscount)}</span>} />
              <Field label="Final Sale Amount" value={<span className="font-semibold text-slate-900">{money(d.finalSaleAmount)}</span>} />
              <Field label="Remarks" value={d.remarks} />
            </dl>
          ) : (
            <p className="py-6 text-center text-sm text-slate-400">No discount applied to this booking.</p>
          )}
        </Section>
      </div>

      {/* Discount History (spec §Discount History) */}
      {(booking.discountHistory?.length > 0) && (
        <div className="mt-6">
          <Section title="Discount History">
            <Table
              columns={[
                { key: 'at', header: 'Date & Time', render: (h) => formatDate(h.at, true) },
                { key: 'actorName', header: 'Employee', render: (h) => h.actorName || h.actor?.name || '—' },
                { key: 'action', header: 'Action', render: (h) => <StatusBadge status={h.action === 'removed' ? 'cancelled' : h.action === 'updated' ? 'in_progress' : 'approved'} /> },
                { key: 'givenBy', header: 'Given By', render: (h) => titleCase(h.givenBy) || '—' },
                { key: 'source', header: 'Source', render: (h) => titleCase(h.source) || '—' },
                { key: 'totalDiscount', header: 'Total Discount', render: (h) => money(h.totalDiscount) },
                { key: 'finalSaleAmount', header: 'Final Amount', render: (h) => money(h.finalSaleAmount) },
                { key: 'change', header: 'Prev → Updated', render: (h) => h.previousValue
                  ? <span className="text-xs text-slate-500">{money(h.previousValue.finalSaleAmount)} → {money(h.updatedValue?.finalSaleAmount)}</span>
                  : '—' },
              ]}
              rows={booking.discountHistory}
              empty="No discount changes."
            />
          </Section>
        </div>
      )}

      {/* Section 8 — Booking Timeline */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section title="Booking Timeline">
          <ol className="relative space-y-4 border-l border-slate-200 pl-4">
            {steps.map((s, i) => (
              <li key={i} className="relative">
                <span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ${s.done ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <div className={`text-sm ${s.done ? 'font-medium text-slate-800' : 'text-slate-400'}`}>{s.label}</div>
                {s.at && s.done && <div className="text-xs text-slate-400">{formatDate(s.at, true)}</div>}
              </li>
            ))}
          </ol>
        </Section>

        {/* Section 9 — Activity Logs */}
        <Section title="Activity Logs">
          {activity.length === 0 ? <p className="text-sm text-slate-400">No activity recorded.</p> : (
            <ul className="space-y-2 text-sm">
              {activity.map((a, i) => (
                <li key={i} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2">
                  <span className="text-slate-700">{a.text}</span>
                  <span className="shrink-0 text-xs text-slate-400">{formatDate(a.at, true)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {modal === 'discount' && <DiscountModal booking={booking} basePrice={basePrice} onClose={close} onDone={done} />}
      {modal === 'payment' && <PaymentModal booking={booking} balance={balance} onClose={close} onDone={done} />}
      {modal === 'registration' && <RegistrationModal booking={booking} onClose={close} onDone={done} />}
      {modal === 'edit' && <EditModal booking={booking} onClose={close} onDone={done} />}
      {modal === 'transfer' && <TransferBookingModal booking={booking} execs={execs || []} onClose={close} onDone={done} />}
    </div>
  )
}

// --- Discount modal (spec §Discount Information) ---
function DiscountModal({ booking, basePrice, onClose, onDone }) {
  const toast = useToast()
  const d = booking.discount || {}
  const [form, setForm] = useState({
    saleAmount: d.saleAmount || basePrice || 0,
    givenBy: d.givenBy || 'admin',
    builderSalesExecutive: d.builderSalesExecutive || '',
    source: d.source || 'firm',
    firmDiscount: d.firmDiscount || 0,
    builderDiscount: d.builderDiscount || 0,
    remarks: d.remarks || '',
    supportingDocument: d.supportingDocument?.label || '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const totalDiscount = (Number(form.firmDiscount) || 0) + (Number(form.builderDiscount) || 0)
  const finalSaleAmount = Math.max(0, (Number(form.saleAmount) || 0) - totalDiscount)
  const needsRemarks = totalDiscount > 0 && !form.remarks.trim()

  async function save() {
    setBusy(true)
    try {
      await bookingsApi.updateDiscount(booking._id, {
        saleAmount: Number(form.saleAmount) || 0,
        givenBy: form.givenBy,
        builderSalesExecutive: form.builderSalesExecutive,
        source: form.source,
        firmDiscount: Number(form.firmDiscount) || 0,
        builderDiscount: Number(form.builderDiscount) || 0,
        remarks: form.remarks,
        supportingDocument: form.supportingDocument ? { label: form.supportingDocument } : undefined,
      })
      toast.success('Discount saved')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} wide title="Discount Information" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy || needsRemarks}>Save Discount</Button>
      </>
    }>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Sale Amount (₹)" type="number" value={form.saleAmount} onChange={set('saleAmount')} />
        <Select label="Discount Given By" value={form.givenBy} onChange={set('givenBy')}>
          <option value="admin">Admin</option>
          <option value="sub_admin">Sub-Admin</option>
          <option value="builder_sales_executive">Builder Sales Executive</option>
        </Select>
        {form.givenBy === 'builder_sales_executive' && (
          <Input label="Builder Sales Executive" value={form.builderSalesExecutive} onChange={set('builderSalesExecutive')} placeholder="Name" />
        )}
        <Select label="Discount Source" value={form.source} onChange={set('source')}>
          <option value="firm">Firm</option>
          <option value="builder">Builder</option>
          <option value="combined">Combined</option>
        </Select>
        <Input label="Firm Discount (₹)" type="number" value={form.firmDiscount} onChange={set('firmDiscount')} />
        <Input label="Builder Discount (₹)" type="number" value={form.builderDiscount} onChange={set('builderDiscount')} />
        <div className="sm:col-span-2">
          <Textarea label={`Discount Remarks${totalDiscount > 0 ? ' (required)' : ''}`} value={form.remarks} onChange={set('remarks')} placeholder="Reason / justification" />
        </div>
        <div className="sm:col-span-2">
          <Input label="Supporting Document (label / link, optional)" value={form.supportingDocument} onChange={set('supportingDocument')} />
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
        <div className="flex justify-between"><span className="text-slate-500">Total Discount</span><span className="font-medium">{money(totalDiscount)}</span></div>
        <div className="mt-1 flex justify-between border-t border-slate-200 pt-1"><span className="text-slate-500">Final Sale Amount</span><span className="font-semibold text-slate-900">{money(finalSaleAmount)}</span></div>
      </div>
    </Modal>
  )
}

// --- Payment modal (spec §Payment Information) ---
function PaymentModal({ booking, balance, onClose, onDone }) {
  const toast = useToast()
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: balance || '',
    mode: 'bank_transfer',
    reference: '',
    receiptNumber: '',
    remarks: '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    try {
      await bookingsApi.addPayment(booking._id, {
        date: form.date,
        amount: Number(form.amount),
        mode: form.mode,
        reference: form.reference,
        receiptNumber: form.receiptNumber,
        remarks: form.remarks,
      })
      toast.success('Payment recorded')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Record Payment" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy || !(Number(form.amount) > 0)}>Save Payment</Button>
      </>
    }>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Payment Date" type="date" value={form.date} onChange={set('date')} />
        <Input label="Amount (₹)" type="number" value={form.amount} onChange={set('amount')} />
        <Select label="Payment Mode" value={form.mode} onChange={set('mode')}>
          {['cash', 'cheque', 'bank_transfer', 'upi', 'card', 'loan', 'other'].map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}
        </Select>
        <Input label="Transaction Reference" value={form.reference} onChange={set('reference')} />
        <Input label="Receipt Number" value={form.receiptNumber} onChange={set('receiptNumber')} />
        <div className="sm:col-span-2"><Input label="Remarks" value={form.remarks} onChange={set('remarks')} /></div>
      </div>
    </Modal>
  )
}

// --- Registration modal (spec §Registration Information) ---
function RegistrationModal({ booking, onClose, onDone }) {
  const toast = useToast()
  const [form, setForm] = useState({
    registrationStatus: booking.registrationStatus || 'pending',
    registrationDate: booking.registrationDate ? String(booking.registrationDate).slice(0, 10) : '',
    agreementNumber: booking.agreementNumber || '',
    registrationRemarks: booking.registrationRemarks || '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    try {
      await bookingsApi.updateRegistration(booking._id, {
        registrationStatus: form.registrationStatus,
        registrationDate: form.registrationDate,
        agreementNumber: form.agreementNumber,
        registrationRemarks: form.registrationRemarks,
      })
      toast.success('Registration updated')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Update Registration" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy}>Save</Button>
      </>
    }>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Registration Status" value={form.registrationStatus} onChange={set('registrationStatus')}>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </Select>
        <Input label="Registration Date" type="date" value={form.registrationDate} onChange={set('registrationDate')} />
        <Input label="Agreement Number" value={form.agreementNumber} onChange={set('agreementNumber')} />
        <div className="sm:col-span-2"><Textarea label="Remarks" value={form.registrationRemarks} onChange={set('registrationRemarks')} /></div>
      </div>
      <p className="mt-3 text-xs text-slate-500">Completing registration on a confirmed booking marks the sale as completed.</p>
    </Modal>
  )
}

// --- Edit booking modal (spec §Edit Booking) ---
function EditModal({ booking, onClose, onDone }) {
  const toast = useToast()
  const [form, setForm] = useState({
    bookingSource: booking.bookingSource || 'direct',
    paymentMode: booking.paymentMode || 'other',
    bookingAmount: booking.bookingAmount || 0,
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    try {
      await bookingsApi.update(booking._id, {
        bookingSource: form.bookingSource,
        paymentMode: form.paymentMode,
        bookingAmount: Number(form.bookingAmount) || undefined,
      })
      toast.success('Booking updated')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit Booking" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy}>Save</Button>
      </>
    }>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Booking Source" value={form.bookingSource} onChange={set('bookingSource')} />
        <Select label="Payment Mode" value={form.paymentMode} onChange={set('paymentMode')}>
          {['cash', 'cheque', 'bank_transfer', 'upi', 'card', 'loan', 'other'].map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}
        </Select>
        <Input label="Escrow Token / Booking Amount (₹)" type="number" value={form.bookingAmount} onChange={set('bookingAmount')} />
      </div>
    </Modal>
  )
}
