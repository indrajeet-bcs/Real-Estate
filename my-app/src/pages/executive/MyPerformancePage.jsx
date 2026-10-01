import { useState, useCallback } from 'react'
import { reportsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { formatDate } from '../../lib/format.js'
import { PageHeader, Card, StatCard, Button, Input, Loader, ErrorState } from '../../components/ui.jsx'

const inr = (n) => {
  const v = Number(n) || 0
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`
  return v ? `₹${v.toLocaleString('en-IN')}` : '₹0'
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function MyPerformancePage() {
  const [period, setPeriod] = useState('current_month')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const params = period === 'custom' ? { period: 'custom', from: from || undefined, to: to || undefined } : { period }
  const { data, loading, error, refetch } = useFetch(useCallback(() => reportsApi.myPerformance(params), [period, from, to])) // eslint-disable-line

  const p = data || {}
  const cards = p.cards || {}
  const tp = p.targetProgress || {}
  const sales = p.sales || {}
  const activity = p.activity || {}
  const trend = p.trend || []
  const ach = p.achievements || {}
  const bd = p.breakdown || {}

  return (
    <div>
      <PageHeader title="My Performance" subtitle="Track your sales performance, targets, productivity, and overall achievements." />

      {/* Filters */}
      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex gap-1.5">
            {[['current_month', 'Current Month'], ['previous_month', 'Previous Month'], ['custom', 'Custom Range']].map(([v, l]) => (
              <button key={v} onClick={() => setPeriod(v)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${period === v ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {l}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <>
              <div className="w-40"><Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div className="w-40"><Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </>
          )}
        </div>
      </Card>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Monthly Target" value={inr(cards.monthlyTarget)} />
            <StatCard label="Achievement" value={`${cards.achievement || 0}%`} />
            <StatCard label="Conversion Rate" value={`${cards.conversionRate || 0}%`} />
            <StatCard label="Revenue Generated" value={inr(cards.revenueGenerated)} />
          </div>

          {/* Section 1 — Target Progress */}
          <Card className="p-6">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Target Progress</h3>
            <div className="grid items-center gap-6 md:grid-cols-3">
              <div className="flex justify-center md:col-span-1">
                <CircularProgress pct={tp.achievementPct || 0} />
              </div>
              <div className="md:col-span-2">
                <div className="mb-3 grid grid-cols-3 gap-3 text-center">
                  <Metric label="Monthly Target" value={inr(tp.monthlyTarget)} />
                  <Metric label="Achieved" value={inr(tp.achieved)} accent="text-emerald-600" />
                  <Metric label="Remaining" value={inr(tp.remaining)} accent="text-amber-600" />
                </div>
                <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all" style={{ width: `${Math.min(100, tp.achievementPct || 0)}%` }} />
                </div>
                <p className="mt-1 text-right text-xs text-slate-500">{tp.achievementPct || 0}% of monthly target</p>
              </div>
            </div>
          </Card>

          {/* Section 2 — Sales Performance */}
          <Section title="Sales Performance">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              <Metric label="Total Leads" value={sales.totalLeads || 0} />
              <Metric label="Qualified Leads" value={sales.qualifiedLeads || 0} />
              <Metric label="Customers Converted" value={sales.customersConverted || 0} />
              <Metric label="Bookings Closed" value={sales.bookingsClosed || 0} />
              <Metric label="Revenue Generated" value={inr(sales.revenue)} accent="text-emerald-600" />
            </div>
          </Section>

          {/* Section 3 — Activity Summary */}
          <Section title="Activity Summary">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric label="Follow-ups Completed" value={activity.followupsCompleted || 0} />
              <Metric label="Site Visits Completed" value={activity.visitsCompleted || 0} />
              <Metric label="Tasks Completed" value={activity.tasksCompleted || 0} />
              <Metric label="Attendance" value={`${activity.attendancePct || 0}%`} />
            </div>
          </Section>

          {/* Section 4 — Monthly Performance Trend */}
          <Section title="Monthly Performance Trend">
            <div className="grid gap-6 lg:grid-cols-3">
              <BarChart title="Monthly Sales (Revenue)" data={trend} valueKey="revenue" format={inr} color="bg-blue-500" />
              <BarChart title="Monthly Bookings" data={trend} valueKey="bookings" format={(v) => v} color="bg-emerald-500" />
              <BarChart title="Monthly Conversion %" data={trend} valueKey="conversion" format={(v) => `${v}%`} color="bg-violet-500" />
            </div>
          </Section>

          {/* Section 5 — Recent Achievements */}
          <Section title="Recent Achievements">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">🏆 Latest Booking Closed</div>
                {ach.latestBooking ? (
                  <div className="text-sm text-slate-800">
                    <div className="font-medium">{ach.latestBooking.customer || '—'}</div>
                    <div className="text-xs text-slate-500">{ach.latestBooking.project} · Unit {ach.latestBooking.unit}</div>
                    <div className="mt-1 font-semibold text-emerald-600">{inr(ach.latestBooking.value)}</div>
                    <div className="text-[11px] text-slate-400">{formatDate(ach.latestBooking.date)}</div>
                  </div>
                ) : <p className="text-xs italic text-slate-400">No bookings closed yet.</p>}
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">🎯 Target Milestones</div>
                <div className="flex flex-wrap gap-1.5">
                  {[25, 50, 75, 100].map((m) => {
                    const hit = (ach.milestones || []).includes(m)
                    return <span key={m} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${hit ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>{m}%{hit ? ' ✓' : ''}</span>
                  })}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">⭐ Best Performance Days</div>
                {(ach.bestDays || []).length === 0 ? <p className="text-xs italic text-slate-400">No standout days yet.</p> : (
                  <ul className="space-y-1 text-sm">
                    {ach.bestDays.map((d) => (
                      <li key={d.date} className="flex justify-between"><span className="text-slate-600">{formatDate(d.date)}</span><span className="font-medium text-emerald-600">{inr(d.revenue)}</span></li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Section>

          {/* Section 6 — Performance Breakdown */}
          <Section title="Performance Breakdown">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric label="Lead → Customer" value={`${bd.leadToCustomerRate || 0}%`} />
              <Metric label="Customer → Booking" value={`${bd.customerToBookingRate || 0}%`} />
              <Metric label="Avg Follow-up Response" value={bd.avgFollowupResponseHours ? `${bd.avgFollowupResponseHours}h` : '—'} />
              <Metric label="Avg Booking Value" value={inr(bd.avgBookingValue)} />
            </div>
          </Section>

          <p className="text-center text-xs text-slate-400">All metrics are calculated automatically from your completed CRM activities and cannot be edited.</p>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <Card className="p-6">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </Card>
  )
}

function Metric({ label, value, accent = 'text-slate-900' }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-xl font-bold ${accent}`}>{value}</div>
    </div>
  )
}

// Circular progress ring (SVG, no dependencies).
function CircularProgress({ pct }) {
  const clamped = Math.min(100, Math.max(0, pct))
  const r = 52
  const c = 2 * Math.PI * r
  const offset = c - (clamped / 100) * c
  return (
    <div className="relative h-36 w-36">
      <svg className="h-36 w-36 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="#3b82f6" strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-900">{clamped}%</span>
        <span className="text-[10px] uppercase tracking-wide text-slate-400">Achieved</span>
      </div>
    </div>
  )
}

// Simple vertical bar chart.
function BarChart({ title, data, valueKey, format, color }) {
  const max = Math.max(1, ...data.map((d) => d[valueKey] || 0))
  return (
    <div>
      <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">{title}</p>
      <div className="flex h-40 items-end justify-between gap-2">
        {data.map((d, i) => {
          const v = d[valueKey] || 0
          const h = Math.round((v / max) * 100)
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full flex-1 items-end">
                <div className={`w-full rounded-t ${color} transition-all`} style={{ height: `${Math.max(2, h)}%` }} title={format(v)} />
              </div>
              <span className="text-[9px] font-medium text-slate-500">{d.month}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-1 text-right text-[10px] text-slate-400">peak {format(max)}</div>
    </div>
  )
}
