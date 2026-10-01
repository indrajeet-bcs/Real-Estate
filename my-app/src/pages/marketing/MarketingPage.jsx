import { useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { marketingApi, usersApi, branchesApi, buildersApi, projectsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, formatMoney, titleCase } from '../../lib/format.js'
import {
  PageHeader, Card, StatCard, Button, Input, Textarea, Select, Table, StatusBadge, Modal, Pagination, Loader, ErrorState, ExportMenu,
} from '../../components/ui.jsx'
import {
  ONLINE_MARKETING_TYPES, OFFLINE_MARKETING_TYPES, TASK_STATUSES, TASK_PRIORITIES, CAMPAIGN_STATUSES,
  PRIORITY_COLORS, displayStatus,
} from '../../lib/marketing.js'
import CreateTaskModal from './CreateTaskModal.jsx'
import TaskDetailModal from './TaskDetailModal.jsx'

const ALL_TYPES = [...ONLINE_MARKETING_TYPES, ...OFFLINE_MARKETING_TYPES]

function PriorityPill({ priority }) {
  return <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium}`}>{titleCase(priority)}</span>
}

// CSV / Excel / print helpers (§Reports · Export).
function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
}
function downloadExcel(filename, sections) {
  // Minimal Excel-compatible HTML workbook (opens natively in Excel).
  const tables = sections.map((s) => `<h3>${s.title}</h3><table border="1">${[s.head, ...s.rows].map((r) => `<tr>${r.map((c) => `<td>${c ?? ''}</td>`).join('')}</tr>`).join('')}</table>`).join('<br/>')
  const blob = new Blob([`<html><head><meta charset="utf-8"></head><body>${tables}</body></html>`], { type: 'application/vnd.ms-excel' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
}

export default function MarketingPage({
  title = 'Marketing',
  subtitle = 'Plan, assign and track online & offline marketing activities.',
}) {
  const { can } = useAuth()
  const isManager = can('marketing', 'assign')
  const canCreate = can('marketing', 'create')

  const [searchParams, setSearchParams] = useSearchParams()
  const TABS = useMemo(() => [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'my-tasks', label: 'My Tasks' },
    ...(isManager ? [{ key: 'team-tasks', label: 'Team Tasks' }] : []),
    { key: 'campaigns', label: 'Campaigns' },
    { key: 'activity', label: 'Activity History' },
    { key: 'reports', label: 'Reports' },
  ], [isManager])

  const tabParam = searchParams.get('tab')
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam : 'dashboard'
  const setTab = (t) => setSearchParams((p) => { p.set('tab', t); return p }, { replace: true })

  const [creating, setCreating] = useState(false)
  const [openTaskId, setOpenTaskId] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const bump = () => setReloadKey((k) => k + 1)

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={canCreate && <Button onClick={() => setCreating(true)}>+ Create Task</Button>}
      />

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm transition ${tab === t.key ? 'border-b-2 border-blue-500 font-medium text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab key={reloadKey} onOpenTask={setOpenTaskId} />}
      {tab === 'my-tasks' && <TaskListTab key={`mine-${reloadKey}`} scope="mine" onOpenTask={setOpenTaskId} isManager={isManager} />}
      {tab === 'team-tasks' && isManager && <TaskListTab key={`team-${reloadKey}`} scope="team" onOpenTask={setOpenTaskId} isManager />}
      {tab === 'campaigns' && <CampaignsTab isManager={isManager} onOpenTask={setOpenTaskId} />}
      {tab === 'activity' && <ActivityTab key={reloadKey} />}
      {tab === 'reports' && <ReportsTab key={reloadKey} isManager={isManager} />}

      {creating && <CreateTaskModal onClose={() => setCreating(false)} onDone={() => { setCreating(false); bump() }} />}
      {openTaskId && <TaskDetailModal taskId={openTaskId} onClose={() => setOpenTaskId(null)} onChanged={bump} />}
    </div>
  )
}

// ── Dashboard ────────────────────────────────────────────────────────────────
function Bars({ items, empty = 'No data' }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  if (!items.some((i) => i.value > 0)) return <p className="py-6 text-center text-sm text-slate-400">{empty}</p>
  return (
    <div className="space-y-2">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-3">
          <div className="w-32 shrink-0 truncate text-xs text-slate-600" title={i.label}>{i.label}</div>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${i.color || 'bg-blue-500'}`} style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
          <div className="w-8 shrink-0 text-right text-xs font-medium text-slate-700">{i.value}</div>
        </div>
      ))}
    </div>
  )
}

