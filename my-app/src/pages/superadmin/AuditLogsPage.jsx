import { useState, useCallback, useMemo } from 'react'
import { auditApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useDebounce } from '../../hooks/useDebounce.js'
import { titleCase } from '../../lib/format.js'
import { PageHeader, Select, Table, Button, Input, StatCard, Pagination, Loader, ErrorState } from '../../components/ui.jsx'

// Live Audit Log viewer (was mock-driven). Reads GET /api/audit-logs with
// server-side pagination + filters. Super Admin sees all firms; Admin sees own
// firm; Sub-Admin sees own branch team (enforced server-side).

// A failed action or an explicit unauthorized attempt is treated as suspicious.
const isSuspicious = (l) => l.success === false || l.action === 'unauthorized_attempt'
const statusOf = (l) => (l.action === 'unauthorized_attempt' ? 'critical' : l.success === false ? 'failed' : 'success')

// Very small UA sniff — enough to label the client without a dependency.
function parseUA(ua = '') {
  const os = /Windows/i.test(ua) ? 'Windows' : /Mac OS X|Macintosh/i.test(ua) ? 'macOS' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iOS/i.test(ua) ? 'iOS' : /Linux/i.test(ua) ? 'Linux' : ua && !/curl|node/i.test(ua) ? 'Unknown' : ua ? ua.split('/')[0] : '—'
  const browser = /Edg/i.test(ua) ? 'Edge' : /Chrome/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : /Firefox/i.test(ua) ? 'Firefox' : /curl/i.test(ua) ? 'curl' : '—'
  const device = /Mobile|Android|iPhone/i.test(ua) ? 'Mobile' : /curl|node|Server/i.test(ua) ? 'Server' : 'Desktop'
  return { os, browser, device }
}

