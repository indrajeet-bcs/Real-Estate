import { useState, useCallback, useMemo } from 'react'
import { tasksApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, titleCase } from '../../lib/format.js'
import {
  PageHeader, Card, StatCard, Button, Input, Select, Table, Modal, Loader, ErrorState,
} from '../../components/ui.jsx'

const taskId = (t) => `TSK-${String(t._id).slice(-6).toUpperCase()}`
const dateOnly = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

const STATUS_META = {
  pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  on_hold: { label: 'On Hold', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}
const PRIORITY_CLS = { high: 'bg-red-50 text-red-700 border-red-200', medium: 'bg-amber-50 text-amber-700 border-amber-200', low: 'bg-slate-100 text-slate-600 border-slate-200' }
const StatusPill = ({ s }) => {
  const m = STATUS_META[s] || { label: titleCase(s), cls: 'bg-slate-100 text-slate-600 border-slate-200' }
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>
}
const assigner = (t) => t.assignedBy?.name || t.assignedByName || 'Management'

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function MyTasksPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [priority, setPriority] = useState('all')
  const [assignedBy, setAssignedBy] = useState('all')
  const [dueRange, setDueRange] = useState('all')
  const [sort, setSort] = useState('recently_assigned')

  const [progressFor, setProgressFor] = useState(null)
  const [completeFor, setCompleteFor] = useState(null)
  const [detailsFor, setDetailsFor] = useState(null)

  const { data, loading, error, refetch } = useFetch(useCallback(() => tasksApi.list({ official: true }), []))
  const rows = data || []
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999)

  const kpis = {
    total: rows.length,
    pending: rows.filter((r) => r.status === 'pending').length,
    inProgress: rows.filter((r) => r.status === 'in_progress').length,
    completed: rows.filter((r) => r.status === 'completed').length,
  }

  const assignerOptions = useMemo(() => [...new Set(rows.map(assigner).filter(Boolean))], [rows])

  const filtered = useMemo(() => {
    let out = rows
    if (status !== 'all') out = out.filter((r) => r.status === status)
    if (priority !== 'all') out = out.filter((r) => (r.priority || 'medium') === priority)
    if (assignedBy !== 'all') out = out.filter((r) => assigner(r) === assignedBy)
    if (dueRange !== 'all') {
      out = out.filter((r) => {
        if (!r.dueDate) return dueRange === 'none'
        const d = new Date(r.dueDate)
        if (dueRange === 'today') return d >= todayStart && d <= todayEnd
        if (dueRange === 'overdue') return d < todayStart && r.status !== 'completed'
        if (dueRange === 'week') { const w = new Date(todayEnd); w.setDate(w.getDate() + 7); return d >= todayStart && d <= w }
        return true
      })
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter((r) => (r.title || '').toLowerCase().includes(q))
    }
    const sorted = [...out]
    if (sort === 'recently_assigned') sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    else if (sort === 'due_today') sorted.sort((a, b) => new Date(a.dueDate || '2999') - new Date(b.dueDate || '2999'))
    else if (sort === 'high_priority') { const rank = { high: 0, medium: 1, low: 2 }; sorted.sort((a, b) => (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1)) }
    return sorted
  }, [rows, status, priority, assignedBy, dueRange, search, sort]) // eslint-disable-line

  const columns = [
    { key: 'id', header: 'Task ID', render: (t) => <span className="font-mono text-xs text-slate-500">{taskId(t)}</span> },
    { key: 'title', header: 'Task', render: (t) => (
      <div className="min-w-[10rem]"><div className="font-medium text-slate-900">{t.title}</div>{t.dueDate && new Date(t.dueDate) < todayStart && t.status !== 'completed' && <span className="text-[10px] font-medium text-rose-600">Overdue</span>}</div>
    ) },
    { key: 'by', header: 'Assigned By', render: (t) => assigner(t) },
    { key: 'priority', header: 'Priority', render: (t) => <span className={`rounded border px-2 py-0.5 text-xs font-medium ${PRIORITY_CLS[t.priority || 'medium']}`}>{titleCase(t.priority || 'medium')}</span> },
    { key: 'due', header: 'Due Date', render: (t) => dateOnly(t.dueDate) },
    { key: 'status', header: 'Status', render: (t) => <StatusPill s={t.status} /> },
    { key: 'assigned', header: 'Assigned', render: (t) => formatDate(t.createdAt) },
    { key: 'actions', header: '', render: (t) => (
      <div className="flex items-center justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setDetailsFor(t) }}>View</Button>
        {t.status !== 'completed' && <>
          <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setProgressFor(t) }}>Progress</Button>
          <Button size="sm" variant="success" onClick={(e) => { e.stopPropagation(); setCompleteFor(t) }}>Complete</Button>
        </>}
      </div>
    ) },
  ]

  return (
    <div>
      <PageHeader title="Tasks" subtitle="View, manage, and complete tasks assigned by your Admin or Sub-Admin." />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Tasks" value={kpis.total} />
        <StatCard label="Pending Tasks" value={kpis.pending} />
        <StatCard label="In Progress" value={kpis.inProgress} />
        <StatCard label="Completed Tasks" value={kpis.completed} />
      </div>

      <Card className="mb-4 p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <div className="col-span-2 md:col-span-1"><Input label="Search" placeholder="Task title" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All</option>
            {Object.keys(STATUS_META).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </Select>
          <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="all">All</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </Select>
          <Select label="Assigned By" value={assignedBy} onChange={(e) => setAssignedBy(e.target.value)}>
            <option value="all">All</option>
            {assignerOptions.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
          <Select label="Due Date" value={dueRange} onChange={(e) => setDueRange(e.target.value)}>
            <option value="all">All</option><option value="today">Due today</option><option value="week">Next 7 days</option><option value="overdue">Overdue</option>
          </Select>
          <Select label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="recently_assigned">Recently Assigned</option>
            <option value="due_today">Due Today</option>
            <option value="high_priority">High Priority</option>
          </Select>
        </div>
      </Card>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <Table columns={columns} rows={filtered} empty="No tasks assigned to you match these filters." onRowClick={(t) => setDetailsFor(t)} />
      )}

      {progressFor && <UpdateProgressModal task={progressFor} onClose={() => setProgressFor(null)} onDone={() => { setProgressFor(null); refetch() }} />}
      {completeFor && <CompleteTaskModal task={completeFor} onClose={() => setCompleteFor(null)} onDone={() => { setCompleteFor(null); refetch() }} />}
      {detailsFor && (
        <TaskDetailsDrawer
          taskRow={detailsFor}
          onClose={() => setDetailsFor(null)}
          onProgress={() => { setProgressFor(detailsFor); setDetailsFor(null) }}
          onComplete={() => { setCompleteFor(detailsFor); setDetailsFor(null) }}
          onChanged={refetch}
        />
      )}
    </div>
  )
}

