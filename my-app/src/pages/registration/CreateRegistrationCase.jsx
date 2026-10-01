import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Card, Button, Input, Select, Textarea } from '../../components/ui.jsx'
import { REGISTRATION_TYPES } from '../../lib/registrationConstants.js'
import { registrationsApi } from '../../api/resources.js'
import { useToast } from '../../context/ToastContext.jsx'

export default function CreateRegistrationCase() {
  const navigate = useNavigate()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    bookingLabel: '', customerName: '', project: '', unitNumber: '', branch: '',
    registrationType: REGISTRATION_TYPES[0], registrationAuthority: '', assignedEmployeeName: '',
    expectedRegistrationDate: '', remarks: '',
  })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.customerName.trim()) { toast.error('Customer name is required.'); return }
    setSaving(true)
    try {
      const res = await registrationsApi.create({
        bookingLabel: form.bookingLabel, customerName: form.customerName, project: form.project,
        unitNumber: form.unitNumber, branch: form.branch, registrationType: form.registrationType,
        registrationAuthority: form.registrationAuthority || undefined,
        assignedEmployeeName: form.assignedEmployeeName || undefined,
        expectedRegistrationDate: form.expectedRegistrationDate || undefined,
        status: 'Pending', remarks: form.remarks || undefined,
      })
      toast.success('Registration case created')
      navigate(`../${res.data.data._id}`, { relative: 'path' })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create case')
    } finally { setSaving(false) }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="-ml-3 mb-2">← Back</Button>
        <PageHeader title="Create Registration Case" subtitle="Start a new property registration tracking record." />
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="mb-6 p-6">
          <h3 className="mb-4 text-base font-semibold text-slate-900">Booking & Customer Information</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Booking ID / Reference" placeholder="e.g. BK-1001" value={form.bookingLabel} onChange={set('bookingLabel')} />
            <Input label="Customer Name *" value={form.customerName} onChange={set('customerName')} required />
            <Input label="Project" value={form.project} onChange={set('project')} />
            <Input label="Unit Number" value={form.unitNumber} onChange={set('unitNumber')} />
            <Input label="Branch" value={form.branch} onChange={set('branch')} />
          </div>
        </Card>

        <Card className="mb-6 p-6">
          <h3 className="mb-4 text-base font-semibold text-slate-900">Registration Details</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Registration Type" value={form.registrationType} onChange={set('registrationType')}>
              {REGISTRATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Input label="Registration Authority / Office" value={form.registrationAuthority} onChange={set('registrationAuthority')} placeholder="e.g. Sub-Registrar Office, Andheri" />
            <Input label="Assigned Employee" value={form.assignedEmployeeName} onChange={set('assignedEmployeeName')} />
            <Input label="Expected Registration Date" type="date" value={form.expectedRegistrationDate} onChange={set('expectedRegistrationDate')} />
          </div>
          <div className="mt-4"><Textarea label="Remarks" value={form.remarks} onChange={set('remarks')} /></div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" type="button" onClick={() => navigate(-1)}>Cancel</Button>
          <Button variant="primary" type="submit" loading={saving}>Create Case</Button>
        </div>
      </form>
    </div>
  )
}
