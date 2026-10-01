import { useState, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader, Table, Pagination, ExportMenu, Button, Input, Select, StatusBadge, Loader, ErrorState } from '../../components/ui.jsx'
import { REGISTRATION_STATUSES, REGISTRATION_TYPES } from '../../lib/registrationConstants.js'
import { registrationsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useDebounce } from '../../hooks/useDebounce.js'
import { formatDate, exportRowsToCsv } from '../../lib/format.js'

export default function RegistrationCasesList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const dSearch = useDebounce(search, 350)

  const params = useMemo(
    () => ({ page, limit, search: dSearch || undefined, status: statusFilter || undefined, type: typeFilter || undefined }),
    [page, limit, dSearch, statusFilter, typeFilter]
  )
  const { data, meta, loading, error, refetch } = useFetch(useCallback(() => registrationsApi.list(params), [params]))
  const rows = data || []

  const columns = [
    { key: 'caseCode', header: 'Case ID', render: (r) => <span className="cursor-pointer font-medium text-blue-600 hover:underline">{r.caseCode}</span> },
    { key: 'customerName', header: 'Customer', render: (r) => r.customerName || '—' },
    { key: 'bookingLabel', header: 'Booking', render: (r) => r.bookingLabel || '—' },
    { key: 'registrationType', header: 'Type' },
    { key: 'appointmentDate', header: 'Appt Date', render: (r) => formatDate(r.appointmentDate) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'assignedEmployeeName', header: 'Employee', render: (r) => r.assignedEmployee?.name || r.assignedEmployeeName || '—' },
  ]

  const handleExport = () => exportRowsToCsv('registration-cases.csv', rows.map((r) => ({
    Case: r.caseCode, Customer: r.customerName, Booking: r.bookingLabel, Type: r.registrationType,
    Appointment: r.appointmentDate, Status: r.status, Employee: r.assignedEmployee?.name || r.assignedEmployeeName,
  })))

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="-ml-3 mb-2">← Back to Dashboard</Button>
        <PageHeader
          title="Registration Cases"
          subtitle="Manage and track all registration cases."
          actions={
            <>
              <ExportMenu items={[{ key: 'csv', label: 'Export to CSV', onClick: handleExport }]} disabled={rows.length === 0} />
              <Button variant="primary" onClick={() => navigate('../create', { relative: 'path' })}>+ New Registration Case</Button>
            </>
          }
        />
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="min-w-[200px] flex-1"><Input label="Search" placeholder="Case, customer, booking, project…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} /></div>
        <div className="w-48"><Select label="Status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}><option value="">All Statuses</option>{REGISTRATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
        <div className="w-56"><Select label="Registration Type" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}><option value="">All Types</option>{REGISTRATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></div>
        {(search || statusFilter || typeFilter) && <Button variant="ghost" onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter(''); setPage(1) }}>Clear Filters</Button>}
      </div>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <>
          <Table columns={columns} rows={rows} empty="No registration cases found." onRowClick={(row) => navigate(`../${row._id}`, { relative: 'path' })} />
          <Pagination meta={meta} onPage={setPage} onPageSize={(n) => { setLimit(n); setPage(1) }} loading={loading} />
        </>
      )}
    </div>
  )
}
