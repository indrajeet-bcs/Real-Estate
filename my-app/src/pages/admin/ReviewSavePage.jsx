import { useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Card, Input, Select } from '../../components/ui.jsx'
import {
  CRM_MODULES,
  MOCK_ACTIONS, MOCK_ROLE_ACTION_ACCESS,
  DATA_SCOPE_OPTIONS, MOCK_ROLE_DATA_SCOPE
} from '../../lib/roleConstants.js'
import { rolesApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'

// Mapping existing backend categories to requested frontend display groups
const GROUP_MAPPING = {
  'Core CRM': 'CORE CRM',
  'Property & Sales': 'SALES & INVENTORY',
  'Finance & Operations': 'MARKETING & OPERATIONS',
  'Customer Lifecycle': 'POST-BOOKING',
  'Marketing & Analytics': 'ORGANIZATION',
  'Platform & Integrations': 'PLATFORM & INTEGRATIONS'
}

export default function ReviewSavePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const toast = useToast()
  const { data: role } = useFetch(useCallback(() => rolesApi.get(id), [id]))
  const { data: rolesList } = useFetch(useCallback(() => rolesApi.list(), []))
  const roleData = role ? { id: role._id, name: role.name, type: role.type === 'system' ? 'System Role' : 'Custom Role', status: role.status === 'active' ? 'Active' : 'Inactive' } : null
  const availableRoles = useMemo(() => (rolesList || []).map((r) => ({ id: r._id, name: r.name })), [rolesList])

  const [search, setSearch] = useState('')
  const [accessFilter, setAccessFilter] = useState('ALL')
  const [scopeFilter, setScopeFilter] = useState('ALL')
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())
  const [expandedRow, setExpandedRow] = useState(null)
  const [activating, setActivating] = useState(false)

  // Derived Access Data — module access is real (persisted); action/scope detail
  // still reads the static catalog for the granular display.
  const roleModuleAccess = role?.designer?.moduleAccess || {}
  const roleActionAccess = MOCK_ROLE_ACTION_ACCESS[roleData?.id] || []
  const roleDataScope = MOCK_ROLE_DATA_SCOPE[roleData?.id] || {}

  const activate = async () => {
    setActivating(true)
    try {
      await rolesApi.setStatus(id, 'active')
      toast.success('Role activated — permissions are now live')
      navigate(`/admin/roles/${id}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to activate')
    } finally { setActivating(false) }
  }

  // High-level KPI Stats
  const totalModules = CRM_MODULES.length
  let accessibleCount = 0
  let manageCount = 0
  let viewCount = 0
  let noAccessCount = 0

  CRM_MODULES.forEach(m => {
    const acc = roleModuleAccess[m.id] || 'none'
    if (acc === 'manage') { manageCount++; accessibleCount++; }
    else if (acc === 'view') { viewCount++; accessibleCount++; }
    else { noAccessCount++; }
  })

  // Filter Modules
  const filteredModules = useMemo(() => {
    let result = CRM_MODULES
    
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(m => m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q))
    }
    
    if (accessFilter !== 'ALL') {
      result = result.filter(m => (roleModuleAccess[m.id] || 'none') === accessFilter.toLowerCase())
    }

    if (scopeFilter !== 'ALL') {
      if (scopeFilter === 'NOT_APPLICABLE') {
        result = result.filter(m => {
          const acc = roleModuleAccess[m.id] || 'none'
          return acc === 'none' || !roleDataScope[m.id]
        })
      } else {
        result = result.filter(m => roleDataScope[m.id] === scopeFilter)
      }
    }
    
    return result
  }, [search, accessFilter, scopeFilter, roleModuleAccess, roleDataScope])

  // Group Modules
  const groupedModules = useMemo(() => {
    const groups = {}
    filteredModules.forEach(m => {
      const gName = GROUP_MAPPING[m.category] || m.category.toUpperCase()
      if (!groups[gName]) groups[gName] = []
      groups[gName].push(m)
    })
    return groups
  }, [filteredModules])

  const toggleGroup = (groupName) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupName)) next.delete(groupName)
      else next.add(groupName)
      return next
    })
  }

  const toggleRow = (modId) => {
    setExpandedRow(prev => prev === modId ? null : modId)
  }

  if (!roleData) return <div className="p-8 text-center text-slate-500">Loading role context...</div>

  const isSystemControlled = roleData.name === 'Company Owner' || roleData.name === 'SaaS Super Admin'

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 pb-32">
      {/* Role Selector */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm gap-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">Select Role</label>
          <select 
            className="block w-full sm:w-80 rounded-md border-0 py-2 pl-3 pr-8 text-sm font-medium text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:leading-6"
            value={roleData.id}
            onChange={(e) => navigate(`/admin/roles/${e.target.value}/permissions/review`)}
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
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Permission Review</h1>
          <p className="mt-1 text-sm text-slate-500">Review the complete module, action, and data access configured for each company role.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate(`/admin/roles/${id}/permissions`)}>Edit Permissions</Button>
          {roleData.status !== 'Active' && <Button variant="primary" onClick={activate} loading={activating}>Save &amp; Activate</Button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-slate-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto pb-1">
          <button onClick={() => navigate(`/admin/roles/${id}/permissions`)} className="border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium">Module Access</button>
          <button onClick={() => navigate(`/admin/roles/${id}/permissions/pages`)} className="border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium">Page & Tab Access</button>
          <button onClick={() => navigate(`/admin/roles/${id}/permissions/actions`)} className="border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium">Action Permissions</button>
          <button onClick={() => navigate(`/admin/roles/${id}/permissions/scope`)} className="border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium">Data Scope</button>
          <button onClick={() => navigate(`/admin/roles/${id}/permissions/approvals`)} className="border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium">Approval Permissions</button>
          <span className="border-blue-500 text-blue-600 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium">Permission Review</span>
        </nav>
      </div>

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4 flex flex-col justify-center bg-slate-50 border-slate-200 shadow-none">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Modules</span>
          <span className="text-2xl font-bold text-slate-900">{totalModules}</span>
        </Card>
        <Card className="p-4 flex flex-col justify-center bg-blue-50 border-blue-100 shadow-none">
          <span className="text-xs font-semibold uppercase tracking-wide text-blue-700">Accessible</span>
          <span className="text-2xl font-bold text-blue-900">{accessibleCount}</span>
        </Card>
        <Card className="p-4 flex flex-col justify-center bg-emerald-50 border-emerald-100 shadow-none">
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Manage Access</span>
          <span className="text-2xl font-bold text-emerald-900">{manageCount}</span>
        </Card>
        <Card className="p-4 flex flex-col justify-center bg-indigo-50 border-indigo-100 shadow-none">
          <span className="text-xs font-semibold uppercase tracking-wide text-indigo-700">View Access</span>
          <span className="text-2xl font-bold text-indigo-900">{viewCount}</span>
        </Card>
        <Card className="p-4 flex flex-col justify-center bg-red-50 border-red-100 shadow-none">
          <span className="text-xs font-semibold uppercase tracking-wide text-red-700">No Access</span>
          <span className="text-2xl font-bold text-red-900">{noAccessCount}</span>
        </Card>
      </div>

      {isSystemControlled && (
        <div className="mb-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 flex items-center gap-3">
          <span className="material-symbols-outlined text-slate-400">shield</span>
          <span className="text-sm font-medium text-slate-700">System Role: Permissions for this role are strictly managed by the platform and cannot be overridden.</span>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="flex-1 min-w-[200px]">
          <Input 
            icon="search" 
            placeholder="Search modules..." 
            value={search}
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
        <div className="w-full sm:w-48 shrink-0">
          <Select value={accessFilter} onChange={e => setAccessFilter(e.target.value)}>
            <option value="ALL">All Access Levels</option>
            <option value="MANAGE">Manage</option>
            <option value="VIEW">View</option>
            <option value="NONE">No Access</option>
          </Select>
        </div>
        <div className="w-full sm:w-48 shrink-0">
          <Select value={scopeFilter} onChange={e => setScopeFilter(e.target.value)}>
            <option value="ALL">All Scopes</option>
            <option value="COMPANY">Company</option>
            <option value="BRANCH">Branch</option>
            <option value="TEAM">Team</option>
            <option value="OWN">Own Records</option>
            <option value="NOT_APPLICABLE">Not Applicable</option>
          </Select>
        </div>
      </div>

      {/* Permission Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden overflow-x-auto">
        
        {/* Table Header */}
        <div className="hidden sm:grid grid-cols-12 gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 min-w-[800px]">
          <div className="col-span-3 text-xs font-bold uppercase tracking-wider text-slate-500">Module</div>
          <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-slate-500">Access</div>
          <div className="col-span-4 text-xs font-bold uppercase tracking-wider text-slate-500">Actions</div>
          <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-slate-500">Data Scope</div>
          <div className="col-span-1 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Details</div>
        </div>

        {/* Groups */}
        {Object.entries(groupedModules).length > 0 ? Object.entries(groupedModules).map(([groupName, modules]) => (
          <div key={groupName} className="min-w-[800px]">
            {/* Group Header */}
            <div 
              className="flex items-center justify-between bg-slate-100/50 px-5 py-2 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => toggleGroup(groupName)}
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">{groupName} <span className="text-slate-400 font-normal ml-1">({modules.length})</span></h3>
              <span className="material-symbols-outlined text-slate-400 text-sm">{collapsedGroups.has(groupName) ? 'expand_more' : 'expand_less'}</span>
            </div>

            {/* Group Rows */}
            {!collapsedGroups.has(groupName) && (
              <div className="divide-y divide-slate-100">
                {modules.map(mod => {
                  const accessLvl = roleModuleAccess[mod.id] || 'none'
                  const isNoAccess = accessLvl === 'none'
                  
                  const availableActions = MOCK_ACTIONS[mod.id] || []
                  const enabledActionNames = availableActions.filter(a => roleActionAccess.includes(a.id)).map(a => a.name)
                  const actionsStr = isNoAccess ? '—' : (enabledActionNames.length > 0 ? enabledActionNames.join(', ') : '—')

                  const scopeVal = roleDataScope[mod.id]
                  const scopeObj = DATA_SCOPE_OPTIONS.find(o => o.value === scopeVal)
                  const scopeStr = isNoAccess ? '—' : (scopeObj?.label || 'Not Applicable')

                  const isExpanded = expandedRow === mod.id

                  return (
                    <div key={mod.id}>
                      {/* Main Row */}
                      <div className={`grid grid-cols-12 gap-4 px-5 py-4 items-center transition-colors ${isNoAccess ? 'bg-slate-50/30' : 'hover:bg-slate-50'}`}>
                        <div className="col-span-3 flex items-center gap-3">
                          <span className={`material-symbols-outlined text-lg ${isNoAccess ? 'text-slate-300' : 'text-slate-400'}`}>{mod.icon}</span>
                          <span className={`text-sm font-semibold ${isNoAccess ? 'text-slate-400' : 'text-slate-900'}`}>{mod.name}</span>
                        </div>
                        
                        <div className="col-span-2">
                          <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                            accessLvl === 'manage' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            accessLvl === 'view' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                            'bg-slate-100 text-slate-400 border border-slate-200'
                          }`}>
                            {accessLvl === 'manage' ? 'Manage' : accessLvl === 'view' ? 'View' : 'No Access'}
                          </span>
                        </div>
                        
                        <div className="col-span-4">
                          <span className={`text-sm ${isNoAccess ? 'text-slate-300' : 'text-slate-600'} truncate block pr-4`} title={actionsStr}>
                            {actionsStr}
                          </span>
                        </div>
                        
                        <div className="col-span-2">
                          <span className={`text-sm font-medium ${isNoAccess ? 'text-slate-300' : 'text-slate-700'}`}>
                            {scopeStr}
                          </span>
                        </div>
                        
                        <div className="col-span-1 text-right">
                          {!isNoAccess && (
                            <button 
                              onClick={() => toggleRow(mod.id)}
                              className="p-1 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors focus:outline-none"
                              aria-label="Expand details"
                            >
                              <span className="material-symbols-outlined text-xl">{isExpanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && !isNoAccess && (
                        <div className="bg-slate-50 border-t border-slate-100 px-5 py-4 shadow-inner">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pl-9">
                            
                            {/* Detailed Actions */}
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Action Permissions</h4>
                              {availableActions.length > 0 ? (
                                <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                                  {availableActions.map(act => {
                                    const isEnabled = roleActionAccess.includes(act.id)
                                    return (
                                      <div key={act.id} className="flex items-center gap-2">
                                        {isEnabled ? (
                                          <span className="material-symbols-outlined text-sm text-emerald-600 font-bold">check</span>
                                        ) : (
                                          <span className="material-symbols-outlined text-sm text-slate-300">close</span>
                                        )}
                                        <span className={`text-sm ${isEnabled ? 'text-slate-900 font-medium' : 'text-slate-400 line-through'}`}>{act.name}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              ) : (
                                <p className="text-sm text-slate-400 italic">No specific actions available for this module.</p>
                              )}
                            </div>

                            {/* Detailed Data Scope */}
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Data Scope Definition</h4>
                              {scopeObj ? (
                                <div className="rounded-lg border border-blue-100 bg-white p-3 shadow-sm">
                                  <div className="text-sm font-bold text-blue-900 mb-1">{scopeObj.label}</div>
                                  <div className="text-sm text-blue-700/80">{scopeObj.description}</div>
                                </div>
                              ) : (
                                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm text-slate-500 text-sm italic">
                                  Data scope is not applicable for this module.
                                </div>
                              )}
                            </div>

                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )) : (
          <div className="py-16 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-3">search_off</span>
            <p className="text-slate-500 font-medium">No modules match your current filters.</p>
            <button className="mt-2 text-sm text-blue-600 hover:underline" onClick={() => { setSearch(''); setAccessFilter('ALL'); setScopeFilter('ALL') }}>Clear Filters</button>
          </div>
        )}
      </div>

    </div>
  )
}
