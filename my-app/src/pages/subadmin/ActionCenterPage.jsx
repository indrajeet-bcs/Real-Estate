import { useState, useCallback, useMemo } from 'react'
import { leavesApi, bookingsApi, unitsApi, customersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, titleCase, formatMoney } from '../../lib/format.js'
import { PageHeader, Card, Button, Input, Table, StatusBadge, Loader } from '../../components/ui.jsx'

const shortId = (id) => `#${String(id || '').slice(-6).toUpperCase()}`

// Reject / request-changes require mandatory remarks (spec §Request Actions).
function promptRemarks(action) {
  const r = window.prompt(`${action} — remarks are required:`)
  if (r == null) return null
  if (!r.trim()) { window.alert('Remarks are mandatory.'); return null }
  return r.trim()
}

export default function ActionCenterPage() {
  const [tab, setTab] = useState('bookings')
  const [search, setSearch] = useState('')

  const leaves = useFetch(useCallback(() => leavesApi.list({ status: 'pending' }), []))
  const bookings = useFetch(useCallback(() => bookingsApi.list({ status: 'reserved' }), []))
  const units = useFetch(useCallback(() => unitsApi.list({ status: 'locked' }), []))
  const unassigned = useFetch(useCallback(() => customersApi.list({ unassigned: 'true', limit: 100 }), []))

  const counts = {
    discounts: 0,
    bookings: (bookings.data || []).length,
    leaves: (leaves.data || []).length,
    lead_reassignments: (unassigned.data || []).length,
    staff_transfers: 0,
    inventory_holds: (units.data || []).length,
    circulars: 0,
  }

  const TABS = [
    { key: 'discounts', label: 'Discounts' },
    { key: 'bookings', label: 'Bookings' },
    { key: 'leaves', label: 'Leaves' },
    { key: 'lead_reassignments', label: 'Lead Reassignments' },
    { key: 'staff_transfers', label: 'Staff Transfers' },
    { key: 'inventory_holds', label: 'Inventory Holds' },
    { key: 'circulars', label: 'Circulars' },
  ]

  return (
    <div>
      <PageHeader title="Action Center" subtitle="Requests requiring your action, grouped by type." />

      {/* Tabs with pending-count badges */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition ${tab === t.key ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t.label}
            {counts[t.key] > 0 && <span className="rounded-full bg-blue-100 px-1.5 text-[10px] font-semibold text-blue-700">{counts[t.key]}</span>}
          </button>
        ))}
      </div>

      {/* Keyword search (spec §Search & Filters) */}
      <div className="mb-4 w-72">
        <Input label="Search" placeholder="Employee, customer, project…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {tab === 'bookings' && <BookingsTab q={bookings} search={search} />}
      {tab === 'leaves' && <LeavesTab q={leaves} search={search} />}
      {tab === 'lead_reassignments' && <ReassignTab q={unassigned} search={search} />}
      {tab === 'inventory_holds' && <HoldsTab q={units} search={search} />}
      {tab === 'discounts' && <EmptyTab title="Discount Requests" note="Discount requests submitted by employees will appear here for review and forwarding to the Admin." />}
      {tab === 'staff_transfers' && <EmptyTab title="Staff Transfer Requests" note="Employee transfer requests awaiting your review will appear here." />}
      {tab === 'circulars' && <EmptyTab title="Circulars" note="Company circulars and acknowledgements will appear here." />}
    </div>
  )
}

function filterRows(rows, search, fields) {
  if (!search.trim()) return rows
  const q = search.toLowerCase()
  return rows.filter((r) => fields(r).some((v) => (v || '').toLowerCase().includes(q)))
}

function EmptyTab({ title, note }) {
  return (
    <Card className="p-10 text-center">
      <div className="text-2xl">✓</div>
      <h3 className="mt-2 text-sm font-semibold text-slate-700">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">{note}</p>
    </Card>
  )
}

// Bookings — financial: no bulk actions (spec).
function BookingsTab({ q, search }) {
  const toast = useToast()
  const rows = filterRows(q.data || [], search, (r) => [r.customer?.name, r.project?.name, r.unit?.unitNumber, r.bookedBy?.name])
  const setStatus = async (b, status, reason) => {
    try { await bookingsApi.setStatus(b._id, { status, cancelReason: reason }); toast.success(`Booking ${status}`); q.refetch() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }
  const columns = [
    { key: 'id', header: 'Request ID', render: (r) => <span className="font-mono text-xs text-slate-500">{shortId(r._id)}</span> },
    { key: 'employee', header: 'Employee', render: (r) => r.bookedBy?.name || '—' },
    { key: 'customer', header: 'Customer', render: (r) => r.customer?.name || '—' },
    { key: 'project', header: 'Project / Unit', render: (r) => `${r.project?.name || '—'} · ${r.unit?.unitNumber || '—'}` },
    { key: 'amount', header: 'Amount', render: (r) => formatMoney(r.bookingAmount) },
    { key: 'on', header: 'Requested On', render: (r) => formatDate(r.createdAt) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex gap-2">
        <Button size="sm" variant="success" onClick={() => setStatus(r, 'confirmed')}>Verify &amp; Confirm</Button>
        <Button size="sm" variant="danger" onClick={() => { const rm = promptRemarks('Reject booking'); if (rm) setStatus(r, 'cancelled', rm) }}>Reject</Button>
      </div>
    ) },
  ]
  return <Card className="p-5">{q.loading ? <Loader /> : <Table columns={columns} rows={rows} empty="No bookings awaiting verification." />}</Card>
}

