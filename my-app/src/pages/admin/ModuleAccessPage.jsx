import { useState, useMemo, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Input } from '../../components/ui.jsx'
import { CRM_MODULES } from '../../lib/roleConstants.js'
import { rolesApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'

export default function ModuleAccessPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const { data: role } = useFetch(useCallback(() => rolesApi.get(id), [id]))
  const { data: rolesList } = useFetch(useCallback(() => rolesApi.list(), []))
  const roleData = role ? { id: role._id, name: role.name, type: role.type === 'system' ? 'System Role' : 'Custom Role', status: role.status === 'active' ? 'Active' : 'Inactive' } : null
  const availableRoles = useMemo(() => (rolesList || []).map((r) => ({ id: r._id, name: r.name })), [rolesList])

  // State
  const [search, setSearch] = useState('')
  const [accessFilter, setAccessFilter] = useState('all') // all, manage, view, none
  const [saving, setSaving] = useState(false)
  // Map of moduleId -> 'manage' | 'view' | 'none'
  const [access, setAccess] = useState({})
  const [originalAccess, setOriginalAccess] = useState({})

  // Initialization from the persisted role designer.
  useEffect(() => {
    if (role) {
      const initialAccess = role.designer?.moduleAccess || {}
      setAccess(initialAccess)
      setOriginalAccess(initialAccess)
    }
  }, [role])

  const hasUnsavedChanges = useMemo(() => {
    const currentKeys = Object.keys(access)
    const originalKeys = Object.keys(originalAccess)
    if (currentKeys.length !== originalKeys.length) return true
    for (const key of currentKeys) {
      if (access[key] !== originalAccess[key]) return true
    }
    return false
  }, [access, originalAccess])

  // The permission builder can tune any role (system roles included).
  const isSystemControlled = false

  // Prevent navigation if unsaved
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm("Your module access changes have not been saved. Do you want to discard them?")) return
    }
    setAccess(originalAccess)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await rolesApi.update(id, { designer: { moduleAccess: access } })
      toast.success('Module access saved — permissions updated')
      setOriginalAccess({ ...access })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // Filter modules
  const filteredModules = useMemo(() => {
    let mods = CRM_MODULES
    
    // Search
    if (search) {
      const q = search.toLowerCase()
      mods = mods.filter(m => m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q))
    }
    
    // Access Filter
    if (accessFilter !== 'all') {
      mods = mods.filter(m => {
        const currentLevel = access[m.id] || 'none'
        return currentLevel === accessFilter
      })
    }
    
    return mods
  }, [search, accessFilter, access])

  const categories = useMemo(() => {
    const map = new Map()
    filteredModules.forEach(m => {
      if (!map.has(m.category)) map.set(m.category, [])
      map.get(m.category).push(m)
    })
    return Array.from(map.entries()).map(([name, modules]) => ({ name, modules }))
  }, [filteredModules])

  const handleRoleChange = (e) => {
    const newId = e.target.value
    if (hasUnsavedChanges) {
      if (!window.confirm("Your module access changes have not been saved. Do you want to discard them?")) return
    }
    navigate(`/admin/roles/${newId}/permissions`)
  }

  const handleAccessChange = (modId, newLevel) => {
    if (isSystemControlled) return
    
    const newAccess = { ...access }
    if (newLevel === 'none') {
      delete newAccess[modId]
    } else {
      newAccess[modId] = newLevel
    }
    setAccess(newAccess)
  }

  if (!roleData) return <div className="p-8 text-center text-slate-500">Loading role context...</div>

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 pb-32">
      {/* Role Selector at the top */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm gap-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">Select Role</label>
          <select 
            className="block w-full sm:w-80 rounded-md border-0 py-2 pl-3 pr-8 text-sm font-medium text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:leading-6"
            value={roleData.id}
            onChange={handleRoleChange}
          >
            {availableRoles.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div className="text-left sm:text-right flex flex-col sm:items-end">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Role Status</span>
          <span className="text-sm font-bold text-slate-900 mt-1">{roleData.type}</span>
          <span className="text-xs text-slate-500">{roleData.status}</span>
        </div>
      </div>

      {/* Context Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Module Access</h1>
        <p className="mt-1 text-sm text-slate-500">Control which CRM modules each company role can access.</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-slate-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto pb-1">
          <span className="border-blue-500 text-blue-600 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium">Module Access</span>
          <button 
            onClick={() => { if (!hasUnsavedChanges || window.confirm("Discard unsaved changes?")) navigate(`/admin/roles/${id}/permissions/pages`) }}
            className="border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium"
          >
            Page & Tab Access
          </button>
          <button 
            onClick={() => { if (!hasUnsavedChanges || window.confirm("Discard unsaved changes?")) navigate(`/admin/roles/${id}/permissions/actions`) }}
            className="border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium"
          >
            Action Permissions
          </button>
          <button 
            onClick={() => { if (!hasUnsavedChanges || window.confirm("Discard unsaved changes?")) navigate(`/admin/roles/${id}/permissions/scope`) }}
            className="border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium"
          >
            Data Scope
          </button>
          <button 
            onClick={() => { if (!hasUnsavedChanges || window.confirm("Discard unsaved changes?")) navigate(`/admin/roles/${id}/permissions/approvals`) }}
            className="border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium"
          >
            Approval Permissions
          </button>
          <button 
            onClick={() => { if (!hasUnsavedChanges || window.confirm("Discard unsaved changes?")) navigate(`/admin/roles/${id}/permissions/review`) }}
            className="border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium"
          >
            Review & Save
          </button>
        </nav>
      </div>

      {/* Toolbar */}
      <div className="mb-6 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="flex flex-col sm:flex-row w-full md:w-auto items-center gap-4">
          <div className="w-full sm:w-64">
            <Input 
              icon="search" 
              placeholder="Search modules..." 
              value={search}
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-sm font-medium text-slate-700 shrink-0">Access:</label>
            <select 
              className="block w-full sm:w-40 rounded-md border-0 py-2 pl-3 pr-8 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:leading-6"
              value={accessFilter}
              onChange={(e) => setAccessFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="manage">Manage</option>
              <option value="view">View</option>
              <option value="none">No Access</option>
            </select>
          </div>
        </div>

        <div className="flex w-full md:w-auto items-center gap-3 justify-end shrink-0">
          {hasUnsavedChanges && (
            <span className="hidden lg:flex text-sm font-medium text-amber-600 mr-2 items-center gap-1">
              <span className="material-symbols-outlined text-[18px]">warning</span>
              Unsaved changes
            </span>
          )}
          <Button variant="secondary" onClick={handleCancel} disabled={!hasUnsavedChanges}>Discard</Button>
          <Button variant="primary" onClick={handleSave} disabled={!hasUnsavedChanges} loading={saving}>Save Changes</Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-8">
        {categories.length > 0 ? categories.map(cat => (
          <div key={cat.name} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {/* Category Header */}
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">{cat.name}</h3>
            </div>

            {/* Table Header */}
            <div className="hidden sm:grid grid-cols-12 gap-4 border-b border-slate-100 bg-white px-5 py-2">
              <div className="col-span-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Module</div>
              <div className="col-span-6 text-xs font-semibold uppercase tracking-wider text-slate-500">Description</div>
              <div className="col-span-2 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right pr-2">Access</div>
            </div>

            {/* Module Rows */}
            <div className="divide-y divide-slate-50">
              {cat.modules.map(mod => {
                const currentLevel = access[mod.id] || 'none'
                
                return (
                  <div key={mod.id} className="grid grid-cols-1 sm:grid-cols-12 gap-4 px-5 py-4 sm:items-center hover:bg-slate-50/50 transition-colors">
                    <div className="sm:col-span-4 flex items-center gap-3">
                      <span className="material-symbols-outlined text-slate-400 text-lg">{mod.icon}</span>
                      <span className="text-sm font-semibold text-slate-900">{mod.name}</span>
                    </div>
                    
                    <div className="sm:col-span-6 text-sm text-slate-500 pr-4">
                      {mod.description}
                    </div>
                    
                    <div className="sm:col-span-2 flex sm:flex-col sm:items-end justify-between sm:justify-center mt-2 sm:mt-0">
                      <span className="sm:hidden text-xs font-medium text-slate-500">Access:</span>
                      {isSystemControlled ? (
                        <div className="flex flex-col items-end">
                          <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${
                            currentLevel === 'manage' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            currentLevel === 'view' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                            'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            {currentLevel === 'manage' ? 'Manage' : currentLevel === 'view' ? 'View' : 'No Access'}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-1">System role</span>
                        </div>
                      ) : (
                        <select 
                          className="block w-[140px] rounded-md border-0 py-1.5 pl-3 pr-8 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:leading-6"
                          value={currentLevel}
                          onChange={(e) => handleAccessChange(mod.id, e.target.value)}
                        >
                          <option value="none">No Access</option>
                          <option value="view">View</option>
                          <option value="manage">Manage</option>
                        </select>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )) : (
          <div className="py-16 text-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
            <span className="material-symbols-outlined mb-2 text-4xl text-slate-300">search_off</span>
            <p className="text-slate-500">No modules match your filters.</p>
            <button className="mt-3 text-sm font-medium text-blue-600 hover:underline" onClick={() => { setSearch(''); setAccessFilter('all'); }}>Clear Filters</button>
          </div>
        )}
      </div>
    </div>
  )
}
