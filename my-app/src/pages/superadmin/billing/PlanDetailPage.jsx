import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Button, Input, Select, Loader, ErrorState } from '../../../components/ui.jsx'
import { billingApi } from '../../../api/resources.js'
import { useFetch } from '../../../hooks/useFetch.js'

// ─── (legacy sample kept only as a shape reference; live data comes from the API) ──



const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const revData = [8,12,10,16,20,18,24,22,26,28,25,30]
const subData = [3,5,4,7,9,8,11,10,13,15,13,17]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) { return n == null ? '—' : n === -1 ? 'Unlimited' : n.toLocaleString('en-IN') }
function fmtMoney(n) { return n === 0 ? 'Free' : `₹${n.toLocaleString('en-IN')}` }
function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('en-IN', { year:'numeric', month:'short', day:'numeric' })
}

function StatusBadge({ status }) {
  const map = {
    active:    'bg-emerald-50 text-emerald-700 border-emerald-200',
    trial:     'bg-amber-50 text-amber-700 border-amber-200',
    expired:   'bg-rose-50 text-rose-700 border-rose-200',
    suspended: 'bg-slate-100 text-slate-500 border-slate-200',
  }
  return <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium capitalize ${map[status] || map.expired}`}>{status}</span>
}

function MiniLineChart({ data, color = '#3b82f6' }) {
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1
  const W = 300, H = 60
  const pts = data.map((v, i) => [`${(i/(data.length-1))*W}`, `${H-((v-min)/range)*(H-12)-4}`])
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 60 }}>
      <path d={`M${pts[0].join(',')} L${pts.map(p => p.join(',')).join(' L')} L${pts[pts.length-1][0]},${H} L0,${H} Z`}
        fill={color} fillOpacity="0.1" />
      <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// ─── Feature Display ──────────────────────────────────────────────────────────

const FEATURE_LABELS = [
  { key:'maxEmployees',    label:'Max Employees',    numeric:true },
  { key:'maxProjects',     label:'Max Projects',     numeric:true },
  { key:'maxLeads',        label:'Max Leads',        numeric:true },
  { key:'maxStorage',      label:'Max Storage (GB)', numeric:true },
  { key:'attendance',      label:'Attendance Module',      numeric:false },
  { key:'reports',         label:'Reports Module',         numeric:false },
  { key:'analytics',       label:'Analytics Dashboard',    numeric:false },
  { key:'mobile',          label:'Mobile Application',     numeric:false },
  { key:'whatsapp',        label:'WhatsApp Integration',   numeric:false },
  { key:'api',             label:'API Access',             numeric:false },
  { key:'prioritySupport', label:'Priority Support',       numeric:false },
  { key:'customBranding',  label:'Custom Branding',        numeric:false },
  { key:'whiteLabel',      label:'White Label',            numeric:false },
  { key:'customDomain',    label:'Custom Domain',          numeric:false },
  { key:'backupFrequency', label:'Backup Frequency',       numeric:'text' },
]

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlanDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: plan, loading, error, refetch } = useFetch(useCallback(() => billingApi.getPlan(id), [id]))
  const { data: allSubs } = useFetch(useCallback(() => billingApi.subscriptions(), []))
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [cycleFilter, setCycleFilter] = useState('all')
  const [sort, setSort] = useState('newest')

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (!plan) {
    return (
      <div className="py-24 text-center">
        <div className="text-4xl mb-3">◈</div>
        <div className="text-lg font-semibold text-slate-700">Plan not found</div>
        <Button className="mt-4" variant="secondary" onClick={() => navigate('/super-admin/billing/plans')}>← Back to Plans</Button>
      </div>
    )
  }

  // Real companies subscribed to this plan.
  const COMPANIES = (allSubs || []).filter(s => s.plan === plan.name).map(s => ({
    id: s.id, name: s.company, logo: s.logo, admin: s.adminName, email: s.adminEmail,
    started: s.subStart, renewal: s.renewal, cycle: s.cycle, status: s.subStatus,
  }))

  const companies = COMPANIES.filter(c => {
    const q = search.toLowerCase()
    const matchQ = !q || c.name.toLowerCase().includes(q) || (c.admin || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    const matchCycle = cycleFilter === 'all' || c.cycle === cycleFilter
    return matchQ && matchStatus && matchCycle
  }).sort((a, b) => {
    if (sort === 'newest') return new Date(b.started) - new Date(a.started)
    if (sort === 'oldest') return new Date(a.started) - new Date(b.started)
    if (sort === 'renewal') return new Date(a.renewal) - new Date(b.renewal)
    return 0
  })

  const stats = [
    { label:'Total Subscribers',  value: plan.subscribers,         color:'text-blue-600'   },
    { label:'Active Subscribers',  value: Math.round(plan.subscribers * 0.72), color:'text-emerald-600' },
    { label:'Trial Subscribers',   value: plan.name === 'Trial' ? plan.subscribers : 0, color:'text-amber-600' },
    { label:'Monthly Revenue',     value: fmtMoney(plan.monthlyPrice * plan.subscribers), color:'text-violet-600' },
    { label:'Yearly Revenue',      value: plan.yearlyPrice > 0 ? fmtMoney(plan.yearlyPrice * Math.round(plan.subscribers * 0.3)) : 'N/A', color:'text-indigo-600' },
    { label:'Renewal Rate',        value:'92.4%',  color:'text-teal-600'    },
    { label:'Churn Rate',          value:'7.6%',   color:'text-rose-600'    },
  ]

  const billingHistory = [
    { inv:'INV-2025-0847', company:'Horizon Realty', amount:'₹1,999', date:'2025-07-01', status:'paid'   },
    { inv:'INV-2025-0831', company:'MetroHomes',     amount:'₹1,999', date:'2025-07-01', status:'paid'   },
    { inv:'INV-2025-0819', company:'BlueSky Realty', amount:'₹1,999', date:'2025-07-01', status:'failed' },
    { inv:'INV-2025-0802', company:'StarBuilders',   amount:'₹1,999', date:'2025-06-01', status:'paid'   },
  ]

  const recentActivities = [
    { icon:'🏢', text:'GreenField Properties subscribed to this plan', time:'3 days ago'  },
    { icon:'💳', text:'Payment received · MetroHomes · ₹1,999',       time:'6 days ago'  },
    { icon:'⬆️', text:'StarBuilders upgraded from Trial to this plan', time:'2 weeks ago' },
    { icon:'❌', text:'BlueSky Realty payment failed — retry pending',  time:'3 weeks ago' },
    { icon:'⏰', text:'SunsetVillas subscription expired',             time:'1 month ago' },
  ]

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/super-admin/billing/plans')}
            className="text-sm text-slate-500 hover:text-slate-800 transition">← Plans</button>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold text-white"
            style={{ background: plan.color }}>{plan.icon}</div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{plan.name} Plan</h1>
            <p className="text-sm text-slate-500">{plan.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm">Edit Plan</Button>
          <Button size="sm">+ Add Company to Plan</Button>
        </div>
      </div>

      {/* Section 1: Plan Information */}
      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">Plan Information</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label:'Plan Name',      value: plan.name },
            { label:'Monthly Price',  value: fmtMoney(plan.monthlyPrice) },
            { label:'Yearly Price',   value: fmtMoney(plan.yearlyPrice) },
            { label:'Trial Days',     value: plan.trialDays > 0 ? `${plan.trialDays} days` : 'None' },
            { label:'Status',         value: plan.status },
            { label:'Subscribers',   value: `${plan.subscribers} companies` },
            { label:'Created',        value: fmtDate(plan.createdAt) },
            { label:'Last Updated',   value: fmtDate(plan.updatedAt) },
          ].map(item => (
            <div key={item.label} className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-500 font-medium">{item.label}</div>
              <div className="mt-1 font-semibold text-slate-900 capitalize">{item.value}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Section 2: Plan Features */}
      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">Plan Features</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_LABELS.map(f => {
            const val = plan.features[f.key]
            const enabled = f.numeric ? (val !== 0 && val !== 'none') : val
            return (
              <div key={f.key} className="flex items-center gap-2.5 py-2 px-3 rounded-lg bg-slate-50">
                <span className={`text-base ${enabled ? 'text-emerald-500' : 'text-slate-300'}`}>
                  {enabled ? '✓' : '✗'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${enabled ? 'text-slate-800' : 'text-slate-400'}`}>{f.label}</div>
                  {f.numeric && <div className="text-xs text-slate-500">{f.numeric === 'text' ? val : fmt(val)}</div>}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Section 3: Plan Statistics */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">Plan Statistics</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {stats.map(s => (
            <Card key={s.label} className="p-4 text-center">
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-1 leading-tight">{s.label}</div>
            </Card>
          ))}
        </div>
      </div>

      {/* Section 4: Companies Using This Plan */}
      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Companies Using This Plan</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="Search companies..." value={search}
              onChange={e => setSearch(e.target.value)} className="w-48 text-sm py-1.5" />
            <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm py-1.5 w-32">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="expired">Expired</option>
              <option value="suspended">Suspended</option>
            </Select>
            <Select value={cycleFilter} onChange={e => setCycleFilter(e.target.value)} className="text-sm py-1.5 w-32">
              <option value="all">All Cycles</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </Select>
            <Select value={sort} onChange={e => setSort(e.target.value)} className="text-sm py-1.5 w-36">
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="renewal">Renewal Date</option>
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Company</th>
                <th className="px-4 py-3 text-left font-medium">Admin</th>
                <th className="px-4 py-3 text-left font-medium">Subscribed</th>
                <th className="px-4 py-3 text-left font-medium">Renewal</th>
                <th className="px-4 py-3 text-left font-medium">Cycle</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companies.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No companies match your search</td></tr>
              ) : companies.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">{c.logo}</div>
                      <div>
                        <div className="font-medium text-slate-900">{c.name}</div>
                        <div className="text-xs text-slate-500">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{c.admin}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(c.started)}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(c.renewal)}</td>
                  <td className="px-4 py-3">
                    <span className="capitalize text-slate-600">{c.cycle}</span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50 transition font-medium">
                      View Company
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Section 5: Revenue Analytics */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">Revenue Analytics</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <div className="text-sm font-semibold text-slate-800 mb-1">Monthly Revenue</div>
            <div className="text-xs text-slate-400 mb-3">Revenue generated by this plan per month</div>
            <MiniLineChart data={revData} color="#8b5cf6" />
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              {MONTHS.map(m => <span key={m}>{m}</span>)}
            </div>
          </Card>
          <Card className="p-5">
            <div className="text-sm font-semibold text-slate-800 mb-1">Subscriber Growth</div>
            <div className="text-xs text-slate-400 mb-3">New companies subscribing to this plan</div>
            <MiniLineChart data={subData} color="#3b82f6" />
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              {MONTHS.map(m => <span key={m}>{m}</span>)}
            </div>
          </Card>
        </div>
      </div>

      {/* Section 6: Billing History */}
      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">Billing History</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Invoice #</th>
                <th className="px-4 py-3 text-left font-medium">Company</th>
                <th className="px-4 py-3 text-left font-medium">Amount</th>
                <th className="px-4 py-3 text-left font-medium">Payment Date</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {billingHistory.map(b => (
                <tr key={b.inv} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{b.inv}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{b.company}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{b.amount}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(b.date)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium capitalize ${b.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>{b.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-xs text-blue-600 hover:underline font-medium">↓ PDF</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Section 7: Recent Activities */}
      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">Recent Activities</h2>
        <ol className="space-y-3">
          {recentActivities.map((a, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm">{a.icon}</span>
              <div className="flex-1">
                <div className="text-sm text-slate-800">{a.text}</div>
              </div>
              <div className="text-xs text-slate-400 whitespace-nowrap">{a.time}</div>
            </li>
          ))}
        </ol>
      </Card>

    </div>
  )
}
