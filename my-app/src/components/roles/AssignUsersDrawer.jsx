import { useState, useMemo, useCallback } from 'react'
import { Modal, Button, Input, Select } from '../ui.jsx'
import { rolesApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'

// Extract unique branches from users for the filter
function getUniqueBranches(users) {
  const branches = users.map(u => u.branch).filter(Boolean)
  return [...new Set(branches)]
}

export default function AssignUsersDrawer({ open, onClose, targetRole, onAssigned }) {
  const toast = useToast()
  const { data: usersRaw } = useFetch(useCallback(() => rolesApi.assignableUsers(), []))
  const allUsers = useMemo(() => (usersRaw || []).map((u) => ({
    id: u._id, name: u.name, email: u.email, branch: u.branch || '—',
    status: u.isActive === false ? 'Inactive' : 'Active', roleName: u.role, roleId: u.customRole || null,
  })), [usersRaw])

  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('Active')
  const [selectedUserIds, setSelectedUserIds] = useState(new Set())
  const [showConfirm, setShowConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  // Users available to assign (exclude those already in this role)
  const availableUsers = useMemo(() => {
    return allUsers.filter(u => String(u.roleId) !== String(targetRole?.id))
  }, [allUsers, targetRole])

  const branches = useMemo(() => getUniqueBranches(availableUsers), [availableUsers])

  const filteredUsers = useMemo(() => {
    return availableUsers.filter(u => {
      const matchSearch = (u.name + ' ' + u.email + ' ' + u.id).toLowerCase().includes(search.toLowerCase())
      const matchBranch = branchFilter ? u.branch === branchFilter : true
      const matchStatus = statusFilter ? u.status === statusFilter : true
      return matchSearch && matchBranch && matchStatus
    })
  }, [availableUsers, search, branchFilter, statusFilter])

  const handleToggleSelect = (userId) => {
    const newSelected = new Set(selectedUserIds)
    if (newSelected.has(userId)) {
      newSelected.delete(userId)
    } else {
      newSelected.add(userId)
    }
    setSelectedUserIds(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedUserIds.size === filteredUsers.length) {
      setSelectedUserIds(new Set())
    } else {
      const newSelected = new Set(filteredUsers.map(u => u.id))
      setSelectedUserIds(newSelected)
    }
  }

  const handleClose = () => {
    if (selectedUserIds.size > 0 && !showConfirm) {
      if (window.confirm('Discard selection?')) {
        resetAndClose()
      }
    } else {
      resetAndClose()
    }
  }

  const resetAndClose = () => {
    setSearch('')
    setBranchFilter('')
    setStatusFilter('Active')
    setSelectedUserIds(new Set())
    setShowConfirm(false)
    onClose()
  }

  const handleConfirmAction = () => {
    setShowConfirm(true)
  }

  const handleFinalAssign = async () => {
    setBusy(true)
    try {
      await rolesApi.assign(targetRole.id, Array.from(selectedUserIds))
      toast.success(`${selectedUserIds.size} user(s) assigned to ${targetRole.name}`)
      setSearch(''); setBranchFilter(''); setStatusFilter('Active'); setSelectedUserIds(new Set()); setShowConfirm(false)
      onAssigned?.()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign users')
    } finally { setBusy(false) }
  }

  const usersWithConflicts = Array.from(selectedUserIds).map(id => allUsers.find(u => u.id === id)).filter(u => u && u.roleId)

  if (!open) return null

  return (
    <Modal open={open} onClose={handleClose} title="Assign Users" size="lg">
      {!showConfirm ? (
        <div className="flex h-full flex-col">
          <p className="mb-4 text-sm text-slate-500">Select users to assign to the <span className="font-semibold text-slate-900">{targetRole?.name}</span> role.</p>
          
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder="Search name, email or ID..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="w-40">
              <Select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
                <option value="">All Branches</option>
                {branches.map(b => <option key={b} value={b}>{b}</option>)}
              </Select>
            </div>
            <div className="w-32">
              <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </Select>
            </div>
          </div>

          <div className="flex-1 overflow-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                      checked={filteredUsers.length > 0 && selectedUserIds.size === filteredUsers.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Current Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Branch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredUsers.length > 0 ? filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedUserIds.has(user.id)}
                        onChange={() => handleToggleSelect(user.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{user.name}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="font-medium text-slate-700">{user.roleName || 'None'}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{user.branch}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="4" className="px-4 py-8 text-center text-sm text-slate-500">
                      No users found matching filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
            <span className="text-sm font-medium text-slate-700">{selectedUserIds.size} users selected</span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleClose}>Cancel</Button>
              <Button variant="primary" onClick={handleConfirmAction} disabled={selectedUserIds.size === 0}>Assign Users</Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 py-2">
          <div className="rounded-lg bg-orange-50 p-4 border border-orange-100 flex items-start gap-3">
            <span className="material-symbols-outlined text-orange-600 mt-0.5">warning</span>
            <div>
              <h4 className="text-sm font-semibold text-orange-900">Change users' roles?</h4>
              <p className="mt-1 text-sm text-orange-700">
                You are about to assign <strong>{selectedUserIds.size}</strong> users to the <strong>{targetRole.name}</strong> role.
                {usersWithConflicts.length > 0 && " This will replace their current roles."}
              </p>
            </div>
          </div>

          {usersWithConflicts.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Role Replacements</h5>
              <ul className="text-sm space-y-2 border border-slate-100 rounded-lg p-3 bg-slate-50 max-h-48 overflow-auto">
                {usersWithConflicts.map(u => (
                  <li key={u.id} className="flex justify-between items-center">
                    <span className="font-medium text-slate-800">{u.name}</span>
                    <span className="text-slate-500">{u.roleName} <span className="mx-1 text-slate-300">→</span> <span className="text-blue-600 font-medium">{targetRole.name}</span></span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowConfirm(false)}>Back</Button>
            <Button variant="primary" onClick={handleFinalAssign} loading={busy}>Confirm Assignment</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
