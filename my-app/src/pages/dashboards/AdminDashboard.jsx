import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { reportsApi, actionCenterApi, notificationsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { Card, Table, StatusBadge, Loader, ErrorState } from '../../components/ui.jsx'
import { formatDate, titleCase } from '../../lib/format.js'

function inr(n) {
  const v = Number(n) || 0
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`
  return `₹${v.toLocaleString('en-IN')}`
}

// KPI card with icon, title, large value and a small MoM comparison + trend.
function KpiCard({ icon, title, value, kpi }) {
  const dir = kpi?.direction || 'flat'
  const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '—'
  const color = dir === 'up' ? 'text-emerald-600' : dir === 'down' ? 'text-red-500' : 'text-slate-400'
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-slate-500">{title}</span>
        <span className="text-lg text-slate-300">{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      <div className={`mt-1 flex items-center gap-1 text-xs ${color}`}>
        <span>{arrow}</span>
        <span>{Math.abs(kpi?.deltaPct ?? 0)}%</span>
        <span className="text-slate-400">vs last month</span>
      </div>
    </Card>
  )
}

function SectionTitle({ children }) {
  return <h3 className="mb-3 text-sm font-semibold text-slate-900">{children}</h3>
}

// Inline-SVG donut for part-to-whole status splits (no chart lib). Segments use
// the CRM's reserved status colors and a 2px surface gap between arcs; identity
// is carried by the legend (label + value), never colour alone.
function Donut({ segments, size = 168, thickness = 24 }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  const r = (size - thickness) / 2
  const cx = size / 2
  const c = 2 * Math.PI * r
  const gap = total > 0 ? 3 : 0 // px surface gap between segments

  let offset = 0
  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <g transform={`rotate(-90 ${cx} ${cx})`}>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="#f1f5f9" strokeWidth={thickness} />
          {total > 0 && segments.map((seg) => {
            if (!seg.value) return null
            const len = (seg.value / total) * c
            const dash = Math.max(0, len - gap)
            const el = (
              <circle
                key={seg.label}
                cx={cx} cy={cx} r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
              />
            )
            offset += len
            return el
          })}
        </g>
        <text x="50%" y="47%" textAnchor="middle" className="fill-slate-900" style={{ fontSize: 26, fontWeight: 600 }}>{total}</text>
        <text x="50%" y="60%" textAnchor="middle" className="fill-slate-400" style={{ fontSize: 11 }}>Total Sales</text>
      </svg>
      <ul className="space-y-2 text-sm">
        {segments.map((seg) => {
          const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0
          return (
            <li key={seg.label} className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: seg.color }} />
              <span className="text-slate-600">{seg.label}</span>
              <span className="ml-auto font-medium text-slate-900">{seg.value}</span>
              <span className="w-9 text-right text-xs text-slate-400">{pct}%</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// Simple horizontal bar used for the pipeline funnel.
function Bar({ label, value, total, color = 'bg-blue-600' }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-500">{value}{total > 0 ? ` · ${pct}%` : ''}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// Dual-line trend chart (revenue + sales) as inline SVG — no chart lib. Each
// series is normalised to its own peak so both read clearly; identity is carried
// by the legend, and each point exposes a native <title> tooltip for a11y.
function LineChart({ series, height = 220 }) {
  const W = 720
  const H = height
  const padL = 12, padR = 12, padT = 16, padB = 28
  const n = series.length
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const revMax = Math.max(1, ...series.map((s) => s.revenue))
  const salesMax = Math.max(1, ...series.map((s) => s.sales))
  const x = (i) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const yRev = (v) => padT + innerH - (v / revMax) * innerH
  const ySales = (v) => padT + innerH - (v / salesMax) * innerH

  const revPath = series.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yRev(s.revenue).toFixed(1)}`).join(' ')
  const areaPath = `${revPath} L${x(n - 1).toFixed(1)},${padT + innerH} L${x(0).toFixed(1)},${padT + innerH} Z`
  const salesPath = series.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${ySales(s.sales).toFixed(1)}`).join(' ')

  const labelStep = Math.max(1, Math.ceil(n / 12))
  const hasData = series.some((s) => s.revenue > 0 || s.sales > 0)

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-3 rounded-sm bg-blue-600" /><span className="text-slate-600">Revenue</span></span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-3 rounded-sm bg-emerald-500" /><span className="text-slate-600">Sales</span></span>
      </div>
      <div className="relative w-full overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full min-w-[520px]" preserveAspectRatio="none">
          {[0.25, 0.5, 0.75, 1].map((g) => (
            <line key={g} x1={padL} x2={W - padR} y1={padT + innerH * g} y2={padT + innerH * g} stroke="#f1f5f9" strokeWidth="1" />
          ))}
          {hasData && (
            <>
              <path d={areaPath} fill="#2563eb" fillOpacity="0.08" />
              <path d={revPath} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              <path d={salesPath} fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="4 3" strokeLinejoin="round" strokeLinecap="round" />
              {series.map((s, i) => (
                <g key={i}>
                  <circle cx={x(i)} cy={yRev(s.revenue)} r="2.5" fill="#2563eb" />
                  <circle cx={x(i)} cy={ySales(s.sales)} r="2.5" fill="#10b981" />
                  <rect x={x(i) - (innerW / n) / 2} y={padT} width={innerW / n} height={innerH} fill="transparent">
                    <title>{`${s.label} · ${inr(s.revenue)} · ${s.sales} sales`}</title>
                  </rect>
                </g>
              ))}
            </>
          )}
          {series.map((s, i) => (i % labelStep === 0 ? (
            <text key={`l${i}`} x={x(i)} y={H - 8} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 10 }}>{s.label}</text>
          ) : null))}
        </svg>
        {!hasData && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">No revenue in this period.</div>
        )}
      </div>
    </div>
  )
}

const TREND_PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
]

// Revenue & Sales Trend card — owns its own period filter and re-fetches the
// series when the range changes (spec: Today / Week / Month / Year).
function RevenueTrendCard() {
  const [period, setPeriod] = useState('month')
  const { data, loading, error, refetch } = useFetch(
    useCallback(() => reportsApi.adminRevenueTrend(period), [period]),
  )
  const series = data?.series || []
  const totalRev = series.reduce((s, x) => s + x.revenue, 0)
  const totalSales = series.reduce((s, x) => s + x.sales, 0)

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <SectionTitle>Revenue &amp; Sales Trend</SectionTitle>
          <p className="text-xs text-slate-500">{inr(totalRev)} · {totalSales} sales in range</p>
        </div>
        <div className="flex rounded-lg border border-slate-200 p-0.5">
          {TREND_PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${period === p.key ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="h-56 animate-pulse rounded-lg bg-slate-100" />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <LineChart series={series} />
      )}
    </Card>
  )
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useFetch(useCallback(() => reportsApi.adminOverview(), []))
  const approvals = useFetch(useCallback(() => actionCenterApi.summary(), []))
  const notifs = useFetch(useCallback(() => notificationsApi.list({ limit: 6 }), []))

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (!data) return null

  const { kpis, salesStatus, inventory, branchPerformance = [], topEmployees = [], pipeline = [], attendance = {}, recentBookings = [], recentActivity = [] } = data

  const salesTotal = (salesStatus.completed || 0) + (salesStatus.pending || 0) + (salesStatus.onHold || 0)
  const pipelineMax = Math.max(1, ...pipeline.map((p) => p.count))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Company-wide revenue, sales, branches and pipeline at a glance.</p>
      </div>

      {/* KPI section (spec §Overview) */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard icon="₹" title="Total Revenue" value={inr(kpis.totalRevenue.value)} kpi={kpis.totalRevenue} />
        <KpiCard icon="✓" title="Total Sales" value={kpis.totalSales.value} kpi={kpis.totalSales} />
        <KpiCard icon="☺" title="Total Customers" value={kpis.totalCustomers.value} kpi={kpis.totalCustomers} />
        <KpiCard icon="◈" title="Active Projects" value={kpis.activeProjects.value} kpi={kpis.activeProjects} />
      </div>

      {/* Section 1: revenue & sales trend (70%) + sales status (30%) */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueTrendCard />
        </div>
        <Card className="p-5">
          <SectionTitle>Sales Status</SectionTitle>
          {salesTotal > 0 ? (
            <Donut
              segments={[
                { label: 'Completed Sales', value: salesStatus.completed, color: '#10b981' },
                { label: 'Pending Sales', value: salesStatus.pending, color: '#f59e0b' },
                { label: 'Sales On Hold', value: salesStatus.onHold, color: '#94a3b8' },
              ]}
            />
          ) : (
            <p className="py-10 text-center text-sm text-slate-400">No sales recorded yet.</p>
          )}
        </Card>
      </div>

      {/* Section 2: branch performance + top employees */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <SectionTitle>Branch Performance</SectionTitle>
            <button onClick={() => navigate('/admin/branches')} className="text-xs text-blue-600 hover:underline">View all</button>
          </div>
          <Table
            columns={[
              { key: 'rank', header: '#', render: (r) => r.rank },
              { key: 'branch', header: 'Branch', render: (r) => <span className="font-medium text-slate-800">{r.branch}</span> },
              { key: 'revenue', header: 'Revenue', render: (r) => inr(r.revenue) },
              { key: 'sales', header: 'Sales', render: (r) => r.sales },
            ]}
            rows={branchPerformance}
            empty="No confirmed sales yet."
          />
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <SectionTitle>Top Performing Employees</SectionTitle>
            <button onClick={() => navigate('/admin/employees')} className="text-xs text-blue-600 hover:underline">View all</button>
          </div>
          <Table
            columns={[
              { key: 'name', header: 'Employee', render: (r) => <span className="font-medium text-slate-800">{r.name}</span> },
              { key: 'branch', header: 'Branch', render: (r) => r.branch || '—' },
              { key: 'sales', header: 'Sales', render: (r) => r.sales },
              { key: 'revenue', header: 'Revenue', render: (r) => inr(r.revenue) },
            ]}
            rows={topEmployees}
            empty="No confirmed sales yet."
          />
        </Card>
      </div>

      {/* Section 3: inventory summary + pipeline */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle>Property Inventory Summary</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MiniStat label="Total" value={inventory.total || 0} />
            <MiniStat label="Available" value={inventory.available || 0} />
            <MiniStat label="Reserved" value={inventory.reserved || 0} />
            <MiniStat label="Booked" value={inventory.booked || 0} />
            <MiniStat label="Locked" value={inventory.locked || 0} />
            <MiniStat label="Blocked" value={inventory.blocked || 0} />
          </div>
        </Card>
        <Card className="p-5">
          <SectionTitle>Lead &amp; Booking Pipeline</SectionTitle>
          <div className="space-y-3">
            {pipeline.map((p) => (
              <Bar key={p.stage} label={p.stage} value={p.count} total={pipelineMax} color="bg-blue-600" />
            ))}
          </div>
        </Card>
      </div>

      {/* Section 4: pending approval requests + attendance */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle>Pending Approval Requests</SectionTitle>
          <PendingApprovals data={approvals.data} loading={approvals.loading} navigate={navigate} />
        </Card>
        <Card className="p-5">
          <SectionTitle>Attendance Summary <span className="text-xs font-normal text-slate-400">(today)</span></SectionTitle>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><div className="text-2xl font-semibold text-slate-900">{attendance.total ?? 0}</div><div className="text-xs text-slate-500">Staff</div></div>
            <div><div className="text-2xl font-semibold text-emerald-600">{attendance.present ?? 0}</div><div className="text-xs text-slate-500">Present</div></div>
            <div><div className="text-2xl font-semibold text-red-500">{attendance.absent ?? 0}</div><div className="text-xs text-slate-500">Absent</div></div>
          </div>
          <div className="mt-4 text-center text-sm text-slate-500">
            Attendance rate: <span className="font-medium text-slate-700">{attendance.rate == null ? '—' : `${attendance.rate}%`}</span>
          </div>
        </Card>
      </div>

      {/* Section 5: recent bookings + recent notifications */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <SectionTitle>Recent Bookings</SectionTitle>
            <button onClick={() => navigate('/admin/bookings')} className="text-xs text-blue-600 hover:underline">View all</button>
          </div>
          <Table
            columns={[
              { key: 'customer', header: 'Customer', render: (b) => b.customer?.name || '—' },
              { key: 'project', header: 'Project', render: (b) => b.project?.name || '—' },
              { key: 'unit', header: 'Property', render: (b) => b.unit?.unitNumber || '—' },
              { key: 'exec', header: 'Sales Executive', render: (b) => b.bookedBy?.name || '—' },
              { key: 'date', header: 'Booking Date', render: (b) => formatDate(b.createdAt) },
              { key: 'status', header: 'Status', render: (b) => <StatusBadge status={b.status} /> },
            ]}
            rows={recentBookings}
            empty="No bookings yet."
          />
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <SectionTitle>Recent Notifications</SectionTitle>
            <span className="text-xs text-slate-400">{notifs.meta?.unreadCount ? `${notifs.meta.unreadCount} unread` : ''}</span>
          </div>
          <RecentNotifications data={notifs.data} loading={notifs.loading} />
        </Card>
      </div>

      {/* Section 6: recent activity logs */}
      <Card className="p-5">
        <SectionTitle>Recent Activity Logs</SectionTitle>
        <Table
          columns={[
            { key: 'time', header: 'Time', render: (a) => formatDate(a.createdAt, true) },
            { key: 'user', header: 'User', render: (a) => a.actor?.name || 'System' },
            { key: 'role', header: 'Role', render: (a) => titleCase(a.actorRole) || '—' },
            { key: 'module', header: 'Module', render: (a) => titleCase(a.module) },
            { key: 'action', header: 'Action', render: (a) => titleCase(a.action) },
            { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.success ? 'approved' : 'rejected'} /> },
          ]}
          rows={recentActivity}
          empty="No activity recorded yet."
        />
      </Card>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-0.5 text-xl font-semibold text-slate-900">{value}</div>
    </div>
  )
}

// Pending approvals requiring Admin attention, sourced from the firm-scoped
// action-center summary. Each row deep-links to the module that resolves it.
function PendingApprovals({ data, loading, navigate }) {
  if (loading) return <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-11 animate-pulse rounded-lg bg-slate-100" />)}</div>
  const items = [
    { key: 'reservedBookings', label: 'Bookings awaiting confirmation', icon: '✓', to: '/admin/bookings', tone: 'text-amber-600' },
    { key: 'heldUnits', label: 'Units on hold / locked', icon: '▦', to: '/admin/inventory', tone: 'text-blue-600' },
    { key: 'unassignedLeads', label: 'Unassigned leads', icon: '☰', to: '/admin/leads', tone: 'text-violet-600' },
    { key: 'pendingLeaves', label: 'Leave requests pending', icon: '◷', to: '/admin/employees', tone: 'text-rose-600' },
  ]
  const active = items.filter((it) => (data?.[it.key] || 0) > 0)
  if (!data || active.length === 0) {
    return (
      <div className="py-10 text-center">
        <div className="text-2xl">✓</div>
        <p className="mt-1 text-sm text-slate-400">Nothing needs approval right now.</p>
      </div>
    )
  }
  return (
    <ul className="divide-y divide-slate-100">
      {active.map((it) => (
        <li key={it.key}>
          <button onClick={() => navigate(it.to)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-slate-50">
            <span className={`text-lg ${it.tone}`}>{it.icon}</span>
            <span className="flex-1 text-sm text-slate-700">{it.label}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{data[it.key]}</span>
            <span className="text-slate-300">›</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

// Latest notifications for the signed-in Admin (spec §Overview Section 5 right).
function RecentNotifications({ data, loading }) {
  if (loading) return <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}</div>
  if (!data || data.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">No notifications yet.</p>
  }
  return (
    <ul className="divide-y divide-slate-100">
      {data.map((n) => (
        <li key={n._id} className="flex items-start gap-2.5 py-2.5">
          <span className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-slate-200' : 'bg-blue-500'}`} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">{n.title}</p>
            {n.message && <p className="truncate text-xs text-slate-500">{n.message}</p>}
            <p className="mt-0.5 text-[11px] text-slate-400">{formatDate(n.createdAt, true)}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
