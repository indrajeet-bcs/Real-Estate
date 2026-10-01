import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Input, Select, Toggle, Card } from '../../components/ui.jsx'
import { CRM_MODULES, MOCK_PAGES_TABS } from '../../lib/roleConstants.js'
import { useRoleWizard } from '../../components/roles/useRoleWizard.js'
import { useToast } from '../../context/ToastContext.jsx'

export default function PageTabAccessPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { role, roleData, moduleAccess, saveSlice } = useRoleWizard(id)

  // State
  const [selectedModuleId, setSelectedModuleId] = useState('')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  // Access State (Pages and Tabs)
  const [pageAccess, setPageAccess] = useState(new Set())
  const [tabAccess, setTabAccess] = useState(new Set())

  const [originalPageAccess, setOriginalPageAccess] = useState(new Set())
  const [originalTabAccess, setOriginalTabAccess] = useState(new Set())

  // UI State
  const [expandedPages, setExpandedPages] = useState(new Set())

  // Initialization from the persisted role designer.
  useEffect(() => {
    if (role) {
      const initialPages = new Set(role.designer?.pageAccess?.pages || [])
      const initialTabs = new Set(role.designer?.pageAccess?.tabs || [])
      setPageAccess(initialPages)
      setOriginalPageAccess(initialPages)
      setTabAccess(initialTabs)
      setOriginalTabAccess(initialTabs)
    }
  }, [role])

  // Get modules enabled for this role (from the real module-access map).
  const enabledModules = useMemo(() => {
    const enabledIds = Object.keys(moduleAccess)
    return CRM_MODULES.filter(m => enabledIds.includes(m.id))
  }, [moduleAccess])

  // Select first available module on load if none selected
  useEffect(() => {
    if (enabledModules.length > 0 && !selectedModuleId) {
      // Find a module that actually has configurable pages if possible
      const modWithPages = enabledModules.find(m => MOCK_PAGES_TABS[m.id])
      setSelectedModuleId(modWithPages ? modWithPages.id : enabledModules[0].id)
    }
  }, [enabledModules, selectedModuleId])

  const currentModule = useMemo(() => CRM_MODULES.find(m => m.id === selectedModuleId), [selectedModuleId])
  const modulePages = useMemo(() => MOCK_PAGES_TABS[selectedModuleId] || [], [selectedModuleId])

  // Check if current module is actually enabled for this role (in case they manually set it or dependencies broke it)
  const isModuleEnabled = useMemo(() => {
    if (!selectedModuleId) return false
    return !!moduleAccess[selectedModuleId]
  }, [roleData, selectedModuleId])

  const hasUnsavedChanges = pageAccess.size !== originalPageAccess.size || 
                            tabAccess.size !== originalTabAccess.size || 
                            [...pageAccess].some(p => !originalPageAccess.has(p)) ||
                            [...tabAccess].some(t => !originalTabAccess.has(t))

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
      if (!window.confirm("Discard unsaved changes?")) return
      setPageAccess(new Set(originalPageAccess))
      setTabAccess(new Set(originalTabAccess))
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveSlice({ pageAccess: { pages: [...pageAccess], tabs: [...tabAccess] } })
      toast.success('Page & tab access saved')
      setOriginalPageAccess(new Set(pageAccess))
      setOriginalTabAccess(new Set(tabAccess))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save')
    } finally { setSaving(false) }
  }

  // Filter based on search
  const filteredPages = useMemo(() => {
    if (!search) return modulePages
    const q = search.toLowerCase()
    
    return modulePages.filter(p => {
      const matchPage = p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      const matchTabs = p.tabs?.some(t => t.name.toLowerCase().includes(q))
      
      // If a tab matches, we should auto-expand this page
      if (matchTabs && !matchPage && !expandedPages.has(p.id)) {
        setExpandedPages(prev => new Set(prev).add(p.id))
      }
      
      return matchPage || matchTabs
    })
  }, [modulePages, search, expandedPages])

  const togglePageExpand = (pageId) => {
    const next = new Set(expandedPages)
    if (next.has(pageId)) next.delete(pageId)
    else next.add(pageId)
    setExpandedPages(next)
  }

  const togglePageAccess = (page, isEnabling) => {
    if (isSystemControlled || !isModuleEnabled) return

    const newPages = new Set(pageAccess)
    const newTabs = new Set(tabAccess)

    if (isEnabling) {
      newPages.add(page.id)
      // Auto-enable required tabs
      page.tabs?.forEach(t => {
        if (t.required) newTabs.add(t.id)
      })
    } else {
      newPages.delete(page.id)
      // Disabling a page inherently disables access to its tabs in the UX logic, 
      // but to be clean, we'll actually un-toggle them so there's no dirty/partial state if re-enabled.
      page.tabs?.forEach(t => newTabs.delete(t.id))
    }

    setPageAccess(newPages)
    setTabAccess(newTabs)
  }

  const toggleTabAccess = (tab, pageId, isEnabling) => {
    if (isSystemControlled || !isModuleEnabled || !pageAccess.has(pageId)) return
    if (tab.required && !isEnabling) return // Required tabs cannot be disabled if parent page is enabled

    const newTabs = new Set(tabAccess)
    if (isEnabling) newTabs.add(tab.id)
    else newTabs.delete(tab.id)
    setTabAccess(newTabs)
  }

  const handleSelectAll = () => {
    if (isSystemControlled || !isModuleEnabled) return
    const newPages = new Set(pageAccess)
    const newTabs = new Set(tabAccess)
    
    modulePages.forEach(p => {
      newPages.add(p.id)
      p.tabs?.forEach(t => {
        // By default, maybe we enable all tabs when "Select All" is clicked, or just required?
        // "Enabling a page should enable its required/default accessible tabs" - let's enable all to match expected UX for "Select All"
        newTabs.add(t.id)
      })
    })
    
    setPageAccess(newPages)
    setTabAccess(newTabs)
  }

  const handleClearAll = () => {
    if (isSystemControlled || !isModuleEnabled) return
    if (!window.confirm(`Disable access to all ${currentModule?.name} pages?`)) return
    
    const newPages = new Set(pageAccess)
    const newTabs = new Set(tabAccess)
    
    modulePages.forEach(p => {
      newPages.delete(p.id)
      p.tabs?.forEach(t => newTabs.delete(t.id))
    })
    
    setPageAccess(newPages)
    setTabAccess(newTabs)
  }

  const totalModuleTabs = modulePages.reduce((acc, p) => acc + (p.tabs?.length || 0), 0)
  const enabledModuleTabs = modulePages.reduce((acc, p) => acc + (p.tabs?.filter(t => tabAccess.has(t.id)).length || 0), 0)
  const enabledModulePages = modulePages.filter(p => pageAccess.has(p.id)).length

  if (!roleData) return <div className="p-8 text-center text-slate-500">Loading role context...</div>

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Context Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => { if (!hasUnsavedChanges || window.confirm("Discard unsaved changes?")) navigate(`/admin/roles/${id}/permissions`) }} className="-ml-3 mb-2">
          ← Back to Module Access
        </Button>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Page & Tab Access</h1>
            <p className="mt-1 text-sm text-slate-500">Control which pages and tabs this role can access.</p>
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
          <span className="border-blue-500 text-blue-600 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium">Page & Tab Access</span>
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

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Left Side: Configuration */}
        <div className="flex-1 min-w-0">
          
          <div className="mb-6 flex gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex-1">
              <Select label="Module" value={selectedModuleId} onChange={e => {
                if (hasUnsavedChanges && !window.confirm("Discard unsaved changes for current module?")) return
                setSelectedModuleId(e.target.value)
              }}>
                <option value="" disabled>Select a module...</option>
                {CRM_MODULES.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </Select>
            </div>
            <div className="flex-1">
              <Input 
                label="Search pages or tabs"
                icon="search" 
                placeholder="Search..." 
                value={search}
                onChange={e => setSearch(e.target.value)} 
              />
            </div>
          </div>

          {!isModuleEnabled && selectedModuleId ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
              <span className="material-symbols-outlined text-4xl text-red-400 mb-2">block</span>
              <h3 className="text-lg font-semibold text-red-900">Module Access is Disabled</h3>
              <p className="mt-1 text-sm text-red-700">You cannot configure pages or tabs because the <strong>{currentModule?.name}</strong> module is turned off for this role.</p>
              <Button variant="secondary" className="mt-4" onClick={() => navigate(`/admin/roles/${id}/permissions`)}>Manage Module Access</Button>
            </div>
          ) : modulePages.length === 0 ? (
            <div className="py-12 text-center border rounded-xl bg-white border-slate-200">
              <span className="material-symbols-outlined mb-2 text-4xl text-slate-300">article</span>
              <p className="text-slate-500 font-medium">No pages available</p>
              <p className="mt-1 text-sm text-slate-400">This module does not currently have configurable page access.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <span className="text-sm font-medium text-slate-700">Configuring Pages for {currentModule?.name}</span>
                {!isSystemControlled && (
                  <div className="flex gap-3">
                    <button className="text-xs font-medium text-blue-600 hover:text-blue-800" onClick={handleSelectAll}>Select All Pages</button>
                    <button className="text-xs font-medium text-slate-500 hover:text-slate-800" onClick={handleClearAll}>Clear All</button>
                  </div>
                )}
              </div>

              <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                {filteredPages.map(page => {
                  const isPageEnabled = pageAccess.has(page.id)
                  const hasTabs = page.tabs?.length > 0
                  const isExpanded = expandedPages.has(page.id)
                  const enabledTabsCount = page.tabs?.filter(t => tabAccess.has(t.id)).length || 0
                  const allTabsEnabled = enabledTabsCount === page.tabs?.length
                  const partialTabs = enabledTabsCount > 0 && !allTabsEnabled

                  return (
                    <div key={page.id} className="flex flex-col">
                      {/* Parent Page Row */}
                      <div className={`flex items-start justify-between p-4 transition ${isPageEnabled ? 'bg-white' : 'bg-slate-50'}`}>
                        <div className="flex items-start gap-3">
                          {hasTabs ? (
                            <button 
                              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                              onClick={() => togglePageExpand(page.id)}
                            >
                              <span className="material-symbols-outlined text-xl" style={{ transform: isExpanded ? 'none' : 'rotate(-90deg)' }}>expand_more</span>
                            </button>
                          ) : (
                            <div className="h-6 w-6 shrink-0" />
                          )}
                          
                          <div>
                            <h4 className={`text-sm font-semibold ${isPageEnabled ? 'text-slate-900' : 'text-slate-500'}`}>{page.name}</h4>
                            <p className="mt-0.5 text-xs text-slate-500">{page.description}</p>
                            
                            {hasTabs && (
                              <div className="mt-1.5 flex items-center gap-2">
                                <span className={`text-[11px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded ${isPageEnabled ? (partialTabs ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-700') : 'bg-slate-200 text-slate-500'}`}>
                                  Tabs: {enabledTabsCount} / {page.tabs.length} {partialTabs ? 'Partial' : 'Accessible'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="ml-4 shrink-0 flex flex-col items-end justify-center h-full pt-1">
                          {isSystemControlled ? (
                            <span className="text-xs font-medium text-slate-400">System</span>
                          ) : (
                            <Toggle 
                              checked={isPageEnabled} 
                              onChange={(val) => togglePageAccess(page, val)}
                              label={isPageEnabled ? 'ON' : 'OFF'}
                            />
                          )}
                        </div>
                      </div>

                      {/* Child Tabs List */}
                      {hasTabs && isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50/50 pl-14 pr-4 py-3 divide-y divide-slate-100/50">
                          {page.tabs.map(tab => {
                            const isTabEnabled = tabAccess.has(tab.id)
                            return (
                              <div key={tab.id} className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-2">
                                  <span className="material-symbols-outlined text-[16px] text-slate-300">tab</span>
                                  <span className={`text-sm ${isPageEnabled ? (isTabEnabled ? 'text-slate-800 font-medium' : 'text-slate-500') : 'text-slate-400'}`}>
                                    {tab.name}
                                  </span>
                                  {tab.required && (
                                    <span className="ml-2 rounded border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 uppercase tracking-wider">Required</span>
                                  )}
                                </div>
                                
                                <div className="shrink-0 flex items-center gap-3">
                                  {!isPageEnabled && <span className="text-xs text-red-500 italic">Page access required</span>}
                                  {isSystemControlled ? (
                                    <span className="text-xs font-medium text-slate-400">System</span>
                                  ) : (
                                    <Toggle 
                                      checked={isTabEnabled} 
                                      onChange={(val) => toggleTabAccess(tab, page.id, val)}
                                      disabled={!isPageEnabled || (tab.required && isTabEnabled)}
                                    />
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
                
                {filteredPages.length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-sm">
                    No pages or tabs found for "{search}"
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Summary Sidebar */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="sticky top-6">
            <Card className="p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">Module Summary</h3>
              
              <div className="mb-4">
                <span className="block text-xs text-slate-500 mb-1">Module</span>
                <span className="block text-sm font-bold text-slate-900">{currentModule?.name || 'None Selected'}</span>
                {!isModuleEnabled && selectedModuleId && (
                  <span className="inline-block mt-1 text-[11px] font-semibold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">Access Disabled</span>
                )}
              </div>

              {selectedModuleId && isModuleEnabled && (
                <>
                  <div className="flex items-center justify-between border-t border-slate-100 py-3">
                    <span className="text-sm text-slate-600">Pages Enabled</span>
                    <span className="text-lg font-bold text-blue-600">{enabledModulePages} <span className="text-sm font-normal text-slate-400">/ {modulePages.length}</span></span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 py-3 mb-2">
                    <span className="text-sm text-slate-600">Tabs Enabled</span>
                    <span className="text-lg font-bold text-blue-600">{enabledModuleTabs} <span className="text-sm font-normal text-slate-400">/ {totalModuleTabs}</span></span>
                  </div>
                </>
              )}

              {hasUnsavedChanges && (
                <div className="mb-4 rounded-md bg-amber-50 p-3 border border-amber-200 flex items-start gap-2">
                  <span className="material-symbols-outlined text-amber-600 text-[18px]">warning</span>
                  <span className="text-sm text-amber-900 font-medium">Unsaved changes</span>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 mt-2">
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
