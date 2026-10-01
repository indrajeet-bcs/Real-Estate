import { useState, useCallback } from 'react'
import { legalApi, usersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, formatMoney, titleCase } from '../../lib/format.js'
import { Modal, Button, Input, Textarea, Select, StatusBadge, Loader, ErrorState } from '../../components/ui.jsx'
import { AGREEMENT_TYPES, AGREEMENT_STATUSES, DOC_ACCEPT, NEXT_STATUS } from '../../lib/legal.js'

function Field({ label, children }) {
  return <div><dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-0.5 text-sm text-slate-800">{children || '—'}</dd></div>
}

function printSummary(c) {
  const w = window.open('', '_blank', 'width=760,height=960'); if (!w) return
  const row = (k, v) => `<tr><td style="padding:6px 12px;color:#64748b">${k}</td><td style="padding:6px 12px;font-weight:600">${v ?? '—'}</td></tr>`
  const docs = (c.documents || []).map((d) => `<tr><td style="padding:5px 10px">${d.type}${d.mandatory ? ' *' : ''}</td><td style="padding:5px 10px">${titleCase(d.status)}</td></tr>`).join('')
  w.document.write(`<!doctype html><html><head><title>${c.caseCode}</title>
    <style>body{font-family:system-ui,Arial,sans-serif;color:#0f172a;padding:32px}h1{font-size:20px}table{border-collapse:collapse;width:100%;margin-top:12px;border:1px solid #e2e8f0}td{border-bottom:1px solid #f1f5f9}h3{margin-top:20px;font-size:14px}</style></head><body>
    <h1>Legal Case Summary</h1><div style="color:#64748b">${c.caseCode} · ${titleCase(c.status)}</div>
    <h3>Case</h3><table>${row('Customer', c.customerName)}${row('Project / Unit', `${c.projectName || '—'} · ${c.unitNumber || '—'}`)}${row('Branch', c.branch)}${row('Legal Executive', c.legalExecutiveName || '—')}${row('Agreement', `${titleCase(c.agreementType)} · ${titleCase(c.agreementStatus)}`)}${row('Expected Completion', c.expectedCompletionDate ? formatDate(c.expectedCompletionDate) : '—')}</table>
    <h3>Document Checklist</h3><table><tr><td style="padding:5px 10px;color:#64748b">Document</td><td style="padding:5px 10px;color:#64748b">Status</td></tr>${docs}</table>
    <p style="margin-top:24px;color:#94a3b8;font-size:12px">System-generated legal summary.</p>
    <script>window.onload=function(){window.print()}</script></body></html>`)
  w.document.close()
}

const DOC_ACTIONS = [
  { s: 'received', label: 'Received', variant: 'secondary' },
  { s: 'verified', label: 'Verify', variant: 'success' },
  { s: 'rejected', label: 'Reject', variant: 'danger' },
  { s: 'missing', label: 'Missing', variant: 'secondary' },
]

