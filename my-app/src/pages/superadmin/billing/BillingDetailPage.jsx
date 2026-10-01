import { useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Button, Loader, ErrorState } from '../../../components/ui.jsx'
import { billingApi } from '../../../api/resources.js'
import { useFetch } from '../../../hooks/useFetch.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(s) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
}

function fmtMoney(n) {
  if (n == null) return '—'
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function val(v) {
  if (v == null || v === '') return '—'
  return v
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const PAYMENT_STATUS = {
  paid:      { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Paid' },
  pending:   { cls: 'bg-amber-50 text-amber-700 border-amber-200',       label: 'Pending' },
  failed:    { cls: 'bg-rose-50 text-rose-700 border-rose-200',          label: 'Failed' },
  refunded:  { cls: 'bg-blue-50 text-blue-700 border-blue-200',          label: 'Refunded' },
  cancelled: { cls: 'bg-slate-100 text-slate-500 border-slate-200',      label: 'Cancelled' },
}

const SUB_STATUS = {
  active:    { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Active' },
  trial:     { cls: 'bg-amber-50 text-amber-700 border-amber-200',       label: 'Trial' },
  expired:   { cls: 'bg-rose-50 text-rose-700 border-rose-200',          label: 'Expired' },
  suspended: { cls: 'bg-slate-100 text-slate-500 border-slate-200',      label: 'Suspended' },
}

const COMPANY_STATUS = {
  active:    { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Active' },
  trial:     { cls: 'bg-amber-50 text-amber-700 border-amber-200',       label: 'Trial' },
  suspended: { cls: 'bg-rose-50 text-rose-700 border-rose-200',          label: 'Suspended' },
}

function StatusBadge({ status, map }) {
  const cfg = map[status] || { cls: 'bg-slate-100 text-slate-500 border-slate-200', label: status || '—' }
  return (
    <span className={`inline-block rounded border px-2.5 py-0.5 text-xs font-semibold capitalize ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ─── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500 shrink-0 w-44">{label}</span>
      <div className="text-sm font-medium text-slate-900 text-right">{children}</div>
    </div>
  )
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <Card className="p-6">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</h2>
      {children}
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BillingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useFetch(useCallback(() => billingApi.getSubscription(id), [id]))

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  // Flatten the subscription + its latest invoice into the record shape the UI uses.
  const inv = data?.invoices?.[0]
  const record = data && {
    company: data.company, logo: (data.company || '').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase(),
    adminName: data.adminName, adminEmail: data.adminEmail, companyStatus: data.companyStatus,
    plan: data.plan, cycle: data.cycle, subStart: data.subStart, renewal: data.renewal, subStatus: data.subStatus,
    invoice: inv?.invoiceNumber || '—', txnId: '—',
    amount: inv?.amount ?? data.amount, gst: inv?.gst ?? 0, total: inv?.total ?? data.amount,
    paidOn: inv?.paidOn || null, paymentMethod: inv?.paymentMethod || data.gateway, status: inv?.status || (data.subStatus === 'active' ? 'paid' : 'pending'),
  }

  /* ── Not Found ── */
  if (!record) {
    return (
      <div className="py-24 text-center space-y-4">
        <div className="text-5xl text-slate-300">₹</div>
        <div className="text-lg font-semibold text-slate-700">Billing record not found</div>
        <p className="text-sm text-slate-500">The record you are looking for does not exist or has been removed.</p>
        <Button variant="secondary" onClick={() => navigate('/super-admin/billing/records')}>
          ← Back to Billing
        </Button>
      </div>
    )
  }

  const paymentCfg = PAYMENT_STATUS[record.status] || PAYMENT_STATUS.cancelled

  /* ── Next billing date = renewal date ── */
  const nextBillingDate = record.renewal

  return (
    <div className="space-y-6 max-w-3xl">

      {/* ── Page Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/super-admin/billing/records')}
            className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition">
            ← Billing
          </button>
          <h1 className="text-xl font-bold text-slate-900">Billing Details</h1>
          <p className="mt-0.5 text-sm text-slate-500 font-mono">{record.invoice}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-block rounded border px-3 py-1 text-sm font-semibold ${paymentCfg.cls}`}>
            {paymentCfg.label}
          </span>
        </div>
      </div>

      {/* ── Section 1: Company Information ── */}
      <Section title="Company Information">
        <div className="flex items-center gap-4 mb-5 pb-5 border-b border-slate-100">
          <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center text-lg font-bold text-blue-700 shrink-0">
            {record.logo}
          </div>
          <div>
            <div className="text-base font-bold text-slate-900">{val(record.company)}</div>
            <div className="text-sm text-slate-500 mt-0.5">{val(record.adminEmail)}</div>
          </div>
          <div className="ml-auto">
            <StatusBadge status={record.companyStatus} map={COMPANY_STATUS} />
          </div>
        </div>
        <InfoRow label="Company Name">{val(record.company)}</InfoRow>
        <InfoRow label="Admin Name">{val(record.adminName)}</InfoRow>
        <InfoRow label="Admin Email">
          <span className="font-mono text-xs">{val(record.adminEmail)}</span>
        </InfoRow>
        <InfoRow label="Company Status">
          <StatusBadge status={record.companyStatus} map={COMPANY_STATUS} />
        </InfoRow>
      </Section>

      {/* ── Section 2: Subscription Information ── */}
      <Section title="Subscription Information">
        <InfoRow label="Subscription Plan">{val(record.plan)}</InfoRow>
        <InfoRow label="Billing Cycle">
          <span className="capitalize">{val(record.cycle)}</span>
        </InfoRow>
        <InfoRow label="Subscription Start">{fmtDate(record.subStart)}</InfoRow>
        <InfoRow label="Renewal Date">{fmtDate(record.renewal)}</InfoRow>
        <InfoRow label="Subscription Status">
          <StatusBadge status={record.subStatus} map={SUB_STATUS} />
        </InfoRow>
      </Section>

      {/* ── Section 3: Payment Information ── */}
      <Section title="Payment Information">
        <InfoRow label="Invoice Number">
          <span className="font-mono text-xs">{val(record.invoice)}</span>
        </InfoRow>
        <InfoRow label="Transaction ID">
          <span className="font-mono text-xs">{val(record.txnId)}</span>
        </InfoRow>
        <InfoRow label="Amount">{fmtMoney(record.amount)}</InfoRow>
        <InfoRow label="GST Amount">{fmtMoney(record.gst)}</InfoRow>
        <InfoRow label="Total Paid">{fmtMoney(record.total)}</InfoRow>
        <InfoRow label="Payment Date">{fmtDate(record.paidOn)}</InfoRow>
        <InfoRow label="Payment Method">{val(record.paymentMethod)}</InfoRow>
        <InfoRow label="Payment Status">
          <StatusBadge status={record.status} map={PAYMENT_STATUS} />
        </InfoRow>
      </Section>

      {/* ── Section 4: Billing Summary ── */}
      <Section title="Billing Summary">
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">Subtotal</td>
                <td className="px-4 py-3 text-right font-medium text-slate-900">{fmtMoney(record.amount)}</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">GST (18%)</td>
                <td className="px-4 py-3 text-right text-slate-600">{fmtMoney(record.gst)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200">
                <td className="px-4 py-3 font-bold text-slate-900">Total Amount</td>
                <td className="px-4 py-3 text-right font-bold text-slate-900 text-base">{fmtMoney(record.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
          <span className="text-sm text-slate-600">Next Billing Date</span>
          <span className="text-sm font-semibold text-slate-900">{fmtDate(nextBillingDate)}</span>
        </div>
      </Section>

      {/* ── Section 5: Actions ── */}
      <div className="flex flex-wrap items-center gap-3 pb-8">
        <Button
          variant="primary"
          onClick={() => {/* download invoice */}}>
          ↓ Download Invoice
        </Button>

        {record.status === 'failed' && (
          <Button
            variant="secondary"
            className="border-amber-300 text-amber-700 hover:bg-amber-50"
            onClick={() => {/* retry payment */}}>
            ↻ Retry Payment
          </Button>
        )}

        <Button
          variant="secondary"
          onClick={() => navigate('/super-admin/billing/records')}>
          ← Back
        </Button>
      </div>

    </div>
  )
}
