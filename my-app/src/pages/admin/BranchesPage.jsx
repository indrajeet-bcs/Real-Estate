import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { branchesApi, usersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { PageHeader, StatCard, Button, Input, Select, Modal, Table, StatusBadge, Loader, ErrorState } from '../../components/ui.jsx'
import { TargetStatusBadge } from './BranchDetailsPage.jsx'

// Icon action buttons (match AdminEmployeesPage's compact row-action style).
const ICONS = {
  eye: (<><path d="M2.036 12.322a1.012 1.012 0 0 1 0-.644C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.01 9.963 7.178.07.207.07.43 0 .644C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.01-9.963-7.178Z" /><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></>),
  pencil: (<path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />),
  target: (<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.5" /></>),
  power: (<path d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9" />),
  trash: (<path d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />),
}
const TONES = {
  slate: 'border-slate-200 text-slate-600 hover:bg-slate-50',
  danger: 'border-rose-200 text-rose-600 hover:bg-rose-50',
  success: 'border-emerald-200 text-emerald-600 hover:bg-emerald-50',
}
function IconBtn({ title, onClick, icon, tone = 'slate' }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${TONES[tone]}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">{icon}</svg>
    </button>
  )
}

// Compact INR (Cr / L) — mirrors the prototype's formatINR.
function inr(n) {
  const v = Number(n) || 0
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`
  return `₹${v.toLocaleString('en-IN')}`
}

function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function BranchesPage() {
  const { can } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [tab, setTab] = useState('branches') // 'branches' | 'comparison'
  const [editing, setEditing] = useState(null)
  const [targeting, setTargeting] = useState(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  const { data, loading, error, refetch } = useFetch(useCallback(() => branchesApi.list(), []))

  const filtered = useMemo(() => {
    let rows = data || []
    if (status !== 'all') rows = rows.filter((b) => b.status === status)
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter((b) =>
        [b.name, b.code, b.city, b.adminUser?.name].some((v) => (v || '').toLowerCase().includes(q))
      )
    }
    return rows
  }, [data, status, search])

  const kpis = useMemo(() => {
    const rows = data || []
    return {
      branches: rows.length,
      employees: rows.reduce((s, b) => s + (b.activeUsers || 0), 0),
      revenue: rows.reduce((s, b) => s + (b.revenue || 0), 0),
      sales: rows.reduce((s, b) => s + (b.salesCount || 0), 0),
    }
  }, [data])

  async function toggleStatus(b, e) {
    e?.stopPropagation()
    try {
      await branchesApi.setStatus(b._id, b.status === 'active' ? 'disabled' : 'active')
      toast.success(`Branch ${b.status === 'active' ? 'disabled' : 'activated'}`)
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    }
  }

  async function remove(b, e) {
    e?.stopPropagation()
    if (!window.confirm(`Delete branch "${b.name}"? This cannot be undone.`)) return
    try {
      await branchesApi.remove(b._id)
      toast.success('Branch deleted')
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete')
    }
  }

  function exportCSV() {
    const header = ['Branch', 'Code', 'City', 'Sub-Admin', 'Employees', 'Projects', 'Customers', 'Revenue', 'Sales', 'Status']
    const rows = filtered.map((b) => [b.name, b.code, b.city, b.adminUser?.name, b.activeUsers, b.projectsCount, b.customersCount, b.revenue, b.salesCount, b.status])
    downloadCSV('branches.csv', [header, ...rows])
  }

  const columns = [
    { key: 'name', header: 'Branch', render: (b) => (
      <div>
        <div className="font-medium text-slate-900">{b.name}</div>
        <div className="text-xs text-slate-400">{b.code || '—'} · {b.region || 'No region'}</div>
      </div>
    ) },
    { key: 'city', header: 'City', render: (b) => b.city || '—' },
    { key: 'admin', header: 'Sub-Admin', render: (b) => b.adminUser?.name || '—' },
    { key: 'activeUsers', header: 'Employees', render: (b) => b.activeUsers },
    { key: 'projectsCount', header: 'Projects', render: (b) => b.projectsCount },
    { key: 'customersCount', header: 'Customers', render: (b) => b.customersCount },
    { key: 'revenue', header: 'Revenue', render: (b) => <span className="font-medium text-emerald-600">{inr(b.revenue)}</span> },
    { key: 'salesCount', header: 'Sales', render: (b) => b.salesCount },
    { key: 'status', header: 'Status', render: (b) => <StatusBadge status={b.status === 'active' ? 'approved' : 'cancelled'} /> },
    { key: 'actions', header: '', render: (b) => (
      <div className="flex justify-end gap-1.5">
        <IconBtn title="View" icon={ICONS.eye} onClick={(e) => { e.stopPropagation(); navigate(`/admin/branches/${b._id}`) }} />
        {can('branch', 'edit') && <IconBtn title="Edit" icon={ICONS.pencil} onClick={(e) => { e.stopPropagation(); setEditing(b) }} />}
        {can('branch', 'edit') && <IconBtn title="Assign Target" icon={ICONS.target} onClick={(e) => { e.stopPropagation(); setTargeting(b) }} />}
        {can('branch', 'edit') && (
          <IconBtn
            title={b.status === 'active' ? 'Disable' : 'Activate'}
            icon={ICONS.power}
            tone={b.status === 'active' ? 'danger' : 'success'}
            onClick={(e) => toggleStatus(b, e)}
          />
        )}
        {can('branch', 'delete') && <IconBtn title="Delete" icon={ICONS.trash} tone="danger" onClick={(e) => remove(b, e)} />}
      </div>
    ) },
  ]

  return (
    <div>
      <PageHeader
        title="Branches"
        subtitle="Manage all company branches, assign branch managers, monitor performance, and track branch-wise business operations."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={exportCSV}>Export</Button>
            {can('branch', 'create') && <Button onClick={() => setEditing({})}>+ Add Branch</Button>}
          </div>
        }
      />

      {/* Top KPI section */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Branches" value={kpis.branches} hint="Across the company" />
        <StatCard label="Total Employees" value={kpis.employees} hint="Active staff, all branches" />
        <StatCard label="Total Revenue" value={inr(kpis.revenue)} hint="Confirmed bookings" />
        <StatCard label="Total Sales" value={kpis.sales} hint="Completed sales" />
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {['branches', 'comparison'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition ${
              tab === t ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'comparison' ? 'Branch Comparison' : 'All Branches'}
          </button>
        ))}
      </div>

      {tab === 'branches' ? (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="w-64"><Input label="Search" placeholder="Name, code, city, sub-admin" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <div className="w-44">
              <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </Select>
            </div>
          </div>

          {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
            <Table columns={columns} rows={filtered} empty="No branches match your filters." onRowClick={(b) => navigate(`/admin/branches/${b._id}`)} />
          )}
        </>
      ) : (
        <ComparisonTab />
      )}

      {editing && <BranchModal branch={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); refetch() }} />}
      {targeting && <TargetModal branch={targeting} onClose={() => setTargeting(null)} onDone={() => { setTargeting(null); refetch() }} />}
    </div>
  )
}

function ComparisonTab() {
  const { data, loading, error, refetch } = useFetch(useCallback(() => branchesApi.comparison(), []))
  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  const { rows = [], totals = {} } = data || {}

  const columns = [
    { key: 'name', header: 'Branch', render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
    { key: 'revenue', header: 'Revenue', render: (r) => inr(r.revenue) },
    { key: 'sales', header: 'Sales', render: (r) => r.sales },
    { key: 'customers', header: 'Customers', render: (r) => r.customers },
    { key: 'employees', header: 'Employees', render: (r) => r.employees },
    { key: 'revenueTarget', header: 'Assigned Target', render: (r) => r.revenueTarget ? inr(r.revenueTarget) : '—' },
    { key: 'achieved', header: 'Achieved', render: (r) => inr(r.revenue) },
    { key: 'completion', header: 'Completion %', render: (r) => (
      r.completion == null ? '—' : (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, r.completion)}%` }} />
          </div>
          <span className="text-xs">{r.completion}%</span>
        </div>
      )
    ) },
    { key: 'targetStatus', header: 'Target Status', render: (r) => <TargetStatusBadge status={r.targetStatus} /> },
    { key: 'performance', header: 'Performance', render: (r) => {
      const c = r.completion
      const label = c == null ? '—' : c >= 100 ? 'Excellent' : c >= 75 ? 'Good' : c >= 40 ? 'Average' : 'Low'
      const cls = c == null ? 'text-slate-400' : c >= 75 ? 'text-emerald-600' : c >= 40 ? 'text-amber-600' : 'text-red-600'
      return <span className={`text-xs font-medium ${cls}`}>{label}</span>
    } },
  ]

  return (
    <div>
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Branches" value={totals.branches ?? 0} />
        <StatCard label="Total Employees" value={totals.employees ?? 0} />
        <StatCard label="Total Revenue" value={inr(totals.revenue)} />
        <StatCard label="Total Sales" value={totals.sales ?? 0} />
      </div>
      <Table columns={columns} rows={rows} empty="No branches to compare." />
    </div>
  )
}

