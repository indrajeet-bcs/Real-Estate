import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { firmsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useDebounce } from '../../hooks/useDebounce.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate } from '../../lib/format.js'
import { PageHeader, Button, Input, Select, Pagination, Modal, Loader, ErrorState, Card } from '../../components/ui.jsx'
import AddCompanyWizard from './AddCompanyWizard.jsx'

function StatusBadge({ status, type }) {
  const colors = {
    Company: {
      active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      trial: 'bg-amber-50 text-amber-700 border-amber-200',
      suspended: 'bg-rose-50 text-rose-700 border-rose-200',
      deleted: 'bg-slate-100 text-slate-600 border-slate-200',
    },
    Subscription: {
      active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      trial: 'bg-amber-50 text-amber-700 border-amber-200',
      expired: 'bg-rose-50 text-rose-700 border-rose-200',
      cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
    }
  }
  const cls = colors[type]?.[status] || 'bg-slate-100 text-slate-600 border-slate-200'
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {status || 'Unknown'}
    </span>
  )
}

function StorageBar({ used, limit }) {
  const pct = Math.min(100, Math.round(((used || 0) / (limit || 1)) * 100))
  const isDanger = pct > 90
  const isWarning = pct > 75 && pct <= 90
  const color = isDanger ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-blue-500'

  return (
    <div className="w-24">
      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
        <span>{used || 0} GB</span>
        <span>{limit === -1 ? 'Unlimited' : `${limit || 0} GB`}</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${limit === -1 ? 0 : pct}%` }} />
      </div>
    </div>
  )
}

export default function FirmsPage() {
  const toast = useToast()
  const navigate = useNavigate()
  
  // States
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounce(searchInput)
  
  // Filters
  const [filters, setFilters] = useState({
    plan: '',
    status: 'all',
    subscriptionStatus: 'all',
    billingCycle: 'all'
  })

  // Modals
  const [showOnboard, setShowOnboard] = useState(false)
  const [actionModal, setActionModal] = useState(null) // { type: 'suspend'|'delete', firm: obj }
  const [suspendReason, setSuspendReason] = useState('')
  const [permanentDelete, setPermanentDelete] = useState(false)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState(new Set())

  // Data Fetch
  const fetchFn = useCallback(() => {
    return firmsApi.list({
      page,
      limit,
      search,
      ...filters
    })
  }, [page, limit, search, filters])

  const { data, meta, loading, error, refetch } = useFetch(fetchFn)

  const kpis = meta?.kpis || {}
  const firms = data || []

  // --- Actions ---
  
  const handleFilterChange = (k, v) => {
    setPage(1)
    setFilters(prev => ({ ...prev, [k]: v }))
  }

  const toggleSelection = (id) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const toggleAll = () => {
    if (selectedIds.size === firms.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(firms.map(f => f._id)))
    }
  }

  const performAction = async (type, firmId, reason = '', permanent = false) => {
    try {
      if (type === 'suspend') {
        await firmsApi.setStatus(firmId, 'suspended', reason)
        toast.success('Company suspended')
      } else if (type === 'activate') {
        await firmsApi.setStatus(firmId, 'active')
        toast.success('Company activated')
      } else if (type === 'delete') {
        await firmsApi.remove(firmId, permanent)
        toast.success(permanent ? 'Company permanently deleted' : 'Company moved to Deleted')
      }
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed')
    } finally {
      setActionModal(null)
      setSuspendReason('')
      setPermanentDelete(false)
    }
  }

  const restoreFirm = async (firm) => {
    try {
      await firmsApi.restore(firm._id)
      toast.success(`${firm.name} restored`)
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Restore failed')
    }
  }

  const BULK_LABELS = { activate: 'activated', suspend: 'suspended', export: 'exported', assign_plan: 'plan assigned', restore: 'restored', delete_permanent: 'permanently deleted' }

  const performBulkAction = async (action) => {
    const count = selectedIds.size
    try {
      await firmsApi.bulk({ action, firmIds: Array.from(selectedIds) })
      toast.success(`${count} ${count === 1 ? 'company' : 'companies'} ${BULK_LABELS[action] || action}`)
      setSelectedIds(new Set())
      setBulkDeleteConfirm(false)
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk action failed')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Management"
        subtitle="Manage all tenant companies registered on the platform."
        actions={<Button onClick={() => setShowOnboard(true)}>+ Add Company</Button>}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Companies', val: kpis.totalCompanies },
          { label: 'Active Companies', val: kpis.activeCompanies },
          { label: 'Trial Companies', val: kpis.trialCompanies },
          { label: 'Suspended Companies', val: kpis.suspendedCompanies },
          { label: 'Expired Subscriptions', val: kpis.expiredSubscriptions },
          { label: 'Total Revenue', val: `₹${(kpis.totalSubscriptionRevenue || 0).toLocaleString()}` }
        ].map(k => (
          <Card key={k.label} className="p-4 text-center">
            <div className="text-xl font-bold text-slate-800">{k.val ?? '-'}</div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 mt-1">{k.label}</div>
          </Card>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3 items-end bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex-1 min-w-[200px]">
          <Input 
            placeholder="Search by name, ID, admin email..." 
            value={searchInput} 
            onChange={(e) => { setPage(1); setSearchInput(e.target.value) }} 
          />
        </div>
        <div className="w-40">
          <Select value={filters.plan} onChange={(e) => handleFilterChange('plan', e.target.value)}>
            <option value="">All Plans</option>
            <option value="standard">Standard</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
          </Select>
        </div>
        <div className="w-40">
          <Select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)}>
            <option value="all">All Company Status</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="suspended">Suspended</option>
            <option value="deleted">Deleted</option>
          </Select>
        </div>
        <div className="w-40">
          <Select value={filters.subscriptionStatus} onChange={(e) => handleFilterChange('subscriptionStatus', e.target.value)}>
            <option value="all">All Subs Status</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </div>
        <div className="w-32">
          <Select value={filters.billingCycle} onChange={(e) => handleFilterChange('billingCycle', e.target.value)}>
            <option value="all">All Billing</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </Select>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedIds.size > 0 && (
        <div className={`flex items-center gap-4 border p-3 rounded-xl animate-in fade-in slide-in-from-top-2 ${filters.status === 'deleted' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
          <span className={`text-sm font-medium ${filters.status === 'deleted' ? 'text-red-800' : 'text-blue-800'}`}>{selectedIds.size} companies selected</span>
          <div className="flex gap-2">
            {filters.status === 'deleted' ? (
              <>
                <Button size="sm" variant="secondary" className="bg-white text-emerald-700 border-emerald-300" onClick={() => performBulkAction('restore')}>Restore</Button>
                <Button size="sm" variant="danger" onClick={() => setBulkDeleteConfirm(true)}>Delete Forever</Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="secondary" className="bg-white" onClick={() => performBulkAction('activate')}>Activate</Button>
                <Button size="sm" variant="danger" className="bg-white" onClick={() => performBulkAction('suspend')}>Suspend</Button>
                <Button size="sm" variant="secondary" className="bg-white text-slate-700" onClick={() => performBulkAction('export')}>Export</Button>
                <Button size="sm" variant="secondary" className="bg-white" onClick={() => performBulkAction('assign_plan')}>Assign Subscription</Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Data Table */}
      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold tracking-wide">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={firms.length > 0 && selectedIds.size === firms.length}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Plan & Billing</th>
                  <th className="px-4 py-3">Statuses</th>
                  <th className="px-4 py-3">Storage</th>
                  <th className="px-4 py-3">Users</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {firms.length === 0 ? (
                  <tr>
                    <td colSpan="9">
                      <div className="flex flex-col items-center justify-center py-16">
                        <div className="text-4xl mb-3">🏢</div>
                        <div className="text-slate-500 text-sm mb-4">No companies found.</div>
                        <Button onClick={() => setShowOnboard(true)}>Add Company</Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  firms.map(f => (
                    <tr key={f._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={selectedIds.has(f._id)}
                          onChange={() => toggleSelection(f._id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 uppercase">
                            {f.name.substring(0,2)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{f.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{f.companyId || f._id.substring(f._id.length-6)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {f.admin ? (
                          <div>
                            <div className="font-medium text-slate-700">{f.admin.name}</div>
                            <div className="text-xs text-slate-500">{f.admin.email}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">No admin assigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 capitalize">{f.plan || 'Standard'}</div>
                        <div className="text-xs text-slate-500 capitalize">{f.billingCycle || 'Monthly'}</div>
                      </td>
                      <td className="px-4 py-3 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-10 text-[10px] text-slate-400">Co:</span>
                          <StatusBadge status={f.status} type="Company" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-10 text-[10px] text-slate-400">Sub:</span>
                          <StatusBadge status={f.subscriptionStatus} type="Subscription" />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StorageBar used={f.storageUsed} limit={f.storageLimit} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-slate-700">
                          {f.currentUsers || 0} <span className="text-slate-400 font-normal">/ {f.allowedUsers === -1 ? 'Unlimited' : (f.allowedUsers || 25)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatDate(f.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="secondary" onClick={() => navigate(`/super-admin/firms/${f._id}`)}>View</Button>
                          {f.isDeleted || f.status === 'deleted' ? (
                            <>
                              <Button size="sm" variant="success" onClick={() => restoreFirm(f)}>Restore</Button>
                              <Button size="sm" variant="danger" onClick={() => { setPermanentDelete(true); setActionModal({ type: 'delete', firm: f }) }}>Delete Forever</Button>
                            </>
                          ) : (
                            <>
                              {f.status === 'suspended' ? (
                                <Button size="sm" variant="success" onClick={() => performAction('activate', f._id)}>Activate</Button>
                              ) : (
                                <Button size="sm" variant="secondary" onClick={() => setActionModal({ type: 'suspend', firm: f })}>Suspend</Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => setActionModal({ type: 'delete', firm: f })}>🗑️</Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 border-t border-slate-200">
             <Pagination meta={meta} onPage={setPage} onPageSize={(n) => { setLimit(n); setPage(1) }} />
          </div>
        </div>
      )}

      {/* --- Modals --- */}
      
      {showOnboard && (
        <AddCompanyWizard 
          onClose={() => setShowOnboard(false)} 
          onDone={() => { setShowOnboard(false); refetch() }} 
        />
      )}

      {actionModal?.type === 'suspend' && (
        <Modal 
          open 
          title="Suspend Company" 
          onClose={() => setActionModal(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setActionModal(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => performAction('suspend', actionModal.firm._id, suspendReason)}>Suspend</Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Suspending <strong>{actionModal.firm.name}</strong> will immediately prevent all users from accessing the platform.
            </p>
            <Input 
              label="Reason" 
              placeholder="e.g. Non-payment, violation of TOS" 
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
            />
          </div>
        </Modal>
      )}

      {actionModal?.type === 'delete' && (
        <Modal
          open
          title={permanentDelete ? 'Permanently Delete Company' : 'Delete Company'}
          onClose={() => { setActionModal(null); setPermanentDelete(false) }}
          footer={
            <>
              <Button variant="ghost" onClick={() => { setActionModal(null); setPermanentDelete(false) }}>Cancel</Button>
              <Button variant="danger" onClick={() => performAction('delete', actionModal.firm._id, '', permanentDelete)}>
                {permanentDelete ? 'Permanently Delete' : 'Delete'}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {permanentDelete ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                <strong>This cannot be undone.</strong> <strong>{actionModal.firm.name}</strong> and <strong>all of its data</strong> — users, leads, projects, units, bookings, invoices, attendance, and everything else — will be permanently removed from the database.
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                This soft-deletes <strong>{actionModal.firm.name}</strong>. The company and its data are kept and can be restored later (filter by <em>Deleted</em> → Activate).
              </p>
            )}
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3">
              <input type="checkbox" className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500" checked={permanentDelete} onChange={(e) => setPermanentDelete(e.target.checked)} />
              <span className="text-sm text-slate-700">Permanently delete instead — remove the company and all its data from the database (irreversible).</span>
            </label>
          </div>
        </Modal>
      )}

      {bulkDeleteConfirm && (
        <Modal
          open
          title={`Permanently delete ${selectedIds.size} ${selectedIds.size === 1 ? 'company' : 'companies'}?`}
          onClose={() => setBulkDeleteConfirm(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setBulkDeleteConfirm(false)}>Cancel</Button>
              <Button variant="danger" onClick={() => performBulkAction('delete_permanent')}>
                Delete {selectedIds.size} Forever
              </Button>
            </>
          }
        >
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <strong>This cannot be undone.</strong> All {selectedIds.size} selected companies and <strong>all of their data</strong> — users, leads, projects, units, bookings, invoices, attendance, and everything else — will be permanently removed from the database.
          </div>
        </Modal>
      )}

    </div>
  )
}


