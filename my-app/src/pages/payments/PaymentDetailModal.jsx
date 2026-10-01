import { useState, useEffect, useCallback, Fragment } from 'react'
import { paymentsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, formatMoney, titleCase } from '../../lib/format.js'
import { Modal, Button, Input, Textarea, Select, Loader, ErrorState } from '../../components/ui.jsx'
import { PAYMENT_METHODS } from '../../lib/payments.js'

// Inline icons (16px, currentColor).
const svg = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">{p}</svg>
const ICON = {
  download: svg(<><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>),
  printer: svg(<><path d="M6 9V3h12v6" /><rect x="4" y="9" width="16" height="8" rx="2" /><path d="M8 17h8v4H8z" /></>),
  check: svg(<path d="M20 6 9 17l-5-5" />),
  clock: svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  ban: svg(<><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></>),
  refund: svg(<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>),
  paperclip: svg(<path d="M21.44 11.05 12 20.5a5.5 5.5 0 0 1-7.78-7.78l8.49-8.49a3.5 3.5 0 0 1 4.95 4.95l-8.49 8.49a1.5 1.5 0 0 1-2.12-2.12l7.78-7.78" />),
  card: svg(<><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19" /></>),
  edit: svg(<path d="m16.86 4.49 1.69-1.7a1.87 1.87 0 1 1 2.65 2.66L8.28 18.06a4.5 4.5 0 0 1-1.9 1.13l-2.68.8.8-2.68a4.5 4.5 0 0 1 1.13-1.9z" />),
  upload: svg(<><path d="M12 15V3m0 0-4 4m4-4 4 4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>),
  trash: svg(<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13h6l1-13" />),
  receiptDoc: svg(<><path d="M6 2h9l3 3v17l-2.5-1.4L13 22l-2.5-1.4L8 22l-2.5-1.4L6 22z" /><path d="M9 8h6M9 12h6M9 16h4" /></>),
  alert: svg(<><path d="M12 9v4m0 4h.01" /><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.42 0z" /></>),
  dots: svg(<><circle cx="12" cy="5" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="12" cy="19" r="1.4" /></>),
}

// Overflow menu — secondary/tertiary actions grouped, danger zone below a divider.
const MENU_TONES = {
  default: 'text-slate-700 hover:bg-slate-100 [&>svg]:text-slate-400',
  primary: 'text-blue-700 hover:bg-blue-50 [&>svg]:text-blue-500',
  warning: 'text-amber-700 hover:bg-amber-50 [&>svg]:text-amber-500',
  danger: 'text-red-600 hover:bg-red-50 [&>svg]:text-red-500',
}
const menuItemCls = (tone = 'default') => `flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none transition duration-150 focus-visible:ring-2 focus-visible:ring-blue-500 ${MENU_TONES[tone] || MENU_TONES.default}`
function MoreMenu({ items }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 outline-none transition duration-150 hover:bg-slate-50 active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500">
        {ICON.dots}<span>More</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} aria-hidden="true" />
          <div role="menu" className="absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-150">
            {items.map((it, idx) => (
              <Fragment key={it.key}>
                {it.danger && (idx === 0 || !items[idx - 1].danger) && <div className="my-1.5 border-t border-slate-200" />}
                {it.file ? (
                  <label role="menuitem" className={menuItemCls(it.tone)}>{it.icon}<span>{it.label}</span><input type="file" accept={it.accept} className="hidden" onChange={(e) => { it.onChange(e); close() }} /></label>
                ) : (
                  <button type="button" role="menuitem" onClick={() => { close(); it.onClick() }} className={menuItemCls(it.tone)}>{it.icon}<span>{it.label}</span></button>
                )}
              </Fragment>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Status chip tone + icon (semantic colours only).
const STATUS_TONE = { verified: 'emerald', received: 'sky', pending: 'amber', cancelled: 'slate', refunded: 'violet' }
const STATUS_ICON = { verified: ICON.check, received: ICON.check, pending: ICON.clock, cancelled: ICON.ban, refunded: ICON.refund }
const CHIP_TONES = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  sky: 'border-sky-200 bg-sky-50 text-sky-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
  slate: 'border-slate-200 bg-slate-100 text-slate-600',
}
function Chip({ tone = 'slate', icon, children }) {
  return (
    <span className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium ${CHIP_TONES[tone] || CHIP_TONES.slate}`}>
      {icon}{children}
    </span>
  )
}

function Field({ label, children }) {
  const empty = children === undefined || children === null || children === '' || children === '—'
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`mt-1 truncate text-sm ${empty ? 'font-normal text-slate-400' : 'font-medium text-slate-900'}`}>{empty ? '—' : children}</dd>
    </div>
  )
}

function SectionCard({ title, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <h4 className="mb-4 text-sm font-semibold text-slate-900">{title}</h4>
      {children}
    </section>
  )
}

// Verifies the receipt file is actually served before embedding it, so a missing
// file / API error is NEVER rendered as raw JSON — a friendly state shows instead.
function ReceiptPreview({ receipt }) {
  const [state, setState] = useState('checking') // checking | ready | error | none
  useEffect(() => {
    if (!receipt?.fileUrl) { setState('none'); return }
    let active = true
    setState('checking')
    fetch(receipt.fileUrl, { method: 'HEAD' })
      .then((res) => {
        if (!active) return
        const ct = (res.headers.get('content-type') || '').toLowerCase()
        const looksLikeError = ct.includes('application/json') || ct.includes('text/html')
        setState(res.ok && !looksLikeError ? 'ready' : 'error')
      })
      .catch(() => { if (active) setState('error') })
    return () => { active = false }
  }, [receipt?.fileUrl])

  // No receipt at all → friendly empty state (guarded before touching receipt fields).
  if (!receipt?.fileUrl) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-10 text-center">
        <span className="mb-2 text-slate-300">{ICON.receiptDoc}</span>
        <p className="text-sm font-medium text-slate-500">No receipt uploaded</p>
      </div>
    )
  }

  const isImg = receipt.mimeType?.startsWith('image/')
  const isPdf = receipt.mimeType === 'application/pdf'

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-2 text-xs text-slate-500">
        <span className="text-slate-400">{ICON.paperclip}</span>
        <span className="font-medium text-slate-700">{receipt.receiptNumber || receipt.fileName || 'Receipt'}</span>
        <span className="ml-auto truncate">{receipt.uploadedByName}{receipt.uploadedAt ? ` · ${formatDate(receipt.uploadedAt)}` : ''}</span>
      </div>
      <div className="thin-scroll max-h-72 overflow-auto bg-slate-50 p-3">
        {state === 'checking' && (
          <div className="flex h-40 items-center justify-center text-sm text-slate-400">Loading receipt preview…</div>
        )}
        {state === 'error' && (
          <div className="flex h-40 flex-col items-center justify-center text-center">
            <span className="mb-2 text-amber-400">{ICON.alert}</span>
            <p className="text-sm font-medium text-slate-600">Unable to load the receipt preview.</p>
            <p className="mt-0.5 text-xs text-slate-400">Try downloading the receipt instead.</p>
          </div>
        )}
        {state === 'ready' && isImg && <img src={receipt.fileUrl} alt="Receipt" className="mx-auto max-h-64 rounded-lg" />}
        {state === 'ready' && isPdf && <iframe title="Receipt" src={receipt.fileUrl} className="h-64 w-full rounded-lg border-0 bg-white" />}
        {state === 'ready' && !isImg && !isPdf && (
          <a href={receipt.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700">{ICON.receiptDoc}{receipt.fileName || 'Open receipt'}</a>
        )}
      </div>
    </div>
  )
}

// Print a simple receipt document in a new window (§Actions · Print Receipt).
function printReceipt(p) {
  const w = window.open('', '_blank', 'width=720,height=900')
  if (!w) return
  const row = (k, v) => `<tr><td style="padding:6px 12px;color:#64748b">${k}</td><td style="padding:6px 12px;font-weight:600">${v ?? '—'}</td></tr>`
  w.document.write(`<!doctype html><html><head><title>Receipt ${p.paymentCode}</title>
    <style>body{font-family:system-ui,Arial,sans-serif;color:#0f172a;padding:32px} h1{font-size:20px} table{border-collapse:collapse;width:100%;margin-top:16px;border:1px solid #e2e8f0} td{border-bottom:1px solid #f1f5f9}</style>
    </head><body>
    <h1>Payment Receipt</h1>
    <div style="color:#64748b">${p.paymentCode} · ${formatDate(p.paymentDate, true)}</div>
    <table>
      ${row('Receipt No', p.receipt?.receiptNumber || '—')}
      ${row('Customer', p.customerName)}
      ${row('Project / Unit', `${p.projectName || '—'} · ${p.unitNumber || '—'}`)}
      ${row('Booking', p.booking?._id || p.booking)}
      ${row('Amount Received', formatMoney(p.amount))}
      ${row('Payment Method', titleCase(p.method))}
      ${row('Status', titleCase(p.status))}
      ${row('Reference', p.transactionId || p.referenceNumber || p.chequeNumber || p.upiId || '—')}
      ${row('Received By', p.receivedByName || p.enteredByName)}
      ${row('Entered By', p.enteredByName)}
    </table>
    <p style="margin-top:24px;color:#94a3b8;font-size:12px">This is a system-generated receipt.</p>
    <script>window.onload=function(){window.print()}</script>
    </body></html>`)
  w.document.close()
}

export default function PaymentDetailModal({ paymentId, onClose, onChanged }) {
  const { can } = useAuth()
  const toast = useToast()
  const { data: p, loading, error, refetch } = useFetch(useCallback(() => paymentsApi.get(paymentId), [paymentId]))

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [panel, setPanel] = useState(null) // 'cancel' | 'refund'
  const [pf, setPf] = useState({})
  const [busy, setBusy] = useState(false)

  if (loading) return <Modal open onClose={onClose} wide title="Payment"><Loader /></Modal>
  if (error) return <Modal open onClose={onClose} wide title="Payment"><ErrorState message={error} onRetry={refetch} /></Modal>

  const canEdit = can('payment', 'edit') && !['cancelled', 'refunded'].includes(p.status)
  const canVerify = can('payment', 'verify')
  const canDelete = can('payment', 'delete')
  const after = () => { setPanel(null); setPf({}); setEditing(false); refetch(); onChanged?.() }

  async function run(fn, msg) {
    setBusy(true)
    try { await fn(); toast.success(msg); after() }
    catch (err) { toast.error(err.response?.data?.message || 'Action failed') }
    finally { setBusy(false) }
  }

  const startEdit = () => { setForm({ amount: p.amount, paymentDate: p.paymentDate?.slice(0, 10) || '', method: p.method, referenceNumber: p.referenceNumber || '', bankName: p.bankName || '', transactionId: p.transactionId || '', chequeNumber: p.chequeNumber || '', chequeDate: p.chequeDate?.slice(0, 10) || '', upiId: p.upiId || '', remarks: p.remarks || '' }); setEditing(true) }
  const saveEdit = () => run(() => paymentsApi.update(p._id, { ...form, amount: Number(form.amount) }), 'Payment updated')
  // These fire only after the user confirms in their respective panels.
  const doVerify = () => run(() => paymentsApi.setStatus(p._id, { status: 'verified' }), 'Payment verified')
  const cancel = () => run(() => paymentsApi.setStatus(p._id, { status: 'cancelled', note: pf.reason || '' }), 'Payment cancelled')
  const refund = () => run(() => paymentsApi.setStatus(p._id, { status: 'refunded', refundAmount: Number(pf.refundAmount || p.amount), note: pf.reason || '' }), 'Refund recorded')
  const doDelete = () => run(() => paymentsApi.remove(p._id).then(onClose), 'Payment deleted')
  const download = async () => { try { const res = await paymentsApi.downloadReceipt(p._id); window.open(res.data.data.fileUrl, '_blank') } catch (err) { toast.error(err.response?.data?.message || 'No receipt') } }
  async function upload(e) {
    const f = e.target.files?.[0]; if (!f) return
    const fd = new FormData(); fd.append('file', f); fd.append('label', f.name)
    await run(() => paymentsApi.uploadReceipt(p._id, fd), 'Receipt saved'); e.target.value = ''
  }

  // Context-aware overflow actions. Verify + Edit stay on the primary bar; the rest
  // live here. Danger items (Cancel, Delete) sit below a divider.
  const hasReceipt = Boolean(p.receipt?.fileUrl)
  const moreItems = []
  if (canEdit) moreItems.push({ key: 'upload', label: hasReceipt ? 'Replace Receipt' : 'Upload Receipt', icon: ICON.upload, tone: hasReceipt ? 'default' : 'primary', file: true, accept: '.pdf,.jpg,.jpeg,.png', onChange: upload })
  if (hasReceipt) moreItems.push({ key: 'download', label: 'Download Receipt', icon: ICON.download, onClick: download })
  moreItems.push({ key: 'print', label: 'Print Receipt', icon: ICON.printer, onClick: () => printReceipt(p) })
  if (canEdit) moreItems.push({ key: 'refund', label: 'Refund', icon: ICON.refund, tone: 'warning', onClick: () => setPanel('refund') })
  if (canEdit) moreItems.push({ key: 'cancel', label: 'Cancel Payment', icon: ICON.ban, tone: 'danger', danger: true, onClick: () => setPanel('cancel') })
  if (canDelete) moreItems.push({ key: 'delete', label: 'Delete', icon: ICON.trash, tone: 'danger', danger: true, onClick: () => setPanel('delete') })
  const showVerify = canVerify && p.status === 'received'

  const customerName = p.customer?.name || p.customerName
  const title = (
    <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <span className="text-xl font-bold tracking-tight text-slate-900">{formatMoney(p.amount)}</span>
      {customerName && <span className="text-sm font-medium text-slate-500">· {customerName}</span>}
      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{p.paymentCode}</span>
    </span>
  )

  return (
    <Modal open onClose={onClose} wide title={title} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <div className="thin-scroll space-y-6">
        {/* Status chips (left) + primary action bar (right) — one row, scrolls with content */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={STATUS_TONE[p.status] || 'slate'} icon={STATUS_ICON[p.status]}>{titleCase(p.status)}</Chip>
            <Chip tone="slate" icon={ICON.card}>{titleCase(p.method)}</Chip>
            {p.receipt?.fileUrl && <Chip tone="emerald" icon={ICON.paperclip}>Receipt attached</Chip>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {showVerify && <Button variant="success" className="h-11" onClick={() => setPanel('verify')} disabled={busy}>{ICON.check}<span>Verify</span></Button>}
            {canEdit && !editing && <Button variant="secondary" className="h-11" onClick={startEdit}>{ICON.edit}<span>Edit</span></Button>}
            {/* A lone overflow action is shown directly instead of hidden under "More". */}
            {moreItems.length === 1 && (
              moreItems[0].file ? (
                <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 transition duration-150 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-blue-500">{moreItems[0].icon}<span>{moreItems[0].label}</span><input type="file" accept={moreItems[0].accept} className="hidden" onChange={moreItems[0].onChange} /></label>
              ) : (
                <Button variant={moreItems[0].tone === 'danger' ? 'danger' : moreItems[0].tone === 'primary' ? 'primary' : 'secondary'} className="h-11" onClick={moreItems[0].onClick}>{moreItems[0].icon}<span>{moreItems[0].label}</span></Button>
              )
            )}
            {moreItems.length > 1 && <MoreMenu items={moreItems} />}
          </div>
        </div>

        {/* Edit panel */}
        {editing && form && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-900">Edit Payment</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input label="Amount (₹)" type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
              <Input label="Payment Date" type="date" value={form.paymentDate} onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))} />
              <Select label="Method" value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}</Select>
              <Input label="Transaction ID" value={form.transactionId} onChange={(e) => setForm((f) => ({ ...f, transactionId: e.target.value }))} />
              <Input label="Bank Name" value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} />
              <Input label="Reference Number" value={form.referenceNumber} onChange={(e) => setForm((f) => ({ ...f, referenceNumber: e.target.value }))} />
              <Input label="Cheque Number" value={form.chequeNumber} onChange={(e) => setForm((f) => ({ ...f, chequeNumber: e.target.value }))} />
              <Input label="Cheque Date" type="date" value={form.chequeDate} onChange={(e) => setForm((f) => ({ ...f, chequeDate: e.target.value }))} />
              <Input label="UPI ID" value={form.upiId} onChange={(e) => setForm((f) => ({ ...f, upiId: e.target.value }))} />
              <div className="sm:col-span-3"><Textarea label="Remarks" value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} /></div>
            </div>
            <div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button><Button size="sm" onClick={saveEdit} disabled={busy}>Save Changes</Button></div>
          </div>
        )}
        {panel === 'verify' && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="mb-1 text-sm font-semibold text-slate-900">Verify this payment?</div>
            <p className="text-sm text-slate-600">Marking <strong>{p.paymentCode}</strong> ({formatMoney(p.amount)}) as <strong>Verified</strong> confirms the amount was received and includes it in collection totals. This is recorded in the audit log.</p>
            <div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => setPanel(null)}>Back</Button><Button size="sm" variant="success" onClick={doVerify} disabled={busy}>Verify Payment</Button></div>
          </div>
        )}
        {panel === 'cancel' && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <div className="mb-1 text-sm font-semibold text-slate-900">Cancel this payment?</div>
            <p className="mb-3 text-sm text-slate-600">Cancelling <strong>{p.paymentCode}</strong> removes it from collection totals and updates the booking’s payment summary. Add a reason for the record.</p>
            <Input label="Reason" value={pf.reason || ''} onChange={(e) => setPf({ ...pf, reason: e.target.value })} />
            <div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => setPanel(null)}>Back</Button><Button size="sm" variant="danger" onClick={cancel} disabled={busy}>Cancel Payment</Button></div>
          </div>
        )}
        {panel === 'refund' && (
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
            <div className="mb-1 text-sm font-semibold text-slate-900">Record a refund?</div>
            <p className="mb-3 text-sm text-slate-600">Marking <strong>{p.paymentCode}</strong> as <strong>Refunded</strong> removes it from collection totals. Confirm the refund amount below.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Refund Amount (₹)" type="number" value={pf.refundAmount ?? p.amount} onChange={(e) => setPf({ ...pf, refundAmount: e.target.value })} />
              <Input label="Reason" value={pf.reason || ''} onChange={(e) => setPf({ ...pf, reason: e.target.value })} />
            </div>
            <div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => setPanel(null)}>Back</Button><Button size="sm" onClick={refund} disabled={busy}>Record Refund</Button></div>
          </div>
        )}
        {panel === 'delete' && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <div className="mb-1 text-sm font-semibold text-slate-900">Delete this payment?</div>
            <p className="text-sm text-slate-600">This soft-deletes <strong>{p.paymentCode}</strong> ({formatMoney(p.amount)}) and removes it from lists, collection totals and reports. This can’t be undone from here.</p>
            <div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => setPanel(null)}>Back</Button><Button size="sm" variant="danger" onClick={doDelete} disabled={busy}>Delete Payment</Button></div>
          </div>
        )}

        {/* Information sections */}
        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="Payment Information">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Amount">{formatMoney(p.amount)}</Field>
              <Field label="Date">{formatDate(p.paymentDate, true)}</Field>
              <Field label="Method">{titleCase(p.method)}</Field>
              <Field label="Status">{titleCase(p.status)}</Field>
              <Field label="Transaction ID">{p.transactionId}</Field>
              <Field label="Reference No">{p.referenceNumber}</Field>
              <Field label="Bank">{p.bankName}</Field>
              <Field label="Cheque">{p.chequeNumber ? `${p.chequeNumber}${p.chequeDate ? ` · ${formatDate(p.chequeDate)}` : ''}` : ''}</Field>
              <Field label="UPI ID">{p.upiId}</Field>
              <Field label="Received By">{p.receivedBy?.name || p.receivedByName}</Field>
              <Field label="Entered By">{p.enteredBy?.name || p.enteredByName}</Field>
              {p.verifiedByName && <Field label="Verified By">{`${p.verifiedByName} · ${formatDate(p.verifiedAt)}`}</Field>}
              {p.refundAmount > 0 && <Field label="Refund">{formatMoney(p.refundAmount)}</Field>}
            </dl>
            {p.remarks && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Remarks</dt>
                <dd className="mt-1 text-sm text-slate-700">{p.remarks}</dd>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Customer & Booking">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Customer">{p.customer?.name || p.customerName}</Field>
              <Field label="Mobile">{p.customer?.mobile}</Field>
              <Field label="Project">{p.project?.name || p.projectName}</Field>
              <Field label="Unit">{p.unit?.unitNumber || p.unitNumber}</Field>
              <Field label="Branch">{p.branch}</Field>
              <Field label="Booking Amount">{formatMoney(p.booking?.bookingAmount)}</Field>
              <Field label="Booking Status">{titleCase(p.booking?.status || '')}</Field>
              <Field label="Booking Payment">{titleCase(p.booking?.paymentStatus || '')}</Field>
            </dl>
          </SectionCard>
        </div>

        {/* Receipt */}
        <SectionCard title="Receipt">
          <ReceiptPreview receipt={p.receipt} />
        </SectionCard>

        {/* Timeline */}
        <SectionCard title="Payment Timeline">
          {(!p.activity || p.activity.length === 0) ? (
            <p className="text-sm text-slate-400">No activity yet</p>
          ) : (
            <ol className="relative ml-1 space-y-5 border-l border-slate-200 pl-6">
              {p.activity.slice().reverse().map((a) => (
                <li key={a._id} className="relative">
                  <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-2 ring-slate-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  </span>
                  <div className="text-sm font-medium text-slate-800">{titleCase(a.type)}</div>
                  {a.note && <div className="mt-0.5 text-xs text-slate-500">{a.note}</div>}
                  <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">{a.actorName} · {formatDate(a.at, true)}</div>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </div>
    </Modal>
  )
}
