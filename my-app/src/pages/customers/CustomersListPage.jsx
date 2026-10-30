import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { customersApi, usersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useDebounce } from '../../hooks/useDebounce.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { ROLES, CUSTOMER_STATUS } from '../../lib/constants.js'
import { formatDate, titleCase } from '../../lib/format.js'
import {
  PageHeader, Button, Input, Select, Table, Pagination, StatusBadge,
  Loader, ErrorState, Modal,
} from '../../components/ui.jsx'

const STATUS_OPTIONS = ['all', ...Object.values(CUSTOMER_STATUS)]

// Shared customers list. `basePath` sets where row-click navigates for the
// 360° profile (differs per role). `title`/`subtitle` describe the context.
export default function CustomersListPage({ title = 'My Customers', subtitle, basePath }) {
  const { can, user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const isManager = user?.role === ROLES.ADMIN || user?.role === ROLES.SUB_ADMIN

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [status, setStatus] = useState('all')
  const [priority, setPriority] = useState('all')
  const [assignedTo, setAssignedTo] = useState('all')
  const [sort, setSort] = useState('newest')
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounce(searchInput)
  const [showCreate, setShowCreate] = useState(false)

  const { data, meta, loading, error, refetch } = useFetch(
    useCallback(() => customersApi.list({
      page, limit, search,
      status: status === 'all' ? undefined : status,
      priority: priority === 'all' ? undefined : priority,
      assignedTo: assignedTo === 'all' ? undefined : assignedTo,
    }), [page, limit, status, priority, assignedTo, search])
  )
  const { data: execs } = useFetch(useCallback(() => (isManager ? usersApi.list({ role: 'sales_executive', status: 'active', limit: 200 }) : Promise.resolve({ data: { data: [] } })), [isManager]))

  // Sort the loaded page (server returns newest-first).
  const rows = useMemo(() => {
    const arr = [...(data || [])]
    if (sort === 'oldest') arr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    else if (sort === 'name') arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    return arr
  }, [data, sort])

  const columns = [
    { key: 'name', header: 'Customer', render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
    { key: 'mobile', header: 'Mobile' },
    { key: 'source', header: 'Lead Source', render: (r) => titleCase(r.source) },
    { key: 'assignedTo', header: 'Assigned Employee', render: (r) => r.assignedTo?.name || '—' },
    { key: 'status', header: 'Customer Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'bookingStatus', header: 'Booking Status', render: (r) => r.bookingStatus ? <StatusBadge status={r.bookingStatus} /> : '—' },
    { key: 'lastFollowUp', header: 'Last Follow-up', render: (r) => r.lastFollowUp ? formatDate(r.lastFollowUp) : '—' },
    { key: 'nextFollowUp', header: 'Next Follow-up', render: (r) => r.nextFollowUp ? formatDate(r.nextFollowUp) : '—' },
    { key: 'createdAt', header: 'Created', render: (r) => formatDate(r.createdAt) },
  ]

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          can('lead', 'create') && (
            <Button onClick={() => setShowCreate(true)}>+ New Lead</Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-56">
          <Input label="Search" placeholder="Name / mobile / email" value={searchInput} onChange={(e) => { setPage(1); setSearchInput(e.target.value) }} />
        </div>
        <div className="w-44">
          <Select label="Customer Status" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value) }}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : titleCase(s)}</option>)}
          </Select>
        </div>
        <div className="w-36">
          <Select label="Priority" value={priority} onChange={(e) => { setPage(1); setPriority(e.target.value) }}>
            <option value="all">All</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </Select>
        </div>
        {isManager && (
          <div className="w-48">
            <Select label="Assigned Employee" value={assignedTo} onChange={(e) => { setPage(1); setAssignedTo(e.target.value) }}>
              <option value="all">All</option>
              {(execs || []).map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
            </Select>
          </div>
        )}
        <div className="w-40">
          <Select label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest</option><option value="oldest">Oldest</option><option value="name">Name (A–Z)</option>
          </Select>
        </div>
      </div>

      {loading ? (
        <Loader />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <>
          <Table
            columns={columns}
            rows={rows}
            empty="No customers found"
            onRowClick={(r) => navigate(`${basePath}/${r._id}`)}
          />
          <Pagination meta={meta} onPage={setPage} onPageSize={(n) => { setLimit(n); setPage(1) }} />
        </>
      )}

      {showCreate && (
        <CreateLeadModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); toast.success('Lead created'); refetch() }}
        />
      )}
    </div>
  )
}

function CreateLeadModal({ onClose, onCreated }) {
  const toast = useToast()
  const [form, setForm] = useState({ name: '', mobile: '', email: '', source: 'walk_in' })
  const [touched, setTouched] = useState({ mobile: false })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleMobileChange = (e) => {
    let val = e.target.value.replace(/\D/g, '')
    if (val.length === 12 && val.startsWith('91')) {
      val = val.slice(2)
    } else if (val.length === 11 && val.startsWith('0')) {
      val = val.slice(1)
    }
    val = val.slice(0, 10)
    setForm((f) => ({ ...f, mobile: val }))
  }

  const isMobileValid = /^[6-9]\d{9}$/.test(form.mobile)
  const mobileError = (() => {
    if (!touched.mobile && !form.mobile) return ''
    if (!form.mobile) return 'Mobile number is required'
    if (form.mobile.length < 10) return `Mobile number must be exactly 10 digits (${form.mobile.length}/10)`
    if (!/^[6-9]/.test(form.mobile)) return 'Mobile number must start with 6, 7, 8, or 9'
    return ''
  })()

  async function submit(e) {
    e.preventDefault()
    setTouched({ mobile: true })
    if (!isMobileValid) {
      toast.error('Please enter a valid 10-digit mobile number starting with 6-9')
      return
    }
    setBusy(true)
    try {
      await customersApi.create(form)
      onCreated()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create lead')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New Lead"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy || form.name.trim().length < 2 || !isMobileValid}>
            {busy ? 'Saving…' : 'Create'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Input label="Full name" required value={form.name} onChange={set('name')} />
        <Input
          label="Mobile"
          required
          type="tel"
          placeholder="10-digit mobile number"
          maxLength={10}
          value={form.mobile}
          onChange={handleMobileChange}
          onBlur={() => setTouched((t) => ({ ...t, mobile: true }))}
          error={mobileError}
        />
        <Input label="Email" type="email" value={form.email} onChange={set('email')} />
        <Select label="Source" value={form.source} onChange={set('source')}>
          {['walk_in', 'website', 'referral', 'social_media', 'call', 'portal', 'other'].map((s) => (
            <option key={s} value={s}>{titleCase(s)}</option>
          ))}
        </Select>
      </form>
    </Modal>
  )
}
