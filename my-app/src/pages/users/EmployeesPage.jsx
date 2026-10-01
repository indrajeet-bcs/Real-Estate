import { useState, useCallback } from 'react'
import { usersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, titleCase } from '../../lib/format.js'
import {
  PageHeader, Button, Input, Select, Table, Pagination, Modal, Loader, ErrorState,
} from '../../components/ui.jsx'

// Staff management. `role` fixes which role this page creates: sub-admins (Admin
// view) or sales executives (Sub-Admin view).
export default function EmployeesPage({ role = 'sales_executive', title = 'Employees', subtitle }) {
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [showCreate, setShowCreate] = useState(false)
  const [reassignFor, setReassignFor] = useState(null)

  const { data, meta, loading, error, refetch } = useFetch(
    useCallback(() => usersApi.list({ page, limit, role }), [page, limit, role])
  )

  async function toggleActive(u) {
    try {
      if (u.isActive) {
        // May be blocked with 409 requiring reassignment (§15).
        await usersApi.deactivate(u._id)
        toast.success('Deactivated')
      } else {
        await usersApi.activate(u._id)
        toast.success('Activated')
      }
      refetch()
    } catch (err) {
      if (err.response?.status === 409 && err.response.data?.details?.reason === 'active_leads') {
        setReassignFor({ user: u, openLeads: err.response.data.details.openLeads })
      } else {
        toast.error(err.response?.data?.message || 'Failed')
      }
    }
  }

  const columns = [
    { key: 'name', header: 'Name', render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
    { key: 'email', header: 'Email' },
    { key: 'branch', header: 'Branch', render: (r) => r.branch || '—' },
    { key: 'isActive', header: 'Status', render: (r) => (
      <span className={r.isActive ? 'text-emerald-600' : 'text-red-600'}>{r.isActive ? 'Active' : 'Inactive'}</span>
    ) },
    { key: 'lastLoginAt', header: 'Last Login', render: (r) => formatDate(r.lastLoginAt, true) },
    { key: 'actions', header: '', render: (r) => (
      <Button size="sm" variant={r.isActive ? 'danger' : 'success'} onClick={() => toggleActive(r)}>
        {r.isActive ? 'Deactivate' : 'Activate'}
      </Button>
    ) },
  ]

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} actions={<Button onClick={() => setShowCreate(true)}>+ Add {titleCase(role)}</Button>} />

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <>
          <Table columns={columns} rows={data || []} empty="No staff yet" />
          <Pagination meta={meta} onPage={setPage} onPageSize={(n) => { setLimit(n); setPage(1) }} />
        </>
      )}

      {showCreate && <CreateModal role={role} onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); refetch() }} />}
      {reassignFor && (
        <ReassignModal
          info={reassignFor}
          onClose={() => setReassignFor(null)}
          onDone={() => { setReassignFor(null); refetch() }}
        />
      )}
    </div>
  )
}

function CreateModal({ role, onClose, onDone }) {
  const toast = useToast()
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', branch: '', role })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    try {
      await usersApi.create(form)
      toast.success('User created')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Add ${titleCase(role)}`} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy || !form.name || !form.email || form.password.length < 8}>Create</Button>
      </>
    }>
      <div className="space-y-4">
        <Input label="Full name" value={form.name} onChange={set('name')} />
        <Input label="Email" type="email" value={form.email} onChange={set('email')} />
        <Input label="Password (min 8 chars)" type="password" value={form.password} onChange={set('password')} />
        <Input label="Phone" value={form.phone} onChange={set('phone')} />
        <Input label="Branch" value={form.branch} onChange={set('branch')} />
      </div>
    </Modal>
  )
}

// Mandatory reassignment before disabling a user who holds open leads (§15).
function ReassignModal({ info, onClose, onDone }) {
  const toast = useToast()
  const { data: peers } = useFetch(useCallback(() => usersApi.list({ role: info.user.role, status: 'active', limit: 100 }), [info.user.role]))
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)

  async function confirm() {
    if (!target) return
    setBusy(true)
    try {
      await usersApi.deactivate(info.user._id, target)
      toast.success('Leads reassigned and user deactivated')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const options = (peers || []).filter((p) => p._id !== info.user._id)

  return (
    <Modal open onClose={onClose} title="Reassignment Required" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={confirm} disabled={busy || !target}>Reassign & Deactivate</Button>
      </>
    }>
      <p className="mb-4 text-sm text-slate-700">
        <strong className="text-slate-900">{info.user.name}</strong> has{' '}
        <strong className="text-amber-600">{info.openLeads}</strong> open lead(s). Reassign them before deactivating.
      </p>
      <Select label="Reassign leads to" value={target} onChange={(e) => setTarget(e.target.value)}>
        <option value="">Select a colleague…</option>
        {options.map((p) => <option key={p._id} value={p._id}>{p.name} · {p.email}</option>)}
      </Select>
    </Modal>
  )
}
