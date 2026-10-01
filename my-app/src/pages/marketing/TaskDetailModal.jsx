import { useState, useCallback, Fragment } from 'react'
import { marketingApi, usersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, formatMoney, titleCase } from '../../lib/format.js'
import { Modal, Button, Input, Textarea, Select, StatusBadge, Loader, ErrorState } from '../../components/ui.jsx'
import { PRIORITY_COLORS, displayStatus } from '../../lib/marketing.js'

// Compact action icons (inline SVG, currentColor).
const svg = (paths) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">{paths}</svg>
const ICON = {
  progress: svg(<><path d="M3 3v18h18" /><path d="m7 14 4-4 3 3 5-6" /></>),
  check: svg(<path d="M20 6 9 17l-5-5" />),
  reopen: svg(<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>),
  play: svg(<path d="M7 5v14l11-7-11-7z" />),
  pause: svg(<><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></>),
  calendar: svg(<><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></>),
  upload: svg(<><path d="M12 15V3m0 0-4 4m4-4 4 4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>),
  link: svg(<><path d="M10 13a5 5 0 0 0 7.07 0l2-2a5 5 0 0 0-7.07-7.07l-1 1" /><path d="M14 11a5 5 0 0 0-7.07 0l-2 2A5 5 0 0 0 12 20.07l1-1" /></>),
  chat: svg(<path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />),
  reassign: svg(<><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0-3-3.87" /><circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" /></>),
  cancel: svg(<><circle cx="12" cy="12" r="9" /><path d="m15 9-6 6M9 9l6 6" /></>),
  trash: svg(<><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13h6l1-13" /></>),
  dots: svg(<><circle cx="12" cy="5" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="12" cy="19" r="1.4" /></>),
  save: svg(<><path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /><path d="M8 3v5h7M8 21v-7h8v7" /></>),
}

function PriorityPill({ priority }) {
  return <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium}`}>{titleCase(priority)}</span>
}

// The "More" (⋮) overflow menu — opens upward above the sticky action bar. Danger
// items are separated by a divider (§action redesign).
function MoreMenu({ items, onUpload, busy }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  return (
    <div className="relative">
      <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)} disabled={busy} aria-haspopup="menu" aria-expanded={open}>{ICON.dots}<span>More</span></Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} aria-hidden="true" />
          <div role="menu" className="absolute bottom-full right-0 z-20 mb-2 w-56 origin-bottom-right rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-150">
            {items.map((it, idx) => (
              <Fragment key={it.key}>
                {it.danger && (idx === 0 || !items[idx - 1].danger) && <div className="my-1.5 border-t border-slate-200" />}
                {it.file ? (
                  <label role="menuitem" className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 focus-within:bg-slate-100">
                    <span className="text-slate-400">{it.icon}</span>{it.label}
                    <input type="file" className="hidden" onChange={(e) => { onUpload(e); close() }} />
                  </label>
                ) : (
                  <button role="menuitem" disabled={busy} onClick={() => { close(); it.onClick() }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none transition disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500 ${it.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-100'}`}>
                    <span className={it.danger ? 'text-red-500' : 'text-slate-400'}>{it.icon}</span>{it.label}
                  </button>
                )}
              </Fragment>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children || '—'}</dd>
    </div>
  )
}

