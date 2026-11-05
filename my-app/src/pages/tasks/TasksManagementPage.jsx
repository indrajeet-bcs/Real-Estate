import { useState, useCallback, useMemo } from 'react'
import { tasksApi, usersApi, customersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, titleCase, exportRowsToCsv } from '../../lib/format.js'
import {
  PageHeader, Card, StatCard, Button, Input, Select, Textarea, Table, StatusBadge, Modal, Loader, ErrorState,
} from '../../components/ui.jsx'

const taskId = (t) => `#TSK-${String(t._id || '').slice(-6).toUpperCase()}`
const sameDay = (a, b) => {
  if (!a || !b) return false
  const da = new Date(a)
  const db = new Date(b)
  return da.toDateString() === db.toDateString()
}

const PRIORITY_META = {
  high: { label: 'High', cls: 'bg-red-50 text-red-700 border-red-200' },
  medium: { label: 'Medium', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  low: { label: 'Low', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
}

const STATUS_OPTIONS = ['pending', 'in_progress', 'on_hold', 'completed']
const PRIORITY_OPTIONS = ['high', 'medium', 'low']
const CATEGORY_OPTIONS = [
  { value: 'none', label: 'General Task' },
  { value: 'lead', label: 'Lead Verification / Contact' },
  { value: 'customer', label: 'Customer Follow-up / Service' },
  { value: 'site_visit', label: 'Site Inspection / Visit Prep' },
  { value: 'booking', label: 'Booking / Document Collection' },
]

export default function TasksManagementPage({
  title = 'Task Management',
  subtitle = 'Assign, track and manage operational and field tasks for sales executives.',
  isSubAdmin = false,
}) {
  const toast = useToast()

  // Filters state
  const [search, setSearch] = useState('')
  const [execFilter, setExecFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [dueFilter, setDueFilter] = useState('all')

  // Modals state
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [detailItem, setDetailItem] = useState(null)
  const [deletingItem, setDeletingItem] = useState(null)

  // Data fetching
  const { data: rawTasks, loading, error, refetch } = useFetch(
    useCallback(() => tasksApi.list({ limit: 1000 }), [])
  )

  const { data: rawUsers } = useFetch(
    useCallback(() => usersApi.list({ role: 'sales_executive', status: 'active', limit: 200 }), [])
  )

  const executives = useMemo(() => {
    const list = rawUsers?.data || rawUsers || []
    return Array.isArray(list) ? list : []
  }, [rawUsers])

  const tasks = useMemo(() => {
    return Array.isArray(rawTasks) ? rawTasks : []
  }, [rawTasks])

  // KPI metrics
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999)
  const nextWeekEnd = new Date(todayEnd); nextWeekEnd.setDate(nextWeekEnd.getDate() + 7)

  const kpis = useMemo(() => {
    let pending = 0
    let inProgress = 0
    let completed = 0
    let overdue = 0
    let high = 0

    tasks.forEach((t) => {
      if (t.status === 'pending') pending++
      if (t.status === 'in_progress') inProgress++
      if (t.status === 'completed') completed++
      if (t.priority === 'high') high++
      if (t.dueDate && t.status !== 'completed' && new Date(t.dueDate) < todayStart) {
        overdue++
      }
    })

    return {
      total: tasks.length,
      pending,
      inProgress,
      completed,
      overdue,
      high,
    }
  }, [tasks, todayStart])

  // Filter logic
  const hasActiveFilters = Boolean(
    search.trim() ||
    execFilter !== 'all' ||
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    dueFilter !== 'all'
  )

  const clearFilters = () => {
    setSearch('')
    setExecFilter('all')
    setStatusFilter('all')
    setPriorityFilter('all')
    setDueFilter('all')
  }

  const filteredTasks = useMemo(() => {
    let list = tasks

    if (execFilter !== 'all') {
      list = list.filter((t) => {
        const ownerId = t.owner?._id || t.owner
        return String(ownerId) === String(execFilter)
      })
    }

    if (statusFilter !== 'all') {
      list = list.filter((t) => t.status === statusFilter)
    }

    if (priorityFilter !== 'all') {
      list = list.filter((t) => (t.priority || 'medium') === priorityFilter)
    }

    if (dueFilter !== 'all') {
      list = list.filter((t) => {
        if (!t.dueDate) return false
        const d = new Date(t.dueDate)
        if (dueFilter === 'today') return d >= todayStart && d <= todayEnd
        if (dueFilter === 'overdue') return d < todayStart && t.status !== 'completed'
        if (dueFilter === 'week') return d >= todayStart && d <= nextWeekEnd
        return true
      })
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((t) => {
        const tTitle = (t.title || '').toLowerCase()
        const tDesc = (t.description || '').toLowerCase()
        const tOwner = (t.owner?.name || '').toLowerCase()
        const tAssigner = (t.assignedByName || t.assignedBy?.name || '').toLowerCase()
        const tId = taskId(t).toLowerCase()
        return tTitle.includes(q) || tDesc.includes(q) || tOwner.includes(q) || tAssigner.includes(q) || tId.includes(q)
      })
    }

    return list
  }, [tasks, execFilter, statusFilter, priorityFilter, dueFilter, search, todayStart, todayEnd, nextWeekEnd])

  // Export CSV
  const handleExportCsv = () => {
    if (!filteredTasks.length) {
      toast.error('No tasks to export')
      return
    }

    const columns = [
      { key: 'taskId', header: 'Task ID' },
      { key: 'title', header: 'Task Title' },
      { key: 'category', header: 'Category' },
      { key: 'assignee', header: 'Assigned Executive' },
      { key: 'branch', header: 'Branch' },
      { key: 'assignedBy', header: 'Assigned By' },
      { key: 'priority', header: 'Priority' },
      { key: 'status', header: 'Status' },
      { key: 'dueDate', header: 'Due Date' },
      { key: 'dueTime', header: 'Due Time' },
      { key: 'completionRemarks', header: 'Completion Remarks' },
      { key: 'createdAt', header: 'Created Date' },
    ]

    const rows = filteredTasks.map((t) => ({
      taskId: taskId(t),
      title: t.title || '',
      category: titleCase(t.relatedType || 'general'),
      assignee: t.owner?.name || 'Unassigned',
      branch: t.owner?.branch || '—',
      assignedBy: t.assignedByName || t.assignedBy?.name || 'Management',
      priority: titleCase(t.priority || 'medium'),
      status: titleCase(t.status || 'pending'),
      dueDate: t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : '—',
      dueTime: t.dueTime || '—',
      completionRemarks: t.completionRemarks || '',
      createdAt: formatDate(t.createdAt, false),
    }))

    exportRowsToCsv('tasks_report.csv', rows, columns)
    toast.success('Tasks exported to CSV')
  }

  // Delete Task
  const handleDeleteTask = async (task) => {
    if (!window.confirm(`Are you sure you want to delete task "${task.title}"?`)) return
    try {
      await tasksApi.remove(task._id)
      toast.success('Task deleted successfully')
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete task')
    }
  }

  // Table Columns
  const columns = [
    {
      key: 'id',
      header: 'Task ID',
      render: (t) => <span className="font-mono text-xs font-semibold text-slate-600">{taskId(t)}</span>,
    },
    {
      key: 'title',
      header: 'Task Title & Category',
      render: (t) => {
        const catLabel = CATEGORY_OPTIONS.find((c) => c.value === t.relatedType)?.label || titleCase(t.relatedType || 'general')
        return (
          <div className="max-w-xs">
            <p className="font-semibold text-slate-900 line-clamp-1">{t.title}</p>
            {t.description && <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{t.description}</p>}
            <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
              {catLabel}
            </span>
          </div>
        )
      },
    },
    {
      key: 'owner',
      header: 'Assigned To',
      render: (t) => {
        const u = t.owner
        if (!u) return <span className="text-xs text-slate-400">Unassigned</span>
        return (
          <div>
            <p className="text-xs font-semibold text-slate-900">{u.name}</p>
            <p className="text-[11px] text-slate-500">{u.branch || u.designation || 'Sales Executive'}</p>
          </div>
        )
      },
    },
    {
      key: 'assignedBy',
      header: 'Assigned By',
      render: (t) => (
        <span className="text-xs text-slate-700">
          {t.assignedByName || t.assignedBy?.name || 'Management'}
          {t.assignedByRole && <span className="text-slate-400 text-[11px] ml-1">({titleCase(t.assignedByRole)})</span>}
        </span>
      ),
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (t) => {
        if (!t.dueDate) return <span className="text-xs text-slate-400">—</span>
        const d = new Date(t.dueDate)
        const isOverdue = d < todayStart && t.status !== 'completed'
        return (
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-slate-800">
                {d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              {t.dueTime && <span className="text-[11px] text-slate-400">({t.dueTime})</span>}
            </div>
            {isOverdue && (
              <span className="mt-0.5 inline-block rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 border border-rose-200">
                Overdue
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (t) => {
        const p = t.priority || 'medium'
        const meta = PRIORITY_META[p] || PRIORITY_META.medium
        return (
          <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${meta.cls}`}>
            {meta.label}
          </span>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (t) => <StatusBadge status={t.status || 'pending'} />,
    },
    {
      key: 'actions',
      header: '',
      render: (t) => (
        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => setDetailItem(t)} title="View details & comments">
            View
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setEditItem(t)} title="Edit or reassign">
            Edit
          </Button>
          <Button size="sm" variant="danger" onClick={() => handleDeleteTask(t)} title="Delete task">
            ✕
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleExportCsv}>
              Export CSV
            </Button>
            <Button variant="primary" onClick={() => setAssignModalOpen(true)}>
              <span className="material-symbols-outlined text-[18px]">add_task</span>
              <span>+ Assign Task</span>
            </Button>
          </div>
        }
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total Tasks" value={kpis.total} />
        <StatCard label="Pending" value={kpis.pending} />
        <StatCard label="In Progress" value={kpis.inProgress} />
        <StatCard label="Completed" value={kpis.completed} />
        <StatCard
          label="Overdue"
          value={kpis.overdue}
          className={kpis.overdue > 0 ? 'border-rose-300 bg-rose-50/40' : ''}
        />
        <StatCard
          label="High Priority"
          value={kpis.high}
          className={kpis.high > 0 ? 'border-amber-300 bg-amber-50/40' : ''}
        />
      </div>

      {/* Filters Bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Input
              label="Search Tasks"
              placeholder="Search by title, executive, task ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="w-52">
            <Select label="Sales Executive" value={execFilter} onChange={(e) => setExecFilter(e.target.value)}>
              <option value="all">All Sales Executives</option>
              {executives.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} {u.branch ? `(${u.branch})` : ''}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-40">
            <Select label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {titleCase(s)}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-36">
            <Select label="Priority" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="all">All Priorities</option>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {titleCase(p)}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-40">
            <Select label="Due Date" value={dueFilter} onChange={(e) => setDueFilter(e.target.value)}>
              <option value="all">All Dates</option>
              <option value="today">Due Today</option>
              <option value="overdue">Overdue</option>
              <option value="week">Next 7 Days</option>
            </Select>
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearFilters} className="text-slate-600 hover:text-slate-900">
              Clear Filters
            </Button>
          )}
        </div>
      </Card>

      {/* Table */}
      {loading ? (
        <Loader label="Loading tasks…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <Table
          columns={columns}
          rows={filteredTasks}
          empty="No tasks found matching your filters. Click '+ Assign Task' to assign a new task."
          onRowClick={(t) => setDetailItem(t)}
        />
      )}

      {/* MODAL 1: Assign Task */}
      {assignModalOpen && (
        <AssignTaskModal
          executives={executives}
          onClose={() => setAssignModalOpen(false)}
          onDone={() => {
            setAssignModalOpen(false)
            refetch()
          }}
        />
      )}

      {/* MODAL 2: Edit / Reassign Task */}
      {editItem && (
        <EditTaskModal
          task={editItem}
          executives={executives}
          onClose={() => setEditItem(null)}
          onDone={() => {
            setEditItem(null)
            refetch()
          }}
        />
      )}

      {/* MODAL 3: View Details & Comments */}
      {detailItem && (
        <TaskDetailModal
          task={detailItem}
          onClose={() => setDetailItem(null)}
          onUpdated={() => refetch()}
        />
      )}
    </div>
  )
}

// ─── Modal 1: Assign Task ─────────────────────────────────────────────────────
function AssignTaskModal({ executives, onClose, onDone }) {
  const toast = useToast()
  const todayStr = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    title: '',
    assignedTo: executives[0]?._id || '',
    dueDate: todayStr,
    dueTime: '18:00',
    priority: 'medium',
    relatedType: 'none',
    relatedId: '',
    description: '',
  })

  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // Optionally load customers if relatedType is customer or lead
  const { data: rawCustomers } = useFetch(
    useCallback(() => customersApi.list({ limit: 150 }), [])
  )
  const customers = rawCustomers?.data || rawCustomers || []

  async function handleAssign(e) {
    e?.preventDefault()
    if (!form.title.trim()) {
      toast.error('Task title is required')
      return
    }
    if (!form.assignedTo) {
      toast.error('Please select a Sales Executive to assign')
      return
    }
    if (!form.dueDate) {
      toast.error('Due date is required')
      return
    }

    setBusy(true)
    try {
      await tasksApi.create({
        title: form.title.trim(),
        assignedTo: form.assignedTo,
        dueDate: form.dueDate,
        dueTime: form.dueTime || undefined,
        priority: form.priority,
        relatedType: form.relatedType,
        relatedId: form.relatedId || undefined,
        description: form.description.trim(),
      })
      toast.success('Task assigned successfully to sales executive!')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign task')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title="Assign Task to Sales Executive"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleAssign}
            loading={busy}
            disabled={busy || !form.title.trim() || !form.assignedTo || !form.dueDate}
          >
            Assign Task
          </Button>
        </>
      }
    >
      <div className="space-y-4 py-1">
        <div>
          <Input
            label="Task Title *"
            required
            placeholder="e.g. Collect KYC documents from buyer / Complete site inspection"
            value={form.title}
            onChange={set('title')}
          />
        </div>

        <div>
          <Select
            label="Assign To Sales Executive *"
            required
            value={form.assignedTo}
            onChange={set('assignedTo')}
          >
            <option value="">Select a sales executive…</option>
            {executives.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name} {u.branch ? `— ${u.branch}` : ''} ({u.email})
              </option>
            ))}
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Input
              label="Due Date *"
              required
              type="date"
              min={todayStr}
              value={form.dueDate}
              onChange={set('dueDate')}
            />
          </div>
          <div>
            <Input
              label="Due Time (Optional)"
              type="time"
              value={form.dueTime}
              onChange={set('dueTime')}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Select label="Priority *" required value={form.priority} onChange={set('priority')}>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </Select>
          </div>

          <div>
            <Select label="Category / Context" value={form.relatedType} onChange={set('relatedType')}>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {['lead', 'customer'].includes(form.relatedType) && (
          <div>
            <Select label="Link to Customer / Lead" value={form.relatedId} onChange={set('relatedId')}>
              <option value="">Select customer/lead…</option>
              {Array.isArray(customers) &&
                customers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} · {c.mobile} ({c.status || 'lead'})
                  </option>
                ))}
            </Select>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Description &amp; Specific Instructions <span className="text-xs font-normal text-slate-400">(Optional)</span>
          </label>
          <textarea
            rows={3}
            placeholder="Provide any background, requirements, address or checklist for this assignment..."
            value={form.description}
            onChange={set('description')}
            className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 max-h-28 min-h-[64px]"
          />
        </div>
      </div>
    </Modal>
  )
}

// ─── Modal 2: Edit / Reassign Task ─────────────────────────────────────────────
function EditTaskModal({ task, executives, onClose, onDone }) {
  const toast = useToast()
  const [form, setForm] = useState({
    title: task.title || '',
    assignedTo: task.owner?._id || task.owner || '',
    dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : '',
    dueTime: task.dueTime || '',
    priority: task.priority || 'medium',
    status: task.status || 'pending',
    description: task.description || '',
    completionRemarks: task.completionRemarks || '',
  })

  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error('Title is required')
      return
    }

    setBusy(true)
    try {
      await tasksApi.update(task._id, {
        title: form.title.trim(),
        assignedTo: form.assignedTo,
        dueDate: form.dueDate || undefined,
        dueTime: form.dueTime || undefined,
        priority: form.priority,
        status: form.status,
        description: form.description.trim(),
        completionRemarks: form.completionRemarks.trim(),
      })
      toast.success('Task updated successfully')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update task')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`Edit Task · ${taskId(task)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={busy}>
            Save Changes
          </Button>
        </>
      }
    >
      <div className="space-y-4 py-1">
        <div>
          <Input label="Task Title *" required value={form.title} onChange={set('title')} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Select label="Reassign To" value={form.assignedTo} onChange={set('assignedTo')}>
              <option value="">Unassigned</option>
              {executives.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} {u.branch ? `— ${u.branch}` : ''}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Select label="Status *" required value={form.status} onChange={set('status')}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {titleCase(s)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Input label="Due Date" type="date" value={form.dueDate} onChange={set('dueDate')} />
          </div>
          <div>
            <Input label="Due Time" type="time" value={form.dueTime} onChange={set('dueTime')} />
          </div>
          <div>
            <Select label="Priority" value={form.priority} onChange={set('priority')}>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {titleCase(p)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
          <textarea
            rows={2}
            value={form.description}
            onChange={set('description')}
            className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 max-h-24 min-h-[52px]"
          />
        </div>

        {form.status === 'completed' && (
          <div>
            <Input
              label="Completion Remarks"
              placeholder="e.g. Verified and approved on site"
              value={form.completionRemarks}
              onChange={set('completionRemarks')}
            />
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Modal 3: Task Details, Timeline & Comments ──────────────────────────────
function TaskDetailModal({ task, onClose, onUpdated }) {
  const toast = useToast()
  const [commentText, setCommentText] = useState('')
  const [busyComment, setBusyComment] = useState(false)
  const [comments, setComments] = useState(task.comments || [])

  const handleAddComment = async (e) => {
    e?.preventDefault()
    if (!commentText.trim()) return

    setBusyComment(true)
    try {
      const res = await tasksApi.addComment(task._id, { text: commentText.trim() })
      toast.success('Comment added')
      setComments((prev) => [...prev, res.data?.data || res.data || { text: commentText.trim(), at: new Date() }])
      setCommentText('')
      onUpdated?.()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to post comment')
    } finally {
      setBusyComment(false)
    }
  }

  const priorityMeta = PRIORITY_META[task.priority || 'medium'] || PRIORITY_META.medium

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`Task Overview · ${taskId(task)}`}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-5 py-1">
        {/* Header Block */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-slate-900">{task.title}</h3>
            <div className="flex items-center gap-2">
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${priorityMeta.cls}`}>
                {priorityMeta.label} Priority
              </span>
              <StatusBadge status={task.status || 'pending'} />
            </div>
          </div>
          {task.description && <p className="mt-2 text-xs text-slate-700 whitespace-pre-wrap">{task.description}</p>}
        </div>

        {/* Info Grid */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Assigned To</span>
            <p className="mt-1 text-xs font-bold text-slate-800">{task.owner?.name || 'Unassigned'}</p>
            <p className="text-[11px] text-slate-500">{task.owner?.branch || task.owner?.email || ''}</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Assigned By</span>
            <p className="mt-1 text-xs font-bold text-slate-800">{task.assignedByName || task.assignedBy?.name || 'Management'}</p>
            <p className="text-[11px] text-slate-500">{task.assignedByRole ? titleCase(task.assignedByRole) : 'Admin'}</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Due Timeline</span>
            <p className="mt-1 text-xs font-bold text-slate-800">
              {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No due date'}
            </p>
            <p className="text-[11px] text-slate-500">{task.dueTime ? `Due at ${task.dueTime}` : 'All-day task'}</p>
          </div>
        </div>

        {/* Completion Info */}
        {task.status === 'completed' && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-800">
            <span className="font-semibold">✓ Completed:</span>{' '}
            {task.completedAt ? formatDate(task.completedAt, true) : 'Yes'}
            {task.completionRemarks && <p className="mt-1 text-emerald-700">Remarks: {task.completionRemarks}</p>}
          </div>
        )}

        {/* Activity Timeline */}
        {Array.isArray(task.activity) && task.activity.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Activity Timeline</h4>
            <div className="max-h-36 overflow-y-auto space-y-1.5 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
              {task.activity.map((a, i) => (
                <div key={a._id || i} className="flex items-start justify-between text-xs text-slate-600">
                  <span>
                    <strong className="text-slate-800">{a.actorName || 'User'}:</strong> {a.note || a.type}
                  </span>
                  <span className="shrink-0 text-[10px] text-slate-400 ml-2">{formatDate(a.at, true)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comments Section */}
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Comments &amp; Updates</h4>
          <div className="space-y-2 mb-3 max-h-48 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-3">
            {comments.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No comments yet. Post an update or instruction below.</p>
            ) : (
              comments.map((c, i) => (
                <div key={c._id || i} className="rounded border border-white bg-white p-2.5 shadow-xs text-xs">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                    <span className="font-bold text-slate-800">
                      {c.authorName || c.author?.name || 'User'} {c.authorRole ? `(${titleCase(c.authorRole)})` : ''}
                    </span>
                    <span className="text-[10px] text-slate-400">{formatDate(c.at, true)}</span>
                  </div>
                  <p className="text-slate-700 whitespace-pre-wrap">{c.text}</p>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleAddComment} className="flex gap-2">
            <input
              type="text"
              placeholder="Write a comment or instruction for the executive..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <Button size="sm" type="submit" disabled={busyComment || !commentText.trim()}>
              Post
            </Button>
          </form>
        </div>
      </div>
    </Modal>
  )
}