// ─── Update Progress (spec §Update Progress) ────────────────────────────────────
function UpdateProgressModal({ task, onClose, onDone }) {
  const toast = useToast()
  const [status, setStatus] = useState(task.status === 'completed' ? 'in_progress' : task.status)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      await tasksApi.updateProgress(task._id, { status, progressNote: note })
      toast.success('Progress updated')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Update Progress — ${task.title}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>Save</Button></>}
    >
      <div className="space-y-4">
        <Select label="Current Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="on_hold">On Hold</option>
        </Select>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Progress Notes</label>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's the current status of this task?"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </div>
      </div>
    </Modal>
  )
}

// ─── Mark Task Completed (spec §Mark Task Completed) ────────────────────────────
function CompleteTaskModal({ task, onClose, onDone }) {
  const toast = useToast()
  const [remarks, setRemarks] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)

  async function complete() {
    setBusy(true)
    try {
      await tasksApi.complete(task._id, { completionRemarks: remarks })
      if (file) {
        const fd = new FormData(); fd.append('file', file); fd.append('label', file.name)
        await tasksApi.uploadAttachment(task._id, fd)
      }
      toast.success('Task marked completed')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Complete Task — ${task.title}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="success" onClick={complete} disabled={busy}>Mark Completed</Button></>}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Completion Remarks</label>
          <textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Summary of what was done…"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </div>
        <label className="block text-sm text-slate-700">
          <span className="mb-2 block">Attachment (optional)</span>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm text-slate-600" />
        </label>
        <p className="text-xs text-slate-500">The status changes to Completed, completion time is recorded automatically, and the assigner is notified.</p>
      </div>
    </Modal>
  )
}

