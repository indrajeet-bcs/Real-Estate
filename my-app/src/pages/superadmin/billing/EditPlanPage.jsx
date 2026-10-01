import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Button, Input, Select, Modal, Loader, ErrorState } from '../../../components/ui.jsx'
import { useToast } from '../../../context/ToastContext.jsx'
import { billingApi } from '../../../api/resources.js'
import { useFetch } from '../../../hooks/useFetch.js'

// ─── Shared constants ─────────────────────────────────────────────────────────

const NUM_FEATURES = [
  { key: 'maxEmployees', label: 'Maximum Employees', hint: '-1 = unlimited' },
  { key: 'maxProjects',  label: 'Maximum Projects',  hint: '-1 = unlimited' },
  { key: 'maxLeads',     label: 'Maximum Leads',     hint: '-1 = unlimited' },
  { key: 'maxStorage',   label: 'Maximum Storage',   hint: 'GB' },
]

const BOOL_FEATURES = [
  { key: 'attendance',      label: 'Attendance Module' },
  { key: 'reports',         label: 'Reports Module' },
  { key: 'analytics',       label: 'Analytics Dashboard' },
  { key: 'mobile',          label: 'Mobile App Access' },
  { key: 'whatsapp',        label: 'WhatsApp Integration' },
  { key: 'api',             label: 'API Access' },
  { key: 'prioritySupport', label: 'Priority Support' },
  { key: 'customBranding',  label: 'Custom Branding' },
  { key: 'whiteLabel',      label: 'White Label' },
  { key: 'customDomain',    label: 'Custom Domain' },
]

// ─── Feature limit confirmation dialog ────────────────────────────────────────

