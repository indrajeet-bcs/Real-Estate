import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Input, Select, Toggle, Card } from '../../components/ui.jsx'
import { CRM_MODULES, MOCK_APPROVAL_WORKFLOWS } from '../../lib/roleConstants.js'
import { useRoleWizard } from '../../components/roles/useRoleWizard.js'
import { useToast } from '../../context/ToastContext.jsx'

export default function ApprovalPermissionsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { role, roleData, moduleAccess, saveSlice } = useRoleWizard(id)

  const [search, setSearch] = useState('')
  const [filterAccess, setFilterAccess] = useState('ALL') // ALL, ENABLED, DISABLED
  const [expandedWorkflows, setExpandedWorkflows] = useState(new Set())
  const [saving, setSaving] = useState(false)

  // State: workflowId -> Set(actionIds)
  const [approvalAccess, setApprovalAccess] = useState({})
  const [originalApprovalAccess, setOriginalApprovalAccess] = useState({})

  // Initialization from the persisted role designer.
  useEffect(() => {
    if (role) {
      const initial = role.designer?.approvals || {}
      const parsed = {}
      for (const [wfId, actions] of Object.entries(initial)) {
        parsed[wfId] = new Set(actions)
      }
      setApprovalAccess(parsed)
      setOriginalApprovalAccess(parsed)
    }
  }, [role])

  const hasUnsavedChanges = useMemo(() => {
    const keys = new Set([...Object.keys(approvalAccess), ...Object.keys(originalApprovalAccess)])
    for (let k of keys) {
      const curr = approvalAccess[k]
      const orig = originalApprovalAccess[k]
      if (!!curr !== !!orig) return true // Access ON vs OFF
      if (curr && orig) {
        if (curr.size !== orig.size) return true
        if ([...curr].some(a => !orig.has(a))) return true
      }
    }
    return false
  }, [approvalAccess, originalApprovalAccess])

  const isSystemControlled = false // the builder can tune any role
  // Business constraint: only Branch Admin / Company Owner tiers approve discounts.
  const canApproveDiscounts = roleData?.name === 'Branch Admin' || roleData?.name === 'Company Owner'

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
      if (!window.confirm("Discard unsaved changes?")) return
      
      const reverted = {}
      for (const [wfId, actions] of Object.entries(originalApprovalAccess)) {
        reverted[wfId] = new Set(actions)
      }
      setApprovalAccess(reverted)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const approvalsObj = {}
      for (const [wfId, actions] of Object.entries(approvalAccess)) approvalsObj[wfId] = [...actions]
      await saveSlice({ approvals: approvalsObj })
      toast.success('Approval permissions saved')
      const saved = {}
      for (const [wfId, actions] of Object.entries(approvalAccess)) saved[wfId] = new Set(actions)
      setOriginalApprovalAccess(saved)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save')
    } finally { setSaving(false) }
  }

  // Helpers
  const isModuleEnabled = (modId) => !!moduleAccess[modId]

  const toggleWorkflowAccess = (wfId, val) => {
    if (isSystemControlled) return
    setApprovalAccess(prev => {
      const next = { ...prev }
      if (val) {
        next[wfId] = new Set() // Enabled, but no actions yet
      } else {
        delete next[wfId] // Disabled
      }
      return next
    })
  }

  const toggleAction = (wfId, action, val) => {
    if (isSystemControlled || !approvalAccess[wfId]) return

    setApprovalAccess(prev => {
      const next = { ...prev }
      const newActions = new Set(next[wfId])

      if (val) {
        // Enforce View Request dependency
        if (action.dependencies?.length > 0) {
           const missing = action.dependencies.filter(depId => !newActions.has(depId))
           if (missing.length > 0) {
             const wf = MOCK_APPROVAL_WORKFLOWS.find(w => w.id === wfId)
             const depNames = missing.map(depId => wf.actions.find(a => a.id === depId)?.name).join(', ')
             if (window.confirm(`${depNames} access is required. Enable both?`)) {
               missing.forEach(depId => newActions.add(depId))
               newActions.add(action.id)
             } else {
               return prev // Cancel
             }
           } else {
             newActions.add(action.id)
           }
        } else {
          newActions.add(action.id)
        }
      } else {
        // Disabling
        const wf = MOCK_APPROVAL_WORKFLOWS.find(w => w.id === wfId)
        const dependents = wf.actions.filter(a => a.dependencies?.includes(action.id) && newActions.has(a.id))
        
        if (dependents.length > 0) {
          const depNames = dependents.map(a => a.name).join(', ')
          if (window.confirm(`${action.name} access is required. The following actions depend on it and will be disabled: ${depNames}. Continue?`)) {
            dependents.forEach(a => newActions.delete(a.id))
            newActions.delete(action.id)
          } else {
            return prev
          }
        } else {
          newActions.delete(action.id)
        }
      }

      next[wfId] = newActions
      return next
    })
  }

  const toggleExpand = (wfId) => {
    setExpandedWorkflows(prev => {
      const next = new Set(prev)
      if (next.has(wfId)) next.delete(wfId)
      else next.add(wfId)
      return next
    })
  }

  const handleSelectAll = (wfId) => {
    if (isSystemControlled || !approvalAccess[wfId]) return
    const wf = MOCK_APPROVAL_WORKFLOWS.find(w => w.id === wfId)
    const newActions = new Set(approvalAccess[wfId])
    
    wf.actions.forEach(a => {
      // Don't enable authority-restricted ones if user shouldn't
      if (a.authorityRestricted && wf.id === 'AWF_01' && !canApproveDiscounts) return
      newActions.add(a.id)
    })
    
    setApprovalAccess(prev => ({ ...prev, [wfId]: newActions }))
  }

  const handleClearAll = (wfId) => {
    if (isSystemControlled || !approvalAccess[wfId]) return
    if (window.confirm("Disable all actions for this workflow?")) {
      setApprovalAccess(prev => ({ ...prev, [wfId]: new Set() }))
    }
  }

  // Filter
  const filteredWorkflows = useMemo(() => {
    let result = MOCK_APPROVAL_WORKFLOWS
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(w => w.name.toLowerCase().includes(q) || w.description.toLowerCase().includes(q))
    }
    if (filterAccess !== 'ALL') {
      if (filterAccess === 'ENABLED') {
        result = result.filter(w => approvalAccess[w.id] !== undefined)
      } else if (filterAccess === 'DISABLED') {
        result = result.filter(w => approvalAccess[w.id] === undefined)
      }
    }
    return result
  }, [search, filterAccess, approvalAccess])

  // Summary
  const summaryCounts = useMemo(() => {
    let enabled = 0, disabled = 0, sysControlled = isSystemControlled ? MOCK_APPROVAL_WORKFLOWS.length : 0
    
    if (!isSystemControlled) {
      MOCK_APPROVAL_WORKFLOWS.forEach(w => {
        if (approvalAccess[w.id] !== undefined) enabled++
        else disabled++
      })
    }

    return { enabled, disabled, sysControlled }
  }, [approvalAccess, isSystemControlled])

  if (!roleData) return <div className="p-8 text-center text-slate-500">Loading role context...</div>

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Context Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => { if (!hasUnsavedChanges || window.confirm("Discard unsaved changes?")) navigate(`/admin/roles/${id}/permissions/scope`) }} className="-ml-3 mb-2">
          ← Back to Data Scope
        </Button>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Approval Permissions</h1>
            <p className="mt-1 text-sm text-slate-500">Control which approval requests this role can access and perform.</p>
          </div>
          
          <div className="text-right flex flex-col items-end">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Configuring Role</span>
            <span className="text-sm font-bold text-slate-900 mt-1">{roleData.name}</span>
            <span className="text-xs text-slate-500">{roleData.type} • {roleData.status}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
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
          <button 
            onClick={() => { if (!hasUnsavedChanges || window.confirm("Discard unsaved changes?")) navigate(`/admin/roles/${id}/permissions/scope`) }}
            className="border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium"
          >
            Data Scope
          </button>
          <span className="border-blue-500 text-blue-600 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium">Approval Permissions</span>
          <button 
            onClick={() => { if (!hasUnsavedChanges || window.confirm("Discard unsaved changes?")) navigate(`/admin/roles/${id}/permissions/review`) }}
            className="border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium"
          >
            Review & Save
          </button>
        </nav>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Left Side */}
        <div className="flex-1 min-w-0">
          
          <div className="mb-6 flex flex-col sm:flex-row gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex-1">
              <Input 
                icon="search" 
                placeholder="Search approval types..." 
                value={search}
                onChange={e => setSearch(e.target.value)} 
              />
            </div>
            <div className="w-full sm:w-48 shrink-0">
              <Select value={filterAccess} onChange={e => setFilterAccess(e.target.value)}>
                <option value="ALL">All Workflows</option>
                <option value="ENABLED">Access Enabled</option>
                <option value="DISABLED">Access Disabled</option>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            {filteredWorkflows.map(wf => {
              const isModuleOn = isModuleEnabled(wf.relatedModule)
              const moduleObj = CRM_MODULES.find(m => m.id === wf.relatedModule)
              const isWfEnabled = approvalAccess[wf.id] !== undefined
              const enabledActionsCount = isWfEnabled ? approvalAccess[wf.id].size : 0
              const isExpanded = expandedWorkflows.has(wf.id)

              return (
                <div key={wf.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  
                  {/* Card Header */}
                  <div className={`flex items-center justify-between p-5 ${isWfEnabled ? 'bg-white' : 'bg-slate-50'} ${isExpanded ? 'border-b border-slate-200' : ''}`}>
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isWfEnabled && isModuleOn ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                        <span className="material-symbols-outlined text-xl">fact_check</span>
                      </div>
                      <div>
                        <h4 className={`text-base font-semibold ${isWfEnabled && isModuleOn ? 'text-slate-900' : 'text-slate-600'}`}>{wf.name}</h4>
                        <p className="mt-0.5 text-sm text-slate-500">Related Module: {moduleObj?.name || 'Unknown'}</p>
                        
                        {!isModuleOn ? (
                          <div className="mt-3 rounded border border-red-100 bg-red-50 p-2 inline-block">
                            <span className="text-xs text-red-600 font-medium">Related module access is disabled.</span>
                          </div>
                        ) : (
                          <div className="mt-2 flex items-center gap-3">
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${isWfEnabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                              {isWfEnabled ? 'Access Enabled' : 'Access Disabled'}
                            </span>
                            {isWfEnabled && (
                              <span className="text-xs text-slate-500">
                                {enabledActionsCount} of {wf.actions.length} actions enabled
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {isModuleOn && (
                      <div className="flex flex-col items-end gap-3 shrink-0 ml-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-700">Approval Access</span>
                          {isSystemControlled ? (
                            <span className="text-xs text-slate-400">System</span>
                          ) : (
                            <Toggle checked={isWfEnabled} onChange={(val) => toggleWorkflowAccess(wf.id, val)} />
                          )}
                        </div>
                        
                        <button 
                          className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
                          onClick={() => toggleExpand(wf.id)}
                        >
                          {isExpanded ? 'Hide Actions' : 'Show Actions'}
                          <span className="material-symbols-outlined text-lg ml-1">{isExpanded ? 'expand_less' : 'expand_more'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Expanded Actions */}
                  {isExpanded && isModuleOn && (
                    <div className="p-0 bg-slate-50/50">
                      
                      {/* Action Bulk Controls */}
                      <div className="flex justify-between items-center px-6 py-3 border-b border-slate-100 bg-slate-50">
                         <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Configurable Actions</span>
                         {!isSystemControlled && isWfEnabled && (
                           <div className="flex gap-4">
                             <button className="text-xs font-medium text-blue-600 hover:text-blue-800" onClick={() => handleSelectAll(wf.id)}>Select All</button>
                             <button className="text-xs font-medium text-slate-500 hover:text-slate-800" onClick={() => handleClearAll(wf.id)}>Clear All</button>
                           </div>
                         )}
                      </div>

                      <div className="divide-y divide-slate-100">
                        {wf.actions.map(action => {
                          const isEnabled = isWfEnabled && approvalAccess[wf.id].has(action.id)
                          const isAuthRestricted = action.authorityRestricted && wf.id === 'AWF_01' && !canApproveDiscounts
                          
                          let missingDependency = null;
                          if (!isEnabled && isWfEnabled && action.dependencies?.length > 0) {
                             const missing = action.dependencies.find(depId => !approvalAccess[wf.id].has(depId))
                             if (missing) {
                               missingDependency = wf.actions.find(a => a.id === missing)?.name
                             }
                          }

                          return (
                            <div key={action.id} className="flex items-center justify-between px-6 py-4">
                              <div className="flex flex-col pr-4">
                                <span className={`text-sm font-medium ${isEnabled ? 'text-slate-900' : 'text-slate-500'}`}>
                                  {action.name}
                                  {action.base && <span className="ml-2 rounded bg-slate-200 text-slate-600 px-1.5 py-0.5 text-[10px] uppercase font-bold tracking-wider">Required</span>}
                                </span>
                                
                                {isAuthRestricted ? (
                                  <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">lock</span>
                                    Authority controlled by existing workflow
                                  </p>
                                ) : missingDependency ? (
                                  <p className="mt-1 text-xs text-orange-600 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">warning</span>
                                    Requires {missingDependency}
                                  </p>
                                ) : null}
                              </div>

                              <div className="shrink-0">
                                {isSystemControlled || isAuthRestricted ? (
                                  <span className="text-xs font-medium text-slate-400">System controlled</span>
                                ) : (
                                  <Toggle 
                                    checked={isEnabled} 
                                    onChange={(val) => toggleAction(wf.id, action, val)}
                                    disabled={!isWfEnabled}
                                  />
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {!isWfEnabled && (
                        <div className="px-6 py-4 bg-slate-100 text-center text-sm text-slate-500">
                          Enable Approval Access to configure actions.
                        </div>
                      )}

                    </div>
                  )}

                </div>
              )
            })}

            {filteredWorkflows.length === 0 && (
              <div className="py-12 text-center border rounded-xl bg-white border-slate-200">
                <span className="material-symbols-outlined mb-2 text-4xl text-slate-300">fact_check</span>
                <p className="text-slate-500 font-medium">No workflows found</p>
                <button className="mt-2 text-sm text-blue-600 hover:underline" onClick={() => { setSearch(''); setFilterAccess('ALL') }}>Clear Filters</button>
              </div>
            )}

          </div>
        </div>

        {/* Right Side: Summary */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="sticky top-6">
            <Card className="p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">Approval Summary</h3>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Total Workflows</span>
                  <span className="text-sm font-semibold text-slate-900">{MOCK_APPROVAL_WORKFLOWS.length}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                  <span className="text-sm text-green-600 font-medium">Access Enabled</span>
                  <span className="text-sm font-bold text-green-600">{summaryCounts.enabled}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Access Disabled</span>
                  <span className="text-sm font-semibold text-slate-600">{summaryCounts.disabled}</span>
                </div>
                
                {isSystemControlled && (
                  <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                    <span className="text-sm text-slate-500 italic">System Controlled</span>
                    <span className="text-sm text-slate-500">{summaryCounts.sysControlled}</span>
                  </div>
                )}
              </div>

              {hasUnsavedChanges && (
                <div className="mb-4 rounded-md bg-amber-50 p-3 border border-amber-200 flex items-start gap-2">
                  <span className="material-symbols-outlined text-amber-600 text-[18px]">warning</span>
                  <span className="text-sm text-amber-900 font-medium">Unsaved changes</span>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                <Button variant="primary" className="w-full justify-center" onClick={handleSave} disabled={!hasUnsavedChanges} loading={saving}>
                  Save Changes
                </Button>
                {hasUnsavedChanges && (
                  <Button variant="secondary" className="w-full justify-center" onClick={handleCancel}>
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
