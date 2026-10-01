import { useState, useCallback, useEffect } from 'react'
import { projectsApi, buildersApi, unitsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { formatMoney } from '../../lib/format.js'
import { PageHeader, Button, Input, Select, Table, Pagination, StatusBadge, Modal, Loader, ErrorState } from '../../components/ui.jsx'

export default function ProjectsPage({ readOnly = false }) {
  const { can } = useAuth()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [showCreate, setShowCreate] = useState(false)
  const [manageUnits, setManageUnits] = useState(null)

  const { data, meta, loading, error, refetch } = useFetch(
    useCallback(() => projectsApi.list({ page, limit }), [page, limit])
  )

  const columns = [
    { key: 'name', header: 'Project', render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
    ...(readOnly ? [] : [{ key: 'builder', header: 'Builder', render: (r) => r.builder?.name || '—' }]),
    { key: 'location', header: 'Location', render: (r) => r.location || '—' },
    { key: 'propertyType', header: 'Type', render: (r) => r.propertyType || '—' },
    ...(!readOnly ? [{
      key: 'actions', header: '', render: (r) => (
        <Button size="sm" variant="secondary" onClick={() => setManageUnits(r)}>Units</Button>
      ),
    }] : []),
  ]

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle={readOnly ? 'View-only across all firms (§3)' : 'Projects and inventory for your firm'}
        actions={!readOnly && can('project', 'create') && <Button onClick={() => setShowCreate(true)}>+ Add Project</Button>}
      />
      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <>
          <Table columns={columns} rows={data || []} empty="No projects yet" />
          <Pagination meta={meta} onPage={setPage} onPageSize={(n) => { setLimit(n); setPage(1) }} />
        </>
      )}
      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); refetch() }} />}
      {manageUnits && <UnitsModal project={manageUnits} onClose={() => setManageUnits(null)} />}
    </div>
  )
}

function CreateProjectModal({ onClose, onDone }) {
  const toast = useToast()
  const { data: builders } = useFetch(useCallback(() => buildersApi.list({ limit: 100 }), []))
  const [form, setForm] = useState({ name: '', builder: '', location: '', city: '', propertyType: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    try {
      await projectsApi.create(form)
      toast.success('Project created')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Add Project" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy || !form.name || !form.builder}>Create</Button>
      </>
    }>
      <div className="space-y-4">
        <Input label="Project name" value={form.name} onChange={set('name')} />
        <Select label="Builder" value={form.builder} onChange={set('builder')}>
          <option value="">Select builder…</option>
          {(builders || []).map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
        </Select>
        <Input label="Location" value={form.location} onChange={set('location')} />
        <Input label="City" value={form.city} onChange={set('city')} />
        <Input label="Property type" value={form.propertyType} onChange={set('propertyType')} placeholder="apartment / villa / plot" />
      </div>
    </Modal>
  )
}

// Inventory management for a project — list units, add one.
function UnitsModal({ project, onClose }) {
  const toast = useToast()
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ unitNumber: '', unitType: '', price: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const load = useCallback(() => {
    setLoading(true)
    unitsApi.list({ project: project._id, limit: 100 })
      .then((res) => setUnits(res.data.data))
      .finally(() => setLoading(false))
  }, [project._id])

  useEffect(() => { load() }, [load])

  async function addUnit() {
    if (!form.unitNumber) return
    setBusy(true)
    try {
      await unitsApi.create({ project: project._id, ...form, price: form.price ? Number(form.price) : undefined })
      toast.success('Unit added')
      setForm({ unitNumber: '', unitType: '', price: '' })
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    { key: 'unitNumber', header: 'Unit', render: (r) => <span className="font-medium text-slate-900">{r.unitNumber}</span> },
    { key: 'unitType', header: 'Type', render: (r) => r.unitType || '—' },
    { key: 'price', header: 'Price', render: (r) => formatMoney(r.price) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <Modal open onClose={onClose} title={`Inventory — ${project.name}`} wide>
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 p-4">
        <Input label="Unit number" value={form.unitNumber} onChange={set('unitNumber')} />
        <Input label="Type" value={form.unitType} onChange={set('unitType')} placeholder="2BHK" />
        <Input label="Price" type="number" value={form.price} onChange={set('price')} />
        <Button onClick={addUnit} disabled={busy}>Add Unit</Button>
      </div>
      {loading ? <Loader /> : <Table columns={columns} rows={units} empty="No units yet" />}
    </Modal>
  )
}