// Leaves — non-financial: bulk approve/reject allowed (spec §Bulk Actions).
function LeavesTab({ q, search }) {
  const toast = useToast()
  const [sel, setSel] = useState([])
  const rows = filterRows(q.data || [], search, (r) => [r.employee?.name, r.type])
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const allSel = rows.length > 0 && sel.length === rows.length

  const act = async (l, fn, label) => {
    try { await fn(l._id); toast.success(label); q.refetch() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }
  const bulk = async (kind) => {
    if (!sel.length) return
    let note
    if (kind === 'reject') { note = promptRemarks('Reject selected leaves'); if (!note) return }
    try {
      await Promise.all(sel.map((id) => (kind === 'approve' ? leavesApi.approve(id) : leavesApi.reject(id, note))))
      toast.success(`${sel.length} leave(s) ${kind === 'approve' ? 'approved' : 'rejected'}`)
      setSel([]); q.refetch()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }

  const columns = [
    { key: 'sel', header: (
      <input type="checkbox" checked={allSel} onChange={() => setSel(allSel ? [] : rows.map((r) => r._id))} />
    ), render: (r) => <input type="checkbox" checked={sel.includes(r._id)} onChange={() => toggle(r._id)} /> },
    { key: 'id', header: 'Request ID', render: (r) => <span className="font-mono text-xs text-slate-500">{shortId(r._id)}</span> },
    { key: 'employee', header: 'Employee', render: (r) => r.employee?.name || '—' },
    { key: 'type', header: 'Type', render: (r) => titleCase(r.type) },
    { key: 'dates', header: 'Dates', render: (r) => `${formatDate(r.startDate)} → ${formatDate(r.endDate)}` },
    { key: 'days', header: 'Days', render: (r) => r.days },
    { key: 'on', header: 'Requested On', render: (r) => formatDate(r.createdAt) },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex gap-2">
        <Button size="sm" variant="success" onClick={() => act(r, leavesApi.approve, 'Leave approved')}>Approve</Button>
        <Button size="sm" variant="danger" onClick={() => { const rm = promptRemarks('Reject leave'); if (rm) act(r, (id) => leavesApi.reject(id, rm), 'Leave rejected') }}>Reject</Button>
      </div>
    ) },
  ]
  return (
    <Card className="p-5">
      {sel.length > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-600">{sel.length} selected</span>
          <Button size="sm" variant="success" onClick={() => bulk('approve')}>Approve Selected</Button>
          <Button size="sm" variant="danger" onClick={() => bulk('reject')}>Reject Selected</Button>
        </div>
      )}
      {q.loading ? <Loader /> : <Table columns={columns} rows={rows} empty="No pending leave requests." />}
    </Card>
  )
}

// Lead reassignments — the unassigned pool + allocator.
function ReassignTab({ q, search }) {
  const toast = useToast()
  const rows = filterRows(q.data || [], search, (r) => [r.name, r.mobile, r.source])
  const distribute = async () => {
    try {
      const res = await customersApi.distribute({ algorithm: 'round_robin' })
      toast.success(`Distributed ${res.data.data?.assigned || 0} lead(s)`)
      q.refetch()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }
  const columns = [
    { key: 'name', header: 'Lead', render: (r) => r.name },
    { key: 'mobile', header: 'Mobile' },
    { key: 'source', header: 'Source', render: (r) => titleCase(r.source || '—') },
    { key: 'on', header: 'Created', render: (r) => formatDate(r.createdAt) },
    { key: 'status', header: 'Stage', render: (r) => <StatusBadge status={r.status} /> },
  ]
  return (
    <Card className="p-5">
      <div className="mb-3 flex justify-end">
        {rows.length > 0 && <Button size="sm" onClick={distribute}>Run Allocator</Button>}
      </div>
      {q.loading ? <Loader /> : <Table columns={columns} rows={rows} empty="Pool is empty — all leads assigned." />}
    </Card>
  )
}

// Inventory holds — locked units to release.
function HoldsTab({ q, search }) {
  const toast = useToast()
  const rows = filterRows(q.data || [], search, (r) => [r.unitNumber, r.project?.name, r.lockedForCustomer?.name])
  const release = async (u) => {
    try { await unitsApi.release(u._id); toast.success('Unit released'); q.refetch() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }
  const columns = [
    { key: 'unitNumber', header: 'Unit', render: (r) => r.unitNumber },
    { key: 'project', header: 'Project', render: (r) => r.project?.name || '—' },
    { key: 'held', header: 'Held For', render: (r) => r.lockedForCustomer?.name || '—' },
    { key: 'until', header: 'Lock Expiry', render: (r) => (r.lockedUntil ? formatDate(r.lockedUntil, true) : '—') },
    { key: 'actions', header: '', render: (r) => <Button size="sm" variant="danger" onClick={() => release(r)}>Release</Button> },
  ]
  return <Card className="p-5">{q.loading ? <Loader /> : <Table columns={columns} rows={rows} empty="No units on hold." />}</Card>
}