function LogStatusBadge({ status }) {
  const colors = {
    success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    failed: 'bg-red-100 text-red-700 border-red-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    critical: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
  }
  const cls = colors[status] || 'bg-slate-100 text-slate-600 border-slate-200'
  return <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${cls}`}>{titleCase(status)}</span>
}

function Drawer({ open, onClose, log }) {
  if (!open || !log) return null
  const ua = parseUA(log.userAgent)
  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md transform bg-white shadow-2xl transition-transform duration-300 translate-x-0">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Activity Details</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {isSuspicious(log) && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="mb-1 flex items-center gap-2 font-semibold text-red-700">⚠ Suspicious Activity Detected</div>
                <p className="text-sm text-red-600">{log.description || 'This activity flagged security rules.'}</p>
              </div>
            )}
            <div className="space-y-6">
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-900">General Info</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                  <div><span className="block text-slate-500">Activity ID</span><span className="font-mono text-xs">{log._id}</span></div>
                  <div><span className="block text-slate-500">Timestamp</span><span>{new Date(log.createdAt).toLocaleString()}</span></div>
                  <div><span className="block text-slate-500">Module</span><span>{titleCase(log.module)}</span></div>
                  <div><span className="block text-slate-500">Status</span><LogStatusBadge status={statusOf(log)} /></div>
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-900">Operator</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                  <div><span className="block text-slate-500">Name</span><span>{log.actor?.name || '—'}</span></div>
                  <div><span className="block text-slate-500">Email</span><span>{log.actor?.email || '—'}</span></div>
                  <div><span className="block text-slate-500">Role</span><span>{titleCase((log.actorRole || log.actor?.role || '').replace('_', ' ')) || '—'}</span></div>
                  {log.actor?.branch && <div><span className="block text-slate-500">Branch</span><span>{log.actor.branch}</span></div>}
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-900">Action Details</h3>
                <div className="space-y-4 text-sm">
                  <div><span className="block text-slate-500">Action</span><span>{titleCase((log.action || '').replace(/_/g, ' '))}</span></div>
                  <div><span className="block text-slate-500">Description</span><span>{log.description || '—'}</span></div>
                  {log.targetLabel && <div><span className="block text-slate-500">Affected Resource</span><span>{log.targetLabel}</span></div>}
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-900">Client Details</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                  <div><span className="block text-slate-500">IP Address</span><span>{log.ip || '—'}</span></div>
                  <div><span className="block text-slate-500">Operating System</span><span>{ua.os}</span></div>
                  <div><span className="block text-slate-500">Browser</span><span>{ua.browser}</span></div>
                  <div><span className="block text-slate-500">Device Type</span><span>{ua.device}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [search, setSearch] = useState('')
  const [module, setModule] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [selectedLog, setSelectedLog] = useState(null)

  const dSearch = useDebounce(search, 350)
  const params = useMemo(
    () => ({ page, limit: rowsPerPage, search: dSearch || undefined, module: module || undefined, from: from || undefined, to: to || undefined }),
    [page, rowsPerPage, dSearch, module, from, to]
  )
  const { data, meta, loading, error, refetch } = useFetch(
    useCallback(() => auditApi.list(params), [params])
  )

  const logs = data || []
  // KPIs computed over the loaded page (server has no aggregate endpoint).
  const suspiciousCount = logs.filter(isSuspicious).length
  const failedCount = logs.filter((l) => l.success === false).length
  const activeUsers = new Set(logs.map((l) => l.actor?._id).filter(Boolean)).size

  const columns = [
    { key: 'createdAt', header: 'Timestamp', render: (r) => <span className="whitespace-nowrap text-xs text-slate-500">{new Date(r.createdAt).toLocaleString()}</span> },
    { key: 'module', header: 'Module', render: (r) => <span className="font-medium text-slate-700">{titleCase(r.module)}</span> },
    { key: 'operator', header: 'Operator', render: (r) => (
      <div><div className="font-medium text-slate-900">{r.actor?.name || '—'}</div><div className="text-xs text-slate-500">{titleCase((r.actorRole || r.actor?.role || '').replace('_', ' '))}</div></div>
    ) },
    { key: 'action', header: 'Action', render: (r) => (
      <div><div className={isSuspicious(r) ? 'font-medium text-red-600' : 'text-slate-700'}>{titleCase((r.action || '').replace(/_/g, ' '))}</div><div className="max-w-[220px] truncate text-xs text-slate-500">{r.description || r.targetLabel}</div></div>
    ) },
    { key: 'client', header: 'Client', render: (r) => {
      const ua = parseUA(r.userAgent)
      return <div className="space-y-0.5 text-xs text-slate-500"><div className="font-medium text-slate-700">{r.ip || '—'}</div><div>{ua.os} • {ua.browser}</div></div>
    } },
    { key: 'status', header: 'Status', render: (r) => <LogStatusBadge status={statusOf(r)} /> },
    { key: 'view', header: '', render: (r) => <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedLog(r) }}>View</Button> },
  ]

  // Module options derived from the loaded rows (always valid values).
  const moduleOptions = useMemo(() => [...new Set((data || []).map((l) => l.module))].sort(), [data])

  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="Monitor platform activity and security events across tenants." />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Activities" value={meta?.total ?? logs.length} hint="matching filters" />
        <StatCard label="Failed (this page)" value={failedCount} hint="loaded rows" />
        <StatCard label="Suspicious (this page)" value={suspiciousCount} hint="loaded rows" />
        <StatCard label="Active Users (this page)" value={activeUsers} hint="loaded rows" />
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full md:w-64"><Input label="Search" placeholder="Description or resource…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} /></div>
          <div className="w-40"><Select label="Module" value={module} onChange={(e) => { setModule(e.target.value); setPage(1) }}><option value="">All Modules</option>{moduleOptions.map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}</Select></div>
          <div className="w-40"><Input label="From" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} /></div>
          <div className="w-40"><Input label="To" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} /></div>
        </div>
      </div>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <>
          <div className="[&_tr:hover]:bg-slate-50 [&_tr]:transition-colors">
            <Table columns={columns} rows={logs} empty="No audit logs match your filters." onRowClick={(log) => setSelectedLog(log)} />
          </div>
          <Pagination meta={meta} onPage={setPage} onPageSize={(n) => { setRowsPerPage(n); setPage(1) }} loading={loading} />
        </>
      )}

      <Drawer open={!!selectedLog} onClose={() => setSelectedLog(null)} log={selectedLog} />
    </div>
  )
}
