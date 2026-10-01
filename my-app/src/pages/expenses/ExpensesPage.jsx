import { useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { expensesApi, projectsApi, branchesApi, usersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, formatMoney, titleCase } from '../../lib/format.js'
import { PageHeader, Card, StatCard, Button, Input, Select, StatusBadge, Pagination, Modal, Loader, ErrorState, ExportMenu } from '../../components/ui.jsx'
import { PAYMENT_METHODS, EXPENSE_STATUSES, DEPARTMENTS } from '../../lib/expenses.js'
import AddExpenseModal from './AddExpenseModal.jsx'
import ExpenseDetailModal from './ExpenseDetailModal.jsx'

// Icon-button kit for compact row actions.
const svg = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">{p}</svg>
const ICON = {
  view: svg(<><path d="M2.04 12.32a1 1 0 0 1 0-.64C3.42 7.51 7.36 4.5 12 4.5s8.57 3.01 9.96 7.18a1 1 0 0 1 0 .64C20.58 16.49 16.64 19.5 12 19.5s-8.57-3.01-9.96-7.18Z" /><circle cx="12" cy="12" r="3" /></>),
  upload: svg(<><path d="M12 15V5m0 0-4 4m4-4 4 4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>),
  trash: svg(<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13h6l1-13" />),
}
const IB_TONES = { slate: 'border-slate-200 text-slate-600 hover:bg-slate-50', danger: 'border-rose-200 text-rose-600 hover:bg-rose-50' }
function IconBtn({ title, onClick, icon, tone = 'slate' }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border outline-none transition duration-150 focus-visible:ring-2 focus-visible:ring-blue-500 ${IB_TONES[tone]}`}>{icon}</button>
  )
}
function FileIconBtn({ title, accept, onChange }) {
  return (
    <label title={title} aria-label={title}
      className={`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border transition duration-150 focus-within:ring-2 focus-within:ring-blue-500 ${IB_TONES.slate}`}>
      {ICON.upload}<input type="file" accept={accept} className="hidden" onChange={onChange} />
    </label>
  )
}

function inr(n) { const v = Number(n) || 0; if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`; if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`; return `₹${v.toLocaleString('en-IN')}` }
function downloadCSV(filename, rows) { const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'); const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url) }
function downloadExcel(filename, sections) { const tables = sections.map((s) => `<h3>${s.title}</h3><table border="1">${[s.head, ...s.rows].map((r) => `<tr>${r.map((c) => `<td>${c ?? ''}</td>`).join('')}</tr>`).join('')}</table>`).join('<br/>'); const blob = new Blob([`<html><head><meta charset="utf-8"></head><body>${tables}</body></html>`], { type: 'application/vnd.ms-excel' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url) }

function Bars({ items, money = false, empty = 'No data' }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  if (!items.some((i) => i.value > 0)) return <p className="py-6 text-center text-sm text-slate-400">{empty}</p>
  return (
    <div className="space-y-2">{items.map((i) => (
      <div key={i.label} className="flex items-center gap-3">
        <div className="w-28 shrink-0 truncate text-xs text-slate-600" title={i.label}>{i.label}</div>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${i.color || 'bg-blue-500'}`} style={{ width: `${(i.value / max) * 100}%` }} /></div>
        <div className="w-20 shrink-0 text-right text-xs font-medium text-slate-700">{money ? inr(i.value) : i.value}</div>
      </div>
    ))}</div>
  )
}

