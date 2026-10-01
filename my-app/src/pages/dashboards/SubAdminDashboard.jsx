import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { reportsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { Card, Table, StatusBadge, Button, Loader, ErrorState } from '../../components/ui.jsx'
import { formatDate, titleCase } from '../../lib/format.js'

function inr(n) {
  const v = Number(n) || 0
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`
  return `₹${v.toLocaleString('en-IN')}`
}

function SectionTitle({ children, action }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-sm font-semibold text-slate-900">{children}</h3>
      {action}
    </div>
  )
}

function KpiCard({ title, value, icon, onClick, tone = 'text-slate-300' }) {
  return (
    <Card className={`p-4 ${onClick ? 'cursor-pointer transition hover:border-blue-400 hover:shadow-md' : ''}`} onClick={onClick}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-slate-500">{title}</span>
        <span className={`text-lg ${tone}`}>{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
    </Card>
  )
}

function Trio({ items }) {
  return (
    <div className="grid grid-cols-3 gap-3 text-center">
      {items.map((it) => (
        <div key={it.label}>
          <div className={`text-2xl font-semibold ${it.color || 'text-slate-900'}`}>{it.value}</div>
          <div className="text-xs text-slate-500">{it.label}</div>
        </div>
      ))}
    </div>
  )
}

function Bars({ data, color = 'bg-blue-600', fmt = (v) => v }) {
  const max = Math.max(1, ...data.map((d) => d.revenue ?? d.count ?? 0))
  return (
    <div className="space-y-2">
      {data.map((d) => {
        const v = d.revenue ?? d.count ?? 0
        return (
          <div key={d.label || d.source}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-slate-600">{d.label || titleCase(d.source)}</span>
              <span className="text-slate-500">{fmt(v)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round((v / max) * 100)}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function SubAdminDashboard() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const { data, loading, error, refetch } = useFetch(useCallback(() => reportsApi.subAdminOverview(), []))

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (!data) return null

  const {
    branch, kpis, topAlerts = [], alertsTotal, actionCenter = {}, followUps = {}, upcomingVisits = [],
    teamPerformance = [], paymentCollection = {}, revenueTrend = [], leadSources = [], recentActivity = [],
  } = data

  const quickActions = [
    { label: 'Add Lead', to: '/sub-admin/leads', show: can('lead', 'create') },
    { label: 'Add Customer', to: '/sub-admin/customers', show: can('customer', 'edit') },
    { label: 'Schedule Site Visit', to: '/sub-admin/visits', show: can('visit', 'create') || can('visit', 'edit') },
    { label: 'Add Employee', to: '/sub-admin/employees', show: can('user', 'create') },
  ].filter((a) => a.show)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">{branch ? `${branch} branch` : 'Your branch'} — team KPIs, approvals, follow-ups & performance.</p>
      </div>

      {/* Top alerts */}
      {topAlerts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-amber-800">⚠ Top Alerts</span>
            {topAlerts.map((a) => (
              <span key={a.type} className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs text-amber-800">
                {a.label}: <strong>{a.count}</strong>
              </span>
            ))}
            <button onClick={() => navigate('/sub-admin/action')} className="ml-auto text-xs font-medium text-amber-800 hover:underline">View All Alerts{alertsTotal ? ` (${alertsTotal})` : ''}</button>
          </div>
        </Card>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard title="Today's Leads" value={kpis.todaysLeads} icon="☰" onClick={() => navigate('/sub-admin/leads')} />
        <KpiCard title="Scheduled Site Visits" value={kpis.scheduledVisits} icon="⌖" onClick={() => navigate('/sub-admin/visits')} />
        <KpiCard title="Monthly Bookings" value={kpis.monthlyBookings} icon="✓" onClick={() => navigate('/sub-admin/customers')} />
        <KpiCard title="Total Revenue" value={inr(kpis.totalRevenue)} icon="₹" />
        <KpiCard title="Present Staff" value={kpis.presentStaff} icon="☺" tone="text-emerald-500" onClick={() => navigate('/sub-admin/attendance')} />
        <KpiCard title="Staff on Leave" value={kpis.staffOnLeave} icon="◷" tone="text-rose-500" onClick={() => navigate('/sub-admin/attendance')} />
        <KpiCard title="Pending Approvals" value={kpis.pendingApprovals} icon="✦" tone="text-amber-500" onClick={() => navigate('/sub-admin/action')} />
        <KpiCard title="Branch Target" value={kpis.branchTargetProgress == null ? '—' : `${kpis.branchTargetProgress}%`} icon="◎" />
      </div>

      {/* Action Center + Today's Follow-ups */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle action={<button onClick={() => navigate('/sub-admin/action')} className="text-xs text-blue-600 hover:underline">Open</button>}>Action Center</SectionTitle>
          <ul className="divide-y divide-slate-100 text-sm">
            {[
              ['Leave approvals', actionCenter.pendingLeaves],
              ['Bookings to confirm', actionCenter.reservedBookings],
              ['Units on hold', actionCenter.heldUnits],
              ['Unassigned leads', actionCenter.unassignedLeads],
            ].map(([label, count]) => (
              <li key={label} className="flex items-center justify-between py-2">
                <span className="text-slate-700">{label}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{count || 0}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <SectionTitle action={<button onClick={() => navigate('/sub-admin/customers')} className="text-xs text-blue-600 hover:underline">Manage</button>}>Today's Follow-ups</SectionTitle>
          <Trio items={[
            { label: 'Due Today', value: followUps.due || 0, color: 'text-blue-600' },
            { label: 'Completed', value: followUps.completed || 0, color: 'text-emerald-600' },
            { label: 'Overdue', value: followUps.overdue || 0, color: 'text-red-500' },
          ]} />
        </Card>
      </div>

      {/* Upcoming Site Visits + Payment Collection */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle action={<button onClick={() => navigate('/sub-admin/visits')} className="text-xs text-blue-600 hover:underline">View all</button>}>Upcoming Site Visits</SectionTitle>
          <Table
            columns={[
              { key: 'customer', header: 'Customer', render: (v) => v.customer?.name || '—' },
              { key: 'employee', header: 'Employee', render: (v) => v.assignedTo?.name || '—' },
              { key: 'project', header: 'Project', render: (v) => v.project?.name || '—' },
              { key: 'time', header: 'Visit Time', render: (v) => formatDate(v.scheduledAt, true) },
              { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v.status} /> },
            ]}
            rows={upcomingVisits}
            empty="No upcoming visits."
          />
        </Card>
        <Card className="p-5">
          <SectionTitle>Payment Collection</SectionTitle>
          <div className="py-4 text-center">
            <div className="text-3xl font-semibold text-emerald-600">{inr(paymentCollection.collectedToday)}</div>
            <div className="mt-1 text-xs text-slate-500">Collected today</div>
          </div>
        </Card>
      </div>

      {/* Team Performance */}
      <Card className="p-5">
        <SectionTitle action={<button onClick={() => navigate('/sub-admin/team')} className="text-xs text-blue-600 hover:underline">View all</button>}>Team Performance</SectionTitle>
        <Table
          columns={[
            { key: 'name', header: 'Employee', render: (r) => <span className="font-medium text-slate-800">{r.name}</span> },
            { key: 'leads', header: 'Leads', render: (r) => r.leadsAssigned },
            { key: 'follows', header: 'Follow-ups', render: (r) => r.followupsCompleted },
            { key: 'visits', header: 'Site Visits', render: (r) => r.siteVisits },
            { key: 'bookings', header: 'Bookings', render: (r) => r.bookings },
            { key: 'revenue', header: 'Revenue', render: (r) => inr(r.revenue) },
          ]}
          rows={teamPerformance}
          empty="No team members yet."
        />
      </Card>

      {/* Executive Performance (target vs achievement) + Revenue Trend + Lead Sources */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <SectionTitle>Executive Performance</SectionTitle>
          <div className="space-y-3">
            {teamPerformance.length === 0 ? <p className="text-sm text-slate-400">No data.</p> : teamPerformance.map((r) => (
              <div key={r.id}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-600">{r.name}</span>
                  <span className="text-slate-500">{inr(r.revenue)}{r.assignedTarget ? ` / ${inr(r.assignedTarget)}` : ''}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${(r.completion ?? 0) >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, r.completion ?? 0)}%` }} />
                </div>
                <div className="mt-0.5 text-right text-[10px] text-slate-400">{r.completion == null ? 'No target' : `${r.completion}%`}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <SectionTitle>Revenue Trend <span className="text-xs font-normal text-slate-400">(weekly)</span></SectionTitle>
          {revenueTrend.some((d) => d.revenue > 0) ? <Bars data={revenueTrend} fmt={inr} /> : <p className="py-8 text-center text-sm text-slate-400">No revenue this week.</p>}
        </Card>
        <Card className="p-5">
          <SectionTitle>Lead Source Analytics</SectionTitle>
          {leadSources.length ? <Bars data={leadSources} color="bg-violet-500" /> : <p className="py-8 text-center text-sm text-slate-400">No leads yet.</p>}
        </Card>
      </div>

      {/* Recent Activities */}
      <Card className="p-5">
        <SectionTitle>Recent Activities</SectionTitle>
        {recentActivity.length === 0 ? <p className="text-sm text-slate-400">No recent activity.</p> : (
          <ul className="space-y-2 text-sm">
            {recentActivity.map((a) => (
              <li key={a._id} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2">
                <span className="text-slate-700">{a.description || `${titleCase(a.action)} · ${titleCase(a.module)}`}<span className="text-slate-400"> — {a.actor?.name || 'System'}</span></span>
                <span className="shrink-0 text-xs text-slate-400">{formatDate(a.createdAt, true)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Quick Actions */}
      {quickActions.length > 0 && (
        <Card className="p-5">
          <SectionTitle>Quick Actions</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((a) => <Button key={a.label} variant="secondary" onClick={() => navigate(a.to)}>{a.label}</Button>)}
          </div>
        </Card>
      )}
    </div>
  )
}
