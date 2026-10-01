import { useState, useCallback } from 'react'
import { attendanceApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate } from '../../lib/format.js'
import { PageHeader, Card, Button, Input, Textarea, Modal, Table, Pagination, StatusBadge, Loader } from '../../components/ui.jsx'

// Reads the browser's geolocation (best-effort) for the check-in/out GPS stamp.
function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined)
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(undefined),
      { timeout: 5000 }
    )
  })
}

export default function AttendancePage() {
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [busy, setBusy] = useState(false)
  const [correctFor, setCorrectFor] = useState(null) // date string prefilled, or ''
  const { data, meta, loading, refetch } = useFetch(
    useCallback(() => attendanceApi.me({ page, limit }), [page, limit])
  )

  async function mark(kind) {
    setBusy(true)
    try {
      const loc = await getLocation()
      if (kind === 'in') await attendanceApi.checkIn(loc)
      else await attendanceApi.checkOut(loc)
      toast.success(kind === 'in' ? 'Checked in' : 'Checked out')
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    { key: 'date', header: 'Date' },
    { key: 'checkInAt', header: 'Check-in', render: (r) => formatDate(r.checkInAt, true) },
    { key: 'checkOutAt', header: 'Check-out', render: (r) => (r.checkOutAt ? formatDate(r.checkOutAt, true) : '—') },
    { key: 'workedMinutes', header: 'Worked', render: (r) => (r.workedMinutes ? `${Math.floor(r.workedMinutes / 60)}h ${r.workedMinutes % 60}m` : '—') },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: '', render: (r) => <Button size="sm" variant="ghost" onClick={() => setCorrectFor(r.date)}>Request Correction</Button> },
  ]

  return (
    <div>
      <PageHeader
        title="Attendance / Check-in"
        subtitle="Day start/end with GPS capture (§9)"
        actions={<Button variant="secondary" onClick={() => setCorrectFor('')}>Request Correction</Button>}
      />
      <Card className="mb-6 flex items-center gap-4 p-6">
        <Button onClick={() => mark('in')} disabled={busy} variant="success">📍 Check In</Button>
        <Button onClick={() => mark('out')} disabled={busy} variant="secondary">Check Out</Button>
        <span className="text-xs text-slate-500">GPS location is captured if you allow it.</span>
      </Card>

      {loading ? <Loader /> : (
        <>
          <Table columns={columns} rows={data || []} empty="No attendance records yet" />
          <Pagination meta={meta} onPage={setPage} onPageSize={(n) => { setLimit(n); setPage(1) }} />
        </>
      )}

      {correctFor != null && <CorrectionModal defaultDate={correctFor} onClose={() => setCorrectFor(null)} onDone={() => { setCorrectFor(null); refetch() }} />}
    </div>
  )
}

function CorrectionModal({ defaultDate, onClose, onDone }) {
  const toast = useToast()
  const [form, setForm] = useState({ date: defaultDate || '', requestedCheckInAt: '', requestedCheckOutAt: '', reason: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    try {
      await attendanceApi.submitCorrection({
        date: form.date,
        requestedCheckInAt: form.requestedCheckInAt || undefined,
        requestedCheckOutAt: form.requestedCheckOutAt || undefined,
        reason: form.reason,
      })
      toast.success('Correction request submitted')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Request Attendance Correction" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy || !form.date || !form.reason.trim()}>Submit Request</Button>
      </>
    }>
      <div className="space-y-4">
        <Input label="Date" type="date" value={form.date} onChange={set('date')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Requested Check-In" type="datetime-local" value={form.requestedCheckInAt} onChange={set('requestedCheckInAt')} />
          <Input label="Requested Check-Out" type="datetime-local" value={form.requestedCheckOutAt} onChange={set('requestedCheckOutAt')} />
        </div>
        <Textarea label="Reason" value={form.reason} onChange={set('reason')} placeholder="Explain the correction needed" />
      </div>
    </Modal>
  )
}
