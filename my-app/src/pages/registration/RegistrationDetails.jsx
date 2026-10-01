import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader, Card, Button, Input, Select, StatusBadge, Table, Modal, Textarea, Loader, ErrorState } from '../../components/ui.jsx'
import { REGISTRATION_STATUSES, REGISTRATION_DOCUMENTS } from '../../lib/registrationConstants.js'
import { registrationsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate } from '../../lib/format.js'

export default function RegistrationDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: caseData, loading, error, refetch } = useFetch(useCallback(() => registrationsApi.get(id), [id]))
  const [activeTab, setActiveTab] = useState('info')
  const [statusModal, setStatusModal] = useState(false)
  const [scheduleModal, setScheduleModal] = useState(false)
  const [uploadModal, setUploadModal] = useState(false)

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (!caseData) return <div className="p-8 text-center text-slate-500">Registration Case Not Found</div>

  const tabs = [
    { id: 'info', label: 'Information' },
    { id: 'schedule', label: 'Appointment' },
    { id: 'documents', label: 'Documents' },
    { id: 'timeline', label: 'Timeline & Audit' },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="-ml-3 mb-2">← Back</Button>
        <PageHeader
          title={`Registration Case: ${caseData.caseCode}`}
          subtitle={`Customer: ${caseData.customerName || '—'} | Booking: ${caseData.bookingLabel || '—'}`}
          actions={<Button variant="secondary" onClick={() => setStatusModal(true)}>Update Status</Button>}
        />
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
          <span>Status: <StatusBadge status={caseData.status} /></span>
          <span>Assigned: <span className="font-medium text-slate-900">{caseData.assignedEmployee?.name || caseData.assignedEmployeeName || '—'}</span></span>
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
            <h3 className="mb-4 text-base font-semibold text-slate-900">Registration Details</h3>
            <div className="grid grid-cols-2 gap-y-4 text-sm">
              <Field label="Type" value={caseData.registrationType} />
              <Field label="Authority / Office" value={caseData.registrationAuthority} />
              <Field label="Expected Date" value={formatDate(caseData.expectedRegistrationDate)} />
            </div>
          </Card>
          {(caseData.registrationNumber || ['Completed', 'Registered'].includes(caseData.status)) && (
            <Card className="p-5">
              <h3 className="mb-4 text-base font-semibold text-slate-900">Registration Result</h3>
              <div className="grid grid-cols-2 gap-y-4 text-sm">
                <Field label="Registration Number" value={caseData.registrationNumber || 'Pending'} />
                <Field label="Registration Date" value={caseData.registrationDate ? formatDate(caseData.registrationDate) : 'Pending'} />
              </div>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'schedule' && (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Registration Appointment</h3>
            <Button variant="secondary" size="sm" onClick={() => setScheduleModal(true)}>{caseData.appointmentDate ? 'Reschedule' : 'Schedule Appointment'}</Button>
          </div>
          {caseData.appointmentDate ? (
            <div className="grid grid-cols-2 gap-y-4 text-sm sm:grid-cols-3">
              <Field label="Date" value={formatDate(caseData.appointmentDate)} />
              <Field label="Time" value={caseData.appointmentTime} />
              <Field label="Reference" value={caseData.appointmentReference} />
              <Field label="Authority / Office" value={caseData.registrationAuthority} />
            </div>
          ) : <p className="py-6 text-center text-sm text-slate-400">No appointment scheduled yet.</p>}
        </Card>
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
    try { await registrationsApi.setStatus(caseData._id, { status, remarks }); toast.success('Status updated'); onDone() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="Update Registration Status" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Update</Button></>}>
      <div className="space-y-4 py-2">
        <Select label="New Status" value={status} onChange={(e) => setStatus(e.target.value)}>{REGISTRATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
        <Textarea label="Remarks / Notes" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </div>
    </Modal>
  )
}

function ScheduleModal({ caseData, onClose, onDone }) {
  const toast = useToast()
  const [form, setForm] = useState({
    appointmentDate: caseData.appointmentDate ? String(caseData.appointmentDate).slice(0, 10) : '',
    appointmentTime: caseData.appointmentTime || '',
    appointmentReference: caseData.appointmentReference || '',
    registrationAuthority: caseData.registrationAuthority || '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const save = async () => {
    if (!form.appointmentDate) { toast.error('Appointment date is required'); return }
    setBusy(true)
    try {
      await registrationsApi.update(caseData._id, { ...form, status: 'Appointment Scheduled', remarks: 'Appointment scheduled' })
      toast.success('Appointment scheduled'); onDone()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="Schedule Appointment" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      <div className="space-y-4 py-2">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Date" type="date" value={form.appointmentDate} onChange={set('appointmentDate')} />
          <Input label="Time" type="time" value={form.appointmentTime} onChange={set('appointmentTime')} />
        </div>
        <Input label="Reference" value={form.appointmentReference} onChange={set('appointmentReference')} placeholder="e.g. APPT-9982" />
        <Input label="Registration Office / Authority" value={form.registrationAuthority} onChange={set('registrationAuthority')} />
      </div>
    </Modal>
  )
}

function UploadModal({ caseId, onClose, onDone }) {
  const toast = useToast()
  const [form, setForm] = useState({ type: REGISTRATION_DOCUMENTS[0], name: '', status: 'Received' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const save = async () => {
    if (!form.name.trim()) { toast.error('Document name is required'); return }
    setBusy(true)
    try { await registrationsApi.addDocument(caseId, { name: form.name, type: form.type, status: form.status }); toast.success('Document added'); onDone() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="Add Document" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Add</Button></>}>
      <div className="space-y-4 py-2">
        <Select label="Document Type" value={form.type} onChange={set('type')}>{REGISTRATION_DOCUMENTS.map((t) => <option key={t} value={t}>{t}</option>)}</Select>
        <Input label="Document Name" placeholder="e.g. Sale_Agreement.pdf" value={form.name} onChange={set('name')} />
        <Select label="Status" value={form.status} onChange={set('status')}>{['Pending', 'Received', 'Verified', 'Rejected'].map((s) => <option key={s} value={s}>{s}</option>)}</Select>
      </div>
    </Modal>
  )
}