function DashboardTab({ onOpenTask }) {
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', channel: 'all', status: 'all' })
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }))
  const { data, loading, error, refetch } = useFetch(
    useCallback(() => marketingApi.dashboard(filters), [filters])
  )

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  const k = data.kpis

  const STATUS_COLOR = { draft: 'bg-slate-400', pending: 'bg-amber-400', in_progress: 'bg-sky-500', on_hold: 'bg-orange-400', completed: 'bg-emerald-500', cancelled: 'bg-slate-300' }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="w-40"><Input label="From" type="date" value={filters.dateFrom} onChange={set('dateFrom')} /></div>
        <div className="w-40"><Input label="To" type="date" value={filters.dateTo} onChange={set('dateTo')} /></div>
        <div className="w-40"><Select label="Channel" value={filters.channel} onChange={set('channel')}><option value="all">All</option><option value="online">Online</option><option value="offline">Offline</option></Select></div>
        <div className="w-40"><Select label="Status" value={filters.status} onChange={set('status')}><option value="all">All</option>{TASK_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></div>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total Tasks" value={k.total} />
        <StatCard label="Pending" value={k.pending} />
        <StatCard label="In Progress" value={k.inProgress} />
        <StatCard label="Completed" value={k.completed} />
        <StatCard label="Overdue" value={k.overdue} className={k.overdue ? 'border-red-200' : ''} />
        <StatCard label="My Tasks" value={k.myTasks} />
        <StatCard label="Team Tasks" value={k.teamTasks} />
        <StatCard label="On Hold" value={k.onHold} />
        <StatCard label="Online Activities" value={k.online} />
        <StatCard label="Offline Activities" value={k.offline} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Task Status</h3>
          <Bars items={data.statusDistribution.map((s) => ({ label: titleCase(s.status), value: s.count, color: STATUS_COLOR[s.status] }))} />
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Activity Distribution</h3>
          <Bars items={[
            { label: 'Online', value: data.channelDistribution.find((c) => c.channel === 'online')?.count || 0, color: 'bg-blue-500' },
            { label: 'Offline', value: data.channelDistribution.find((c) => c.channel === 'offline')?.count || 0, color: 'bg-violet-500' },
          ]} />
          <div className="mt-4 border-t border-slate-100 pt-4">
            <Bars items={data.typeDistribution.map((t) => ({ label: titleCase(t.type), value: t.count, color: 'bg-teal-500' }))} empty="No marketing types yet" />
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Employee Productivity</h3>
          {data.employeeProductivity.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No data</p> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="pb-2">Employee</th><th className="pb-2 text-right">Total</th><th className="pb-2 text-right">Done</th><th className="pb-2 text-right">Rate</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.employeeProductivity.map((e) => (
                  <tr key={e.employee}><td className="py-2 text-slate-800">{e.employee}</td><td className="py-2 text-right">{e.total}</td><td className="py-2 text-right">{e.completed}</td><td className="py-2 text-right font-medium text-emerald-600">{e.rate}%</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Campaign Performance</h3>
          {data.campaignPerformance.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No campaign-linked tasks</p> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="pb-2">Campaign</th><th className="pb-2 text-right">Tasks</th><th className="pb-2 text-right">Done</th><th className="pb-2 text-right">Budget</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.campaignPerformance.map((c) => (
                  <tr key={c.campaign}><td className="py-2 text-slate-800">{c.campaign}</td><td className="py-2 text-right">{c.total}</td><td className="py-2 text-right">{c.completed}</td><td className="py-2 text-right">{formatMoney(c.budget)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Upcoming Due Tasks</h3>
          {data.upcomingDue.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Nothing due soon</p> : (
            <div className="space-y-2">
              {data.upcomingDue.map((t) => (
                <button key={t._id} onClick={() => onOpenTask(t._id)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50">
                  <div><div className="font-medium text-slate-800">{t.title}</div><div className="text-xs text-slate-500">{t.code} · {t.owner?.name}</div></div>
                  <div className="text-right"><PriorityPill priority={t.priority} /><div className="mt-0.5 text-xs text-slate-500">{formatDate(t.dueDate, true)}</div></div>
                </button>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Recent Activities</h3>
          {data.recentActivities.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No activity yet</p> : (
            <div className="relative space-y-3 border-l border-slate-200 pl-5">
              {data.recentActivities.map((a) => (
                <div key={a._id} className="relative">
                  <span className="absolute -left-[23px] top-1 h-2.5 w-2.5 rounded-full bg-blue-500" />
                  <div className="text-sm text-slate-800">{a.description}</div>
                  <div className="text-xs text-slate-400">{a.actorName} · {formatDate(a.at, true)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

// ── Task list (My Tasks / Team Tasks) ────────────────────────────────────────
const EMPTY_FILTERS = { search: '', status: 'all', priority: 'all', channel: 'all', marketingType: '', campaign: '', branch: '', assignedTo: '', taskType: 'all', dateFrom: '', dateTo: '', sortBy: 'newest' }

function TaskListTab({ scope, onOpenTask, isManager }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const set = (k) => (e) => { setFilters((f) => ({ ...f, [k]: e.target.value })); setPage(1) }

  const { data, meta, loading, error, refetch } = useFetch(
    useCallback(() => marketingApi.listTasks({ scope, page, limit, ...filters }), [scope, page, limit, filters])
  )
  const { data: campaigns } = useFetch(useCallback(() => marketingApi.listCampaigns(), []))
  const { data: employees } = useFetch(useCallback(() => (scope === 'team' && isManager ? usersApi.list({ status: 'active', limit: 300 }) : Promise.resolve({ data: { data: [] } })), [scope, isManager]))
  const { data: branches } = useFetch(useCallback(() => (scope === 'team' && isManager ? branchesApi.list() : Promise.resolve({ data: { data: [] } })), [scope, isManager]))

  const columns = [
    { key: 'code', header: 'Task', render: (t) => (
      <div><div className="font-medium text-slate-900">{t.title}</div><div className="text-xs text-slate-400">{t.code} · {titleCase(t.marketingType)}</div></div>
    ) },
    { key: 'channel', header: 'Channel', render: (t) => <span className="capitalize">{t.channel}</span> },
    { key: 'status', header: 'Status', render: (t) => <StatusBadge status={displayStatus(t)} /> },
    { key: 'priority', header: 'Priority', render: (t) => <PriorityPill priority={t.priority} /> },
    { key: 'due', header: 'Due', render: (t) => t.dueDate ? formatDate(t.dueDate) : '—' },
    { key: 'branch', header: 'Branch', render: (t) => t.branch || '—' },
    { key: 'owner', header: 'Owner', render: (t) => t.owner?.name || t.ownerName || '—' },
    { key: 'createdBy', header: 'Created By', render: (t) => t.createdBy?.name || t.createdByName || '—' },
    { key: 'type', header: 'Type', render: (t) => <span className={`rounded border px-2 py-0.5 text-xs ${t.isSelfTask ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>{t.isSelfTask ? 'Self' : 'Assigned'}</span> },
    { key: 'updated', header: 'Updated', render: (t) => formatDate(t.updatedAt) },
  ]

  return (
    <div className="space-y-4">
      {/* Sticky filter bar */}
      <Card className="sticky top-0 z-10 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[180px] flex-1"><Input label="Search" placeholder="Title or task ID" value={filters.search} onChange={set('search')} /></div>
        <div className="w-36"><Select label="Status" value={filters.status} onChange={set('status')}><option value="all">All</option>{[...TASK_STATUSES, 'overdue'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></div>
        <div className="w-32"><Select label="Priority" value={filters.priority} onChange={set('priority')}><option value="all">All</option>{TASK_PRIORITIES.map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}</Select></div>
        <div className="w-32"><Select label="Channel" value={filters.channel} onChange={set('channel')}><option value="all">All</option><option value="online">Online</option><option value="offline">Offline</option></Select></div>
        <div className="w-44"><Select label="Marketing Type" value={filters.marketingType} onChange={set('marketingType')}><option value="">All</option>{ALL_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</Select></div>
        <div className="w-40"><Select label="Campaign" value={filters.campaign} onChange={set('campaign')}><option value="">All</option>{(campaigns || []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select></div>
        <div className="w-32"><Select label="Task Type" value={filters.taskType} onChange={set('taskType')}><option value="all">All</option><option value="assigned">Assigned</option><option value="self">Self</option></Select></div>
        {scope === 'team' && isManager && (
          <>
            <div className="w-40"><Select label="Employee" value={filters.assignedTo} onChange={set('assignedTo')}><option value="">All</option>{(employees || []).map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}</Select></div>
            <div className="w-36"><Select label="Branch" value={filters.branch} onChange={set('branch')}><option value="">All</option>{(branches || []).map((b) => <option key={b._id} value={b.name}>{b.name}</option>)}</Select></div>
          </>
        )}
        <div className="w-36"><Select label="Sort" value={filters.sortBy} onChange={set('sortBy')}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="due">Due date</option></Select></div>
        <Button variant="secondary" onClick={() => { setFilters(EMPTY_FILTERS); setPage(1) }}>Reset</Button>
      </Card>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <>
          <div className="text-sm text-slate-500">{meta?.total ?? 0} task{(meta?.total ?? 0) === 1 ? '' : 's'}</div>
          <Table columns={columns} rows={data || []} onRowClick={(t) => onOpenTask(t._id)} empty={scope === 'team' ? 'No team tasks match your filters.' : 'You have no marketing tasks yet. Use “+ Create Task” to add one.'} />
          <Pagination meta={meta} onPage={setPage} onPageSize={(n) => { setLimit(n); setPage(1) }} />
        </>
      )}
    </div>
  )
}

// ── Campaigns ────────────────────────────────────────────────────────────────
const isDisabled = (status) => ['paused', 'cancelled'].includes(status)

function CampaignsTab({ isManager, onOpenTask }) {
  const toast = useToast()
  const { data, loading, error, refetch } = useFetch(useCallback(() => marketingApi.listCampaigns(), []))
  const [editing, setEditing] = useState(null) // {} for new, campaign for edit
  const [openId, setOpenId] = useState(null)    // campaign detail view

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  async function remove(c) {
    if (!window.confirm(`Delete campaign "${c.name}"? Linked tasks are kept and detached.`)) return
    try { await marketingApi.removeCampaign(c._id); toast.success('Campaign deleted'); refetch() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }
  async function toggleDisable(c) {
    const disabling = !isDisabled(c.status)
    try { await marketingApi.updateCampaign(c._id, { status: disabling ? 'paused' : 'active' }); toast.success(disabling ? 'Campaign disabled' : 'Campaign enabled'); refetch() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }

  // Internal detail page (clicking a card).
  if (openId) {
    return (
      <CampaignDetail
        campaignId={openId}
        isManager={isManager}
        onOpenTask={onOpenTask}
        onBack={() => { setOpenId(null); refetch() }}
        onListChanged={refetch}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Campaigns are optional groupings — tasks work without them. Click a campaign to open it.</p>
        {isManager && <Button onClick={() => setEditing({})}>+ New Campaign</Button>}
      </div>
      {(data || []).length === 0 ? (
        <Card className="py-16 text-center text-sm text-slate-400">No campaigns yet.</Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => {
            const pct = c.taskCount ? Math.round((c.completedCount / c.taskCount) * 100) : 0
            return (
              <Card key={c._id} className="cursor-pointer p-5 transition hover:border-blue-400 hover:shadow-md" onClick={() => setOpenId(c._id)}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">{c.name}</h3>
                  <StatusBadge status={c.status} />
                </div>
                {c.description && <p className="mb-3 text-sm text-slate-500 line-clamp-2">{c.description}</p>}
                <dl className="grid grid-cols-2 gap-y-1 text-xs text-slate-500">
                  <span>Budget: {formatMoney(c.budget)}</span>
                  <span>Tasks: {c.taskCount}</span>
                  <span>Start: {c.startDate ? formatDate(c.startDate) : '—'}</span>
                  <span>End: {c.endDate ? formatDate(c.endDate) : '—'}</span>
                </dl>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Progress</span><span>{c.completedCount}/{c.taskCount} · {pct}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
                </div>
                {isManager && (
                  <div className="mt-4 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="secondary" onClick={() => setEditing(c)}>Edit</Button>
                    <Button size="sm" variant="secondary" onClick={() => toggleDisable(c)}>{isDisabled(c.status) ? 'Enable' : 'Disable'}</Button>
                    <Button size="sm" variant="danger" onClick={() => remove(c)}>Delete</Button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
      {editing && <CampaignModal campaign={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); refetch() }} />}
    </div>
  )
}

// Internal campaign detail — info, progress, linked tasks + manager actions.
function CampaignDetail({ campaignId, isManager, onBack, onOpenTask, onListChanged }) {
  const toast = useToast()
  const { data, loading, error, refetch } = useFetch(useCallback(() => marketingApi.getCampaign(campaignId), [campaignId]))
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  const { campaign, tasks } = data
  const done = tasks.filter((t) => t.status === 'completed').length
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0
  const disabled = isDisabled(campaign.status)

  async function toggleDisable() {
    setBusy(true)
    try { await marketingApi.updateCampaign(campaign._id, { status: disabled ? 'active' : 'paused' }); toast.success(disabled ? 'Campaign enabled' : 'Campaign disabled'); refetch(); onListChanged?.() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') } finally { setBusy(false) }
  }
  async function del() {
    if (!window.confirm(`Delete campaign "${campaign.name}"? Linked tasks are kept and detached.`)) return
    try { await marketingApi.removeCampaign(campaign._id); toast.success('Campaign deleted'); onListChanged?.(); onBack() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }

  const info = [
    ['Status', <StatusBadge key="s" status={campaign.status} />],
    ['Budget', formatMoney(campaign.budget)],
    ['Builder', campaign.builder?.name || '—'],
    ['Project', campaign.project?.name || '—'],
    ['Branch', campaign.branch || '—'],
    ['Tasks', tasks.length],
    ['Start', campaign.startDate ? formatDate(campaign.startDate) : '—'],
    ['End', campaign.endDate ? formatDate(campaign.endDate) : '—'],
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={onBack} className="text-sm text-slate-600 hover:text-slate-900">← Back to campaigns</button>
        {isManager && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
            <Button size="sm" variant="secondary" onClick={toggleDisable} disabled={busy}>{disabled ? 'Enable' : 'Disable'}</Button>
            <Button size="sm" variant="danger" onClick={del}>Delete</Button>
          </div>
        )}
      </div>

      <Card className="p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{campaign.name}</h2>
            {campaign.description && <p className="mt-1 text-sm text-slate-500">{campaign.description}</p>}
          </div>
          {disabled && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">Disabled</span>}
        </div>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {info.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
              <dd className="mt-1 text-sm text-slate-800">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5">
          <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Progress</span><span>{done}/{tasks.length} completed · {pct}%</span></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Tasks in this campaign ({tasks.length})</h3>
        {tasks.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No tasks linked to this campaign yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="py-2 pr-4 font-medium">Task</th><th className="py-2 pr-4 font-medium">Type</th><th className="py-2 pr-4 font-medium">Status</th><th className="py-2 pr-4 font-medium">Priority</th><th className="py-2 pr-4 font-medium">Due</th><th className="py-2 font-medium">Owner</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map((t) => (
                  <tr key={t._id} className="cursor-pointer hover:bg-slate-50" onClick={() => onOpenTask?.(t._id)}>
                    <td className="py-2 pr-4"><div className="font-medium text-slate-900">{t.title}</div><div className="text-xs text-slate-400">{t.code}</div></td>
                    <td className="py-2 pr-4 text-slate-600">{titleCase(t.marketingType)}</td>
                    <td className="py-2 pr-4"><StatusBadge status={displayStatus(t)} /></td>
                    <td className="py-2 pr-4"><PriorityPill priority={t.priority} /></td>
                    <td className="py-2 pr-4 text-slate-600">{t.dueDate ? formatDate(t.dueDate) : '—'}</td>
                    <td className="py-2 text-slate-600">{t.owner?.name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && <CampaignModal campaign={campaign} onClose={() => setEditing(false)} onDone={() => { setEditing(false); refetch(); onListChanged?.() }} />}
    </div>
  )
}

function CampaignModal({ campaign, onClose, onDone }) {
  const toast = useToast()
  const isNew = !campaign._id
  const [form, setForm] = useState({
    name: campaign.name || '', description: campaign.description || '', budget: campaign.budget || '',
    startDate: campaign.startDate ? campaign.startDate.slice(0, 10) : '', endDate: campaign.endDate ? campaign.endDate.slice(0, 10) : '',
    status: campaign.status || 'planned', branch: campaign.branch || '',
    builder: campaign.builder?._id || campaign.builder || '',
    project: campaign.project?._id || campaign.project || '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // Option sources: builders, projects (filtered by builder), branches.
  const { data: builders } = useFetch(useCallback(() => buildersApi.list({ limit: 200 }), []))
  const { data: projects } = useFetch(useCallback(() => projectsApi.list({ limit: 300 }), []))
  const { data: branches } = useFetch(useCallback(() => branchesApi.list(), []))

  // Selecting a builder scopes the Project dropdown to that builder's projects and
  // clears a project that no longer belongs to the chosen builder.
  const projectsForBuilder = (projects || []).filter((p) => !form.builder || String(p.builder?._id || p.builder) === String(form.builder))
  const onBuilderChange = (e) => {
    const builder = e.target.value
    setForm((f) => {
      const stillValid = (projects || []).some((p) => String(p._id) === String(f.project) && String(p.builder?._id || p.builder) === String(builder))
      return { ...f, builder, project: stillValid ? f.project : '' }
    })
  }

  async function save() {
    if (form.name.trim().length < 2) { toast.error('Campaign name is required'); return }
    setBusy(true)
    try {
      const payload = {
        name: form.name, description: form.description || undefined, budget: form.budget !== '' ? Number(form.budget) : undefined,
        startDate: form.startDate || undefined, endDate: form.endDate || undefined, status: form.status,
        branch: form.branch || undefined, builder: form.builder || undefined, project: form.project || undefined,
      }
      if (isNew) await marketingApi.createCampaign(payload)
      else await marketingApi.updateCampaign(campaign._id, payload)
      toast.success(isNew ? 'Campaign created' : 'Campaign updated')
      onDone()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed') }
    finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} wide title={isNew ? 'New Campaign' : `Edit — ${campaign.name}`} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{isNew ? 'Create' : 'Save'}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Input label="Campaign Name *" value={form.name} onChange={set('name')} /></div>
        <Input label="Budget (₹)" type="number" value={form.budget} onChange={set('budget')} />
        <Select label="Status" value={form.status} onChange={set('status')}>{CAMPAIGN_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select>
        <Select label="Builder" value={form.builder} onChange={onBuilderChange}>
          <option value="">All builders</option>
          {(builders || []).map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
        </Select>
        <Select label="Project" value={form.project} onChange={set('project')} disabled={!form.builder}>
          <option value="">{form.builder ? 'Select project…' : 'Select a builder first'}</option>
          {projectsForBuilder.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </Select>
        <Input label="Start Date" type="date" value={form.startDate} onChange={set('startDate')} />
        <Input label="End Date" type="date" value={form.endDate} onChange={set('endDate')} />
        <Select label="Branch" value={form.branch} onChange={set('branch')}>
          <option value="">— None —</option>
          {(branches || []).map((b) => <option key={b._id} value={b.name}>{b.name}</option>)}
        </Select>
        <div className="sm:col-span-2"><Textarea label="Description" value={form.description} onChange={set('description')} /></div>
      </div>
    </Modal>
  )
}

// ── Activity History ─────────────────────────────────────────────────────────
function ActivityTab() {
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', action: 'all' })
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(30)
  const set = (k) => (e) => { setFilters((f) => ({ ...f, [k]: e.target.value })); setPage(1) }
  const { data, meta, loading, error, refetch } = useFetch(useCallback(() => marketingApi.activity({ ...filters, page, limit }), [filters, page, limit]))

  const columns = [
    { key: 'at', header: 'Date & Time', render: (r) => formatDate(r.at, true) },
    { key: 'user', header: 'User', render: (r) => <span>{r.user}{r.role ? ` · ${titleCase(r.role)}` : ''}</span> },
    { key: 'action', header: 'Activity', render: (r) => titleCase(r.action) },
    { key: 'description', header: 'Details', render: (r) => r.description || '—' },
  ]

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="w-44"><Input label="From" type="date" value={filters.dateFrom} onChange={set('dateFrom')} /></div>
        <div className="w-44"><Input label="To" type="date" value={filters.dateTo} onChange={set('dateTo')} /></div>
        <div className="w-44"><Select label="Action" value={filters.action} onChange={set('action')}><option value="all">All</option>{['create', 'update', 'status_change', 'assign', 'delete'].map((a) => <option key={a} value={a}>{titleCase(a)}</option>)}</Select></div>
      </Card>
      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <>
          <Table columns={columns} rows={data || []} empty="No activity recorded." />
          <Pagination meta={meta} onPage={setPage} onPageSize={(n) => { setLimit(n); setPage(1) }} />
        </>
      )}
    </div>
  )
}

// ── Reports ──────────────────────────────────────────────────────────────────
function ReportsTab({ isManager }) {
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', channel: 'all', status: '' })
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }))
  const { data, loading, error, refetch } = useFetch(useCallback(() => marketingApi.reports(filters), [filters]))

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  const sections = {
    employee: { title: 'Employee Performance', head: ['Employee', 'Assigned', 'Self', 'Total', 'Completed', 'Completion %'], rows: data.employeePerformance.map((e) => [e.employee, e.assigned, e.self, e.total, e.completed, e.completionRate + '%']) },
    campaign: { title: 'Campaign Report', head: ['Campaign', 'Status', 'Tasks', 'Completed', 'Planned Budget', 'Task Budget'], rows: data.campaignReport.map((c) => [c.campaign, titleCase(c.status || ''), c.total, c.completed, c.plannedBudget, c.taskBudget]) },
    online: { title: 'Online Marketing Report', head: ['Type', 'Total', 'Completed'], rows: data.onlineReport.map((t) => [titleCase(t.type), t.total, t.completed]) },
    offline: { title: 'Offline Marketing Report', head: ['Type', 'Total', 'Completed'], rows: data.offlineReport.map((t) => [titleCase(t.type), t.total, t.completed]) },
    branch: { title: 'Branch Marketing Report', head: ['Branch', 'Total', 'Completed'], rows: data.branchReport.map((b) => [b.branch, b.total, b.completed]) },
  }
  const allSections = Object.values(sections)

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="w-44"><Input label="From" type="date" value={filters.dateFrom} onChange={set('dateFrom')} /></div>
        <div className="w-44"><Input label="To" type="date" value={filters.dateTo} onChange={set('dateTo')} /></div>
        <div className="w-40"><Select label="Channel" value={filters.channel} onChange={set('channel')}><option value="all">All</option><option value="online">Online</option><option value="offline">Offline</option></Select></div>
        <div className="w-40"><Select label="Status" value={filters.status} onChange={set('status')}><option value="">All</option>{TASK_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></div>
        <div className="ml-auto">
          <ExportMenu items={[
            { key: 'csv', label: 'CSV', icon: 'description', onClick: () => downloadCSV('marketing-reports.csv', allSections.flatMap((s) => [[s.title], s.head, ...s.rows, []])) },
            { key: 'excel', label: 'Excel', icon: 'table_view', onClick: () => downloadExcel('marketing-reports.xls', allSections) },
            { key: 'print', label: 'Print / PDF', icon: 'print', onClick: () => window.print() },
          ]} />
        </div>
      </Card>

      {/* Task completion summary */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Completed" value={data.taskCompletion.completed} />
        <StatCard label="On-time" value={data.taskCompletion.onTime} />
        <StatCard label="Late" value={data.taskCompletion.late} />
        <StatCard label="On-time Rate" value={`${data.taskCompletion.completed ? Math.round((data.taskCompletion.onTime / data.taskCompletion.completed) * 100) : 0}%`} />
      </div>

      {allSections.map((s) => (
        <Card key={s.title} className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">{s.title}</h3>
            <ExportMenu size="sm" items={[
              { key: 'csv', label: 'CSV', icon: 'description', onClick: () => downloadCSV(`${s.title.replace(/\s+/g, '-').toLowerCase()}.csv`, [s.head, ...s.rows]) },
              { key: 'excel', label: 'Excel', icon: 'table_view', onClick: () => downloadExcel(`${s.title.replace(/\s+/g, '-').toLowerCase()}.xls`, [s]) },
              { key: 'print', label: 'Print / PDF', icon: 'print', onClick: () => window.print() },
            ]} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500"><tr>{s.head.map((h) => <th key={h} className="py-2 pr-4 font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {s.rows.length === 0 ? <tr><td colSpan={s.head.length} className="py-6 text-center text-slate-400">No data</td></tr> : s.rows.map((r, i) => (
                  <tr key={i}>{r.map((c, j) => <td key={j} className="py-2 pr-4 text-slate-700">{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  )
}