export default function ExpensesPage({ title = 'Expenses', subtitle = 'Record, track and analyze company expenses.' }) {
  const { can } = useAuth()
  const canCreate = can('expense', 'create')
  const [searchParams, setSearchParams] = useSearchParams()
  const TABS = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'list', label: 'Expense List' },
    { key: 'categories', label: 'Categories' },
    { key: 'reports', label: 'Reports' },
  ]
  const tabParam = searchParams.get('tab')
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam : 'dashboard'
  const setTab = (t) => setSearchParams((p) => { p.set('tab', t); return p }, { replace: true })

  const [adding, setAdding] = useState(false)
  const [editExpense, setEditExpense] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const bump = () => setReloadKey((k) => k + 1)
  const openEdit = (x) => { setOpenId(null); setEditExpense(x) }

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} actions={canCreate && <Button onClick={() => { setEditExpense(null); setAdding(true) }}>+ Add Expense</Button>} />
      <div className="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 text-sm transition ${tab === t.key ? 'border-b-2 border-blue-500 font-medium text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>{t.label}</button>)}
      </div>

      {tab === 'dashboard' && <DashboardTab key={reloadKey} onOpen={setOpenId} />}
      {tab === 'list' && <ListTab key={reloadKey} onOpen={setOpenId} onAdd={() => { setEditExpense(null); setAdding(true) }} canCreate={canCreate} />}
      {tab === 'categories' && <CategoriesTab key={reloadKey} />}
      {tab === 'reports' && <ReportsTab key={reloadKey} />}

      {(adding || editExpense) && <AddExpenseModal expense={editExpense} onClose={() => { setAdding(false); setEditExpense(null) }} onDone={() => { setAdding(false); setEditExpense(null); bump() }} />}
      {openId && <ExpenseDetailModal expenseId={openId} onClose={() => setOpenId(null)} onChanged={bump} onEdit={openEdit} />}
    </div>
  )
}

function useOpts(isManager) {
  const { data: projects } = useFetch(useCallback(() => projectsApi.list({ limit: 200 }), []))
  const { data: branches } = useFetch(useCallback(() => (isManager ? branchesApi.list() : Promise.resolve({ data: { data: [] } })), [isManager]))
  const { data: employees } = useFetch(useCallback(() => (isManager ? usersApi.list({ status: 'active', limit: 300 }) : Promise.resolve({ data: { data: [] } })), [isManager]))
  const { data: categories } = useFetch(useCallback(() => expensesApi.categories(), []))
  const { data: config } = useFetch(useCallback(() => expensesApi.config(), []))
  return { projects: projects || [], branches: branches || [], employees: employees || [], categories: categories || [], departments: config?.departments?.length ? config.departments : DEPARTMENTS }
}

