import { useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
<<<<<<< HEAD
import { PageHeader, Card, StatCard, Button, Input, Select, DropdownSelect, StatusBadge, Pagination, Loader, ErrorState } from '../../components/ui.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { ROLES } from '../../lib/constants.js'
import { ticketsApi } from '../../api/resources.js'
=======
import { PageHeader, Card, StatCard, Button, Input, Select, StatusBadge, Pagination, Loader, ErrorState } from '../../components/ui.jsx'
import { ticketsApi, ticketCategoriesApi } from '../../api/resources.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
>>>>>>> 29c44943f8ef916e8d5fecd85ed39ea501c3fbf5
import { useFetch } from '../../hooks/useFetch.js'
import { useDebounce } from '../../hooks/useDebounce.js'
import { formatDate } from '../../lib/format.js'
import CreateTicketModal from './CreateTicketModal.jsx'
import TicketDetailModal from './TicketDetailModal.jsx'

// Live Customer Support center (was mock-driven). Reads GET /api/tickets
// (firm-scoped server-side). Priorities/statuses use the real model enums.
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']
const STATUSES = ['Open', 'In Progress', 'Waiting for Customer', 'Resolved', 'Closed']

const priorityCls = (p) =>
  p === 'Critical' ? 'bg-red-100 text-red-700' : p === 'High' ? 'bg-orange-100 text-orange-700' : p === 'Medium' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'

export default function CustomerSupportPage() {
  const { user } = useAuth()
<<<<<<< HEAD
  const canReopen = [ROLES.ADMIN, ROLES.SUB_ADMIN, ROLES.SUPER_ADMIN].includes(user?.role)
=======
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

>>>>>>> 29c44943f8ef916e8d5fecd85ed39ea501c3fbf5
  const [searchParams, setSearchParams] = useSearchParams()
  const TABS = useMemo(() => {
    const list = [
      { key: 'dashboard', label: 'Dashboard' },
      { key: 'tickets', label: 'Support Tickets' },
      { key: 'reports', label: 'Reports' },
    ]
    if (isAdmin) {
      list.splice(2, 0, { key: 'categories', label: 'Ticket Categories' })
    }
    return list
  }, [isAdmin])
  const tabParam = searchParams.get('tab')
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam : 'dashboard'
  const setTab = (t) => setSearchParams((p) => { p.set('tab', t); return p }, { replace: true })

  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')

  const dSearch = useDebounce(search, 350)
  const params = useMemo(
    () => ({ page, limit, search: dSearch || undefined, status: status || undefined, priority: priority || undefined }),
    [page, limit, dSearch, status, priority]
  )
  const { data, meta, loading, error, refetch } = useFetch(useCallback(() => ticketsApi.list(params), [params]))
  const tickets = data || []
  const kpis = meta?.kpis || { total: 0, open: 0, inProgress: 0, resolved: 0, closed: 0 }

  const onChanged = () => refetch()

  return (
    <div>
      <PageHeader
        title="Customer Support"
        subtitle="Manage customer issues, service requests, and resolutions."
        actions={<Button onClick={() => setAdding(true)}>+ Create Ticket</Button>}
      />

      <div className="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm transition ${tab === t.key ? 'border-b-2 border-blue-500 font-medium text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab kpis={kpis} tickets={tickets} loading={loading} onOpen={setOpenId} onGoTickets={() => setTab('tickets')} canReopen={canReopen} />}
      {tab === 'tickets' && (
        <TicketsTab
          tickets={tickets} meta={meta} loading={loading} error={error} refetch={refetch} onOpen={setOpenId} canReopen={canReopen}
          filters={{ search, status, priority }}
          setSearch={(v) => { setSearch(v); setPage(1) }}
          setStatus={(v) => { setStatus(v); setPage(1) }}
          setPriority={(v) => { setPriority(v); setPage(1) }}
          reset={() => { setSearch(''); setStatus(''); setPriority(''); setPage(1) }}
          onPage={setPage} onPageSize={(n) => { setLimit(n); setPage(1) }}
        />
      )}
      {tab === 'categories' && isAdmin && <CategoriesTab />}
      {tab === 'reports' && <ReportsTab tickets={tickets} kpis={kpis} />}

      {adding && <CreateTicketModal onClose={() => setAdding(false)} onDone={() => { setAdding(false); onChanged() }} />}
      {openId && <TicketDetailModal ticketId={openId} onClose={() => setOpenId(null)} onChanged={onChanged} />}
    </div>
  )
}

function DashboardTab({ kpis, tickets, loading, onOpen, onGoTickets, canReopen }) {
  const highPriority = tickets.filter((t) => t.priority === 'High' || t.priority === 'Critical').slice(0, 8)
  const byCategory = useMemo(() => {
    const m = new Map()
    for (const t of tickets) { const c = t.category?.name || 'Uncategorized'; m.set(c, (m.get(c) || 0) + 1) }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [tickets])
  const maxCat = Math.max(1, ...byCategory.map(([, n]) => n))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total Tickets" value={kpis.total} />
        <StatCard label="Open" value={kpis.open} />
        <StatCard label="In Progress" value={kpis.inProgress} />
        <StatCard label="Resolved" value={kpis.resolved} />
        <StatCard label="Closed" value={kpis.closed} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="col-span-2 p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Tickets by Category <span className="text-xs font-normal text-slate-400">(loaded)</span></h3>
          {byCategory.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No tickets yet.</p> : (
            <div className="space-y-3">
              {byCategory.map(([cat, n]) => (
                <div key={cat}>
                  <div className="mb-1 flex justify-between text-xs"><span className="font-medium text-slate-700">{cat}</span><span className="text-slate-500">{n}</span></div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${(n / maxCat) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Priority Snapshot <span className="text-xs font-normal text-slate-400">(loaded)</span></h3>
          <div className="space-y-2 text-sm">
            {PRIORITIES.map((p) => {
              const n = tickets.filter((t) => t.priority === p).length
              return <div key={p} className="flex items-center justify-between"><span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${priorityCls(p)}`}>{p}</span><span className="font-medium text-slate-700">{n}</span></div>
            })}
          </div>
        </Card>
      </div>

      {/* Support Main Page Recent Tickets with full View Action option */}
      <Card className="overflow-hidden border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Recent High-Priority Tickets</h3>
            <p className="text-xs text-slate-500">Urgent support tickets requiring immediate review & resolution.</p>
          </div>
          {typeof onGoTickets === 'function' && (
            <Button size="sm" variant="ghost" onClick={onGoTickets} className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50">
              View All Tickets →
            </Button>
          )}
        </div>
        {loading ? <Loader /> : highPriority.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No high-priority tickets.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium">Ticket ID</th>
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {highPriority.map((t) => (
                  <tr key={t._id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => onOpen(t._id)}>
                    <td className="px-4 py-3 font-medium text-blue-600 hover:underline">{t.ticketId}</td>
                    <td className="max-w-xs truncate px-4 py-3 font-medium text-slate-800" title={t.subject}>{t.subject}</td>
                    <td className="px-4 py-3 text-slate-600">{t.category?.name || '—'}</td>
                    <td className="px-4 py-3"><span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${priorityCls(t.priority)}`}>{t.priority}</span></td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(t.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpen(t._id)
                          }}
                          className="inline-flex items-center gap-1.5 shadow-2xs hover:border-blue-400 hover:text-blue-600"
                          title="View and inspect all associated ticket details"
                        >
                          <span className="material-symbols-outlined text-[16px]">visibility</span>
                          <span>View</span>
                        </Button>
                        {canReopen && (t.status === 'Closed' || t.status === 'Resolved') && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={(e) => {
                              e.stopPropagation()
                              onOpen(t._id)
                            }}
                            className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                            title="Reopen ticket for follow-up"
                          >
                            <span className="material-symbols-outlined text-[15px]">restart_alt</span>
                            <span>Reopen</span>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function TicketsTab({ tickets, meta, loading, error, refetch, onOpen, filters, setSearch, setStatus, setPriority, reset, onPage, onPageSize, canReopen }) {
  const hasActiveFilters = Boolean(filters.search?.trim() || filters.status || filters.priority)

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    ...STATUSES.map((s) => ({ value: s, label: s })),
  ]

  const priorityOptions = [
    { value: '', label: 'All Priorities' },
    ...PRIORITIES.map((p) => ({ value: p, label: p })),
  ]

  return (
    <div className="space-y-5">
      {/* Redesigned Filter Panel with modern styling, clean alignment, and crisp borders */}
      <Card className="overflow-hidden border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-blue-600">tune</span>
            <span className="text-sm font-semibold text-slate-800">Filter & Search Tickets</span>
            {hasActiveFilters && (
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                Filters Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>Showing <strong className="text-slate-800">{tickets.length}</strong> {meta?.total ? `of ${meta.total}` : ''} tickets</span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 transition duration-150 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">filter_alt_off</span>
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Filter dropdowns and inputs with perfect alignment, clean borders, and proper padding */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
          <div>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Search Ticket
              </span>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <span className="material-symbols-outlined text-[18px]">search</span>
                </span>
                <input
                  type="text"
                  placeholder="Ticket ID or subject…"
                  value={filters.search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-9 text-sm text-slate-800 shadow-xs outline-none transition-all duration-200 hover:border-blue-400 hover:bg-slate-50/70 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-500/15"
                />
                {filters.search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                    title="Clear search"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>
            </label>
          </div>

          <div>
            <DropdownSelect
              label="Ticket Status"
              value={filters.status}
              onChange={(e) => setStatus(e.target.value)}
              options={statusOptions}
              placeholder="All Statuses"
            />
          </div>

          <div>
            <DropdownSelect
              label="Priority Level"
              value={filters.priority}
              onChange={(e) => setPriority(e.target.value)}
              options={priorityOptions}
              placeholder="All Priorities"
            />
          </div>

          <div>
            <Button
              variant="secondary"
              onClick={reset}
              className="w-full h-[42px] justify-center rounded-xl border-slate-300 hover:border-blue-400 hover:bg-slate-50 transition-all shadow-xs"
              disabled={!hasActiveFilters}
            >
              <span className="material-symbols-outlined text-[18px]">restart_alt</span>
              Reset Filters
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border border-slate-200 shadow-xs">
        {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Ticket ID</th><th className="px-4 py-3 font-medium">Subject</th><th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Assigned To</th><th className="px-4 py-3 font-medium">Priority</th><th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th><th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.length === 0 ? (
                  <tr><td colSpan={8} className="py-10 text-center text-sm text-slate-400">No tickets match your filters.</td></tr>
                ) : tickets.map((t) => (
                  <tr key={t._id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => onOpen(t._id)}>
                    <td className="px-4 py-3 font-medium text-blue-600 hover:underline">{t.ticketId}</td>
                    <td className="max-w-xs truncate px-4 py-3 font-medium text-slate-800" title={t.subject}>{t.subject}</td>
                    <td className="px-4 py-3 text-slate-600">{t.category?.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{t.assignedTo?.name || 'Unassigned'}</td>
                    <td className="px-4 py-3"><span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${priorityCls(t.priority)}`}>{t.priority}</span></td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(t.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpen(t._id)
                          }}
                          className="inline-flex items-center gap-1.5 shadow-2xs hover:border-blue-400 hover:text-blue-600"
                          title="View and inspect all associated ticket details"
                        >
                          <span className="material-symbols-outlined text-[16px]">visibility</span>
                          <span>View</span>
                        </Button>
                        {canReopen && (t.status === 'Closed' || t.status === 'Resolved') && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={(e) => {
                              e.stopPropagation()
                              onOpen(t._id)
                            }}
                            className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                            title="Reopen ticket for follow-up"
                          >
                            <span className="material-symbols-outlined text-[15px]">restart_alt</span>
                            <span>Reopen</span>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-slate-200 p-2"><Pagination meta={meta} onPage={onPage} onPageSize={onPageSize} loading={loading} /></div>
      </Card>
    </div>
  )
}

function ReportsTab({ tickets, kpis }) {
  const resolvedRate = kpis.total ? Math.round(((kpis.resolved + kpis.closed) / kpis.total) * 100) : 0
  const byStatus = STATUSES.map((s) => ({ s, n: tickets.filter((t) => t.status === s).length }))
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total" value={kpis.total} />
        <StatCard label="Resolved + Closed" value={kpis.resolved + kpis.closed} />
        <StatCard label="Resolution Rate" value={`${resolvedRate}%`} />
        <StatCard label="Open + In Progress" value={kpis.open + kpis.inProgress} />
      </div>
      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Status Distribution <span className="text-xs font-normal text-slate-400">(loaded page)</span></h3>
        <div className="space-y-3">
          {byStatus.map(({ s, n }) => {
            const max = Math.max(1, ...byStatus.map((x) => x.n))
            return (
              <div key={s}>
                <div className="mb-1 flex justify-between text-xs"><span className="font-medium text-slate-700">{s}</span><span className="text-slate-500">{n}</span></div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${(n / max) * 100}%` }} /></div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}


function CategoriesTab() {
  const toast = useToast()
  const { data, loading, error, refetch } = useFetch(useCallback(() => ticketCategoriesApi.list(), []))
  const [modal, setModal] = useState(null)
  const [targetCat, setTargetCat] = useState(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const openAdd = () => {
    setTargetCat(null)
    setName('')
    setModal('add')
  }

  const openEdit = (cat) => {
    setTargetCat(cat)
    setName(cat.name)
    setModal('edit')
  }

  const handleSave = async (e) => {
    e?.preventDefault()
    if (!name.trim()) {
      toast.error('Category name is required')
      return
    }
    setBusy(true)
    try {
      if (modal === 'add') {
        await ticketCategoriesApi.create({ name: name.trim() })
        toast.success('Category created successfully')
      } else {
        await ticketCategoriesApi.update(targetCat._id, { name: name.trim() })
        toast.success('Category updated successfully')
      }
      setModal(null)
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save category')
    } finally {
      setBusy(false)
    }
  }

  const handleToggle = async (cat) => {
    try {
      await ticketCategoriesApi.toggle(cat._id, !cat.isActive)
      toast.success(cat.isActive ? 'Category deactivated' : 'Category activated')
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to toggle category')
    }
  }

  const handleDelete = async (cat) => {
    if (!window.confirm(`Are you sure you want to delete category "${cat.name}"?`)) return
    try {
      await ticketCategoriesApi.remove(cat._id)
      toast.success('Category deleted')
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete category')
    }
  }

  const categories = data || []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Support Ticket Categories</h3>
          <p className="text-xs text-slate-500">Categories created here will be automatically available to all Sub-Admins and Sales Executives when filing tickets.</p>
        </div>
        <Button onClick={openAdd}>+ Add Category</Button>
      </div>

      {loading ? (
        <Loader />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-6 py-3">Category Name</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Created On</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-sm text-slate-500">
                      No categories defined yet. Click "+ Add Category" to create your first category.
                    </td>
                  </tr>
                ) : (
                  categories.map((cat) => (
                    <tr key={cat._id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-medium text-slate-900">{cat.name}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cat.isActive !== false ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                          {cat.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">{formatDate(cat.createdAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => handleToggle(cat)}>
                            {cat.isActive !== false ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => openEdit(cat)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => handleDelete(cat)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md overflow-hidden bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {modal === 'add' ? 'Add Ticket Category' : 'Edit Ticket Category'}
              </h3>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <Input
                label="Category Name *"
                placeholder="e.g. Payment Issue, Site Visit, Legal Document"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
              <p className="text-xs text-slate-500">
                This category will immediately become available in the category dropdown for Sub-Admins and Sales Executives.
              </p>
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button variant="secondary" type="button" onClick={() => setModal(null)} disabled={busy}>Cancel</Button>
                <Button type="submit" loading={busy}>{modal === 'add' ? 'Create Category' : 'Save Changes'}</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
