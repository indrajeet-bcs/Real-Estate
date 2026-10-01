import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Papa from 'papaparse'
import { usersApi, branchesApi, attendanceApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { formatDate, titleCase } from '../../lib/format.js'
import {
  PageHeader, Card, StatCard, Button, Input, Select, Textarea, Table, StatusBadge, Modal, Loader, ErrorState,
} from '../../components/ui.jsx'

const inr = (n) => {
  const v = Number(n) || 0
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`
  return `₹${v.toLocaleString('en-IN')}`
}

// Row-action icons (SVG paths) + a compact icon button with an accessible tooltip.
const ICONS = {
  eye: (<><path d="M2.036 12.322a1.012 1.012 0 0 1 0-.644C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.01 9.963 7.178.07.207.07.43 0 .644C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.01-9.963-7.178Z" /><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></>),
  pencil: (<path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />),
  transfer: (<path d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-9L21 7.5m0 0L16.5 3m4.5 4.5H7.5" />),
  power: (<path d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9" />),
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

// Relative "last login" label per spec (Today 10:20 AM / Yesterday / 3 Days Ago).
function relativeLogin(value) {
  if (!value) return 'Never'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  if (days <= 0) return `Today ${time}`
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

// Derive a performance tier + target status from revenue-vs-target progress.
function perfTier(pct) {
  if (pct == null) return null
  if (pct >= 80) return 'top'
  if (pct >= 40) return 'average'
  return 'low'
}
function targetStatus(pct) {
  if (pct == null) return 'pending'
  if (pct >= 100) return 'completed'
  if (pct > 0) return 'in_progress'
  return 'pending'
}

function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function Avatar({ name }) {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-[11px] font-semibold text-blue-700">
      {(name || '?').slice(0, 2).toUpperCase()}
    </div>
  )
}

export default function AdminEmployeesPage() {
  const [tab, setTab] = useState('roster')
  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Manage all employees, branch assignments, transfers, attendance, performance, and sales activities."
      />
      <div className="mb-5 flex gap-2">
        <TabButton active={tab === 'roster'} onClick={() => setTab('roster')}>Employee Roster</TabButton>
        <TabButton active={tab === 'attendance'} onClick={() => setTab('attendance')}>Attendance Register</TabButton>
      </div>
      {tab === 'roster' ? <RosterTab /> : <AttendanceTab />}
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
        active ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >{children}</button>
  )
}

const EMPTY_FILTERS = { branch: '', subAdmin: '', status: 'all', performance: 'all', targetStatus: 'all', joinFrom: '', joinTo: '' }

function RosterTab() {
  const { can } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const [transferFor, setTransferFor] = useState(null)
  const [editFor, setEditFor] = useState(null)
  const [historyFor, setHistoryFor] = useState(null)
  const [disableFor, setDisableFor] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const { data: stats } = useFetch(useCallback(() => usersApi.stats(), []))
  const { data: branches } = useFetch(useCallback(() => branchesApi.list(), []))
  const { data: subAdmins } = useFetch(useCallback(() => usersApi.list({ role: 'sub_admin', limit: 100 }), []))
  const { data, loading, error, refetch } = useFetch(useCallback(() => usersApi.list({ withMetrics: 'true', limit: 200 }), []))

  const setF = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }))

  const rows = useMemo(() => {
    let out = data || []
    const q = search.trim().toLowerCase()
    if (q) out = out.filter((u) => [u.name, u.employeeId, u.email, u.phone].some((v) => (v || '').toLowerCase().includes(q)))
    if (filters.branch) out = out.filter((u) => u.branch === filters.branch)
    if (filters.subAdmin) out = out.filter((u) => String(u.manager?._id || u.manager) === filters.subAdmin)
    if (filters.status === 'active') out = out.filter((u) => u.isActive)
    if (filters.status === 'disabled') out = out.filter((u) => !u.isActive)
    if (filters.status === 'transferred') out = out.filter((u) => (u.transferCount || 0) > 0)
    if (filters.performance !== 'all') out = out.filter((u) => perfTier(u.targetProgressPct) === filters.performance)
    if (filters.targetStatus !== 'all') out = out.filter((u) => targetStatus(u.targetProgressPct) === filters.targetStatus)
    if (filters.joinFrom) out = out.filter((u) => u.joiningDate && new Date(u.joiningDate) >= new Date(filters.joinFrom))
    if (filters.joinTo) out = out.filter((u) => u.joiningDate && new Date(u.joiningDate) <= new Date(filters.joinTo))
    return out
  }, [data, search, filters])

  async function toggleActive(u) {
    try {
      if (u.isActive) await usersApi.deactivate(u._id)
      else await usersApi.activate(u._id)
      toast.success(u.isActive ? 'Disabled' : 'Activated')
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed (employee may hold open leads — reassign first)')
    }
  }

  function exportCSV() {
    const header = ['Employee ID', 'Name', 'Email', 'Role', 'Branch', 'Assigned Sub-Admin', 'Mobile', 'Joining Date', 'Active Leads', 'Revenue Generated', 'Target', 'Last Login', 'Status']
    const body = rows.map((u) => [u.employeeId, u.name, u.email, titleCase(u.role), u.branch, u.manager?.name, u.phone, u.joiningDate ? formatDate(u.joiningDate) : '', u.activeLeadsCount, u.revenueGenerated, u.targetRevenue, relativeLogin(u.lastLoginAt), u.isActive ? 'Active' : 'Disabled'])
    downloadCSV('employees.csv', [header, ...body])
  }

  const columns = [
    { key: 'profile', header: 'Profile', render: (r) => (
      <div className="flex items-center gap-2">
        <Avatar name={r.name} />
        <div>
          <div className="font-medium text-slate-900">{r.name}</div>
          <div className="text-xs text-slate-400">{r.employeeId || '—'}</div>
        </div>
      </div>
    ) },
    { key: 'role', header: 'Role', render: (r) => titleCase(r.role) },
    { key: 'branch', header: 'Branch', render: (r) => r.branch || '—' },
    { key: 'manager', header: 'Sub-Admin', render: (r) => r.manager?.name || '—' },
    { key: 'phone', header: 'Mobile', render: (r) => r.phone || '—' },
    { key: 'joiningDate', header: 'Joined', render: (r) => r.joiningDate ? formatDate(r.joiningDate) : '—' },
    { key: 'activeLeadsCount', header: 'Active Leads', render: (r) => r.activeLeadsCount ?? 0 },
    { key: 'revenueGenerated', header: 'Revenue', render: (r) => inr(r.revenueGenerated) },
    { key: 'target', header: 'Target Progress', render: (r) => {
      if (!r.targetRevenue) return <span className="text-xs text-slate-400">No target</span>
      const pct = r.targetProgressPct ?? 0
      return (
        <div className="w-28">
          <div className="mb-0.5 flex justify-between text-[10px] text-slate-500"><span>{inr(r.revenueGenerated)}</span><span>{pct}%</span></div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
        </div>
      )
    } },
    { key: 'lastLogin', header: 'Last Login', render: (r) => <span className="text-xs text-slate-500">{relativeLogin(r.lastLoginAt)}</span> },
    { key: 'transfer', header: 'Transfers', render: (r) => (
      (r.transferCount || 0) > 0
        ? <button onClick={(e) => { e.stopPropagation(); setHistoryFor(r) }} className="text-xs font-medium text-blue-600 hover:underline">Transferred {r.transferCount}×</button>
        : <span className="text-xs text-slate-400">Never</span>
    ) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'approved' : 'cancelled'} /> },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex justify-end gap-1.5">
        <IconBtn title="View" onClick={(e) => { e.stopPropagation(); navigate(`/admin/employees/${r._id}`) }} icon={ICONS.eye} />
        {can('user', 'edit') && <IconBtn title="Edit" onClick={(e) => { e.stopPropagation(); setEditFor(r) }} icon={ICONS.pencil} />}
        {can('user', 'edit') && <IconBtn title="Transfer" onClick={(e) => { e.stopPropagation(); setTransferFor(r) }} icon={ICONS.transfer} />}
        {can('user', 'edit') && <IconBtn title={r.isActive ? 'Disable' : 'Enable'} tone={r.isActive ? 'danger' : 'success'} onClick={(e) => { e.stopPropagation(); r.isActive ? setDisableFor(r) : toggleActive(r) }} icon={ICONS.power} />}
      </div>
    ) },
  ]

  return (
    <div>
      {/* Top KPI section */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Employees" value={stats?.totalEmployees ?? '—'} hint="Active staff" />
        <StatCard label="Present Today" value={stats?.presentToday ?? '—'} hint="Checked in today" />
        <StatCard label="Total Revenue" value={inr(stats?.totalRevenue)} hint="Generated by employees" />
        <StatCard label="Total Sales" value={stats?.totalSales ?? '—'} hint="Completed sales" />
      </div>

      {/* Header actions */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-2">
          <div className="w-64"><Input label="Search" placeholder="Name, ID, email, mobile" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <Button variant="secondary" onClick={() => setShowFilters((v) => !v)}>{showFilters ? 'Hide Filters' : 'Advanced Filters'}</Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={exportCSV}>Export</Button>
          {can('user', 'create') && <Button variant="secondary" onClick={() => setShowImport(true)}>Import</Button>}
          {can('user', 'create') && <Button onClick={() => setShowCreate(true)}>+ Add Employee</Button>}
        </div>
      </div>

      {showFilters && (
        <Card className="mb-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Select label="Branch" value={filters.branch} onChange={setF('branch')}>
              <option value="">All branches</option>
              {(branches || []).map((b) => <option key={b._id} value={b.name}>{b.name}</option>)}
            </Select>
            <Select label="Assigned Sub-Admin" value={filters.subAdmin} onChange={setF('subAdmin')}>
              <option value="">All sub-admins</option>
              {(subAdmins || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </Select>
            <Select label="Employee Status" value={filters.status} onChange={setF('status')}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
              <option value="transferred">Transferred</option>
            </Select>
            <Select label="Performance" value={filters.performance} onChange={setF('performance')}>
              <option value="all">All</option>
              <option value="top">Top Performer</option>
              <option value="average">Average</option>
              <option value="low">Low Performer</option>
            </Select>
            <Select label="Target Status" value={filters.targetStatus} onChange={setF('targetStatus')}>
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In Progress</option>
              <option value="pending">Pending</option>
            </Select>
            <Input label="Joined from" type="date" value={filters.joinFrom} onChange={setF('joinFrom')} />
            <Input label="Joined to" type="date" value={filters.joinTo} onChange={setF('joinTo')} />
            <div className="flex items-end"><Button variant="ghost" onClick={() => { setFilters(EMPTY_FILTERS); setSearch('') }}>Clear All</Button></div>
          </div>
        </Card>
      )}

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <Table columns={columns} rows={rows} empty="No employees match your filters." onRowClick={(r) => navigate(`/admin/employees/${r._id}`)} />
      )}

      {disableFor && (
        <Modal open onClose={() => setDisableFor(null)} title="Disable Employee"
          footer={<><Button variant="secondary" onClick={() => setDisableFor(null)}>Cancel</Button><Button variant="danger" onClick={() => { toggleActive(disableFor); setDisableFor(null) }}>Disable</Button></>}
        >
          <p className="text-sm text-slate-600">
            Are you sure you want to disable <strong>{disableFor.name}</strong> ({disableFor.employeeId})?
            They will immediately lose access to the platform. Their leads and records are kept, and you can re-enable them anytime.
          </p>
        </Modal>
      )}

      {transferFor && <TransferModal user={transferFor} branches={branches || []} subAdmins={subAdmins || []} onClose={() => setTransferFor(null)} onDone={() => { setTransferFor(null); refetch() }} />}
      {editFor && <EmployeeModal user={editFor} branches={branches || []} onClose={() => setEditFor(null)} onDone={() => { setEditFor(null); refetch() }} />}
      {showCreate && <EmployeeModal branches={branches || []} onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); refetch() }} />}
      {showImport && <ImportModal branches={branches || []} onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); refetch() }} />}
      {historyFor && <HistoryModal user={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  )
}

// Add / Edit employee modal.
function EmployeeModal({ user, branches, onClose, onDone }) {
  const toast = useToast()
  const isNew = !user
  const [form, setForm] = useState({
    name: user?.name || '', email: user?.email || '', password: '',
    phone: user?.phone || '', branch: user?.branch || '', role: user?.role || 'sub_admin',
    designation: user?.designation || '', targetRevenue: user?.targetRevenue || 0,
    joiningDate: user?.joiningDate ? String(user.joiningDate).slice(0, 10) : '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    try {
      if (isNew) {
        await usersApi.create({
          name: form.name, email: form.email, password: form.password, role: form.role,
          phone: form.phone, branch: form.branch, designation: form.designation,
          targetRevenue: Number(form.targetRevenue) || 0, joiningDate: form.joiningDate || undefined,
        })
        toast.success('Employee created')
      } else {
        await usersApi.update(user._id, {
          name: form.name, phone: form.phone, branch: form.branch, designation: form.designation,
          targetRevenue: Number(form.targetRevenue) || 0, joiningDate: form.joiningDate || undefined,
        })
        toast.success('Employee updated')
      }
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  const invalid = !form.name || (isNew && (!form.email || form.password.length < 8))

  return (
    <Modal open onClose={onClose} wide title={isNew ? 'Add Employee' : `Edit ${user.name}`} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy || invalid}>{isNew ? 'Create' : 'Save'}</Button>
      </>
    }>
      <div className="grid gap-4 sm:grid-cols-2">
        {isNew && (
          <Select label="Role" value={form.role} onChange={set('role')}>
            <option value="sub_admin">Sub-Admin (Branch Admin)</option>
            <option value="sales_executive">Sales Executive</option>
          </Select>
        )}
        <Input label="Full name" value={form.name} onChange={set('name')} />
        {isNew && <Input label="Email" type="email" value={form.email} onChange={set('email')} />}
        {isNew && <Input label="Password (min 8 chars)" type="password" value={form.password} onChange={set('password')} />}
        <Input label="Mobile" value={form.phone} onChange={set('phone')} />
        <Input label="Designation" value={form.designation} onChange={set('designation')} placeholder="e.g. Senior Sales Executive" />
        <Select label="Branch" value={form.branch} onChange={set('branch')}>
          <option value="">Unassigned</option>
          {branches.map((b) => <option key={b._id} value={b.name}>{b.name}</option>)}
        </Select>
        <Input label="Joining date" type="date" value={form.joiningDate} onChange={set('joiningDate')} />
        <Input label="Revenue target (₹)" type="number" value={form.targetRevenue} onChange={set('targetRevenue')} />
      </div>
    </Modal>
  )
}

// Transfer-branch modal: new branch → auto-loaded sub-admins → date/reason →
// leads & tasks toggles → confirm (spec §Transfer Employee Workflow).
function TransferModal({ user, branches, subAdmins, onClose, onDone }) {
  const toast = useToast()
  const [dest, setDest] = useState('')
  const [newManager, setNewManager] = useState('')
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState('')
  const [transferLeads, setTransferLeads] = useState(true)
  const [transferTasks, setTransferTasks] = useState(true)
  const [busy, setBusy] = useState(false)

  const branchOptions = branches.filter((b) => b.name !== user.branch && b.status === 'active')
  // Auto-load available sub-admins for the chosen destination branch.
  const managerOptions = subAdmins.filter((s) => s.branch === dest)

  async function submit() {
    setBusy(true)
    try {
      const res = await usersApi.transfer(user._id, {
        branch: dest, newManager: newManager || undefined, transferDate,
        reason, transferLeads, transferTasks,
      })
      const rl = res.data.data?.releasedLeads || 0
      toast.success(`Transferred to ${dest}${rl ? ` · ${rl} leads released` : ''}`)
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Transfer ${user.name}`} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={busy || !dest}>Confirm Transfer</Button>
      </>
    }>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Currently in <strong>{user.branch || 'no branch'}</strong>.</p>
        <Select label="New branch" value={dest} onChange={(e) => { setDest(e.target.value); setNewManager('') }}>
          <option value="">Select a branch…</option>
          {branchOptions.map((b) => <option key={b._id} value={b.name}>{b.name}</option>)}
        </Select>
        {branchOptions.length === 0 && <p className="text-xs text-amber-600">No other active branches. Create one in Branches first.</p>}

        <Select label="New assigned sub-admin" value={newManager} onChange={(e) => setNewManager(e.target.value)} disabled={!dest}>
          <option value="">{dest ? (managerOptions.length ? 'Select a sub-admin…' : 'No sub-admin in this branch') : 'Choose a branch first'}</option>
          {managerOptions.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Transfer date" type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
        </div>
        <Textarea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for this transfer…" />

        <div className="grid grid-cols-2 gap-3">
          <Select label="Transfer existing leads?" value={transferLeads ? 'yes' : 'no'} onChange={(e) => setTransferLeads(e.target.value === 'yes')}>
            <option value="yes">Yes — leads move with them</option>
            <option value="no">No — release to branch pool</option>
          </Select>
          <Select label="Transfer existing tasks?" value={transferTasks ? 'yes' : 'no'} onChange={(e) => setTransferTasks(e.target.value === 'yes')}>
            <option value="yes">Yes — tasks move with them</option>
            <option value="no">No — release to branch pool</option>
          </Select>
        </div>
        <p className="text-xs text-slate-400">Attendance history is always retained. Previous branch &amp; sub-admin are saved to the transfer log.</p>
      </div>
    </Modal>
  )
}

