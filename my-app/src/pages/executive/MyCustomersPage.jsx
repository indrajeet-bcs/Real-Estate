export function getCleanPhoneNumber(val) {
  if (!val) return ''
  const str = String(val).trim()
  return str.replace(/[^\d+]/g, '')
}
import { useState, useCallback, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { customersApi, projectsApi, unitsApi, bookingsApi, leadTransfersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
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
  const { can } = useAuth()
  const canCreateCustomer = can('customer', 'create') || can('lead', 'create')
  const canEditCustomer = can('customer', 'edit') || can('lead', 'edit')

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [project, setProject] = useState('all')
  const [bookingStatus, setBookingStatus] = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const [budget, setBudget] = useState('all')
  const [sort, setSort] = useState('recently_added')

  const hasActiveFilters = Boolean(
    search.trim() ||
    status !== 'all' ||
    project !== 'all' ||
    bookingStatus !== 'all' ||
    budget !== 'all' ||
    dateRange !== 'all' ||
    sort !== 'recently_added'
  )

  const clearFilters = () => {
    setSearch('')
    setStatus('all')
    setProject('all')
    setBookingStatus('all')
    setBudget('all')
    setDateRange('all')
    setSort('recently_added')
  }

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [previewFor, setPreviewFor] = useState(null)
  const [callModalFor, setCallModalFor] = useState(null)
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

  function call(r) {
    if (!r) return
    const cleanNumber = getCleanPhoneNumber(r.mobile || r.phone)
    if (!cleanNumber) {
      toast.error(`No phone number available for ${r.name || 'this customer'}.`)
      return
    }

    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(cleanNumber).catch(() => {})
      }
    } catch (_) {}

    toast.success(`Launching dialer for ${cleanNumber} (${r.name}). Number copied to clipboard!`)
    window.location.href = `tel:${cleanNumber}`
  }
  const refetchAll = () => { refetch(); refetchReq() }

  const columns = [
    { key: 'name', header: 'Customer', render: (r) => {
      const cleanNum = getCleanPhoneNumber(r.mobile || r.phone)
      return (
        <div className="min-w-[9rem]">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); navigate(`/executive/customers/${r._id}`) }}
            className="group flex items-center gap-1 text-left font-semibold text-slate-900 hover:text-blue-600 hover:underline cursor-pointer"
            title="Open Full Profile"
          >
            <span>{r.name}</span>
            <span className="material-symbols-outlined text-[13px] opacity-0 group-hover:opacity-100 transition-opacity text-blue-600">open_in_new</span>
          </button>
          {cleanNum ? (
            <a
              href={`tel:${cleanNum}`}
              onClick={(e) => {
                e.stopPropagation()
                try {
                  if (navigator?.clipboard?.writeText) navigator.clipboard.writeText(cleanNum).catch(() => {})
                } catch (_) {}
                toast.success(`Launching dialer for ${cleanNum} (${r.name})...`)
              }}
              className="text-xs text-slate-600 hover:text-emerald-700 hover:underline inline-flex items-center gap-1 mt-0.5 cursor-pointer font-medium"
              title={`Click to call ${cleanNum}`}
            >
              <span className="material-symbols-outlined text-[13px] text-emerald-600">call</span>
              <span>{r.mobile}</span>
            </a>
          ) : (
            <div className="text-xs text-slate-400 mt-0.5">{r.mobile || 'No phone number'}</div>
          )}
          {pendingByCustomer[String(r._id)] && <span className="mt-0.5 inline-block rounded bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700">Transfer pending</span>}
        </div>
      )
    } },
    { key: 'budget', header: 'Budget', render: (r) => inr(r.budgetMax || r.budgetMin) },
    { key: 'project', header: 'Interested Project', render: (r) => custProject(r) || '—' },
    { key: 'booking', header: 'Booking Status', render: (r) => r.bookingStatus ? <StatusBadge status={r.bookingStatus} /> : <span className="text-slate-400">Not booked</span> },
    { key: 'last', header: 'Last Interaction', render: (r) => r.lastFollowUp ? formatDate(r.lastFollowUp) : <span className="text-slate-400">—</span> },
    { key: 'assigned', header: 'Assigned', render: (r) => formatDate(r.assignedAt || r.createdAt) },
    { key: 'actions', header: '', render: (r) => {
      const cleanNum = getCleanPhoneNumber(r.mobile || r.phone)
      return (
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            title="Quick Summary Preview"
            onClick={(e) => { e.stopPropagation(); setPreviewFor(r) }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-xs hover:border-blue-300 hover:bg-blue-50/70 hover:text-blue-700 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px] text-blue-600">visibility</span>
            <span>Preview</span>
          </button>
          {cleanNum ? (
            <a
              href={`tel:${cleanNum}`}
              title={`Call ${r.name} (${cleanNum})`}
              onClick={(e) => {
                e.stopPropagation()
                try {
                  if (navigator?.clipboard?.writeText) navigator.clipboard.writeText(cleanNum).catch(() => {})
                } catch (_) {}
                toast.success(`Launching dialer for ${cleanNum} (${r.name}). Number copied to clipboard!`)
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-xs hover:border-emerald-300 hover:bg-emerald-50/70 hover:text-emerald-700 transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px] text-emerald-600">call</span>
              <span>Call</span>
            </a>
          ) : (
            <button
              type="button"
              title="No phone number available"
              onClick={(e) => {
                e.stopPropagation()
                toast.error(`No phone number available for ${r.name || 'this customer'}.`)
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-300 transition cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[15px] text-slate-300">call</span>
              <span>Call</span>
            </button>
          )}
          <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setSheetFor(r) }}>Actions ▾</Button>
        </div>
      )
    } },
  ]

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Manage your assigned customers, maintain relationships, and track the customer journey from inquiry to booking."
        actions={canCreateCustomer ? <Button onClick={() => setAdding(true)}>+ Add Customer</Button> : null}
      />

      {/* Top Summary Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Customers" value={kpis.total} />
        <StatCard label="Active Customers" value={kpis.active} />
        <StatCard label="Booking In Progress" value={kpis.inProgress} />
        <StatCard label="Booked Customers" value={kpis.booked} />
      </div>

      {/* Filters & Search */}
      <Card className="mb-5 overflow-hidden border border-slate-200 bg-white p-4.5 shadow-xs">
        {/* Header bar of filter panel */}
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-blue-600">tune</span>
            <span className="text-sm font-semibold text-slate-800">Filter & Refine Customers</span>
            {hasActiveFilters && (
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                Filters Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-500">
            <span>Showing <strong className="text-slate-800">{filtered.length}</strong> of {rows.length} customers</span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 transition duration-150 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">filter_alt_off</span>
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Filter Inputs Grid with balanced alignment and spacing */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 items-end">
          <div className="sm:col-span-2 md:col-span-1 xl:col-span-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Search
              </span>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <span className="material-symbols-outlined text-[18px]">search</span>
                </span>
                <input
                  type="text"
                  placeholder="Search customer name or mobile…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm text-slate-800 shadow-xs outline-none transition-all duration-150 hover:border-slate-300 hover:bg-slate-50/50 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600"
                    title="Clear search"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>
            </label>
          </div>

          <div>
            <Select label="Customer Status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All Statuses</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
            </Select>
          </div>

          <div>
            <Select label="Project" value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="all">All Projects</option>
              {(projects || []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </Select>
          </div>

          <div>
            <Select label="Booking Status" value={bookingStatus} onChange={(e) => setBookingStatus(e.target.value)}>
              <option value="all">All Bookings</option>
              <option value="none">Not booked</option>
              <option value="reserved">Reserved</option>
              <option value="confirmed">Confirmed</option>
              <option value="sale_completed">Sale Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>

          <div>
            <Select label="Budget" value={budget} onChange={(e) => setBudget(e.target.value)}>
              <option value="all">All Budgets</option>
              <option value="lt50">Below ₹50 L</option>
              <option value="50to100">₹50 L – ₹1 Cr</option>
              <option value="gt100">Above ₹1 Cr</option>
            </Select>
          </div>

          <div>
            <Select label="Assigned Date" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
              <option value="all">All Time</option>
              <option value="today">Assigned today</option>
              <option value="week">Last 7 days</option>
              <option value="month">Last 30 days</option>
            </Select>
          </div>

          <div>
            <Select label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="recently_added">Recently Added</option>
              <option value="recently_contacted">Recently Contacted</option>
              <option value="name">Name (A–Z)</option>
            </Select>
          </div>
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
      {previewFor && (
        <CustomerSummaryModal
          customer={previewFor}
          projects={projects || []}
          onClose={() => setPreviewFor(null)}
          onViewProfile={() => { const id = previewFor._id; setPreviewFor(null); navigate(`/executive/customers/${id}`) }}
          onCall={() => { const c = previewFor; setPreviewFor(null); call(c) }}
          onFollowUp={() => { const c = previewFor; setPreviewFor(null); setFollowUpFor(c) }}
          onVisit={() => { const c = previewFor; setPreviewFor(null); setVisitFor(c) }}
          onBooking={() => { const c = previewFor; setPreviewFor(null); setBookingFor(c) }}
        />
      )}
      {callModalFor && (
        <CallModal
          record={callModalFor}
          entityLabel="Customer"
          onClose={() => setCallModalFor(null)}
          onFollowUp={(c) => { setCallModalFor(null); setFollowUpFor(c) }}
        />
      )}
      {sheetFor && (
        <ActionSheet
          customer={sheetFor}
          hasPendingTransfer={pendingByCustomer[String(sheetFor._id)]}
          canEdit={canEditCustomer}
          onClose={() => setSheetFor(null)}
          onCall={() => { const r = sheetFor; setSheetFor(null); call(r) }}
          onPreview={() => { const r = sheetFor; setSheetFor(null); setPreviewFor(r) }}
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

// ─── Customer Summary Modal (Quick in-place preview) ─────────────────────────
function CustomerSummaryModal({ customer, projects = [], onClose, onViewProfile, onCall, onFollowUp, onVisit, onBooking }) {
  const projectName = useMemo(() => {
    const m = {}
    projects.forEach((p) => { m[String(p._id)] = p.name })
    return m
  }, [projects])

  const projectTitle = useMemo(() => {
    const first = customer.interestedProjects?.[0]
    if (!first) return 'Not specified'
    const id = first.project?._id || first.project
    return first.project?.name || projectName[String(id)] || 'Not specified'
  }, [customer, projectName])

  const alreadyBooked = BOOKED_STATES.includes(customer.bookingStatus)

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={
        <div className="flex items-center justify-between gap-3 pr-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 font-bold text-base">
              {(customer.name || 'C').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-slate-900">{customer.name}</span>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">
                  Summary Preview
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {customer.mobile} {customer.email ? `• ${customer.email}` : ''}
              </p>
            </div>
          </div>
        </div>
      }
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <div className="flex items-center gap-2">
            {getCleanPhoneNumber(customer?.mobile || customer?.phone) ? (
              <a
                href={`tel:${getCleanPhoneNumber(customer?.mobile || customer?.phone)}`}
                onClick={() => {
                  const num = getCleanPhoneNumber(customer?.mobile || customer?.phone)
                  try {
                    if (navigator?.clipboard?.writeText) navigator.clipboard.writeText(num).catch(() => {})
                  } catch (_) {}
                  toast.success(`Launching dialer for ${num} (${customer.name})...`)
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
                title={`Call ${customer.name}`}
              >
                <span className="material-symbols-outlined text-[16px] text-emerald-600">call</span>
                <span>Call ({customer.mobile})</span>
              </a>
            ) : null}
            {onFollowUp && (
              <Button size="sm" variant="secondary" onClick={onFollowUp}>
                + Follow-up
              </Button>
            )}
            <Button size="sm" onClick={onViewProfile} className="gap-1.5">
              <span>View Full Profile</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 py-1">
        {/* Key Metrics / Snapshot Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Customer Status</div>
            <div className="mt-1">
              <StatusBadge status={customer.status} />
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Booking Status</div>
            <div className="mt-1 font-semibold text-xs text-slate-800">
              {customer.bookingStatus ? <StatusBadge status={customer.bookingStatus} /> : <span className="text-slate-400">Not Booked</span>}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Budget Range</div>
            <div className="mt-1 font-semibold text-xs text-slate-900 truncate">
              {customer.budgetMin || customer.budgetMax
                ? `${inr(customer.budgetMin)} - ${inr(customer.budgetMax)}`
                : 'Not specified'}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Assigned On</div>
            <div className="mt-1 font-semibold text-xs text-slate-900">
              {formatDate(customer.assignedAt || customer.createdAt)}
            </div>
          </div>
        </div>

        {/* Detailed Property & Preference Information */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-blue-600">home_work</span>
            Interest & Requirements
          </h4>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Interested Project:</dt>
              <dd className="font-semibold text-slate-900 mt-0.5">{projectTitle}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Preferred Configuration:</dt>
              <dd className="font-semibold text-slate-900 mt-0.5">
                {customer.preferredConfiguration || customer.configuration || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Property Type:</dt>
              <dd className="font-semibold text-slate-900 mt-0.5">
                {titleCase(customer.preferredPropertyType || customer.propertyType || '—')}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Location / City:</dt>
              <dd className="font-semibold text-slate-900 mt-0.5">{customer.city || customer.address || '—'}</dd>
            </div>
          </dl>
        </div>

        {/* Notes & Last Follow-up Section */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-blue-600">history_edu</span>
            Engagement & Remarks
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
              <span className="text-slate-500">Last Interaction:</span>
              <span className="font-medium text-slate-800">
                {customer.lastFollowUp ? formatDate(customer.lastFollowUp, true) : 'No interactions logged yet'}
              </span>
            </div>
            {customer.nextFollowUp && (
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">Next Scheduled Follow-up:</span>
                <span className="font-medium text-blue-700">{formatDate(customer.nextFollowUp, true)}</span>
              </div>
            )}
            <div>
              <span className="block text-slate-500 mb-1">Customer Notes / Requirements:</span>
              <p className="rounded-lg border border-slate-200 bg-white p-2.5 text-slate-700 italic">
                {customer.requirements || customer.note || customer.notes || 'No specific notes recorded.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── Per-row action sheet (spec §Customers Table · Actions) ─────────────────────
function ActionSheet({ customer, hasPendingTransfer, canEdit = true, onClose, onCall, onPreview, onView, onEdit, onFollowUp, onVisit, onBooking, onTransfer }) {
  const alreadyBooked = BOOKED_STATES.includes(customer?.bookingStatus)
  const cleanNum = getCleanPhoneNumber(customer?.mobile || customer?.phone)
  const toast = useToast()

  const actions = [
    {
      label: `Call ${customer?.name || 'Customer'}`,
      icon: 'call',
      href: cleanNum ? `tel:${cleanNum}` : undefined,
      description: cleanNum ? `Dial ${customer.mobile} instantly via device dialer` : 'No phone number available',
      onClick: (e) => {
        if (!cleanNum) {
          e.preventDefault()
          toast.error(`No phone number available for ${customer?.name || 'this customer'}.`)
          return
        }
        try {
          if (navigator?.clipboard?.writeText) navigator.clipboard.writeText(cleanNum).catch(() => {})
        } catch (_) {}
        toast.success(`Launching dialer for ${cleanNum} (${customer.name}). Number copied to clipboard!`)
        onClose()
      },
      disabled: !cleanNum,
    },
    {
      label: 'View Full Profile',
      icon: 'open_in_new',
      description: 'Open full journey, documents, and complete activity history',
      onClick: onView,
    },
    {
      label: 'Quick Summary Preview',
      icon: 'visibility',
      description: 'Quick snapshot of contact details, budget & preferences',
      onClick: onPreview,
    },
    {
      label: 'Edit Customer',
      icon: 'edit',
      description: canEdit ? 'Update customer contact info, budget, and project interest' : 'Permission required to edit customer details',
      onClick: () => {
        if (!canEdit) {
          toast.error('You do not have permission to edit customers.')
          return
        }
        onEdit()
      },
      disabled: !canEdit,
    },
    {
      label: 'Add Follow-up',
      icon: 'add_call',
      description: 'Log a call or schedule next follow-up communication',
      onClick: onFollowUp,
    },
    {
      label: 'Schedule Site Visit',
      icon: 'location_on',
      description: 'Schedule a project site visit for this customer',
      onClick: onVisit,
    },
    {
      label: alreadyBooked ? 'Already booked' : 'Create Booking',
      icon: 'check_circle',
      description: alreadyBooked ? 'Customer unit already reserved/booked' : 'Initiate reservation or booking workflow',
      onClick: onBooking,
      disabled: alreadyBooked,
    },
    {
      label: hasPendingTransfer ? 'Transfer request pending' : 'Request Customer Transfer',
      icon: 'swap_horiz',
      description: hasPendingTransfer ? 'Transfer request is awaiting admin approval' : 'Request reassignment to another sales executive',
      onClick: onTransfer,
      disabled: hasPendingTransfer,
    },
  ]
  return (
    <Modal open onClose={onClose} title={customer?.name || 'Customer Options'}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <p className="mb-3.5 text-xs text-slate-500">{customer?.mobile || 'No mobile'} · {titleCase(customer?.status)}</p>
      <div className="grid grid-cols-1 gap-2.5">
        {actions.map((a) => {
          if (a.href) {
            return (
              <a
                key={a.label}
                href={a.disabled ? undefined : a.href}
                onClick={a.onClick}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                  a.disabled
                    ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400 pointer-events-none'
                    : 'border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/70 cursor-pointer'
                }`}
              >
                <span className="material-symbols-outlined text-[20px] text-emerald-600 mt-0.5">{a.icon}</span>
                <div>
                  <div className="text-sm font-semibold text-slate-800">{a.label}</div>
                  {a.description && <div className="text-xs text-slate-500 mt-0.5">{a.description}</div>}
                </div>
              </a>
            )
          }
          return (
            <button
              key={a.label}
              onClick={a.onClick}
              disabled={a.disabled}
              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                a.disabled
                  ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
                  : 'border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/60 cursor-pointer'
              }`}
            >
              <span className="material-symbols-outlined text-[20px] text-blue-600 mt-0.5">{a.icon}</span>
              <div>
                <div className="text-sm font-semibold text-slate-800">{a.label}</div>
                {a.description && <div className="text-xs text-slate-500 mt-0.5">{a.description}</div>}
              </div>
            </button>
          )
        })}
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
  const [touched, setTouched] = useState({ mobile: false })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleMobileChange = (e) => {
    let val = e.target.value.replace(/\D/g, '')
    if (val.length === 12 && val.startsWith('91')) {
      val = val.slice(2)
    } else if (val.length === 11 && val.startsWith('0')) {
      val = val.slice(1)
    }
    val = val.slice(0, 10)
    setForm((f) => ({ ...f, mobile: val }))
  }

  const isMobileValid = /^[6-9]\d{9}$/.test(form.mobile)
  const mobileError = (() => {
    if (!touched.mobile && !form.mobile) return ''
    if (!form.mobile) return 'Mobile number is required'
    if (form.mobile.length < 10) return `Mobile number must be exactly 10 digits (${form.mobile.length}/10)`
    if (!/^[6-9]/.test(form.mobile)) return 'Mobile number must start with 6, 7, 8, or 9'
    return ''
  })()
  const valid = form.name.trim().length >= 2 && isMobileValid

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
        <Input
          label="Mobile Number *"
          type="tel"
          placeholder="10-digit mobile number"
          maxLength={10}
          value={form.mobile}
          onChange={handleMobileChange}
          onBlur={() => setTouched((t) => ({ ...t, mobile: true }))}
          error={mobileError}
        />
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

// ─── Call / Quick Dialer Modal ────────────────────────────────────────────────
function CallModal({ record, entityLabel = 'Customer', onClose, onFollowUp }) {
  const [copied, setCopied] = useState(false)
  const rawNumber = String(record?.mobile || record?.phone || '').trim()
  const cleanNumber = rawNumber.replace(/[^\d+]/g, '')
  const waNumber = cleanNumber.replace(/^\+/, '')

  const handleCopy = () => {
    if (navigator?.clipboard?.writeText && cleanNumber) {
      navigator.clipboard.writeText(cleanNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDial = () => {
    if (!cleanNumber) return
    const a = document.createElement('a')
    a.href = `tel:${cleanNumber}`
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      try { document.body.removeChild(a) } catch (_) {}
    }, 100)
  }

  const handleWhatsApp = () => {
    if (!waNumber) return
    window.open(`https://wa.me/${waNumber}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[22px] text-emerald-600">call</span>
          <span>Call {entityLabel}: {record?.name}</span>
        </div>
      }
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-4 py-2">
        {/* Phone Number Display Box */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Phone Number</div>
            <div className="mt-0.5 text-xl font-bold tracking-tight text-slate-900 font-mono">
              {rawNumber || 'No number specified'}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!cleanNumber}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-blue-600 transition disabled:opacity-50 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-slate-500">
              {copied ? 'check' : 'content_copy'}
            </span>
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>

        {/* Action Buttons Grid */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleDial}
            disabled={!cleanNumber}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 active:scale-[0.99] transition disabled:opacity-50 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">call</span>
            <span>Open Phone Dialer</span>
          </button>

          <button
            type="button"
            onClick={handleWhatsApp}
            disabled={!cleanNumber}
            className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100/70 transition disabled:opacity-50 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] text-emerald-600">chat</span>
            <span>Open WhatsApp</span>
          </button>
        </div>

        {/* Quick follow-up / call note prompt */}
        {onFollowUp && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-blue-900">Finished the call?</div>
              <div className="text-[11px] text-blue-700 mt-0.5">Log notes or schedule your next follow-up.</div>
            </div>
            <Button
              size="sm"
              onClick={() => {
                onClose()
                onFollowUp(record)
              }}
            >
              + Log Follow-up
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
