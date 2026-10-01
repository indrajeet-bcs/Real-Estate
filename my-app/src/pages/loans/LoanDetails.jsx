import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader, Card, Button, Input, Select, StatusBadge, Table, Modal, Textarea, Loader, ErrorState } from '../../components/ui.jsx'
import { LOAN_STATUSES, DOCUMENT_TYPES, FINANCIAL_INSTITUTIONS, LOAN_TYPES } from '../../lib/loanConstants.js'
import { loansApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate } from '../../lib/format.js'

const inrL = (n) => `₹${((Number(n) || 0) / 100000).toFixed(2)}L`

export default function LoanDetails() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: caseData, loading, error, refetch } = useFetch(useCallback(() => loansApi.get(id), [id]))

  const [activeTab, setActiveTab] = useState('info')
  const [statusModal, setStatusModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [uploadModal, setUploadModal] = useState(false)

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (!caseData) return <div className="p-8 text-center text-slate-500">Loan Case Not Found</div>

  const tabs = [
    { id: 'info', label: 'Information' },
    { id: 'documents', label: 'Documents' },
    { id: 'timeline', label: 'Timeline & Audit' },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="-ml-3 mb-2">← Back to Loans</Button>
        <PageHeader
          title={`Loan Case: ${caseData.caseCode}`}
          subtitle={`Customer: ${caseData.customerName || '—'} | Booking: ${caseData.bookingLabel || '—'}`}
          actions={
            <>
              <Button variant="secondary" onClick={() => setStatusModal(true)}>Update Status</Button>
              <Button variant="primary" onClick={() => setEditModal(true)}>Edit Case</Button>
            </>
          }
        />
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
          <span>Status: <StatusBadge status={caseData.status} /></span>
          <span>Assigned: <span className="font-medium text-slate-900">{caseData.assignedExecutive?.name || caseData.assignedExecutiveName || '—'}</span></span>
          <span>Last Updated: {formatDate(caseData.updatedAt)}</span>
        </div>
      </div>

      <div className="mb-6 border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`${activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'} whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition`}>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'info' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-4 text-base font-semibold text-slate-900">Booking Details</h3>
            <div className="grid grid-cols-2 gap-y-4 text-sm">
              <Field label="Project" value={caseData.project} />
              <Field label="Unit" value={caseData.unitNumber} />
              <Field label="Branch" value={caseData.branch} />
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="mb-4 text-base font-semibold text-slate-900">Loan Details</h3>
            <div className="grid grid-cols-2 gap-y-4 text-sm">
              <Field label="Bank" value={caseData.bank} />
              <Field label="Type" value={caseData.loanType} />
              <Field label="Amount Required" value={inrL(caseData.loanAmount)} />
              <Field label="App. Number" value={caseData.applicationNumber} />
            </div>
          </Card>
          {(caseData.sanctionedAmount || caseData.status === 'Sanctioned') && (
            <Card className="p-5">
              <h3 className="mb-4 text-base font-semibold text-slate-900">Sanction Details</h3>
              <div className="grid grid-cols-2 gap-y-4 text-sm"><Field label="Sanctioned Amount" value={inrL(caseData.sanctionedAmount)} /></div>
            </Card>
          )}
          {caseData.disbursedAmount > 0 && (
            <Card className="p-5">
              <h3 className="mb-4 text-base font-semibold text-slate-900">Disbursement Details</h3>
              <div className="grid grid-cols-2 gap-y-4 text-sm"><Field label="Disbursed Amount" value={inrL(caseData.disbursedAmount)} /></div>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'documents' && (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Document Checklist</h3>
            <Button variant="primary" size="sm" onClick={() => setUploadModal(true)}>+ Add Document</Button>
          </div>
          <Table
            columns={[
              { key: 'name', header: 'Document' },
              { key: 'type', header: 'Type' },
              { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              { key: 'uploadedBy', header: 'Uploaded By', render: (r) => r.uploadedBy || '—' },
              { key: 'verificationDate', header: 'Verified On', render: (r) => (r.verificationDate ? formatDate(r.verificationDate) : '—') },
            ]}
            rows={caseData.documents || []}
            empty="No documents added yet."
          />
        </Card>
      )}

      {activeTab === 'timeline' && (
        <Card className="p-5">
          <h3 className="mb-4 text-base font-semibold text-slate-900">Activity Timeline</h3>
          <div className="relative ml-3 space-y-6 border-l border-slate-200">
            {(caseData.timeline || []).slice().reverse().map((item) => (
              <div key={item._id} className="relative pl-6">
                <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-blue-500 ring-4 ring-white" />
                <div className="text-sm"><span className="font-semibold text-slate-900">{item.activity}</span><span className="ml-2 text-slate-500">{formatDate(item.date, true)}</span></div>
                <div className="mt-1 text-sm text-slate-600">By {item.user}</div>
                {item.remarks && <div className="mt-2 text-sm italic text-slate-500">"{item.remarks}"</div>}
              </div>
            ))}
            {(!caseData.timeline || caseData.timeline.length === 0) && <p className="pl-6 text-sm text-slate-400">No activity yet.</p>}
          </div>
        </Card>
      )}

      {statusModal && <StatusModal caseData={caseData} onClose={() => setStatusModal(false)} onDone={() => { setStatusModal(false); refetch() }} />}
      {editModal && <EditModal caseData={caseData} onClose={() => setEditModal(false)} onDone={() => { setEditModal(false); refetch() }} />}
      {uploadModal && <UploadModal caseId={id} onClose={() => setUploadModal(false)} onDone={() => { setUploadModal(false); refetch() }} />}
    </div>
  )
}

function Field({ label, value }) {
  return <div><span className="block text-slate-500">{label}</span><span className="font-medium">{value || '—'}</span></div>
}

function StatusModal({ caseData, onClose, onDone }) {
  const toast = useToast()
  const [status, setStatus] = useState(caseData.status)
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    try { await loansApi.setStatus(caseData._id, { status, remarks }); toast.success('Status updated'); onDone() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="Update Loan Status" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Update</Button></>}>
      <div className="space-y-4 py-2">
        <Select label="New Status" value={status} onChange={(e) => setStatus(e.target.value)}>{LOAN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
        <Textarea label="Remarks / Notes" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Reason for status change…" />
      </div>
    </Modal>
  )
}

function EditModal({ caseData, onClose, onDone }) {
  const toast = useToast()
  const [form, setForm] = useState({
    bank: caseData.bank || '', loanType: caseData.loanType || '', loanAmount: caseData.loanAmount || '',
    applicationNumber: caseData.applicationNumber || '', sanctionedAmount: caseData.sanctionedAmount ?? '', disbursedAmount: caseData.disbursedAmount || '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const save = async () => {
    setBusy(true)
    try {
      await loansApi.update(caseData._id, {
        bank: form.bank || undefined, loanType: form.loanType || undefined,
        loanAmount: Number(form.loanAmount) || 0, applicationNumber: form.applicationNumber || undefined,
        sanctionedAmount: form.sanctionedAmount === '' ? null : Number(form.sanctionedAmount),
        disbursedAmount: Number(form.disbursedAmount) || 0,
      })
      toast.success('Case updated'); onDone()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="Edit Loan Case" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save Changes</Button></>}>
      <div className="space-y-4 py-2">
        <Select label="Bank" value={form.bank} onChange={set('bank')}><option value="">Select Bank…</option>{FINANCIAL_INSTITUTIONS.map((b) => <option key={b} value={b}>{b}</option>)}</Select>
        <Select label="Loan Type" value={form.loanType} onChange={set('loanType')}><option value="">Select Type…</option>{LOAN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select>
        <Input label="Loan Amount Required" type="number" value={form.loanAmount} onChange={set('loanAmount')} />
        <Input label="Application Number" value={form.applicationNumber} onChange={set('applicationNumber')} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Sanctioned Amount" type="number" value={form.sanctionedAmount} onChange={set('sanctionedAmount')} />
          <Input label="Disbursed Amount" type="number" value={form.disbursedAmount} onChange={set('disbursedAmount')} />
        </div>
      </div>
    </Modal>
  )
}

function UploadModal({ caseId, onClose, onDone }) {
  const toast = useToast()
  const [form, setForm] = useState({ type: DOCUMENT_TYPES[0], name: '', status: 'Received' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const save = async () => {
    if (!form.name.trim()) { toast.error('Document name is required'); return }
    setBusy(true)
    try { await loansApi.addDocument(caseId, { name: form.name, type: form.type, status: form.status }); toast.success('Document added'); onDone() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="Add Document" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Add</Button></>}>
      <div className="space-y-4 py-2">
        <Select label="Document Type" value={form.type} onChange={set('type')}>{DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select>
        <Input label="Document Name" placeholder="e.g. PAN_Card.pdf" value={form.name} onChange={set('name')} />
        <Select label="Status" value={form.status} onChange={set('status')}>{['Pending', 'Received', 'Verified', 'Rejected'].map((s) => <option key={s} value={s}>{s}</option>)}</Select>
      </div>
    </Modal>
  )
}