// Quick transfer-history popover from the roster.
function HistoryModal({ user, onClose }) {
  const history = user.transferHistory || []
  return (
    <Modal open onClose={onClose} title={`Transfer History · ${user.name}`} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {history.length === 0 ? <p className="text-sm text-slate-400">No transfers recorded.</p> : (
        <ul className="space-y-3">
          {history.map((t, i) => (
            <li key={i} className="rounded-lg border border-slate-200 p-3 text-sm">
              <div className="flex justify-between"><span className="font-medium text-slate-800">{t.fromBranch || '—'} → {t.toBranch || '—'}</span><span className="text-xs text-slate-400">{formatDate(t.date)}</span></div>
              <div className="mt-1 text-xs text-slate-500">Sub-Admin: {t.previousManagerName || '—'} → {t.newManagerName || '—'}</div>
              {t.approvedByName && <div className="text-xs text-slate-500">Approved by: {t.approvedByName}</div>}
              {t.reason && <div className="mt-1 text-xs text-slate-600">Reason: {t.reason}</div>}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

// CSV import — columns: name, email, phone, role, branch, designation.
function ImportModal({ branches, onClose, onDone }) {
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const DEFAULT_PASSWORD = 'Welcome@123'

  function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => setRows(res.data.map((r) => ({
        name: r.name || r.Name || '', email: r.email || r.Email || '', phone: r.phone || r.Mobile || r.mobile || '',
        role: (r.role || r.Role || 'sales_executive').toLowerCase().includes('sub') ? 'sub_admin' : 'sales_executive',
        branch: r.branch || r.Branch || '', designation: r.designation || r.Designation || '',
      }))),
    })
  }

  async function run() {
    setBusy(true)
    let ok = 0; const failed = []
    for (const r of rows) {
      if (!r.name || !r.email) { failed.push(`${r.name || r.email || 'row'}: missing name/email`); continue }
      try {
        await usersApi.create({ ...r, password: DEFAULT_PASSWORD })
        ok += 1
      } catch (err) {
        failed.push(`${r.email}: ${err.response?.data?.message || 'failed'}`)
      }
    }
    setResult({ ok, failed })
    setBusy(false)
    if (ok) toast.success(`${ok} employee(s) imported`)
  }

  return (
    <Modal open onClose={onClose} wide title="Import Employees (CSV)" footer={
      result
        ? <Button onClick={onDone}>Done</Button>
        : <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={run} disabled={busy || rows.length === 0}>{busy ? 'Importing…' : `Import ${rows.length || ''}`}</Button>
          </>
    }>
      {result ? (
        <div className="space-y-2 text-sm">
          <p className="font-medium text-emerald-600">{result.ok} imported successfully.</p>
          {result.failed.length > 0 && (
            <div>
              <p className="font-medium text-red-600">{result.failed.length} failed:</p>
              <ul className="mt-1 max-h-40 overflow-y-auto text-xs text-slate-500">{result.failed.map((f, i) => <li key={i}>• {f}</li>)}</ul>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">CSV columns: <code className="text-xs">name, email, phone, role, branch, designation</code>. New accounts get the temporary password <strong>{DEFAULT_PASSWORD}</strong>.</p>
          <input type="file" accept=".csv" onChange={onFile} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white" />
          {rows.length > 0 && (
            <div className="max-h-56 overflow-auto rounded-lg border border-slate-200">
              <Table
                columns={[
                  { key: 'name', header: 'Name' },
                  { key: 'email', header: 'Email' },
                  { key: 'role', header: 'Role', render: (r) => titleCase(r.role) },
                  { key: 'branch', header: 'Branch', render: (r) => r.branch || '—' },
                ]}
                rows={rows}
              />
            </div>
          )}
          {branches.length === 0 && <p className="text-xs text-amber-600">Tip: create branches first so imported employees map to a branch.</p>}
        </div>
      )}
    </Modal>
  )
}

function AttendanceTab() {
  const [date, setDate] = useState('')
  const { data, loading, error, refetch } = useFetch(
    useCallback(() => attendanceApi.review({ date, limit: 100 }), [date])
  )

  const columns = [
    { key: 'user', header: 'Employee', render: (r) => (
      <div><div className="font-medium text-slate-900">{r.user?.name || '—'}</div><div className="text-xs text-slate-500">{titleCase(r.user?.role || '')}</div></div>
    ) },
    { key: 'date', header: 'Date' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'checkInAt', header: 'Check-In', render: (r) => r.checkInAt ? formatDate(r.checkInAt, true) : '—' },
    { key: 'checkOutAt', header: 'Check-Out', render: (r) => r.checkOutAt ? formatDate(r.checkOutAt, true) : '—' },
    { key: 'gps', header: 'GPS', render: (r) => {
      const l = r.checkInLocation
      if (!l) return '—'
      return <span className="font-mono text-xs text-slate-500">{l.address || (l.lat != null ? `${l.lat}, ${l.lng}` : '—')}</span>
    } },
  ]

  return (
    <div>
      <div className="mb-4 w-48">
        <Input label="Filter by date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500">GPS attendance records</div>
          <Table columns={columns} rows={data || []} empty="No attendance records for this filter" />
        </Card>
      )}
    </div>
  )
}
