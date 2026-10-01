import { useState, useCallback } from 'react'
import { visitsApi, customersApi, projectsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate } from '../../lib/format.js'
import {
  PageHeader, Button, Select, Input, Textarea, Table, Pagination, StatusBadge, Modal, Loader, ErrorState,
} from '../../components/ui.jsx'

// Shared visits page. When `oversight` is true (sub-admin), adds a flag-missed
// action and hides the create button.
export default function VisitsPage({ oversight = false }) {
  const { can } = useAuth()
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [scope, setScope] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [conduct, setConduct] = useState(null)

  const { data, meta, loading, error, refetch } = useFetch(
    useCallback(() => visitsApi.list({ page, limit, scope }), [page, limit, scope])
  )

  async function cancel(id) {
    const reason = window.prompt('Reason for cancellation?')
    if (!reason) return
    await visitsApi.cancel(id, { reason })
    toast.success('Visit cancelled')
    refetch()
  }
  async function flagMissed(id) {
    await visitsApi.flagMissed(id)
    toast.success('Flagged as missed')
    refetch()
  }

  const columns = [
    { key: 'customer', header: 'Customer', render: (r) => r.customer?.name || '—' },
    { key: 'project', header: 'Project', render: (r) => r.project?.name || '—' },
    { key: 'scheduledAt', header: 'Scheduled', render: (r) => formatDate(r.scheduledAt, true) },
    ...(oversight ? [{ key: 'assignedTo', header: 'Executive', render: (r) => r.assignedTo?.name || '—' }] : []),
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: '', render: (r) => r.status === 'scheduled' && (
      <div className="flex gap-2">
        {!oversight && <Button size="sm" variant="success" onClick={() => setConduct(r)}>Conduct</Button>}
        {!oversight && <Button size="sm" variant="danger" onClick={() => cancel(r._id)}>Cancel</Button>}
        {oversight && <Button size="sm" variant="secondary" onClick={() => flagMissed(r._id)}>Flag Missed</Button>}
      </div>
    ) },
  ]

  return (
    <div>
      <PageHeader
        title={oversight ? 'Site Visit Oversight' : 'Site Visits'}
        subtitle={oversight ? 'Team visits — flag missed (§5)' : 'Create visits, capture outcomes (§6)'}
        actions={!oversight && can('visit', 'create') && <Button onClick={() => setShowCreate(true)}>+ New Visit</Button>}
      />
      <div className="mb-4 w-48">
        <Select value={scope} onChange={(e) => { setPage(1); setScope(e.target.value) }}>
          <option value="">All</option>
          <option value="upcoming">Upcoming</option>
          <option value="missed">Overdue/Missed</option>
        </Select>
      </div>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <>
          <Table columns={columns} rows={data || []} empty="No site visits" />
          <Pagination meta={meta} onPage={setPage} onPageSize={(n) => { setLimit(n); setPage(1) }} />
        </>
      )}

      {showCreate && <CreateVisitModal onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); refetch() }} />}
      {conduct && <ConductModal visit={conduct} onClose={() => setConduct(null)} onDone={() => { setConduct(null); refetch() }} />}
    </div>
  )
}

function CreateVisitModal({ onClose, onDone }) {
  const toast = useToast()
  const { data: customers } = useFetch(useCallback(() => customersApi.list({ limit: 100 }), []))
  const { data: projects } = useFetch(useCallback(() => projectsApi.list({ limit: 100 }), []))
  const [form, setForm] = useState({ customer: '', project: '', scheduledAt: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    try {
      await visitsApi.create(form)
      toast.success('Visit scheduled')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="New Site Visit" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy || !form.customer || !form.project || !form.scheduledAt}>Schedule</Button>
      </>
    }>
      <div className="space-y-4">
        <Select label="Customer" value={form.customer} onChange={set('customer')}>
          <option value="">Select…</option>
          {(customers || []).map((c) => <option key={c._id} value={c._id}>{c.name} · {c.mobile}</option>)}
        </Select>
        <Select label="Project" value={form.project} onChange={set('project')}>
          <option value="">Select…</option>
          {(projects || []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </Select>
        <Input label="Date & time" type="datetime-local" value={form.scheduledAt} onChange={set('scheduledAt')} />
      </div>
    </Modal>
  )
}

function ConductModal({ visit, onClose, onDone }) {
  const toast = useToast()
  const [outcome, setOutcome] = useState('')
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!outcome.trim()) return
    setBusy(true)
    try {
      await visitsApi.conduct(visit._id, { outcome, remarks })
      toast.success('Outcome captured')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Capture Visit Outcome" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy}>Save</Button>
      </>
    }>
      <div className="space-y-4">
        <Input label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="e.g. Interested, wants pricing" />
        <Textarea label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </div>
    </Modal>
  )
}
