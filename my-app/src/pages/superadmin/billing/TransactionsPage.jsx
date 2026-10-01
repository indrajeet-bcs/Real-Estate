import { useState, useCallback } from 'react'
import { PageHeader, Input, Select, Loader, ErrorState } from '../../../components/ui.jsx'
import { billingApi } from '../../../api/resources.js'
import { useFetch } from '../../../hooks/useFetch.js'

const STATUS_CFG = {
  paid:     { cls:'bg-emerald-50 text-emerald-700 border-emerald-200', label:'Paid' },
  pending:  { cls:'bg-amber-50 text-amber-700 border-amber-200',       label:'Pending' },
  failed:   { cls:'bg-rose-50 text-rose-700 border-rose-200',          label:'Failed' },
  refunded: { cls:'bg-blue-50 text-blue-700 border-blue-200',          label:'Refunded' },
}

function fmtDate(s) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-IN', { year:'numeric', month:'short', day:'numeric' })
}
const fmtAmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState('all')
  const [gateway, setGateway] = useState('all')

  const { data, loading, error, refetch } = useFetch(useCallback(() => billingApi.transactions(), []))
  const TRANSACTIONS = data || []

  const filtered = TRANSACTIONS.filter(r => {
    const q = search.toLowerCase()
    const matchQ = !q ||
      r.id.toLowerCase().includes(q) ||
      r.company.toLowerCase().includes(q) ||
      r.invoice.toLowerCase().includes(q) ||
      r.ref.toLowerCase().includes(q)
    const matchStatus  = status === 'all'  || r.status  === status
    const matchGateway = gateway === 'all' || r.gateway === gateway
    return matchQ && matchStatus && matchGateway
  })

  const gateways = [...new Set(TRANSACTIONS.map(t => t.gateway))]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        subtitle="All payment transactions across every company and gateway"
      />

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Search by company, TXN ID, invoice, ref…" value={search}
          onChange={e => setSearch(e.target.value)} className="w-72" />
        <Select value={status} onChange={e => setStatus(e.target.value)} className="w-36">
          <option value="all">All Status</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <Select value={gateway} onChange={e => setGateway(e.target.value)} className="w-40">
          <option value="all">All Gateways</option>
          {gateways.map(g => <option key={g} value={g}>{g}</option>)}
        </Select>
      </div>

      {/* Quick filter chips */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(STATUS_CFG).map(([k, v]) => {
          const count = TRANSACTIONS.filter(t => t.status === k).length
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
              <th className="px-4 py-3 text-left font-medium">Transaction ID</th>
              <th className="px-4 py-3 text-left font-medium">Company</th>
              <th className="px-4 py-3 text-left font-medium">Invoice #</th>
              <th className="px-4 py-3 text-left font-medium">Gateway</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Reference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                <div className="text-3xl mb-2">⇄</div>
                <div className="font-medium text-slate-600">No transactions match your filters</div>
              </td></tr>
            ) : filtered.map(r => {
              const cfg = STATUS_CFG[r.status] || STATUS_CFG.pending
              return (
                <tr key={r.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{r.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">{r.logo}</div>
                      <span className="font-medium text-slate-900">{r.company}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-blue-700">{r.invoice}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-xs rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 font-medium">{r.gateway}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmtAmt(r.amount)}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(r.date)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 max-w-[160px] truncate" title={r.ref}>{r.ref}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500 bg-slate-50">
            Showing {filtered.length} of {TRANSACTIONS.length} transactions
          </div>
        )}
      </div>
      </>}
    </div>
  )
}
