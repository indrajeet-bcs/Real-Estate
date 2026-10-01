import { useState, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader, Table, Pagination, ExportMenu, Button, Input, Select, StatusBadge, Loader, ErrorState } from '../../components/ui.jsx'
import { LOAN_STATUSES, FINANCIAL_INSTITUTIONS } from '../../lib/loanConstants.js'
import { loansApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useDebounce } from '../../hooks/useDebounce.js'
import { exportRowsToCsv } from '../../lib/format.js'

export default function LoanCasesList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const defaultStatus = searchParams.get('status') || ''

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(defaultStatus)
  const [bankFilter, setBankFilter] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const dSearch = useDebounce(search, 350)

  const params = useMemo(
    () => ({ page, limit, search: dSearch || undefined, status: statusFilter || undefined, bank: bankFilter || undefined }),
    [page, limit, dSearch, statusFilter, bankFilter]
  )
  const { data, meta, loading, error, refetch } = useFetch(useCallback(() => loansApi.list(params), [params]))
  const rows = data || []

  const columns = [
    { key: 'caseCode', header: 'Case ID', render: (r) => <span className="cursor-pointer font-medium text-blue-600 hover:underline">{r.caseCode}</span> },
    { key: 'customerName', header: 'Customer', render: (r) => r.customerName || '—' },
    { key: 'bookingLabel', header: 'Booking', render: (r) => r.bookingLabel || '—' },
    { key: 'bank', header: 'Bank', render: (r) => r.bank || '—' },
    { key: 'loanAmount', header: 'Amount', render: (r) => `₹${((r.loanAmount || 0) / 100000).toFixed(2)}L` },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'assignedExecutiveName', header: 'Executive', render: (r) => r.assignedExecutive?.name || r.assignedExecutiveName || '—' },
  ]

  const handleExport = () => {
    exportRowsToCsv('loan-cases.csv', rows.map((r) => ({
      Case: r.caseCode, Customer: r.customerName, Booking: r.bookingLabel, Bank: r.bank,
      Amount: r.loanAmount, Status: r.status, Executive: r.assignedExecutive?.name || r.assignedExecutiveName,
    })))
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="-ml-3 mb-2">← Back to Dashboard</Button>
        <PageHeader
          title="Loan Cases"
          subtitle="Manage and track all customer loan applications."
          actions={
            <>
              <ExportMenu items={[{ key: 'csv', label: 'Export to CSV', onClick: handleExport }]} disabled={rows.length === 0} />
              <Button variant="primary" onClick={() => navigate('../create')}>+ New Loan Case</Button>
            </>
          }
        />
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="min-w-[200px] flex-1"><Input label="Search" placeholder="Case, customer, booking, project…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} /></div>
        <div className="w-48"><Select label="Status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}><option value="">All Statuses</option>{LOAN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
        <div className="w-48"><Select label="Bank" value={bankFilter} onChange={(e) => { setBankFilter(e.target.value); setPage(1) }}><option value="">All Banks</option>{FINANCIAL_INSTITUTIONS.map((b) => <option key={b} value={b}>{b}</option>)}</Select></div>
        {(search || statusFilter || bankFilter) && <Button variant="ghost" onClick={() => { setSearch(''); setStatusFilter(''); setBankFilter(''); setPage(1) }}>Clear Filters</Button>}
      </div>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <>
          <Table columns={columns} rows={rows} empty="No loan cases found." onRowClick={(row) => navigate(`../${row._id}`, { relative: 'path' })} />
          <Pagination meta={meta} onPage={setPage} onPageSize={(n) => { setLimit(n); setPage(1) }} loading={loading} />
        </>
      )}
    </div>
  )
}
