import { useState, useEffect, useCallback } from 'react'
import { legalApi, usersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { titleCase } from '../../lib/format.js'
import { Modal, Button, Input, Textarea, Select } from '../../components/ui.jsx'
import { AGREEMENT_TYPES } from '../../lib/legal.js'

// Create Legal Case (§Create Legal Case). Always linked to an existing booking;
// customer / project / unit are auto-filled from the chosen booking.
export default function CreateLegalCaseModal({ onClose, onDone, bookingId }) {
  const toast = useToast()
  const [form, setForm] = useState({ booking: bookingId || '', legalExecutive: '', agreementType: 'sale_agreement', expectedCompletionDate: '', remarks: '' })
  const [ctx, setCtx] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const { data: bookings } = useFetch(useCallback(() => legalApi.bookings(), []))
  const { data: employees } = useFetch(useCallback(() => usersApi.list({ status: 'active', limit: 300 }), []))

  useEffect(() => {
    let active = true
    if (!form.booking) { setCtx(null); return }
    legalApi.bookingContext(form.booking).then((res) => { if (active) setCtx(res.data.data) }).catch(() => { if (active) setCtx(null) })
    return () => { active = false }
  }, [form.booking])

  const valid = Boolean(form.booking)

  async function submit() {
    if (!valid) { toast.error('Select a booking to link this legal case to'); return }
    setBusy(true)
    try {
      await legalApi.create({
        booking: form.booking,
        legalExecutive: form.legalExecutive || undefined,
        agreementType: form.agreementType,
        expectedCompletionDate: form.expectedCompletionDate || undefined,
        remarks: form.remarks || undefined,
      })
      toast.success('Legal case created')
      onDone()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create legal case') }
    finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} wide title="Create Legal Case" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy || !valid}>Create Case</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Select label="Booking *" value={form.booking} onChange={set('booking')} disabled={Boolean(bookingId)}>
            <option value="">Select a confirmed booking…</option>
            {(bookings || []).map((b) => <option key={b._id} value={b._id}>{b.customerName} · {b.projectName || '—'} · Unit {b.unitNumber || '—'}</option>)}
          </Select>
          {(bookings || []).length === 0 && <p className="mt-1 text-xs text-slate-400">All bookings already have a legal case, or there are no confirmed bookings yet.</p>}
        </div>

        {ctx && (
          <div className="sm:col-span-2 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-4">
            <div><div className="text-xs text-slate-500">Customer</div><div className="font-medium text-slate-800">{ctx.customerName}</div></div>
            <div><div className="text-xs text-slate-500">Project</div><div className="text-slate-800">{ctx.projectName || '—'}</div></div>
            <div><div className="text-xs text-slate-500">Unit</div><div className="text-slate-800">{ctx.unitNumber || '—'}</div></div>
            <div><div className="text-xs text-slate-500">Branch</div><div className="text-slate-800">{ctx.branch || '—'}</div></div>
          </div>
        )}

        <Select label="Assign Legal Executive" value={form.legalExecutive} onChange={set('legalExecutive')}>
          <option value="">— Assign later —</option>
          {(employees || []).map((e) => <option key={e._id} value={e._id}>{e.name} · {titleCase(e.role)}</option>)}
        </Select>
        <Select label="Agreement Type" value={form.agreementType} onChange={set('agreementType')}>
          {AGREEMENT_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
        </Select>
        <Input label="Expected Completion Date" type="date" value={form.expectedCompletionDate} onChange={set('expectedCompletionDate')} />
        <div className="sm:col-span-2"><Textarea label="Remarks" value={form.remarks} onChange={set('remarks')} /></div>
      </div>
      <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">A standard document checklist (PAN, Aadhaar, Photograph, Address Proof, Booking Form and more) is created automatically.</p>
    </Modal>
  )
}
