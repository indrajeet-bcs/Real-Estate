import { useState, useCallback } from 'react'
import { PageHeader, Input, Select, Loader, ErrorState } from '../../../components/ui.jsx'
import { billingApi } from '../../../api/resources.js'
import { useFetch } from '../../../hooks/useFetch.js'
import { useToast } from '../../../context/ToastContext.jsx'

const STATUS_CFG = {
  paid:      { cls:'bg-emerald-50 text-emerald-700 border-emerald-200', label:'Paid' },
  pending:   { cls:'bg-amber-50 text-amber-700 border-amber-200',       label:'Pending' },
  failed:    { cls:'bg-rose-50 text-rose-700 border-rose-200',          label:'Failed' },
  refunded:  { cls:'bg-blue-50 text-blue-700 border-blue-200',          label:'Refunded' },
  cancelled: { cls:'bg-slate-100 text-slate-500 border-slate-200',      label:'Cancelled' },
}

function fmtDate(s) {
  if (!s) return '\u2014'
  return new Date(s).toLocaleDateString('en-IN', { year:'numeric', month:'short', day:'numeric' })
}
function fmtMoney(n) { return `\u20B9${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` }

// ─── Invoice Detail Panel ──────────────────────────────────────────────────────

function InvoiceDetail({ inv, onClose, onPdf, onEmail, pdfBusy, emailBusy }) {
  if (!inv) return null
  const cfg = STATUS_CFG[inv.status] || STATUS_CFG.cancelled
  const subtotal = inv.amount
  const gst = inv.gst
  const grand = subtotal + gst

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-end bg-slate-900/30" onClick={onClose}>
      <div className="h-full w-full max-w-lg bg-white shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Invoice Detail</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPdf(inv)}
              disabled={pdfBusy[inv.id]}
              className="text-xs rounded border border-blue-200 px-3 py-1.5 text-blue-600 hover:bg-blue-50 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed">
              {pdfBusy[inv.id] ? 'Opening...' : '\u2193 PDF'}
            </button>
            <button
              onClick={() => onEmail(inv)}
              disabled={emailBusy[inv.id]}
              className="text-xs rounded border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed">
              {emailBusy[inv.id] ? 'Sending...' : '\u2709 Email'}
            </button>
            <button onClick={onClose} className="ml-2 text-slate-400 hover:text-slate-700 text-lg leading-none">&times;</button>
          </div>
        </div>
        <div className="px-6 py-6 space-y-6">
          {/* Invoice Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-slate-400 font-medium uppercase tracking-wide">Invoice Number</div>
              <div className="font-mono text-lg font-bold text-slate-900 mt-0.5">{inv.id}</div>
            </div>
            <span className={`inline-block rounded border px-3 py-1 text-sm font-semibold ${cfg.cls}`}>{cfg.label}</span>
          </div>

          {/* Company Details */}
          <div className="rounded-xl bg-slate-50 p-4 space-y-1">
            <div className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">Bill To</div>
            <div className="font-semibold text-slate-900">{inv.company}</div>
            <div className="text-sm text-slate-600">{inv.address}</div>
            <div className="text-sm text-slate-600">GST: <span className="font-mono">{inv.gstNo}</span></div>
          </div>

          {/* Plan Details */}
          <div className="space-y-2">
            <div className="text-xs text-slate-400 font-medium uppercase tracking-wide">Subscription Details</div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Plan</span>
              <span className="font-medium text-slate-900">{inv.plan}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Billing Cycle</span>
              <span className="font-medium text-slate-900 capitalize">{inv.cycle}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Invoice Date</span>
              <span className="font-medium text-slate-900">{fmtDate(inv.invDate)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Due Date</span>
              <span className="font-medium text-slate-900">{fmtDate(inv.dueDate)}</span>
            </div>
            {inv.paidOn && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Paid On</span>
                <span className="font-medium text-emerald-700">{fmtDate(inv.paidOn)}</span>
              </div>
            )}
          </div>

          {/* Amount Breakdown */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs text-slate-500 font-medium">Description</th>
                  <th className="px-4 py-2 text-right text-xs text-slate-500 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-3 text-slate-700">{inv.plan} — {inv.cycle} subscription</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmtMoney(subtotal)}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-3 text-slate-500">GST</td>
                  <td className="px-4 py-3 text-right text-slate-500">{fmtMoney(gst)}</td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900 text-base">{fmtMoney(grand)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const toast = useToast()
  const [search, setSearch]     = useState('')
  const [status, setStatus]     = useState('all')
  const [selected, setSelected] = useState(null)
  const [pdfBusy, setPdfBusy]   = useState({})   // { [invoiceId]: true } while downloading
  const [emailBusy, setEmailBusy] = useState({}) // { [invoiceId]: true } while sending

  const { data, loading, error, refetch } = useFetch(useCallback(() => billingApi.invoices(), []))
  const INVOICES = data || []

  const filtered = INVOICES.filter(r => {
    const q = search.toLowerCase()
    const matchQ = !q || r.id.toLowerCase().includes(q) || r.company.toLowerCase().includes(q)
    const matchStatus = status === 'all' || r.status === status
    return matchQ && matchStatus
  })

  // ── PDF download (authenticated via axios → blob URL) ─────────────────────
  async function handlePdf(r) {
    if (pdfBusy[r.id]) return
    setPdfBusy(s => ({ ...s, [r.id]: true }))
    try {
      const res = await billingApi.downloadInvoice(r.id)
      const blob = new Blob([res.data], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const win = window.open(url, '_blank')
      if (!win) toast.error('Pop-up blocked \u2014 please allow pop-ups for this site.')
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to download invoice')
    } finally {
      setPdfBusy(s => ({ ...s, [r.id]: false }))
    }
  }

  // ── Email invoice ──────────────────────────────────────────────────────────
  async function handleEmail(r) {
    if (emailBusy[r.id]) return
    setEmailBusy(s => ({ ...s, [r.id]: true }))
    try {
      const res = await billingApi.emailInvoice(r.id)
      const { sentTo, message } = res.data?.data || {}
      toast.success(message || `Invoice sent to ${sentTo}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send invoice email')
    } finally {
      setEmailBusy(s => ({ ...s, [r.id]: false }))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        subtitle="All platform invoices with GST breakdowns and download options"
      />

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Search invoice # or company…" value={search}
          onChange={e => setSearch(e.target.value)} className="w-60" />
        <Select value={status} onChange={e => setStatus(e.target.value)} className="w-36">
          <option value="all">All Status</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Invoice #</th>
              <th className="px-4 py-3 text-left font-medium">Company</th>
              <th className="px-4 py-3 text-left font-medium">Plan</th>
              <th className="px-4 py-3 text-left font-medium">Invoice Date</th>
              <th className="px-4 py-3 text-left font-medium">Due Date</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 text-right font-medium">GST</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                <div className="text-3xl mb-2">\uD83E\uDDFE</div>
                <div className="font-medium text-slate-600">No invoices found</div>
              </td></tr>
            ) : filtered.map(r => {
              const cfg = STATUS_CFG[r.status] || STATUS_CFG.cancelled
              return (
                <tr key={r.id} className="hover:bg-slate-50 transition cursor-pointer" onClick={() => setSelected(r)}>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">{r.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">{r.logo}</div>
                      <span className="font-medium text-slate-900">{r.company}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{r.plan}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(r.invDate)}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(r.dueDate)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmtMoney(r.amount)}</td>
                  <td className="px-4 py-3 text-right text-slate-500 text-xs">{fmtMoney(r.gst)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handlePdf(r)}
                        disabled={pdfBusy[r.id]}
                        title={`Download PDF for ${r.id}`}
                        className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                        {pdfBusy[r.id] ? '...' : '\u2193 PDF'}
                      </button>
                      <button
                        onClick={() => handleEmail(r)}
                        disabled={emailBusy[r.id]}
                        title={`Email invoice ${r.id} to company admin`}
                        className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                        {emailBusy[r.id] ? 'Sending...' : '\u2709 Email'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      </>}
      {selected && (
        <InvoiceDetail
          inv={selected}
          onClose={() => setSelected(null)}
          onPdf={handlePdf}
          onEmail={handleEmail}
          pdfBusy={pdfBusy}
          emailBusy={emailBusy}
        />
      )}
    </div>
  )
}
