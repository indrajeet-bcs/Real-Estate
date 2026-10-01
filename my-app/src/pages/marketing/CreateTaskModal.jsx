import { useState, useCallback } from 'react'
import { marketingApi, projectsApi, buildersApi, branchesApi, usersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { titleCase } from '../../lib/format.js'
import { Modal, Button, Input, Textarea, Select } from '../../components/ui.jsx'
import { ONLINE_MARKETING_TYPES, OFFLINE_MARKETING_TYPES, TASK_PRIORITIES } from '../../lib/marketing.js'

// Create Task screen (§Create Task). If "Assign To" is left empty the task is
// auto-created as a Self Task owned by the creator (rule in §Task Types).
export default function CreateTaskModal({ onClose, onDone, defaultCampaign }) {
  const { can, user } = useAuth()
  const toast = useToast()
  const isManager = can('marketing', 'assign')

  const [form, setForm] = useState({
    title: '',
    channel: 'online',
    marketingType: ONLINE_MARKETING_TYPES[0],
    campaign: defaultCampaign || '',
    relatedProject: '',
    relatedBuilder: '',
    branch: '',
    description: '',
    priority: 'medium',
    dueDate: '',
    assignTo: '',
    estimatedBudget: '',
    status: 'pending',
  })
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const setChannel = (channel) =>
    setForm((f) => ({ ...f, channel, marketingType: (channel === 'online' ? ONLINE_MARKETING_TYPES : OFFLINE_MARKETING_TYPES)[0] }))

  // Option sources (campaigns + projects/builders for everyone; branches/employees for managers).
  const { data: campaigns } = useFetch(useCallback(() => marketingApi.listCampaigns(), []))
  const { data: projects } = useFetch(useCallback(() => projectsApi.list({ limit: 200 }), []))
  const { data: builders } = useFetch(useCallback(() => buildersApi.list({ limit: 200 }), []))
  const { data: branches } = useFetch(useCallback(() => (isManager ? branchesApi.list() : Promise.resolve({ data: { data: [] } })), [isManager]))
  const { data: employees } = useFetch(useCallback(() => (isManager ? usersApi.list({ status: 'active', limit: 300 }) : Promise.resolve({ data: { data: [] } })), [isManager]))

  const typeOptions = form.channel === 'online' ? ONLINE_MARKETING_TYPES : OFFLINE_MARKETING_TYPES
  const valid = form.title.trim().length >= 2 && form.marketingType

  // Related Project is scoped to the chosen Related Builder — the project dropdown
  // only lists that builder's projects, and is disabled until a builder is picked.
  const projectsForBuilder = (projects || []).filter((p) => !form.relatedBuilder || String(p.builder?._id || p.builder) === String(form.relatedBuilder))
  const onBuilderChange = (e) => {
    const relatedBuilder = e.target.value
    setForm((f) => {
      const stillValid = (projects || []).some((p) => String(p._id) === String(f.relatedProject) && String(p.builder?._id || p.builder) === String(relatedBuilder))
      return { ...f, relatedBuilder, relatedProject: stillValid ? f.relatedProject : '' }
    })
  }

  async function submit(asDraft) {
    if (!valid) { toast.error('Task title and marketing type are required'); return }
    setBusy(true)
    try {
      const payload = {
        title: form.title,
        channel: form.channel,
        marketingType: form.marketingType,
        campaign: form.campaign || undefined,
        relatedProject: form.relatedProject || undefined,
        relatedBuilder: form.relatedBuilder || undefined,
        branch: form.branch || undefined,
        description: form.description || undefined,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
        estimatedBudget: form.estimatedBudget !== '' ? Number(form.estimatedBudget) : undefined,
        assignTo: isManager ? (form.assignTo || undefined) : undefined,
        status: asDraft && isManager ? 'draft' : 'pending',
      }
      const res = await marketingApi.createTask(payload)
      const task = res.data.data
      // Attachment (optional) is uploaded after the task exists.
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('label', file.name)
        try { await marketingApi.uploadAttachment(task._id, fd) } catch { /* non-fatal */ }
      }
      toast.success(payload.assignTo ? 'Task created & assigned' : 'Self task created')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create task')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} wide title="Create Marketing Task" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        {isManager && <Button variant="secondary" onClick={() => submit(true)} disabled={busy || !valid}>Save as Draft</Button>}
        <Button onClick={() => submit(false)} disabled={busy || !valid}>{form.assignTo ? 'Create & Assign' : 'Create Task'}</Button>
      </>
    }>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input label="Task Title *" value={form.title} onChange={set('title')} placeholder="e.g. Instagram reel for Green Enclave launch" />
        </div>

        {/* Channel toggle (§Online / Offline) */}
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Channel *</span>
          <div className="flex gap-2">
            {['online', 'offline'].map((c) => (
              <button key={c} type="button" onClick={() => setChannel(c)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition ${form.channel === c ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <Select label="Marketing Type *" value={form.marketingType} onChange={set('marketingType')}>
          {typeOptions.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
        </Select>

        <Select label="Campaign (optional)" value={form.campaign} onChange={set('campaign')}>
          <option value="">No campaign</option>
          {(campaigns || []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </Select>
        <Select label="Priority" value={form.priority} onChange={set('priority')}>
          {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}
        </Select>

        <Select label="Related Builder (optional)" value={form.relatedBuilder} onChange={onBuilderChange}>
          <option value="">None</option>
          {(builders || []).map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
        </Select>
        <Select label="Related Project (optional)" value={form.relatedProject} onChange={set('relatedProject')} disabled={!form.relatedBuilder}>
          <option value="">{form.relatedBuilder ? 'None' : 'Select a builder first'}</option>
          {projectsForBuilder.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </Select>

        <Input label="Due Date" type="datetime-local" value={form.dueDate} onChange={set('dueDate')} />
        <Input label="Estimated Budget (₹)" type="number" value={form.estimatedBudget} onChange={set('estimatedBudget')} placeholder="Optional" />

        {isManager && (
          <>
            <Select label="Branch" value={form.branch} onChange={set('branch')}>
              <option value="">Default (assignee's branch)</option>
              {(branches || []).map((b) => <option key={b._id} value={b.name}>{b.name}</option>)}
            </Select>
            <Select label="Assign To" value={form.assignTo} onChange={set('assignTo')}>
              <option value="">— Self task (assign to me) —</option>
              {(employees || []).map((e) => <option key={e._id} value={e._id}>{e.name} · {titleCase(e.role)}</option>)}
            </Select>
          </>
        )}

        <div className="sm:col-span-2">
          <Textarea label="Description" value={form.description} onChange={set('description')} placeholder="Scope, deliverables, target audience…" />
        </div>
        <div className="sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700">Attachment (optional)</span>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm text-slate-600" />
          <p className="mt-1 text-xs text-slate-400">Creative, invoice, or reference — image, PDF or DOC up to 10MB.</p>
        </div>
      </div>
      {!isManager && (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">This will be created as a <strong>self task</strong> owned by you and will appear immediately in My Tasks.</p>
      )}
    </Modal>
  )
}
