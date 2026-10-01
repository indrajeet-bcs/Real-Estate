import { useState, useCallback, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { paymentsApi, projectsApi, branchesApi, usersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, formatMoney, titleCase } from '../../lib/format.js'
import { PageHeader, Card, StatCard, Button, Input, Select, StatusBadge, Pagination, Loader, ErrorState, ExportMenu } from '../../components/ui.jsx'
import { PAYMENT_METHODS, PAYMENT_STATUSES } from '../../lib/payments.js'
import AddPaymentModal from './AddPaymentModal.jsx'
import PaymentDetailModal from './PaymentDetailModal.jsx'

// ── Icon-button kit (inline SVG, currentColor) ───────────────────────────────
const svg = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">{p}</svg>
const ICON = {
  view: svg(<><path d="M2.04 12.32a1 1 0 0 1 0-.64C3.42 7.51 7.36 4.5 12 4.5s8.57 3.01 9.96 7.18a1 1 0 0 1 0 .64C20.58 16.49 16.64 19.5 12 19.5s-8.57-3.01-9.96-7.18Z" /><circle cx="12" cy="12" r="3" /></>),
  upload: svg(<><path d="M12 15V5m0 0-4 4m4-4 4 4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>),
  trash: svg(<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13h6l1-13" />),
  export: svg(<><path d="M12 3v10m0 0-4-4m4 4 4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>),
  print: svg(<><path d="M6 9V3h12v6" /><rect x="4" y="9" width="16" height="8" rx="2" /><path d="M8 17h8v4H8z" /></>),
  search: svg(<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>),
  calendar: svg(<><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></>),
  chevron: svg(<path d="m6 9 6 6 6-6" />),
  reset: svg(<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>),
}

// ── Filter field kit (consistent 44px controls, custom chevron) ──────────────
const filterCls = 'h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition duration-150 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400'
function FField({ label, className = '', children }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      {children}
    </div>
  )
}
function FSelect({ value, onChange, disabled, children }) {
  return (
    <div className="relative">
      <select value={value} onChange={onChange} disabled={disabled} className={`${filterCls} ${disabled ? '' : 'cursor-pointer'} appearance-none pr-9`}>{children}</select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">{ICON.chevron}</span>
    </div>
  )
}
const IB_TONES = {
  slate: 'border-slate-200 text-slate-600 hover:bg-slate-50',
  danger: 'border-rose-200 text-rose-600 hover:bg-rose-50',
}
function IconBtn({ title, onClick, icon, tone = 'slate', size = 9, badge }) {
  const dim = size === 8 ? 'h-8 w-8' : 'h-9 w-9'
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick}
      className={`relative inline-flex ${dim} items-center justify-center rounded-lg border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${IB_TONES[tone]}`}>
      {icon}
      {badge > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">{badge}</span>}
    </button>
  )
}
function FileIconBtn({ title, onChange, accept, size = 8 }) {
  const dim = size === 8 ? 'h-8 w-8' : 'h-9 w-9'
  return (
    <label title={title} aria-label={title}
      className={`inline-flex ${dim} cursor-pointer items-center justify-center rounded-lg border transition focus-within:ring-2 focus-within:ring-blue-500 ${IB_TONES.slate}`}>
      {ICON.upload}
      <input type="file" accept={accept} className="hidden" onChange={onChange} />
    </label>
  )
}

// Compact INR (Cr / L) for charts + KPI amounts.
function inr(n) {
  const v = Number(n) || 0
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`
  return `₹${v.toLocaleString('en-IN')}`
}
function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
}
function downloadExcel(filename, sections) {
  const tables = sections.map((s) => `<h3>${s.title}</h3><table border="1">${[s.head, ...s.rows].map((r) => `<tr>${r.map((c) => `<td>${c ?? ''}</td>`).join('')}</tr>`).join('')}</table>`).join('<br/>')
  const blob = new Blob([`<html><head><meta charset="utf-8"></head><body>${tables}</body></html>`], { type: 'application/vnd.ms-excel' })
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
}

function Bars({ items, money = false, empty = 'No data' }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  if (!items.some((i) => i.value > 0)) return <p className="py-6 text-center text-sm text-slate-400">{empty}</p>
  return (
    <div className="space-y-2">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-3">
          <div className="w-28 shrink-0 truncate text-xs text-slate-600" title={i.label}>{i.label}</div>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${i.color || 'bg-blue-500'}`} style={{ width: `${(i.value / max) * 100}%` }} /></div>
          <div className="w-20 shrink-0 text-right text-xs font-medium text-slate-700">{money ? inr(i.value) : i.value}</div>
        </div>
      ))}
    </div>
  )
}

