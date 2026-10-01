import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Table, Pagination, Button, Input, Select, Card, StatusBadge, Loader, ErrorState } from '../../components/ui.jsx'
import { ROLE_CATEGORIES, ROLE_TYPES, ROLE_STATUSES } from '../../lib/roleConstants.js'
import { rolesApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import CreateEditRoleDrawer from '../../components/roles/CreateEditRoleDrawer.jsx'

// Normalize a backend role doc into the UI's display shape.
export const toUiRole = (r) => ({
  id: r._id,
  name: r.name,
  description: r.description || '',
  category: r.category,
  type: r.type === 'system' ? 'System Role' : 'Custom Role',
  reportsTo: r.reportsTo?._id || r.reportsTo || null,
  reportsToName: r.reportsTo?.name || null,
  status: r.status === 'active' ? 'Active' : 'Inactive',
  users: r.users || 0,
  lastUpdated: r.updatedAt,
  created: r.createdAt,
  baseRole: r.baseRole,
  designer: r.designer || {},
  isSystem: r.isSystem || r.type === 'system',
})

function StatCard({ label, value, colorClass = 'text-slate-900' }) {
  return (
    <Card className="p-4 transition hover:shadow-sm">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</h3>
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
    </Card>
  )
}

export default function RolesManagementPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { data, loading, error, refetch } = useFetch(useCallback(() => rolesApi.list(), []))
  const roles = useMemo(() => (data || []).map(toUiRole), [data])

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const limit = 10
  const [createEditModalOpen, setCreateEditModalOpen] = useState(false)
  const [roleToEdit, setRoleToEdit] = useState(null)

  const filteredData = useMemo(() => roles.filter((r) => {
    const matchSearch = (r.name + ' ' + (r.description || '')).toLowerCase().includes(search.toLowerCase())
    const matchCategory = categoryFilter ? r.category === categoryFilter : true
    const matchType = typeFilter ? r.type === typeFilter : true
    const matchStatus = statusFilter ? r.status === statusFilter : true
    return matchSearch && matchCategory && matchType && matchStatus
  }), [roles, search, categoryFilter, typeFilter, statusFilter])

  const paginatedData = filteredData.slice((page - 1) * limit, page * limit)
  const meta = { page, pages: Math.ceil(filteredData.length / limit), total: filteredData.length, limit }

  const totalRoles = roles.length
  const activeRoles = roles.filter((r) => r.status === 'Active').length
  const inactiveRoles = roles.filter((r) => r.status === 'Inactive').length
  const customRoles = roles.filter((r) => r.type === 'Custom Role').length

  const handleView = (role) => navigate(role.id)

  const handleToggleStatus = async (role) => {
    if (role.type === 'System Role') return
    const newStatus = role.status === 'Active' ? 'inactive' : 'active'
    if (newStatus === 'inactive' && !window.confirm('Deactivate this role? Users assigned to it will lose its permissions until reactivated.')) return
    try {
      await rolesApi.setStatus(role.id, newStatus)
      toast.success(`Role ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
      refetch()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }

  const handleDelete = async (role) => {
    if (!window.confirm(`Delete role "${role.name}"? This cannot be undone.`)) return
    try {
      await rolesApi.remove(role.id)
      toast.success('Role deleted')
      refetch()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete') }
  }

  const columns = [
    { key: 'name', header: 'Role', render: (r) => (
      <div>
        <span className="cursor-pointer font-medium text-blue-600 hover:underline" onClick={() => handleView(r)}>{r.name}</span>
        {r.description && <p className="mt-0.5 max-w-[200px] truncate text-xs text-slate-500">{r.description}</p>}
      </div>
    ) },
    { key: 'category', header: 'Category' },
    { key: 'type', header: 'Role Type', render: (r) => (
      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${r.type === 'System Role' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'}`}>{r.type}</span>
    ) },
    { key: 'reportsTo', header: 'Reports To', render: (r) => <span className="text-sm text-slate-600">{r.reportsToName || '—'}</span> },
    { key: 'users', header: 'Users' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status === 'Active' ? 'Completed' : 'Cancelled'} overrideLabel={r.status} /> },
    { key: 'lastUpdated', header: 'Last Updated', render: (r) => <span className="text-sm text-slate-500">{r.lastUpdated ? new Date(r.lastUpdated).toLocaleDateString() : '—'}</span> },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(`${r.id}/permissions`)}>Permissions</Button>
        <Button variant="ghost" size="sm" onClick={() => handleView(r)}>View</Button>
        {!r.isSystem && <Button variant="ghost" size="sm" onClick={() => { setRoleToEdit(r); setCreateEditModalOpen(true) }}>Edit</Button>}
        {r.type === 'Custom Role' && (
          <>
            <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(r)}>{r.status === 'Active' ? 'Deactivate' : 'Activate'}</Button>
            <Button variant="ghost" size="sm" onClick={() => handleDelete(r)}>Delete</Button>
          </>
        )}
      </div>
    ) },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <PageHeader title="Roles & Permissions" subtitle="Manage user roles and configure access across the CRM."
          actions={<Button variant="primary" onClick={() => { setRoleToEdit(null); setCreateEditModalOpen(true) }}>+ Create Role</Button>} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Roles" value={totalRoles} />
        <StatCard label="Active Roles" value={activeRoles} colorClass="text-emerald-600" />
        <StatCard label="Inactive Roles" value={inactiveRoles} colorClass="text-red-500" />
        <StatCard label="Custom Roles" value={customRoles} colorClass="text-purple-600" />
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="min-w-[200px] flex-1"><Input label="Search" placeholder="Search roles..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} /></div>
        <div className="w-40"><Select label="Category" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}><option value="">All</option>{ROLE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select></div>
        <div className="w-40"><Select label="Role Type" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}><option value="">All</option>{ROLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></div>
        <div className="w-40"><Select label="Status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}><option value="">All</option>{ROLE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
        {(search || categoryFilter || typeFilter || statusFilter) && <Button variant="ghost" onClick={() => { setSearch(''); setCategoryFilter(''); setTypeFilter(''); setStatusFilter(''); setPage(1) }}>Clear Filters</Button>}
      </div>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <>
          <Table columns={columns} rows={paginatedData} empty={(search || categoryFilter || typeFilter || statusFilter) ? 'No roles found' : 'No roles yet.'} />
          <Pagination meta={meta} onPage={setPage} />
        </>
      )}

      <CreateEditRoleDrawer
        open={createEditModalOpen}
        onClose={() => setCreateEditModalOpen(false)}
        roleToEdit={roleToEdit}
        existingRoles={roles}
        onSaved={() => { setCreateEditModalOpen(false); refetch() }}
      />
    </div>
  )
}
