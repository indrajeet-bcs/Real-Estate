import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { customersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { titleCase } from '../../lib/format.js'
import { PageHeader, Card, StatCard, Loader, ErrorState, StatusBadge } from '../../components/ui.jsx'

// Sales-Exec flow §E2 — Pipeline analytics over the executive's OWN customers.
// Lightweight CSS charts only (no chart library): a source-distribution bar list
// and a status funnel. Data comes from the exec's assigned customers.
export default function PipelinePage() {
  const navigate = useNavigate()
  const customers = useFetch(useCallback(() => customersApi.list({ limit: 500 }), []))
  const list = customers.data || []

  const stats = useMemo(() => buildStats(customers.data || []), [customers.data])

  return (
    <div>
      <PageHeader title="Pipeline Analytics" subtitle="Understand your lead pipeline — sources, stages and conversion at a glance." />

      {customers.loading ? (
        <Loader />
      ) : customers.error ? (
        <ErrorState message={customers.error} onRetry={customers.refetch} />
      ) : list.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">No leads assigned to you yet.</p>
      ) : (
        <div className="space-y-5">
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Total Leads" value={stats.total} />
            <StatCard label="Active Pipeline" value={stats.active} hint="not won/lost" />
            <StatCard label="Won" value={stats.won} />
            <StatCard label="Conversion" value={`${stats.conversion}%`} hint="won ÷ total" />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Status funnel */}
            <Card className="p-5">
              <h3 className="mb-4 text-sm font-semibold text-slate-900">Status Funnel</h3>
              {stats.funnel.length === 0 ? (
                <Empty />
              ) : (
                <div className="space-y-3">
                  {stats.funnel.map((s) => (
                    <div key={s.key}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700">{titleCase(s.key)}</span>
                        <span className="text-slate-500">{s.count} · {s.pct}%</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-blue-600" style={{ width: `${s.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Source distribution */}
            <Card className="p-5">
              <h3 className="mb-4 text-sm font-semibold text-slate-900">Lead Source Distribution</h3>
              {stats.sources.length === 0 ? (
                <Empty />
              ) : (
                <div className="space-y-3">
                  {stats.sources.map((s, i) => (
                    <div key={s.key}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700">{titleCase(s.key)}</span>
                        <span className="text-slate-500">{s.count} · {s.pct}%</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`} style={{ width: `${s.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Recent movement */}
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Recently Updated Leads</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Lead</th>
                    <th className="py-2 pr-3 font-medium">Source</th>
                    <th className="py-2 pr-3 font-medium">Stage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.recent.map((c) => (
                    <tr key={c._id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/executive/customers/${c._id}`)}>
                      <td className="py-2 pr-3 font-medium text-slate-800">{c.name}</td>
                      <td className="py-2 pr-3 text-slate-600">{titleCase(c.source || '—')}</td>
                      <td className="py-2 pr-3"><StatusBadge status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

const BAR_COLORS = ['bg-blue-600', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-rose-500', 'bg-cyan-500', 'bg-slate-400']
const WON = new Set(['booked', 'won', 'converted', 'closed_won', 'sale_completed'])
const LOST = new Set(['lost', 'closed_lost', 'dropped', 'rejected', 'dead'])

// Preferred funnel ordering; unknown statuses are appended after these.
const FUNNEL_ORDER = ['new', 'contacted', 'qualified', 'interested', 'negotiation', 'visit_scheduled', 'booked', 'won', 'lost']

function Empty() {
  return <p className="py-6 text-center text-sm text-slate-400">Not enough data.</p>
}

function buildStats(list) {
  const total = list.length
  const won = list.filter((c) => WON.has(c.status)).length
  const lost = list.filter((c) => LOST.has(c.status)).length
  const active = total - won - lost
  const conversion = total ? Math.round((won / total) * 100) : 0

  const tally = (key) => {
    const m = new Map()
    for (const c of list) {
      const v = c[key] || 'unknown'
      m.set(v, (m.get(v) || 0) + 1)
    }
    return m
  }

  const statusMap = tally('status')
  const maxStatus = Math.max(1, ...statusMap.values())
  const funnel = [...statusMap.entries()]
    .sort((a, b) => {
      const ia = FUNNEL_ORDER.indexOf(a[0]); const ib = FUNNEL_ORDER.indexOf(b[0])
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
    .map(([key, count]) => ({ key, count, pct: Math.round((count / maxStatus) * 100) }))

  const sourceMap = tally('source')
  const sources = [...sourceMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, count, pct: total ? Math.round((count / total) * 100) : 0 }))

  const recent = [...list]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 8)

  return { total, won, lost, active, conversion, funnel, sources, recent }
}
