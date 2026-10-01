import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { reportsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { formatDate, titleCase } from '../../lib/format.js'
import { Card, Loader, ErrorState } from '../../components/ui.jsx'

const DONUT_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#06b6d4', '#ef4444']
const MODULE_ICON = {
  firm: '🏢', user: '👤', customer: '☰', lead: '✧', booking: '✓', unit: '▦',
  project: '◈', builder: '⌂', commission: '％', attendance: '◷', leave: '🌴',
  followup: '↻', visit: '⌖', settings: '⚙', audit: '📝', report: '▤',
}
const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('en-IN'))
const inr = (n) => {
  const v = Number(n) || 0
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`
  return `₹${v.toLocaleString('en-IN')}`
}

// ─── Charts (pure SVG, no deps) ─────────────────────────────────────────────────
function LineChart({ data, color = '#3b82f6', height = 110, fill = false }) {
  const vals = data.map((d) => d.value)
  const max = Math.max(1, ...vals)
  const min = Math.min(0, ...vals)
  const range = max - min || 1
  const w = 400, h = height
  const pts = data.map((d, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * w : w / 2
    const y = h - ((d.value - min) / range) * (h - 20) - 4
    return [x, y]
  })
  const polyline = pts.map((p) => p.join(',')).join(' ')
  const fillPath = pts.length ? `M${pts[0].join(',')} L${pts.map((p) => p.join(',')).join(' L')} L${pts.at(-1)[0]},${h} L${pts[0][0]},${h} Z` : ''
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      {fill && <path d={fillPath} fill={color} fillOpacity="0.12" />}
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill={color} fillOpacity="0.85" />)}
    </svg>
  )
}

function BarChart({ data, color = '#3b82f6', height = 120, format = fmt }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="flex items-end justify-between gap-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] font-medium text-slate-500">{format(d.value)}</span>
          <div className="flex w-full flex-1 items-end">
            <div className="w-full rounded-t" style={{ height: `${Math.max(2, (d.value / max) * 100)}%`, background: color }} title={`${d.label}: ${format(d.value)}`} />
          </div>
          <span className="text-[10px] text-slate-400">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

function DonutChart({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!total) return <p className="py-8 text-center text-sm text-slate-400">No companies yet.</p>
  let cum = -90
  const cx = 80, cy = 80, r = 62, innerR = 40
  const toRad = (deg) => (deg * Math.PI) / 180
  const slices = data.map((d, idx) => {
    const angle = (d.value / total) * 360
    const s = cum; cum += angle; const e = cum
    const x1 = cx + r * Math.cos(toRad(s)), y1 = cy + r * Math.sin(toRad(s))
    const x2 = cx + r * Math.cos(toRad(e)), y2 = cy + r * Math.sin(toRad(e))
    const xi1 = cx + innerR * Math.cos(toRad(s)), yi1 = cy + innerR * Math.sin(toRad(s))
    const xi2 = cx + innerR * Math.cos(toRad(e)), yi2 = cy + innerR * Math.sin(toRad(e))
    const large = angle > 180 ? 1 : 0
    const path = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${innerR} ${innerR} 0 ${large} 0 ${xi1} ${yi1} Z`
    return { ...d, path, color: DONUT_COLORS[idx % DONUT_COLORS.length], pct: Math.round((d.value / total) * 100) }
  })
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 160 160" className="h-36 w-36 shrink-0">
        {slices.map((s) => <path key={s.label} d={s.path} fill={s.color} opacity="0.92" />)}
        <text x={cx} y={cy - 5} textAnchor="middle" style={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }}>Total</text>
        <text x={cx} y={cy + 12} textAnchor="middle" style={{ fontSize: 18, fontWeight: 700, fill: '#0f172a' }}>{total}</text>
      </svg>
      <div className="flex flex-1 flex-col gap-2.5">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-sm">
            <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="flex-1 text-slate-700">{titleCase(s.label)}</span>
            <span className="font-semibold text-slate-900">{s.value}</span>
            <span className="w-10 text-right text-xs text-slate-400">({s.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, subtitle, color, bg, border, trend, trendUp }) {
  return (
    <Card className={`flex flex-col gap-3 border p-5 ${border} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div className={`${bg} ${color} rounded-lg p-2.5 text-lg`}>{icon}</div>
        {trend && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${trendUp === true ? 'bg-emerald-50 text-emerald-700' : trendUp === false ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{trend}</span>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold tracking-tight text-slate-900">{value}</div>
        <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      </div>
      {subtitle && <div className="border-t border-slate-100 pt-2 text-xs text-slate-400">{subtitle}</div>}
    </Card>
  )
}

const quickActions = [
  { label: 'Companies', icon: '🏢', to: '/super-admin/firms', color: 'bg-blue-600 hover:bg-blue-700 text-white' },
  { label: 'Builders', icon: '⌂', to: '/super-admin/builders', color: 'bg-violet-600 hover:bg-violet-700 text-white' },
  { label: 'Projects', icon: '◈', to: '/super-admin/projects', color: 'bg-indigo-600 hover:bg-indigo-700 text-white' },
  { label: 'Reports', icon: '📊', to: '/super-admin/reports', color: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  { label: 'Audit Logs', icon: '📝', to: '/super-admin/audit', color: 'bg-slate-700 hover:bg-slate-800 text-white' },
  { label: 'Settings', icon: '⚙', to: '/super-admin/settings', color: 'bg-rose-600 hover:bg-rose-700 text-white' },
]

// ─── Main Dashboard ──────────────────────────────────────────────────────────────
export default function SuperAdminDashboard() {
  const { data, loading, error, refetch } = useFetch(useCallback(() => reportsApi.platformOverview(), []))
  const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  if (loading) return <div><Header dateStr={dateStr} /><Loader /></div>
  if (error) return <div><Header dateStr={dateStr} /><ErrorState message={error} onRetry={refetch} /></div>

  const c = data.companies
  const pf = data.platform
  const activePct = c.total > 0 ? ((c.active / c.total) * 100).toFixed(1) : '0'
  const paidPct = c.total > 0 ? ((c.paid / c.total) * 100).toFixed(1) : '0'
  const storageUsed = data.storage?.used || 0
  const storageLimit = data.storage?.limit || 0

  const row1 = [
    { icon: '🏢', label: 'Total Companies', value: fmt(c.total), subtitle: 'All registered tenants', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', trend: c.newThisMonth ? `+${c.newThisMonth} this month` : null, trendUp: c.newThisMonth ? true : null },
    { icon: '✔️', label: 'Active Companies', value: fmt(c.active), subtitle: 'Status: active', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', trend: `${activePct}% of total`, trendUp: null },
    { icon: '⏳', label: 'Trial Companies', value: fmt(c.trial), subtitle: 'On free trial', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', trend: 'Convert before expiry', trendUp: null },
    { icon: '💳', label: 'Paid Companies', value: fmt(c.paid), subtitle: 'Active subscriptions', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', trend: `${paidPct}% of total`, trendUp: null },
  ]
  const row2 = [
    { icon: '👥', label: 'Total Users', value: fmt(pf.users), subtitle: 'Across all firms', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', trend: `${fmt(pf.activeUsers)} active (30d)`, trendUp: null },
    { icon: '☰', label: 'Total Leads / Customers', value: fmt(pf.customers), subtitle: 'Platform-wide pipeline', color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-100' },
    { icon: '✓', label: 'Confirmed Bookings', value: fmt(pf.bookings), subtitle: 'Confirmed + completed sales', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { icon: '➕', label: 'New Companies (This Month)', value: fmt(c.newThisMonth), subtitle: 'Registered this month', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100', trend: c.growthPct == null ? null : `${c.growthPct >= 0 ? '+' : ''}${c.growthPct}% vs last month`, trendUp: c.growthPct == null ? null : c.growthPct >= 0 },
  ]
  const rev = data.revenue || { mrr: 0, arr: 0 }
  const row3 = [
    { icon: '₹', label: 'Monthly Recurring Revenue', value: inr(rev.mrr), subtitle: 'From active subscriptions', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100', trend: 'Live', up: null },
    { icon: '◈', label: 'Total Projects', value: fmt(pf.projects), subtitle: 'Active projects', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
    { icon: '▦', label: 'Inventory Units', value: fmt(pf.units), subtitle: 'Across all projects', color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-100' },
    { icon: '💾', label: 'Storage Used', value: `${storageUsed} GB`, subtitle: storageLimit ? `of ${storageLimit} GB allocated` : 'Across all tenants', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
  ]

  const entityBars = [
    { label: 'Users', value: pf.users }, { label: 'Leads', value: pf.customers },
    { label: 'Bookings', value: pf.bookings }, { label: 'Projects', value: pf.projects },
    { label: 'Units', value: pf.units }, { label: 'Builders', value: pf.builders },
  ]

  return (
    <div className="space-y-8">
      <Header dateStr={dateStr} />

      <Section title="Company Overview"><Grid>{row1.map((k) => <KpiCard key={k.label} {...k} />)}</Grid></Section>
      <Section title="Platform Scale"><Grid>{row2.map((k) => <KpiCard key={k.label} {...k} />)}</Grid></Section>
      <Section title="Revenue & Inventory"><Grid>{row3.map((k) => <KpiCard key={k.label} {...k} />)}</Grid></Section>

      <Section title="Analytics">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <div className="mb-4"><div className="text-sm font-semibold text-slate-800">Company Growth</div><div className="mt-0.5 text-xs text-slate-400">New company registrations · last 12 months</div></div>
            <LineChart data={data.companyGrowth} color="#3b82f6" height={110} fill />
            <div className="mt-2 flex justify-between text-[10px] text-slate-400">{data.companyGrowth.map((g, i) => <span key={i}>{g.month}</span>)}</div>
          </Card>
          <Card className="p-5">
            <div className="mb-4"><div className="text-sm font-semibold text-slate-800">Subscription Distribution</div><div className="mt-0.5 text-xs text-slate-400">Companies by plan</div></div>
            <DonutChart data={data.subscriptionDistribution} />
          </Card>
          <Card className="p-5 lg:col-span-2">
            <div className="mb-4"><div className="text-sm font-semibold text-slate-800">Platform Entities</div><div className="mt-0.5 text-xs text-slate-400">Total records across every firm</div></div>
            <BarChart data={entityBars} color="#8b5cf6" height={140} />
          </Card>
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div><div className="text-sm font-semibold text-slate-800">Recent Platform Activity</div><div className="mt-0.5 text-xs text-slate-400">Live from the audit log</div></div>
            <Link to="/super-admin/audit" className="text-xs font-medium text-blue-600 hover:text-blue-700">View all →</Link>
          </div>
          {data.recentActivity.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No recent activity.</p>
          ) : (
            <ol className="space-y-3">
              {data.recentActivity.map((a) => (
                <li key={a.id} className="flex items-start gap-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${a.success ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'}`}>{MODULE_ICON[a.module] || '•'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-tight text-slate-800">{a.description}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{a.actor}{a.firm ? ` · ${a.firm}` : ''} · {titleCase(a.module)}</div>
                  </div>
                  <div className="shrink-0 whitespace-nowrap text-xs text-slate-400">{formatDate(a.at, true)}</div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 text-sm font-semibold text-slate-800">Quick Actions</div>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((a) => (
              <Link key={a.label} to={a.to}>
                <button className={`flex w-full flex-col items-center gap-1.5 rounded-lg px-2 py-3 text-xs font-medium transition-all duration-150 active:scale-95 ${a.color}`}>
                  <span className="text-base">{a.icon}</span><span className="text-center leading-tight">{a.label}</span>
                </button>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function Header({ dateStr }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Super Admin Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">SaaS platform overview · {dateStr}</p>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live data
      </span>
    </div>
  )
}
function Section({ title, children }) {
  return <section><h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</h2>{children}</section>
}
function Grid({ children }) {
  return <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{children}</div>
}
