import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { followupsApi, projectsApi, customersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, formatMoney, titleCase } from '../../lib/format.js'
import {
  PageHeader, Button, Card, Select, Input, StatusBadge, Modal, Loader, ErrorState,
} from '../../components/ui.jsx'

// ─── Type / Stage / Status lookup tables ──────────────────────────────────────

const TYPE_MAP = {
  call:               { label: 'Call',                icon: '📞', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  whatsapp:           { label: 'WhatsApp',            icon: '💬', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  email:              { label: 'Email',               icon: '📧', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  meeting:            { label: 'Office Meeting',      icon: '🏢', color: 'text-purple-700 bg-purple-50 border-purple-200' },
  visit:              { label: 'Site Visit',          icon: '🚗', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  document:           { label: 'Document Collection', icon: '📄', color: 'text-teal-700 bg-teal-50 border-teal-200' },
  payment:            { label: 'Payment Reminder',    icon: '💰', color: 'text-rose-700 bg-rose-50 border-rose-200' },
  negotiation:        { label: 'Negotiation',         icon: '🤝', color: 'text-orange-700 bg-orange-50 border-orange-200' },
  booking_discussion: { label: 'Booking Discussion',  icon: '📝', color: 'text-sky-700 bg-sky-50 border-sky-200' },
  loan_assistance:    { label: 'Loan Assistance',     icon: '🏦', color: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
  callback:           { label: 'Callback',            icon: '📱', color: 'text-slate-700 bg-slate-100 border-slate-200' },
  greeting:           { label: 'Greeting',            icon: '🎉', color: 'text-pink-700 bg-pink-50 border-pink-200' },
  re_engagement:      { label: 'Re-engagement',       icon: '🔄', color: 'text-lime-700 bg-lime-50 border-lime-200' },
  other:              { label: 'Other',               icon: '📋', color: 'text-zinc-700 bg-zinc-50 border-zinc-200' },
}

const STAGE_MAP = {
  new:                   { label: 'New Lead',              color: 'bg-blue-50 text-blue-700 border-blue-200' },
  in_progress:           { label: 'Contacted',             color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  follow_up_due:         { label: 'Follow-up',             color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  site_visit_scheduled:  { label: 'Site Visit Scheduled',  color: 'bg-purple-50 text-purple-700 border-purple-200' },
  visited:               { label: 'Visited',               color: 'bg-pink-50 text-pink-700 border-pink-200' },
  negotiation:           { label: 'Negotiation',           color: 'bg-amber-50 text-amber-700 border-amber-200' },
  booking_initiated:     { label: 'Booking Initiated',     color: 'bg-orange-50 text-orange-700 border-orange-200' },
  booked:                { label: 'Booked',                color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  lost:                  { label: 'Lost',                  color: 'bg-red-50 text-red-700 border-red-200' },
  cancelled:             { label: 'Cancelled',             color: 'bg-slate-100 text-slate-500 border-slate-200' },
}

const STATUS_META = {
  scheduled:   { label: 'Pending',     color: 'bg-amber-50 text-amber-700 border-amber-200' },
  completed:   { label: 'Completed',   color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  missed:      { label: 'Missed',      color: 'bg-rose-50 text-rose-700 border-rose-200' },
  rescheduled: { label: 'Rescheduled', color: 'bg-purple-50 text-purple-700 border-purple-200' },
}

// ─── Small KPI summary tile ────────────────────────────────────────────────────
function KpiTile({ label, value, accent }) {
  return (
    <div className={`flex flex-col gap-1 rounded-xl border px-4 py-3 shadow-sm ${accent}`}>
      <span className="text-2xl font-bold leading-none tracking-tight">{value}</span>
      <span className="text-[11px] font-semibold uppercase tracking-wider opacity-75">{label}</span>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function FollowUpsPage() {
  const toast    = useToast()
  const navigate = useNavigate()

  // ── filters (local, applied client-side after a single large fetch) ──
  const [statusFilter,    setStatusFilter]    = useState('all')
  const [typeFilter,      setTypeFilter]      = useState('all')
  const [priorityFilter,  setPriorityFilter]  = useState('all')
  const [stageFilter,     setStageFilter]     = useState('all')
  const [projectFilter,   setProjectFilter]   = useState('all')
  const [dateRange,       setDateRange]       = useState('all')
  const [search,          setSearch]          = useState('')

  // ── active modal states ──
  const [completeItem,  setCompleteItem]  = useState(null)
  const [rescheduleItem, setRescheduleItem] = useState(null)
  const [missItem,      setMissItem]      = useState(null)
  const [detailsItem,   setDetailsItem]   = useState(null)
  const [showCreate,    setShowCreate]    = useState(false)

  // ── data ──
  const { data: projects } = useFetch(
    useCallback(() => projectsApi.list({ limit: 100 }), [])
  )

  const { data: rawList, loading, error, refetch } = useFetch(
    useCallback(() => followupsApi.list({ limit: 500 }), [])
  )

  // ── derive KPI counts ──
  const now        = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999)

  const kpi = { today: 0, pending: 0, completed: 0, missed: 0, rescheduled: 0, overdue: 0, high: 0 }
  ;(rawList || []).forEach((r) => {
    const s = new Date(r.scheduledAt)
    const pending = r.status === 'scheduled'
    if (pending) kpi.pending++
    if (r.status === 'completed')   kpi.completed++
    if (r.status === 'missed')      kpi.missed++
    if (r.status === 'rescheduled') kpi.rescheduled++
    if (pending && s >= todayStart && s <= todayEnd) kpi.today++
    if (pending && s < todayStart)  kpi.overdue++
    if (pending && r.priority === 'high') kpi.high++
  })

  // ── filter list client-side ──
  const list = (rawList || []).filter((r) => {
    const s       = new Date(r.scheduledAt)
    const pending = r.status === 'scheduled'

    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (typeFilter    !== 'all' && (r.type || 'call') !== typeFilter) return false
    if (priorityFilter !== 'all' && r.priority !== priorityFilter) return false
    if (stageFilter !== 'all' && (r.customer?.status || 'new') !== stageFilter) return false
    if (projectFilter !== 'all') {
      const pid = r.project?._id || r.project
      if (String(pid) !== projectFilter) return false
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      if (!r.customer?.name?.toLowerCase().includes(q) && !r.customer?.mobile?.includes(q)) return false
    }
    if (dateRange !== 'all') {
      if (dateRange === 'today')    { if (s < todayStart || s > todayEnd) return false }
      if (dateRange === 'overdue')  { if (!pending || s >= todayStart) return false }
      if (dateRange === 'tomorrow') {
        const t0 = new Date(todayStart); t0.setDate(t0.getDate() + 1)
        const t1 = new Date(todayEnd);   t1.setDate(t1.getDate() + 1)
        if (s < t0 || s > t1) return false
      }
      if (dateRange === 'week') {
        const w1 = new Date(todayEnd); w1.setDate(w1.getDate() + 7)
        if (s < todayStart || s > w1) return false
      }
    }
    return true
  })

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Follow-up Workspace"
          subtitle="Track, record, and manage every customer interaction (§6)"
        />
        <Button onClick={() => setShowCreate(true)}>+ New Follow-up</Button>
      </div>

      {/* ── Overdue / Today alerts ── */}
      {kpi.overdue > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span className="mt-px text-base">🚨</span>
          <div>
            <strong>{kpi.overdue} overdue follow-up{kpi.overdue > 1 ? 's' : ''}</strong> — these are past their scheduled date.
            Please complete, reschedule, or mark them missed.
          </div>
        </div>
      )}
      {kpi.today > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <span className="mt-px text-base">📅</span>
          <div>
            <strong>{kpi.today} follow-up{kpi.today > 1 ? 's' : ''} due today</strong> — stay on top of your schedule.
          </div>
        </div>
      )}

      {/* ── KPI Summary Strip ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <KpiTile label="Today"       value={kpi.today}       accent="border-blue-200  bg-blue-50/60  text-blue-800"  />
        <KpiTile label="Pending"     value={kpi.pending}     accent="border-amber-200 bg-amber-50/60 text-amber-800" />
        <KpiTile label="Completed"   value={kpi.completed}   accent="border-emerald-200 bg-emerald-50/60 text-emerald-800" />
        <KpiTile label="Missed"      value={kpi.missed}      accent="border-rose-200  bg-rose-50/60  text-rose-800"  />
        <KpiTile label="Rescheduled" value={kpi.rescheduled} accent="border-purple-200 bg-purple-50/60 text-purple-800" />
        <KpiTile label="Overdue"     value={kpi.overdue}     accent="border-red-200   bg-red-50/60   text-red-800"   />
        <KpiTile label="High Priority" value={kpi.high}      accent="border-orange-200 bg-orange-50/60 text-orange-800" />
      </div>

      {/* ── Filter Bar ── */}
      <Card className="p-4">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">Filter Workspace</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">

          <div className="col-span-2 sm:col-span-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Search</label>
            <Input
              placeholder="Name or mobile…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {[
            { label: 'Status', value: statusFilter, setter: setStatusFilter, opts: [
              ['all','All statuses'], ['scheduled','Pending'], ['completed','Completed'],
              ['missed','Missed'], ['rescheduled','Rescheduled'],
            ]},
            { label: 'Type', value: typeFilter, setter: setTypeFilter, opts: [
              ['all','All types'],
              ...Object.entries(TYPE_MAP).map(([k,v]) => [k, `${v.icon} ${v.label}`]),
            ]},
            { label: 'Priority', value: priorityFilter, setter: setPriorityFilter, opts: [
              ['all','All priorities'], ['low','Low'], ['medium','Medium'], ['high','High'],
            ]},
            { label: 'Stage', value: stageFilter, setter: setStageFilter, opts: [
              ['all','All stages'],
              ...Object.entries(STAGE_MAP).map(([k,v]) => [k, v.label]),
            ]},
            { label: 'Project', value: projectFilter, setter: setProjectFilter, opts: [
              ['all','All projects'],
              ...(projects || []).map((p) => [p._id, p.name]),
            ]},
            { label: 'Date Range', value: dateRange, setter: setDateRange, opts: [
              ['all','All dates'], ['today','Today'], ['tomorrow','Tomorrow'],
              ['week','This Week'], ['overdue','Overdue'],
            ]},
          ].map(({ label, value, setter, opts }) => (
            <div key={label}>
              <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
              <Select value={value} onChange={(e) => setter(e.target.value)}>
                {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Content ── */}
      {loading ? (
        <Loader />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : list.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/40 py-20 text-center">
          <div className="mb-4 text-5xl">📋</div>
          <h3 className="text-lg font-semibold text-slate-800">No follow-ups scheduled</h3>
          <p className="mt-1 max-w-xs text-sm text-slate-500">
            No follow-ups match the current filters. Adjust filters or create a new task.
          </p>
          <Button className="mt-6" onClick={() => setShowCreate(true)}>+ Create Follow-up</Button>
        </div>
      ) : (
        /* Card Grid */
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {list.map((item) => (
            <FollowUpCard
              key={item._id}
              item={item}
              todayStart={todayStart}
              todayEnd={todayEnd}
              onComplete={() => setCompleteItem(item)}
              onReschedule={() => setRescheduleItem(item)}
              onMiss={() => setMissItem(item)}
              onDetails={() => setDetailsItem(item)}
            />
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {completeItem  && <CompleteModal   item={completeItem}   onClose={() => setCompleteItem(null)}   onDone={() => { setCompleteItem(null);   refetch() }} />}
      {rescheduleItem && <RescheduleModal item={rescheduleItem} onClose={() => setRescheduleItem(null)} onDone={() => { setRescheduleItem(null); refetch() }} />}
      {missItem      && <MissModal       item={missItem}       onClose={() => setMissItem(null)}       onDone={() => { setMissItem(null);       refetch() }} />}
      {detailsItem   && <DetailsDrawer   item={detailsItem}    onClose={() => setDetailsItem(null)} navigate={navigate} />}
      {showCreate    && <CreateModal     projects={projects || []} onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); refetch() }} />}
    </div>
  )
}

// ─── Individual Follow-up Card ─────────────────────────────────────────────────
function FollowUpCard({ item, todayStart, todayEnd, onComplete, onReschedule, onMiss, onDetails }) {
  const sched    = new Date(item.scheduledAt)
  const isPending = item.status === 'scheduled'
  const isOverdue = isPending && sched < todayStart
  const isToday   = isPending && sched >= todayStart && sched <= todayEnd

  const typeMeta   = TYPE_MAP[item.type || 'call']   || TYPE_MAP.other
  const stageMeta  = STAGE_MAP[item.customer?.status] || STAGE_MAP.new
  const statusMeta = STATUS_META[item.status]         || STATUS_META.scheduled

  const projName  = item.project?.name || '—'
  const purpose   = item.purpose || item.notes || 'Routine follow-up'
  const lastSummary = item.lastFollowupSummary
    || (item.customer?.notes?.length ? item.customer.notes[item.customer.notes.length - 1].text : 'No previous interaction recorded.')

  const borderColor = isOverdue ? 'border-l-rose-500'
    : isToday   ? 'border-l-blue-500'
    : 'border-l-slate-300'

  return (
    <div className={`flex flex-col overflow-hidden rounded-xl border border-slate-200 border-l-4 ${borderColor} bg-white shadow-sm transition-shadow hover:shadow-md`}>

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4">
        <div className="min-w-0">
          <button
            onClick={onDetails}
            className="truncate text-left text-base font-semibold text-slate-900 hover:text-blue-600 transition-colors"
          >
            {item.customer?.name || '—'}
          </button>
          <p className="mt-0.5 truncate text-xs font-medium text-slate-500">🏢 {projName}</p>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${typeMeta.color}`}>
            {typeMeta.icon} {typeMeta.label}
          </span>
          {stageMeta && (
            <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${stageMeta.color}`}>
              {stageMeta.label}
            </span>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 space-y-4 p-5">

        {/* Purpose */}
        <div>
          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Purpose</p>
          <p className="text-sm font-medium leading-snug text-slate-800">{purpose}</p>
        </div>

        {/* Schedule + Priority + Status */}
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-100 bg-slate-50/40 p-3">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Scheduled</p>
            <p className={`text-xs font-semibold ${isOverdue ? 'text-rose-600' : isToday ? 'text-blue-600' : 'text-slate-700'}`}>
              🕒 {formatDate(item.scheduledAt, true)}
              {isOverdue && <span className="ml-1 text-[10px]">(Overdue)</span>}
              {isToday   && <span className="ml-1 text-[10px]">(Today)</span>}
            </p>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Priority & Status</p>
            <div className="flex flex-wrap items-center gap-1">
              <StatusBadge status={item.priority} />
              <span className={`inline-block rounded-full border px-2 py-px text-[10px] font-semibold ${statusMeta.color}`}>
                {statusMeta.label}
              </span>
            </div>
          </div>
        </div>

        {/* Last interaction */}
        <div>
          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Last Interaction</p>
          <p className="line-clamp-2 text-xs italic leading-relaxed text-slate-600">"{lastSummary}"</p>
        </div>
      </div>

      {/* ── Footer / Actions ── */}
      <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-slate-100 bg-slate-50/30 px-5 py-3">
        <Button size="sm" variant="ghost" onClick={onDetails}>View Details</Button>
        {isPending && (
          <>
            <Button size="sm" variant="danger"     onClick={onMiss}>Miss</Button>
            <Button size="sm" variant="secondary"  onClick={onReschedule}>Reschedule</Button>
            <Button size="sm" variant="success"    onClick={onComplete}>Complete</Button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Complete Modal ────────────────────────────────────────────────────────────
function CompleteModal({ item, onClose, onDone }) {
  const toast = useToast()
  const [outcome,      setOutcome]      = useState('Customer Answered')
  const [remarks,      setRemarks]      = useState('')
  const [nextRequired, setNextRequired] = useState(false)
  const [nextType,     setNextType]     = useState('call')
  const [nextDate,     setNextDate]     = useState('')
  const [nextTime,     setNextTime]     = useState('')
  const [nextPriority, setNextPriority] = useState('medium')
  const [reminder,     setReminder]     = useState(false)
  const [busy,         setBusy]         = useState(false)

  async function save() {
    setBusy(true)
    try {
      const payload = { outcome, remarks, nextFollowUpRequired: nextRequired }
      if (nextRequired) {
        if (!nextDate || !nextTime) { toast.error('Please set next date & time'); setBusy(false); return }
        payload.nextFollowUp = {
          type: nextType,
          scheduledAt: new Date(`${nextDate}T${nextTime}`).toISOString(),
          priority: nextPriority,
          notes: `Follow-up via ${TYPE_MAP[nextType]?.label || nextType} – auto-created`,
        }
      }
      await followupsApi.complete(item._id, payload)
      toast.success('Follow-up marked as completed')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title="Complete Follow-up"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save & Complete'}</Button></>}
    >
      <div className="space-y-5">

        {/* Outcome */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Follow-up Outcome <span className="text-rose-500">*</span></label>
          <Select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            {['Customer Answered','Customer Didn\'t Answer','Phone Switched Off','Busy','Interested','Not Interested','Requested Site Visit','Requested Callback','Booking Confirmed','Other'].map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </Select>
        </div>

        {/* Remarks */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Remarks</label>
          <textarea
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Summarise what was discussed…"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Next follow-up toggle */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Schedule Next Follow-up?</span>
            <div className="flex gap-2">
              {[true, false].map((v) => (
                <button key={String(v)} type="button" onClick={() => setNextRequired(v)}
                  className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
                    nextRequired === v ? 'bg-blue-600 text-white shadow' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {v ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
          </div>

          {nextRequired && (
            <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Type</label>
                <Select value={nextType} onChange={(e) => setNextType(e.target.value)}>
                  {Object.entries(TYPE_MAP).map(([k,v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Priority</label>
                <Select value={nextPriority} onChange={(e) => setNextPriority(e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Date <span className="text-rose-500">*</span></label>
                <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Time <span className="text-rose-500">*</span></label>
                <Input type="time" value={nextTime} onChange={(e) => setNextTime(e.target.value)} />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input id="nf_reminder" type="checkbox" checked={reminder} onChange={(e) => setReminder(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="nf_reminder" className="cursor-pointer text-xs text-slate-600">
                  Assign push notification reminder
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ─── Reschedule Modal ──────────────────────────────────────────────────────────
function RescheduleModal({ item, onClose, onDone }) {
  const toast = useToast()
  const [date,     setDate]     = useState('')
  const [time,     setTime]     = useState('')
  const [reason,   setReason]   = useState('')
  const [priority, setPriority] = useState(item.priority || 'medium')
  const [reminder, setReminder] = useState(false)
  const [busy,     setBusy]     = useState(false)

  async function save() {
    if (!date || !time) { toast.error('Please set date and time'); return }
    setBusy(true)
    try {
      await followupsApi.reschedule(item._id, {
        scheduledAt: new Date(`${date}T${time}`).toISOString(),
        reason,
        priority,
      })
      toast.success('Follow-up rescheduled')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title="Reschedule Follow-up"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save & Reschedule'}</Button></>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">New Date <span className="text-rose-500">*</span></label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">New Time <span className="text-rose-500">*</span></label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Reason for Rescheduling</label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this being rescheduled?"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={reminder} onChange={(e) => setReminder(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          Set a reminder notification for the new date
        </label>
      </div>
    </Modal>
  )
}

// ─── Miss Modal ────────────────────────────────────────────────────────────────
function MissModal({ item, onClose, onDone }) {
  const toast = useToast()
  const [reason, setReason] = useState('Customer Unreachable')
  const [busy,   setBusy]   = useState(false)

  async function save() {
    setBusy(true)
    try {
      await followupsApi.miss(item._id, { reason })
      toast.success('Follow-up marked as missed')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title="Mark as Missed"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="danger" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Confirm Missed'}</Button></>}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          This will escalate a notification to your team manager and log the missed task on the customer timeline.
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Reason <span className="text-rose-500">*</span></label>
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            {['Customer Unreachable','Busy','Wrong Number','Executive Busy','Other'].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
        </div>
      </div>
    </Modal>
  )
}

// ─── Details Side Drawer ───────────────────────────────────────────────────────
function DetailsDrawer({ item, onClose, navigate }) {
  const toast = useToast()
  const [cust, setCust]   = useState(item.customer || {})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const id = item.customer?._id
    if (!id) { setLoading(false); return }
    ;(async () => {
      try {
        const { data } = await customersApi.get(id)
        if (alive) setCust(data.data || item.customer)
      } catch { /* keep partial data */ }
      finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [item.customer?._id])   // eslint-disable-line

  const projName = item.project?.name || '—'

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* backdrop */}
      <div className="flex-1 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />

      {/* panel */}
      <div className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-white shadow-2xl">
        {/* header */}
        <div className="flex items-start justify-between bg-slate-900 px-6 py-5 text-white">
          <div>
            <h2 className="text-lg font-bold">{cust.name || '—'}</h2>
            <p className="mt-0.5 text-xs text-slate-400">360° Customer Profile</p>
          </div>
          <button onClick={onClose} className="mt-0.5 rounded-lg p-1 text-slate-400 hover:text-white transition">✕</button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center"><Loader /></div>
        ) : (
          <div className="flex-1 space-y-6 overflow-y-auto p-6">

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => toast.success(`Calling ${cust.name} on ${cust.mobile}…`)}
                className="flex flex-col items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 py-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                <span className="text-xl">📞</span> Call
              </button>
              <a
                href={`https://wa.me/${(cust.mobile || '').replace(/\D/g, '')}`}
                target="_blank" rel="noreferrer"
                className="flex flex-col items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                <span className="text-xl">💬</span> WhatsApp
              </a>
              <button
                onClick={() => navigate(`/executive/customers/${cust._id}`)}
                className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 py-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                <span className="text-xl">👤</span> Profile
              </button>
            </div>

            {/* Customer Info */}
            <Section title="Customer Information">
              <Info2Col rows={[
                ['Name',       cust.name || '—'],
                ['Mobile',     cust.mobile || '—'],
                ['Project',    projName],
                ['Budget',     cust.budgetMin ? `${formatMoney(cust.budgetMin)} – ${formatMoney(cust.budgetMax)}` : 'Not specified'],
                ['Location',   cust.address || 'Not specified'],
                ['Stage',      cust.status ? titleCase(cust.status) : '—'],
              ]} />
            </Section>

            {/* Notes */}
            <Section title="Notes">
              {(cust.notes || []).length === 0 ? (
                <p className="text-xs italic text-slate-400">No notes yet.</p>
              ) : (
                <div className="space-y-2">
                  {(cust.notes || []).slice(-5).reverse().map((n) => (
                    <div key={n._id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        <span>{titleCase(n.type || 'note')}</span>
                        <span>{formatDate(n.createdAt)}</span>
                      </div>
                      <p className="text-xs text-slate-700">{n.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Activity / Communication Timeline */}
            <Section title="Last 5 Interactions">
              {(cust.activity || []).length === 0 ? (
                <p className="text-xs italic text-slate-400">No activity logged.</p>
              ) : (
                <ol className="relative ml-2 border-l border-slate-200 space-y-4 pl-5">
                  {(cust.activity || []).slice(-5).reverse().map((a) => (
                    <li key={a._id} className="relative">
                      <span className="absolute -left-[22px] top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white bg-blue-500" />
                      <p className="text-xs font-semibold text-slate-800">{titleCase(a.action)}</p>
                      <p className="mt-0.5 text-xs text-slate-600">{a.description}</p>
                      <time className="text-[10px] text-slate-400">{formatDate(a.at, true)}</time>
                    </li>
                  ))}
                </ol>
              )}
            </Section>

          </div>
        )}
      </div>
    </div>
  )
}

// ─── Create Follow-up Modal ────────────────────────────────────────────────────
function CreateModal({ projects, onClose, onDone }) {
  const toast = useToast()
  const [customers,  setCustomers]  = useState([])
  const [customerId, setCustomerId] = useState('')
  const [type,       setType]       = useState('call')
  const [projectId,  setProjectId]  = useState('')
  const [date,       setDate]       = useState('')
  const [time,       setTime]       = useState('')
  const [priority,   setPriority]   = useState('medium')
  const [purpose,    setPurpose]    = useState('')
  const [busy,       setBusy]       = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await customersApi.list({ limit: 200 }) // server now allows up to 500
        const list = data.data || []
        setCustomers(list)
        if (list.length) setCustomerId(list[0]._id)
      } catch { toast.error('Could not load customers') }
    })()
  }, [])  // eslint-disable-line

  async function save(e) {
    e.preventDefault()
    if (!customerId || !date || !time) { toast.error('Fill all required fields'); return }
    setBusy(true)
    try {
      await followupsApi.create({
        customer: customerId,
        scheduledAt: new Date(`${date}T${time}`).toISOString(),
        priority,
        type,
        purpose,
        notes: purpose,
        project: projectId || undefined,
      })
      toast.success('Follow-up created')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title="Create Follow-up"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? 'Scheduling…' : 'Create'}</Button></>}
    >
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Customer <span className="text-rose-500">*</span></label>
          <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Select customer…</option>
            {customers.map((c) => <option key={c._id} value={c._id}>{c.name} — {c.mobile}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {Object.entries(TYPE_MAP).map(([k,v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Project</label>
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">None / General</option>
              {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Date <span className="text-rose-500">*</span></label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Time <span className="text-rose-500">*</span></label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Purpose <span className="text-rose-500">*</span></label>
          <Input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="e.g. Discuss booking amount, send floor plan…"
            required
          />
        </div>
      </form>
    </Modal>
  )
}

// ─── Drawer helpers ────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div>
      <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</h4>
      {children}
    </div>
  )
}

function Info2Col({ rows }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
          <dd className="mt-0.5 text-sm font-medium text-slate-800">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
