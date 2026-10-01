import { useCallback } from 'react'
import { reportsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { titleCase, formatMoney } from '../../lib/format.js'
import { PageHeader, Card, Table, StatCard, Loader } from '../../components/ui.jsx'

// Role-scoped reports hub (§8). The backend already scopes each dataset to the
// caller's role, so the same page serves executive/sub-admin/admin.
export default function ReportsPage() {
  const { user, can } = useAuth()
  const showRevenue = (user?.role === 'admin' || user?.role === 'super_admin') && can('report', 'view') // revenue endpoint further gated server-side by role

  return (
    <div className="space-y-8">
      <PageHeader title="Reports & Analytics" subtitle="Role-scoped performance insights (§8)" />
      <VisitConversion />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LeadSource />
        <EmployeePerformance />
      </div>
      {showRevenue && <RevenueSummary />}
    </div>
  )
}

function VisitConversion() {
  const { data } = useFetch(useCallback(() => reportsApi.visitConversion(), []))
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard label="Total Visits" value={data?.totalVisits} />
      <StatCard label="Conducted" value={data?.conducted} />
      <StatCard label="Bookings" value={data?.bookings} />
      <StatCard label="Conversion" value={data ? `${data.conversionRate}%` : '—'} />
    </div>
  )
}

function LeadSource() {
  const { data, loading } = useFetch(useCallback(() => reportsApi.leadSource(), []))
  return (
    <Card className="p-5">
      <h3 className="mb-4 text-sm font-medium text-slate-700">Lead Source Analysis</h3>
      {loading ? <Loader /> : (
        <div className="space-y-2">
          {(data || []).map((r) => (
            <div key={r.source} className="flex items-center justify-between text-sm">
              <span className="text-slate-700">{titleCase(r.source)}</span>
              <span className="font-medium text-slate-900">{r.count}</span>
            </div>
          ))}
          {(!data || data.length === 0) && <p className="text-sm text-slate-500">No data yet</p>}
        </div>
      )}
    </Card>
  )
}

function EmployeePerformance() {
  const { data, loading } = useFetch(useCallback(() => reportsApi.employeePerformance(), []))
  const columns = [
    { key: 'exec', header: 'Executive', render: (r) => r.executive?.name || 'You' },
    { key: 'leads', header: 'Leads' },
    { key: 'booked', header: 'Booked' },
    { key: 'conversionRate', header: 'Conv %', render: (r) => `${r.conversionRate}%` },
  ]
  return (
    <Card className="p-5">
      <h3 className="mb-4 text-sm font-medium text-slate-700">Employee Performance</h3>
      {loading ? <Loader /> : <Table columns={columns} rows={data || []} empty="No data" />}
    </Card>
  )
}

function RevenueSummary() {
  const { data, error } = useFetch(useCallback(() => reportsApi.revenue(), []))
  if (error) return null // executive is blocked server-side; hide silently
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <StatCard label="Total Revenue" value={data ? formatMoney(data.totalRevenue) : '—'} />
      <StatCard label="Deal Value" value={data ? formatMoney(data.totalDealValue) : '—'} />
      <StatCard label="Confirmed Bookings" value={data?.confirmedBookings} />
    </div>
  )
}