// ─── Task Details Drawer (spec §Task Details — 4 sections + Comments) ────────────
const RELATED_PATH = { lead: '/executive/leads', customer: '/executive/customers', booking: '/executive/bookings', site_visit: '/executive/visits' }

function TaskDetailsDrawer({ taskRow, onClose, onProgress, onComplete, onChanged }) {
  const toast = useToast()
  const { data, loading, refetch } = useFetch(useCallback(() => tasksApi.get(taskRow._id), [taskRow._id]))
  const t = data || taskRow
  const readOnly = t.status === 'completed'
  const [comment, setComment] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [busy, setBusy] = useState(false)

  async function addComment() {
    if (!comment.trim()) return
    setBusy(true)
    try {
      await tasksApi.addComment(t._id, { text: comment, parent: replyTo || undefined })
      setComment(''); setReplyTo(null)
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  async function uploadFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    const fd = new FormData(); fd.append('file', f); fd.append('label', f.name)
    setBusy(true)
    try { await tasksApi.uploadAttachment(t._id, fd); toast.success('Attachment uploaded'); refetch() }
    catch (err) { toast.error(err.response?.data?.message || 'Upload failed') }
    finally { setBusy(false); e.target.value = '' }
  }

  const comments = t.comments || []
  const topComments = comments.filter((c) => !c.parent)
  const repliesOf = (id) => comments.filter((c) => String(c.parent) === String(id))
  const timeline = (t.activity || []).slice().reverse()

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col overflow-hidden bg-white shadow-2xl">
        <div className="flex items-start justify-between bg-slate-900 px-6 py-5 text-white">
          <div>
            <h2 className="text-lg font-bold">{t.title}</h2>
            <p className="mt-0.5 text-xs text-slate-400">{taskId(t)} · <span className="text-slate-300">{STATUS_META[t.status]?.label || t.status}</span></p>
          </div>
          <button onClick={onClose} className="mt-0.5 rounded-lg p-1 text-slate-400 hover:text-white">✕</button>
        </div>

        {loading && !data ? <div className="flex flex-1 items-center justify-center"><Loader /></div> : (
          <div className="flex-1 space-y-6 overflow-y-auto p-6">
            {readOnly && <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-2 text-xs text-emerald-800">This task is completed and read-only. {t.completedAt ? `Completed ${formatDate(t.completedAt, true)}.` : ''}</div>}

            <Section title="1 · Task Information">
              <Info rows={[
                ['Task Title', t.title],
                ['Assigned By', assigner(t)],
                ['Assigned Date', formatDate(t.createdAt)],
                ['Due Date', dateOnly(t.dueDate)],
                ['Priority', titleCase(t.priority || 'medium')],
                ['Status', STATUS_META[t.status]?.label || t.status],
              ]} />
              {t.description && <p className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">{t.description}</p>}
              {t.completionRemarks && <p className="mt-2 text-sm"><span className="text-slate-500">Completion remarks:</span> {t.completionRemarks}</p>}
            </Section>

            {t.relatedType && t.relatedType !== 'none' && (
              <Section title="2 · Related Module">
                <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                  <span>{titleCase(t.relatedType)}{t.relatedId ? ` · ${String(t.relatedId).slice(-6).toUpperCase()}` : ''}</span>
                  {t.relatedId && RELATED_PATH[t.relatedType] && <a href={`${RELATED_PATH[t.relatedType]}/${t.relatedId}`} className="text-blue-600 underline">Open</a>}
                </div>
              </Section>
            )}

            <Section title="3 · Progress Update">
              {!readOnly ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={onProgress}>Update Progress</Button>
                  <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                    Upload Document<input type="file" onChange={uploadFile} disabled={busy} className="hidden" />
                  </label>
                  <Button size="sm" variant="success" onClick={onComplete}>Mark Completed</Button>
                </div>
              ) : <p className="text-xs italic text-slate-400">No further updates — task completed.</p>}
              {(t.attachments || []).length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {t.attachments.map((a) => <li key={a._id}><a href={a.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">{a.label}</a> <span className="text-xs text-slate-400">· {formatDate(a.uploadedAt)}</span></li>)}
                </ul>
              )}
            </Section>

            {/* Comments (spec §Comments) */}
            <Section title="Comments">
              {topComments.length === 0 ? <p className="text-xs italic text-slate-400">No comments yet.</p> : (
                <div className="space-y-3">
                  {topComments.map((c) => (
                    <div key={c._id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center justify-between text-xs text-slate-500"><span className="font-medium text-slate-700">{c.authorName}{c.authorRole ? ` · ${titleCase(c.authorRole)}` : ''}</span><span>{formatDate(c.at, true)}</span></div>
                      <p className="mt-1 text-sm text-slate-800">{c.text}</p>
                      {repliesOf(c._id).map((r) => (
                        <div key={r._id} className="mt-2 ml-4 border-l-2 border-slate-200 pl-3">
                          <div className="flex items-center justify-between text-[11px] text-slate-500"><span className="font-medium text-slate-600">{r.authorName}</span><span>{formatDate(r.at, true)}</span></div>
                          <p className="text-sm text-slate-700">{r.text}</p>
                        </div>
                      ))}
                      {!readOnly && <button onClick={() => setReplyTo(replyTo === c._id ? null : c._id)} className="mt-1 text-xs text-blue-600 hover:underline">{replyTo === c._id ? 'Cancel reply' : 'Reply'}</button>}
                    </div>
                  ))}
                </div>
              )}
              {!readOnly && (
                <div className="mt-3 flex items-start gap-2">
                  <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={replyTo ? 'Write a reply…' : 'Add a comment…'}
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                  <Button size="sm" onClick={addComment} disabled={busy || !comment.trim()}>Send</Button>
                </div>
              )}
            </Section>

            <Section title="4 · Activity Timeline">
              {timeline.length === 0 ? <p className="text-xs italic text-slate-400">No activity yet.</p> : (
                <ol className="relative ml-2 space-y-3 border-l border-slate-200 pl-5">
                  {timeline.map((a) => (
                    <li key={a._id} className="relative">
                      <span className="absolute -left-[22px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-blue-500" />
                      <p className="text-xs font-semibold text-slate-800">{titleCase(a.type)}</p>
                      {a.note && <p className="text-xs text-slate-600">{a.note}</p>}
                      <time className="text-[10px] text-slate-400">{a.actorName ? `${a.actorName} · ` : ''}{formatDate(a.at, true)}</time>
                    </li>
                  ))}
                </ol>
              )}
            </Section>
          </div>
        )}

        {!readOnly && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3">
            <Button size="sm" variant="secondary" onClick={() => { onProgress(); onChanged?.() }}>Update Progress</Button>
            <Button size="sm" variant="success" onClick={onComplete}>Mark Completed</Button>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return <div><h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</h4>{children}</div>
}

function Info({ rows }) {
  const shown = rows.filter(([, v]) => v)
  if (!shown.length) return <p className="text-xs italic text-slate-400">—</p>
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      {shown.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
          <dd className="mt-0.5 text-sm text-slate-800">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
