import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Input, Select, Loader, ErrorState } from '../../../components/ui.jsx'
import { billingApi } from '../../../api/resources.js'
import { useFetch } from '../../../hooks/useFetch.js'

const STATUS_CFG = {
  paid:      { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Paid' },
  pending:   { cls: 'bg-amber-50 text-amber-700 border-amber-200',       label: 'Pending' },
  failed:    { cls: 'bg-rose-50 text-rose-700 border-rose-200',          label: 'Failed' },
  refunded:  { cls: 'bg-blue-50 text-blue-700 border-blue-200',          label: 'Refunded' },
  cancelled: { cls: 'bg-slate-100 text-slate-500 border-slate-200',      label: 'Cancelled' },
}

function fmtDate(s) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [plan, setPlan]     = useState('all')

  const { data, loading, error, refetch } = useFetch(useCallback(() => billingApi.subscriptions(), []))
  const BILLING_RECORDS = data || []

  const filtered = BILLING_RECORDS.filter(r => {
    const q = search.toLowerCase()
    const matchQ      = !q || r.company.toLowerCase().includes(q) || r.invoice.toLowerCase().includes(q)
    const matchStatus = status === 'all' || r.status === status
    const matchPlan   = plan === 'all'   || r.plan   === plan
    return matchQ && matchStatus && matchPlan
  })

  const plans = [...new Set(BILLING_RECORDS.map(r => r.plan))]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        subtitle="All company billing records and payment status across the platform"
      />

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Search company or invoice…" value={search}
          onChange={e => setSearch(e.target.value)} className="w-60" />
        <Select value={status} onChange={e => setStatus(e.target.value)} className="w-36">
          <option value="all">All Status</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <Select value={plan} onChange={e => setPlan(e.target.value)} className="w-40">
          <option value="all">All Plans</option>
          {plans.map(p => <option key={p} value={p}>{p}</option>)}
        </Select>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(STATUS_CFG).map(([k, v]) => {
          const count = BILLING_RECORDS.filter(r => r.status === k).length
          return (
            <button key={k}
              onClick={() => setStatus(status === k ? 'all' : k)}
              className={`text-xs rounded-full border px-3 py-1 font-medium transition ${status === k ? v.cls : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'}`}>
              {v.label}: {count}
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Company</th>
              <th className="px-4 py-3 text-left font-medium">Current Plan</th>
              <th className="px-4 py-3 text-left font-medium">Billing Cycle</th>
              <th className="px-4 py-3 text-left font-medium">Amount</th>
              <th className="px-4 py-3 text-left font-medium">Invoice #</th>
              <th className="px-4 py-3 text-left font-medium">Due Date</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                <div className="text-3xl mb-2">₹</div>
                <div className="font-medium text-slate-600">No billing records match your filters</div>
              </td></tr>
            ) : filtered.map(r => {
              const cfg = STATUS_CFG[r.status] || STATUS_CFG.cancelled
              return (
                <tr key={r.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">{r.logo}</div>
                      <span className="font-medium text-slate-900">{r.company}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{r.plan}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{r.cycle}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {r.amount != null ? `₹${r.amount.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.invoice}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(r.due)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* ── View — navigates to Billing Details page ── */}
                      <button
                        onClick={() => navigate(`/super-admin/billing/records/${r.id}`)}
                        className="px-2 py-1 text-xs rounded border border-blue-200 text-blue-600 hover:bg-blue-50 transition font-medium">
                        View
                      </button>
                      <button className="px-2 py-1 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition font-medium">
                        ↓ Invoice
                      </button>
                      {r.status === 'failed' && (
                        <button className="px-2 py-1 text-xs rounded border border-amber-200 text-amber-700 hover:bg-amber-50 transition font-medium">
                          ↻ Retry
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      </>}
    </div>
  )
}