function BranchModal({ branch, onClose, onDone }) {
  const toast = useToast()
  const isNew = !branch._id
  const [form, setForm] = useState({
    name: branch.name || '',
    code: branch.code || '',
    region: branch.region || '',
    city: branch.city || '',
    address: branch.address || '',
    contactNumber: branch.contactNumber || '',
    email: branch.email || '',
    monthlyTarget: branch.monthlyTarget || 0,
    adminUser: branch.adminUser?._id || branch.adminUser || '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // Sub-admins can be assigned as Branch Admin.
  const { data: subAdmins } = useFetch(useCallback(() => usersApi.list({ role: 'sub_admin', status: 'active', limit: 100 }), []))

  async function save() {
    setBusy(true)
    try {
      const payload = {
        name: form.name,
        code: form.code,
        region: form.region,
        city: form.city,
        address: form.address,
        contactNumber: form.contactNumber,
        email: form.email,
        monthlyTarget: Number(form.monthlyTarget) || 0,
        adminUser: form.adminUser || '',
      }
      if (isNew) await branchesApi.create(payload)
      else await branchesApi.update(branch._id, payload)
      toast.success(isNew ? 'Branch created' : 'Branch updated')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} wide title={isNew ? 'Add Branch' : 'Edit Branch'} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy || form.name.trim().length < 2}>{isNew ? 'Create' : 'Save'}</Button>
      </>
    }>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Branch name" value={form.name} onChange={set('name')} placeholder="e.g. Andheri West Office" />
        <Input label="Branch code" value={form.code} onChange={set('code')} placeholder="e.g. MUM-01" />
        <Input label="City" value={form.city} onChange={set('city')} placeholder="e.g. Mumbai" />
        <Input label="Region" value={form.region} onChange={set('region')} placeholder="e.g. West" />
        <Input label="Contact number" value={form.contactNumber} onChange={set('contactNumber')} placeholder="e.g. +91 98765 43210" />
        <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="branch@company.com" />
        <div className="sm:col-span-2"><Input label="Address" value={form.address} onChange={set('address')} placeholder="Street, area, landmark" /></div>
        <Input label="Revenue target (₹)" type="number" value={form.monthlyTarget} onChange={set('monthlyTarget')} />
        <Select label="Branch Admin (sub-admin)" value={form.adminUser} onChange={set('adminUser')}>
          <option value="">Unassigned</option>
          {(subAdmins || []).map((u) => <option key={u._id} value={u._id}>{u.name} · {u.email}</option>)}
        </Select>
      </div>
    </Modal>
  )
}

