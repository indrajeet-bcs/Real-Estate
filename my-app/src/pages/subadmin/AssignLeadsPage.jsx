import { useState, useCallback } from 'react'
import { customersApi, usersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { titleCase } from '../../lib/format.js'
import { PageHeader, Card, Button, Select, Table, Pagination, StatusBadge, Loader, ErrorState } from '../../components/ui.jsx'

// Bulk assignment (§5): select unassigned/new leads, pick one executive
// (individual) or several (round-robin), assign, notify.
export default function AssignLeadsPage() {
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [selected, setSelected] = useState(new Set())
  const [mode, setMode] = useState('individual')
  const [oneExec, setOneExec] = useState('')
  const [pool, setPool] = useState(new Set())
  const [busy, setBusy] = useState(false)

  const { data, meta, loading, error, refetch } = useFetch(
    useCallback(() => customersApi.list({ page, limit, status: 'new' }), [page, limit])
  )
  const { data: execs } = useFetch(useCallback(() => usersApi.list({ role: 'sales_executive', status: 'active', limit: 100 }), []))

  function toggle(id) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function togglePool(id) {
    setPool((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function assign() {
    if (selected.size === 0) return toast.error('Select at least one lead')
    const body = { customerIds: [...selected] }
    if (mode === 'individual') {
      if (!oneExec) return toast.error('Pick an executive')
      body.executiveId = oneExec
    } else {
      if (pool.size === 0) return toast.error('Pick executives for round-robin')
      body.executiveIds = [...pool]
    }
    setBusy(true)
    try {
      const res = await customersApi.assign(body)
      toast.success(`${res.data.data.assigned} lead(s) assigned`)
      setSelected(new Set())
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    { key: 'sel', header: '', render: (r) => (
      <input type="checkbox" checked={selected.has(r._id)} onChange={() => toggle(r._id)} onClick={(e) => e.stopPropagation()} />
    ) },
    { key: 'name', header: 'Name', render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
    { key: 'mobile', header: 'Mobile' },
    { key: 'source', header: 'Source', render: (r) => titleCase(r.source) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <div>
      <PageHeader title="Assign Leads" subtitle="Individual or round-robin assignment to executives (§5)" />

      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-56">
            <Select label="Mode" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="individual">Individual — one executive</option>
              <option value="round_robin">Bulk — round-robin</option>
            </Select>
          </div>

          {mode === 'individual' ? (
            <div className="w-64">
              <Select label="Executive" value={oneExec} onChange={(e) => setOneExec(e.target.value)}>
                <option value="">Select…</option>
                {(execs || []).map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
              </Select>
            </div>
          ) : (
            <div>
              <span className="mb-1 block text-sm font-medium text-slate-700">Executives (round-robin)</span>
              <div className="flex flex-wrap gap-2">
                {(execs || []).map((x) => (
                  <button
                    key={x._id}
                    onClick={() => togglePool(x._id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${
                      pool.has(x._id) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-700'
                    }`}
                  >
                    {x.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button onClick={assign} disabled={busy}>Assign {selected.size > 0 ? `(${selected.size})` : ''}</Button>
        </div>
      </Card>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <>
          <Table columns={columns} rows={data || []} empty="No unassigned leads" />
          <Pagination meta={meta} onPage={setPage} onPageSize={(n) => { setLimit(n); setPage(1) }} />
        </>
      )}
    </div>
  )
}