// ── Dashboard ────────────────────────────────────────────────────────────────
function DashboardTab({ onOpen }) {
  const { can } = useAuth()
  const isManager = can('user', 'view')
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', branch: '', department: '', category: '', employee: '', status: 'all' })
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }))
  const opts = useOpts(isManager)
  const { data, loading, error, refetch } = useFetch(useCallback(() => expensesApi.dashboard(filters), [filters]))
  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  const k = data.kpis

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="w-40"><Input label="From" type="date" value={filters.dateFrom} onChange={set('dateFrom')} /></div>
        <div className="w-40"><Input label="To" type="date" value={filters.dateTo} onChange={set('dateTo')} /></div>
        {isManager && <div className="w-40"><Select label="Branch" value={filters.branch} onChange={set('branch')}><option value="">All</option>{opts.branches.map((b) => <option key={b._id} value={b.name}>{b.name}</option>)}</Select></div>}
        <div className="w-40"><Select label="Department" value={filters.department} onChange={set('department')}><option value="">All</option>{opts.departments.map((d) => <option key={d} value={d}>{d}</option>)}</Select></div>
        <div className="w-44"><Select label="Category" value={filters.category} onChange={set('category')}><option value="">All</option>{opts.categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select></div>
        {isManager && <div className="w-40"><Select label="Employee" value={filters.employee} onChange={set('employee')}><option value="">All</option>{opts.employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}</Select></div>}
        <div className="w-36"><Select label="Status" value={filters.status} onChange={set('status')}><option value="all">All</option>{EXPENSE_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></div>
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Expenses" value={inr(k.totalExpenses)} hint={`${k.totalCount} records`} />
        <StatCard label="Today" value={inr(k.todayExpenses)} />
        <StatCard label="This Month" value={inr(k.monthExpenses)} />
        <StatCard label="Branch Expenses" value={inr(k.branchExpenses)} />
        <StatCard label="Marketing" value={inr(k.marketingExpenses)} />
        <StatCard label="Verified" value={k.verified} />
        <StatCard label="Pending" value={k.pending} />
        <StatCard label="Avg Expense" value={inr(k.averageExpense)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5"><h3 className="mb-4 text-sm font-semibold text-slate-900">Monthly Expense Trend</h3><Bars money items={data.monthlyTrend.map((m) => ({ label: m.label, value: m.amount, color: 'bg-blue-500' }))} /></Card>
        <Card className="p-5"><h3 className="mb-4 text-sm font-semibold text-slate-900">Category-wise Expenses</h3><Bars money items={data.categoryBreakdown.map((c) => ({ label: c.category, value: c.amount, color: 'bg-teal-500' }))} /></Card>
        <Card className="p-5"><h3 className="mb-4 text-sm font-semibold text-slate-900">Branch-wise Expenses</h3><Bars money items={data.branchBreakdown.map((b) => ({ label: b.branch, value: b.amount, color: 'bg-indigo-500' }))} /></Card>
        <Card className="p-5"><h3 className="mb-4 text-sm font-semibold text-slate-900">Department-wise Expenses</h3><Bars money items={data.departmentBreakdown.map((d) => ({ label: d.department, value: d.amount, color: 'bg-violet-500' }))} /></Card>

        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Recent Expenses</h3>
          {data.recentExpenses.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No expenses yet</p> : (
            <div className="space-y-2">{data.recentExpenses.map((x) => (
              <button key={x._id} onClick={() => onOpen(x._id)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50">
                <div><div className="font-medium text-slate-800">{x.title}</div><div className="text-xs text-slate-500">{x.expenseCode} · {x.categoryName}</div></div>
                <div className="text-right"><div className="font-semibold text-slate-800">{formatMoney(x.amount)}</div><StatusBadge status={x.status} /></div>
              </button>
            ))}</div>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Pending Verification</h3>
          {data.pendingVerification.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Nothing pending</p> : (
            <div className="space-y-2">{data.pendingVerification.map((x) => (
              <button key={x._id} onClick={() => onOpen(x._id)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50">
                <div><div className="font-medium text-slate-800">{x.title}</div><div className="text-xs text-slate-500">{x.expenseCode} · {formatDate(x.expenseDate)}</div></div>
                <div className="font-semibold text-slate-800">{formatMoney(x.amount)}</div>
              </button>
            ))}</div>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Top Expense Categories</h3>
          <Bars money items={data.topCategories.map((c) => ({ label: c.category, value: c.amount, color: 'bg-amber-500' }))} empty="No data" />
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

// ── Expense List ─────────────────────────────────────────────────────────────
const EMPTY = { search: '', status: 'all', method: 'all', branch: '', department: '', category: '', employee: '', hasReceipt: '', dateFrom: '', dateTo: '', sortBy: 'newest' }

function ListTab({ onOpen, onAdd, canCreate }) {
  const { can } = useAuth()
  const toast = useToast()
  const isManager = can('user', 'view')
  const canDelete = can('expense', 'delete')
  const [filters, setFilters] = useState(EMPTY)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [selected, setSelected] = useState(new Set())
  const set = (k) => (e) => { setFilters((f) => ({ ...f, [k]: e.target.value })); setPage(1) }
  const opts = useOpts(isManager)
  const { data, meta, loading, error, refetch } = useFetch(useCallback(() => expensesApi.list({ page, limit, ...filters }), [page, limit, filters]))
  const rows = data || []
  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r._id))
  const toggleAll = () => setSelected((s) => { const n = new Set(s); allChecked ? rows.forEach((r) => n.delete(r._id)) : rows.forEach((r) => n.add(r._id)); return n })
  const exportRows = (list) => [['Expense ID', 'Title', 'Category', 'Branch', 'Department', 'Employee', 'Amount', 'Date', 'Method', 'Status', 'Receipt', 'Created By'], ...list.map((x) => [x.expenseCode, x.title, x.categoryName, x.branch, x.department, x.createdByName, x.amount, formatDate(x.expenseDate), titleCase(x.paymentMethod), titleCase(x.status), x.receipt?.fileUrl ? 'Yes' : 'No', x.createdBy?.name || x.createdByName])]
  const selectedRows = rows.filter((r) => selected.has(r._id))
  const forExport = selectedRows.length ? selectedRows : rows

  async function del(x) { if (!window.confirm(`Delete ${x.expenseCode}? It will be soft-deleted.`)) return; try { await expensesApi.remove(x._id); toast.success('Deleted'); refetch() } catch (err) { toast.error(err.response?.data?.message || 'Failed') } }
  async function upload(x, e) { const f = e.target.files?.[0]; if (!f) return; const fd = new FormData(); fd.append('file', f); fd.append('label', f.name); try { await expensesApi.uploadReceipt(x._id, fd); toast.success('Receipt uploaded'); refetch() } catch (err) { toast.error(err.response?.data?.message || 'Failed') } e.target.value = '' }

  return (
    <div className="space-y-4">
      <Card className="sticky top-0 z-10 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[200px] flex-1"><Input label="Search" placeholder="Title, Expense ID, employee, reference…" value={filters.search} onChange={set('search')} /></div>
        <div className="w-36"><Select label="Status" value={filters.status} onChange={set('status')}><option value="all">All</option>{EXPENSE_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></div>
        <div className="w-40"><Select label="Category" value={filters.category} onChange={set('category')}><option value="">All</option>{opts.categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select></div>
        <div className="w-36"><Select label="Department" value={filters.department} onChange={set('department')}><option value="">All</option>{opts.departments.map((d) => <option key={d} value={d}>{d}</option>)}</Select></div>
        {isManager && <div className="w-36"><Select label="Branch" value={filters.branch} onChange={set('branch')}><option value="">All</option>{opts.branches.map((b) => <option key={b._id} value={b.name}>{b.name}</option>)}</Select></div>}
        {isManager && <div className="w-40"><Select label="Employee" value={filters.employee} onChange={set('employee')}><option value="">All</option>{opts.employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}</Select></div>}
        <div className="w-32"><Select label="Method" value={filters.method} onChange={set('method')}><option value="all">All</option>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}</Select></div>
        <div className="w-32"><Select label="Receipt" value={filters.hasReceipt} onChange={set('hasReceipt')}><option value="">All</option><option value="true">With</option><option value="false">Without</option></Select></div>
        <div className="w-36"><Input label="From" type="date" value={filters.dateFrom} onChange={set('dateFrom')} /></div>
        <div className="w-36"><Input label="To" type="date" value={filters.dateTo} onChange={set('dateTo')} /></div>
        <div className="w-36"><Select label="Sort" value={filters.sortBy} onChange={set('sortBy')}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="amount_high">Amount high</option><option value="amount_low">Amount low</option></Select></div>
        <Button variant="secondary" onClick={() => { setFilters(EMPTY); setPage(1) }}>Reset</Button>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-slate-500">{meta?.total ?? 0} expense{(meta?.total ?? 0) === 1 ? '' : 's'}{selected.size ? ` · ${selected.size} selected` : ''}</div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => downloadCSV('expenses.csv', exportRows(forExport))}>Export{selected.size ? ` (${selected.size})` : ''}</Button>
          <Button size="sm" variant="secondary" onClick={() => window.print()}>Print</Button>
          {canCreate && <Button size="sm" onClick={onAdd}>+ Add Expense</Button>}
        </div>
      </div>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3"><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
                <th className="px-3 py-3 font-medium">Expense ID</th><th className="px-3 py-3 font-medium">Title</th><th className="px-3 py-3 font-medium">Category</th>
                <th className="px-3 py-3 font-medium">Branch / Dept</th><th className="px-3 py-3 font-medium">Employee</th><th className="px-3 py-3 font-medium text-right">Amount</th>
                <th className="px-3 py-3 font-medium">Date</th><th className="px-3 py-3 font-medium">Method</th><th className="px-3 py-3 font-medium">Status</th><th className="px-3 py-3 font-medium">Receipt</th><th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-10 text-center text-slate-400">No expenses found. Use “+ Add Expense” to record one.</td></tr>
              ) : rows.map((x) => (
                <tr key={x._id} className="hover:bg-slate-50">
                  <td className="px-3 py-3"><input type="checkbox" checked={selected.has(x._id)} onChange={() => toggle(x._id)} /></td>
                  <td className="px-3 py-3 font-medium text-slate-800">{x.expenseCode}</td>
                  <td className="px-3 py-3 text-slate-700">{x.title}</td>
                  <td className="px-3 py-3 text-slate-600">{x.categoryName}</td>
                  <td className="px-3 py-3 text-slate-600">{x.branch || '—'}<div className="text-xs text-slate-400">{x.department || '—'}</div></td>
                  <td className="px-3 py-3 text-slate-600">{x.createdBy?.name || x.createdByName || '—'}</td>
                  <td className="px-3 py-3 text-right font-medium text-slate-800">{formatMoney(x.amount)}</td>
                  <td className="px-3 py-3 text-slate-600">{formatDate(x.expenseDate)}</td>
                  <td className="px-3 py-3 text-slate-600">{titleCase(x.paymentMethod)}</td>
                  <td className="px-3 py-3"><StatusBadge status={x.status} /></td>
                  <td className="px-3 py-3">{x.receipt?.fileUrl ? <span className="text-emerald-600">✓</span> : <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1.5">
                      <IconBtn title="View" icon={ICON.view} onClick={() => onOpen(x._id)} />
                      <FileIconBtn title="Upload receipt" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => upload(x, e)} />
                      {canDelete && <IconBtn title="Delete" icon={ICON.trash} tone="danger" onClick={() => del(x)} />}
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

// ── Categories ───────────────────────────────────────────────────────────────
function CategoriesTab() {
  const { can } = useAuth()
  const toast = useToast()
  const canManage = can('expense', 'edit')
  const { data, loading, error, refetch } = useFetch(useCallback(() => expensesApi.categories(), []))
  const [editing, setEditing] = useState(null)
  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  async function remove(c) { if (!window.confirm(`Delete category "${c.name}"?`)) return; try { const res = await expensesApi.removeCategory(c._id); toast.success(res.data.message || 'Deleted'); refetch() } catch (err) { toast.error(err.response?.data?.message || 'Failed') } }
  async function toggleActive(c) { try { await expensesApi.updateCategory(c._id, { active: !c.active }); refetch() } catch (err) { toast.error(err.response?.data?.message || 'Failed') } }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Configurable expense categories. Marketing-group categories feed the Marketing KPI.</p>
        {canManage && <Button onClick={() => setEditing({})}>+ New Category</Button>}
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-medium">Category</th><th className="px-4 py-3 font-medium">Group</th><th className="px-4 py-3 font-medium text-right">Used By</th><th className="px-4 py-3 font-medium text-right">Total</th><th className="px-4 py-3 font-medium">Active</th><th className="px-4 py-3" /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {(data || []).map((c) => (
              <tr key={c._id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                <td className="px-4 py-3"><span className={`rounded border px-2 py-0.5 text-xs ${c.group === 'marketing' ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{titleCase(c.group)}</span></td>
                <td className="px-4 py-3 text-right text-slate-600">{c.usage}</td>
                <td className="px-4 py-3 text-right text-slate-700">{formatMoney(c.amount)}</td>
                <td className="px-4 py-3">{c.active !== false ? <span className="text-emerald-600">Active</span> : <span className="text-slate-400">Disabled</span>}</td>
                <td className="px-4 py-3">{canManage && (
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(c)}>Edit</Button>
                    <Button size="sm" variant="secondary" onClick={() => toggleActive(c)}>{c.active !== false ? 'Disable' : 'Enable'}</Button>
                    <Button size="sm" variant="danger" onClick={() => remove(c)}>Delete</Button>
                  </div>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <CategoryModal category={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); refetch() }} />}
    </div>
  )
}

function CategoryModal({ category, onClose, onDone }) {
  const toast = useToast()
  const isNew = !category._id
  const [form, setForm] = useState({ name: category.name || '', group: category.group || 'general' })
  const [busy, setBusy] = useState(false)
  async function save() {
    if (form.name.trim().length < 2) { toast.error('Name is required'); return }
    setBusy(true)
    try { if (isNew) await expensesApi.createCategory(form); else await expensesApi.updateCategory(category._id, form); toast.success(isNew ? 'Category created' : 'Category updated'); onDone() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={isNew ? 'New Category' : `Edit — ${category.name}`} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{isNew ? 'Create' : 'Save'}</Button></>}>
      <div className="space-y-4">
        <Input label="Category Name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <Select label="Group" value={form.group} onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}><option value="general">General</option><option value="marketing">Marketing</option></Select>
      </div>
    </Modal>
  )
}

// ── Reports ──────────────────────────────────────────────────────────────────
function ReportsTab() {
  const { can } = useAuth()
  const isManager = can('user', 'view')
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', branch: '', department: '', category: '', employee: '', status: 'all' })
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }))
  const opts = useOpts(isManager)
  const { data, loading, error, refetch } = useFetch(useCallback(() => expensesApi.reports(filters), [filters]))
  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  const sections = [
    { title: 'Status Summary', head: ['Status', 'Count', 'Amount'], rows: data.statusSummary.map((s) => [titleCase(s.status), s.count, s.amount]) },
    { title: 'Daily Expense Report', head: ['Date', 'Count', 'Amount'], rows: data.daily.map((d) => [d.date, d.count, d.amount]) },
    { title: 'Monthly Expense Report', head: ['Month', 'Count', 'Amount'], rows: data.monthly.map((m) => [m.month, m.count, m.amount]) },
    { title: 'Branch Expense Report', head: ['Branch', 'Count', 'Amount'], rows: data.branch.map((b) => [b.branch, b.count, b.amount]) },
    { title: 'Department Expense Report', head: ['Department', 'Count', 'Amount'], rows: data.department.map((d) => [d.department, d.count, d.amount]) },
    { title: 'Category-wise Expense Report', head: ['Category', 'Count', 'Amount'], rows: data.category.map((c) => [c.category, c.count, c.amount]) },
    { title: 'Employee Expense Report', head: ['Employee', 'Count', 'Amount'], rows: data.employee.map((e) => [e.employee, e.count, e.amount]) },
    { title: 'Marketing Expense Report', head: ['Category', 'Count', 'Amount'], rows: data.marketing.map((m) => [m.category, m.count, m.amount]) },
  ]

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="w-40"><Input label="From" type="date" value={filters.dateFrom} onChange={set('dateFrom')} /></div>
        <div className="w-40"><Input label="To" type="date" value={filters.dateTo} onChange={set('dateTo')} /></div>
        {isManager && <div className="w-40"><Select label="Branch" value={filters.branch} onChange={set('branch')}><option value="">All</option>{opts.branches.map((b) => <option key={b._id} value={b.name}>{b.name}</option>)}</Select></div>}
        <div className="w-40"><Select label="Department" value={filters.department} onChange={set('department')}><option value="">All</option>{opts.departments.map((d) => <option key={d} value={d}>{d}</option>)}</Select></div>
        <div className="w-44"><Select label="Category" value={filters.category} onChange={set('category')}><option value="">All</option>{opts.categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select></div>
        {isManager && <div className="w-40"><Select label="Employee" value={filters.employee} onChange={set('employee')}><option value="">All</option>{opts.employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}</Select></div>}
        <div className="w-36"><Select label="Status" value={filters.status} onChange={set('status')}><option value="all">All</option>{EXPENSE_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></div>
        <div className="ml-auto">
          <ExportMenu items={[
            { key: 'csv', label: 'CSV', icon: 'description', onClick: () => downloadCSV('expense-reports.csv', sections.flatMap((s) => [[s.title], s.head, ...s.rows, []])) },
            { key: 'excel', label: 'Excel', icon: 'table_view', onClick: () => downloadExcel('expense-reports.xls', sections) },
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