export default function LegalDetailModal({ caseId, onClose, onChanged }) {
  const { can, user } = useAuth()
  const toast = useToast()
  const { data: c, loading, error, refetch } = useFetch(useCallback(() => legalApi.get(caseId), [caseId]))
  const { data: employees } = useFetch(useCallback(() => (can('legal', 'assign') ? usersApi.list({ status: 'active', limit: 300 }) : Promise.resolve({ data: { data: [] } })), []))
  const [panel, setPanel] = useState(null) // 'edit' | 'status' | 'assign' | 'cancel'
  const [pf, setPf] = useState({})
  const [busy, setBusy] = useState(false)

  if (loading) return <Modal open onClose={onClose} wide title="Legal Case"><Loader /></Modal>
  if (error) return <Modal open onClose={onClose} wide title="Legal Case"><ErrorState message={error} onRetry={refetch} /></Modal>

  const canEdit = can('legal', 'edit')
  const canAssign = can('legal', 'assign')
  const canVerify = can('legal', 'verify')
  const canDelete = can('legal', 'delete')
  const nextStatuses = NEXT_STATUS[c.status] || []
  const after = () => { setPanel(null); setPf({}); refetch(); onChanged?.() }
  async function run(fn, msg) { setBusy(true); try { await fn(); toast.success(msg); after() } catch (err) { toast.error(err.response?.data?.message || 'Action failed') } finally { setBusy(false) } }

  const saveEdit = () => run(() => legalApi.update(c._id, pf), 'Case updated')
  const changeStatus = () => run(() => legalApi.setStatus(c._id, { status: pf.status, note: pf.note || '' }), 'Status updated')
  const assign = () => run(() => legalApi.assign(c._id, { legalExecutive: pf.legalExecutive, note: pf.note || '' }), 'Legal executive assigned')
  const cancel = () => run(() => legalApi.setStatus(c._id, { status: 'cancelled', note: pf.reason || '' }), 'Case cancelled')
  const del = () => { if (window.confirm('Delete this legal case? It will be soft-deleted.')) run(() => legalApi.remove(c._id).then(onClose), 'Case deleted') }
  const setDoc = (docId, status) => run(() => legalApi.updateDocument(c._id, docId, { status }), 'Document updated')
  async function uploadDoc(docId, e) { const f = e.target.files?.[0]; if (!f) return; const fd = new FormData(); fd.append('file', f); fd.append('label', f.name); await run(() => legalApi.uploadDocument(c._id, docId, fd), 'Document uploaded'); e.target.value = '' }
  async function downloadDoc(docId) { try { const res = await legalApi.downloadDocument(c._id, docId); window.open(res.data.data.fileUrl, '_blank') } catch (err) { toast.error(err.response?.data?.message || 'No file') } }

  const verifiedDocs = (c.documents || []).filter((d) => d.status === 'verified').length

  return (
    <Modal open onClose={onClose} wide title={`${c.caseCode} · ${c.customerName}`} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={c.status} />
          {c.overdue && <span className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700">Overdue</span>}
          <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">{titleCase(c.agreementType)}</span>
          <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">Agreement: {titleCase(c.agreementStatus)}</span>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap gap-2 border-y border-slate-100 py-3">
          {canEdit && <Button size="sm" variant="secondary" onClick={() => { setPanel('edit'); setPf({ agreementType: c.agreementType, agreementStatus: c.agreementStatus, agreementNumber: c.agreementNumber || '', agreementDate: c.agreementDate?.slice(0, 10) || '', expectedCompletionDate: c.expectedCompletionDate?.slice(0, 10) || '', remarks: c.remarks || '' }) }}>Edit</Button>}
          {canAssign && <Button size="sm" variant="secondary" onClick={() => { setPanel('assign'); setPf({ legalExecutive: c.legalExecutive?._id || '' }) }}>Assign</Button>}
          {canEdit && nextStatuses.length > 0 && <Button size="sm" onClick={() => { setPanel('status'); setPf({ status: nextStatuses[0] }) }}>Update Status</Button>}
          <Button size="sm" variant="secondary" onClick={() => printSummary(c)}>Print Summary</Button>
          {canDelete && <Button size="sm" variant="danger" onClick={del}>Delete</Button>}
        </div>

        {panel === 'edit' && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-900">Edit Case</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Select label="Agreement Type" value={pf.agreementType} onChange={(e) => setPf((p) => ({ ...p, agreementType: e.target.value }))}>{AGREEMENT_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</Select>
              <Select label="Agreement Status" value={pf.agreementStatus} onChange={(e) => setPf((p) => ({ ...p, agreementStatus: e.target.value }))}>{AGREEMENT_STATUSES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</Select>
              <Input label="Agreement Number" value={pf.agreementNumber} onChange={(e) => setPf((p) => ({ ...p, agreementNumber: e.target.value }))} />
              <Input label="Agreement Date" type="date" value={pf.agreementDate} onChange={(e) => setPf((p) => ({ ...p, agreementDate: e.target.value }))} />
              <Input label="Expected Completion" type="date" value={pf.expectedCompletionDate} onChange={(e) => setPf((p) => ({ ...p, expectedCompletionDate: e.target.value }))} />
              <div className="sm:col-span-3"><Textarea label="Remarks" value={pf.remarks} onChange={(e) => setPf((p) => ({ ...p, remarks: e.target.value }))} /></div>
            </div>
            <div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => setPanel(null)}>Cancel</Button><Button size="sm" onClick={saveEdit} disabled={busy}>Save</Button></div>
          </div>
        )}
        {panel === 'assign' && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-900">Assign Legal Executive</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="Legal Executive" value={pf.legalExecutive || ''} onChange={(e) => setPf((p) => ({ ...p, legalExecutive: e.target.value }))}><option value="">Select…</option>{(employees || []).map((emp) => <option key={emp._id} value={emp._id}>{emp.name} · {titleCase(emp.role)}</option>)}</Select>
              <Input label="Note" value={pf.note || ''} onChange={(e) => setPf((p) => ({ ...p, note: e.target.value }))} />
            </div>
            <div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => setPanel(null)}>Cancel</Button><Button size="sm" onClick={assign} disabled={busy || !pf.legalExecutive}>Assign</Button></div>
          </div>
        )}
        {panel === 'status' && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-900">Update Legal Status</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="New Status" value={pf.status} onChange={(e) => setPf((p) => ({ ...p, status: e.target.value }))}>{nextStatuses.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select>
              <Input label="Note" value={pf.note || ''} onChange={(e) => setPf((p) => ({ ...p, note: e.target.value }))} />
            </div>
            <p className="mt-2 text-xs text-slate-500">Marking "Ready for Registration" or "Completed" requires all mandatory documents to be verified.</p>
            <div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => setPanel(null)}>Cancel</Button><Button size="sm" onClick={changeStatus} disabled={busy}>Update</Button></div>
          </div>
        )}

        {/* Information */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <h4 className="mb-3 text-sm font-semibold text-slate-900">Legal & Customer Information</h4>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Customer">{c.customer?.name || c.customerName}</Field>
              <Field label="Mobile">{c.customer?.mobile}</Field>
              <Field label="Project">{c.projectName || c.project?.name}</Field>
              <Field label="Unit">{c.unitNumber || c.unit?.unitNumber}</Field>
              <Field label="Branch">{c.branch}</Field>
              <Field label="Legal Executive">{c.legalExecutive?.name || c.legalExecutiveName}</Field>
              <Field label="Expected Completion">{c.expectedCompletionDate ? formatDate(c.expectedCompletionDate) : '—'}</Field>
              <Field label="Created By">{c.createdBy?.name || c.createdByName}</Field>
            </dl>
            {c.remarks && <p className="mt-3 text-sm text-slate-600"><span className="text-xs uppercase text-slate-500">Remarks</span><br />{c.remarks}</p>}
            {c.cancelReason && <div className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700"><strong>Cancelled:</strong> {c.cancelReason}</div>}
          </section>
          <section>
            <h4 className="mb-3 text-sm font-semibold text-slate-900">Booking & Agreement</h4>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Booking Amount">{formatMoney(c.booking?.bookingAmount)}</Field>
              <Field label="Booking Status">{titleCase(c.booking?.status || '')}</Field>
              <Field label="Payment">{titleCase(c.booking?.paymentStatus || '')}</Field>
              <Field label="Registration">{titleCase(c.booking?.registrationStatus || '')}</Field>
              <Field label="Agreement Type">{titleCase(c.agreementType)}</Field>
              <Field label="Agreement Status">{titleCase(c.agreementStatus)}</Field>
              <Field label="Agreement No">{c.agreementNumber}</Field>
              <Field label="Agreement Date">{c.agreementDate ? formatDate(c.agreementDate) : '—'}</Field>
            </dl>
          </section>
        </div>

        {/* Document checklist */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900">Document Checklist</h4>
            <span className="text-xs text-slate-500">{verifiedDocs}/{c.documents?.length || 0} verified</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2 font-medium">Document</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">File</th><th className="px-3 py-2" /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {(c.documents || []).map((d) => (
                  <tr key={d._id}>
                    <td className="px-3 py-2 text-slate-800">{d.type}{d.mandatory && <span className="ml-1 text-red-500" title="Mandatory">*</span>}</td>
                    <td className="px-3 py-2"><StatusBadge status={d.status} /></td>
                    <td className="px-3 py-2">{d.fileUrl ? <button onClick={() => downloadDoc(d._id)} className="text-xs text-blue-600 hover:underline">{d.fileName || 'Download'}</button> : <span className="text-xs text-slate-400">—</span>}</td>
                    <td className="px-3 py-2">
                      {canEdit && (
                        <div className="flex flex-wrap justify-end gap-1">
                          <label className="inline-flex cursor-pointer items-center rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50" title="Upload / replace"><span>{d.fileUrl ? 'Replace' : 'Upload'}</span><input type="file" accept={DOC_ACCEPT} className="hidden" onChange={(e) => uploadDoc(d._id, e)} /></label>
                          {DOC_ACTIONS.filter((a) => !(['verified', 'rejected'].includes(a.s) && !canVerify)).map((a) => (
                            <Button key={a.s} size="sm" variant={a.variant} onClick={() => setDoc(d._id, a.s)} disabled={busy || d.status === a.s}>{a.label}</Button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Timeline */}
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-900">Timeline & Audit</h4>
          <div className="relative space-y-3 border-l border-slate-200 pl-5">
            {(c.activity || []).slice().reverse().map((a) => (
              <div key={a._id} className="relative"><span className="absolute -left-[23px] top-1 h-2.5 w-2.5 rounded-full bg-blue-500" /><div className="text-sm text-slate-800">{titleCase(a.type)}{a.note ? <span className="text-slate-500"> — {a.note}</span> : null}</div><div className="text-xs text-slate-400">{a.actorName} · {formatDate(a.at, true)}</div></div>
            ))}
            {(!c.activity || c.activity.length === 0) && <p className="text-sm text-slate-400">No activity yet</p>}
          </div>
        </div>
      </div>
    </Modal>
  )
}
