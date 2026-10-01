import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Card } from '../../components/ui.jsx'
import { CRM_MODULES, DATA_SCOPE_OPTIONS, MOCK_MODULE_SCOPES } from '../../lib/roleConstants.js'
import { useRoleWizard } from '../../components/roles/useRoleWizard.js'
import { useToast } from '../../context/ToastContext.jsx'

export default function DataScopePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const toast = useToast()
  const { role, roleData, availableRoles, moduleAccess, saveSlice } = useRoleWizard(id)

  const [selectedModuleId, setSelectedModuleId] = useState('')
  const [scopes, setScopes] = useState({})
  const [originalScopes, setOriginalScopes] = useState({})
  const [saving, setSaving] = useState(false)

  // Initialize from the persisted role designer.
  useEffect(() => {
    if (role) {
      const initial = JSON.parse(JSON.stringify(role.designer?.moduleScopes || {}))
      setScopes(initial)
      setOriginalScopes(initial)
      if (!selectedModuleId && CRM_MODULES.length > 0) setSelectedModuleId(CRM_MODULES[0].id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  const hasUnsavedChanges = useMemo(() => {
    const keys = new Set([...Object.keys(scopes), ...Object.keys(originalScopes)])
    for (let k of keys) {
      if (scopes[k] !== originalScopes[k]) return true
    }
    return false
  }, [scopes, originalScopes])

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

  const handleRoleChange = (e) => {
    const newId = e.target.value
    if (hasUnsavedChanges) {
      if (!window.confirm("Your data scope changes have not been saved. Do you want to discard them?")) return
    }
    navigate(`/admin/roles/${newId}/permissions/scope`)
  }

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm("Your data scope changes have not been saved. Do you want to discard them?")) return
      setScopes({ ...originalScopes })
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveSlice({ moduleScopes: scopes })
      toast.success('Data scope saved')
      setOriginalScopes({ ...scopes })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save')
    } finally { setSaving(false) }
  }

  if (!roleData) return <div className="p-8 text-center text-slate-500">Loading role context...</div>

  // System rules
  const isSystemControlled = false // the builder can tune any role

  const selectedModule = CRM_MODULES.find(m => m.id === selectedModuleId)
  
  // Access and Scope calculations for the selected module
  const moduleAccessVal = moduleAccess[selectedModuleId] || 'none'
  const isModuleDisabled = moduleAccessVal === 'none'
  
  const allowedScopes = MOCK_MODULE_SCOPES[selectedModuleId] || []
  const isNotApplicable = allowedScopes.length === 0
  
  const currentScopeVal = scopes[selectedModuleId] || ''
  const currentScopeObj = DATA_SCOPE_OPTIONS.find(o => o.value === currentScopeVal)

  const handleScopeChange = (e) => {
    if (isSystemControlled || isModuleDisabled) return
    const newScope = e.target.value
    setScopes(prev => ({ ...prev, [selectedModuleId]: newScope }))
  }

  // Build changes list
  const changesList = []
  Object.keys(scopes).forEach(modId => {
    if (scopes[modId] !== originalScopes[modId]) {
      const mod = CRM_MODULES.find(m => m.id === modId)
      const oldS = DATA_SCOPE_OPTIONS.find(o => o.value === originalScopes[modId])?.label || 'Not Configured'
      const newS = DATA_SCOPE_OPTIONS.find(o => o.value === scopes[modId])?.label || 'Not Configured'
      if (mod) {
        changesList.push({ module: mod.name, old: oldS, new: newS })
      }
    }
  })
  
  Object.keys(originalScopes).forEach(modId => {
    if (originalScopes[modId] !== undefined && scopes[modId] === undefined) {
       // Scope was removed
       const mod = CRM_MODULES.find(m => m.id === modId)
       const oldS = DATA_SCOPE_OPTIONS.find(o => o.value === originalScopes[modId])?.label || 'Not Configured'
       if (mod) {
         changesList.push({ module: mod.name, old: oldS, new: 'Not Configured' })
       }
    }
  })

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 pb-32">
      {/* Role Selector */}
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

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Data Scope</h1>
        <p className="mt-1 text-sm text-slate-500">Control which records each company role can access.</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-slate-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto pb-1">
          <button 
            onClick={() => { if (!hasUnsavedChanges || window.confirm("Discard unsaved changes?")) navigate(`/admin/roles/${id}/permissions`) }}
            className="border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium"
          >
            Module Access
          </button>
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
          <span className="border-blue-500 text-blue-600 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium">Data Scope</span>
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

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Main Configuration Panel */}
        <div className="flex-1 min-w-0">
          <Card className="p-6">
            
            {/* Module Selector */}
            <div className="mb-8">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">Module</label>
              <select 
                className="block w-full sm:w-80 rounded-md border-0 py-2 pl-3 pr-8 text-sm font-medium text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:leading-6"
                value={selectedModuleId}
                onChange={(e) => setSelectedModuleId(e.target.value)}
              >
                {CRM_MODULES.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {selectedModule && (
              <div className="space-y-8 max-w-2xl">
                {/* Visual Connector / Info Block */}
                <div className="flex items-start gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50">
                  <span className="material-symbols-outlined text-3xl text-blue-500 mt-1">{selectedModule.icon}</span>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{selectedModule.name}</h3>
                    <p className="text-sm text-slate-500 mt-1">{selectedModule.description}</p>
                    
                    <div className="mt-4 flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Module Access:</span>
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                        moduleAccessVal === 'manage' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        moduleAccessVal === 'view' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {moduleAccessVal === 'manage' ? 'Manage' : moduleAccessVal === 'view' ? 'View' : 'No Access'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Scope Selection */}
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">Record Visibility</h4>
                  
                  {isModuleDisabled ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                      <span className="material-symbols-outlined text-3xl text-slate-400 mb-2">lock</span>
                      <p className="text-sm font-medium text-slate-900">No Module Access</p>
                      <p className="text-sm text-slate-500 mt-1">Data scope cannot be configured because the role has no access to this module.</p>
                    </div>
                  ) : isNotApplicable ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                      <span className="material-symbols-outlined text-3xl text-slate-400 mb-2">info</span>
                      <p className="text-sm font-medium text-slate-900">Not Applicable</p>
                      <p className="text-sm text-slate-500 mt-1">Data scope is not required or applicable for this module.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">Data Scope</label>
                      
                      {isSystemControlled ? (
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 font-medium w-full sm:w-80">
                          System role data scope is managed by the system.
                        </div>
                      ) : (
                        <select 
                          className="block w-full sm:w-80 rounded-md border-0 py-2.5 pl-3 pr-8 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:leading-6"
                          value={currentScopeVal}
                          onChange={handleScopeChange}
                        >
                          <option value="" disabled>Select scope...</option>
                          {DATA_SCOPE_OPTIONS.filter(o => allowedScopes.includes(o.value)).map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Description Panel */}
                      {currentScopeObj && (
                        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                          <p className="text-sm font-medium text-blue-900">
                            {currentScopeObj.description}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right Side: Change Summary & Actions */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="sticky top-6">
            <Card className="p-5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">Change Summary</h3>
              
              {changesList.length > 0 ? (
                <div className="mb-6 space-y-3">
                  {changesList.map((change, idx) => (
                    <div key={idx} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="text-xs font-bold text-slate-700 mb-1">{change.module}</div>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="line-through text-slate-400">{change.old}</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                        <span className="font-semibold text-blue-600">{change.new}</span>
                      </div>
                    </div>
                  ))}
                  
                  <div className="rounded-md bg-amber-50 p-3 border border-amber-200 flex items-start gap-2 mt-4">
                    <span className="material-symbols-outlined text-amber-600 text-[18px]">warning</span>
                    <span className="text-sm text-amber-900 font-medium">Unsaved changes</span>
                  </div>
                </div>
              ) : (
                <div className="mb-6 rounded-lg border border-dashed border-slate-200 p-4 text-center">
                  <span className="text-sm text-slate-400">No data scope changes.</span>
                </div>
              )}

              <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
                <Button variant="primary" className="w-full justify-center" onClick={handleSave} disabled={!hasUnsavedChanges} loading={saving}>
                  Save Changes
                </Button>
                {hasUnsavedChanges && (
                  <Button variant="ghost" className="w-full justify-center text-slate-500" onClick={handleCancel}>
                    Cancel
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