export default function PaymentsPage({ title = 'Payments', subtitle = 'Record and manage customer payments received after booking.' }) {
  const { can } = useAuth()
  const canCreate = can('payment', 'create')
  const [searchParams, setSearchParams] = useSearchParams()

  const TABS = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'list', label: 'Payment List' },
    { key: 'receipts', label: 'Receipts' },
    { key: 'reports', label: 'Reports' },
  ]
  const tabParam = searchParams.get('tab')
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam : 'dashboard'
  const setTab = (t) => setSearchParams((p) => { p.set('tab', t); return p }, { replace: true })

  const [adding, setAdding] = useState(false)
  const [addBooking, setAddBooking] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const bump = () => setReloadKey((k) => k + 1)

  // Deep-link: /payments?add=<bookingId> (from a booking's "Add Payment" CTA).
  useEffect(() => {
    const bid = searchParams.get('add')
    if (bid) { setAddBooking(bid); setAdding(true); setSearchParams((p) => { p.delete('add'); return p }, { replace: true }) }
  }, []) // eslint-disable-line

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} actions={canCreate && <Button onClick={() => { setAddBooking(null); setAdding(true) }}>+ Add Payment</Button>} />

      <div className="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 text-sm transition ${tab === t.key ? 'border-b-2 border-blue-500 font-medium text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>{t.label}</button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab key={reloadKey} onOpen={setOpenId} />}
      {tab === 'list' && <ListTab key={reloadKey} onOpen={setOpenId} onAdd={() => { setAddBooking(null); setAdding(true) }} canCreate={canCreate} />}
      {tab === 'receipts' && <ReceiptsTab key={reloadKey} onOpen={setOpenId} />}
      {tab === 'reports' && <ReportsTab key={reloadKey} />}

      {adding && <AddPaymentModal bookingId={addBooking} onClose={() => setAdding(false)} onDone={() => { setAdding(false); bump() }} />}
      {openId && <PaymentDetailModal paymentId={openId} onClose={() => setOpenId(null)} onChanged={bump} />}
    </div>
  )
}

// ── Shared filter option hooks ───────────────────────────────────────────────
function useFilterOptions(isManager) {
  const { data: projects } = useFetch(useCallback(() => projectsApi.list({ limit: 200 }), []))
  const { data: branches } = useFetch(useCallback(() => (isManager ? branchesApi.list() : Promise.resolve({ data: { data: [] } })), [isManager]))
  const { data: employees } = useFetch(useCallback(() => (isManager ? usersApi.list({ status: 'active', limit: 300 }) : Promise.resolve({ data: { data: [] } })), [isManager]))
  return { projects: projects || [], branches: branches || [], employees: employees || [] }
}

