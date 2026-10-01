import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader, Card, Button, Input, Select, StatusBadge, Table, Modal, Textarea, Loader, ErrorState } from '../../components/ui.jsx'
import { POSSESSION_STATUSES, POSSESSION_DOCUMENTS } from '../../lib/possessionConstants.js'
import { possessionsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate } from '../../lib/format.js'

export default function PossessionDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { data: caseData, loading, error, refetch } = useFetch(useCallback(() => possessionsApi.get(id), [id]))
  const [activeTab, setActiveTab] = useState('info')
  const [statusModal, setStatusModal] = useState(false)
  const [scheduleModal, setScheduleModal] = useState(false)
  const [uploadModal, setUploadModal] = useState(false)
  const [busyItem, setBusyItem] = useState(null)

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (!caseData) return <div className="p-8 text-center text-slate-500">Possession Case Not Found</div>

  const tabs = [
    { id: 'info', label: 'Information' },
    { id: 'readiness', label: 'Readiness Checklist' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'documents', label: 'Documents' },
    { id: 'timeline', label: 'Timeline' },
  ]

  const toggleItem = async (item) => {
    setBusyItem(item._id)
    try {
      await possessionsApi.setChecklistItem(caseData._id, item._id, { status: item.status === 'Completed' ? 'Pending' : 'Completed' })
      refetch()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed') } finally { setBusyItem(null) }
  }

  const checklist = caseData.checklist || []
  const doneCount = checklist.filter((c) => c.status === 'Completed').length

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="-ml-3 mb-2">← Back</Button>
        <PageHeader
          title={`Possession Case: ${caseData.caseCode}`}
          subtitle={`Customer: ${caseData.customerName || '—'} | Unit: ${caseData.unitNumber || '—'}`}
          actions={<Button variant="secondary" onClick={() => setStatusModal(true)}>Update Status</Button>}
        />
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
          <span>Status: <StatusBadge status={caseData.status} /></span>
          <span>Customer Confirmation: <span className={`font-medium ${caseData.customerConfirmation === 'Confirmed' ? 'text-emerald-600' : 'text-orange-500'}`}>{caseData.customerConfirmation}</span></span>
          <span>Last Updated: {formatDate(caseData.updatedAt)}</span>
        </div>
      </div>

      <div className="mb-6 border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`${activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'} whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition`}>
              {tab.label}{tab.id === 'readiness' && checklist.length > 0 ? ` (${doneCount}/${checklist.length})` : ''}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'info' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-4 text-base font-semibold text-slate-900">Property Details</h3>
            <div className="grid grid-cols-2 gap-y-4 text-sm">
              <Field label="Project" value={caseData.project} />
              <Field label="Unit" value={caseData.unitNumber} />
              <Field label="Branch" value={caseData.branch} />
              <Field label="Booking" value={caseData.bookingLabel} />
              <Field label="Registration" value={caseData.registrationLabel} />
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="mb-4 text-base font-semibold text-slate-900">Handover Details</h3>
            <div className="grid grid-cols-2 gap-y-4 text-sm">
              <Field label="Assigned" value={caseData.assignedEmployee?.name || caseData.assignedEmployeeName} />
              <Field label="Expected Date" value={formatDate(caseData.expectedPossessionDate)} />
              <Field label="Actual Date" value={caseData.actualPossessionDate ? formatDate(caseData.actualPossessionDate) : '—'} />
              <Field label="Confirmation" value={caseData.customerConfirmation} />
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'readiness' && (
        <Card className="p-5">
          <h3 className="mb-4 text-base font-semibold text-slate-900">Readiness Checklist <span className="text-sm font-normal text-slate-400">({doneCount}/{checklist.length} complete)</span></h3>
          <div className="overflow-hidden rounded-lg border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr>
                <th className="px-4 py-2 font-medium">Item</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Completed By</th><th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 text-right font-medium">Action</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {checklist.map((item) => (
                  <tr key={item._id}>
                    <td className="px-4 py-2 font-medium text-slate-800">{item.item}</td>
                    <td className="px-4 py-2"><span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${item.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'}`}>{item.status}</span></td>
                    <td className="px-4 py-2 text-slate-600">{item.user || '—'}</td>
                    <td className="px-4 py-2 text-slate-500">{item.date ? formatDate(item.date) : '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <Button size="sm" variant={item.status === 'Completed' ? 'ghost' : 'secondary'} disabled={busyItem === item._id} onClick={() => toggleItem(item)}>
                        {item.status === 'Completed' ? 'Undo' : 'Mark Done'}
                      </Button>
                    </td>
                  </tr>
                ))}
                {checklist.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">No checklist items.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'schedule' && (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Handover Appointment</h3>
            <Button variant="secondary" size="sm" onClick={() => setScheduleModal(true)}>{caseData.scheduledDate ? 'Reschedule' : 'Schedule Handover'}</Button>
          </div>
          {caseData.scheduledDate ? (
            <div className="grid grid-cols-2 gap-y-4 text-sm sm:grid-cols-3">
              <Field label="Date" value={formatDate(caseData.scheduledDate)} />
              <Field label="Time" value={caseData.scheduledTime} />
              <Field label="Location" value={caseData.location} />
            </div>
          ) : <p className="py-6 text-center text-sm text-slate-400">No handover scheduled yet.</p>}
        </Card>
      )}

      {activeTab === 'documents' && (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Handover Documents</h3>
            <Button variant="primary" size="sm" onClick={() => setUploadModal(true)}>+ Add Document</Button>
          </div>
          <Table
            columns={[
              { key: 'name', header: 'Document' },
              { key: 'type', header: 'Type' },
              { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              { key: 'uploadedBy', header: 'Uploaded By', render: (r) => r.uploadedBy || '—' },
            ]}
            rows={caseData.documents || []}
            empty="No handover documents added yet."
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
      {scheduleModal && <ScheduleModal caseData={caseData} onClose={() => setScheduleModal(false)} onDone={() => { setScheduleModal(false); refetch() }} />}
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
    try { await possessionsApi.setStatus(caseData._id, { status, remarks }); toast.success('Status updated'); onDone() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="Update Possession Status" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Update</Button></>}>
      <div className="space-y-4 py-2">
        <Select label="New Status" value={status} onChange={(e) => setStatus(e.target.value)}>{POSSESSION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
        <Textarea label="Remarks / Notes" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </div>
    </Modal>
  )
}

function ScheduleModal({ caseData, onClose, onDone }) {
  const toast = useToast()
  const [form, setForm] = useState({
    scheduledDate: caseData.scheduledDate ? String(caseData.scheduledDate).slice(0, 10) : '',
    scheduledTime: caseData.scheduledTime || '', location: caseData.location || '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const save = async () => {
    if (!form.scheduledDate) { toast.error('Date is required'); return }
    setBusy(true)
    try { await possessionsApi.update(caseData._id, { ...form, status: 'Scheduled', remarks: 'Handover scheduled' }); toast.success('Handover scheduled'); onDone() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="Schedule Handover" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      <div className="space-y-4 py-2">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Date" type="date" value={form.scheduledDate} onChange={set('scheduledDate')} />
          <Input label="Time" type="time" value={form.scheduledTime} onChange={set('scheduledTime')} />
        </div>
        <Input label="Location" value={form.location} onChange={set('location')} placeholder="e.g. Site office, Tower D" />
      </div>
    </Modal>
  )
}

function UploadModal({ caseId, onClose, onDone }) {
  const toast = useToast()
  const [form, setForm] = useState({ type: POSSESSION_DOCUMENTS[0], name: '', status: 'Received' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const save = async () => {
    if (!form.name.trim()) { toast.error('Document name is required'); return }
    setBusy(true)
    try { await possessionsApi.addDocument(caseId, { name: form.name, type: form.type, status: form.status }); toast.success('Document added'); onDone() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="Add Handover Document" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Add</Button></>}>
      <div className="space-y-4 py-2">
        <Select label="Document Type" value={form.type} onChange={set('type')}>{POSSESSION_DOCUMENTS.map((t) => <option key={t} value={t}>{t}</option>)}</Select>
        <Input label="Document Name" placeholder="e.g. Handover_Form.pdf" value={form.name} onChange={set('name')} />
        <Select label="Status" value={form.status} onChange={set('status')}>{['Pending', 'Received', 'Verified', 'Rejected'].map((s) => <option key={s} value={s}>{s}</option>)}</Select>
      </div>
    </Modal>
  )
}
