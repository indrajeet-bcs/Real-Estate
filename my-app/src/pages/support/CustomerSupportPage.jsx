import { useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader, Card, StatCard, Button, Input, Select, StatusBadge, Pagination, Loader, ErrorState } from '../../components/ui.jsx'
import { ticketsApi } from '../../api/resources.js'
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
  const [searchParams, setSearchParams] = useSearchParams()
  const TABS = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'tickets', label: 'Support Tickets' },
    { key: 'reports', label: 'Reports' },
  ]
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

      {tab === 'dashboard' && <DashboardTab kpis={kpis} tickets={tickets} loading={loading} onOpen={setOpenId} />}
      {tab === 'tickets' && (
        <TicketsTab
          tickets={tickets} meta={meta} loading={loading} error={error} refetch={refetch} onOpen={setOpenId}
          filters={{ search, status, priority }}
          setSearch={(v) => { setSearch(v); setPage(1) }}
          setStatus={(v) => { setStatus(v); setPage(1) }}
          setPriority={(v) => { setPriority(v); setPage(1) }}
          reset={() => { setSearch(''); setStatus(''); setPriority(''); setPage(1) }}
          onPage={setPage} onPageSize={(n) => { setLimit(n); setPage(1) }}
        />
      )}
      {tab === 'reports' && <ReportsTab tickets={tickets} kpis={kpis} />}

      {adding && <CreateTicketModal onClose={() => setAdding(false)} onDone={() => { setAdding(false); onChanged() }} />}
      {openId && <TicketDetailModal ticketId={openId} onClose={() => setOpenId(null)} onChanged={onChanged} />}
    </div>
  )
}

function DashboardTab({ kpis, tickets, loading, onOpen }) {
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

      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Recent High-Priority Tickets</h3>
        {loading ? <Loader /> : highPriority.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No high-priority tickets.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-3 pr-4 font-medium">Ticket ID</th><th className="py-3 pr-4 font-medium">Subject</th><th className="py-3 pr-4 font-medium">Priority</th><th className="py-3 pr-4 font-medium">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {highPriority.map((t) => (
                  <tr key={t._id} className="cursor-pointer transition hover:bg-slate-50" onClick={() => onOpen(t._id)}>
                    <td className="py-3 pr-4 font-medium text-blue-600">{t.ticketId}</td>
                    <td className="max-w-xs truncate py-3 pr-4 text-slate-600">{t.subject}</td>
                    <td className="py-3 pr-4"><span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${priorityCls(t.priority)}`}>{t.priority}</span></td>
                    <td className="py-3 pr-4"><StatusBadge status={t.status} /></td>
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

function TicketsTab({ tickets, meta, loading, error, refetch, onOpen, filters, setSearch, setStatus, setPriority, reset, onPage, onPageSize }) {
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <div className="w-64"><Input label="Search" placeholder="Ticket ID or subject…" value={filters.search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="w-44"><Select label="Status" value={filters.status} onChange={(e) => setStatus(e.target.value)}><option value="">All Statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
        <div className="w-40"><Select label="Priority" value={filters.priority} onChange={(e) => setPriority(e.target.value)}><option value="">All Priorities</option>{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</Select></div>
        <Button variant="secondary" onClick={reset}>Reset</Button>
      </Card>

      <Card className="overflow-hidden">
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
                  <tr key={t._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{t.ticketId}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-slate-700">{t.subject}</td>
                    <td className="px-4 py-3 text-slate-600">{t.category?.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{t.assignedTo?.name || 'Unassigned'}</td>
                    <td className="px-4 py-3"><span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${priorityCls(t.priority)}`}>{t.priority}</span></td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(t.createdAt)}</td>
                    <td className="px-4 py-3 text-right"><Button size="sm" variant="secondary" onClick={() => onOpen(t._id)}>View</Button></td>
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
