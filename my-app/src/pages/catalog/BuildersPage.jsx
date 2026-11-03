import { useState, useCallback } from 'react'
import { buildersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate } from '../../lib/format.js'
import { PageHeader, Button, Input, Table, Pagination, Modal, Loader, ErrorState } from '../../components/ui.jsx'

// `readOnly` (Super Admin) hides all mutating actions — view-only across firms (§3).
export default function BuildersPage({ readOnly = false }) {
  const { can } = useAuth()
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [showCreate, setShowCreate] = useState(false)

  const { data, meta, loading, error, refetch } = useFetch(
    useCallback(() => buildersApi.list({ page, limit }), [page, limit]),
    { autoRefresh: false }  // disable background polling so inFlight guard never blocks manual page navigation
  )

  async function archive(id) {
    if (!window.confirm('Archive this builder? It stays as a read-only reference.')) return
    await buildersApi.archive(id)
    toast.success('Builder archived')
    refetch()
  }

  const columns = [
    { key: 'name', header: 'Builder', render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
    ...(readOnly ? [] : [
      { key: 'contactPerson', header: 'Contact', render: (r) => r.contactPerson || '—' },
      { key: 'phone', header: 'Phone', render: (r) => r.phone || '—' },
    ]),
    { key: 'createdAt', header: 'Added', render: (r) => formatDate(r.createdAt) },
    ...(!readOnly && can('builder', 'delete') ? [{
      key: 'actions', header: '', render: (r) => (
        <Button size="sm" variant="danger" onClick={() => archive(r._id)}>Archive</Button>
      ),
    }] : []),
  ]

  return (
    <div>
      <PageHeader
        title="Builders"
        subtitle={readOnly ? 'View-only across all firms (§3)' : 'Manage builders for your firm'}
        actions={!readOnly && can('builder', 'create') && <Button onClick={() => setShowCreate(true)}>+ Add Builder</Button>}
      />
      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <>
          <Table columns={columns} rows={data || []} empty="No builders yet" />
          <Pagination meta={meta} onPage={setPage} onPageSize={(n) => { setLimit(n); setPage(1) }} />
        </>
      )}
      {showCreate && <CreateBuilderModal onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); refetch() }} />}
    </div>
  )
}

function CreateBuilderModal({ onClose, onDone }) {
  const toast = useToast()
  const [form, setForm] = useState({ name: '', contactPerson: '', phone: '', email: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    try {
      await buildersApi.create(form)
      toast.success('Builder added')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Add Builder" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy || !form.name}>Create</Button>
      </>
    }>
      <div className="space-y-4">
        <Input label="Builder name" value={form.name} onChange={set('name')} />
        <Input label="Contact person" value={form.contactPerson} onChange={set('contactPerson')} />
        <Input label="Phone" value={form.phone} onChange={set('phone')} />
        <Input label="Email" type="email" value={form.email} onChange={set('email')} />
      </div>
    </Modal>
  )
}
