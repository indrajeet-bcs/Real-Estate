import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { legalApi, projectsApi, branchesApi, usersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, titleCase } from '../../lib/format.js'
import { PageHeader, Card, StatCard, Button, Input, Select, StatusBadge, Pagination, Loader, ErrorState, ExportMenu } from '../../components/ui.jsx'
import { LEGAL_STATUSES, AGREEMENT_TYPES } from '../../lib/legal.js'
import CreateLegalCaseModal from './CreateLegalCaseModal.jsx'
import LegalDetailModal from './LegalDetailModal.jsx'

function downloadCSV(filename, rows) { const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'); const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url) }
function downloadExcel(filename, sections) { const tables = sections.map((s) => `<h3>${s.title}</h3><table border="1">${[s.head, ...s.rows].map((r) => `<tr>${r.map((c) => `<td>${c ?? ''}</td>`).join('')}</tr>`).join('')}</table>`).join('<br/>'); const blob = new Blob([`<html><head><meta charset="utf-8"></head><body>${tables}</body></html>`], { type: 'application/vnd.ms-excel' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url) }

function Bars({ items, empty = 'No data' }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  if (!items.some((i) => i.value > 0)) return <p className="py-6 text-center text-sm text-slate-400">{empty}</p>
  return (
    <div className="space-y-2">{items.map((i) => (
      <div key={i.label} className="flex items-center gap-3">
        <div className="w-40 shrink-0 truncate text-xs text-slate-600" title={i.label}>{i.label}</div>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${i.color || 'bg-blue-500'}`} style={{ width: `${(i.value / max) * 100}%` }} /></div>
        <div className="w-8 shrink-0 text-right text-xs font-medium text-slate-700">{i.value}</div>
      </div>
    ))}</div>
  )
}

export default function LegalPage({ title = 'Legal Management', subtitle = 'Track document collection, verification and agreements until ready for registration.' }) {
  const { can } = useAuth()
  const canCreate = can('legal', 'create')
  const [searchParams, setSearchParams] = useSearchParams()
  const TABS = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'list', label: 'Legal Case List' },
    { key: 'documents', label: 'Documents' },
    { key: 'reports', label: 'Reports' },
  ]
  const tabParam = searchParams.get('tab')
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam : 'dashboard'
  const setTab = (t) => setSearchParams((p) => { p.set('tab', t); return p }, { replace: true })

  const [creating, setCreating] = useState(false)
  const [addBooking, setAddBooking] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const bump = () => setReloadKey((k) => k + 1)

  useEffect(() => {
    const bid = searchParams.get('add')
    if (bid) { setAddBooking(bid); setCreating(true); setSearchParams((p) => { p.delete('add'); return p }, { replace: true }) }
  }, []) // eslint-disable-line

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} actions={canCreate && <Button onClick={() => { setAddBooking(null); setCreating(true) }}>+ Create Legal Case</Button>} />
      <div className="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 text-sm transition ${tab === t.key ? 'border-b-2 border-blue-500 font-medium text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>{t.label}</button>)}
      </div>

      {tab === 'dashboard' && <DashboardTab key={reloadKey} onOpen={setOpenId} />}
      {tab === 'list' && <ListTab key={reloadKey} onOpen={setOpenId} onAdd={() => { setAddBooking(null); setCreating(true) }} canCreate={canCreate} />}
      {tab === 'documents' && <DocumentsTab key={reloadKey} onOpen={setOpenId} />}
      {tab === 'reports' && <ReportsTab key={reloadKey} />}

      {creating && <CreateLegalCaseModal bookingId={addBooking} onClose={() => setCreating(false)} onDone={() => { setCreating(false); bump() }} />}
      {openId && <LegalDetailModal caseId={openId} onClose={() => setOpenId(null)} onChanged={bump} />}
    </div>
  )
}

function useOpts(isManager) {
  const { data: projects } = useFetch(useCallback(() => projectsApi.list({ limit: 200 }), []))
  const { data: branches } = useFetch(useCallback(() => (isManager ? branchesApi.list() : Promise.resolve({ data: { data: [] } })), [isManager]))
  const { data: employees } = useFetch(useCallback(() => (isManager ? usersApi.list({ status: 'active', limit: 300 }) : Promise.resolve({ data: { data: [] } })), [isManager]))
  return { projects: projects || [], branches: branches || [], employees: employees || [] }
}

// ── Dashboard ────────────────────────────────────────────────────────────────
function DashboardTab({ onOpen }) {
  const { can } = useAuth()
  const isManager = can('user', 'view')
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', branch: '', project: '', legalExecutive: '', status: 'all' })
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }))
  const opts = useOpts(isManager)
  const { data, loading, error, refetch } = useFetch(useCallback(() => legalApi.dashboard(filters), [filters]))
  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  const k = data.kpis
  const STATUS_COLOR = { new: 'bg-sky-500', documents_pending: 'bg-orange-400', verification_in_progress: 'bg-amber-400', agreement_preparation: 'bg-violet-500', ready_for_registration: 'bg-teal-500', completed: 'bg-emerald-500', cancelled: 'bg-slate-300' }
  const DOC_COLOR = { pending: 'bg-amber-400', received: 'bg-sky-500', verified: 'bg-emerald-500', rejected: 'bg-red-400', missing: 'bg-slate-400' }

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="w-40"><Input label="From" type="date" value={filters.dateFrom} onChange={set('dateFrom')} /></div>
        <div className="w-40"><Input label="To" type="date" value={filters.dateTo} onChange={set('dateTo')} /></div>
        {isManager && <div className="w-40"><Select label="Branch" value={filters.branch} onChange={set('branch')}><option value="">All</option>{opts.branches.map((b) => <option key={b._id} value={b.name}>{b.name}</option>)}</Select></div>}
        <div className="w-44"><Select label="Project" value={filters.project} onChange={set('project')}><option value="">All</option>{opts.projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</Select></div>
        {isManager && <div className="w-44"><Select label="Legal Executive" value={filters.legalExecutive} onChange={set('legalExecutive')}><option value="">All</option>{opts.employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}</Select></div>}
        <div className="w-44"><Select label="Status" value={filters.status} onChange={set('status')}><option value="all">All</option>{LEGAL_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></div>
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Cases" value={k.totalCases} />
        <StatCard label="Pending Verification" value={k.pendingVerification} />
        <StatCard label="Documents Pending" value={k.documentsPending} />
        <StatCard label="Agreements Ready" value={k.agreementsReady} />
        <StatCard label="Ready for Registration" value={k.readyForRegistration} />
        <StatCard label="Completed" value={k.completed} />
        <StatCard label="Overdue" value={k.overdue} className={k.overdue ? 'border-red-200' : ''} />
        <StatCard label="This Month" value={k.thisMonth} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5"><h3 className="mb-4 text-sm font-semibold text-slate-900">Legal Status Distribution</h3><Bars items={data.statusDistribution.map((s) => ({ label: titleCase(s.status), value: s.count, color: STATUS_COLOR[s.status] }))} /></Card>
        <Card className="p-5"><h3 className="mb-4 text-sm font-semibold text-slate-900">Document Completion</h3><Bars items={data.documentCompletion.map((d) => ({ label: titleCase(d.status), value: d.count, color: DOC_COLOR[d.status] }))} /></Card>
        <Card className="p-5"><h3 className="mb-4 text-sm font-semibold text-slate-900">Branch-wise Legal Cases</h3><Bars items={data.branchDistribution.map((b) => ({ label: b.branch, value: b.count, color: 'bg-indigo-500' }))} /></Card>
        <Card className="p-5"><h3 className="mb-4 text-sm font-semibold text-slate-900">Monthly Legal Progress</h3><Bars items={data.monthlyProgress.map((m) => ({ label: m.label, value: m.created, color: 'bg-blue-500' }))} empty="No cases yet" /></Card>

        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Recent Cases</h3>
          {data.recentCases.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No cases yet</p> : (
            <div className="space-y-2">{data.recentCases.map((c) => (
              <button key={c._id} onClick={() => onOpen(c._id)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50">
                <div><div className="font-medium text-slate-800">{c.customerName}</div><div className="text-xs text-slate-500">{c.caseCode} · {c.legalExecutive?.name || 'Unassigned'}</div></div>
                <StatusBadge status={c.status} />
              </button>
            ))}</div>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Pending Documents</h3>
          {data.pendingDocuments.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Nothing pending</p> : (
            <div className="space-y-2">{data.pendingDocuments.map((c) => (
              <button key={c._id} onClick={() => onOpen(c._id)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50">
                <div><div className="font-medium text-slate-800">{c.customerName}</div><div className="text-xs text-slate-500">{c.caseCode}</div></div>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{c.pending} pending</span>
              </button>
            ))}</div>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Upcoming Deadlines</h3>
          {data.upcomingDeadlines.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Nothing due soon</p> : (
            <div className="space-y-2">{data.upcomingDeadlines.map((c) => (
              <button key={c._id} onClick={() => onOpen(c._id)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50">
                <div><div className="font-medium text-slate-800">{c.customerName}</div><div className="text-xs text-slate-500">{c.caseCode} · {c.legalExecutive?.name || 'Unassigned'}</div></div>
                <div className="text-xs text-slate-500">{formatDate(c.expectedCompletionDate)}</div>
              </button>
            ))}</div>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Recent Activities</h3>
          {data.recentActivity.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No activity yet</p> : (
            <div className="relative space-y-3 border-l border-slate-200 pl-5">{data.recentActivity.map((a) => (
              <div key={a._id} className="relative"><span className="absolute -left-[23px] top-1 h-2.5 w-2.5 rounded-full bg-blue-500" /><div className="text-sm text-slate-800">{a.description}</div><div className="text-xs text-slate-400">{a.actorName} · {formatDate(a.at, true)}</div></div>
            ))}</div>
          )}
        </Card>
      </div>
    </div>
  )
}

// ── Legal Case List ──────────────────────────────────────────────────────────
const EMPTY = { search: '', status: 'all', branch: '', project: '', legalExecutive: '', agreementType: 'all', dateFrom: '', dateTo: '', sortBy: 'newest' }

function ListTab({ onOpen, onAdd, canCreate }) {
  const { can } = useAuth()
  const toast = useToast()
  const isManager = can('user', 'view')
  const canDelete = can('legal', 'delete')
  const [filters, setFilters] = useState(EMPTY)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const set = (k) => (e) => { setFilters((f) => ({ ...f, [k]: e.target.value })); setPage(1) }
  const opts = useOpts(isManager)
  const { data, meta, loading, error, refetch } = useFetch(useCallback(() => legalApi.list({ page, limit, ...filters }), [page, limit, filters]))
  const rows = data || []
  const exportRows = () => [['Case ID', 'Customer', 'Booking', 'Project', 'Unit', 'Branch', 'Legal Executive', 'Status', 'Docs Verified', 'Agreement', 'Updated'], ...rows.map((c) => [c.caseCode, c.customerName, String(c.booking).slice(-6), c.projectName, c.unitNumber, c.branch, c.legalExecutive?.name || c.legalExecutiveName, titleCase(c.status), `${c.docVerified}/${c.docTotal}`, titleCase(c.agreementStatus || ''), formatDate(c.updatedAt)])]

  async function del(c) { if (!window.confirm(`Delete ${c.caseCode}? It will be soft-deleted.`)) return; try { await legalApi.remove(c._id); toast.success('Deleted'); refetch() } catch (err) { toast.error(err.response?.data?.message || 'Failed') } }

  return (
    <div className="space-y-4">
      <Card className="sticky top-0 z-10 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[200px] flex-1"><Input label="Search" placeholder="Customer, Case ID, project…" value={filters.search} onChange={set('search')} /></div>
        <div className="w-44"><Select label="Status" value={filters.status} onChange={set('status')}><option value="all">All</option>{[...LEGAL_STATUSES, 'overdue'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></div>
        <div className="w-44"><Select label="Project" value={filters.project} onChange={set('project')}><option value="">All</option>{opts.projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</Select></div>
        {isManager && <div className="w-36"><Select label="Branch" value={filters.branch} onChange={set('branch')}><option value="">All</option>{opts.branches.map((b) => <option key={b._id} value={b.name}>{b.name}</option>)}</Select></div>}
        {isManager && <div className="w-44"><Select label="Legal Executive" value={filters.legalExecutive} onChange={set('legalExecutive')}><option value="">All</option>{opts.employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}</Select></div>}
        <div className="w-44"><Select label="Agreement Type" value={filters.agreementType} onChange={set('agreementType')}><option value="all">All</option>{AGREEMENT_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</Select></div>
        <div className="w-36"><Select label="Sort" value={filters.sortBy} onChange={set('sortBy')}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="due">Due date</option></Select></div>
        <Button variant="secondary" onClick={() => { setFilters(EMPTY); setPage(1) }}>Reset</Button>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-slate-500">{meta?.total ?? 0} case{(meta?.total ?? 0) === 1 ? '' : 's'}</div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => downloadCSV('legal-cases.csv', exportRows())}>Export</Button>
          <Button size="sm" variant="secondary" onClick={() => window.print()}>Print</Button>
          {canCreate && <Button size="sm" onClick={onAdd}>+ Create Case</Button>}
        </div>
      </div>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 font-medium">Case ID</th><th className="px-3 py-3 font-medium">Customer</th><th className="px-3 py-3 font-medium">Project / Unit</th>
                <th className="px-3 py-3 font-medium">Branch</th><th className="px-3 py-3 font-medium">Legal Exec</th><th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Documents</th><th className="px-3 py-3 font-medium">Agreement</th><th className="px-3 py-3 font-medium">Updated</th><th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400">No legal cases found. Use “+ Create Legal Case”.</td></tr>
              ) : rows.map((c) => (
                <tr key={c._id} className="cursor-pointer hover:bg-slate-50" onClick={() => onOpen(c._id)}>
                  <td className="px-3 py-3 font-medium text-slate-800">{c.caseCode}</td>
                  <td className="px-3 py-3 text-slate-700">{c.customerName}</td>
                  <td className="px-3 py-3 text-slate-600">{c.projectName || '—'}<div className="text-xs text-slate-400">Unit {c.unitNumber || '—'}</div></td>
                  <td className="px-3 py-3 text-slate-600">{c.branch || '—'}</td>
                  <td className="px-3 py-3 text-slate-600">{c.legalExecutive?.name || c.legalExecutiveName || <span className="text-slate-400">Unassigned</span>}</td>
                  <td className="px-3 py-3"><StatusBadge status={c.status} />{c.overdue && <span className="ml-1 rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700">Overdue</span>}</td>
                  <td className="px-3 py-3 text-slate-600">{c.docVerified}/{c.docTotal} verified{c.docPending ? <div className="text-xs text-amber-600">{c.docPending} pending</div> : null}</td>
                  <td className="px-3 py-3 text-slate-600">{titleCase(c.agreementStatus || '')}</td>
                  <td className="px-3 py-3 text-slate-600">{formatDate(c.updatedAt)}</td>
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => onOpen(c._id)}>View</Button>
                      {canDelete && <Button size="sm" variant="danger" onClick={() => del(c)}>Del</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={meta} onPage={setPage} onPageSize={(n) => { setLimit(n); setPage(1) }} />
    </div>
  )
}

// ── Documents (document-centric view across cases) ───────────────────────────
function DocumentsTab({ onOpen }) {
  const [status, setStatus] = useState('documents_pending')
  const { data, loading, error, refetch } = useFetch(useCallback(() => legalApi.list({ status, limit: 50, sortBy: 'due' }), [status]))
  const rows = data || []
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="w-56"><Select label="Case Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option>{LEGAL_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></div>
        <p className="text-sm text-slate-500">Document progress per case. Open a case to upload, verify or reject individual documents.</p>
      </Card>
      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : rows.length === 0 ? (
        <Card className="py-16 text-center text-sm text-slate-400">No cases for this status.</Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => {
            const pct = c.docTotal ? Math.round((c.docVerified / c.docTotal) * 100) : 0
            return (
              <Card key={c._id} className="cursor-pointer p-5 hover:border-blue-400" onClick={() => onOpen(c._id)}>
                <div className="mb-1 flex items-start justify-between gap-2"><h3 className="font-semibold text-slate-900">{c.customerName}</h3><StatusBadge status={c.status} /></div>
                <div className="text-xs text-slate-500">{c.caseCode} · {c.projectName || '—'} · Unit {c.unitNumber || '—'}</div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Documents verified</span><span>{c.docVerified}/{c.docTotal} · {pct}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
                </div>
                {c.docPending > 0 && <div className="mt-2 text-xs text-amber-600">{c.docPending} document(s) pending</div>}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Reports ──────────────────────────────────────────────────────────────────
function ReportsTab() {
  const { can } = useAuth()
  const isManager = can('user', 'view')
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', branch: '', project: '', legalExecutive: '', status: 'all' })
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }))
  const opts = useOpts(isManager)
  const { data, loading, error, refetch } = useFetch(useCallback(() => legalApi.reports(filters), [filters]))
  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  const sections = [
    { title: 'Legal Progress Report', head: ['Status', 'Cases'], rows: data.progressSummary.map((s) => [titleCase(s.status), s.count]) },
    { title: 'Pending Documents Report', head: ['Document', 'Pending'], rows: data.pendingDocuments.map((d) => [d.document, d.pending]) },
    { title: 'Agreement Report', head: ['Agreement Type', 'Total', 'Ready'], rows: data.agreements.map((a) => [titleCase(a.type), a.total, a.ready]) },
    { title: 'Branch Legal Report', head: ['Branch', 'Total', 'Completed'], rows: data.branch.map((b) => [b.branch, b.total, b.completed]) },
    { title: 'Legal Executive Performance', head: ['Executive', 'Total', 'Completed', 'Ready', 'Completion %'], rows: data.executive.map((e) => [e.executive, e.total, e.completed, e.ready, `${e.completionRate}%`]) },
    { title: 'Customer Legal Status Report', head: ['Case ID', 'Customer', 'Project', 'Status', 'Agreement', 'Due'], rows: data.customers.map((c) => [c.caseCode, c.customer, c.project, titleCase(c.status), titleCase(c.agreement || ''), c.due ? formatDate(c.due) : '—']) },
  ]

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="w-40"><Input label="From" type="date" value={filters.dateFrom} onChange={set('dateFrom')} /></div>
        <div className="w-40"><Input label="To" type="date" value={filters.dateTo} onChange={set('dateTo')} /></div>
        {isManager && <div className="w-40"><Select label="Branch" value={filters.branch} onChange={set('branch')}><option value="">All</option>{opts.branches.map((b) => <option key={b._id} value={b.name}>{b.name}</option>)}</Select></div>}
        <div className="w-44"><Select label="Project" value={filters.project} onChange={set('project')}><option value="">All</option>{opts.projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</Select></div>
        {isManager && <div className="w-44"><Select label="Legal Executive" value={filters.legalExecutive} onChange={set('legalExecutive')}><option value="">All</option>{opts.employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}</Select></div>}
        <div className="w-44"><Select label="Status" value={filters.status} onChange={set('status')}><option value="all">All</option>{LEGAL_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></div>
        <div className="ml-auto">
          <ExportMenu items={[
            { key: 'csv', label: 'CSV', icon: 'description', onClick: () => downloadCSV('legal-reports.csv', sections.flatMap((s) => [[s.title], s.head, ...s.rows, []])) },
            { key: 'excel', label: 'Excel', icon: 'table_view', onClick: () => downloadExcel('legal-reports.xls', sections) },
            { key: 'print', label: 'Print / PDF', icon: 'print', onClick: () => window.print() },
          ]} />
        </div>
      </Card>
      {sections.map((s) => (
        <Card key={s.title} className="p-5">
          <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900">{s.title}</h3><ExportMenu size="sm" items={[
            { key: 'csv', label: 'CSV', icon: 'description', onClick: () => downloadCSV(`${s.title.replace(/\s+/g, '-').toLowerCase()}.csv`, [s.head, ...s.rows]) },
            { key: 'excel', label: 'Excel', icon: 'table_view', onClick: () => downloadExcel(`${s.title.replace(/\s+/g, '-').toLowerCase()}.xls`, [s]) },
            { key: 'print', label: 'Print / PDF', icon: 'print', onClick: () => window.print() },
          ]} /></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500"><tr>{s.head.map((h) => <th key={h} className="py-2 pr-4 font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {s.rows.length === 0 ? <tr><td colSpan={s.head.length} className="py-6 text-center text-slate-400">No data</td></tr> : s.rows.map((r, i) => (
                  <tr key={i}>{r.map((cell, j) => <td key={j} className="py-2 pr-4 text-slate-700">{cell}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  )
}
