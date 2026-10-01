import { useState, useCallback } from 'react'
import { expensesApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, formatMoney, titleCase } from '../../lib/format.js'
import { Modal, Button, Input, StatusBadge, Loader, ErrorState } from '../../components/ui.jsx'

// Inline action icons + icon-button kit.
const svg = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">{p}</svg>
const ICON = {
  edit: svg(<path d="m16.86 4.49 1.69-1.7a1.87 1.87 0 1 1 2.65 2.66L8.28 18.06a4.5 4.5 0 0 1-1.9 1.13l-2.68.8.8-2.68a4.5 4.5 0 0 1 1.13-1.9z" />),
  submit: svg(<><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4z" /></>),
  verify: svg(<><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>),
  reject: svg(<><circle cx="12" cy="12" r="9" /><path d="m15 9-6 6M9 9l6 6" /></>),
  cancel: svg(<><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></>),
  upload: svg(<><path d="M12 15V3m0 0-4 4m4-4 4 4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>),
  download: svg(<><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>),
  print: svg(<><path d="M6 9V3h12v6" /><rect x="4" y="9" width="16" height="8" rx="2" /><path d="M8 17h8v4H8z" /></>),
  trash: svg(<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13h6l1-13" />),
}
const IB_TONES = {
  slate: 'border-slate-200 text-slate-600 hover:bg-slate-50',
  primary: 'border-blue-200 text-blue-600 hover:bg-blue-50',
  success: 'border-emerald-200 text-emerald-600 hover:bg-emerald-50',
  danger: 'border-rose-200 text-rose-600 hover:bg-rose-50',
}
function IconBtn({ title, onClick, icon, tone = 'slate', disabled }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border outline-none transition duration-150 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 ${IB_TONES[tone]}`}>
      {icon}
    </button>
  )
}
function FileIconBtn({ title, accept, onChange }) {
  return (
    <label title={title} aria-label={title}
      className={`inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border transition duration-150 focus-within:ring-2 focus-within:ring-blue-500 ${IB_TONES.slate}`}>
      {ICON.upload}
      <input type="file" accept={accept} className="hidden" onChange={onChange} />
    </label>
  )
}

function Field({ label, children }) {
  return <div><dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-0.5 text-sm text-slate-800">{children || '—'}</dd></div>
}

function printExpense(x) {
  const w = window.open('', '_blank', 'width=720,height=900')
  if (!w) return
  const row = (k, v) => `<tr><td style="padding:6px 12px;color:#64748b">${k}</td><td style="padding:6px 12px;font-weight:600">${v ?? '—'}</td></tr>`
  w.document.write(`<!doctype html><html><head><title>${x.expenseCode}</title>
    <style>body{font-family:system-ui,Arial,sans-serif;color:#0f172a;padding:32px}h1{font-size:20px}table{border-collapse:collapse;width:100%;margin-top:16px;border:1px solid #e2e8f0}td{border-bottom:1px solid #f1f5f9}</style>
    </head><body><h1>Expense Voucher</h1><div style="color:#64748b">${x.expenseCode} · ${formatDate(x.expenseDate)}</div>
    <table>${row('Title', x.title)}${row('Category', x.categoryName)}${row('Branch / Dept', `${x.branch || '—'} · ${x.department || '—'}`)}${row('Project', x.projectName || '—')}${row('Amount', formatMoney(x.amount))}${row('Payment Method', titleCase(x.paymentMethod))}${row('Paid To', x.paidTo || '—')}${row('Reference', x.referenceNumber || '—')}${row('Status', titleCase(x.status))}${row('Created By', x.createdByName)}</table>
    <p style="margin-top:24px;color:#94a3b8;font-size:12px">System-generated expense voucher.</p>
    <script>window.onload=function(){window.print()}</script></body></html>`)
  w.document.close()
}

export default function ExpenseDetailModal({ expenseId, onClose, onChanged, onEdit }) {
  const { can, user } = useAuth()
  const toast = useToast()
  const { data: x, loading, error, refetch } = useFetch(useCallback(() => expensesApi.get(expenseId), [expenseId]))
  const [panel, setPanel] = useState(null)
  const [pf, setPf] = useState({})
  const [busy, setBusy] = useState(false)

  if (loading) return <Modal open onClose={onClose} wide title="Expense"><Loader /></Modal>
  if (error) return <Modal open onClose={onClose} wide title="Expense"><ErrorState message={error} onRetry={refetch} /></Modal>

  const isOwner = String(x.createdBy?._id) === String(user.id || user._id)
  const isManager = can('expense', 'edit') && user.role !== 'sales_executive'
  const canVerify = can('expense', 'verify')
  const canDelete = can('expense', 'delete')
  const terminal = ['verified', 'cancelled', 'rejected'].includes(x.status)
  const canEdit = isManager || (isOwner && ['draft', 'submitted'].includes(x.status))
  const after = () => { setPanel(null); setPf({}); refetch(); onChanged?.() }

  async function run(fn, msg) { setBusy(true); try { await fn(); toast.success(msg); after() } catch (err) { toast.error(err.response?.data?.message || 'Action failed') } finally { setBusy(false) } }
  const submit = () => run(() => expensesApi.setStatus(x._id, { status: 'submitted' }), 'Expense submitted')
  const verify = () => run(() => expensesApi.setStatus(x._id, { status: 'verified' }), 'Expense verified')
  const reject = () => run(() => expensesApi.setStatus(x._id, { status: 'rejected', note: pf.reason || '' }), 'Expense rejected')
  const cancel = () => run(() => expensesApi.setStatus(x._id, { status: 'cancelled', note: pf.reason || '' }), 'Expense cancelled')
  const del = () => { if (window.confirm('Delete this expense? It will be soft-deleted and removed from totals.')) run(() => expensesApi.remove(x._id).then(onClose), 'Expense deleted') }
  const download = async () => { try { const res = await expensesApi.downloadReceipt(x._id); window.open(res.data.data.fileUrl, '_blank') } catch (err) { toast.error(err.response?.data?.message || 'No receipt') } }
  async function upload(e) { const f = e.target.files?.[0]; if (!f) return; const fd = new FormData(); fd.append('file', f); fd.append('label', f.name); await run(() => expensesApi.uploadReceipt(x._id, fd), 'Receipt saved'); e.target.value = '' }

  const isImg = x.receipt?.mimeType?.startsWith('image/')
  const isPdf = x.receipt?.mimeType === 'application/pdf'

  return (
    <Modal open onClose={onClose} wide title={`${x.expenseCode} · ${x.title}`} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <div className="space-y-5">
        {/* Status chips (left) + icon action buttons (top-right corner) */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={x.status} />
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">{x.categoryName}</span>
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs capitalize text-slate-600">{titleCase(x.paymentMethod)}</span>
            {x.categoryGroup === 'marketing' && <span className="rounded border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs text-violet-700">Marketing</span>}
          </div>
          <div className="flex items-center gap-1.5">
            {canEdit && onEdit && <IconBtn title="Edit" icon={ICON.edit} onClick={() => onEdit(x)} />}
            {(isOwner || isManager) && x.status === 'draft' && <IconBtn title="Submit" icon={ICON.submit} tone="primary" onClick={submit} disabled={busy} />}
            {canVerify && x.status === 'submitted' && <IconBtn title="Verify" icon={ICON.verify} tone="success" onClick={verify} disabled={busy} />}
            {canVerify && x.status === 'submitted' && <IconBtn title="Reject" icon={ICON.reject} tone="danger" onClick={() => setPanel('reject')} />}
            {(isOwner || isManager) && !terminal && <IconBtn title="Cancel" icon={ICON.cancel} tone="danger" onClick={() => setPanel('cancel')} />}
            {canEdit && <FileIconBtn title={x.receipt?.fileUrl ? 'Replace Receipt' : 'Upload Receipt'} accept=".pdf,.jpg,.jpeg,.png" onChange={upload} />}
            {x.receipt?.fileUrl && <IconBtn title="Download Receipt" icon={ICON.download} onClick={download} />}
            <IconBtn title="Print" icon={ICON.print} onClick={() => printExpense(x)} />
            {canDelete && <IconBtn title="Delete" icon={ICON.trash} tone="danger" onClick={del} />}
          </div>
        </div>

        {panel === 'reject' && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <div className="mb-2 text-sm font-semibold text-slate-900">Reject Expense</div>
            <Input label="Reason" value={pf.reason || ''} onChange={(e) => setPf({ reason: e.target.value })} />
            <div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => setPanel(null)}>Back</Button><Button size="sm" variant="danger" onClick={reject} disabled={busy}>Reject</Button></div>
          </div>
        )}
        {panel === 'cancel' && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 text-sm font-semibold text-slate-900">Cancel Expense</div>
            <Input label="Reason" value={pf.reason || ''} onChange={(e) => setPf({ reason: e.target.value })} />
            <div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => setPanel(null)}>Back</Button><Button size="sm" variant="danger" onClick={cancel} disabled={busy}>Cancel Expense</Button></div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <h4 className="mb-3 text-sm font-semibold text-slate-900">Expense Information</h4>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Amount">{formatMoney(x.amount)}</Field>
              <Field label="Date">{formatDate(x.expenseDate)}</Field>
              <Field label="Category">{x.categoryName}</Field>
              <Field label="Payment Method">{titleCase(x.paymentMethod)}</Field>
              <Field label="Branch">{x.branch}</Field>
              <Field label="Department">{x.department}</Field>
              <Field label="Project">{x.projectName || x.project?.name}</Field>
              <Field label="Paid To">{x.paidTo}</Field>
              <Field label="Reference No">{x.referenceNumber}</Field>
              <Field label="Created By">{x.createdBy?.name || x.createdByName} {x.createdByRole ? `· ${titleCase(x.createdByRole)}` : ''}</Field>
              {x.verifiedByName && <Field label="Verified By">{x.verifiedByName} · {formatDate(x.verifiedAt)}</Field>}
            </dl>
            {x.description && <p className="mt-3 text-sm text-slate-600"><span className="text-xs uppercase text-slate-500">Description</span><br />{x.description}</p>}
            {x.rejectReason && <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800"><strong>Rejected:</strong> {x.rejectReason}</div>}
            {x.cancelReason && <div className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700"><strong>Cancelled:</strong> {x.cancelReason}</div>}
          </section>
          <section>
            <h4 className="mb-3 text-sm font-semibold text-slate-900">Receipt</h4>
            {x.receipt?.fileUrl ? (
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 text-xs text-slate-500">{x.receipt.receiptNumber} · {x.receipt.uploadedByName} · {formatDate(x.receipt.uploadedAt)}</div>
                {isImg && <img src={x.receipt.fileUrl} alt="Receipt" className="max-h-64 rounded" />}
                {isPdf && <iframe title="Receipt" src={x.receipt.fileUrl} className="h-64 w-full rounded border-0" />}
                {!isImg && !isPdf && <a href={x.receipt.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600">{x.receipt.fileName}</a>}
              </div>
            ) : <p className="text-sm text-slate-400">No receipt uploaded.</p>}

            <h4 className="mb-2 mt-5 text-sm font-semibold text-slate-900">Expense Timeline</h4>
            <div className="relative space-y-3 border-l border-slate-200 pl-5">
              {(x.activity || []).slice().reverse().map((a) => (
                <div key={a._id} className="relative"><span className="absolute -left-[23px] top-1 h-2.5 w-2.5 rounded-full bg-blue-500" /><div className="text-sm text-slate-800">{titleCase(a.type)}{a.note ? <span className="text-slate-500"> — {a.note}</span> : null}</div><div className="text-xs text-slate-400">{a.actorName} · {formatDate(a.at, true)}</div></div>
              ))}
              {(!x.activity || x.activity.length === 0) && <p className="text-sm text-slate-400">No activity yet</p>}
            </div>
          </section>
        </div>
      </div>
    </Modal>
  )
}
