import { useState, useCallback, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { customersApi, projectsApi, unitsApi, bookingsApi, leadTransfersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, formatMoney, titleCase } from '../../lib/format.js'
import { CUSTOMER_STATUS } from '../../lib/constants.js'
import {
  PageHeader, Card, StatCard, Button, Input, Select, Table, StatusBadge, Modal, Loader, ErrorState,
} from '../../components/ui.jsx'
import { ScheduleFollowUpModal, ScheduleVisitModal, RequestTransferModal } from './MyLeadsPage.jsx'

const inr = (n) => {
  const v = Number(n) || 0
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`
  return v ? `₹${v.toLocaleString('en-IN')}` : '—'
}

const STATUS_OPTIONS = Object.values(CUSTOMER_STATUS)
const BOOKED_STATES = ['confirmed', 'sale_completed']

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function MyCustomersPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [project, setProject] = useState('all')
  const [bookingStatus, setBookingStatus] = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const [budget, setBudget] = useState('all')
  const [sort, setSort] = useState('recently_added')

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [followUpFor, setFollowUpFor] = useState(null)
  const [visitFor, setVisitFor] = useState(null)
  const [bookingFor, setBookingFor] = useState(null)
  const [transferFor, setTransferFor] = useState(null)
  const [sheetFor, setSheetFor] = useState(null)

  const { data, loading, error, refetch } = useFetch(useCallback(() => customersApi.list({ limit: 500 }), []))
  const { data: projects } = useFetch(useCallback(() => projectsApi.list({ limit: 200 }), []))
  const { data: requests, refetch: refetchReq } = useFetch(useCallback(() => leadTransfersApi.list({ status: 'pending', limit: 200 }), []))

  const rows = data || []
  const projectName = useMemo(() => {
    const m = {}
    ;(projects || []).forEach((p) => { m[String(p._id)] = p.name })
    return m
  }, [projects])
  const custProject = (r) => {
    const first = r.interestedProjects?.[0]
    if (!first) return null
    const id = first.project?._id || first.project
    return first.project?.name || projectName[String(id)] || null
  }
  const pendingByCustomer = useMemo(() => {
    const map = {}
    ;(requests || []).forEach((r) => { const cid = r.customer?._id || r.customer; if (cid) map[String(cid)] = true })
    return map
  }, [requests])

  const isBooked = (r) => BOOKED_STATES.includes(r.bookingStatus) || r.status === 'booked'
  const inProgress = (r) => r.bookingStatus === 'reserved'
  const isActive = (r) => !r.bookingStatus && !['lost', 'booked'].includes(r.status)

  // Summary cards (spec §Top Summary Cards)
  const kpis = {
    total: rows.length,
    active: rows.filter(isActive).length,
    inProgress: rows.filter(inProgress).length,
    booked: rows.filter(isBooked).length,
  }

  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999)

  const filtered = useMemo(() => {
    let out = rows
    if (status !== 'all') out = out.filter((r) => r.status === status)
    if (project !== 'all') out = out.filter((r) => (r.interestedProjects || []).some((i) => String(i.project?._id || i.project) === project))
    if (bookingStatus !== 'all') {
      out = out.filter((r) => (bookingStatus === 'none' ? !r.bookingStatus : r.bookingStatus === bookingStatus))
    }
    if (budget !== 'all') {
      out = out.filter((r) => {
        const b = Number(r.budgetMax || r.budgetMin) || 0
        if (budget === 'lt50') return b > 0 && b < 5e6
        if (budget === '50to100') return b >= 5e6 && b <= 1e7
        if (budget === 'gt100') return b > 1e7
        return true
      })
    }
    if (dateRange !== 'all') {
      out = out.filter((r) => {
        const d = r.assignedAt ? new Date(r.assignedAt) : new Date(r.createdAt)
        if (dateRange === 'today') return d >= todayStart && d <= todayEnd
        if (dateRange === 'week') { const w = new Date(todayStart); w.setDate(w.getDate() - 7); return d >= w }
        if (dateRange === 'month') { const m = new Date(todayStart); m.setDate(m.getDate() - 30); return d >= m }
        return true
      })
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter((r) => [r.name, r.mobile].some((v) => (v || '').toLowerCase().includes(q)))
    }
    const sorted = [...out]
    if (sort === 'recently_added') sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    else if (sort === 'recently_contacted') sorted.sort((a, b) => {
      const av = a.lastFollowUp ? new Date(a.lastFollowUp).getTime() : 0
      const bv = b.lastFollowUp ? new Date(b.lastFollowUp).getTime() : 0
      return bv - av
    })
    else if (sort === 'name') sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    return sorted
  }, [rows, status, project, bookingStatus, budget, dateRange, search, sort]) // eslint-disable-line

  function call(r) { window.location.href = `tel:${(r.mobile || '').replace(/\s/g, '')}` }
  const refetchAll = () => { refetch(); refetchReq() }

  const columns = [
    { key: 'name', header: 'Customer', render: (r) => (
      <div className="min-w-[9rem]">
        <div className="font-medium text-slate-900">{r.name}</div>
        <div className="text-xs text-slate-500">{r.mobile}</div>
        {pendingByCustomer[String(r._id)] && <span className="mt-0.5 inline-block rounded bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700">Transfer pending</span>}
      </div>
    ) },
    { key: 'budget', header: 'Budget', render: (r) => inr(r.budgetMax || r.budgetMin) },
    { key: 'project', header: 'Interested Project', render: (r) => custProject(r) || '—' },
    { key: 'booking', header: 'Booking Status', render: (r) => r.bookingStatus ? <StatusBadge status={r.bookingStatus} /> : <span className="text-slate-400">Not booked</span> },
    { key: 'last', header: 'Last Interaction', render: (r) => r.lastFollowUp ? formatDate(r.lastFollowUp) : <span className="text-slate-400">—</span> },
    { key: 'assigned', header: 'Assigned', render: (r) => formatDate(r.assignedAt || r.createdAt) },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex items-center justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); navigate(`/executive/customers/${r._id}`) }}>View</Button>
        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); call(r) }}>Call</Button>
        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setSheetFor(r) }}>Actions ▾</Button>
      </div>
    ) },
  ]

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Manage your assigned customers, maintain relationships, and track the customer journey from inquiry to booking."
        actions={<Button onClick={() => setAdding(true)}>+ Add Customer</Button>}
      />

      {/* Top Summary Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Customers" value={kpis.total} />
        <StatCard label="Active Customers" value={kpis.active} />
        <StatCard label="Booking In Progress" value={kpis.inProgress} />
        <StatCard label="Booked Customers" value={kpis.booked} />
      </div>

      {/* Filters & Search */}
      <Card className="mb-4 p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-7">
          <div className="col-span-2 md:col-span-1">
            <Input label="Search" placeholder="Name or mobile" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select label="Customer Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </Select>
          <Select label="Project" value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="all">All</option>
            {(projects || []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </Select>
          <Select label="Booking Status" value={bookingStatus} onChange={(e) => setBookingStatus(e.target.value)}>
            <option value="all">All</option>
            <option value="none">Not booked</option>
            <option value="reserved">Reserved</option>
            <option value="confirmed">Confirmed</option>
            <option value="sale_completed">Sale Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
          <Select label="Budget" value={budget} onChange={(e) => setBudget(e.target.value)}>
            <option value="all">All</option>
            <option value="lt50">Below ₹50 L</option>
            <option value="50to100">₹50 L – ₹1 Cr</option>
            <option value="gt100">Above ₹1 Cr</option>
          </Select>
          <Select label="Assigned Date" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
            <option value="all">All time</option>
            <option value="today">Assigned today</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
          </Select>
          <Select label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="recently_added">Recently Added</option>
            <option value="recently_contacted">Recently Contacted</option>
            <option value="name">Name (A–Z)</option>
          </Select>
        </div>
      </Card>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <Table
          columns={columns}
          rows={filtered}
          empty="No customers match your filters."
          onRowClick={(r) => navigate(`/executive/customers/${r._id}`)}
        />
      )}

      {/* Modals */}
      {adding && (
        <CustomerFormModal
          projects={projects || []}
          onClose={() => setAdding(false)}
          onSaved={(created, alsoFollowUp) => {
            setAdding(false); refetch()
            if (alsoFollowUp && created) setFollowUpFor(created)
          }}
        />
      )}
      {editing && <CustomerFormModal customer={editing} projects={projects || []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refetch() }} />}
      {followUpFor && <ScheduleFollowUpModal lead={followUpFor} projects={projects || []} onClose={() => setFollowUpFor(null)} onDone={() => { setFollowUpFor(null); refetch() }} />}
      {visitFor && <ScheduleVisitModal lead={visitFor} projects={projects || []} onClose={() => setVisitFor(null)} onDone={() => { setVisitFor(null); refetch() }} />}
      {bookingFor && <CreateBookingModal customer={bookingFor} projects={projects || []} onClose={() => setBookingFor(null)} onDone={() => { setBookingFor(null); refetch() }} />}
      {transferFor && <RequestTransferModal lead={transferFor} entityLabel="Customer" onClose={() => setTransferFor(null)} onDone={() => { setTransferFor(null); refetchAll() }} />}
      {sheetFor && (
        <ActionSheet
          customer={sheetFor}
          hasPendingTransfer={pendingByCustomer[String(sheetFor._id)]}
          onClose={() => setSheetFor(null)}
          onView={() => { const r = sheetFor; setSheetFor(null); navigate(`/executive/customers/${r._id}`) }}
          onEdit={() => { setEditing(sheetFor); setSheetFor(null) }}
          onFollowUp={() => { setFollowUpFor(sheetFor); setSheetFor(null) }}
          onVisit={() => { setVisitFor(sheetFor); setSheetFor(null) }}
          onBooking={() => { setBookingFor(sheetFor); setSheetFor(null) }}
          onTransfer={() => { setTransferFor(sheetFor); setSheetFor(null) }}
        />
      )}
    </div>
  )
}

// ─── Per-row action sheet (spec §Customers Table · Actions) ─────────────────────
function ActionSheet({ customer, hasPendingTransfer, onClose, onView, onEdit, onFollowUp, onVisit, onBooking, onTransfer }) {
  const alreadyBooked = BOOKED_STATES.includes(customer.bookingStatus)
  const actions = [
    { label: 'View Details', icon: '👤', onClick: onView },
    { label: 'Edit Customer', icon: '✏️', onClick: onEdit },
    { label: 'Add Follow-up', icon: '↻', onClick: onFollowUp },
    { label: 'Schedule Site Visit', icon: '⌖', onClick: onVisit },
    { label: alreadyBooked ? 'Already booked' : 'Create Booking', icon: '✓', onClick: onBooking, disabled: alreadyBooked },
    { label: hasPendingTransfer ? 'Transfer request pending' : 'Request Customer Transfer', icon: '⇄', onClick: onTransfer, disabled: hasPendingTransfer },
  ]
  return (
    <Modal open onClose={onClose} title={customer.name}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <p className="mb-3 text-xs text-slate-500">{customer.mobile} · {titleCase(customer.status)}</p>
      <div className="grid grid-cols-1 gap-2">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            disabled={a.disabled}
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-medium transition ${
              a.disabled ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400' : 'border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            <span className="text-base">{a.icon}</span> {a.label}
          </button>
        ))}
      </div>
    </Modal>
  )
}

// ─── Add / Edit Customer (spec §Add Customer) ───────────────────────────────────
const PROPERTY_TYPES = ['apartment', 'villa', 'plot', 'commercial', 'penthouse', 'row_house']

function CustomerFormModal({ customer, projects, onClose, onSaved }) {
  const toast = useToast()
  const isEdit = !!customer
  const [form, setForm] = useState({
    name: customer?.name || '',
    mobile: customer?.mobile || '',
    email: customer?.email || '',
    budgetMax: customer?.budgetMax || '',
    propertyType: customer?.propertyType || '',
    preferredLocation: customer?.preferredLocation || '',
    interestedProject: customer?.interestedProjects?.[0]?.project?._id || customer?.interestedProjects?.[0]?.project || '',
    note: '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const valid = form.name.trim().length >= 2 && form.mobile.trim().length >= 7

  async function submit(alsoFollowUp) {
    if (!valid) { toast.error('Name and a valid mobile are required'); return }
    setBusy(true)
    try {
      const payload = {
        name: form.name,
        mobile: form.mobile,
        email: form.email || undefined,
        budgetMax: form.budgetMax ? Number(form.budgetMax) : undefined,
        propertyType: form.propertyType || undefined,
        preferredLocation: form.preferredLocation || undefined,
      }
      if (isEdit) {
        await customersApi.update(customer._id, payload)
        toast.success('Customer updated')
        onSaved(null, false)
      } else {
        const res = await customersApi.create({
          ...payload,
          interestedProject: form.interestedProject || undefined,
          note: form.note || undefined,
        })
        toast.success('Customer created')
        onSaved(res.data.data, alsoFollowUp)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} wide title={isEdit ? `Edit Customer — ${customer.name}` : 'Add Customer'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          {!isEdit && <Button variant="secondary" onClick={() => submit(true)} disabled={busy || !valid}>Save &amp; Add Follow-up</Button>}
          <Button onClick={() => submit(false)} disabled={busy || !valid}>{isEdit ? 'Save Changes' : 'Save'}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Customer Name *" value={form.name} onChange={set('name')} />
        <Input label="Mobile Number *" value={form.mobile} onChange={set('mobile')} />
        <Input label="Email" type="email" value={form.email} onChange={set('email')} />
        <Input label="Budget (max ₹)" type="number" value={form.budgetMax} onChange={set('budgetMax')} />
        <Select label="Property Preference" value={form.propertyType} onChange={set('propertyType')}>
          <option value="">Select…</option>
          {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
        </Select>
        <Input label="Preferred Location" value={form.preferredLocation} onChange={set('preferredLocation')} />
        <Select label="Interested Project" value={form.interestedProject} onChange={set('interestedProject')} disabled={isEdit}>
          <option value="">None</option>
          {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </Select>
        {!isEdit && (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
            <textarea rows={2} value={form.note} onChange={set('note')} placeholder="Initial notes about this customer…"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-slate-500">Duplicate mobile numbers are blocked automatically. {isEdit ? '' : 'The customer is assigned to you.'}</p>
    </Modal>
  )
}

// ─── Create Booking (spec §Actions · Create Booking) ────────────────────────────
function CreateBookingModal({ customer, projects, onClose, onDone }) {
  const toast = useToast()
  const [form, setForm] = useState({
    project: customer.interestedProjects?.[0]?.project?._id || customer.interestedProjects?.[0]?.project || '',
    unit: '',
    bookingAmount: '',
    paymentMode: 'cheque',
  })
  const [units, setUnits] = useState([])
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    if (!form.project) { setUnits([]); return }
    unitsApi.list({ project: form.project, status: 'available', limit: 100 })
      .then((res) => setUnits(res.data.data))
      .catch(() => setUnits([]))
  }, [form.project])

  async function save() {
    setBusy(true)
    try {
      await bookingsApi.create({ ...form, customer: customer._id, bookingAmount: Number(form.bookingAmount) })
      toast.success('Unit reserved — booking created')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Create Booking — ${customer.name}`} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy || !form.unit || !form.bookingAmount}>Reserve Unit</Button>
      </>
    }>
      <div className="space-y-4">
        <Select label="Project" value={form.project} onChange={set('project')}>
          <option value="">Select…</option>
          {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </Select>
        <Select label="Available Unit" value={form.unit} onChange={set('unit')} disabled={!form.project}>
          <option value="">{form.project ? (units.length ? 'Select unit…' : 'No available units') : 'Pick a project first'}</option>
          {units.map((u) => <option key={u._id} value={u._id}>{u.unitNumber}{u.currentPrice || u.price ? ` · ${formatMoney(u.currentPrice || u.price)}` : ''}</option>)}
        </Select>
        <Input label="Booking amount" type="number" value={form.bookingAmount} onChange={set('bookingAmount')} />
        <Select label="Payment mode" value={form.paymentMode} onChange={set('paymentMode')}>
          {['cash', 'cheque', 'bank_transfer', 'upi', 'card', 'loan', 'other'].map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}
        </Select>
      </div>
      <p className="mt-3 text-xs text-slate-500">Double-booking is hard-blocked. The customer's timeline updates automatically.</p>
    </Modal>
  )
}