function TargetModal({ branch, onClose, onDone }) {
  const toast = useToast()
  const [form, setForm] = useState({
    monthlyTarget: branch.monthlyTarget || 0,
    salesTarget: branch.salesTarget || 0,
    bookingTarget: branch.bookingTarget || 0,
    targetPeriod: branch.targetPeriod || 'monthly',
    targetStartDate: branch.targetStartDate ? String(branch.targetStartDate).slice(0, 10) : '',
    targetEndDate: branch.targetEndDate ? String(branch.targetEndDate).slice(0, 10) : '',
    targetRemarks: branch.targetRemarks || '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    try {
      await branchesApi.setTargets(branch._id, {
        monthlyTarget: Number(form.monthlyTarget) || 0,
        salesTarget: Number(form.salesTarget) || 0,
        bookingTarget: Number(form.bookingTarget) || 0,
        targetPeriod: form.targetPeriod,
        targetStartDate: form.targetStartDate,
        targetEndDate: form.targetEndDate,
        targetRemarks: form.targetRemarks,
      })
      toast.success('Targets updated')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} wide title={`Assign Target · ${branch.name}`} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy}>Save Targets</Button>
      </>
    }>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Target period" value={form.targetPeriod} onChange={set('targetPeriod')}>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </Select>
        <Input label="Revenue target (₹)" type="number" value={form.monthlyTarget} onChange={set('monthlyTarget')} />
        <Input label="Sales target (count)" type="number" value={form.salesTarget} onChange={set('salesTarget')} />
        <Input label="Booking target (count)" type="number" value={form.bookingTarget} onChange={set('bookingTarget')} />
        <Input label="Start date" type="date" value={form.targetStartDate} onChange={set('targetStartDate')} />
        <Input label="End date" type="date" value={form.targetEndDate} onChange={set('targetEndDate')} />
        <div className="sm:col-span-2">
          <Input label="Remarks (optional)" value={form.targetRemarks} onChange={set('targetRemarks')} placeholder="Context for this target period" />
        </div>
      </div>
    </Modal>
  )
}
