import { useCallback } from 'react'
import { Card, PageHeader, Loader, ErrorState } from '../../../components/ui.jsx'
import { billingApi } from '../../../api/resources.js'
import { useFetch } from '../../../hooks/useFetch.js'
import { formatDate } from '../../../lib/format.js'

const DONUT_COLORS = ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#06b6d4', '#ef4444']
const inr = (n) => {
  const v = Number(n) || 0
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`
  return `₹${v.toLocaleString('en-IN')}`
}
const STATUS_CLS = {
  paid: 'text-emerald-600 bg-emerald-50', pending: 'text-amber-600 bg-amber-50',
  failed: 'text-rose-600 bg-rose-50', refunded: 'text-blue-600 bg-blue-50',
}

function LineChart({ data, color = '#3b82f6', height = 110, fill = false }) {
  const vals = data.map((d) => d.value)
  const max = Math.max(1, ...vals), min = Math.min(0, ...vals), range = max - min || 1
  const W = 400, H = height
  const pts = data.map((d, i) => [data.length > 1 ? (i / (data.length - 1)) * W : W / 2, H - ((d.value - min) / range) * (H - 20) - 4])
  const poly = pts.map((p) => p.join(',')).join(' ')
  const fillD = pts.length ? `M${pts[0].join(',')} L${pts.map((p) => p.join(',')).join(' L')} L${pts.at(-1)[0]},${H} L${pts[0][0]},${H} Z` : ''
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      {fill && <path d={fillD} fill={color} fillOpacity="0.12" />}
      <polyline points={poly} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill={color} fillOpacity="0.85" />)}
    </svg>
  )
}

function DonutChart({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!total) return <p className="py-8 text-center text-sm text-slate-400">No subscriptions yet.</p>
  let cum = -90
  const cx = 80, cy = 80, r = 62, ir = 40
  const rad = (d) => (d * Math.PI) / 180
  const slices = data.map((d, idx) => {
    const angle = (d.value / total) * 360
    const s = cum; cum += angle; const e = cum
    const large = angle > 180 ? 1 : 0
    const x1 = cx + r * Math.cos(rad(s)), y1 = cy + r * Math.sin(rad(s))
    const x2 = cx + r * Math.cos(rad(e)), y2 = cy + r * Math.sin(rad(e))
    const xi1 = cx + ir * Math.cos(rad(s)), yi1 = cy + ir * Math.sin(rad(s))
    const xi2 = cx + ir * Math.cos(rad(e)), yi2 = cy + ir * Math.sin(rad(e))
    return { ...d, color: DONUT_COLORS[idx % DONUT_COLORS.length], pct: Math.round((d.value / total) * 100), path: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${ir} ${ir} 0 ${large} 0 ${xi1} ${yi1} Z` }
  })
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 160 160" className="h-36 w-36 shrink-0">
        {slices.map((s) => <path key={s.label} d={s.path} fill={s.color} opacity="0.9" />)}
        <text x={cx} y={cy - 5} textAnchor="middle" style={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }}>Total</text>
        <text x={cx} y={cy + 12} textAnchor="middle" style={{ fontSize: 18, fontWeight: 700, fill: '#0f172a' }}>{total}</text>
      </svg>
      <div className="flex flex-1 flex-col gap-2.5">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="flex-1 text-slate-700">{s.label}</span>
            <span className="font-semibold text-slate-900">{s.value}</span>
            <span className="w-10 text-right text-xs text-slate-400">({s.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function KpiCard({ label, value, subtitle, icon, color, bg, border, trend, up }) {
  return (
    <Card className={`flex flex-col gap-3 border p-4 ${border} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div className={`${bg} ${color} flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold`}>{icon}</div>
        {trend && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${up === true ? 'bg-emerald-50 text-emerald-700' : up === false ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{trend}</span>}
      </div>
      <div>
        <div className="text-2xl font-bold tracking-tight text-slate-900">{value}</div>
        <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      </div>
      <div className="border-t border-slate-100 pt-2 text-xs text-slate-400">{subtitle}</div>
    </Card>
  )
}

export default function BillingDashboardPage() {
  const { data, loading, error, refetch } = useFetch(useCallback(() => billingApi.overview(), []))

  if (loading) return <div><PageHeader title="Subscription & Billing Overview" subtitle="SaaS revenue and subscription health across all tenant companies" /><Loader /></div>
  if (error) return <div><PageHeader title="Subscription & Billing Overview" subtitle="SaaS revenue and subscription health across all tenant companies" /><ErrorState message={error} onRetry={refetch} /></div>

  const k = data.kpis
  const cards = [
    { label: 'Total Plans', value: k.totalPlans, subtitle: 'Subscription tiers on platform', icon: '◈', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', trend: null },
    { label: 'Active Subscriptions', value: k.activeSubs, subtitle: 'Companies on paid plans', icon: '✓', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { label: 'Trial Subscriptions', value: k.trialSubs, subtitle: 'Companies on free trial', icon: '◷', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
    { label: 'MRR', value: inr(k.mrr), subtitle: 'Monthly recurring revenue', icon: '₹', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
    { label: 'ARR', value: inr(k.arr), subtitle: 'Annual recurring revenue', icon: '₹', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', trend: 'Projected', up: null },
    { label: 'Expiring This Month', value: k.expiring, subtitle: 'Subscriptions due for renewal', icon: '⚠', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100', trend: k.expiring ? 'Action needed' : null, up: k.expiring ? false : null },
    { label: 'Failed Payments', value: k.failedPayments, subtitle: 'Invoices with failed payment', icon: '!', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', trend: k.failedPayments ? 'Retry pending' : null, up: k.failedPayments ? false : null },
    { label: 'Renewal Rate', value: `${k.renewalRate}%`, subtitle: 'Paid vs failed invoices', icon: '↻', color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-100' },
  ]

  return (
    <div className="space-y-8">
      <PageHeader title="Subscription & Billing Overview" subtitle="SaaS revenue and subscription health across all tenant companies" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{cards.map((c) => <KpiCard key={c.label} {...c} />)}</div>

      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Analytics</h2>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <div className="mb-4"><div className="text-sm font-semibold text-slate-800">Subscription Growth</div><div className="mt-0.5 text-xs text-slate-400">New subscriptions · last 12 months</div></div>
            <LineChart data={data.subGrowth} color="#3b82f6" height={110} />
            <div className="mt-2 flex justify-between text-[10px] text-slate-400">{data.subGrowth.map((g, i) => <span key={i}>{g.month}</span>)}</div>
          </Card>
          <Card className="p-5">
            <div className="mb-4"><div className="text-sm font-semibold text-slate-800">Revenue Trend</div><div className="mt-0.5 text-xs text-slate-400">Paid invoice revenue · last 12 months</div></div>
            <LineChart data={data.mrrTrend} color="#8b5cf6" height={110} fill />
            <div className="mt-2 flex justify-between text-[10px] text-slate-400">{data.mrrTrend.map((g, i) => <span key={i}>{g.month}</span>)}</div>
          </Card>
          <Card className="p-5">
            <div className="mb-4"><div className="text-sm font-semibold text-slate-800">Subscription Distribution</div><div className="mt-0.5 text-xs text-slate-400">Companies by plan</div></div>
            <DonutChart data={data.subscriptionDistribution} />
          </Card>
          <Card className="p-5">
            <div className="mb-4"><div className="text-sm font-semibold text-slate-800">Recent Billing Activity</div><div className="mt-0.5 text-xs text-slate-400">Latest transactions</div></div>
            {data.recentActivity.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No transactions yet.</p> : (
              <ol className="space-y-3">
                {data.recentActivity.map((a) => (
                  <li key={a.id} className="flex items-start gap-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${STATUS_CLS[a.status] || 'bg-slate-100 text-slate-600'}`}>₹</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium leading-tight text-slate-800">{inr(a.amount)} · {a.company}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{a.gateway} · {a.invoice} · <span className="capitalize">{a.status}</span></div>
                    </div>
                    <div className="shrink-0 whitespace-nowrap text-xs text-slate-400">{formatDate(a.at)}</div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
