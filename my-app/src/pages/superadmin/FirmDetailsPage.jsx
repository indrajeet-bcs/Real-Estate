import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { firmsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate } from '../../lib/format.js'
import { PageHeader, Button, Card, Loader, ErrorState, Modal, Input } from '../../components/ui.jsx'

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
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
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
    <div className="w-full max-w-xs">
      <div className="flex justify-between text-xs font-medium text-slate-600 mb-1.5">
        <span>{used || 0} GB Used</span>
        <span>{limit === -1 ? 'Unlimited' : `${limit || 0} GB Total`}</span>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${limit === -1 ? 0 : pct}%` }} />
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <Card className="overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="p-5">
        {children}
      </div>
    </Card>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1">{label}</div>
      <div className="text-sm font-medium text-slate-800">{value || '—'}</div>
    </div>
  )
}

export default function FirmDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const [actionModal, setActionModal] = useState(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [editForm, setEditForm] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data, loading, error, refetch } = useFetch(
    useCallback(() => firmsApi.get(id), [id])
  )

  const performAction = async (type) => {
    try {
      if (type === 'suspend') {
        await firmsApi.setStatus(id, 'suspended', suspendReason)
        toast.success('Company suspended')
      } else if (type === 'activate') {
        await firmsApi.setStatus(id, 'active')
        toast.success('Company activated')
      }
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed')
    } finally {
      setActionModal(null)
      setSuspendReason('')
      setIsSubmitting(false)
    }
  }

  const handleEditSave = async () => {
    setIsSubmitting(true)
    try {
      await firmsApi.update(id, editForm)
      toast.success('Company updated successfully')
      refetch()
      setActionModal(null)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const openEdit = () => {
    setEditForm({
      name: firm.name || '',
      contactEmail: firm.contactEmail || '',
      contactPhone: firm.contactPhone || '',
      region: firm.region || '',
    })
    setActionModal('edit')
  }

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (!data?.firm) return <ErrorState message="Company not found" />

  const { firm, admin, stats, activities } = data
  const isSuspended = firm.status === 'suspended'

  return (
    <div className="space-y-6 max-w-6xl">
      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-xl font-bold text-slate-500 uppercase shadow-sm hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer"
            onClick={() => setActionModal('logo')}
          >
            {firm.name.substring(0,2)}
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-slate-900">{firm.name}</h1>
              <StatusBadge status={firm.status} type="Company" />
              <StatusBadge status={firm.subscriptionStatus} type="Subscription" />
            </div>
            <p className="text-sm font-mono text-slate-500">ID: {firm.companyId || firm._id.substring(firm._id.length-6)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>
          <Button variant="secondary" onClick={openEdit}>Edit Company</Button>
          {isSuspended ? (
            <Button variant="success" onClick={() => setActionModal('activate')}>Activate Company</Button>
          ) : (
            <Button variant="danger" onClick={() => setActionModal('suspend')}>Suspend Company</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Section 1: Company Information */}
          <Section title="Company Information">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-4">
              <Field label="Company Name" value={firm.name} />
              <Field label="Company ID" value={firm.companyId || firm._id.substring(firm._id.length-6)} />
              <Field label="Company Email" value={firm.contactEmail} />
              <Field label="Mobile Number" value={firm.contactPhone} />
              <Field label="Business Address" value={firm.region || '—'} />
              <Field label="City" value={firm.branches?.[0] || '—'} />
              <Field label="State" value="—" />
              <Field label="Country" value="India" />
              <Field label="Company Website" value="—" />
              <Field label="Created Date" value={formatDate(firm.createdAt)} />
              <Field label="Last Updated" value={formatDate(firm.updatedAt)} />
            </div>
          </Section>

          {/* Section 2: Subscription Information */}
          <Section title="Subscription Information">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-4">
              <div className="cursor-pointer group" onClick={() => navigate('/super-admin/billing/plans')}>
                <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1 group-hover:text-blue-500 transition-colors">Current Subscription Plan</div>
                <div className="text-sm font-medium text-slate-800 capitalize group-hover:text-blue-600 transition-colors">{firm.plan || 'Standard'} <span className="text-xs text-blue-500 ml-1">↗</span></div>
              </div>
              <Field label="Billing Cycle" value={<span className="capitalize">{firm.billingCycle || 'Monthly'}</span>} />
              <Field label="Subscription Status" value={<StatusBadge status={firm.subscriptionStatus} type="Subscription" />} />
              <Field label="Subscription Start Date" value={formatDate(firm.createdAt)} />
              <Field label="Renewal Date" value="—" />
              <Field label="Trial End Date" value={firm.subscriptionStatus === 'trial' ? '—' : 'N/A'} />
            </div>
          </Section>

          {/* Section 3: Company Admin */}
          <Section title="Company Admin">
            {admin ? (
              <div className="flex items-center justify-between">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                  <Field label="Admin Name" value={admin.name} />
                  <Field label="Admin Email" value={admin.email} />
                  <Field label="Mobile Number" value={admin.phone} />
                  <Field label="Last Login" value={admin.lastLoginAt ? formatDate(admin.lastLoginAt) : 'Never logged in'} />
                </div>
                <Button size="sm" variant="secondary" className="ml-4" onClick={() => setActionModal('adminProfile')}>View Profile</Button>
              </div>
            ) : (
              <div className="text-sm text-slate-500 italic">No admin assigned to this company.</div>
            )}
          </Section>

          {/* Section 4: Usage Summary */}
          <Section title="Usage Summary">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div 
                className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100 cursor-pointer hover:border-blue-300 transition-colors"
                onClick={() => setActionModal('users')}
              >
                <div className="text-xl font-bold text-blue-600">{stats?.users || 0} / {firm.allowedUsers === -1 ? '∞' : (firm.allowedUsers || 25)}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mt-1">Users <span className="text-blue-500">↗</span></div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                <div className="text-xl font-bold text-slate-800">{stats?.projects || 0}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mt-1">Projects</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                <div className="text-xl font-bold text-slate-800">{stats?.leads || 0}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mt-1">Leads</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                <div className="text-xl font-bold text-slate-800">{stats?.customers || 0}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mt-1">Customers</div>
              </div>
            </div>
            
            <div 
              className="bg-white border border-slate-200 rounded-lg p-4 cursor-pointer hover:border-blue-300 transition-colors"
              onClick={() => setActionModal('storage')}
            >
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-3 flex justify-between">
                <span>Storage Usage</span>
                <span className="text-blue-500 text-xs">View Details ↗</span>
              </div>
              <StorageBar used={firm.storageUsed} limit={firm.storageLimit} />
            </div>
          </Section>

        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">

          {/* Quick Actions Card */}
          <Card className="p-4 space-y-2 bg-slate-50/50">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Quick Actions</h3>
            <Button className="w-full justify-start" variant="secondary" onClick={openEdit}>✏️ Edit Company</Button>
            {isSuspended ? (
              <Button className="w-full justify-start" variant="success" onClick={() => setActionModal('activate')}>✅ Activate Company</Button>
            ) : (
              <Button className="w-full justify-start text-rose-600 hover:text-rose-700 hover:bg-rose-50" variant="secondary" onClick={() => setActionModal('suspend')}>🚫 Suspend Company</Button>
            )}
            <Button className="w-full justify-start" variant="secondary" onClick={() => navigate(`/super-admin/billing/records?search=${firm.name}`)}>💳 View Billing</Button>
            <Button className="w-full justify-start" variant="secondary" onClick={() => navigate(-1)}>🔙 Back to Company List</Button>
          </Card>
          
          {/* Section 5: Company Status */}
          <Section title="Status Overview">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-600">Company Status</span>
                <StatusBadge status={firm.status} type="Company" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-600">Subscription Status</span>
                <StatusBadge status={firm.subscriptionStatus} type="Subscription" />
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <span className="text-sm font-medium text-slate-600">Created On</span>
                <span className="text-sm text-slate-800">{formatDate(firm.createdAt)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-600">Last Activity</span>
                <span className="text-sm text-slate-800">{activities?.[0] ? formatDate(activities[0].createdAt) : '—'}</span>
              </div>
            </div>
          </Section>

          {/* Section 7: Billing Summary */}
          <Section title="Billing Summary">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-600">Current Plan</span>
                <span className="text-sm font-bold text-slate-800 capitalize">{firm.plan || 'Standard'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-600">Billing Cycle</span>
                <span className="text-sm text-slate-800 capitalize">{firm.billingCycle || 'Monthly'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-600">Payment Status</span>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Paid</span>
              </div>
              <Button className="w-full mt-2" variant="secondary" onClick={() => navigate(`/super-admin/billing/records?search=${firm.name}`)}>View Billing Details</Button>
            </div>
          </Section>

          {/* Section 6: Recent Activities */}
          <Section title="Recent Activities">
            {activities && activities.length > 0 ? (
              <>
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent pl-6 md:pl-0">
                {activities.map((act, i) => (
                  <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-4 h-4 rounded-full border border-white bg-slate-300 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 absolute left-0 -ml-2 md:left-1/2 md:ml-0" />
                    <div className="w-[calc(100%-1rem)] md:w-[calc(50%-1rem)] p-2 rounded border border-slate-100 bg-white shadow-sm">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="font-semibold text-slate-800 text-xs">{act.action}</div>
                        <time className="text-[10px] text-slate-400 font-mono">{formatDate(act.createdAt)}</time>
                      </div>
                      <div className="text-xs text-slate-600 leading-tight">{act.description}</div>
                    </div>
                  </div>
                ))}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-center">
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/super-admin/audit?search=${firm.name}`)}>View All Activities ↗</Button>
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-500 italic text-center py-4">No recent activities found.</div>
            )}
          </Section>

        </div>
      </div>

      {/* MODALS */}
      {actionModal === 'suspend' && (
        <Modal 
          open 
          title="Suspend Company" 
          onClose={() => setActionModal(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setActionModal(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => performAction('suspend')}>Suspend</Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Suspending <strong>{firm.name}</strong> will immediately prevent all users from accessing the platform.
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

      {actionModal === 'activate' && (
        <Modal 
          open 
          title="Activate Company" 
          onClose={() => setActionModal(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setActionModal(null)}>Cancel</Button>
              <Button variant="success" onClick={() => performAction('activate')}>Activate Company</Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to activate <strong>{firm.name}</strong>? Users will immediately regain access to the platform.
            </p>
          </div>
        </Modal>
      )}

      {actionModal === 'edit' && (
        <Modal 
          open 
          title="Edit Company" 
          onClose={() => setActionModal(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setActionModal(null)}>Cancel</Button>
              <Button variant="primary" disabled={isSubmitting} onClick={handleEditSave}>Save Changes</Button>
            </>
          }
        >
          <div className="space-y-4">
            <Input 
              label="Company Name" 
              value={editForm.name}
              onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
            />
            <Input 
              label="Contact Email" 
              value={editForm.contactEmail}
              onChange={(e) => setEditForm(prev => ({ ...prev, contactEmail: e.target.value }))}
            />
            <Input 
              label="Contact Phone" 
              value={editForm.contactPhone}
              onChange={(e) => setEditForm(prev => ({ ...prev, contactPhone: e.target.value }))}
            />
            <Input 
              label="Business Address (Region)" 
              value={editForm.region}
              onChange={(e) => setEditForm(prev => ({ ...prev, region: e.target.value }))}
            />
          </div>
        </Modal>
      )}

      {actionModal === 'adminProfile' && admin && (
        <Modal 
          open 
          title="Admin Profile" 
          onClose={() => setActionModal(null)}
          footer={<Button variant="ghost" onClick={() => setActionModal(null)}>Close</Button>}
        >
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-2xl font-bold text-slate-500 shadow-sm mb-3">
              {admin.name.substring(0,2).toUpperCase()}
            </div>
            <h3 className="text-lg font-semibold text-slate-900">{admin.name}</h3>
            <p className="text-sm text-slate-500 uppercase tracking-wider">{admin.role}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Email" value={admin.email} />
            <Field label="Mobile" value={admin.phone} />
            <Field label="Status" value={admin.isActive ? 'Active' : 'Inactive'} />
            <Field label="Last Login" value={admin.lastLoginAt ? formatDate(admin.lastLoginAt) : 'Never'} />
          </div>
        </Modal>
      )}

      {actionModal === 'logo' && (
        <Modal open title="Company Logo" onClose={() => setActionModal(null)}>
          <div className="flex flex-col items-center justify-center py-10">
            <div className="w-32 h-32 rounded-xl bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-4xl font-bold text-slate-500 uppercase shadow-md mb-4">
              {firm.name.substring(0,2)}
            </div>
            <p className="text-sm text-slate-500">Logo preview for {firm.name}</p>
          </div>
        </Modal>
      )}

      {actionModal === 'storage' && (
        <Modal open title="Storage Details" onClose={() => setActionModal(null)}>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Total Storage Limit" value={firm.storageLimit === -1 ? 'Unlimited' : `${firm.storageLimit} GB`} />
              <Field label="Used Storage" value={`${firm.storageUsed || 0} GB`} />
              <Field label="Available Storage" value={firm.storageLimit === -1 ? 'Unlimited' : `${Math.max(0, firm.storageLimit - (firm.storageUsed || 0))} GB`} />
              <Field label="Usage Percentage" value={firm.storageLimit === -1 ? '0%' : `${Math.min(100, Math.round(((firm.storageUsed || 0) / (firm.storageLimit || 1)) * 100))}%`} />
            </div>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <StorageBar used={firm.storageUsed} limit={firm.storageLimit} />
            </div>
          </div>
        </Modal>
      )}

      {actionModal === 'users' && (
        <Modal 
          open 
          title="User Summary" 
          onClose={() => setActionModal(null)}
          footer={<Button variant="ghost" onClick={() => setActionModal(null)}>Close</Button>}
        >
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Total Users" value={stats?.users || 0} />
              <Field label="User Limit" value={firm.allowedUsers === -1 ? 'Unlimited' : firm.allowedUsers} />
              <Field label="Active Users" value={stats?.users || 0} />
              <Field label="Inactive Users" value="0" />
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mb-1">
              <div 
                className="bg-blue-500 h-2 rounded-full" 
                style={{ width: `${firm.allowedUsers === -1 ? 0 : Math.min(100, Math.round(((stats?.users || 0) / (firm.allowedUsers || 1)) * 100))}%` }} 
              />
            </div>
          </div>
        </Modal>
      )}

    </div>
  )
}
