import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Input, Toggle, Card } from '../../components/ui.jsx'
import { CRM_MODULES, MOCK_ACTIONS } from '../../lib/roleConstants.js'
import { useRoleWizard } from '../../components/roles/useRoleWizard.js'
import { useToast } from '../../context/ToastContext.jsx'

export default function ActionPermissionsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const toast = useToast()
  const { role, roleData, availableRoles, moduleAccess, saveSlice } = useRoleWizard(id)

  // State
  const [selectedModuleId, setSelectedModuleId] = useState('')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionAccess, setActionAccess] = useState(new Set())
  const [originalActionAccess, setOriginalActionAccess] = useState(new Set())

  // Initialization from the persisted role designer.
  useEffect(() => {
    if (role) {
      const stored = role.designer?.actions || {}
      const initialActions = new Set(Object.keys(stored).filter((k) => stored[k]))
      setActionAccess(initialActions)
      setOriginalActionAccess(initialActions)
    }
  }, [role])

  const hasUnsavedChanges = actionAccess.size !== originalActionAccess.size || 
                            [...actionAccess].some(a => !originalActionAccess.has(a))

  const isSystemControlled = false // the builder can tune any role

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
      if (!window.confirm("Your permission changes have not been saved. Do you want to discard them?")) return
      setActionAccess(new Set(originalActionAccess))
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const actionsObj = Object.fromEntries([...actionAccess].map((a) => [a, true]))
      await saveSlice({ actions: actionsObj })
      toast.success('Action permissions saved')
      setOriginalActionAccess(new Set(actionAccess))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save')
    } finally { setSaving(false) }
  }

  const handleRoleChange = (e) => {
    const newId = e.target.value
    if (hasUnsavedChanges) {
      if (!window.confirm("Your permission changes have not been saved. Do you want to discard them?")) return
    }
    navigate(`/admin/roles/${newId}/permissions/actions`)
  }

  // Get module access status
  const currentModuleAccessLevel = useMemo(() => {
    if (!selectedModuleId) return 'none'
    return moduleAccess[selectedModuleId] || 'none'
  }, [moduleAccess, selectedModuleId])

  const isModuleDisabled = currentModuleAccessLevel === 'none'
  const isModuleViewOnly = currentModuleAccessLevel === 'view'

  // Auto-select first available module with actions
  useEffect(() => {
    if (!selectedModuleId && CRM_MODULES.length > 0) {
      // Find first module that has actions defined
      const modWithActions = CRM_MODULES.find(m => MOCK_ACTIONS[m.id]?.length > 0)
      if (modWithActions) setSelectedModuleId(modWithActions.id)
    }
  }, [selectedModuleId])

  const currentModule = useMemo(() => CRM_MODULES.find(m => m.id === selectedModuleId), [selectedModuleId])

  const availableActions = useMemo(() => {
    if (!selectedModuleId) return []
    return MOCK_ACTIONS[selectedModuleId] || []
  }, [selectedModuleId])

  const filteredActions = useMemo(() => {
    if (!search) return availableActions
    const q = search.toLowerCase()
    return availableActions.filter(a => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q))
  }, [availableActions, search])

  const toggleAction = (action, isEnabling) => {
    if (isSystemControlled || isModuleDisabled) return
    if (isModuleViewOnly && action.name !== 'View') return // Only View can be toggled if module is View-only

    const newAccess = new Set(actionAccess)

    if (isEnabling) {
      // Check dependencies
      if (action.dependencies?.length > 0) {
        const missingDeps = action.dependencies.filter(depId => !newAccess.has(depId))
        if (missingDeps.length > 0) {
          const depNames = missingDeps.map(depId => availableActions.find(a => a.id === depId)?.name).join(', ')
          if (window.confirm(`${depNames} access is required to enable ${action.name}. Enable both?`)) {
            missingDeps.forEach(depId => newAccess.add(depId))
            newAccess.add(action.id)
          } else {
            return
          }
        } else {
          newAccess.add(action.id)
        }
      } else {
        newAccess.add(action.id)
      }
    } else {
      // Disabling
      const dependents = availableActions.filter(a => a.dependencies?.includes(action.id) && newAccess.has(a.id))
      
      if (dependents.length > 0) {
        const depNames = dependents.map(a => a.name).join(', ')
        if (window.confirm(`${action.name} access is required. The following actions depend on ${action.name} access and will be disabled: ${depNames}. Continue?`)) {
          dependents.forEach(a => newAccess.delete(a.id))
          newAccess.delete(action.id)
        } else {
          return
        }
      } else {
        newAccess.delete(action.id)
      }
    }

    setActionAccess(newAccess)
  }

  const enabledActionsCount = availableActions.filter(a => actionAccess.has(a.id)).length
  const changesCount = Math.abs(actionAccess.size - originalActionAccess.size) // Simplified change count representation

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
        <h1 className="text-2xl font-bold text-slate-900">Action Permissions</h1>
        <p className="mt-1 text-sm text-slate-500">Control what each company role can do within the modules they can access.</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-slate-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto pb-1">
          <button onClick={() => { if (!hasUnsavedChanges || window.confirm("Discard unsaved changes?")) navigate(`/admin/roles/${id}/permissions`) }} className="border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium">Module Access</button>
          <button onClick={() => { if (!hasUnsavedChanges || window.confirm("Discard unsaved changes?")) navigate(`/admin/roles/${id}/permissions/pages`) }} className="border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium">Page & Tab Access</button>
          <span className="border-blue-500 text-blue-600 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium">Action Permissions</span>
          <button onClick={() => { if (!hasUnsavedChanges || window.confirm("Discard unsaved changes?")) navigate(`/admin/roles/${id}/permissions/scope`) }} className="border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium">Data Scope</button>
          <button onClick={() => { if (!hasUnsavedChanges || window.confirm("Discard unsaved changes?")) navigate(`/admin/roles/${id}/permissions/approvals`) }} className="border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium">Approval Permissions</button>
          <button onClick={() => { if (!hasUnsavedChanges || window.confirm("Discard unsaved changes?")) navigate(`/admin/roles/${id}/permissions/review`) }} className="border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium">Review & Save</button>
        </nav>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Left Side: Configuration */}
        <div className="flex-1 min-w-0">
          
          <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="w-full sm:w-auto flex-1 max-w-sm">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">Select Module</label>
              <select 
                className="block w-full rounded-md border-0 py-2 pl-3 pr-8 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:leading-6"
                value={selectedModuleId}
                onChange={e => {
                  if (hasUnsavedChanges && !window.confirm("Discard unsaved changes?")) return
                  setSelectedModuleId(e.target.value)
                }}
              >
                {CRM_MODULES.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            
            <div className="w-full sm:w-64 pt-5">
               <Input 
                icon="search" 
                placeholder="Search actions..." 
                value={search}
                onChange={e => setSearch(e.target.value)} 
              />
            </div>
          </div>

          {/* Module Access Banner */}
          {!isModuleDisabled && (
            <div className="mb-4 flex items-center justify-between px-2">
              <span className="text-sm font-semibold text-slate-700">Module Access Level:</span>
              <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${
                currentModuleAccessLevel === 'manage' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {currentModuleAccessLevel === 'manage' ? 'Manage' : 'View'}
              </span>
            </div>
          )}

          {isModuleDisabled ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
              <span className="material-symbols-outlined text-4xl text-red-400 mb-2">block</span>
              <h3 className="text-lg font-semibold text-red-900">No Module Access</h3>
              <p className="mt-1 text-sm text-red-700">You cannot configure actions because the <strong>{currentModule?.name}</strong> module is turned off for this role.</p>
              <Button variant="secondary" className="mt-5" onClick={() => navigate(`/admin/roles/${id}/permissions`)}>Manage Module Access</Button>
            </div>
          ) : availableActions.length === 0 ? (
            <div className="py-12 text-center border rounded-xl bg-white border-slate-200 shadow-sm">
              <span className="material-symbols-outlined mb-2 text-4xl text-slate-300">touch_app</span>
              <p className="text-slate-500 font-medium">No actions defined</p>
              <p className="mt-1 text-sm text-slate-400">There are no granular actions defined for this module.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="hidden sm:grid grid-cols-12 gap-4 border-b border-slate-100 bg-slate-50 px-6 py-3">
                <div className="col-span-4 text-xs font-bold uppercase tracking-wider text-slate-500">Action</div>
                <div className="col-span-5 text-xs font-bold uppercase tracking-wider text-slate-500">Description</div>
                <div className="col-span-3 text-xs font-bold uppercase tracking-wider text-slate-500 text-right pr-2">Access</div>
              </div>

              <div className="divide-y divide-slate-50">
                {filteredActions.map(action => {
                  const isEnabled = actionAccess.has(action.id)
                  const isActionDisabledForViewOnly = isModuleViewOnly && action.name !== 'View'
                  
                  let missingDependency = null;
                  if (!isEnabled && action.dependencies?.length > 0) {
                     const missing = action.dependencies.find(depId => !actionAccess.has(depId))
                     if (missing) {
                       missingDependency = availableActions.find(a => a.id === missing)?.name
                     }
                  }

                  return (
                    <div key={action.id} className="grid grid-cols-1 sm:grid-cols-12 gap-4 px-6 py-4 sm:items-center hover:bg-slate-50/50 transition-colors">
                      <div className="sm:col-span-4 flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{action.name}</span>
                        {action.base && (
                          <span className="rounded bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">Base</span>
                        )}
                      </div>
                      
                      <div className="sm:col-span-5 flex flex-col justify-center pr-4">
                        <span className="text-sm text-slate-500">{action.description}</span>
                        {missingDependency && !isActionDisabledForViewOnly && (
                          <span className="mt-1 text-[11px] font-semibold text-orange-600 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">warning</span>
                            Requires {missingDependency}
                          </span>
                        )}
                      </div>
                      
                      <div className="sm:col-span-3 flex flex-col sm:items-end justify-center mt-2 sm:mt-0">
                        {isSystemControlled ? (
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
                            System
                          </span>
                        ) : isActionDisabledForViewOnly ? (
                          <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-400 border border-slate-100">
                            View Only
                          </span>
                        ) : (
                          <Toggle 
                            checked={isEnabled} 
                            onChange={(val) => toggleAction(action, val)}
                            label={isEnabled ? 'ON' : 'OFF'}
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Summary Sidebar */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="sticky top-6">
            <Card className="p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">Action Summary</h3>
              
              <div className="mb-4">
                <span className="block text-xs text-slate-500">Selected Module</span>
                <span className="block text-sm font-bold text-slate-900 mt-0.5">{currentModule?.name || '-'}</span>
              </div>

              {!isModuleDisabled && availableActions.length > 0 && (
                <div className="flex items-center justify-between border-t border-slate-100 py-3 mb-2">
                  <span className="text-sm text-slate-600">Actions Enabled</span>
                  <span className="text-lg font-bold text-blue-600">{enabledActionsCount} <span className="text-sm font-normal text-slate-400">/ {availableActions.length}</span></span>
                </div>
              )}

              {hasUnsavedChanges && (
                <div className="mb-4 rounded-md bg-amber-50 p-3 border border-amber-200 flex items-start gap-2">
                  <span className="material-symbols-outlined text-amber-600 text-[18px]">warning</span>
                  <div>
                    <span className="text-sm text-amber-900 font-bold block leading-tight">Unsaved changes</span>
                    <span className="text-xs text-amber-700 mt-1 block">You have modified permissions.</span>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 mt-2">
                <Button variant="primary" className="w-full justify-center" onClick={handleSave} disabled={!hasUnsavedChanges} loading={saving}>
                  Save Changes
                </Button>
                {hasUnsavedChanges && (
                  <Button variant="secondary" className="w-full justify-center" onClick={handleCancel}>
                    Discard
                  </Button>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
