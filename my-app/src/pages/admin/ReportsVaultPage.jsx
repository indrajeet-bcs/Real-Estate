import { useCallback, useMemo, useState } from 'react'
import { branchesApi, bookingsApi, unitsApi, usersApi, reportsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { formatMoney, formatDate, titleCase } from '../../lib/format.js'
import { PageHeader, Card, Button, Input, Select, Table, StatCard, StatusBadge, Loader } from '../../components/ui.jsx'

// Build a CSV and trigger a client-side download (real export, not a stub).
function downloadCsv(filename, headers, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const isSale = (b) => b.status === 'confirmed' || b.status === 'sale_completed'
const finalValue = (b) => b.discount?.finalSaleAmount || b.totalValue || 0

export default function ReportsVaultPage() {
  const { data: branches, loading: lb } = useFetch(useCallback(() => branchesApi.list(), []))
  const { data: bookings, loading: lk } = useFetch(useCallback(() => bookingsApi.list({ limit: 500 }), []))
  const { data: units, loading: lu } = useFetch(useCallback(() => unitsApi.list({ limit: 500 }), []))
  const { data: employees, loading: le } = useFetch(useCallback(() => usersApi.list({ role: 'sales_executive', limit: 500 }), []))
  const { data: overview, loading: lo } = useFetch(useCallback(() => reportsApi.adminOverview(), []))

  // --- Global header + filters (spec §Global Header / §Filters) ---
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [branch, setBranch] = useState('all')
  const [bookingStatus, setBookingStatus] = useState('all')
  const [propertyStatus, setPropertyStatus] = useState('all')

  const branchNames = useMemo(() => (branches || []).map((b) => b.name), [branches])

  // Bookings scoped by the global date-range / branch / status filters — the
  // shared source for the commission, booking and discount reports.
  const scopedBookings = useMemo(() => {
    let out = bookings || []
    if (from) out = out.filter((b) => new Date(b.createdAt) >= new Date(from))
    if (to) out = out.filter((b) => new Date(b.createdAt) <= new Date(`${to}T23:59:59`))
    if (branch !== 'all') out = out.filter((b) => b.bookedBy?.branch === branch)
    if (bookingStatus !== 'all') out = out.filter((b) => b.status === bookingStatus)
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter((b) => [b.customer?.name, b.project?.name, b.unit?.unitNumber, b.bookedBy?.name].some((v) => (v || '').toLowerCase().includes(q)))
    }
    return out
  }, [bookings, from, to, branch, bookingStatus, search])

  const scopedBranches = useMemo(() => (branch === 'all' ? (branches || []) : (branches || []).filter((b) => b.name === branch)), [branches, branch])
  const scopedEmployees = useMemo(() => {
    let out = employees || []
    if (branch !== 'all') out = out.filter((e) => e.branch === branch)
    if (search.trim()) { const q = search.toLowerCase(); out = out.filter((e) => (e.name || '').toLowerCase().includes(q)) }
    return out
  }, [employees, branch, search])
  const scopedUnits = useMemo(() => {
    let out = units || []
    if (propertyStatus !== 'all') out = out.filter((u) => u.status === propertyStatus)
    if (search.trim()) { const q = search.toLowerCase(); out = out.filter((u) => [u.unitNumber, u.project?.name].some((v) => (v || '').toLowerCase().includes(q))) }
    return out
  }, [units, propertyStatus, search])

  function exportAll() {
    const header = ['Booking ID', 'Date', 'Buyer', 'Project', 'Unit', 'Employee', 'Branch', 'Sale Value', 'Brokerage', 'Commission Rule', 'Status']
    const rows = scopedBookings.map((b) => [b._id?.slice(-8).toUpperCase(), formatDate(b.createdAt), b.customer?.name, b.project?.name, b.unit?.unitNumber, b.bookedBy?.name, b.bookedBy?.branch, finalValue(b), b.commissionEarned, b.commissionRuleName, b.status])
    downloadCsv('reports-vault-master.csv', header, rows)
  }

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          title="Reports Vault"
          subtitle="Generate business reports, performance insights, sales analytics, inventory reports, commissions, and operational summaries."
          actions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => window.print()}>Download PDF</Button>
              <Button variant="secondary" onClick={exportAll}>Export Excel</Button>
            </div>
          }
        />

        {/* Global header + filters */}
        <Card className="mb-6 p-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <div className="xl:col-span-2"><Input label="Global Search" placeholder="Buyer, project, unit, employee" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            <Select label="Branch" value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="all">All branches</option>
              {branchNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
            <Select label="Booking Status" value={bookingStatus} onChange={(e) => setBookingStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="reserved">Reserved</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
              <option value="sale_completed">Sale Completed</option>
            </Select>
            <Select label="Property Status" value={propertyStatus} onChange={(e) => setPropertyStatus(e.target.value)}>
              <option value="all">All</option>
              {['available', 'reserved', 'locked', 'booked', 'sold', 'blocked'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
            </Select>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <BranchSales branches={scopedBranches} loading={lb} />
        <CommissionReport bookings={scopedBookings} loading={lk} />
        <InventoryStatus units={scopedUnits} loading={lu} />
        <LeadConversion overview={overview} loading={lo} />
        <BookingReport bookings={scopedBookings} loading={lk} />
        <EmployeePerformance employees={scopedEmployees} bookings={bookings || []} loading={le} />
        <DiscountReport bookings={scopedBookings} loading={lk} />
      </div>
    </div>
  )
}

function Section({ title, subtitle, onExport, disabled, children }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        {onExport && <Button size="sm" variant="secondary" className="print:hidden" onClick={onExport} disabled={disabled}>Export CSV</Button>}
      </div>
      {children}
    </Card>
  )
}

// Horizontal funnel bar.
function FunnelBar({ label, value, max }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs"><span className="text-slate-600">{label}</span><span className="text-slate-500">{value}</span></div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

// Section 1 — Branch-wise Sales Performance.
function BranchSales({ branches, loading }) {
  const rows = branches || []
  const columns = [
    { key: 'name', header: 'Branch', render: (r) => <span className="font-medium text-slate-800">{r.name}</span> },
    { key: 'activeUsers', header: 'Employees', render: (r) => r.activeUsers },
    { key: 'salesCount', header: 'Sales', render: (r) => r.salesCount },
    { key: 'revenue', header: 'Revenue', render: (r) => formatMoney(r.revenue) },
    { key: 'target', header: 'Assigned Target', render: (r) => r.monthlyTarget ? formatMoney(r.monthlyTarget) : '—' },
    { key: 'achieved', header: 'Achieved', render: (r) => formatMoney(r.revenue) },
    { key: 'completion', header: 'Completion %', render: (r) => r.targetCompletion == null ? '—' : `${r.targetCompletion}%` },
    { key: 'performance', header: 'Performance', render: (r) => <StatusBadge status={r.targetStatus === 'No Target' ? 'pending' : r.targetStatus?.toLowerCase().replace(' ', '_')} /> },
  ]
  const exportCsv = () => downloadCsv('branch-sales.csv', ['Branch', 'Employees', 'Sales', 'Revenue', 'AssignedTarget', 'Achieved', 'Completion%', 'Performance'],
    rows.map((r) => [r.name, r.activeUsers, r.salesCount, r.revenue, r.monthlyTarget || 0, r.revenue, r.targetCompletion ?? '', r.targetStatus]))

  return (
    <Section title="Branch-wise Sales Performance" subtitle="Data source: Branches + Employees + Bookings" onExport={exportCsv} disabled={loading || !rows.length}>
      {loading ? <Loader /> : <Table columns={columns} rows={rows} empty="No branches" />}
    </Section>
  )
}

// Section 2 — Commission Report.
function CommissionReport({ bookings, loading }) {
  const rows = (bookings || []).filter(isSale)
  const total = rows.reduce((s, b) => s + (b.commissionEarned || 0), 0)
  const columns = [
    { key: 'date', header: 'Date', render: (r) => formatDate(r.createdAt) },
    { key: 'customer', header: 'Buyer', render: (r) => r.customer?.name || '—' },
    { key: 'project', header: 'Project', render: (r) => r.project?.name || '—' },
    { key: 'unit', header: 'Property', render: (r) => r.unit?.unitNumber || '—' },
    { key: 'saleValue', header: 'Sale Value', render: (r) => formatMoney(finalValue(r)) },
    { key: 'brokerage', header: 'Brokerage', render: (r) => formatMoney(r.commissionEarned) },
    { key: 'rule', header: 'Commission Rule Applied', render: (r) => r.commissionRuleName || '—' },
    { key: 'employee', header: 'Employee', render: (r) => r.bookedBy?.name || '—' },
    { key: 'branch', header: 'Branch', render: (r) => r.bookedBy?.branch || '—' },
  ]
  const exportCsv = () => downloadCsv('commission-report.csv', ['Date', 'Buyer', 'Project', 'Property', 'SaleValue', 'Brokerage', 'CommissionRule', 'Employee', 'Branch'],
    rows.map((r) => [formatDate(r.createdAt), r.customer?.name, r.project?.name, r.unit?.unitNumber, finalValue(r), r.commissionEarned, r.commissionRuleName || '', r.bookedBy?.name, r.bookedBy?.branch]))

  return (
    <Section title="Commission Report" subtitle="Data source: Commission Rules + Booking Registers" onExport={exportCsv} disabled={loading || !rows.length}>
      {loading ? <Loader /> : (
        <>
          <div className="mb-4 w-72"><StatCard label="Total Brokerage Generated" value={formatMoney(total)} /></div>
          <Table columns={columns} rows={rows} empty="No confirmed bookings" />
        </>
      )}
    </Section>
  )
}

// Section 3 — Property Inventory Status (replaces the former RERA audit).
function InventoryStatus({ units, loading }) {
  const rows = units || []
  const byStatus = rows.reduce((m, u) => { m[u.status] = (m[u.status] || 0) + 1; return m }, {})
  const columns = [
    { key: 'unitNumber', header: 'Unit Number' },
    { key: 'project', header: 'Project', render: (r) => r.project?.name || '—' },
    { key: 'builder', header: 'Builder', render: (r) => r.project?.builder?.name || r.builder?.name || '—' },
    { key: 'propertyType', header: 'Property Type', render: (r) => r.unitType || r.propertyType || '—' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'holder', header: 'Current Holder', render: (r) => r.lockedForCustomer?.name || r.customer?.name || '—' },
    { key: 'updated', header: 'Last Updated', render: (r) => r.updatedAt ? formatDate(r.updatedAt) : '—' },
  ]
  const exportCsv = () => downloadCsv('property-inventory-status.csv', ['Unit', 'Project', 'Builder', 'Type', 'Status', 'CurrentHolder', 'LastUpdated'],
    rows.map((r) => [r.unitNumber, r.project?.name, r.project?.builder?.name || '', r.unitType || r.propertyType, r.status, r.lockedForCustomer?.name || r.customer?.name || '', r.updatedAt || '']))

  return (
    <Section title="Property Inventory Status" subtitle="Data source: Property Inventory + Booking Registers" onExport={exportCsv} disabled={loading || !rows.length}>
      {loading ? <Loader /> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {['available', 'reserved', 'locked', 'booked', 'sold'].map((s) => (
              <StatCard key={s} label={titleCase(s)} value={byStatus[s] || 0} />
            ))}
          </div>
          <Table columns={columns} rows={rows} empty="No units" />
        </>
      )}
    </Section>
  )
}

// Section 4 — Lead Conversion Report (funnel).
function LeadConversion({ overview, loading }) {
  const pipeline = overview?.pipeline || []
  const max = Math.max(1, ...pipeline.map((p) => p.count))
  const totalLeads = overview?.kpis?.totalCustomers?.value || 0
  const visits = pipeline.find((p) => p.stage === 'Site Visits')?.count || 0
  const bookingsCount = pipeline.find((p) => p.stage === 'Bookings')?.count || 0
  const closed = pipeline.find((p) => p.stage === 'Closed Sales')?.count || 0
  const conversion = totalLeads > 0 ? Number(((closed / totalLeads) * 100).toFixed(1)) : 0

  return (
    <Section title="Lead Conversion Report" subtitle="Data source: Leads & Buyers + Booking Registers">
      {loading ? <Loader /> : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Total Leads" value={totalLeads} />
            <StatCard label="Site Visits" value={visits} />
            <StatCard label="Bookings" value={bookingsCount} />
            <StatCard label="Completed Sales" value={closed} />
            <StatCard label="Conversion Rate" value={`${conversion}%`} />
          </div>
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Conversion Funnel</div>
            {pipeline.length === 0 ? <p className="text-sm text-slate-400">No pipeline data.</p> : pipeline.map((p) => (
              <FunnelBar key={p.stage} label={p.stage} value={p.count} max={max} />
            ))}
          </div>
        </div>
      )}
    </Section>
  )
}

