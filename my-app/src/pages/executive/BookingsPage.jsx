import { useState, useCallback, useEffect } from 'react'
import { bookingsApi, customersApi, projectsApi, unitsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, formatMoney } from '../../lib/format.js'
import {
  PageHeader, Button, Select, Input, Table, Pagination, StatusBadge, Modal, Loader, ErrorState,
} from '../../components/ui.jsx'

export default function BookingsPage() {
  const { can } = useAuth()
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [status, setStatus] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const { data, meta, loading, error, refetch } = useFetch(
    useCallback(() => bookingsApi.list({ page, limit, status }), [page, limit, status])
  )

  async function setBookingStatus(id, newStatus) {
    let cancelReason
    if (newStatus === 'cancelled') {
      cancelReason = window.prompt('Reason for cancellation?')
      if (!cancelReason) return
    }
    try {
      await bookingsApi.setStatus(id, { status: newStatus, cancelReason })
      toast.success(`Booking ${newStatus}`)
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    }
  }

  const columns = [
    { key: 'customer', header: 'Customer', render: (r) => r.customer?.name || '—' },
    { key: 'project', header: 'Project', render: (r) => r.project?.name || '—' },
    { key: 'unit', header: 'Unit', render: (r) => r.unit?.unitNumber || '—' },
    { key: 'bookingAmount', header: 'Amount', render: (r) => formatMoney(r.bookingAmount) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'createdAt', header: 'Date', render: (r) => formatDate(r.createdAt) },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex gap-2">
        {r.status === 'reserved' && <Button size="sm" variant="success" onClick={() => setBookingStatus(r._id, 'confirmed')}>Confirm</Button>}
        {r.status !== 'cancelled' && r.status !== 'confirmed' && <Button size="sm" variant="danger" onClick={() => setBookingStatus(r._id, 'cancelled')}>Cancel</Button>}
      </div>
    ) },
  ]

  return (
    <div>
      <PageHeader
        title="Bookings"
        subtitle="Reserve units — double-booking is hard-blocked (§10)"
        actions={can('booking', 'create') && <Button onClick={() => setShowCreate(true)}>+ New Booking</Button>}
      />
      <div className="mb-4 w-48">
        <Select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value) }}>
          <option value="">All</option>
          <option value="reserved">Reserved</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <>
          <Table columns={columns} rows={data || []} empty="No bookings yet" />
          <Pagination meta={meta} onPage={setPage} onPageSize={(n) => { setLimit(n); setPage(1) }} />
        </>
      )}

      {showCreate && <CreateBookingModal onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); refetch() }} />}
    </div>
  )
}

function CreateBookingModal({ onClose, onDone }) {
  const toast = useToast()
  const { data: customers } = useFetch(useCallback(() => customersApi.list({ limit: 100 }), []))
  const { data: projects } = useFetch(useCallback(() => projectsApi.list({ limit: 100 }), []))
  const [form, setForm] = useState({ customer: '', project: '', unit: '', bookingAmount: '', paymentMode: 'cheque' })
  const [units, setUnits] = useState([])
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // Load available units whenever the project changes.
  useEffect(() => {
    if (!form.project) { setUnits([]); return }
    unitsApi.list({ project: form.project, status: 'available', limit: 100 })
      .then((res) => setUnits(res.data.data))
      .catch(() => setUnits([]))
  }, [form.project])

  async function save() {
    setBusy(true)
    try {
      await bookingsApi.create({ ...form, bookingAmount: Number(form.bookingAmount) })
      toast.success('Unit reserved — booking created')
      onDone()
    } catch (err) {
      // Surfaces the double-booking block message from the server.
      toast.error(err.response?.data?.message || 'Booking failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="New Booking" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy || !form.customer || !form.unit || !form.bookingAmount}>Reserve Unit</Button>
      </>
    }>
      <div className="space-y-4">
        <Select label="Customer" value={form.customer} onChange={set('customer')}>
          <option value="">Select…</option>
          {(customers || []).map((c) => <option key={c._id} value={c._id}>{c.name} · {c.mobile}</option>)}
        </Select>
        <Select label="Project" value={form.project} onChange={set('project')}>
          <option value="">Select…</option>
          {(projects || []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </Select>
        <Select label="Available Unit" value={form.unit} onChange={set('unit')} disabled={!form.project}>
          <option value="">{form.project ? (units.length ? 'Select unit…' : 'No available units') : 'Pick a project first'}</option>
          {units.map((u) => <option key={u._id} value={u._id}>{u.unitNumber} {u.price ? `· ${formatMoney(u.price)}` : ''}</option>)}
        </Select>
        <Input label="Booking amount" type="number" value={form.bookingAmount} onChange={set('bookingAmount')} />
        <Select label="Payment mode" value={form.paymentMode} onChange={set('paymentMode')}>
          {['cash', 'cheque', 'bank_transfer', 'upi', 'card', 'loan', 'other'].map((m) => <option key={m} value={m}>{m}</option>)}
        </Select>
      </div>
    </Modal>
  )
}