// Task 360° view + every lifecycle action (§My Tasks Actions + §Team Tasks).
// Which actions render depends on permission ('assign' = manager) and status.
export default function TaskDetailModal({ taskId, onClose, onChanged }) {
  const { can, user } = useAuth()
  const toast = useToast()
  const isManager = can('marketing', 'assign')
  const { data: task, loading, error, refetch } = useFetch(useCallback(() => marketingApi.getTask(taskId), [taskId]))
  const { data: employees } = useFetch(useCallback(() => (isManager ? usersApi.list({ status: 'active', limit: 300 }) : Promise.resolve({ data: { data: [] } })), [isManager]))

  const [panel, setPanel] = useState(null) // 'progress' | 'complete' | 'reassign' | 'due' | 'cancel' | 'remark' | 'link'
  const [pf, setPf] = useState({}) // panel form
  const [busy, setBusy] = useState(false)

  if (loading) return <Modal open onClose={onClose} wide title="Task"><Loader /></Modal>
  if (error) return <Modal open onClose={onClose} wide title="Task"><ErrorState message={error} onRetry={refetch} /></Modal>

  const isOwner = String(task.owner?._id) === String(user.id || user._id)
  const closed = ['completed', 'cancelled'].includes(task.status)
  const canWrite = (isOwner || isManager) && !closed
  const canReopen = task.status === 'completed' && (isOwner || isManager)
  const canDelete = (isManager && can('marketing', 'delete')) || (isOwner && task.isSelfTask && task.status === 'draft')

  // On success: sync to related roles (onChanged → parent refetch). With
  // { close:true } (from "Save & Close") also dismiss the modal; otherwise keep it
  // open and refetch so the updated activity/status shows in place.
  const after = ({ close = false } = {}) => {
    setPanel(null); setPf({})
    if (close) { onChanged?.(); onClose() }
    else { refetch(); onChanged?.() }
  }

  async function run(fn, successMsg, opts) {
    setBusy(true)
    try { await fn(); toast.success(successMsg); after(opts) }
    catch (err) { toast.error(err.response?.data?.message || 'Action failed') }
    finally { setBusy(false) }
  }

  const start = () => run(() => marketingApi.setStatus(task._id, { status: 'in_progress' }), 'Task started')
  const hold = () => run(() => marketingApi.setStatus(task._id, { status: 'on_hold', note: 'Put on hold' }), 'Task on hold')
  const saveProgress = (opts) => run(() => marketingApi.updateProgress(task._id, { progress: Number(pf.progress ?? task.progress), status: pf.status || undefined, note: pf.note || '' }), 'Progress updated', opts)
  const complete = (opts) => run(() => marketingApi.complete(task._id, { completionRemarks: pf.remarks || '' }), 'Task completed', opts)
  const reassign = (opts) => run(() => marketingApi.reassign(task._id, { assignTo: pf.assignTo, reason: pf.reason || '' }), 'Task reassigned', opts)
  const changeDue = (opts) => run(() => marketingApi.setDueDate(task._id, { dueDate: pf.dueDate, reason: pf.reason || '' }), 'Due date updated', opts)
  const cancel = (opts) => run(() => marketingApi.setStatus(task._id, { status: 'cancelled', note: pf.reason || '' }), 'Task cancelled', opts)
  const addRemark = (opts) => run(() => marketingApi.addRemark(task._id, { text: pf.remark }), 'Remark added', opts)
  const addLink = (opts) => run(() => marketingApi.addLink(task._id, { url: pf.url, label: pf.label || pf.url }), 'Link added', opts)
  const del = () => { if (window.confirm('Delete this task? This cannot be undone.')) run(() => marketingApi.removeTask(task._id).then(onClose), 'Task deleted') }
  const reopen = () => { if (window.confirm('Reopen this completed task? It will move back to In Progress.')) run(() => marketingApi.reopen(task._id), 'Task reopened') }
  const openProgress = () => { setPanel('progress'); setPf({ progress: task.progress, status: task.status }) }

  // "Save & Close": commit the open editor panel (if any), sync to related roles,
  // then close. With nothing being edited it just syncs + closes.
  const PANEL_SAVERS = { progress: saveProgress, complete, reassign, due: changeDue, cancel, remark: addRemark, link: addLink }
  const PANEL_VALID = { reassign: () => !!pf.assignTo, due: () => !!pf.dueDate, remark: () => !!(pf.remark || '').trim(), link: () => !!pf.url }
  const saveAndClose = () => {
    const saver = panel && PANEL_SAVERS[panel]
    if (!saver) { onChanged?.(); onClose(); return }
    const valid = PANEL_VALID[panel]
    if (valid && !valid()) { toast.error('Please complete the required fields first'); return }
    saver({ close: true })
  }

  async function upload(e) {
    const f = e.target.files?.[0]
    if (!f) return
    const fd = new FormData(); fd.append('file', f); fd.append('label', f.name); fd.append('kind', 'proof')
    await run(() => marketingApi.uploadAttachment(task._id, fd), 'Attachment uploaded')
    e.target.value = ''
  }

  // Overflow ("More") menu — contextual: one status toggle (Start / Hold / Resume),
  // then secondary actions, then a danger zone (Cancel / Delete) below a divider.
  const statusToggle = task.status === 'on_hold'
    ? { key: 'resume', label: 'Resume', icon: ICON.play, onClick: start }
    : task.status === 'in_progress'
      ? { key: 'hold', label: 'Hold', icon: ICON.pause, onClick: hold }
      : { key: 'start', label: 'Start', icon: ICON.play, onClick: start }

  const moreItems = []
  if (canWrite) moreItems.push(statusToggle)
  if ((isManager || isOwner) && !closed) moreItems.push({ key: 'due', label: 'Change Due Date', icon: ICON.calendar, onClick: () => { setPanel('due'); setPf({ dueDate: '' }) } })
  if (!closed) moreItems.push({ key: 'upload', label: 'Upload Proof', icon: ICON.upload, file: true })
  if (task.status !== 'cancelled') moreItems.push({ key: 'link', label: 'Add Link', icon: ICON.link, onClick: () => setPanel('link') })
  if (task.status !== 'cancelled') moreItems.push({ key: 'remark', label: 'Add Remark', icon: ICON.chat, onClick: () => setPanel('remark') })
  if (isManager && !closed) moreItems.push({ key: 'reassign', label: 'Reassign', icon: ICON.reassign, onClick: () => setPanel('reassign') })
  if ((isManager || isOwner) && !closed) moreItems.push({ key: 'cancel', label: 'Cancel Task', icon: ICON.cancel, danger: true, onClick: () => setPanel('cancel') })
  if (canDelete) moreItems.push({ key: 'delete', label: 'Delete', icon: ICON.trash, danger: true, onClick: del })

  // "Save & Close" is only enabled when there is a real pending change in the open
  // editor — a status/progress change, a completion, a cancellation, a link/remark,
  // etc. With nothing changed it stays disabled.
  const saveDirty = (() => {
    if (!panel) return false
    if (panel === 'complete' || panel === 'cancel') return true // completing/cancelling is itself the change
    if (panel === 'progress') {
      const statusChanged = Boolean(pf.status) && pf.status !== task.status
      const progressChanged = String(pf.progress ?? '') !== String(task.progress ?? '')
      return statusChanged || progressChanged || Boolean((pf.note || '').trim())
    }
    if (panel === 'reassign') return Boolean(pf.assignTo)
    if (panel === 'due') return Boolean(pf.dueDate)
    if (panel === 'remark') return Boolean((pf.remark || '').trim())
    if (panel === 'link') return Boolean(pf.url)
    return false
  })()

  const hasActions = canWrite || canReopen || moreItems.length > 0
  const showSaveClose = hasActions || Boolean(panel)
  const actionFooter = (
    <div className="flex w-full flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {canWrite && <Button size="sm" variant="secondary" onClick={openProgress} disabled={busy}>{ICON.progress}<span>Update Progress</span></Button>}
        {canWrite && <Button size="sm" variant="success" onClick={() => setPanel('complete')} disabled={busy}>{ICON.check}<span>Complete</span></Button>}
        {canReopen && <Button size="sm" variant="secondary" onClick={reopen} disabled={busy}>{ICON.reopen}<span>Reopen</span></Button>}
        {moreItems.length > 0 && <MoreMenu items={moreItems} onUpload={upload} busy={busy} />}
      </div>
      <div className="flex items-center gap-2">
        {showSaveClose && <Button size="sm" onClick={saveAndClose} disabled={busy || !saveDirty} title={saveDirty ? 'Save changes and close' : 'No changes to save'}>{ICON.save}<span>Save &amp; Close</span></Button>}
        <Button size="sm" variant="secondary" onClick={onClose} disabled={busy}>Close</Button>
      </div>
    </div>
  )

  return (
    <Modal open onClose={onClose} wide title={`${task.code} · ${task.title}`} footer={actionFooter}>
      <div className="space-y-5">
        {/* Header badges */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={displayStatus(task)} />
          <PriorityPill priority={task.priority} />
          <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs capitalize text-slate-600">{task.channel}</span>
          <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">{titleCase(task.marketingType)}</span>
          <span className={`rounded border px-2 py-0.5 text-xs ${task.isSelfTask ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>{task.isSelfTask ? 'Self Task' : 'Assigned Task'}</span>
        </div>

        {/* Core details */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Field label="Owner">{task.owner?.name}</Field>
          <Field label="Created By">{task.createdBy?.name} {task.createdByRole ? `· ${titleCase(task.createdByRole)}` : ''}</Field>
          <Field label="Branch">{task.branch}</Field>
          <Field label="Campaign">{task.campaign?.name}</Field>
          <Field label="Related Project">{task.relatedProject?.name}</Field>
          <Field label="Related Builder">{task.relatedBuilder?.name}</Field>
          <Field label="Due Date">{task.dueDate ? formatDate(task.dueDate, true) : '—'}</Field>
          <Field label="Estimated Budget">{task.estimatedBudget ? formatMoney(task.estimatedBudget) : '—'}</Field>
          <Field label="Progress">{task.progress || 0}%</Field>
        </dl>
        {task.description && <div><dt className="text-xs uppercase tracking-wide text-slate-500">Description</dt><p className="mt-1 text-sm text-slate-700">{task.description}</p></div>}
        {task.completionRemarks && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><strong>Completion:</strong> {task.completionRemarks}</div>}
        {task.cancelReason && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800"><strong>Cancelled:</strong> {task.cancelReason}</div>}

        {/* Task actions live in the sticky modal footer (see actionFooter). */}

        {/* Contextual panels */}
        {panel === 'progress' && (
          <PanelCard title="Update Progress" onCancel={() => setPanel(null)} onSave={saveProgress} busy={busy}>
            <Input label="Progress %" type="number" min="0" max="100" value={pf.progress ?? ''} onChange={(e) => setPf((p) => ({ ...p, progress: e.target.value }))} />
            <Select label="Status" value={pf.status || ''} onChange={(e) => setPf((p) => ({ ...p, status: e.target.value }))}>
              <option value="">Keep current</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="on_hold">On Hold</option>
            </Select>
            <div className="sm:col-span-2"><Input label="Note" value={pf.note || ''} onChange={(e) => setPf((p) => ({ ...p, note: e.target.value }))} placeholder="What was done" /></div>
          </PanelCard>
        )}
        {panel === 'complete' && (
          <PanelCard title="Complete Task" onCancel={() => setPanel(null)} onSave={complete} busy={busy} saveLabel="Mark Completed" saveVariant="success">
            <div className="sm:col-span-2"><Textarea label="Completion remarks" value={pf.remarks || ''} onChange={(e) => setPf((p) => ({ ...p, remarks: e.target.value }))} placeholder="Outcome / result" /></div>
          </PanelCard>
        )}
        {panel === 'reassign' && (
          <PanelCard title="Reassign Task" onCancel={() => setPanel(null)} onSave={reassign} busy={busy} disabled={!pf.assignTo}>
            <Select label="New owner" value={pf.assignTo || ''} onChange={(e) => setPf((p) => ({ ...p, assignTo: e.target.value }))}>
              <option value="">Select employee…</option>
              {(employees || []).filter((e) => String(e._id) !== String(task.owner?._id)).map((e) => <option key={e._id} value={e._id}>{e.name} · {titleCase(e.role)}</option>)}
            </Select>
            <Input label="Reason" value={pf.reason || ''} onChange={(e) => setPf((p) => ({ ...p, reason: e.target.value }))} />
          </PanelCard>
        )}
        {panel === 'due' && (
          <PanelCard title="Change Due Date" onCancel={() => setPanel(null)} onSave={changeDue} busy={busy} disabled={!pf.dueDate}>
            <Input label="New due date" type="datetime-local" value={pf.dueDate || ''} onChange={(e) => setPf((p) => ({ ...p, dueDate: e.target.value }))} />
            <Input label="Reason" value={pf.reason || ''} onChange={(e) => setPf((p) => ({ ...p, reason: e.target.value }))} />
          </PanelCard>
        )}
        {panel === 'cancel' && (
          <PanelCard title="Cancel Task" onCancel={() => setPanel(null)} onSave={cancel} busy={busy} saveLabel="Cancel Task" saveVariant="danger">
            <div className="sm:col-span-2"><Input label="Reason" value={pf.reason || ''} onChange={(e) => setPf((p) => ({ ...p, reason: e.target.value }))} placeholder="Why is this being cancelled?" /></div>
          </PanelCard>
        )}
        {panel === 'remark' && (
          <PanelCard title="Add Remark" onCancel={() => setPanel(null)} onSave={addRemark} busy={busy} disabled={!pf.remark}>
            <div className="sm:col-span-2"><Textarea label="Remark" value={pf.remark || ''} onChange={(e) => setPf((p) => ({ ...p, remark: e.target.value }))} /></div>
          </PanelCard>
        )}
        {panel === 'link' && (
          <PanelCard title="Add Link" onCancel={() => setPanel(null)} onSave={addLink} busy={busy} disabled={!pf.url}>
            <Input label="URL" value={pf.url || ''} onChange={(e) => setPf((p) => ({ ...p, url: e.target.value }))} placeholder="https://…" />
            <Input label="Label" value={pf.label || ''} onChange={(e) => setPf((p) => ({ ...p, label: e.target.value }))} placeholder="e.g. Instagram post" />
          </PanelCard>
        )}

        {/* Attachments + links */}
        {(task.attachments?.length > 0 || task.links?.length > 0) && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-900">Attachments & Links</h4>
            <div className="space-y-2">
              {(task.attachments || []).map((a) => (
                <a key={a._id} href={a.fileUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                  <span className="text-slate-700">📎 {a.label}</span>
                  <span className="text-xs text-slate-400">{titleCase(a.kind || 'file')} · {formatDate(a.uploadedAt)}</span>
                </a>
              ))}
              {(task.links || []).map((l) => (
                <a key={l._id} href={l.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                  <span className="text-blue-600">🔗 {l.label}</span>
                  <span className="text-xs text-slate-400">{formatDate(l.at)}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Remarks */}
        {task.remarks?.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-900">Remarks</h4>
            <div className="space-y-2">
              {task.remarks.slice().reverse().map((r) => (
                <div key={r._id} className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-1 text-xs text-slate-500">{r.authorName} · {titleCase(r.authorRole)} · {formatDate(r.at, true)}</div>
                  <p className="text-sm text-slate-800">{r.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity timeline (§Activity History per task) */}
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-900">Activity</h4>
          <div className="relative space-y-3 border-l border-slate-200 pl-5">
            {(task.activity || []).slice().reverse().map((a) => (
              <div key={a._id} className="relative">
                <span className="absolute -left-[23px] top-1 h-2.5 w-2.5 rounded-full bg-blue-500" />
                <div className="text-sm text-slate-800">{titleCase(a.type)}{a.note ? <span className="text-slate-500"> — {a.note}</span> : null}</div>
                <div className="text-xs text-slate-400">{a.actorName} · {formatDate(a.at, true)}</div>
              </div>
            ))}
            {(!task.activity || task.activity.length === 0) && <p className="text-sm text-slate-400">No activity yet</p>}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// Editor panels carry NO internal Save/Cancel buttons — every change is committed
// with the footer "Save & Close" (or discarded with "Close"). Extra props still
// passed by call sites (onSave/onCancel/etc.) are intentionally ignored.
function PanelCard({ title, children }) {
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
      <div className="mb-3 text-sm font-semibold text-slate-900">{title}</div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
      <p className="mt-3 text-xs text-slate-500">Use “Save &amp; Close” below to apply, or “Close” to discard.</p>
    </div>
  )
}