// Section 5 — Booking Report.
function BookingReport({ bookings, loading }) {
  const rows = bookings || []
  const kpis = {
    total: rows.length,
    reserved: rows.filter((b) => b.status === 'reserved').length,
    confirmed: rows.filter((b) => b.status === 'confirmed').length,
    cancelled: rows.filter((b) => b.status === 'cancelled').length,
    completed: rows.filter((b) => b.status === 'sale_completed').length,
  }
  const columns = [
    { key: 'id', header: 'Booking ID', render: (r) => <span className="font-mono text-xs text-slate-500">#{r._id?.slice(-8).toUpperCase()}</span> },
    { key: 'customer', header: 'Buyer', render: (r) => r.customer?.name || '—' },
    { key: 'project', header: 'Project', render: (r) => r.project?.name || '—' },
    { key: 'unit', header: 'Property Unit', render: (r) => r.unit?.unitNumber || '—' },
    { key: 'employee', header: 'Employee', render: (r) => r.bookedBy?.name || '—' },
    { key: 'branch', header: 'Branch', render: (r) => r.bookedBy?.branch || '—' },
    { key: 'saleValue', header: 'Sale Value', render: (r) => formatMoney(finalValue(r)) },
    { key: 'status', header: 'Booking Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'date', header: 'Booking Date', render: (r) => formatDate(r.createdAt) },
  ]
  const exportCsv = () => downloadCsv('booking-report.csv', ['BookingID', 'Buyer', 'Project', 'Unit', 'Employee', 'Branch', 'SaleValue', 'Status', 'Date'],
    rows.map((r) => [r._id?.slice(-8).toUpperCase(), r.customer?.name, r.project?.name, r.unit?.unitNumber, r.bookedBy?.name, r.bookedBy?.branch, finalValue(r), r.status, formatDate(r.createdAt)]))

  return (
    <Section title="Booking Report" subtitle="Data source: Booking Registers" onExport={exportCsv} disabled={loading || !rows.length}>
      {loading ? <Loader /> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label="Total Bookings" value={kpis.total} />
            <StatCard label="Reserved" value={kpis.reserved} />
            <StatCard label="Confirmed" value={kpis.confirmed} />
            <StatCard label="Cancelled" value={kpis.cancelled} />
            <StatCard label="Completed Sales" value={kpis.completed} />
          </div>
          <Table columns={columns} rows={rows} empty="No bookings" />
        </>
      )}
    </Section>
  )
}

// Section 6 — Employee Performance Report.
function EmployeePerformance({ employees, bookings, loading }) {
  const byEmp = useMemo(() => {
    const map = {}
    for (const b of bookings) {
      const id = b.bookedBy?._id
      if (!id) continue
      if (!map[id]) map[id] = { bookings: 0, sales: 0, revenue: 0 }
      map[id].bookings += 1
      if (isSale(b)) { map[id].sales += 1; map[id].revenue += finalValue(b) }
    }
    return map
  }, [bookings])

  const rows = (employees || []).map((e) => {
    const stat = byEmp[e._id] || { bookings: 0, sales: 0, revenue: 0 }
    const revenue = e.revenueGenerated ?? stat.revenue
    const achievement = e.targetRevenue > 0 ? Math.round((revenue / e.targetRevenue) * 100) : null
    return { ...e, bookings: stat.bookings, sales: stat.sales, revenue, achievement }
  })

  const columns = [
    { key: 'name', header: 'Employee', render: (r) => <span className="font-medium text-slate-800">{r.name}</span> },
    { key: 'branch', header: 'Branch', render: (r) => r.branch || '—' },
    { key: 'leads', header: 'Assigned Leads', render: (r) => r.activeLeadsCount ?? 0 },
    { key: 'bookings', header: 'Bookings', render: (r) => r.bookings },
    { key: 'sales', header: 'Sales', render: (r) => r.sales },
    { key: 'revenue', header: 'Revenue', render: (r) => formatMoney(r.revenue) },
    { key: 'achievement', header: 'Target Achievement %', render: (r) => r.achievement == null ? '—' : `${r.achievement}%` },
  ]
  const exportCsv = () => downloadCsv('employee-performance.csv', ['Employee', 'Branch', 'AssignedLeads', 'Bookings', 'Sales', 'Revenue', 'TargetAchievement%'],
    rows.map((r) => [r.name, r.branch, r.activeLeadsCount ?? 0, r.bookings, r.sales, r.revenue, r.achievement ?? '']))

  return (
    <Section title="Employee Performance Report" subtitle="Data source: Employees + Bookings" onExport={exportCsv} disabled={loading || !rows.length}>
      {loading ? <Loader /> : <Table columns={columns} rows={rows} empty="No employees" />}
    </Section>
  )
}

// Section 7 — Discount Approval Report (built from applied booking discounts; the
// standalone Discount Overrides module is out of scope, so this reflects
// discounts recorded against bookings).
function DiscountReport({ bookings, loading }) {
  const rows = (bookings || []).filter((b) => b.discount && b.discount.totalDiscount > 0)
  const columns = [
    { key: 'date', header: 'Request Date', render: (r) => formatDate(r.discount?.updatedAt || r.createdAt) },
    { key: 'customer', header: 'Customer', render: (r) => r.customer?.name || '—' },
    { key: 'project', header: 'Project', render: (r) => r.project?.name || '—' },
    { key: 'employee', header: 'Employee', render: (r) => r.bookedBy?.name || '—' },
    { key: 'branch', header: 'Branch', render: (r) => r.bookedBy?.branch || '—' },
    { key: 'requested', header: 'Requested Discount', render: (r) => formatMoney(r.discount?.totalDiscount) },
    { key: 'approved', header: 'Approved Discount', render: (r) => formatMoney(r.discount?.totalDiscount) },
    { key: 'status', header: 'Status', render: () => <StatusBadge status="approved" /> },
    { key: 'givenBy', header: 'Approved By', render: (r) => titleCase(r.discount?.givenBy) || '—' },
  ]
  const exportCsv = () => downloadCsv('discount-report.csv', ['RequestDate', 'Customer', 'Project', 'Employee', 'Branch', 'RequestedDiscount', 'ApprovedDiscount', 'Status', 'ApprovedBy'],
    rows.map((r) => [formatDate(r.discount?.updatedAt || r.createdAt), r.customer?.name, r.project?.name, r.bookedBy?.name, r.bookedBy?.branch, r.discount?.totalDiscount, r.discount?.totalDiscount, 'Approved', titleCase(r.discount?.givenBy)]))

  return (
    <Section title="Discount Approval Report" subtitle="Data source: Booking Registers (applied discounts)" onExport={exportCsv} disabled={loading || !rows.length}>
      {loading ? <Loader /> : <Table columns={columns} rows={rows} empty="No discounts recorded" />}
    </Section>
  )
}
