import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Card, Button, Input, Select, Textarea } from '../../components/ui.jsx'
import { LOAN_TYPES, FINANCIAL_INSTITUTIONS } from '../../lib/loanConstants.js'
import { loansApi } from '../../api/resources.js'
import { useToast } from '../../context/ToastContext.jsx'

export default function CreateLoanCase() {
  const navigate = useNavigate()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    bookingLabel: '', customerName: '', project: '', unitNumber: '', branch: '',
    loanRequired: 'Yes', loanAmount: '', bank: '', loanType: '',
    applicationNumber: '', applicationDate: '', assignedExecutiveName: '', expectedSanctionDate: '', remarks: '',
  })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.customerName.trim()) { toast.error('Customer name is required.'); return }
    if (form.loanRequired === 'Yes' && !form.loanAmount) { toast.error('Loan amount is required.'); return }
    setSaving(true)
    try {
      const body = {
        bookingLabel: form.bookingLabel, customerName: form.customerName, project: form.project,
        unitNumber: form.unitNumber, branch: form.branch,
        loanRequired: form.loanRequired === 'Yes',
        loanAmount: Number(form.loanAmount) || 0,
        bank: form.bank || undefined, loanType: form.loanType || undefined,
        applicationNumber: form.applicationNumber || undefined,
        applicationDate: form.applicationDate || undefined,
        assignedExecutiveName: form.assignedExecutiveName || undefined,
        expectedSanctionDate: form.expectedSanctionDate || undefined,
        status: form.loanRequired === 'Yes' ? 'Required' : 'Not Required',
        remarks: form.remarks || undefined,
      }
      const res = await loansApi.create(body)
      toast.success('Loan case created')
      navigate(`../${res.data.data._id}`, { relative: 'path' })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create loan case')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="-ml-3 mb-2">← Back to Loans</Button>
        <PageHeader title="Create Loan Case" subtitle="Start a new property loan tracking record." />
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
          <h3 className="mb-4 text-base font-semibold text-slate-900">Loan Requirements</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Loan Required *" value={form.loanRequired} onChange={set('loanRequired')} required>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </Select>
            {form.loanRequired === 'Yes' && (
              <>
                <Input label="Loan Amount Required *" type="number" min="1" value={form.loanAmount} onChange={set('loanAmount')} required />
                <Select label="Bank / Financial Institution" value={form.bank} onChange={set('bank')}>
                  <option value="">Select Bank…</option>
                  {FINANCIAL_INSTITUTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
                </Select>
                <Select label="Loan Type" value={form.loanType} onChange={set('loanType')}>
                  <option value="">Select Type…</option>
                  {LOAN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </>
            )}
          </div>
        </Card>

        <Card className="mb-6 p-6">
          <h3 className="mb-4 text-base font-semibold text-slate-900">Processing Details</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Application Number" value={form.applicationNumber} onChange={set('applicationNumber')} />
            <Input label="Application Date" type="date" value={form.applicationDate} onChange={set('applicationDate')} />
            <Input label="Assigned Finance Executive" value={form.assignedExecutiveName} onChange={set('assignedExecutiveName')} />
            <Input label="Expected Sanction Date" type="date" value={form.expectedSanctionDate} onChange={set('expectedSanctionDate')} />
          </div>
          <div className="mt-4"><Textarea label="Remarks" value={form.remarks} onChange={set('remarks')} /></div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" type="button" onClick={() => navigate(-1)}>Cancel</Button>
          <Button variant="primary" type="submit" loading={saving}>Create Loan Case</Button>
        </div>
      </form>
    </div>
  )
}
