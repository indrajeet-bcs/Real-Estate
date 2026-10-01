import { useState, useCallback } from 'react'
import { auditApi, usersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useDebounce } from '../../hooks/useDebounce.js'
import { formatDate, titleCase } from '../../lib/format.js'
import { PageHeader, Button, Input, Select, Table, Pagination, StatusBadge, Modal, Loader, ErrorState } from '../../components/ui.jsx'

const MODULES = ['lead', 'customer', 'user', 'booking', 'unit', 'followup', 'visit', 'attendance', 'leave', 'commission', 'branch', 'project', 'builder', 'settings']
const ACTIONS = ['create', 'update', 'delete', 'status_change', 'assign', 'transfer', 'import', 'login', 'logout']

export default function SubAdminAuditLogsPage() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [module, setModule] = useState('')
  const [action, setAction] = useState('')
  const [actor, setActor] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounce(searchInput)
  const [detail, setDetail] = useState(null)

  const { data, meta, loading, error, refetch } = useFetch(
    useCallback(() => auditApi.list({
      page, limit, module: module || undefined, action: action || undefined, actor: actor || undefined,
      from: from || undefined, to: to || undefined, search: search || undefined,
    }), [page, limit, module, action, actor, from, to, search])
  )
  const { data: execs } = useFetch(useCallback(() => usersApi.list({ role: 'sales_executive', status: 'active', limit: 200 }), []))

  const columns = [
    { key: 'id', header: 'Log ID', render: (r) => <span className="font-mono text-xs text-slate-500">#{r._id.slice(-6).toUpperCase()}</span> },
    { key: 'time', header: 'Date & Time', render: (r) => formatDate(r.createdAt, true) },
    { key: 'module', header: 'Module', render: (r) => titleCase(r.module) },
    { key: 'action', header: 'Action', render: (r) => <StatusBadge status={r.success === false ? 'rejected' : r.action === 'delete' ? 'cancelled' : 'approved'} /> },
    { key: 'user', header: 'User', render: (r) => r.actor?.name || 'System' },
    { key: 'role', header: 'Role', render: (r) => titleCase(r.actorRole || r.actor?.role) || '—' },
    { key: 'branch', header: 'Branch', render: (r) => r.actor?.branch || '—' },
    { key: 'record', header: 'Record', render: (r) => r.targetLabel || (r.targetId ? `#${String(r.targetId).slice(-6)}` : '—') },
    { key: 'actions', header: '', render: (r) => <Button size="sm" variant="ghost" onClick={() => setDetail(r)}>View Details</Button> },
  ]

  const setF = (fn) => (v) => { setPage(1); fn(v) }

  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="Branch activity trail — every important action, filterable." />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-44"><Input label="From" type="date" value={from} onChange={(e) => setF(setFrom)(e.target.value)} /></div>
        <div className="w-44"><Input label="To" type="date" value={to} onChange={(e) => setF(setTo)(e.target.value)} /></div>
        <div className="w-40"><Select label="Module" value={module} onChange={(e) => setF(setModule)(e.target.value)}><option value="">All</option>{MODULES.map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}</Select></div>
        <div className="w-40"><Select label="Action" value={action} onChange={(e) => setF(setAction)(e.target.value)}><option value="">All</option>{ACTIONS.map((a) => <option key={a} value={a}>{titleCase(a)}</option>)}</Select></div>
        <div className="w-44"><Select label="Employee" value={actor} onChange={(e) => setF(setActor)(e.target.value)}><option value="">All</option>{(execs || []).map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}</Select></div>
        <div className="w-52"><Input label="Search" placeholder="Keyword / record" value={searchInput} onChange={(e) => setF(setSearchInput)(e.target.value)} /></div>
      </div>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <>
          <Table columns={columns} rows={data || []} empty="No audit logs match your filters." onRowClick={setDetail} />
          <Pagination meta={meta} onPage={setPage} onPageSize={(n) => { setLimit(n); setPage(1) }} />
        </>
      )}

      {detail && <LogDetail log={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

function Field({ label, value }) { return <div><dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-0.5 text-sm text-slate-800">{value || '—'}</dd></div> }

function LogDetail({ log, onClose }) {
  const meta = log.meta || {}
  const prev = meta.previousValue ?? meta.previous ?? meta.before
  const next = meta.updatedValue ?? meta.updated ?? meta.after
  const fmt = (v) => (v == null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v))
  return (
    <Modal open onClose={onClose} wide title={`Log · #${log._id.slice(-6).toUpperCase()}`} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Field label="Date & Time" value={formatDate(log.createdAt, true)} />
        <Field label="Module" value={titleCase(log.module)} />
        <Field label="Action Performed" value={titleCase(log.action)} />
        <Field label="User Name" value={log.actor?.name || 'System'} />
        <Field label="User Role" value={titleCase(log.actorRole || log.actor?.role)} />
        <Field label="Branch" value={log.actor?.branch} />
        <Field label="Record" value={log.targetLabel || (log.targetId ? `#${String(log.targetId).slice(-6)}` : '—')} />
        <Field label="Result" value={log.success === false ? 'Failed / Blocked' : 'Success'} />
        <Field label="IP Address" value={log.ip} />
      </dl>
      {(prev != null || next != null) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-semibold uppercase text-slate-400">Previous Value</div><div className="mt-1 break-words text-sm text-slate-700">{fmt(prev)}</div></div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-semibold uppercase text-slate-400">Updated Value</div><div className="mt-1 break-words text-sm text-slate-700">{fmt(next)}</div></div>
        </div>
      )}
      {log.description && <p className="mt-4 text-sm text-slate-600"><span className="font-medium text-slate-800">Remarks:</span> {log.description}</p>}
    </Modal>
  )
}
