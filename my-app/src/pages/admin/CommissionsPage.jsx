import { useState, useCallback, useMemo } from 'react'
import { commissionsApi, buildersApi, projectsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { formatDate } from '../../lib/format.js'
import { PageHeader, Card, Button, Input, Select, Modal, Loader, ErrorState } from '../../components/ui.jsx'

const inr = (n) => {
  const v = Number(n) || 0
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`
  return `₹${v.toLocaleString('en-IN')}`
}

// "Applicable To" label — project beats builder beats all builders (spec).
function applicableLabel(r) {
  if (r.project) return `Project · ${r.project?.name || '—'}`
  if (r.builder) return `Builder · ${r.builder?.name || '—'}`
  return 'All Builders'
}

export default function CommissionsPage() {
  const { can } = useAuth()
  const toast = useToast()
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const { data, meta, loading, error, refetch } = useFetch(useCallback(() => commissionsApi.list(), []))
  const split = meta?.split || { office: 60, executive: 25, branch: 15 }

  async function toggle(rule) {
    try { await commissionsApi.toggle(rule._id, !rule.active); toast.success(`Rule ${rule.active ? 'deactivated' : 'activated'}`); refetch() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }

  async function remove(rule) {
    if (!window.confirm(`Delete commission rule "${rule.name}"? This cannot be undone.`)) return
    try { await commissionsApi.remove(rule._id); toast.success('Rule deleted'); refetch() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }

  const rules = data || []
  const filtered = useMemo(() => {
    let out = rules
    if (statusFilter !== 'all') out = out.filter((r) => (statusFilter === 'active' ? r.active : !r.active))
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter((r) => [r.name, r.builder?.name, r.project?.name].some((v) => (v || '').toLowerCase().includes(q)))
    }
    return out
  }, [rules, statusFilter, search])

  return (
    <div>
      <PageHeader
        title="Commission Rules"
        subtitle="Manage brokerage commission rules and test commission calculations."
        actions={can('commission', 'create') && <Button onClick={() => setEditing({})}>+ Add Rule</Button>}
      />

      {/* Header actions — search & filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-64"><Input label="Search" placeholder="Rule, builder or project" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="w-44">
          <Select label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
      </div>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Active Commission Rules</h3>
            {filtered.length === 0 && <Card className="p-6 text-sm text-slate-400">No commission rules match.</Card>}
            {filtered.map((r) => (
              <Card key={r._id} className={`p-4 ${r.active ? '' : 'opacity-60'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-slate-900">{r.name}</div>
                    <div className="text-xs text-slate-500">{applicableLabel(r)}</div>
                  </div>
                  <span className={`rounded border px-2 py-0.5 text-[10px] font-medium uppercase ${r.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>{r.active ? 'Active' : 'Inactive'}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-slate-50 p-2"><div className="text-slate-500">Commission</div><div className="font-semibold text-slate-800">{r.baseRate}%</div></div>
                  <div className="rounded-lg bg-slate-50 p-2"><div className="text-slate-500">Threshold</div><div className="font-semibold text-slate-800">{inr(r.targetThreshold)}</div></div>
                  <div className="rounded-lg bg-slate-50 p-2"><div className="text-slate-500">Accelerator</div><div className="font-semibold text-slate-800">{r.acceleratorRate}%</div></div>
                </div>
                <div className="mt-2 text-right text-[11px] text-slate-400">Last updated {formatDate(r.updatedAt)}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setViewing(r)}>View</Button>
                  {can('commission', 'edit') && <Button size="sm" variant="secondary" onClick={() => setEditing(r)}>Edit</Button>}
                  {can('commission', 'edit') && <Button size="sm" variant={r.active ? 'danger' : 'success'} onClick={() => toggle(r)}>{r.active ? 'Deactivate' : 'Activate'}</Button>}
                  {can('commission', 'delete') && <Button size="sm" variant="danger" onClick={() => remove(r)}>Delete</Button>}
                </div>
              </Card>
            ))}
          </div>

          <Sandbox rules={rules} split={split} />
        </div>
      )}

      {editing && <RuleModal rule={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); refetch() }} />}
      {viewing && <ViewRuleModal rule={viewing} split={split} onClose={() => setViewing(null)} onEdit={() => { setEditing(viewing); setViewing(null) }} canEdit={can('commission', 'edit')} />}
    </div>
  )
}

// Read-only rule details (spec §Row Actions · View).
function ViewRuleModal({ rule, split, onClose, onEdit, canEdit }) {
  const rows = [
    ['Rule Name', rule.name],
    ['Applicable To', applicableLabel(rule)],
    ['Commission Percentage', `${rule.baseRate}%`],
    ['Threshold', rule.targetThreshold ? inr(rule.targetThreshold) : '—'],
    ['Accelerator', rule.acceleratorRate ? `${rule.acceleratorRate}%` : '—'],
    ['Status', rule.active ? 'Active' : 'Inactive'],
    ['Payout Split', `Office ${split.office}% · Executive ${split.executive}% · Branch ${split.branch}%`],
    ['Last Updated', formatDate(rule.updatedAt, true)],
  ]
  return (
    <Modal open onClose={onClose} title={rule.name} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Close</Button>
        {canEdit && <Button onClick={onEdit}>Edit</Button>}
      </>
    }>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
            <dd className="mt-0.5 text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  )
}

// Simulation-only brokerage calculator (spec §Brokerage Sandbox). Exposes the
// four sandbox fields — Property Value, Brokerage %, Threshold, Accelerator —
// and can preload them from an existing rule. Never persists any data.
function Sandbox({ rules, split }) {
  const [value, setValue] = useState(10000000)
  const [rate, setRate] = useState(2.5)
  const [threshold, setThreshold] = useState(0)
  const [accelerator, setAccelerator] = useState(0)
  const [ruleId, setRuleId] = useState('')

  function loadRule(id) {
    setRuleId(id)
    const r = rules.find((x) => x._id === id)
    if (r) {
      setRate(r.baseRate ?? 0)
      setThreshold(r.targetThreshold ?? 0)
      setAccelerator(r.acceleratorRate ?? 0)
    }
  }

  const calc = useMemo(() => {
    const v = Number(value) || 0
    const base = v * (Number(rate) / 100)
    // Accelerator kicks in only when the deal meets the threshold.
    const th = Number(threshold) || 0
    const acc = Number(accelerator) || 0
    const additional = th > 0 && v >= th ? v * (acc / 100) : 0
    const total = base + additional
    return {
      base, additional, total,
      applied: additional > 0,
      office: total * (split.office / 100),
      executive: total * (split.executive / 100),
      branch: total * (split.branch / 100),
    }
  }, [value, rate, threshold, accelerator, split])

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Brokerage Sandbox</h3>
          <p className="mt-0.5 text-xs text-slate-500">Test a rule before activating it — simulation only, nothing is saved.</p>
        </div>
        <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-700">Preview</span>
      </div>

      <div className="mt-4 space-y-4">
        {rules.length > 0 && (
          <Select label="Load from rule (optional)" value={ruleId} onChange={(e) => loadRule(e.target.value)}>
            <option value="">Manual values</option>
            {rules.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
          </Select>
        )}
        <Input label="Property value (₹)" type="number" value={value} onChange={(e) => { setRuleId(''); setValue(e.target.value) }} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Brokerage (%)" type="number" step="0.1" value={rate} onChange={(e) => { setRuleId(''); setRate(e.target.value) }} />
          <Input label="Accelerator (%)" type="number" step="0.1" value={accelerator} onChange={(e) => { setRuleId(''); setAccelerator(e.target.value) }} />
        </div>
        <Input label="Threshold (₹) — accelerator applies at or above this" type="number" value={threshold} onChange={(e) => { setRuleId(''); setThreshold(e.target.value) }} />

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Base commission</span><span>{inr(Math.round(calc.base))}</span></div>
          <div className={`flex justify-between ${calc.applied ? 'text-emerald-600' : 'text-slate-400'}`}>
            <span>+ Additional (accelerator{calc.applied ? '' : ' — threshold not met'})</span><span>{inr(Math.round(calc.additional))}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-semibold"><span>Total brokerage</span><span>{inr(Math.round(calc.total))}</span></div>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Commission split preview ({split.office}/{split.executive}/{split.branch})</div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-blue-50 p-2"><div className="text-slate-500">Office</div><div className="font-semibold text-slate-800">{inr(Math.round(calc.office))}</div></div>
            <div className="rounded-lg bg-emerald-50 p-2"><div className="text-slate-500">Executive</div><div className="font-semibold text-slate-800">{inr(Math.round(calc.executive))}</div></div>
            <div className="rounded-lg bg-violet-50 p-2"><div className="text-slate-500">Branch</div><div className="font-semibold text-slate-800">{inr(Math.round(calc.branch))}</div></div>
          </div>
        </div>
      </div>
    </Card>
  )
}

function RuleModal({ rule, onClose, onDone }) {
  const toast = useToast()
  const isNew = !rule._id
  const initialAppliesTo = rule.project ? 'project' : rule.builder ? 'builder' : 'all'
  const [form, setForm] = useState({
    name: rule.name || '',
    appliesTo: initialAppliesTo,
    builder: rule.builder?._id || rule.builder || '',
    project: rule.project?._id || rule.project || '',
    baseRate: rule.baseRate ?? 2,
    targetThreshold: rule.targetThreshold ?? 0,
    acceleratorRate: rule.acceleratorRate ?? 0,
    active: rule.active ?? true,
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const { data: builders } = useFetch(useCallback(() => buildersApi.list({ limit: 100 }), []))
  const { data: projects } = useFetch(useCallback(() => projectsApi.list({ limit: 200 }), []))

  const invalid = form.name.trim().length < 2
    || (form.appliesTo === 'builder' && !form.builder)
    || (form.appliesTo === 'project' && !form.project)

  async function save() {
    setBusy(true)
    try {
      const payload = {
        name: form.name,
        builder: form.appliesTo === 'builder' ? form.builder : '',
        project: form.appliesTo === 'project' ? form.project : '',
        baseRate: Number(form.baseRate),
        targetThreshold: Number(form.targetThreshold) || 0,
        acceleratorRate: Number(form.acceleratorRate) || 0,
        active: !!form.active,
      }
      if (isNew) await commissionsApi.create(payload)
      else await commissionsApi.update(rule._id, payload)
      toast.success(isNew ? 'Rule created' : 'Rule updated')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} wide title={isNew ? 'Add Commission Rule' : 'Edit Rule'} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy || invalid}>{isNew ? 'Create' : 'Save'}</Button>
      </>
    }>
      <div className="space-y-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Basic Information</div>
        <Input label="Rule name" value={form.name} onChange={set('name')} placeholder="e.g. Standard General Brokerage" />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Applicable To" value={form.appliesTo} onChange={set('appliesTo')}>
            <option value="all">All Builders</option>
            <option value="builder">Specific Builder</option>
            <option value="project">Specific Project</option>
          </Select>
          {form.appliesTo === 'builder' && (
            <Select label="Builder" value={form.builder} onChange={set('builder')}>
              <option value="">Select a builder…</option>
              {(builders || []).map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </Select>
          )}
          {form.appliesTo === 'project' && (
            <Select label="Project" value={form.project} onChange={set('project')}>
              <option value="">Select a project…</option>
              {(projects || []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </Select>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Commission Percentage (%)" type="number" value={form.baseRate} onChange={set('baseRate')} />
          <Input label="Accelerator Percentage (optional)" type="number" value={form.acceleratorRate} onChange={set('acceleratorRate')} />
        </div>
        <Input label="Threshold Amount (optional, ₹)" type="number" value={form.targetThreshold} onChange={set('targetThreshold')} />

        <Select label="Status" value={form.active ? 'active' : 'inactive'} onChange={(e) => setForm((f) => ({ ...f, active: e.target.value === 'active' }))}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
        <p className="text-xs text-slate-500">Only one rule can be active per scope — activating this will deactivate any other active rule with the same Applicable To.</p>
      </div>
    </Modal>
  )
}
