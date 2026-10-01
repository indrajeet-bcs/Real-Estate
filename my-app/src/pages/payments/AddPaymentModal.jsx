import { useState, useEffect, useCallback } from 'react'
import { paymentsApi, usersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { formatMoney, titleCase } from '../../lib/format.js'
import { Modal, Button, Input, Textarea, Select } from '../../components/ui.jsx'
import { PAYMENT_METHODS, METHOD_FIELDS, RECEIPT_ACCEPT } from '../../lib/payments.js'

// Add Payment (§Add Payment). A payment is always linked to an existing booking;
// customer / project / unit are auto-filled from the chosen booking.
export default function AddPaymentModal({ onClose, onDone, bookingId }) {
  const { can } = useAuth()
  const toast = useToast()
  const isManager = can('user', 'view') // admin / sub-admin can pick "Received By"

  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    booking: bookingId || '', paymentDate: today, amount: '', method: 'cash', status: 'received',
    referenceNumber: '', bankName: '', transactionId: '', chequeNumber: '', chequeDate: '', upiId: '',
    receivedBy: '', remarks: '',
  })
  const [file, setFile] = useState(null)
  const [ctx, setCtx] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const { data: bookings } = useFetch(useCallback(() => paymentsApi.bookings(), []))
  const { data: employees } = useFetch(useCallback(() => (isManager ? usersApi.list({ status: 'active', limit: 300 }) : Promise.resolve({ data: { data: [] } })), [isManager]))

  // Load booking context (customer/project/unit + balance) when a booking is chosen.
  useEffect(() => {
    let active = true
    if (!form.booking) { setCtx(null); return }
    paymentsApi.bookingContext(form.booking).then((res) => { if (active) setCtx(res.data.data) }).catch(() => { if (active) setCtx(null) })
    return () => { active = false }
  }, [form.booking])

  const need = METHOD_FIELDS[form.method] || []
  const valid = form.booking && Number(form.amount) > 0 && form.paymentDate

  async function submit() {
    if (!valid) { toast.error('Booking, a valid amount and payment date are required'); return }
    setBusy(true)
    try {
      const payload = {
        booking: form.booking, amount: Number(form.amount), paymentDate: form.paymentDate, method: form.method, status: form.status,
        referenceNumber: form.referenceNumber || undefined, bankName: form.bankName || undefined, transactionId: form.transactionId || undefined,
        chequeNumber: form.chequeNumber || undefined, chequeDate: form.chequeDate || undefined, upiId: form.upiId || undefined,
        receivedBy: form.receivedBy || undefined, remarks: form.remarks || undefined,
      }
      const res = await paymentsApi.create(payload)
      const payment = res.data.data
      if (file) {
        const fd = new FormData(); fd.append('file', file); fd.append('label', file.name)
        try { await paymentsApi.uploadReceipt(payment._id, fd) } catch { /* non-fatal */ }
      }
      toast.success('Payment recorded')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} wide title="Add Payment" footer={
      <><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy || !valid}>Save Payment</Button></>
    }>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Select label="Booking *" value={form.booking} onChange={set('booking')} disabled={Boolean(bookingId)}>
            <option value="">Select a confirmed booking…</option>
            {(bookings || []).map((b) => <option key={b._id} value={b._id}>{b.customerName} · {b.projectName || '—'} · Unit {b.unitNumber || '—'}</option>)}
          </Select>
        </div>

        {/* Auto-filled booking context */}
        {ctx && (
          <div className="sm:col-span-2 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-4">
            <div><div className="text-xs text-slate-500">Customer</div><div className="font-medium text-slate-800">{ctx.booking.customerName}</div></div>
            <div><div className="text-xs text-slate-500">Project</div><div className="text-slate-800">{ctx.booking.projectName || '—'}</div></div>
            <div><div className="text-xs text-slate-500">Unit</div><div className="text-slate-800">{ctx.booking.unitNumber || '—'}</div></div>
            <div><div className="text-xs text-slate-500">Balance</div><div className="font-medium text-amber-600">{formatMoney(ctx.balance)}</div></div>
          </div>
        )}

        <Input label="Amount Received (₹) *" type="number" min="1" value={form.amount} onChange={set('amount')} />
        <Input label="Payment Date *" type="date" value={form.paymentDate} onChange={set('paymentDate')} />
        <Select label="Payment Method *" value={form.method} onChange={set('method')}>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}
        </Select>
        <Select label="Status" value={form.status} onChange={set('status')}>
          {['received', 'pending'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </Select>

        {/* Method-specific fields */}
        {need.includes('bankName') && <Input label="Bank Name" value={form.bankName} onChange={set('bankName')} />}
        {need.includes('transactionId') && <Input label="Transaction ID" value={form.transactionId} onChange={set('transactionId')} />}
        {need.includes('chequeNumber') && <Input label="Cheque Number" value={form.chequeNumber} onChange={set('chequeNumber')} />}
        {need.includes('chequeDate') && <Input label="Cheque Date" type="date" value={form.chequeDate} onChange={set('chequeDate')} />}
        {need.includes('upiId') && <Input label="UPI ID" value={form.upiId} onChange={set('upiId')} />}
        {need.includes('referenceNumber') && <Input label="Reference / DD Number" value={form.referenceNumber} onChange={set('referenceNumber')} />}
        {!need.includes('referenceNumber') && <Input label="Reference Number" value={form.referenceNumber} onChange={set('referenceNumber')} />}

        {isManager && (
          <Select label="Received By" value={form.receivedBy} onChange={set('receivedBy')}>
            <option value="">— Me —</option>
            {(employees || []).map((e) => <option key={e._id} value={e._id}>{e.name} · {titleCase(e.role)}</option>)}
          </Select>
        )}

        <div className="sm:col-span-2"><Textarea label="Remarks" value={form.remarks} onChange={set('remarks')} /></div>
        <div className="sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700">Receipt (optional)</span>
          <input type="file" accept={RECEIPT_ACCEPT} onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm text-slate-600" />
          <p className="mt-1 text-xs text-slate-400">PDF, JPG or PNG up to 10MB.</p>
        </div>
      </div>
    </Modal>
  )
}