function FeatureLimitConfirmDialog({ onCancel, onContinue }) {
  return (
    <Modal open onClose={onCancel} title="This Plan Has Active Subscribers" footer={
      <>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={onContinue}>Continue</Button>
      </>
    }>
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-4">
          <span className="text-xl shrink-0">⚠️</span>
          <div>
            <div className="font-semibold text-amber-900">Changing feature limits</div>
            <div className="mt-1 text-sm text-amber-800">
              This subscription plan is currently assigned to existing companies.
              Changing feature limits may affect companies already using this plan.
            </div>
          </div>
        </div>
        <p className="text-sm text-slate-600">
          Do you want to continue? Only the plan configuration will be updated — no company's subscription will be changed automatically.
        </p>
      </div>
    </Modal>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ label, checked, onChange, disabled }) {
  return (
    <div className={`flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0 ${disabled ? 'opacity-60' : ''}`}>
      <span className="text-sm text-slate-700">{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}

// ─── Field error ──────────────────────────────────────────────────────────────

function FieldError({ msg }) {
  if (!msg) return null
  return <p className="mt-1 text-xs text-rose-600">{msg}</p>
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EditPlanPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  // Load plan from the API.
  const { data: original, loading, error, refetch } = useFetch(useCallback(() => billingApi.getPlan(id), [id]))

  // Form state — initialised once the plan loads.
  const [form, setForm] = useState(null)
  useEffect(() => { if (original && !form) setForm({ ...original, features: { ...original.features } }) }, [original]) // eslint-disable-line

  // Track which feature-limit fields have been touched (for confirmation)
  const pendingFeatureLimitChange = useRef(null)
  const [showFeatureConfirm, setShowFeatureConfirm] = useState(false)
  // Once confirmed, feature limits are unlocked for this session
  const [featureLimitsUnlocked, setFeatureLimitsUnlocked] = useState(false)

  // Validation errors
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  // ── Loading / not found ──
  if (loading || (original && !form)) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (!original || !form) {
    return (
      <div className="py-24 text-center space-y-4">
        <div className="text-5xl text-slate-300">◈</div>
        <div className="text-lg font-semibold text-slate-700">Plan not found</div>
        <Button variant="secondary" onClick={() => navigate('/super-admin/billing/plans')}>
          ← Back to Plans
        </Button>
      </div>
    )
  }

  const hasSubscribers = original.subscribers > 0

  // ── Setters ──
  const set = k => v => setForm(f => ({ ...f, [k]: v }))
  const setFeature = k => v => setForm(f => ({ ...f, features: { ...f.features, [k]: v } }))

  // Feature-limit change — requires confirmation when plan has subscribers
  function handleFeatureLimitChange(key, rawValue) {
    const numVal = Number(rawValue)
    if (hasSubscribers && !featureLimitsUnlocked) {
      // Queue the change and open confirmation
      pendingFeatureLimitChange.current = { key, value: numVal }
      setShowFeatureConfirm(true)
    } else {
      setFeature(key)(numVal)
    }
  }

  function handleBoolFeatureChange(key, value) {
    if (hasSubscribers && !featureLimitsUnlocked) {
      pendingFeatureLimitChange.current = { key, value }
      setShowFeatureConfirm(true)
    } else {
      setFeature(key)(value)
    }
  }

  function handleBackupFrequencyChange(value) {
    if (hasSubscribers && !featureLimitsUnlocked) {
      pendingFeatureLimitChange.current = { key: 'backupFrequency', value }
      setShowFeatureConfirm(true)
    } else {
      setFeature('backupFrequency')(value)
    }
  }

  function confirmFeatureChange() {
    setFeatureLimitsUnlocked(true)
    if (pendingFeatureLimitChange.current) {
      const { key, value } = pendingFeatureLimitChange.current
      setFeature(key)(value)
      pendingFeatureLimitChange.current = null
    }
    setShowFeatureConfirm(false)
  }

  // ── Validation ──
  function validate() {
    const e = {}
    if (!form.name.trim())          e.name = 'Plan name is required.'
    if (form.monthlyPrice === '' || form.monthlyPrice === null)
                                     e.monthlyPrice = 'Monthly price is required.'
    if (Number(form.monthlyPrice) < 0)
                                     e.monthlyPrice = 'Price cannot be negative.'
    if (form.displayOrder !== '' && Number(form.displayOrder) < 1)
                                     e.displayOrder = 'Display order must be ≥ 1.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Save ──
  async function handleSave() {
    if (!validate()) return
    setBusy(true)
    try {
      await billingApi.updatePlan(id, {
        name:         form.name.trim(),
        description:  form.description,
        monthlyPrice: Number(form.monthlyPrice),
        yearlyPrice:  Number(form.yearlyPrice) || 0,
        trialDays:    Number(form.trialDays) || 0,
        status:       form.status === 'active' ? 'active' : 'archived',
        color:        form.color,
        displayOrder: Number(form.displayOrder) || original.displayOrder,
        features:     { ...form.features },
      })
      toast.success('Subscription plan updated successfully.')
      navigate('/super-admin/billing/plans')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update plan')
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-6 max-w-3xl">

      {/* ── Page Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/super-admin/billing/plans')}
            className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition">
            ← Plans
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold text-white"
              style={{ background: form.color }}>{original.icon}</div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Edit Plan — {original.name}</h1>
              <p className="text-sm text-slate-500 mt-0.5">Update plan configuration below</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Warning Banner (subscribers) ── */}
      {hasSubscribers && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0 mt-0.5">⚠️</span>
            <div className="flex-1">
              <div className="font-semibold text-amber-900">
                This subscription plan is currently being used by{' '}
                <span className="text-amber-700">{original.subscribers} companies</span>.
                Changes to pricing or feature limits may affect existing subscribers.
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3 rounded-lg bg-white border border-amber-200 px-4 py-2">
                  <div>
                    <div className="text-xs text-amber-700 font-medium uppercase tracking-wide">Currently used by</div>
                    <div className="text-2xl font-bold text-amber-900">{original.subscribers}</div>
                    <div className="text-xs text-amber-700">Companies</div>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/super-admin/billing/plans/${id}`)}
                  className="text-sm font-medium text-amber-700 underline underline-offset-2 hover:text-amber-900 transition">
                  View Subscribers →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Section 1: Plan Information ── */}
      <Card className="p-6">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">Plan Information</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          {/* Plan Name */}
          <div>
            <Input
              label="Plan Name *"
              value={form.name}
              onChange={e => { set('name')(e.target.value); setErrors(prev => ({ ...prev, name: '' })) }}
              placeholder="e.g. Professional"
            />
            <FieldError msg={errors.name} />
          </div>

          {/* Description — spans full width */}
          <div className="sm:col-span-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Description</span>
              <textarea
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[80px] resize-none"
                value={form.description}
                onChange={e => set('description')(e.target.value)}
                placeholder="Brief description of what this plan includes..."
              />
            </label>
          </div>

          {/* Monthly Price */}
          <div>
            <Input
              label="Monthly Price (₹) *"
              type="number"
              value={form.monthlyPrice}
              onChange={e => { set('monthlyPrice')(e.target.value); setErrors(prev => ({ ...prev, monthlyPrice: '' })) }}
              placeholder="4999"
            />
            <FieldError msg={errors.monthlyPrice} />
          </div>

          {/* Yearly Price */}
          <Input
            label="Yearly Price (₹)"
            type="number"
            value={form.yearlyPrice}
            onChange={e => set('yearlyPrice')(e.target.value)}
            placeholder="49990"
          />

          {/* Trial Days */}
          <Input
            label="Trial Days"
            type="number"
            value={form.trialDays}
            onChange={e => set('trialDays')(Number(e.target.value))}
            placeholder="0"
          />

          {/* Plan Status */}
          <Select
            label="Plan Status"
            value={form.status}
            onChange={e => set('status')(e.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>

          {/* Plan Color */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Plan Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.color}
                onChange={e => set('color')(e.target.value)}
                className="w-10 h-9 rounded border border-slate-300 cursor-pointer"
              />
              <span className="font-mono text-sm text-slate-500">{form.color}</span>
              {/* Live preview */}
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: form.color }}>
                {original.icon}
              </div>
            </div>
          </div>

          {/* Display Order */}
          <div>
            <Input
              label="Display Order"
              type="number"
              value={form.displayOrder}
              onChange={e => { set('displayOrder')(e.target.value); setErrors(prev => ({ ...prev, displayOrder: '' })) }}
              placeholder="1"
            />
            <FieldError msg={errors.displayOrder} />
          </div>
        </div>
      </Card>

      {/* ── Section 2: Usage Limits ── */}
      <Card className="p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Usage Limits</h2>
            <p className="mt-1 text-xs text-slate-500">Set -1 for unlimited. Use whole numbers only.</p>
          </div>
          {hasSubscribers && !featureLimitsUnlocked && (
            <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5">
              <span className="text-amber-600 text-sm">🔒</span>
              <span className="text-xs text-amber-700 font-medium">Requires confirmation to edit</span>
            </div>
          )}
          {featureLimitsUnlocked && (
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5">
              <span className="text-emerald-600 text-sm">🔓</span>
              <span className="text-xs text-emerald-700 font-medium">Feature limits unlocked</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {NUM_FEATURES.map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {f.label}
                <span className="ml-1 text-slate-400 font-normal text-xs">({f.hint})</span>
              </label>
              <input
                type="number"
                value={form.features[f.key]}
                onChange={e => handleFeatureLimitChange(f.key, e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* ── Section 3: Plan Features (booleans) ── */}
      <Card className="p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Plan Features</h2>
            <p className="mt-1 text-xs text-slate-500">Enable or disable features for this plan.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          {BOOL_FEATURES.map(f => (
            <Toggle
              key={f.key}
              label={f.label}
              checked={form.features[f.key]}
              onChange={v => handleBoolFeatureChange(f.key, v)}
            />
          ))}
        </div>

        {/* Backup Frequency */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <Select
            label="Backup Frequency"
            value={form.features.backupFrequency}
            onChange={e => handleBackupFrequencyChange(e.target.value)}>
            <option value="none">None</option>
            <option value="weekly">Weekly</option>
            <option value="daily">Daily</option>
            <option value="realtime">Real-time</option>
          </Select>
        </div>
      </Card>

      {/* ── Actions ── */}
      <div className="flex flex-wrap items-center gap-3 pb-10">
        <Button onClick={handleSave} disabled={busy}>
          {busy ? 'Saving…' : 'Save Changes'}
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => navigate('/super-admin/billing/plans')}>
          Cancel
        </Button>
      </div>

      {/* ── Feature Limit Confirmation Dialog ── */}
      {showFeatureConfirm && (
        <FeatureLimitConfirmDialog
          onCancel={() => { setShowFeatureConfirm(false); pendingFeatureLimitChange.current = null }}
          onContinue={confirmFeatureChange}
        />
      )}
    </div>
  )
}