// ── Dashboard ────────────────────────────────────────────────────────────────
function DashboardTab({ onOpen }) {
  const { can } = useAuth()
  const isManager = can('user', 'view')
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', branch: '', project: '', employee: '', method: 'all', status: 'all' })
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }))
  const opts = useFilterOptions(isManager)
  const { data, loading, error, refetch } = useFetch(useCallback(() => paymentsApi.dashboard(filters), [filters]))

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  const k = data.kpis
  const METHOD_COLOR = { cash: 'bg-emerald-500', cheque: 'bg-sky-500', bank_transfer: 'bg-indigo-500', upi: 'bg-violet-500', debit_card: 'bg-amber-500', credit_card: 'bg-orange-500', demand_draft: 'bg-teal-500' }

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="w-40"><Input label="From" type="date" value={filters.dateFrom} onChange={set('dateFrom')} /></div>
        <div className="w-40"><Input label="To" type="date" value={filters.dateTo} onChange={set('dateTo')} /></div>
        {isManager && <div className="w-40"><Select label="Branch" value={filters.branch} onChange={set('branch')}><option value="">All</option>{opts.branches.map((b) => <option key={b._id} value={b.name}>{b.name}</option>)}</Select></div>}
        <div className="w-44"><Select label="Project" value={filters.project} onChange={set('project')}><option value="">All</option>{opts.projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</Select></div>
        {isManager && <div className="w-40"><Select label="Employee" value={filters.employee} onChange={set('employee')}><option value="">All</option>{opts.employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}</Select></div>}
        <div className="w-36"><Select label="Method" value={filters.method} onChange={set('method')}><option value="all">All</option>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}</Select></div>
        <div className="w-36"><Select label="Status" value={filters.status} onChange={set('status')}><option value="all">All</option>{PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></div>
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Payments" value={k.totalPayments} />
        <StatCard label="Total Received" value={inr(k.totalAmount)} />
        <StatCard label="Today's Collection" value={inr(k.todayCollection)} />
        <StatCard label="This Month" value={inr(k.monthCollection)} />
        <StatCard label="Pending" value={k.pending} />
        <StatCard label="Verified" value={k.verified} />
        <StatCard label="Receipts Uploaded" value={k.receiptsUploaded} />
        <StatCard label="Avg Collection" value={inr(k.averageCollection)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5"><h3 className="mb-4 text-sm font-semibold text-slate-900">Monthly Collection</h3><Bars money items={data.monthlyCollection.map((m) => ({ label: m.label, value: m.amount, color: 'bg-blue-500' }))} /></Card>
        <Card className="p-5"><h3 className="mb-4 text-sm font-semibold text-slate-900">Payment Method Distribution</h3><Bars money items={data.methodDistribution.map((m) => ({ label: titleCase(m.method), value: m.amount, color: METHOD_COLOR[m.method] }))} /></Card>
        <Card className="p-5"><h3 className="mb-4 text-sm font-semibold text-slate-900">Branch Collection</h3><Bars money items={data.branchCollection.map((b) => ({ label: b.branch, value: b.amount, color: 'bg-teal-500' }))} /></Card>
        <Card className="p-5"><h3 className="mb-4 text-sm font-semibold text-slate-900">Project Collection</h3><Bars money items={data.projectCollection.map((p) => ({ label: p.project, value: p.amount, color: 'bg-violet-500' }))} /></Card>

        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Recent Payments</h3>
          {data.recentPayments.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No payments yet</p> : (
            <div className="space-y-2">{data.recentPayments.map((p) => (
              <button key={p._id} onClick={() => onOpen(p._id)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50">
                <div><div className="font-medium text-slate-800">{p.customerName}</div><div className="text-xs text-slate-500">{p.paymentCode} · {titleCase(p.method)}</div></div>
                <div className="text-right"><div className="font-semibold text-slate-800">{formatMoney(p.amount)}</div><StatusBadge status={p.status} /></div>
              </button>
            ))}</div>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Pending Verification</h3>
          {data.pendingVerification.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Nothing pending</p> : (
            <div className="space-y-2">{data.pendingVerification.map((p) => (
              <button key={p._id} onClick={() => onOpen(p._id)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50">
                <div><div className="font-medium text-slate-800">{p.customerName}</div><div className="text-xs text-slate-500">{p.paymentCode} · {formatDate(p.paymentDate)}</div></div>
                <div className="font-semibold text-slate-800">{formatMoney(p.amount)}</div>
              </button>
            ))}</div>
          )}
        </Card>
        <Card className="p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Recent Activity</h3>
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

// ── Payment List ─────────────────────────────────────────────────────────────
const EMPTY = { search: '', status: 'all', method: 'all', branch: '', project: '', employee: '', hasReceipt: '', dateFrom: '', dateTo: '', sortBy: 'newest' }

function ListTab({ onOpen, onAdd, canCreate }) {
  const { can } = useAuth()
  const toast = useToast()
  const isManager = can('user', 'view')
  const canDelete = can('payment', 'delete')
  const [filters, setFilters] = useState(EMPTY)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [selected, setSelected] = useState(new Set())
  const set = (k) => (e) => { setFilters((f) => ({ ...f, [k]: e.target.value })); setPage(1) }
  const opts = useFilterOptions(isManager)
  const { data, meta, loading, error, refetch } = useFetch(useCallback(() => paymentsApi.list({ page, limit, ...filters }), [page, limit, filters]))

  const rows = data || []
  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r._id))
  const toggleAll = () => setSelected((s) => { const n = new Set(s); allChecked ? rows.forEach((r) => n.delete(r._id)) : rows.forEach((r) => n.add(r._id)); return n })

  const exportRows = (list) => [['Payment ID', 'Customer', 'Booking', 'Project', 'Unit', 'Branch', 'Amount', 'Date', 'Method', 'Status', 'Receipt', 'Entered By'],
    ...list.map((p) => [p.paymentCode, p.customerName, String(p.booking).slice(-6), p.projectName, p.unitNumber, p.branch, p.amount, formatDate(p.paymentDate), titleCase(p.method), titleCase(p.status), p.receipt?.fileUrl ? 'Yes' : 'No', p.enteredBy?.name || p.enteredByName])]
  const selectedRows = rows.filter((r) => selected.has(r._id))
  const forExport = selectedRows.length ? selectedRows : rows

  async function del(p) {
    if (!window.confirm(`Delete payment ${p.paymentCode}? It will be soft-deleted.`)) return
    try { await paymentsApi.remove(p._id); toast.success('Payment deleted'); refetch() } catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }
  async function upload(p, e) {
    const f = e.target.files?.[0]; if (!f) return
    const fd = new FormData(); fd.append('file', f); fd.append('label', f.name)
    try { await paymentsApi.uploadReceipt(p._id, fd); toast.success('Receipt uploaded'); refetch() } catch (err) { toast.error(err.response?.data?.message || 'Failed') }
    e.target.value = ''
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          {/* Search — most prominent, spans the widest */}
          <FField label="Search" className="sm:col-span-2 lg:col-span-2">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{ICON.search}</span>
              <input value={filters.search} onChange={set('search')} placeholder="Search by Payment ID, Customer, Transaction ID, or Reference No." className={`${filterCls} pl-10`} />
            </div>
          </FField>
          <FField label="Status">
            <FSelect value={filters.status} onChange={set('status')}><option value="all">All</option>{PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</FSelect>
          </FField>
          <FField label="Method">
            <FSelect value={filters.method} onChange={set('method')}><option value="all">All</option>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}</FSelect>
          </FField>
          <FField label="Receipt">
            <FSelect value={filters.hasReceipt} onChange={set('hasReceipt')}><option value="">All</option><option value="true">With</option><option value="false">Without</option></FSelect>
          </FField>

          <FField label="Project">
            <FSelect value={filters.project} onChange={set('project')}><option value="">All</option>{opts.projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</FSelect>
          </FField>
          {isManager && (
            <FField label="Branch">
              <FSelect value={filters.branch} onChange={set('branch')}><option value="">All</option>{opts.branches.map((b) => <option key={b._id} value={b.name}>{b.name}</option>)}</FSelect>
            </FField>
          )}
          {isManager && (
            <FField label="Employee">
              <FSelect value={filters.employee} onChange={set('employee')}><option value="">All</option>{opts.employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}</FSelect>
            </FField>
          )}
          <FField label="From">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{ICON.calendar}</span>
              <input type="date" value={filters.dateFrom} onChange={set('dateFrom')} className={`${filterCls} pl-10`} />
            </div>
          </FField>
          <FField label="To">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{ICON.calendar}</span>
              <input type="date" value={filters.dateTo} onChange={set('dateTo')} className={`${filterCls} pl-10`} />
            </div>
          </FField>
          <FField label="Sort By">
            <FSelect value={filters.sortBy} onChange={set('sortBy')}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="amount_high">Amount high</option><option value="amount_low">Amount low</option></FSelect>
          </FField>
          <button type="button" onClick={() => { setFilters(EMPTY); setPage(1) }}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-600 outline-none transition duration-150 hover:bg-slate-50 active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500">
            {ICON.reset}<span>Reset</span>
          </button>
        </div>
      </Card>

      {/* Bulk toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-slate-500">{meta?.total ?? 0} payment{(meta?.total ?? 0) === 1 ? '' : 's'}{selected.size ? ` · ${selected.size} selected` : ''}</div>
        <div className="flex items-center gap-2">
          <IconBtn title={selected.size ? `Export ${selected.size} selected` : 'Export CSV'} icon={ICON.export} badge={selected.size} onClick={() => downloadCSV('payments.csv', exportRows(forExport))} />
          <IconBtn title="Print" icon={ICON.print} onClick={() => window.print()} />
          {canCreate && <Button size="sm" onClick={onAdd}>+ Add Payment</Button>}
        </div>
      </div>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3"><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
                <th className="px-3 py-3 font-medium">Payment ID</th>
                <th className="px-3 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium">Project / Unit</th>
                <th className="px-3 py-3 font-medium">Branch</th>
                <th className="px-3 py-3 font-medium text-right">Amount</th>
                <th className="px-3 py-3 font-medium">Date</th>
                <th className="px-3 py-3 font-medium">Method</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Receipt</th>
                <th className="px-3 py-3 font-medium">Entered By</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-10 text-center text-slate-400">No payments found. Use “+ Add Payment” to record one.</td></tr>
              ) : rows.map((p) => (
                <tr key={p._id} className="hover:bg-slate-50">
                  <td className="px-3 py-3"><input type="checkbox" checked={selected.has(p._id)} onChange={() => toggle(p._id)} /></td>
                  <td className="px-3 py-3 font-medium text-slate-800">{p.paymentCode}</td>
                  <td className="px-3 py-3 text-slate-700">{p.customerName}</td>
                  <td className="px-3 py-3 text-slate-600">{p.projectName || '—'}<div className="text-xs text-slate-400">Unit {p.unitNumber || '—'}</div></td>
                  <td className="px-3 py-3 text-slate-600">{p.branch || '—'}</td>
                  <td className="px-3 py-3 text-right font-medium text-slate-800">{formatMoney(p.amount)}</td>
                  <td className="px-3 py-3 text-slate-600">{formatDate(p.paymentDate)}</td>
                  <td className="px-3 py-3 text-slate-600">{titleCase(p.method)}</td>
                  <td className="px-3 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-3 py-3">{p.receipt?.fileUrl ? <span className="text-emerald-600">✓</span> : <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-3 text-slate-600">{p.enteredBy?.name || p.enteredByName || '—'}</td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1.5">
                      <IconBtn title="View" icon={ICON.view} size={8} onClick={() => onOpen(p._id)} />
                      <FileIconBtn title="Upload receipt" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => upload(p, e)} />
                      {canDelete && <IconBtn title="Delete" icon={ICON.trash} tone="danger" size={8} onClick={() => del(p)} />}
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

// ── Receipts ─────────────────────────────────────────────────────────────────
function ReceiptsTab({ onOpen }) {
  const { data, loading, error, refetch } = useFetch(useCallback(() => paymentsApi.list({ hasReceipt: 'true', limit: 60, sortBy: 'newest' }), []))
  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  const rows = data || []
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">All uploaded payment receipts.</p>
      {rows.length === 0 ? <Card className="py-16 text-center text-sm text-slate-400">No receipts uploaded yet.</Card> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => (
            <Card key={p._id} className="p-4">
              <div className="mb-2 flex items-center justify-between"><span className="text-sm font-medium text-slate-800">{p.receipt?.receiptNumber || 'Receipt'}</span><StatusBadge status={p.status} /></div>
              <div className="text-sm text-slate-600">{p.customerName}</div>
              <div className="text-xs text-slate-400">{p.paymentCode} · {formatMoney(p.amount)} · {formatDate(p.paymentDate)}</div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => onOpen(p._id)}>Open</Button>
                <a href={p.receipt?.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Download</a>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Reports ──────────────────────────────────────────────────────────────────
function ReportsTab() {
  const { can } = useAuth()
  const isManager = can('user', 'view')
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', branch: '', project: '', employee: '', method: 'all', status: 'all' })
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }))
  const opts = useFilterOptions(isManager)
  const { data, loading, error, refetch } = useFetch(useCallback(() => paymentsApi.reports(filters), [filters]))
  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  const sections = [
    { title: 'Collection Summary', head: ['Status', 'Count', 'Amount'], rows: data.collectionSummary.map((s) => [titleCase(s.status), s.count, s.amount]) },
    { title: 'Daily Collection', head: ['Date', 'Count', 'Amount'], rows: data.daily.map((d) => [d.date, d.count, d.amount]) },
    { title: 'Monthly Collection', head: ['Month', 'Count', 'Amount'], rows: data.monthly.map((m) => [m.month, m.count, m.amount]) },
    { title: 'Branch Collection', head: ['Branch', 'Count', 'Amount'], rows: data.branch.map((b) => [b.branch, b.count, b.amount]) },
    { title: 'Project Collection', head: ['Project', 'Count', 'Amount'], rows: data.project.map((p) => [p.project, p.count, p.amount]) },
    { title: 'Executive Collection', head: ['Executive', 'Count', 'Amount'], rows: data.executive.map((e) => [e.executive, e.count, e.amount]) },
    { title: 'Customer Payment', head: ['Customer', 'Count', 'Amount'], rows: data.customer.map((c) => [c.customer, c.count, c.amount]) },
  ]

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="w-40"><Input label="From" type="date" value={filters.dateFrom} onChange={set('dateFrom')} /></div>
        <div className="w-40"><Input label="To" type="date" value={filters.dateTo} onChange={set('dateTo')} /></div>
        {isManager && <div className="w-40"><Select label="Branch" value={filters.branch} onChange={set('branch')}><option value="">All</option>{opts.branches.map((b) => <option key={b._id} value={b.name}>{b.name}</option>)}</Select></div>}
        <div className="w-44"><Select label="Project" value={filters.project} onChange={set('project')}><option value="">All</option>{opts.projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</Select></div>
        {isManager && <div className="w-40"><Select label="Executive" value={filters.employee} onChange={set('employee')}><option value="">All</option>{opts.employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}</Select></div>}
        <div className="w-36"><Select label="Method" value={filters.method} onChange={set('method')}><option value="all">All</option>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}</Select></div>
        <div className="w-36"><Select label="Status" value={filters.status} onChange={set('status')}><option value="all">All</option>{PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></div>
        <div className="ml-auto">
          <ExportMenu items={[
            { key: 'csv', label: 'CSV', icon: 'description', onClick: () => downloadCSV('payment-reports.csv', sections.flatMap((s) => [[s.title], s.head, ...s.rows, []])) },
            { key: 'excel', label: 'Excel', icon: 'table_view', onClick: () => downloadExcel('payment-reports.xls', sections) },
            { key: 'print', label: 'Print / PDF', icon: 'print', onClick: () => window.print() },
          ]} />
        </div>
      </Card>

      {sections.map((s) => (
        <Card key={s.title} className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">{s.title}</h3>
            <ExportMenu size="sm" items={[
              { key: 'csv', label: 'CSV', icon: 'description', onClick: () => downloadCSV(`${s.title.replace(/\s+/g, '-').toLowerCase()}.csv`, [s.head, ...s.rows]) },
              { key: 'excel', label: 'Excel', icon: 'table_view', onClick: () => downloadExcel(`${s.title.replace(/\s+/g, '-').toLowerCase()}.xls`, [s]) },
              { key: 'print', label: 'Print / PDF', icon: 'print', onClick: () => window.print() },
            ]} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500"><tr>{s.head.map((h, i) => <th key={h} className={`py-2 pr-4 font-medium ${i === 2 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {s.rows.length === 0 ? <tr><td colSpan={s.head.length} className="py-6 text-center text-slate-400">No data</td></tr> : s.rows.map((r, i) => (
                  <tr key={i}>{r.map((c, j) => <td key={j} className={`py-2 pr-4 text-slate-700 ${j === 2 ? 'text-right font-medium' : ''}`}>{j === 2 ? formatMoney(c) : c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  )
}
