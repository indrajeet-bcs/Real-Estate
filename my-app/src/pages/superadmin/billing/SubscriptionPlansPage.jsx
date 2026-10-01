import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Button, Input, Select, Modal, Loader, ErrorState } from '../../../components/ui.jsx'
import { formatDate } from '../../../lib/format.js'
import { billingApi } from '../../../api/resources.js'
import { useFetch } from '../../../hooks/useFetch.js'
import { useToast } from '../../../context/ToastContext.jsx'

const EMPTY_PLAN = {
  name: '', description: '', monthlyPrice: '', yearlyPrice: '',
  trialDays: 0, status: 'active', color: '#3b82f6', icon: '◈', displayOrder: '',
  features: {
    maxEmployees: 10, maxProjects: 5, maxLeads: 100, maxStorage: 5,
    attendance: false, reports: false, analytics: false, mobile: false,
    whatsapp: false, api: false, prioritySupport: false, customBranding: false,
    whiteLabel: false, customDomain: false, backupFrequency: 'weekly',
  },
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cls = status === 'active'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-slate-100 text-slate-500 border-slate-200'
  return <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${cls}`}>{status === 'active' ? 'Active' : 'Inactive'}</span>
}

// ─── Feature Toggle Row ───────────────────────────────────────────────────────

function Toggle({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}

// ─── Archive Confirmation Dialog ──────────────────────────────────────────────

function ArchiveDialog({ plan, onClose, onViewSubscribers, onChangePlan }) {
  return (
    <Modal open onClose={onClose} title="Plan Is Currently In Use" footer={
      <>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="secondary" size="sm" onClick={onViewSubscribers}>View Subscribers</Button>
        <Button size="sm" onClick={onChangePlan}>Change Subscribers Plan</Button>
      </>
    }>
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-4">
          <span className="text-xl">⚠️</span>
          <div>
            <div className="font-semibold text-amber-900">Cannot archive "{plan.name}"</div>
            <div className="mt-1 text-sm text-amber-800">
              This subscription plan is currently assigned to <span className="font-bold">{plan.subscribers} companies</span>.
              Please migrate all subscribers to another plan before archiving this plan.
            </div>
          </div>
        </div>
        <p className="text-sm text-slate-600">Archiving a plan with active subscribers may cause service interruptions for those companies.</p>
      </div>
    </Modal>
  )
}

// ─── Create Plan Modal ────────────────────────────────────────────────────────

function CreatePlanModal({ onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_PLAN)
  const set = k => v => setForm(f => ({ ...f, [k]: v }))
  const setFeature = k => v => setForm(f => ({ ...f, features: { ...f.features, [k]: v } }))

  const numFeatures = [
    { key: 'maxEmployees', label: 'Maximum Employees (-1 = unlimited)' },
    { key: 'maxProjects',  label: 'Maximum Projects (-1 = unlimited)' },
    { key: 'maxLeads',     label: 'Maximum Leads (-1 = unlimited)' },
    { key: 'maxStorage',   label: 'Max Storage (GB)' },
  ]
  const boolFeatures = [
    { key: 'attendance',      label: 'Attendance Module' },
    { key: 'reports',         label: 'Reports Module' },
    { key: 'analytics',       label: 'Analytics Dashboard' },
    { key: 'mobile',          label: 'Mobile Application Access' },
    { key: 'whatsapp',        label: 'WhatsApp Integration' },
    { key: 'api',             label: 'API Access' },
    { key: 'prioritySupport', label: 'Priority Support' },
    { key: 'customBranding',  label: 'Custom Branding' },
    { key: 'whiteLabel',      label: 'White Label' },
    { key: 'customDomain',    label: 'Custom Domain' },
  ]

  const valid = form.name.trim() && form.monthlyPrice !== ''

  return (
    <Modal open wide onClose={onClose} title="Create Subscription Plan" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => { onSave(form); onClose() }} disabled={!valid}>Create Plan</Button>
      </>
    }>
      <div className="space-y-6">

        {/* Basic Info */}
        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Plan Information</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Plan Name *" value={form.name} onChange={e => set('name')(e.target.value)} placeholder="e.g. Professional" />
            <div className="sm:col-span-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Description</span>
                <textarea
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[72px]"
                  value={form.description}
                  onChange={e => set('description')(e.target.value)}
                  placeholder="Brief description of what this plan includes..."
                />
              </label>
            </div>
            <Input label="Monthly Price (₹) *" type="number" value={form.monthlyPrice} onChange={e => set('monthlyPrice')(e.target.value)} placeholder="4999" />
            <Input label="Yearly Price (₹)" type="number" value={form.yearlyPrice} onChange={e => set('yearlyPrice')(e.target.value)} placeholder="49990" />
            <Input label="Trial Days" type="number" value={form.trialDays} onChange={e => set('trialDays')(Number(e.target.value))} placeholder="0" />
            <Select label="Plan Status" value={form.status} onChange={e => set('status')(e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Plan Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.color} onChange={e => set('color')(e.target.value)} className="w-10 h-9 rounded border border-slate-300 cursor-pointer" />
                <span className="text-sm text-slate-500">{form.color}</span>
              </div>
            </div>
            <Input label="Plan Icon" value={form.icon} onChange={e => set('icon')(e.target.value)} placeholder="◈" />
            <Input label="Display Order" type="number" value={form.displayOrder} onChange={e => set('displayOrder')(e.target.value)} placeholder="1" />
          </div>
        </div>

        {/* Numeric Feature Limits */}
        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Usage Limits</h4>
          <div className="grid grid-cols-2 gap-3">
            {numFeatures.map(f => (
              <Input key={f.key} label={f.label} type="number" value={form.features[f.key]}
                onChange={e => setFeature(f.key)(Number(e.target.value))} />
            ))}
          </div>
        </div>

        {/* Boolean Features */}
        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Plan Features</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            {boolFeatures.map(f => (
              <Toggle key={f.key} label={f.label} checked={form.features[f.key]}
                onChange={v => setFeature(f.key)(v)} />
            ))}
          </div>
        </div>

        {/* Backup Frequency */}
        <div>
          <Select label="Backup Frequency" value={form.features.backupFrequency}
            onChange={e => setFeature('backupFrequency')(e.target.value)}>
            <option value="none">None</option>
            <option value="weekly">Weekly</option>
            <option value="daily">Daily</option>
            <option value="realtime">Real-time</option>
          </Select>
        </div>
      </div>
    </Modal>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SubscriptionPlansPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { data, loading, error, refetch } = useFetch(useCallback(() => billingApi.plans(), []))
  const plans = data || []
  const [showCreate, setShowCreate] = useState(false)
  const [archivePlan, setArchivePlan] = useState(null)
  const [search, setSearch] = useState('')

  const filtered = plans.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  async function handleArchive(plan) {
    if (plan.subscribers > 0) { setArchivePlan(plan); return }
    try { await billingApi.removePlan(plan.id); toast.success('Plan archived'); refetch() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }

  async function handleDuplicate(plan) {
    const { id, _id, subscribers, createdAt, updatedAt, ...rest } = plan // eslint-disable-line
    try { await billingApi.createPlan({ ...rest, name: `${plan.name} (Copy)`, status: 'active' }); toast.success('Plan duplicated'); refetch() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }

  async function handleSave(form) {
    try {
      await billingApi.createPlan({ ...form, status: form.status === 'active' ? 'active' : 'archived' })
      toast.success('Plan created'); refetch()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription Plans"
        subtitle="Manage all subscription tiers available on the platform"
        actions={<Button onClick={() => setShowCreate(true)}>+ Create Subscription Plan</Button>}
      />

      {/* Search */}
      <div className="w-64">
        <Input placeholder="Search plans..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> :
      /* Plans Table */
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Plan Name</th>
              <th className="px-4 py-3 font-medium">Monthly Price</th>
              <th className="px-4 py-3 font-medium">Yearly Price</th>
              <th className="px-4 py-3 font-medium">Subscribers</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                <div className="text-3xl mb-2">◈</div>
                <div className="font-medium text-slate-600">No subscription plans found</div>
                <div className="text-sm mt-1">Create your first plan to get started</div>
              </td></tr>
            ) : filtered.map(plan => (
              <tr key={plan.id} className="hover:bg-slate-50 transition">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: plan.color }}>{plan.icon}</div>
                    <span className="font-semibold text-slate-900">{plan.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">{plan.monthlyPrice === 0 ? 'Free' : `₹${plan.monthlyPrice.toLocaleString('en-IN')}`}</td>
                <td className="px-4 py-3 text-slate-700">{plan.yearlyPrice === 0 ? 'Free' : `₹${plan.yearlyPrice.toLocaleString('en-IN')}`}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-900">{plan.subscribers}</span>
                    <span className="text-slate-400 text-xs">companies</span>
                  </div>
                </td>
                <td className="px-4 py-3"><StatusBadge status={plan.status} /></td>
                <td className="px-4 py-3 text-slate-500">{formatDate(plan.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => navigate(`/super-admin/billing/plans/${plan.id}`)}
                      className="px-2 py-1 text-xs rounded border border-slate-200 text-blue-600 hover:bg-blue-50 transition font-medium">
                      View Details
                    </button>
                    <button
                      onClick={() => navigate(`/super-admin/billing/plans/${plan.id}/edit`)}
                      className="px-2 py-1 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition font-medium">
                      Edit
                    </button>
                    <button
                      onClick={() => handleDuplicate(plan)}
                      className="px-2 py-1 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition font-medium">
                      Duplicate
                    </button>
                    <button
                      onClick={() => handleArchive(plan)}
                      className="px-2 py-1 text-xs rounded border border-rose-200 text-rose-600 hover:bg-rose-50 transition font-medium">
                      Archive
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}

      {showCreate && <CreatePlanModal onClose={() => setShowCreate(false)} onSave={handleSave} />}
      {archivePlan && (
        <ArchiveDialog
          plan={archivePlan}
          onClose={() => setArchivePlan(null)}
          onViewSubscribers={() => { navigate(`/super-admin/billing/plans/${archivePlan.id}`); setArchivePlan(null) }}
          onChangePlan={() => setArchivePlan(null)}
        />
      )}
    </div>
  )
}
