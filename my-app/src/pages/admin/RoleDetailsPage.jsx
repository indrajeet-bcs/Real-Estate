import { useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader, Table, Button, Input, Select, Card, StatusBadge, Loader, ErrorState } from '../../components/ui.jsx'
import { rolesApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import AssignUsersDrawer from '../../components/roles/AssignUsersDrawer.jsx'

const toUiUser = (u) => ({
  id: u._id, name: u.name, email: u.email, branch: u.branch || '—',
  status: u.isActive === false ? 'Inactive' : 'Active', role: u.role,
})

export default function RoleDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const { data: role, loading, error, refetch } = useFetch(useCallback(() => rolesApi.get(id), [id]))
  const { data: usersRaw, refetch: refetchUsers } = useFetch(useCallback(() => rolesApi.users(id), [id]))
  const roleUsers = useMemo(() => (usersRaw || []).map(toUiUser), [usersRaw])

  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [assignModalOpen, setAssignModalOpen] = useState(false)

  const uniqueBranches = useMemo(() => [...new Set(roleUsers.map((u) => u.branch).filter((b) => b && b !== '—'))], [roleUsers])

  const filteredUsers = useMemo(() => roleUsers.filter((u) => {
    const matchSearch = (u.name + ' ' + u.email).toLowerCase().includes(search.toLowerCase())
    const matchBranch = branchFilter ? u.branch === branchFilter : true
    const matchStatus = statusFilter ? u.status === statusFilter : true
    return matchSearch && matchBranch && matchStatus
  }), [roleUsers, search, branchFilter, statusFilter])

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (!role) return <div className="p-8 text-center text-slate-500">Role Not Found</div>

  const roleData = {
    id: role._id, name: role.name, description: role.description, category: role.category,
    type: role.type === 'system' ? 'System Role' : 'Custom Role',
    status: role.status === 'active' ? 'Active' : 'Inactive',
    reportsToName: role.reportsTo?.name, created: role.createdAt, lastUpdated: role.updatedAt,
  }
  const isSystem = roleData.type === 'System Role'

  const handleRemoveUser = async (userId) => {
    if (!window.confirm(`Remove this user from ${roleData.name}? They will lose this role's permissions.`)) return
    try {
      await rolesApi.unassign(id, [userId])
      toast.success('User removed from role')
      refetchUsers(); refetch()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }

  const columns = [
    { key: 'user', header: 'User', render: (r) => <div><div className="font-medium text-slate-900">{r.name}</div><div className="text-xs text-slate-500">{r.role}</div></div> },
    { key: 'email', header: 'Email', render: (r) => <span className="text-slate-600">{r.email}</span> },
    { key: 'branch', header: 'Branch' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status === 'Active' ? 'Completed' : 'Cancelled'} overrideLabel={r.status} /> },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex justify-end"><Button variant="ghost" size="sm" className="text-red-600 hover:text-red-800" onClick={() => handleRemoveUser(r.id)}>Remove</Button></div>
    ) },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="-ml-3 mb-2">← Back to Roles</Button>
        <PageHeader title={roleData.name} subtitle={roleData.description || 'No description provided.'}
          actions={<Button variant="primary" onClick={() => navigate('permissions')}>Configure Permissions</Button>} />
      </div>

      <Card className="mb-8 p-5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 xl:grid-cols-6">
          <Field label="Category" value={roleData.category} />
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Type</span>
            <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-medium ${isSystem ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-800'}`}>{roleData.type}</span>
          </div>
          <Field label="Reports To" value={roleData.reportsToName || '—'} />
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
            <div className="mt-1"><StatusBadge status={roleData.status === 'Active' ? 'Completed' : 'Cancelled'} overrideLabel={roleData.status} /></div>
          </div>
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Users</span>
            <span className="mt-1 block text-sm font-bold text-blue-600">{roleUsers.length}</span>
          </div>
          <Field label="Updated" value={roleData.lastUpdated ? new Date(roleData.lastUpdated).toLocaleDateString() : '—'} />
        </div>
      </Card>

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Assigned Users</h3>
          <p className="text-sm text-slate-500">Users listed below inherit this role's permission configuration.</p>
        </div>
        <Button variant="secondary" onClick={() => setAssignModalOpen(true)}>+ Assign Users</Button>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="min-w-[200px] flex-1"><Input label="Search users" placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="w-48"><Select label="Branch" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}><option value="">All Branches</option>{uniqueBranches.map((b) => <option key={b} value={b}>{b}</option>)}</Select></div>
        <div className="w-40"><Select label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All Statuses</option><option value="Active">Active</option><option value="Inactive">Inactive</option></Select></div>
        {(search || branchFilter || statusFilter) && <Button variant="ghost" onClick={() => { setSearch(''); setBranchFilter(''); setStatusFilter('') }}>Clear Filters</Button>}
      </div>

      <Table columns={columns} rows={filteredUsers} empty={(search || branchFilter || statusFilter) ? 'No users found matching filters.' : 'No users are currently assigned to this role.'} />

      <AssignUsersDrawer
        open={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        targetRole={roleData}
        onAssigned={() => { setAssignModalOpen(false); refetchUsers(); refetch() }}
      />
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="mt-1 block text-sm font-medium text-slate-900">{value}</span>
    </div>
  )
}
